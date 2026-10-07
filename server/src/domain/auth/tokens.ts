import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '../../core/errors';

/**
 * Token handling.
 *
 * - Access tokens are short-lived JWTs (HS256) carrying the session id, so
 *   revoking a session also invalidates its access tokens.
 * - Refresh tokens are opaque random strings; only their SHA-256 hash is
 *   stored, so a database leak cannot be replayed as a session.
 */

export interface AccessTokenPayload {
  /** User id. */
  sub: string;
  /** Session id — lets logout revoke this token. */
  sid: string;
  role: string;
  email: string;
  tokenType: 'access';
}

export interface TokenOptions {
  secret: string;
  ttlSeconds: number;
  issuer: string;
}

export const ACCESS_TOKEN_ALGORITHM = 'HS256';

export function signAccessToken(payload: AccessTokenPayload, options: TokenOptions): string {
  return jwt.sign(payload, options.secret, {
    algorithm: ACCESS_TOKEN_ALGORITHM,
    issuer: options.issuer,
    expiresIn: options.ttlSeconds,
    header: { typ: 'JWT', alg: ACCESS_TOKEN_ALGORITHM },
  });
}

/**
 * Verify signature, issuer, expiry and shape. Any failure becomes a 401 with
 * a stable code — never a 500, and never jwt's own error text.
 */
export function verifyAccessToken(token: string, options: TokenOptions): AccessTokenPayload {
  let decoded: unknown;
  try {
    decoded = jwt.verify(token, options.secret, {
      algorithms: [ACCESS_TOKEN_ALGORITHM],
      issuer: options.issuer,
    });
  } catch (error) {
    const reason = (error as { name?: string }).name;
    if (reason === 'TokenExpiredError') {
      throw new UnauthorizedError('Access token has expired', 'token_expired');
    }
    throw new UnauthorizedError('Access token is not valid', 'invalid_token');
  }

  if (typeof decoded === 'string' || decoded === null) {
    throw new UnauthorizedError('Access token is not valid', 'invalid_token');
  }

  const claim = decoded as Partial<AccessTokenPayload>;
  if (
    claim.tokenType !== 'access' ||
    typeof claim.sub !== 'string' ||
    typeof claim.sid !== 'string' ||
    typeof claim.role !== 'string' ||
    typeof claim.email !== 'string'
  ) {
    throw new UnauthorizedError('Access token is missing required claims', 'invalid_token');
  }

  return {
    sub: claim.sub,
    sid: claim.sid,
    role: claim.role,
    email: claim.email,
    tokenType: 'access',
  };
}

export interface IssuedRefreshToken {
  /** Value handed to the client. Never stored. */
  token: string;
  /** Value persisted in `auth_sessions.refresh_token_hash`. */
  hash: string;
}

export function newRefreshToken(): IssuedRefreshToken {
  const token = randomBytes(48).toString('base64url');
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function bearerToken(authorization: string | undefined): string | null {
  if (!authorization) return null;
  const [scheme, value, extra] = authorization.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !value || extra !== undefined) return null;
  return value;
}
