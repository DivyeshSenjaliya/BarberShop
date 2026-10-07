import { ConflictError, UnauthorizedError } from '../../core/errors';
import { SessionsRepository } from '../../db/repositories/sessions';
import { UsersRepository } from '../../db/repositories/users';
import { createTestConfig, createTestDb, captureLogs } from '../../test-support/db';
import type { Db } from '../../db/sqlite';
import { PasswordPolicyError } from './password';
import { AuthService, type AuthSessionResult } from './service';
import { verifyAccessToken } from './tokens';

const PASSWORD = 'cut-m3-not-deep';

/** Assert that `run` throws an error carrying the expected machine code. */
function expectFailure(run: () => unknown, code: string): void {
  let caught: unknown = null;
  try {
    run();
  } catch (error) {
    caught = error;
  }
  expect(caught).not.toBeNull();
  expect((caught as { code?: string }).code).toBe(code);
}

describe('AuthService', () => {
  let db: Db;
  let service: AuthService;
  let users: UsersRepository;
  let sessions: SessionsRepository;
  let lines: Array<Record<string, unknown>>;
  let clock: Date;
  const config = createTestConfig();

  const tokenOptions = {
    secret: config.auth.secret,
    ttlSeconds: config.auth.accessTokenTtlSeconds,
    issuer: 'barbershop-api',
  };

  beforeEach(() => {
    db = createTestDb();
    clock = new Date('2026-10-07T10:00:00.000Z');
    const captured = captureLogs();
    lines = captured.lines;
    service = new AuthService({
      db,
      config,
      logger: captured.logger,
      now: () => clock,
    });
    users = new UsersRepository(db);
    sessions = new SessionsRepository(db);
  });

  afterEach(() => db.close());

  async function register(overrides: Record<string, unknown> = {}): Promise<AuthSessionResult> {
    return service.register({
      email: 'kim@example.com',
      password: PASSWORD,
      firstName: 'Kim',
      lastName: 'Lee',
      ...overrides,
    });
  }

  describe('register', () => {
    it('creates an account and returns working tokens', async () => {
      const result = await register();

      expect(result.user).toMatchObject({
        email: 'kim@example.com',
        displayName: 'Kim Lee',
        role: 'customer',
        status: 'active',
      });
      expect(result.session.tokenType).toBe('Bearer');
      expect(result.session.refreshToken).toMatch(/^[A-Za-z0-9_-]{64}$/);

      const claims = verifyAccessToken(result.session.accessToken, tokenOptions);
      expect(claims.sub).toBe(result.user.id);
      expect(claims.sid).toBe(result.session.id);

      const stored = db.get<{ refresh_token_hash: string }>(
        'SELECT refresh_token_hash FROM auth_sessions WHERE id = ?',
        [result.session.id],
      );
      expect(stored).toBeDefined();
    });

    it('never returns password material', async () => {
      const result = await register();
      expect(JSON.stringify(result)).not.toContain(PASSWORD);
      expect(JSON.stringify(result)).not.toContain('scrypt$');
      expect((result.user as unknown as Record<string, unknown>).passwordHash).toBeUndefined();
    });

    it('rejects a duplicate email with a 409', async () => {
      await register();
      await expect(register({ phone: '+15550001111' })).rejects.toBeInstanceOf(ConflictError);
      try {
        await register();
      } catch (error) {
        expect((error as ConflictError).status).toBe(409);
        expect((error as ConflictError).details?.[0]?.path).toBe('email');
      }
    });

    it('rejects a duplicate phone number', async () => {
      await register({ phone: '+15550001111' });
      await expect(
        register({ email: 'other@example.com', phone: '+15550001111' }),
      ).rejects.toMatchObject({ status: 409 });
    });

    it('enforces the password policy', async () => {
      await expect(register({ password: 'short' })).rejects.toBeInstanceOf(PasswordPolicyError);
      expect(users.emailExists('kim@example.com')).toBe(false);
    });

    it('logs the registration without credentials', async () => {
      const result = await register();
      const entry = lines.find((line) => line.message === 'auth.registered');
      expect(entry).toMatchObject({ userId: result.user.id, level: 'info' });
      expect(JSON.stringify(lines)).not.toContain(PASSWORD);
    });
  });

  describe('login', () => {
    it('accepts the correct credentials', async () => {
      const created = await register();
      const result = await service.login({ email: 'KIM@example.com', password: PASSWORD });

      expect(result.user.id).toBe(created.user.id);
      expect(result.session.id).not.toBe(created.session.id);
      expect(users.findById(created.user.id)!.lastLoginAt).not.toBeNull();
      // Both sessions remain active until one of them is used or revoked.
      expect(sessions.listForUser(created.user.id, { activeOnly: true })).toHaveLength(2);
    });

    it('rejects an unknown email and a wrong password with the same code', async () => {
      await register();

      for (const attempt of [
        { email: 'nobody@example.com', password: PASSWORD },
        { email: 'kim@example.com', password: 'wrong-password-1' },
      ]) {
        try {
          await service.login(attempt);
          throw new Error('expected login to fail');
        } catch (error) {
          expect(error).toBeInstanceOf(UnauthorizedError);
          expect((error as UnauthorizedError).code).toBe('invalid_credentials');
          expect((error as UnauthorizedError).message).toBe(
            'Email or password is incorrect',
          );
        }
      }
    });

    it('counts consecutive failures and locks the account', async () => {
      const created = await register();

      for (let attempt = 1; attempt <= 5; attempt += 1) {
        await expect(
          service.login({ email: 'kim@example.com', password: 'wrong-password-1' }),
        ).rejects.toMatchObject({ code: 'invalid_credentials' });
        expect(users.findById(created.user.id)!.failedLoginCount).toBe(attempt);
      }
      expect(users.findById(created.user.id)!.lockedUntil).not.toBeNull();

      // Even the correct password is refused while the lock holds.
      await expect(
        service.login({ email: 'kim@example.com', password: PASSWORD }),
      ).rejects.toMatchObject({ code: 'account_locked' });

      // And it unlocks once the window passes.
      clock = new Date(clock.getTime() + 16 * 60_000);
      const afterLock = await service.login({ email: 'kim@example.com', password: PASSWORD });
      expect(afterLock.user.id).toBe(created.user.id);
      expect(users.findById(created.user.id)!.failedLoginCount).toBe(0);
    });

    it('resets the failure counter on a successful login', async () => {
      await register();
      await service.login({ email: 'kim@example.com', password: 'wrong-password-1' }).catch(() => undefined);
      await service.login({ email: 'kim@example.com', password: PASSWORD });
      const user = users.findByEmail('kim@example.com')!;
      expect(user.failedLoginCount).toBe(0);
      expect(user.lockedUntil).toBeNull();
    });

    it('refuses suspended accounts', async () => {
      const created = await register();
      users.setStatus(created.user.id, 'suspended');

      await expect(
        service.login({ email: 'kim@example.com', password: PASSWORD }),
      ).rejects.toMatchObject({ code: 'account_suspended' });
    });

    it('never logs the submitted password', async () => {
      await register();
      await service.login({ email: 'kim@example.com', password: 'wrong-password-1' }).catch(() => undefined);
      await service.login({ email: 'kim@example.com', password: PASSWORD }).catch(() => undefined);
      expect(JSON.stringify(lines)).not.toContain('wrong-password-1');
      expect(JSON.stringify(lines)).not.toContain(PASSWORD);
    });
  });

  describe('refresh', () => {
    it('rotates the refresh token and invalidates the old one', async () => {
      const first = await register();
      const second = service.refresh(first.session.refreshToken);

      expect(second.session.refreshToken).not.toBe(first.session.refreshToken);
      expect(second.session.id).not.toBe(first.session.id);
      expect(verifyAccessToken(second.session.accessToken, tokenOptions).sid).toBe(second.session.id);

      // Replaying the old token is detected as reuse of a rotated session.
      expectFailure(() => service.refresh(first.session.refreshToken), 'session_revoked');
    });

    it('supports several consecutive rotations', async () => {
      let result = await register();
      for (let round = 0; round < 3; round += 1) {
        result = service.refresh(result.session.refreshToken);
      }
      expect(verifyAccessToken(result.session.accessToken, tokenOptions).sub).toBe(result.user.id);
      expect(sessions.listForUser(result.user.id, { activeOnly: true })).toHaveLength(1);
    });

    it('rejects an unknown refresh token', () => {
      expectFailure(() => service.refresh('not-a-real-token'), 'invalid_session');
    });

    it('rejects an expired session', async () => {
      const first = await register();
      db.run('UPDATE auth_sessions SET expires_at = ? WHERE id = ?', [
        new Date(clock.getTime() - 1000).toISOString(),
        first.session.id,
      ]);
      expectFailure(() => service.refresh(first.session.refreshToken), 'session_expired');
    });

    it('rejects refresh for a deleted or suspended user', async () => {
      const first = await register();
      users.softDelete(first.user.id);
      expectFailure(() => service.refresh(first.session.refreshToken), 'account_inactive');
    });
  });

  describe('logout', () => {
    it('revokes the presented refresh token', async () => {
      const first = await register();
      service.logout(first.session.refreshToken);

      expectFailure(() => service.refresh(first.session.refreshToken), 'session_revoked');
      expect(sessions.listForUser(first.user.id, { activeOnly: true })).toHaveLength(0);
    });

    it('treats an unknown token as already logged out', () => {
      expect(() => service.logout('unknown-token')).not.toThrow();
    });

    it('revokes every other session on logoutAll', async () => {
      const first = await register();
      const second = await service.login({ email: 'kim@example.com', password: PASSWORD });

      expect(service.logoutAll(first.user.id)).toBe(2);
      expect(sessions.listForUser(first.user.id, { activeOnly: true })).toHaveLength(0);
      expectFailure(() => service.refresh(second.session.refreshToken), 'session_revoked');
    });
  });

  describe('profile', () => {
    it('returns the public profile and active sessions', async () => {
      const first = await register();
      const profile = service.getProfile(first.user.id);

      expect(profile.id).toBe(first.user.id);
      expect(profile).not.toHaveProperty('passwordHash');
      expect(service.listSessions(first.user.id).map((session) => session.id)).toEqual([
        first.session.id,
      ]);
    });

    it('rejects a profile request for a deleted user', async () => {
      const first = await register();
      users.softDelete(first.user.id);
      expectFailure(() => service.getProfile(first.user.id), 'account_inactive');
    });
  });
});
