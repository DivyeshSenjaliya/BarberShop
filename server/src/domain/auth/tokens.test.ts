import { UnauthorizedError } from '../../core/errors';
import {
  bearerToken,
  hashToken,
  newRefreshToken,
  signAccessToken,
  verifyAccessToken,
  type AccessTokenPayload,
  type TokenOptions,
} from './tokens';

const options: TokenOptions = {
  secret: 'test-secret-that-is-long-enough-123456',
  ttlSeconds: 900,
  issuer: 'barbershop.test',
};

const payload: AccessTokenPayload = {
  sub: 'usr_1',
  sid: 'ses_1',
  role: 'customer',
  email: 'kim@example.com',
  tokenType: 'access',
};

describe('access tokens', () => {
  it('round-trips the payload', () => {
    const token = signAccessToken(payload, options);
    expect(verifyAccessToken(token, options)).toEqual(payload);
  });

  it('rejects a tampered signature', () => {
    const token = signAccessToken(payload, options);
    const [header, , signature] = token.split('.');
    const escalated = Buffer.from(
      JSON.stringify({ ...payload, role: 'admin' }),
      'utf8',
    ).toString('base64url');
    const forged = `${header}.${escalated}.${signature}`;
    expect(() => verifyAccessToken(forged, options)).toThrow(UnauthorizedError);
    try {
      verifyAccessToken(forged, options);
    } catch (error) {
      expect((error as UnauthorizedError).code).toBe('invalid_token');
    }
  });

  it('rejects a token signed with a different secret', () => {
    const token = signAccessToken(payload, options);
    expect(() =>
      verifyAccessToken(token, { ...options, secret: 'another-secret-another-secret-1234' }),
    ).toThrow(/not valid/);
  });

  it('rejects a token from a different issuer', () => {
    const token = signAccessToken(payload, { ...options, issuer: 'someone.else' });
    expect(() => verifyAccessToken(token, options)).toThrow(UnauthorizedError);
  });

  it('reports expiry distinctly from invalidity', () => {
    const expired = signAccessToken(payload, { ...options, ttlSeconds: -5 });
    try {
      verifyAccessToken(expired, options);
      throw new Error('expected expiry failure');
    } catch (error) {
      expect((error as UnauthorizedError).code).toBe('token_expired');
      expect((error as UnauthorizedError).status).toBe(401);
    }
  });

  it('rejects tokens missing required claims', () => {
    const incomplete = signAccessToken(
      { sub: 'usr_1' } as unknown as AccessTokenPayload,
      options,
    );
    try {
      verifyAccessToken(incomplete, options);
      throw new Error('expected claim validation failure');
    } catch (error) {
      expect((error as UnauthorizedError).code).toBe('invalid_token');
    }
  });

  it('rejects non-string tokens', () => {
    expect(() => verifyAccessToken('', options)).toThrow(UnauthorizedError);
    expect(() => verifyAccessToken('garbage', options)).toThrow(UnauthorizedError);
  });
});

describe('refresh tokens', () => {
  it('generates unique opaque tokens with a matching hash', () => {
    const first = newRefreshToken();
    const second = newRefreshToken();

    expect(first.token).not.toBe(second.token);
    expect(first.token).toMatch(/^[A-Za-z0-9_-]{64}$/);
    expect(first.hash).toBe(hashToken(first.token));
    expect(first.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(first.hash).not.toBe(second.hash);
  });

  it('hashes deterministically', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'));
    expect(hashToken('abc')).not.toBe(hashToken('abd'));
  });
});

describe('bearerToken', () => {
  it('extracts the token from an Authorization header', () => {
    expect(bearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi');
    expect(bearerToken('bearer abc')).toBe('abc');
  });

  it('rejects malformed headers', () => {
    expect(bearerToken(undefined)).toBeNull();
    expect(bearerToken('')).toBeNull();
    expect(bearerToken('Basic dXNlcjpwYXNz')).toBeNull();
    expect(bearerToken('Bearer')).toBeNull();
    expect(bearerToken('Bearer ')).toBeNull();
    expect(bearerToken('Bearer abc extra')).toBeNull();
  });
});
