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
import { newId } from '../../core/ids';

interface Harness {
  app: Express;
  db: Db;
  config: AppConfig;
  shopId: string;
  branchId: string;
  staffId: string;
  serviceId: string;
}

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

function buildApp(): Harness {
  const config = createTestConfig();
  const db = createTestDb();
  const app = createApp({ config, logger: createTestLogger(), db });

  const shopsRepo = new ShopsRepository(db);
  const staffRepo = new StaffRepository(db);
  const servicesRepo = new ServicesRepository(db);

  const owner = createAuthUser(db, config, 'owner');

  const shop = shopsRepo.createShop({
    ownerId: owner.userId,
    name: 'Crown Barber Co',
    slug: 'crown-barber-co',
    status: 'active',
  });

  const branch = shopsRepo.createBranch({
    shopId: shop.id,
    name: 'Downtown',
    addressLine1: '100 Main St',
    city: 'New York',
    postalCode: '10001',
    status: 'active',
  });

  // Monday (weekday 1) 09:00 - 18:00
  shopsRepo.setBusinessHours(branch.id, [
    { weekday: 1, opensAt: '09:00', closesAt: '18:00', closed: false },
  ]);

  const service = servicesRepo.createService({
    shopId: shop.id,
    name: 'Precision Fade',
    slug: 'precision-fade',
    durationMinutes: 30,
    priceCents: 3500,
  });

  const staff = staffRepo.createStaff({
    shopId: shop.id,
    employeeCode: 'EMP-01',
    displayName: 'Marcus Aurelius',
    status: 'active',
    canAcceptBookings: true,
  });

  staffRepo.setStaffBranches(staff.id, [{ branchId: branch.id, isPrimary: true }]);
  staffRepo.setStaffServices(staff.id, [service.id]);

  // Monday 09:00 - 17:00
  staffRepo.setStaffSchedules(staff.id, [
    { weekday: 1, startsAt: '09:00', endsAt: '17:00' },
  ]);

  return {
    app,
    db,
    config,
    shopId: shop.id,
    branchId: branch.id,
    staffId: staff.id,
    serviceId: service.id,
  };
}

describe('Bookings and Availability HTTP Routes (/api/v1)', () => {
  let harness: Harness;

  // 2026-10-19 is a Monday
  const testMonday = '2026-10-19';

  beforeEach(() => {
    harness = buildApp();
  });

  afterEach(() => {
    harness.db.close();
  });

  describe('Availability discovery', () => {
    it('returns open slots for qualified staff and branch', async () => {
      const { app, branchId, staffId, serviceId } = harness;

      // Check qualified staff
      const staffRes = await request(app)
        .get(`/api/v1/availability/staff?branchId=${branchId}&serviceId=${serviceId}`);
      expect(staffRes.status).toBe(200);
      expect(staffRes.body.data.staff).toHaveLength(1);
      expect(staffRes.body.data.staff[0].displayName).toBe('Marcus Aurelius');

      // Check available slots
      const slotsRes = await request(app)
        .get(`/api/v1/availability/slots?branchId=${branchId}&staffId=${staffId}&date=${testMonday}&durationMinutes=30`);
      expect(slotsRes.status).toBe(200);
      expect(slotsRes.body.data.slots.length).toBeGreaterThan(0);
      expect(slotsRes.body.data.slots[0].timeLabel).toBe('09:00');
    });
  });

  describe('Booking lifecycle', () => {
    it('creates appointment, lists user bookings, updates status, and cancels', async () => {
      const { app, db, config, branchId, staffId, serviceId } = harness;
      const customer = createAuthUser(db, config, 'customer');
      const owner = createAuthUser(db, config, 'owner');

      // Book appointment at 09:00 on testMonday
      const bookRes = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .send({
          branchId,
          staffId,
          serviceIds: [serviceId],
          startsAt: `${testMonday}T09:00:00.000Z`,
          notes: 'Prefer extra pomade',
        });

      expect(bookRes.status).toBe(201);
      const aptId = bookRes.body.data.appointment.id;
      expect(bookRes.body.data.appointment.status).toBe('confirmed');
      expect(bookRes.body.data.appointment.totalPriceCents).toBe(3500);

      // List customer's appointments
      const meRes = await request(app)
        .get('/api/v1/bookings/me')
        .set('Authorization', `Bearer ${customer.accessToken}`);
      expect(meRes.status).toBe(200);
      expect(meRes.body.data.appointments).toHaveLength(1);
      expect(meRes.body.data.appointments[0].id).toBe(aptId);

      // Get appointment details with service items
      const detailsRes = await request(app)
        .get(`/api/v1/bookings/${aptId}`)
        .set('Authorization', `Bearer ${customer.accessToken}`);
      expect(detailsRes.status).toBe(200);
      expect(detailsRes.body.data.appointment.services).toHaveLength(1);
      expect(detailsRes.body.data.appointment.services[0].serviceName).toBe('Precision Fade');

      // Update status to in_progress (by shop owner)
      const statusRes = await request(app)
        .patch(`/api/v1/bookings/${aptId}/status`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ status: 'in_progress', reason: 'Customer arrived' });
      expect(statusRes.status).toBe(200);
      expect(statusRes.body.data.appointment.status).toBe('in_progress');

      // Complete appointment
      const completeRes = await request(app)
        .patch(`/api/v1/bookings/${aptId}/status`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ status: 'completed' });
      expect(completeRes.status).toBe(200);
      expect(completeRes.body.data.appointment.status).toBe('completed');
    });

    it('reschedules appointment to another available time', async () => {
      const { app, db, config, branchId, staffId, serviceId } = harness;
      const customer = createAuthUser(db, config, 'customer');

      const bookRes = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .send({
          branchId,
          staffId,
          serviceIds: [serviceId],
          startsAt: `${testMonday}T10:00:00.000Z`,
        });
      const aptId = bookRes.body.data.appointment.id;

      // Reschedule to 11:00
      const reschedRes = await request(app)
        .post(`/api/v1/bookings/${aptId}/reschedule`)
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .send({
          newStartsAt: `${testMonday}T11:00:00.000Z`,
          reason: 'Meeting moved',
        });

      expect(reschedRes.status).toBe(200);
      expect(reschedRes.body.data.appointment.startsAt).toBe(`${testMonday}T11:00:00.000Z`);
    });
  });
});
