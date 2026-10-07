import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { AppConfig } from '../../core/config';
import { ForbiddenError, UnauthorizedError } from '../../core/errors';
import { assertCan, can, isRole, type Permission } from '../../domain/auth/rbac';
import { bearerToken, verifyAccessToken } from '../../domain/auth/tokens';
import { SessionsRepository } from '../../db/repositories/sessions';
import { UsersRepository } from '../../db/repositories/users';
import type { Db } from '../../db/sqlite';
import '../context';

/**
 * Authentication and authorization middleware.
 *
 * `authenticate` verifies the access token *and* re-checks the session and
 * account on every request, so logging out, suspending or deleting an
 * account takes effect immediately rather than at token expiry. Later
 * steps only read the resolved principal from `res.locals`.
 */

export interface Principal {
  userId: string;
  sessionId: string;
  role: string;
  email: string;
}

export interface AuthDeps {
  db: Db;
  config: AppConfig;
}

function tokenOptions(config: AppConfig): { secret: string; ttlSeconds: number; issuer: string } {
  return {
    secret: config.auth.secret,
    ttlSeconds: config.auth.accessTokenTtlSeconds,
    issuer: 'barbershop-api',
  };
}

export function authenticate(deps: AuthDeps): RequestHandler {
  const sessions = new SessionsRepository(deps.db);
  const users = new UsersRepository(deps.db);

  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = bearerToken(req.header('authorization') ?? undefined);
      if (!token) throw new UnauthorizedError('Authentication is required');

      const claims = verifyAccessToken(token, tokenOptions(deps.config));

      const session = sessions.findById(claims.sid);
      if (!session || session.revokedAt) {
        throw new UnauthorizedError('Session has been revoked or is no longer valid', 'session_revoked');
      }
      if (new Date(session.expiresAt) <= new Date()) {
        throw new UnauthorizedError('Session has expired', 'session_expired');
      }
      if (session.userId !== claims.sub) {
        throw new UnauthorizedError('Access token does not match its session', 'invalid_token');
      }

      const user = users.findById(session.userId);
      if (!user) throw new UnauthorizedError('Account no longer exists', 'account_inactive');
      if (user.status === 'suspended') {
        throw new UnauthorizedError('This account has been suspended', 'account_suspended');
      }

      // Prefer the role on the record over the (possibly stale) token claim.
      const principal: Principal = {
        userId: user.id,
        sessionId: session.id,
        role: user.role,
        email: user.email,
      };
      res.locals.auth = principal;
      res.locals.userId = user.id;
      req.log = req.log.child({ userId: user.id });
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireAuth(): RequestHandler {
  return (_req, res, next) => {
    if (!res.locals.auth) {
      next(new UnauthorizedError('Authentication is required'));
      return;
    }
    next();
  };
}

export function currentPrincipal(res: Response): Principal {
  const principal = res.locals.auth as Principal | undefined;
  if (!principal) throw new UnauthorizedError('Authentication is required');
  return principal;
}

export function requirePermission(...permissions: Permission[]): RequestHandler {
  return (_req, res, next) => {
    try {
      const principal = res.locals.auth as Principal | undefined;
      if (!principal) throw new UnauthorizedError('Authentication is required');
      if (!isRole(principal.role)) {
        throw new ForbiddenError('Your account has an unknown role');
      }

      const role = principal.role;
      const allowed =
        permissions.length === 0 ||
        permissions.some((permission) => can(role, permission));
      if (!allowed) {
        throw new ForbiddenError(
          `Your role '${role}' cannot perform any of: ${permissions.join(', ')}`,
        );
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

/** Service-level re-check helper (routes may be bypassed by jobs/CLI). */
export function assertPermission(role: string, permission: Permission): void {
  if (!isRole(role)) throw new ForbiddenError('Your account has an unknown role');
  assertCan(role, permission);
}
