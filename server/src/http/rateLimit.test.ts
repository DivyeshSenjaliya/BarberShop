import { RateLimitError } from '../core/errors';
import { RateLimiter, rateLimit } from './rateLimit';
import type { Request, Response } from 'express';

function makeRequest(ip = '10.0.0.1'): Request {
  return { ip, socket: { remoteAddress: ip }, path: '/x', method: 'GET' } as unknown as Request;
}

function makeResponse(): Response & { headers: Record<string, string> } {
  const headers: Record<string, string> = {};
  return {
    headers,
    setHeader(name: string, value: string) {
      headers[name.toLowerCase()] = value;
      return this;
    },
  } as unknown as Response & { headers: Record<string, string> };
}

describe('RateLimiter', () => {
  it('allows up to the max within a window', () => {
    let clock = 0;
    const limiter = new RateLimiter(1000, 3, () => clock);

    expect(limiter.hit('a')).toMatchObject({ allowed: true, remaining: 2 });
    expect(limiter.hit('a')).toMatchObject({ allowed: true, remaining: 1 });
    expect(limiter.hit('a')).toMatchObject({ allowed: true, remaining: 0 });
    expect(limiter.hit('a')).toMatchObject({ allowed: false, remaining: 0 });
    expect(limiter.hit('a')).toMatchObject({ allowed: false, remaining: 0 });
  });

  it('resets after the window elapses', () => {
    let clock = 0;
    const limiter = new RateLimiter(1000, 1, () => clock);

    expect(limiter.hit('a').allowed).toBe(true);
    expect(limiter.hit('a').allowed).toBe(false);
    clock = 1001;
    expect(limiter.hit('a')).toMatchObject({ allowed: true, remaining: 0 });
  });

  it('tracks keys independently', () => {
    const limiter = new RateLimiter(1000, 1, () => 0);
    expect(limiter.hit('a').allowed).toBe(true);
    expect(limiter.hit('b').allowed).toBe(true);
    expect(limiter.hit('a').allowed).toBe(false);
  });

  it('reports a monotonic reset timestamp', () => {
    const limiter = new RateLimiter(1000, 5, () => 5000);
    const first = limiter.hit('a');
    expect(first.resetAt).toBe(6000);
    expect(limiter.hit('a').resetAt).toBe(6000);
  });

  it('sweeps expired windows so memory does not grow forever', () => {
    let clock = 0;
    const limiter = new RateLimiter(100, 5, () => clock);
    for (let index = 0; index < 50; index += 1) limiter.hit(`key_${index}`);
    expect(limiter.size).toBe(50);

    clock = 10_000;
    limiter.hit('fresh');
    expect(limiter.size).toBeLessThanOrEqual(2);
  });

  it('can reset a single key or all keys', () => {
    const limiter = new RateLimiter(1000, 1, () => 0);
    limiter.hit('a');
    limiter.hit('b');
    limiter.reset('a');
    expect(limiter.hit('a').allowed).toBe(true);
    limiter.reset();
    expect(limiter.size).toBe(0);
  });
});

describe('rateLimit middleware', () => {
  it('sets standard headers and passes through under the limit', () => {
    const middleware = rateLimit({ windowMs: 1000, max: 2, now: () => 0 });
    const res = makeResponse();
    let nextError: unknown = 'unset';

    middleware(makeRequest(), res, (error?: unknown) => {
      nextError = error;
    });

    expect(nextError).toBeUndefined();
    expect(res.headers['x-ratelimit-limit']).toBe('2');
    expect(res.headers['x-ratelimit-remaining']).toBe('1');
    expect(res.headers['x-ratelimit-reset']).toBe('1');
  });

  it('passes a RateLimitError to next() once the limit is exceeded', () => {
    const middleware = rateLimit({ windowMs: 1000, max: 1, now: () => 0 });
    const first = makeResponse();
    const second = makeResponse();
    let nextError: unknown;

    middleware(makeRequest(), first, () => undefined);
    middleware(makeRequest(), second, (error?: unknown) => {
      nextError = error;
    });

    expect(nextError).toBeInstanceOf(RateLimitError);
    expect(second.headers['retry-after']).toBe('1');
    expect(second.headers['x-ratelimit-remaining']).toBe('0');
  });

  it('skips when the skip predicate matches', () => {
    const middleware = rateLimit({
      windowMs: 1000,
      max: 1,
      now: () => 0,
      skip: () => true,
    });
    const res = makeResponse();
    let nextError: unknown = 'unset';
    middleware(makeRequest(), res, (error?: unknown) => {
      nextError = error;
    });
    expect(nextError).toBeUndefined();
    expect(res.headers['x-ratelimit-limit']).toBeUndefined();
  });

  it('scopes the limit by the provided key', () => {
    const middleware = rateLimit({
      windowMs: 1000,
      max: 1,
      now: () => 0,
      keyFor: (req) => `auth:${req.ip}`,
    });
    middleware(makeRequest('1.1.1.1'), makeResponse(), () => undefined);
    let nextError: unknown;
    middleware(makeRequest('2.2.2.2'), makeResponse(), (error?: unknown) => {
      nextError = error;
    });
    expect(nextError).toBeUndefined();
  });
});
