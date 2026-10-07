import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../app';
import { createTestConfig, createTestDb, createTestLogger } from '../../test-support/db';
import type { AppConfig } from '../../core/config';
import type { Db } from '../../db/sqlite';
import { UsersRepository } from '../../db/repositories/users';
import { signAccessToken } from '../../domain/auth/tokens';
import { SessionsRepository } from '../../db/repositories/sessions';
import { AuditLogsRepository } from '../../db/repositories/auditLogs';
import { newId } from '../../core/ids';

function createAuthUser(
  db: Db,
  config: AppConfig,
  role: 'owner' | 'customer' | 'admin' = 'customer',
): { accessToken: string; userId: string } {
  const users = new UsersRepository(db);
  const sessions = new SessionsRepository(db);
  const userId = newId('usr');

  users.insert({
    id: userId,
    email: `${role}-${userId}@example.com`,
    passwordHash: 'scrypt_dummy',
    firstName: 'Test',
    lastName: role.toUpperCase(),
    role,
  });

  const sessionId = newId('ses');
  sessions.create({
    id: sessionId,
    userId,
    refreshTokenHash: `hash_${sessionId}`,
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  });

  const accessToken = signAccessToken(
    { sub: userId, sid: sessionId, role, email: `${role}-${userId}@example.com`, tokenType: 'access' },
    { secret: config.auth.secret, ttlSeconds: 900, issuer: 'barbershop-api' },
  );

  return { accessToken, userId };
}

describe('Audit Logs Route (/api/v1/audit-logs)', () => {
  let app: Express;
  let db: Db;
  let config: AppConfig;

  beforeEach(() => {
    db = createTestDb();
    config = createTestConfig();
    const logger = createTestLogger();
    app = createApp({ config, logger, db });
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/v1/audit-logs');
    expect(res.status).toBe(401);
  });

  it('rejects non-privileged customer users with 403', async () => {
    const customer = createAuthUser(db, config, 'customer');
    const res = await request(app)
      .get('/api/v1/audit-logs')
      .set('Authorization', `Bearer ${customer.accessToken}`);
    expect(res.status).toBe(403);
  });

  it('allows admin users to query and filter audit logs', async () => {
    const admin = createAuthUser(db, config, 'admin');
    const repo = new AuditLogsRepository(db);

    repo.create({
      userId: admin.userId,
      action: 'shop.created',
      entityType: 'shop',
      entityId: 'shp_123',
      details: { name: 'Downtown Cuts' },
      ipAddress: '127.0.0.1',
      userAgent: 'jest-test',
    });

    repo.create({
      userId: null,
      action: 'user.login_failed',
      entityType: 'auth',
      entityId: 'unknown_user',
      details: null,
      ipAddress: '192.168.1.1',
      userAgent: 'jest-test',
    });

    const res = await request(app)
      .get('/api/v1/audit-logs')
      .set('Authorization', `Bearer ${admin.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta.total).toBe(2);
    expect(res.body.data[0].details).toEqual({ name: 'Downtown Cuts' });

    // Filter by action
    const filterRes = await request(app)
      .get('/api/v1/audit-logs?action=user.login_failed')
      .set('Authorization', `Bearer ${admin.accessToken}`);

    expect(filterRes.status).toBe(200);
    expect(filterRes.body.data).toHaveLength(1);
    expect(filterRes.body.data[0].action).toBe('user.login_failed');
  });
});
