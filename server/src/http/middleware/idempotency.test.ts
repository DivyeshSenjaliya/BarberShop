import { createHash } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { createTestDb } from '../../test-support/db';
import type { Db } from '../../db/sqlite';
import { idempotency } from './idempotency';
import { UsersRepository } from '../../db/repositories/users';
import { newId } from '../../core/ids';

function sha256(body: unknown): string {
  return createHash('sha256').update(JSON.stringify(body ?? '')).digest('hex');
}

/** Minimal mock of Express Request / Response for unit tests. */
function makeMockRequest(overrides: Partial<Request> = {}): Request {
  return {
    method: 'POST',
    path: '/api/v1/bookings',
    headers: {},
    body: { serviceId: 'srv_123' },
    ...overrides,
  } as unknown as Request;
}

function makeMockResponse(
  principal?: { userId: string; role: string },
): {
  res: Response;
  sent: { status: number; body: unknown } | null;
} {
  const sent: { status: number; body: unknown } | null = null;
  let capturedStatus = 200;

  const resObj = {
    locals: { auth: principal },
    statusCode: 200,
    status(code: number) {
      capturedStatus = code;
      resObj.statusCode = code;
      return resObj;
    },
    set(_header: string, _val: string) {
      return resObj;
    },
    json(body: unknown) {
      resObj._sent = { status: capturedStatus, body };
      return resObj;
    },
    _sent: null as { status: number; body: unknown } | null,
  };

  const res = resObj as unknown as Response;
  return { res, sent };
}

describe('idempotency middleware', () => {
  let db: Db;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(() => {
    db.close();
  });

  function seedUser(): string {
    const repo = new UsersRepository(db);
    const userId = newId('usr');
    repo.insert({
      id: userId,
      email: `user-${userId}@example.com`,
      passwordHash: 'hash',
      firstName: 'Test',
      lastName: 'User',
    });
    return userId;
  }

  it('passes through when method is not POST', () => {
    const middleware = idempotency(db);
    const req = makeMockRequest({ method: 'GET' } as Partial<Request>);
    const { res } = makeMockResponse();
    let called = false;

    middleware(req, res, () => {
      called = true;
    });

    expect(called).toBe(true);
  });

  it('passes through when Idempotency-Key header is absent', () => {
    const middleware = idempotency(db);
    const req = makeMockRequest();
    const { res } = makeMockResponse({ userId: 'usr_1', role: 'customer' });
    let called = false;

    middleware(req, res, () => {
      called = true;
    });

    expect(called).toBe(true);
  });

  it('passes through and captures response on first use of a key', () => {
    const userId = seedUser();
    const middleware = idempotency(db);
    const key = `key-${Date.now()}`;
    const req = makeMockRequest({
      headers: { 'idempotency-key': key },
    } as Partial<Request>);
    const { res } = makeMockResponse({ userId, role: 'customer' });

    let nextCalled = false;
    middleware(req, res, () => {
      nextCalled = true;
      // Simulate handler writing a response
      res.status(201).json({ id: 'bkd_abc', status: 'confirmed' });
    });

    expect(nextCalled).toBe(true);

    // Verify stored row
    const row = db.get<{ status_code: number; response_body: string; user_id: string }>(
      'SELECT * FROM idempotency_keys WHERE user_id = ? AND key = ?',
      [userId, key],
    );
    expect(row).not.toBeUndefined();
    expect(row!.status_code).toBe(201);
    expect(JSON.parse(row!.response_body)).toEqual({ id: 'bkd_abc', status: 'confirmed' });
  });

  it('replays stored response without calling next on duplicate key', () => {
    const userId = seedUser();
    const middleware = idempotency(db);
    const key = `dedup-${Date.now()}`;
    const body = { serviceId: 'srv_123' };
    const reqChecksum = sha256(body);

    // Pre-populate idempotency_keys table directly
    db.run(
      `INSERT INTO idempotency_keys
         (id, user_id, key, method, path, status_code, response_body, request_checksum, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newId('idk'),
        userId,
        key,
        'POST',
        '/api/v1/bookings',
        201,
        JSON.stringify({ id: 'bkd_existing', status: 'confirmed' }),
        reqChecksum,
        new Date(Date.now() + 86400000).toISOString(),
      ],
    );

    const req = makeMockRequest({
      headers: { 'idempotency-key': key },
      body,
    } as Partial<Request>);
    const { res } = makeMockResponse({ userId, role: 'customer' });

    let nextCalled = false;
    middleware(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(false);
    expect((res as unknown as { _sent: { status: number; body: unknown } })._sent?.status).toBe(201);
    expect(
      (res as unknown as { _sent: { status: number; body: { id: string } } })._sent?.body,
    ).toEqual({ id: 'bkd_existing', status: 'confirmed' });
  });

  it('returns 422 when same key is reused with different body', () => {
    const userId = seedUser();
    const middleware = idempotency(db);
    const key = `conflict-${Date.now()}`;
    const originalChecksum = sha256({ serviceId: 'srv_123' });

    db.run(
      `INSERT INTO idempotency_keys
         (id, user_id, key, method, path, status_code, response_body, request_checksum, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newId('idk'),
        userId,
        key,
        'POST',
        '/api/v1/bookings',
        201,
        JSON.stringify({ id: 'bkd_xyz' }),
        originalChecksum,
        new Date(Date.now() + 86400000).toISOString(),
      ],
    );

    // Different body on second request
    const req = makeMockRequest({
      headers: { 'idempotency-key': key },
      body: { serviceId: 'DIFFERENT_srv' },
    } as Partial<Request>);
    const { res } = makeMockResponse({ userId, role: 'customer' });

    let nextCalled = false;
    middleware(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(false);
    const sent = (res as unknown as { _sent: { status: number; body: { error: { code: string } } } })._sent;
    expect(sent?.status).toBe(422);
    expect(sent?.body?.error?.code).toBe('idempotency_key_mismatch');
  });
});
