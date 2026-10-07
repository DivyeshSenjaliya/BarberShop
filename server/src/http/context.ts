import type { Logger } from '../core/logger';

/**
 * Express request augmentation. Every request carries an id and a child
 * logger so log lines produced while handling it can be correlated.
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Correlation id (echoed as `X-Request-Id`). */
      id: string;
      /** Logger already bound to `requestId`, method and path. */
      log: Logger;
      /** Monotonic start time for duration logging. */
      startedAt: number;
    }
  }
}

export {};
