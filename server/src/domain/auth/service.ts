import type { AppConfig } from '../../core/config';
import { ConflictError, UnauthorizedError } from '../../core/errors';
import { newId } from '../../core/ids';
import type { Logger } from '../../core/logger';
import { SessionsRepository, type SessionRecord } from '../../db/repositories/sessions';
import { UsersRepository, normaliseEmail, type UserRecord } from '../../db/repositories/users';
import { isUniqueViolation, type Db } from '../../db/sqlite';
import { assertPasswordPolicy, hashPassword, verifyPassword } from './password';
import { hashToken, newRefreshToken, signAccessToken } from './tokens';

/**
 * Authentication service.
 *
 * Owns registration, login, token refresh (with rotation) and logout.
 * Failure paths are deliberate: unknown emails still cost a hash
 * verification so response timing does not disclose which accounts exist,
 * repeated failures lock the account, and every outcome is logged without
 * any credential material.
 */

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60_000;
const ISSUER = 'barbershop-api';

export interface PublicUser {
  id: string;
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string;
  displayName: string;
  avatarUrl: string | null;
  role: UserRecord['role'];
  status: UserRecord['status'];
  emailVerifiedAt: string | null;
  locale: string;
  timezone: string;
  createdAt: string;
  lastLoginAt: string | null;
}

export function toPublicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    firstName: user.firstName,
    lastName: user.lastName,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    role: user.role,
    status: user.status,
    emailVerifiedAt: user.emailVerifiedAt,
    locale: user.locale,
    timezone: user.timezone,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

export interface SessionContext {
  deviceName?: string | null;
  userAgent?: string | null;
  ipAddress?: string | null;
}

export interface AuthSessionResult {
  user: PublicUser;
  session: {
    id: string;
    accessToken: string;
    refreshToken: string;
    tokenType: 'Bearer';
    expiresIn: number;
    expiresAt: string;
  };
}

export interface RegisterInput extends SessionContext {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  locale?: string;
  timezone?: string;
}

export interface LoginInput extends SessionContext {
  email: string;
  password: string;
}

export interface AuthDeps {
  db: Db;
  config: AppConfig;
  logger: Logger;
  /** Injectable clock for deterministic tests. */
  now?: () => Date;
}

let timingEqualiser: Promise<string> | null = null;

/** Burn a hash verification when the email is unknown, to match timing. */
async function equaliseTiming(password: string): Promise<void> {
  timingEqualiser ??= hashPassword('timing-equaliser-placeholder');
  const stored = await timingEqualiser;
  await verifyPassword(password, stored);
}

export class AuthService {
  private readonly users: UsersRepository;
  private readonly sessions: SessionsRepository;
  private readonly now: () => Date;

  constructor(private readonly deps: AuthDeps) {
    this.users = new UsersRepository(deps.db);
    this.sessions = new SessionsRepository(deps.db);
    this.now = deps.now ?? (() => new Date());
  }

  async register(input: RegisterInput): Promise<AuthSessionResult> {
    assertPasswordPolicy(input.password, {
      minLength: this.deps.config.auth.passwordMinLength,
    });

    if (this.users.emailExists(input.email)) {
      throw new ConflictError('An account with this email already exists', [
        { path: 'email', message: 'already registered' },
      ]);
    }
    if (input.phone && this.users.phoneExists(input.phone)) {
      throw new ConflictError('An account with this phone number already exists', [
        { path: 'phone', message: 'already registered' },
      ]);
    }

    const passwordHash = await hashPassword(input.password);

    let user: UserRecord;
    try {
      user = this.users.insert({
        id: newId('usr'),
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone ?? null,
        locale: input.locale,
        timezone: input.timezone,
      });
    } catch (error) {
      // Two concurrent registrations can both pass the pre-check; the
      // unique index is the real arbiter.
      if (isUniqueViolation(error)) {
        throw new ConflictError('An account with this email already exists', [
          { path: 'email', message: 'already registered' },
        ]);
      }
      throw error;
    }

    const result = this.startSession(user, input);
    this.deps.logger.info('auth.registered', { userId: user.id, role: user.role });
    return result;
  }

  async login(input: LoginInput): Promise<AuthSessionResult> {
    const user = this.users.findByEmail(input.email);

    if (!user) {
      await equaliseTiming(input.password);
      this.deps.logger.warn('auth.login.failed', {
        reason: 'unknown_email',
        email: normaliseEmail(input.email),
      });
      throw new UnauthorizedError('Email or password is incorrect', 'invalid_credentials');
    }

    if (user.status === 'suspended') {
      this.deps.logger.warn('auth.login.blocked', { userId: user.id, reason: 'suspended' });
      throw new UnauthorizedError('This account has been suspended', 'account_suspended');
    }

    if (user.lockedUntil && new Date(user.lockedUntil) > this.now()) {
      this.deps.logger.warn('auth.login.blocked', { userId: user.id, reason: 'locked' });
      throw new UnauthorizedError(
        'Too many failed attempts, try again later',
        'account_locked',
      );
    }

    const passwordOk = await verifyPassword(input.password, user.passwordHash);
    if (!passwordOk) {
      const failures = this.users.incrementFailedLogins(user.id);
      if (failures >= MAX_FAILED_ATTEMPTS) {
        this.users.lockAccount(user.id, new Date(this.now().getTime() + LOCK_DURATION_MS));
        this.deps.logger.warn('auth.login.locked', { userId: user.id, failures });
      }
      throw new UnauthorizedError('Email or password is incorrect', 'invalid_credentials');
    }

    this.users.recordSuccessfulLogin(user.id);
    const result = this.startSession(user, input);
    this.deps.logger.info('auth.login.success', {
      userId: user.id,
      sessionId: result.session.id,
    });
    return result;
  }

  /**
   * Exchange a refresh token for a fresh session. The presented token is
   * revoked as 'rotated', so replaying an old token is detected as reuse.
   */
  refresh(refreshToken: string, context: SessionContext = {}): AuthSessionResult {
    const previous = this.sessions.findByRefreshTokenHash(hashToken(refreshToken));
    if (!previous) {
      throw new UnauthorizedError('Session is not valid', 'invalid_session');
    }
    if (previous.revokedAt) {
      this.deps.logger.warn('auth.refresh.reuse', {
        userId: previous.userId,
        sessionId: previous.id,
        reason: previous.revokedReason,
      });
      throw new UnauthorizedError('Session has been revoked', 'session_revoked');
    }
    if (new Date(previous.expiresAt) <= this.now()) {
      throw new UnauthorizedError('Session has expired', 'session_expired');
    }

    const user = this.users.findById(previous.userId);
    if (!user || user.status === 'suspended' || user.status === 'deleted') {
      throw new UnauthorizedError('Account is no longer active', 'account_inactive');
    }

    const rotated = newRefreshToken();
    const next = this.sessions.create({
      id: newId('ses'),
      userId: user.id,
      refreshTokenHash: rotated.hash,
      expiresAt: this.sessionExpiry(),
      deviceName: context.deviceName ?? previous.deviceName,
      userAgent: context.userAgent ?? previous.userAgent,
      ipAddress: context.ipAddress ?? previous.ipAddress,
    });
    this.sessions.revoke(previous.id, 'rotated');

    this.deps.logger.info('auth.refresh.rotated', {
      userId: user.id,
      previousSessionId: previous.id,
      sessionId: next.id,
    });

    return this.buildResult(user, next, rotated.token);
  }

  /** Logout by refresh token — the credential the client actually holds. */
  logout(refreshToken: string): void {
    const session = this.sessions.findByRefreshTokenHash(hashToken(refreshToken));
    if (!session) return; // logging out an already-gone session still succeeds
    this.sessions.revoke(session.id, 'logout');
    this.deps.logger.info('auth.logout', { userId: session.userId, sessionId: session.id });
  }

  logoutAll(userId: string): number {
    const revoked = this.sessions.revokeAllForUser(userId, 'logout_all');
    this.deps.logger.info('auth.logout_all', { userId, revoked });
    return revoked;
  }

  getProfile(userId: string): PublicUser {
    const user = this.users.findById(userId);
    if (!user) throw new UnauthorizedError('Account no longer exists', 'account_inactive');
    return toPublicUser(user);
  }

  listSessions(userId: string): SessionRecord[] {
    return this.sessions.listForUser(userId, { activeOnly: true });
  }

  private sessionExpiry(): string {
    return new Date(
      this.now().getTime() + this.deps.config.auth.refreshTokenTtlSeconds * 1000,
    ).toISOString();
  }

  /** Create a session row, then mint the access token for its real id. */
  private startSession(user: UserRecord, context: SessionContext): AuthSessionResult {
    const refresh = newRefreshToken();
    const session = this.sessions.create({
      id: newId('ses'),
      userId: user.id,
      refreshTokenHash: refresh.hash,
      expiresAt: this.sessionExpiry(),
      deviceName: context.deviceName ?? null,
      userAgent: context.userAgent ?? null,
      ipAddress: context.ipAddress ?? null,
    });
    return this.buildResult(user, session, refresh.token);
  }

  private buildResult(
    user: UserRecord,
    session: SessionRecord,
    refreshToken: string,
  ): AuthSessionResult {
    const { auth } = this.deps.config;
    const issuedAt = this.now();
    const accessToken = signAccessToken(
      { sub: user.id, sid: session.id, role: user.role, email: user.email, tokenType: 'access' },
      { secret: auth.secret, ttlSeconds: auth.accessTokenTtlSeconds, issuer: ISSUER },
    );

    return {
      user: toPublicUser(user),
      session: {
        id: session.id,
        accessToken,
        refreshToken,
        tokenType: 'Bearer',
        expiresIn: auth.accessTokenTtlSeconds,
        expiresAt: new Date(issuedAt.getTime() + auth.accessTokenTtlSeconds * 1000).toISOString(),
      },
    };
  }
}