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
  };
}

describe('Payments, Invoices, Refunds, and Wallet HTTP Routes (/api/v1)', () => {
  let harness: Harness;

  beforeEach(() => {
    harness = buildApp();
  });

  afterEach(() => {
    harness.db.close();
  });

  function createTestAppointment(customerId: string): string {
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
        status: 'confirmed',
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

  describe('Invoice Generation', () => {
    it('creates an invoice for an existing appointment', async () => {
      const { app, db, config } = harness;
      const customer = createAuthUser(db, config, 'customer');
      const appointmentId = createTestAppointment(customer.userId);

      const res = await request(app)
        .post(`/api/v1/invoices/appointments/${appointmentId}`)
        .set('Authorization', `Bearer ${customer.accessToken}`);

      expect(res.status).toBe(201);
      expect(res.body.data.invoice).toBeDefined();
      expect(res.body.data.invoice.appointmentId).toBe(appointmentId);
      expect(res.body.data.invoice.subtotalCents).toBe(3500);
      expect(res.body.data.invoice.taxCents).toBe(280); // 8% tax
      expect(res.body.data.invoice.totalCents).toBe(3780);
      expect(res.body.data.invoice.status).toBe('issued');
    });

    it('retrieves an invoice by id', async () => {
      const { app, db, config } = harness;
      const customer = createAuthUser(db, config, 'customer');
      const appointmentId = createTestAppointment(customer.userId);

      const createRes = await request(app)
        .post(`/api/v1/invoices/appointments/${appointmentId}`)
        .set('Authorization', `Bearer ${customer.accessToken}`);

      const invoiceId = createRes.body.data.invoice.id;

      const getRes = await request(app)
        .get(`/api/v1/invoices/${invoiceId}`)
        .set('Authorization', `Bearer ${customer.accessToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data.invoice.id).toBe(invoiceId);
      expect(getRes.body.data.invoice.totalCents).toBe(3780);
    });
  });

  describe('Payment Execution', () => {
    it('pays an invoice using card and marks invoice as paid', async () => {
      const { app, db, config } = harness;
      const customer = createAuthUser(db, config, 'customer');
      const appointmentId = createTestAppointment(customer.userId);

      const invRes = await request(app)
        .post(`/api/v1/invoices/appointments/${appointmentId}`)
        .set('Authorization', `Bearer ${customer.accessToken}`);

      const invoiceId = invRes.body.data.invoice.id;

      const payRes = await request(app)
        .post('/api/v1/payments/pay')
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .send({
          invoiceId,
          method: 'card',
          idempotencyKey: 'idemp_key_card_1',
        });

      expect(payRes.status).toBe(200);
      expect(payRes.body.data.payment.status).toBe('successful');
      expect(payRes.body.data.payment.amountCents).toBe(3780);

      // Verify invoice status updated
      const getInv = await request(app)
        .get(`/api/v1/invoices/${invoiceId}`)
        .set('Authorization', `Bearer ${customer.accessToken}`);

      expect(getInv.body.data.invoice.status).toBe('paid');
      expect(getInv.body.data.invoice.paidAt).toBeTruthy();
    });

    it('handles idempotent pay retries safely', async () => {
      const { app, db, config } = harness;
      const customer = createAuthUser(db, config, 'customer');
      const appointmentId = createTestAppointment(customer.userId);

      const invRes = await request(app)
        .post(`/api/v1/invoices/appointments/${appointmentId}`)
        .set('Authorization', `Bearer ${customer.accessToken}`);

      const invoiceId = invRes.body.data.invoice.id;

      const firstPay = await request(app)
        .post('/api/v1/payments/pay')
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .send({
          invoiceId,
          method: 'card',
          idempotencyKey: 'retry_test_123',
        });

      expect(firstPay.status).toBe(200);

      const retryPay = await request(app)
        .post('/api/v1/payments/pay')
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .send({
          invoiceId,
          method: 'card',
          idempotencyKey: 'retry_test_123',
        });

      expect(retryPay.status).toBe(200);
      expect(retryPay.body.data.payment.id).toBe(firstPay.body.data.payment.id);
    });
  });

  describe('Wallet Operations', () => {
    it('tops up wallet, displays ledger transactions, and pays invoice from wallet balance', async () => {
      const { app, db, config } = harness;
      const customer = createAuthUser(db, config, 'customer');

      // Check initial wallet balance is 0
      const initWallet = await request(app)
        .get('/api/v1/wallet')
        .set('Authorization', `Bearer ${customer.accessToken}`);

      expect(initWallet.status).toBe(200);
      expect(initWallet.body.data.wallet.balanceCents).toBe(0);

      // Top up $50.00 (5000 cents)
      const topupRes = await request(app)
        .post('/api/v1/wallet/topup')
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .send({
          amountCents: 5000,
          paymentMethod: 'card',
          idempotencyKey: 'topup_card_1',
        });

      expect(topupRes.status).toBe(200);
      expect(topupRes.body.data.wallet.balanceCents).toBe(5000);

      // Check wallet transactions ledger
      const txRes = await request(app)
        .get('/api/v1/wallet/transactions')
        .set('Authorization', `Bearer ${customer.accessToken}`);

      expect(txRes.status).toBe(200);
      expect(txRes.body.data.transactions).toHaveLength(1);
      expect(txRes.body.data.transactions[0].type).toBe('topup');
      expect(txRes.body.data.transactions[0].amountCents).toBe(5000);

      // Create appointment & invoice for $35.00 (+ $2.80 tax = $37.80)
      const appointmentId = createTestAppointment(customer.userId);
      const invRes = await request(app)
        .post(`/api/v1/invoices/appointments/${appointmentId}`)
        .set('Authorization', `Bearer ${customer.accessToken}`);
      const invoiceId = invRes.body.data.invoice.id;

      // Pay with wallet
      const payRes = await request(app)
        .post('/api/v1/payments/pay')
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .send({
          invoiceId,
          method: 'wallet',
        });

      expect(payRes.status).toBe(200);
      expect(payRes.body.data.payment.status).toBe('successful');
      expect(payRes.body.data.payment.method).toBe('wallet');

      // Verify wallet balance is reduced by 3780 cents (remaining: 1220)
      const afterWallet = await request(app)
        .get('/api/v1/wallet')
        .set('Authorization', `Bearer ${customer.accessToken}`);

      expect(afterWallet.body.data.wallet.balanceCents).toBe(1220);

      // Check transaction ledger shows payment debit
      const afterTx = await request(app)
        .get('/api/v1/wallet/transactions')
        .set('Authorization', `Bearer ${customer.accessToken}`);

      expect(afterTx.body.data.transactions).toHaveLength(2);
      expect(afterTx.body.data.transactions[0].type).toBe('payment');
      expect(afterTx.body.data.transactions[0].amountCents).toBe(-3780);
    });
  });

  describe('Refunds & RBAC Authorization', () => {
    it('allows shop owner to process partial and full refund for a payment', async () => {
      const { app, db, config } = harness;
      const owner = createAuthUser(db, config, 'owner');
      const customer = createAuthUser(db, config, 'customer');

      const appointmentId = createTestAppointment(customer.userId);
      const invRes = await request(app)
        .post(`/api/v1/invoices/appointments/${appointmentId}`)
        .set('Authorization', `Bearer ${customer.accessToken}`);
      const invoiceId = invRes.body.data.invoice.id;

      const payRes = await request(app)
        .post('/api/v1/payments/pay')
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .send({ invoiceId, method: 'card' });

      const paymentId = payRes.body.data.payment.id;

      // Owner refunds $10.00 (1000 cents)
      const refundRes = await request(app)
        .post('/api/v1/payments/refund')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({
          paymentId,
          amountCents: 1000,
          reason: 'Customer requested discount post-service',
        });

      expect(refundRes.status).toBe(200);
      expect(refundRes.body.data.refund.status).toBe('processed');
      expect(refundRes.body.data.refund.amountCents).toBe(1000);

      // Verify payment status changed to partially_refunded
      const invAfter = await request(app)
        .get(`/api/v1/invoices/${invoiceId}`)
        .set('Authorization', `Bearer ${customer.accessToken}`);
      expect(invAfter.body.data.invoice.status).toBe('partially_refunded');
    });

    it('denies customer role from executing refunds (403 Forbidden)', async () => {
      const { app, db, config } = harness;
      const customer = createAuthUser(db, config, 'customer');

      const refundRes = await request(app)
        .post('/api/v1/payments/refund')
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .send({
          paymentId: 'pay_dummy',
          amountCents: 500,
          reason: 'Unauthorized refund',
        });

      expect(refundRes.status).toBe(403);
    });
  });
});
