import type { Request, RequestHandler } from 'express';
import { RateLimitError } from '../core/errors';

/**
 * Fixed-window rate limiting with a pluggable clock.
 *
 * The store is in-process (single-node deployments); `RateLimiter` is kept
 * separate from the middleware so the window logic can be unit tested and
 * later swapped for a shared store without touching routes.
 */

export interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Epoch milliseconds at which the current window resets. */
  resetAt: number;
}

interface Window {
  count: number;
  resetAt: number;
}

export class RateLimiter {
  private readonly windows = new Map<string, Window>();
  private lastSweep = 0;

  constructor(
    private readonly windowMs: number,
    private readonly max: number,
    private readonly now: () => number = Date.now,
  ) {}

  hit(key: string): RateLimitDecision {
    const time = this.now();
    this.sweep(time);

    let window = this.windows.get(key);
    if (!window || window.resetAt <= time) {
      window = { count: 0, resetAt: time + this.windowMs };
      this.windows.set(key, window);
    }

    window.count += 1;
    const allowed = window.count <= this.max;
    return {
      allowed,
      limit: this.max,
      remaining: Math.max(0, this.max - window.count),
      resetAt: window.resetAt,
    };
  }

  reset(key?: string): void {
    if (key === undefined) this.windows.clear();
    else this.windows.delete(key);
  }

  get size(): number {
    return this.windows.size;
  }

  private sweep(time: number): void {
    // Cheap periodic cleanup so forgotten keys cannot grow unbounded.
    if (time - this.lastSweep < this.windowMs) return;
    this.lastSweep = time;
    for (const [key, window] of this.windows) {
      if (window.resetAt <= time) this.windows.delete(key);
    }
  }
}

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  /** Defaults to client IP. Use a bucket name to scope per-route limits. */
  keyFor?: (req: Request) => string;
  now?: () => number;
  /** Skip limiting entirely (used by tests and health checks). */
  skip?: (req: Request) => boolean;
}

function defaultKey(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}

export function rateLimit(options: RateLimitOptions): RequestHandler {
  const now = options.now ?? Date.now;
  const limiter = new RateLimiter(options.windowMs, options.max, now);
  const keyFor = options.keyFor ?? defaultKey;

  return (req, res, next) => {
    if (options.skip?.(req)) {
      next();
      return;
    }

    const decision = limiter.hit(keyFor(req));
    const resetSeconds = Math.max(1, Math.ceil((decision.resetAt - now()) / 1000));
    res.setHeader('X-RateLimit-Limit', String(decision.limit));
    res.setHeader('X-RateLimit-Remaining', String(decision.remaining));
    res.setHeader('X-RateLimit-Reset', String(resetSeconds));

    if (!decision.allowed) {
      res.setHeader('Retry-After', String(resetSeconds));
      next(new RateLimitError(resetSeconds));
      return;
    }
    next();
  };
}
