import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../app';
import { createTestConfig, createTestDb, createTestLogger } from '../../test-support/db';
import type { AppConfig } from '../../core/config';
import type { Db } from '../../db/sqlite';
import { UsersRepository } from '../../db/repositories/users';
import { signAccessToken } from '../../domain/auth/tokens';
import { SessionsRepository } from '../../db/repositories/sessions';
import { newId } from '../../core/ids';

interface Harness {
  app: Express;
  db: Db;
  config: AppConfig;
}

function buildApp(): Harness {
  const config = createTestConfig();
  const db = createTestDb();
  const app = createApp({ config, logger: createTestLogger(), db });
  return { app, db, config };
}

function createAuthUser(
  db: Db,
  config: AppConfig,
  role: 'owner' | 'customer' | 'admin' = 'owner',
): { accessToken: string; userId: string } {
  const users = new UsersRepository(db);
  const sessions = new SessionsRepository(db);
  const userId = newId('usr');

  users.insert({
    id: userId,
    email: `${role}-${userId}@example.com`,
    passwordHash: 'scrypt_dummy',
    firstName: 'First',
    lastName: 'Last',
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

describe('Catalog HTTP Routes (/api/v1)', () => {
  let harness: Harness;

  beforeEach(() => {
    harness = buildApp();
  });

  afterEach(() => {
    harness.db.close();
  });

  describe('Shops & Branches', () => {
    it('enforces RBAC on shop creation and permits public listing', async () => {
      const { app, db, config } = harness;
      const owner = createAuthUser(db, config, 'owner');
      const customer = createAuthUser(db, config, 'customer');

      // Customer should receive 403
      const forbiddenRes = await request(app)
        .post('/api/v1/shops')
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .send({
          name: 'Forbidden Barbers',
          slug: 'forbidden-barbers',
        });
      expect(forbiddenRes.status).toBe(403);

      // Owner can create
      const createRes = await request(app)
        .post('/api/v1/shops')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({
          name: 'Crown & Blade',
          slug: 'crown-blade',
          description: 'Finest cuts in town',
        });
      expect(createRes.status).toBe(201);
      expect(createRes.body.data.shop.name).toBe('Crown & Blade');
      const shopId = createRes.body.data.shop.id;

      // Public listing
      const listRes = await request(app).get('/api/v1/shops');
      expect(listRes.status).toBe(200);
      expect(listRes.body.data.items).toHaveLength(1);

      // Public get by slug
      const getSlugRes = await request(app).get('/api/v1/shops/crown-blade');
      expect(getSlugRes.status).toBe(200);
      expect(getSlugRes.body.data.shop.id).toBe(shopId);

      // Create branch
      const branchRes = await request(app)
        .post(`/api/v1/shops/${shopId}/branches`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({
          name: 'SoHo Flagship',
          addressLine1: '450 Broadway',
          city: 'New York',
          postalCode: '10013',
        });
      expect(branchRes.status).toBe(201);
      const branchId = branchRes.body.data.branch.id;

      // Set business hours
      const hoursRes = await request(app)
        .put(`/api/v1/branches/${branchId}/hours`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({
          hours: [
            { weekday: 1, opensAt: '09:00', closesAt: '19:00', closed: false },
            { weekday: 0, closed: true },
          ],
        });
      expect(hoursRes.status).toBe(200);
      expect(hoursRes.body.data.hours).toHaveLength(2);

      // Public read business hours
      const getHoursRes = await request(app).get(`/api/v1/branches/${branchId}/hours`);
      expect(getHoursRes.status).toBe(200);
      expect(getHoursRes.body.data.hours).toHaveLength(2);
    });
  });

  describe('Services & Branch Overrides', () => {
    it('creates categories, services, and applies branch price overrides', async () => {
      const { app, db, config } = harness;
      const owner = createAuthUser(db, config, 'owner');

      const shopRes = await request(app)
        .post('/api/v1/shops')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ name: 'Alpha Barbers', slug: 'alpha-barbers' });
      const shopId = shopRes.body.data.shop.id;

      const branchRes = await request(app)
        .post(`/api/v1/shops/${shopId}/branches`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({
          name: 'Branch 1',
          addressLine1: '10 Alpha Way',
          city: 'Austin',
          postalCode: '78701',
        });
      const branchId = branchRes.body.data.branch.id;

      // Create category
      const catRes = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ shopId, name: 'Beard Grooming', slug: 'beard-grooming' });
      expect(catRes.status).toBe(201);

      // Create service
      const serviceRes = await request(app)
        .post(`/api/v1/shops/${shopId}/services`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({
          name: 'Deluxe Beard Sculpting',
          slug: 'deluxe-beard',
          durationMinutes: 30,
          priceCents: 3500,
        });
      expect(serviceRes.status).toBe(201);
      const serviceId = serviceRes.body.data.service.id;

      // Query branch services before override (default base price)
      const bsBeforeRes = await request(app).get(`/api/v1/branches/${branchId}/services`);
      expect(bsBeforeRes.status).toBe(200);
      expect(bsBeforeRes.body.data.services[0].effectivePriceCents).toBe(3500);

      // Override price at branch
      const overrideRes = await request(app)
        .put(`/api/v1/branches/${branchId}/services/${serviceId}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ priceCents: 4000, enabled: true });
      expect(overrideRes.status).toBe(200);

      const bsAfterRes = await request(app).get(`/api/v1/branches/${branchId}/services`);
      expect(bsAfterRes.body.data.services[0].effectivePriceCents).toBe(4000);
    });
  });

  describe('Staff & Schedules', () => {
    it('manages staff profiles, skills, and schedules', async () => {
      const { app, db, config } = harness;
      const owner = createAuthUser(db, config, 'owner');

      const shopRes = await request(app)
        .post('/api/v1/shops')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ name: 'Royal Cuts', slug: 'royal-cuts' });
      const shopId = shopRes.body.data.shop.id;

      const serviceRes = await request(app)
        .post(`/api/v1/shops/${shopId}/services`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({
          name: 'Scissor Cut',
          slug: 'scissor-cut',
          durationMinutes: 45,
          priceCents: 5000,
        });
      const serviceId = serviceRes.body.data.service.id;

      // Add staff member
      const staffRes = await request(app)
        .post(`/api/v1/shops/${shopId}/staff`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({
          employeeCode: 'BARBER-01',
          displayName: 'Sammy Scissorhands',
          commissionBps: 3000,
        });
      expect(staffRes.status).toBe(201);
      const staffId = staffRes.body.data.staff.id;

      // Assign service skill
      const skillRes = await request(app)
        .put(`/api/v1/staff/${staffId}/services`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ serviceIds: [serviceId] });
      expect(skillRes.status).toBe(200);
      expect(skillRes.body.data.serviceIds).toEqual([serviceId]);

      // Set schedule
      const schedRes = await request(app)
        .put(`/api/v1/staff/${staffId}/schedules`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({
          schedules: [{ weekday: 1, startsAt: '09:00', endsAt: '17:00' }],
        });
      expect(schedRes.status).toBe(200);
      expect(schedRes.body.data.schedules).toHaveLength(1);

      // Public read staff
      const getStaffRes = await request(app).get(`/api/v1/staff/${staffId}`);
      expect(getStaffRes.status).toBe(200);
      expect(getStaffRes.body.data.staff.displayName).toBe('Sammy Scissorhands');
    });
  });
});
