import { createHash } from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { Db } from '../../db/sqlite';
import type { Principal } from './auth';
import { newId } from '../../core/ids';

/**
 * Idempotency key middleware.
 *
 * For state-mutating endpoints (POST), clients may send an
 * `Idempotency-Key` header. The middleware:
 *
 * 1. Looks up `(user_id, key)` in the database.
 * 2. If found and not expired, replays the stored response immediately
 *    without running the handler — identical outcome, no side effects.
 * 3. If not found, captures the response body and status code after the
 *    handler runs, then stores them for subsequent replay.
 *
 * Keys expire after 24 hours. Expired rows are cleaned lazily on write.
 *
 * The request body is hashed and stored; if the same key is reused with a
 * different body we return 422 so clients can detect bugs early.
 */

const KEY_TTL_HOURS = 24;
const HEADER = 'idempotency-key';
const RESPONSE_HEADER = 'Idempotency-Key-Replay';

interface StoredKey {
  id: string;
  key: string;
  user_id: string;
  method: string;
  path: string;
  status_code: number;
  response_body: string;
  request_checksum: string;
  expires_at: string;
  created_at: string;
}

function checksum(body: unknown): string {
  const serialised = JSON.stringify(body ?? '');
  return createHash('sha256').update(serialised).digest('hex');
}

function expiresAt(): string {
  const d = new Date();
  d.setHours(d.getHours() + KEY_TTL_HOURS);
  return d.toISOString();
}

function purgeExpired(db: Db): void {
  db.run("DELETE FROM idempotency_keys WHERE expires_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now')");
}

function find(db: Db, userId: string, key: string): StoredKey | null {
  return (
    db.get<StoredKey>(
      `SELECT * FROM idempotency_keys WHERE user_id = ? AND key = ? AND expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
      [userId, key],
    ) ?? null
  );
}

function store(
  db: Db,
  userId: string,
  key: string,
  method: string,
  path: string,
  statusCode: number,
  body: unknown,
  reqChecksum: string,
): void {
  purgeExpired(db);
  db.run(
    `INSERT OR REPLACE INTO idempotency_keys
       (id, user_id, key, method, path, status_code, response_body, request_checksum, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newId('idk'),
      userId,
      key,
      method,
      path,
      statusCode,
      JSON.stringify(body),
      reqChecksum,
      expiresAt(),
    ],
  );
}

/**
 * Factory — call once per app, mount on POST routes that need idempotency.
 * Routes that do NOT need it (GET, DELETE, PATCH) should skip this middleware.
 */
export function idempotency(db: Db): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    // Only meaningful for state-mutating methods
    if (req.method !== 'POST') {
      next();
      return;
    }

    const key = req.headers[HEADER] as string | undefined;
    if (!key || key.trim() === '') {
      next();
      return;
    }

    const principal = res.locals.auth as Principal | undefined;
    if (!principal) {
      next();
      return;
    }

    const { userId } = principal;
    const reqChecksum = checksum(req.body);

    try {
      const stored = find(db, userId, key);

      if (stored) {
        // Conflict check: same key, different body
        if (stored.request_checksum !== reqChecksum) {
          res.status(422).json({
            error: {
              code: 'idempotency_key_mismatch',
              message:
                'The Idempotency-Key was already used with a different request body. Use a new key for a different request.',
            },
          });
          return;
        }

        // Replay stored response
        const body = JSON.parse(stored.response_body) as unknown;
        res.status(stored.status_code).set(RESPONSE_HEADER, 'true').json(body);
        return;
      }

      // Intercept the response to capture it for storage
      const originalJson = res.json.bind(res);
      res.json = function captureSend(body: unknown) {
        const status = res.statusCode;
        try {
          store(db, userId, key, req.method, req.path, status, body, reqChecksum);
        } catch {
          // storage failure is non-fatal; the request still succeeds
        }
        return originalJson(body);
      };

      next();
    } catch (err) {
      next(err);
    }
  };
}
