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
import { LoyaltyRepository } from '../../db/repositories/loyalty';
import { NotificationsRepository } from '../../db/repositories/notifications';
import { newId } from '../../core/ids';

interface Harness {
  app: Express;
  db: Db;
  config: AppConfig;
  shopId: string;
  branchId: string;
  staffId: string;
  serviceId: string;
  ownerAccessToken: string;
  ownerUserId: string;
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
    ownerAccessToken: owner.accessToken,
    ownerUserId: owner.userId,
  };
}

describe('Growth HTTP Routes (/api/v1)', () => {
  let harness: Harness;

  beforeEach(() => {
    harness = buildApp();
  });

  afterEach(() => {
    harness.db.close();
  });

  function createCompletedAppointment(customerId: string): string {
    const bookingsRepo = new BookingsRepository(harness.db);
    const appointment = bookingsRepo.create(
      {
        shopId: harness.shopId,
        branchId: harness.branchId,
        customerId,
        staffId: harness.staffId,
        appointmentDate: '2026-10-19',
        startsAt: '2026-10-19T09:00:00.000Z',
        endsAt: '2026-10-19T09:30:00.000Z',
        durationMinutes: 30,
        totalPriceCents: 3500,
        currency: 'USD',
        status: 'completed',
      },
      [
        {
          serviceId: harness.serviceId,
          serviceName: 'Precision Fade',
          durationMinutes: 30,
          priceCents: 3500,
          sortOrder: 0,
        },
      ],
    );
    return appointment.id;
  }

  describe('Coupons and Promotions', () => {
    it('allows owner to create a coupon and customer to validate it', async () => {
      const { app, db, config, shopId } = harness;
      const owner = createAuthUser(db, config, 'owner');
      const customer = createAuthUser(db, config, 'customer');

      // 1. Owner creates coupon
      const createRes = await request(app)
        .post('/api/v1/coupons')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({
          shopId,
          code: 'FALL2026',
          discountType: 'percentage',
          discountValue: 2000, // 20%
          minOrderCents: 2000,
          startsAt: '2026-01-01T00:00:00.000Z',
          expiresAt: '2026-12-31T23:59:59.000Z',
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.data.coupon.code).toBe('FALL2026');

      // 2. Customer lists coupons
      const listRes = await request(app)
        .get(`/api/v1/coupons?shopId=${shopId}`)
        .set('Authorization', `Bearer ${customer.accessToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.coupons.length).toBeGreaterThan(0);

      // 3. Customer validates coupon on $35.00 order
      const valRes = await request(app)
        .post('/api/v1/coupons/validate')
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .send({
          code: 'FALL2026',
          subtotalCents: 3500,
          shopId,
        });

      expect(valRes.status).toBe(200);
      expect(valRes.body.data.valid).toBe(true);
      expect(valRes.body.data.discountCents).toBe(700); // 20% of 3500
    });
  });

  describe('Loyalty System', () => {
    it('returns user loyalty profile and transaction history', async () => {
      const { app, db, config } = harness;
      const customer = createAuthUser(db, config, 'customer');

      const loyaltyRepo = new LoyaltyRepository(db);
      loyaltyRepo.creditPoints(customer.userId, 1500, 'promotional', null, 'Welcome points');

      const res = await request(app)
        .get('/api/v1/loyalty')
        .set('Authorization', `Bearer ${customer.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.loyalty.pointsBalance).toBe(1500);
      expect(res.body.data.loyalty.tier).toBe('bronze');

      const historyRes = await request(app)
        .get('/api/v1/loyalty/history')
        .set('Authorization', `Bearer ${customer.accessToken}`);

      expect(historyRes.status).toBe(200);
      expect(historyRes.body.data.transactions).toHaveLength(1);
      expect(historyRes.body.data.transactions[0].points).toBe(1500);
    });
  });

  describe('Reviews and Ratings', () => {
    it('submits a review, fetches stats, and allows owner reply', async () => {
      const { app, db, config, shopId, ownerAccessToken } = harness;
      const customer = createAuthUser(db, config, 'customer');

      const aptId = createCompletedAppointment(customer.userId);

      // Customer posts review
      const revRes = await request(app)
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .send({
          appointmentId: aptId,
          rating: 5,
          staffRating: 5,
          title: 'Masterclass cut',
          comment: 'Best haircut I have received this year!',
        });

      expect(revRes.status).toBe(201);
      const reviewId = revRes.body.data.review.id;

      // Public fetches shop reviews & stats
      const getRes = await request(app).get(`/api/v1/reviews/shop/${shopId}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.reviews).toHaveLength(1);
      expect(getRes.body.data.stats.totalReviews).toBe(1);
      expect(getRes.body.data.stats.averageRating).toBe(5);

      // Owner replies to review
      const replyRes = await request(app)
        .post(`/api/v1/reviews/${reviewId}/reply`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({ reply: 'Thank you for your business!' });

      expect(replyRes.status).toBe(200);
      expect(replyRes.body.data.review.ownerReply).toBe('Thank you for your business!');
    });
  });

  describe('Customer Favorites', () => {
    it('adds, lists, and deletes favorites', async () => {
      const { app, db, config, shopId } = harness;
      const customer = createAuthUser(db, config, 'customer');

      // Add favorite
      const addRes = await request(app)
        .post('/api/v1/favorites')
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .send({ targetType: 'shop', targetId: shopId });

      expect(addRes.status).toBe(201);
      expect(addRes.body.data.favorite.targetId).toBe(shopId);

      // List favorites
      const listRes = await request(app)
        .get('/api/v1/favorites')
        .set('Authorization', `Bearer ${customer.accessToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.favorites).toHaveLength(1);

      // Remove favorite
      const delRes = await request(app)
        .delete(`/api/v1/favorites/shop/${shopId}`)
        .set('Authorization', `Bearer ${customer.accessToken}`);

      expect(delRes.status).toBe(204);
    });
  });

  describe('Notifications and Preferences', () => {
    it('manages notifications read status and channels preferences', async () => {
      const { app, db, config } = harness;
      const customer = createAuthUser(db, config, 'customer');

      const notifsRepo = new NotificationsRepository(db);
      const ntf = notifsRepo.create({
        userId: customer.userId,
        type: 'booking_confirmed',
        title: 'Booking Confirmed',
        message: 'Your slot is locked in.',
      });

      // List notifications
      const listRes = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${customer.accessToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.unreadCount).toBe(1);

      // Mark as read
      const readRes = await request(app)
        .post(`/api/v1/notifications/${ntf.id}/read`)
        .set('Authorization', `Bearer ${customer.accessToken}`);

      expect(readRes.status).toBe(200);

      // Get preferences
      const prefRes = await request(app)
        .get('/api/v1/notifications/preferences')
        .set('Authorization', `Bearer ${customer.accessToken}`);

      expect(prefRes.status).toBe(200);
      expect(prefRes.body.data.preferences.emailBookingUpdates).toBe(true);

      // Patch preferences
      const patchRes = await request(app)
        .patch('/api/v1/notifications/preferences')
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .send({ emailPromotions: true, pushReminders: false });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.preferences.emailPromotions).toBe(true);
      expect(patchRes.body.data.preferences.pushReminders).toBe(false);
    });
  });
});
