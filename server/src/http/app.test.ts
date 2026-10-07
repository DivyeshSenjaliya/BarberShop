import request from 'supertest';
import type { Express } from 'express';
import { loadConfig } from '../core/config';
import { createSilentLogger } from '../core/logger';
import { migrate } from '../db/migrate';
import { migrations } from '../db/migrations';
import { openDatabase, type Db } from '../db/sqlite';
import { createApp } from './app';

function buildApp(options: { jsonLimit?: string; now?: () => number } = {}): {
  app: Express;
  db: Db;
} {
  const config = loadConfig({ NODE_ENV: 'test' });
  const db = openDatabase(':memory:');
  migrate(db, migrations);
  const app = createApp(
    { config, logger: createSilentLogger(), db },
    {
      ...(options.jsonLimit ? { jsonLimit: options.jsonLimit } : {}),
      ...(options.now ? { now: options.now } : {}),
    },
  );
  return { app, db };
}

describe('createApp', () => {
  it('answers the health check with the standard envelope', async () => {
    const { app, db } = buildApp();
    const response = await request(app).get('/healthz');

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      status: 'ok',
      database: 'ok',
      environment: 'test',
    });
    expect(response.headers['x-request-id']).toEqual(expect.any(String));
    db.close();
  });

  it('echoes a client-supplied request id', async () => {
    const { app, db } = buildApp();
    const response = await request(app)
      .get('/healthz')
      .set('X-Request-Id', 'client-trace-1');
    expect(response.headers['x-request-id']).toBe('client-trace-1');
    db.close();
  });

  it('ignores a malformed client request id and generates one', async () => {
    const { app, db } = buildApp();
    const response = await request(app).get('/healthz').set('X-Request-Id', 'bad id !!!!');
    expect(response.headers['x-request-id']).not.toBe('bad id !!!!');
    db.close();
  });

  it('returns the standard envelope for unknown routes', async () => {
    const { app, db } = buildApp();
    const response = await request(app).get('/nope');
    expect(response.status).toBe(404);
    expect(response.body.error).toMatchObject({
      code: 'route_not_found',
      requestId: expect.any(String),
    });
    expect(response.body.error.message).toContain('/nope');
    db.close();
  });

  it('maps malformed JSON to a 400 instead of a 500', async () => {
    const { app, db } = buildApp();
    const response = await request(app)
      .post('/healthz')
      .set('Content-Type', 'application/json')
      .send('{ not json');
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('validation_failed');
    db.close();
  });

  it('rejects oversized payloads with 413', async () => {
    const { app, db } = buildApp({ jsonLimit: '1kb' });
    const response = await request(app)
      .post('/healthz')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ blob: 'x'.repeat(4096) }));
    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe('payload_too_large');
    db.close();
  });

  it('does not expose x-powered-by', async () => {
    const { app, db } = buildApp();
    const response = await request(app).get('/healthz');
    expect(response.headers['x-powered-by']).toBeUndefined();
    db.close();
  });

  it('enforces the global rate limit with standard headers', async () => {
    let clock = 1_000_000;
    const config = loadConfig({
      NODE_ENV: 'test',
      RATE_LIMIT_MAX: '3',
      RATE_LIMIT_WINDOW_MS: '60000',
    });
    const db = openDatabase(':memory:');
    migrate(db, migrations);
    const app = createApp(
      { config, logger: createSilentLogger(), db },
      { now: () => clock },
    );

    const statuses: number[] = [];
    for (let index = 0; index < 4; index += 1) {
      // Unknown routes still pass through the limiter before the 404 handler.
      const response = await request(app).get('/nope');
      statuses.push(response.status);
      if (index === 0) {
        expect(response.headers['x-ratelimit-limit']).toBe('3');
        expect(response.headers['x-ratelimit-remaining']).toBe('2');
      }
    }

    expect(statuses).toEqual([404, 404, 404, 429]);
    clock += 61_000;
    const afterWindow = await request(app).get('/nope');
    expect(afterWindow.status).toBe(404);
    db.close();
  });

  it('allows CORS from configured origins only', async () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      CORS_ORIGINS: 'https://app.example.com',
    });
    const db = openDatabase(':memory:');
    migrate(db, migrations);
    const app = createApp({ config, logger: createSilentLogger(), db });

    const allowed = await request(app)
      .get('/healthz')
      .set('Origin', 'https://app.example.com');
    expect(allowed.headers['access-control-allow-origin']).toBe('https://app.example.com');

    const blocked = await request(app)
      .get('/healthz')
      .set('Origin', 'https://evil.example.com');
    expect(blocked.headers['access-control-allow-origin']).toBeUndefined();
    db.close();
  });
});
