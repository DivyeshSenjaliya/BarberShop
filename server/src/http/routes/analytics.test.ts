import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../app';
import { createTestConfig, createTestDb, createTestLogger } from '../../test-support/db';
import type { AppConfig } from '../../core/config';
import type { Db } from '../../db/sqlite';
import { UsersRepository } from '../../db/repositories/users';
import { signAccessToken } from '../../domain/auth/tokens';
import { SessionsRepository } from '../../db/repositories/sessions';
import { ShopsRepository } from '../../db/repositories/shops';
import { ServicesRepository } from '../../db/repositories/services';
import { StaffRepository } from '../../db/repositories/staff';
import { BookingsRepository } from '../../db/repositories/bookings';
import { newId } from '../../core/ids';

interface Harness {
  app: Express;
  db: Db;
  config: AppConfig;
  shopId: string;
  staffId: string;
  ownerAccessToken: string;
  ownerUserId: string;
  staffAccessToken: string;
  staffUserId: string;
}

function createAuthUser(
  db: Db,
  config: AppConfig,
  role: 'owner' | 'barber' | 'customer' | 'admin' = 'customer',
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

function buildApp(): Harness {
  const config = createTestConfig();
  const db = createTestDb();
  const app = createApp({ config, logger: createTestLogger(), db });

  const shopsRepo = new ShopsRepository(db);
  const staffRepo = new StaffRepository(db);
  const servicesRepo = new ServicesRepository(db);
  const bookingsRepo = new BookingsRepository(db);

  const owner = createAuthUser(db, config, 'owner');
  const barber = createAuthUser(db, config, 'barber');
  const customer = createAuthUser(db, config, 'customer');

  const shop = shopsRepo.createShop({
    ownerId: owner.userId,
    name: 'Metropolitan Barber Club',
    slug: 'metropolitan-barber-club',
    status: 'active',
  });

  const branch = shopsRepo.createBranch({
    shopId: shop.id,
    name: 'Midtown',
    addressLine1: '350 5th Ave',
    city: 'New York',
    postalCode: '10118',
    status: 'active',
  });

  const service = servicesRepo.createService({
    shopId: shop.id,
    name: 'Presidential Shave',
    slug: 'presidential-shave',
    durationMinutes: 45,
    priceCents: 6000,
  });

  const staff = staffRepo.createStaff({
    shopId: shop.id,
    userId: barber.userId,
    employeeCode: 'EMP-01',
    displayName: 'Vincent Barber',
    status: 'active',
    commissionBps: 3500, // 35% commission
  });

  staffRepo.setStaffServices(staff.id, [service.id]);

  // Create completed booking and payment
  const appointment = bookingsRepo.create(
    {
      shopId: shop.id,
      branchId: branch.id,
      customerId: customer.userId,
      staffId: staff.id,
      appointmentDate: '2026-10-15',
      startsAt: '2026-10-15T14:00:00.000Z',
      endsAt: '2026-10-15T14:45:00.000Z',
      durationMinutes: 45,
      totalPriceCents: 6000,
      currency: 'USD',
      status: 'completed',
    },
    [
      {
        serviceId: service.id,
        serviceName: 'Presidential Shave',
        durationMinutes: 45,
        priceCents: 6000,
        sortOrder: 0,
      },
    ],
  );

  const payId = newId('pay');
  db.run(
    `INSERT INTO payments (id, appointment_id, customer_id, shop_id, amount_cents, method, status, created_at)
     VALUES (?, ?, ?, ?, 6000, 'card', 'successful', '2026-10-15T14:50:00.000Z')`,
    [payId, appointment.id, customer.userId, shop.id],
  );

  return {
    app,
    db,
    config,
    shopId: shop.id,
    staffId: staff.id,
    ownerAccessToken: owner.accessToken,
    ownerUserId: owner.userId,
    staffAccessToken: barber.accessToken,
    staffUserId: barber.userId,
  };
}

describe('Analytics and Dashboard HTTP Routes (/api/v1/analytics)', () => {
  let harness: Harness;

  beforeEach(() => {
    harness = buildApp();
  });

  afterEach(() => {
    harness.db.close();
  });

  describe('Shop Overview Analytics', () => {
    it('returns revenue, booking, and customer overview to shop owner', async () => {
      const { app, shopId, ownerAccessToken } = harness;
      const res = await request(app)
        .get(`/api/v1/analytics/shop/${shopId}/overview`)
        .set('Authorization', `Bearer ${ownerAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.revenue.grossRevenueCents).toBe(6000);
      expect(res.body.data.revenue.netRevenueCents).toBe(6000);
      expect(res.body.data.revenue.successfulPaymentsCount).toBe(1);
      expect(res.body.data.bookings.totalAppointments).toBe(1);
      expect(res.body.data.bookings.completedCount).toBe(1);
      expect(res.body.data.customers.uniqueCustomersCount).toBe(1);
    });

    it('denies access to non-owner customer (403 Forbidden)', async () => {
      const { app, shopId, db, config } = harness;
      const customer = createAuthUser(db, config, 'customer');

      const res = await request(app)
        .get(`/api/v1/analytics/shop/${shopId}/overview`)
        .set('Authorization', `Bearer ${customer.accessToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('Staff and Service Breakdown', () => {
    it('returns staff performance and commission analytics', async () => {
      const { app, shopId, ownerAccessToken } = harness;
      const res = await request(app)
        .get(`/api/v1/analytics/shop/${shopId}/staff`)
        .set('Authorization', `Bearer ${ownerAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.staffPerformance).toHaveLength(1);
      expect(res.body.data.staffPerformance[0].displayName).toBe('Vincent Barber');
      expect(res.body.data.staffPerformance[0].completedAppointmentsCount).toBe(1);
      expect(res.body.data.staffPerformance[0].grossRevenueCents).toBe(6000);
      // 35% of 6000 = 2100 cents
      expect(res.body.data.staffPerformance[0].commissionEarnedCents).toBe(2100);
    });

    it('returns popular services ranking', async () => {
      const { app, shopId, ownerAccessToken } = harness;
      const res = await request(app)
        .get(`/api/v1/analytics/shop/${shopId}/services`)
        .set('Authorization', `Bearer ${ownerAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.services).toHaveLength(1);
      expect(res.body.data.services[0].serviceName).toBe('Presidential Shave');
      expect(res.body.data.services[0].bookingsCount).toBe(1);
      expect(res.body.data.services[0].grossRevenueCents).toBe(6000);
    });
  });

  describe('Staff Earnings & Commission', () => {
    it('allows staff member to view their individual earnings and recent bookings', async () => {
      const { app, staffId, staffAccessToken } = harness;
      const res = await request(app)
        .get(`/api/v1/analytics/staff/${staffId}/earnings`)
        .set('Authorization', `Bearer ${staffAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.earnings.displayName).toBe('Vincent Barber');
      expect(res.body.data.earnings.commissionRatePercent).toBe(35);
      expect(res.body.data.earnings.grossRevenueCents).toBe(6000);
      expect(res.body.data.earnings.commissionEarnedCents).toBe(2100);
      expect(res.body.data.earnings.recentBookings).toHaveLength(1);
      expect(res.body.data.earnings.recentBookings[0].commissionCents).toBe(2100);
    });

    it('allows shop owner to view their staff member earnings', async () => {
      const { app, staffId, ownerAccessToken } = harness;
      const res = await request(app)
        .get(`/api/v1/analytics/staff/${staffId}/earnings`)
        .set('Authorization', `Bearer ${ownerAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.earnings.displayName).toBe('Vincent Barber');
    });
  });
});
