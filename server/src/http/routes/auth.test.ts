import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../app';
import { createTestConfig, createTestDb, createTestLogger } from '../../test-support/db';
import type { AppConfig } from '../../core/config';
import type { Db } from '../../db/sqlite';

const VALID_PASSWORD = 'scissors-42-cut';

interface Harness {
  app: Express;
  db: Db;
  config: AppConfig;
}

function buildApp(overrides: Record<string, string> = {}): Harness {
  const config = createTestConfig(overrides);
  const db = createTestDb();
  const app = createApp({ config, logger: createTestLogger(), db });
  return { app, db, config };
}

async function registerUser(
  app: Express,
  overrides: Record<string, unknown> = {},
): Promise<{ accessToken: string; refreshToken: string; userId: string; email: string }> {
  const response = await request(app).post('/api/v1/auth/register').send({
    email: 'kim@example.com',
    password: VALID_PASSWORD,
    firstName: 'Kim',
    lastName: 'Lee',
    ...overrides,
  });
  expect(response.status).toBe(201);
  return {
    accessToken: response.body.data.session.accessToken,
    refreshToken: response.body.data.session.refreshToken,
    userId: response.body.data.user.id,
    email: response.body.data.user.email,
  };
}

describe('POST /api/v1/auth/register', () => {
  it('creates an account and returns tokens', async () => {
    const { app, db } = buildApp();
    const response = await request(app).post('/api/v1/auth/register').send({
      email: 'kim@example.com',
      password: VALID_PASSWORD,
      firstName: 'Kim',
      lastName: 'Lee',
      phone: '+15550001111',
      deviceName: 'iPhone 15',
    });

    expect(response.status).toBe(201);
    expect(response.headers.location).toBe('/api/v1/auth/me');
    expect(response.body.data.user).toMatchObject({
      email: 'kim@example.com',
      displayName: 'Kim Lee',
      role: 'customer',
    });
    expect(response.body.data.session).toMatchObject({ tokenType: 'Bearer' });
    expect(response.text).not.toContain(VALID_PASSWORD);
    db.close();
  });

  it('rejects a duplicate email with 409', async () => {
    const { app, db } = buildApp();
    await registerUser(app);
    const response = await request(app).post('/api/v1/auth/register').send({
      email: 'KIM@example.com',
      password: VALID_PASSWORD,
      firstName: 'Kim',
      lastName: 'Lee',
    });

    expect(response.status).toBe(409);
    expect(response.body.error).toMatchObject({
      code: 'conflict',
      details: [expect.objectContaining({ path: 'email' })],
    });
    db.close();
  });

  it('reports field-level validation errors', async () => {
    const { app, db } = buildApp();
    const response = await request(app).post('/api/v1/auth/register').send({
      email: 'not-an-email',
      password: 'short',
      firstName: '',
      lastName: 'Lee',
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('validation_failed');
    const paths = response.body.error.details.map((detail: { path: string }) => detail.path);
    expect(paths).toEqual(
      expect.arrayContaining(['body.email', 'body.firstName']),
    );
    db.close();
  });

  it('maps a policy failure to a 400 with the password rule', async () => {
    const { app, db } = buildApp();
    const response = await request(app).post('/api/v1/auth/register').send({
      email: 'kim@example.com',
      password: 'short',
      firstName: 'Kim',
      lastName: 'Lee',
    });

    expect(response.status).toBe(400);
    expect(response.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'password', message: expect.stringContaining('10') }),
      ]),
    );
    db.close();
  });
});

describe('POST /api/v1/auth/login', () => {
  it('accepts valid credentials', async () => {
    const { app, db } = buildApp();
    await registerUser(app);

    const response = await request(app).post('/api/v1/auth/login').send({
      email: 'kim@example.com',
      password: VALID_PASSWORD,
    });

    expect(response.status).toBe(200);
    expect(response.body.data.session.accessToken).toEqual(expect.any(String));
    db.close();
  });

  it('rejects bad credentials without disclosing which field was wrong', async () => {
    const { app, db } = buildApp();
    await registerUser(app);

    const wrongPassword = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'kim@example.com', password: 'wrong-password-1' });
    const unknownEmail = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@example.com', password: 'wrong-password-1' });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.error.message).toBe(unknownEmail.body.error.message);
    expect(wrongPassword.body.error.code).toBe('invalid_credentials');
    db.close();
  });

  it('rate limits repeated attempts from one address', async () => {
    const { app, db } = buildApp({ AUTH_RATE_LIMIT_MAX: '4' });
    await registerUser(app);

    const statuses: number[] = [];
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'kim@example.com', password: VALID_PASSWORD });
      statuses.push(response.status);
    }

    expect(statuses).toEqual([200, 200, 200, 429]);
    db.close();
  });
});

describe('authenticated endpoints', () => {
  it('returns the current user for a valid token', async () => {
    const { app, db } = buildApp();
    const registered = await registerUser(app);

    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${registered.accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.user).toMatchObject({ id: registered.userId });
    db.close();
  });

  it('rejects a missing, malformed or foreign token', async () => {
    const { app, db } = buildApp();
    await registerUser(app);

    for (const header of ['Bearer', 'Basic abc', 'Bearer not.a.token']) {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', header);
      expect(response.status).toBe(401);
      expect(response.body.error.code).toMatch(/unauthenticated|invalid_token/);
    }
    db.close();
  });

  it('lists active sessions', async () => {
    const { app, db } = buildApp();
    const registered = await registerUser(app);

    const response = await request(app)
      .get('/api/v1/auth/sessions')
      .set('Authorization', `Bearer ${registered.accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.sessions).toHaveLength(1);
    expect(response.body.data.sessions[0]).not.toHaveProperty('refreshToken');
    db.close();
  });
});

describe('POST /api/v1/auth/refresh and logout', () => {
  it('rotates tokens and rejects the old refresh token', async () => {
    const { app, db } = buildApp();
    const registered = await registerUser(app);

    const refreshed = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: registered.refreshToken });
    expect(refreshed.status).toBe(200);
    const nextToken = refreshed.body.data.session.refreshToken;
    expect(nextToken).not.toBe(registered.refreshToken);

    const replay = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: registered.refreshToken });
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe('session_revoked');

    const secondGeneration = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: nextToken });
    expect(secondGeneration.status).toBe(200);
    db.close();
  });

  it('rejects an unknown refresh token', async () => {
    const { app, db } = buildApp();
    const response = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'clearly-not-a-real-token' });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('invalid_session');
    db.close();
  });

  it('logout revokes the session so its access token stops working', async () => {
    const { app, db } = buildApp();
    const registered = await registerUser(app);

    const logout = await request(app)
      .post('/api/v1/auth/logout')
      .send({ refreshToken: registered.refreshToken });
    expect(logout.status).toBe(204);

    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${registered.accessToken}`);
    expect(me.status).toBe(401);
    expect(me.body.error.code).toBe('session_revoked');

    const refresh = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: registered.refreshToken });
    expect(refresh.status).toBe(401);
    db.close();
  });

  it('logout-all revokes every session', async () => {
    const { app, db } = buildApp();
    const registered = await registerUser(app);
    const second = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: registered.email, password: VALID_PASSWORD });

    const response = await request(app)
      .post('/api/v1/auth/logout-all')
      .set('Authorization', `Bearer ${registered.accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.revoked).toBe(2);

    const refresh = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: second.body.data.session.refreshToken });
    expect(refresh.status).toBe(401);
    db.close();
  });

  it('reports a malformed JSON body as a 400', async () => {
    const { app, db } = buildApp();
    const response = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('validation_failed');
    db.close();
  });
});
