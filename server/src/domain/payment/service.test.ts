import { newId } from '../../core/ids';
import { createTestDb, createTestLogger } from '../../test-support/db';
import type { Db } from '../../db/sqlite';
import { ShopsRepository } from '../../db/repositories/shops';
import { BookingsRepository } from '../../db/repositories/bookings';
import { PaymentService, type Actor } from './service';

describe('PaymentService', () => {
  let db: Db;
  let service: PaymentService;
  let shopsRepo: ShopsRepository;
  let bookingsRepo: BookingsRepository;

  let shopId: string;
  let branchId: string;
  let staffId: string;
  let customerId: string;
  let ownerActor: Actor;
  let customerActor: Actor;

  beforeEach(() => {
    db = createTestDb();
    service = new PaymentService({ db, logger: createTestLogger() });
    shopsRepo = new ShopsRepository(db);
    bookingsRepo = new BookingsRepository(db);

    const ownerId = newId('usr');
    db.run(
      `INSERT INTO users (id, email, email_normalised, password_hash, password_updated_at,
                          first_name, last_name, display_name, role)
       VALUES (?, 'owner@shop.com', 'owner@shop.com', 'h', '2026-10-07T00:00:00.000Z',
               'Arthur', 'Shelby', 'Arthur Shelby', 'owner')`,
      [ownerId],
    );
    ownerActor = { userId: ownerId, role: 'owner' };

    customerId = newId('usr');
    db.run(
      `INSERT INTO users (id, email, email_normalised, password_hash, password_updated_at,
                          first_name, last_name, display_name, role)
       VALUES (?, 'cust@gmail.com', 'cust@gmail.com', 'h', '2026-10-07T00:00:00.000Z',
               'Tommy', 'Shelby', 'Tommy Shelby', 'customer')`,
      [customerId],
    );
    customerActor = { userId: customerId, role: 'customer' };

    const shop = shopsRepo.createShop({
      ownerId,
      name: 'Peaky Groomers',
      slug: 'peaky-groomers',
      status: 'active',
    });
    shopId = shop.id;

    const branch = shopsRepo.createBranch({
      shopId,
      name: 'Main',
      addressLine1: '1 Garrison St',
      city: 'Birmingham',
      postalCode: 'B9 4NY',
    });
    branchId = branch.id;

    staffId = newId('staff');
    db.run(
      `INSERT INTO staff (id, shop_id, employee_code, display_name) VALUES (?, ?, 'EMP-1', 'Finn')`,
      [staffId, shopId],
    );
  });

  afterEach(() => db.close());

  function createTestAppointment(priceCents = 5000): string {
    const apt = bookingsRepo.create(
      {
        shopId,
        branchId,
        customerId,
        staffId,
        appointmentDate: '2026-10-25',
        startsAt: '2026-10-25T10:00:00.000Z',
        endsAt: '2026-10-25T10:45:00.000Z',
        durationMinutes: 45,
        totalPriceCents: priceCents,
      },
      [],
    );
    return apt.id;
  }

  describe('invoices and card payments', () => {
    it('generates invoice with 8% tax and processes card payment', async () => {
      const aptId = createTestAppointment(5000);
      const invoice = service.createInvoiceForAppointment(customerActor, aptId);

      expect(invoice.subtotalCents).toBe(5000);
      expect(invoice.taxCents).toBe(400); // 8% of 5000
      expect(invoice.totalCents).toBe(5400);
      expect(invoice.status).toBe('issued');

      const payment = await service.payInvoice(customerActor, {
        invoiceId: invoice.id,
        method: 'card',
        idempotencyKey: 'idem_charge_001',
      });

      expect(payment.status).toBe('successful');
      expect(payment.amountCents).toBe(5400);
      expect(payment.providerTxId).toMatch(/^mock_tx_/);

      const updatedInvoice = service.getInvoice(customerActor, invoice.id);
      expect(updatedInvoice.status).toBe('paid');
      expect(updatedInvoice.paidAt).not.toBeNull();
    });

    it('enforces idempotency on duplicate charge requests', async () => {
      const aptId = createTestAppointment(3000);
      const invoice = service.createInvoiceForAppointment(customerActor, aptId);

      const pay1 = await service.payInvoice(customerActor, {
        invoiceId: invoice.id,
        method: 'card',
        idempotencyKey: 'idem_duplicate_key',
      });

      // Second identical request returns existing payment record
      const pay2 = await service.payInvoice(customerActor, {
        invoiceId: invoice.id,
        method: 'card',
        idempotencyKey: 'idem_duplicate_key',
      });

      expect(pay2.id).toBe(pay1.id);
    });
  });

  describe('wallet payments and topups', () => {
    it('tops up wallet and pays invoice from wallet balance', async () => {
      // Topup wallet with $100.00 (10000 cents)
      const { wallet } = await service.topupWallet(customerActor, 10000, 'card');
      expect(wallet.balanceCents).toBe(10000);

      const aptId = createTestAppointment(4000); // total with 8% tax = 4320 cents
      const invoice = service.createInvoiceForAppointment(customerActor, aptId);

      const payment = await service.payInvoice(customerActor, {
        invoiceId: invoice.id,
        method: 'wallet',
      });

      expect(payment.status).toBe('successful');
      expect(payment.method).toBe('wallet');

      const updatedWallet = service.getWallet(customerId);
      expect(updatedWallet.balanceCents).toBe(10000 - 4320);

      const txs = service.getWalletTransactions(customerId);
      expect(txs).toHaveLength(2); // topup + payment
    });

    it('rejects wallet payment when balance is insufficient', async () => {
      const aptId = createTestAppointment(5000);
      const invoice = service.createInvoiceForAppointment(customerActor, aptId);

      await expect(
        service.payInvoice(customerActor, {
          invoiceId: invoice.id,
          method: 'wallet',
        }),
      ).rejects.toThrow(/insufficient/i);
    });
  });

  describe('refunds workflow', () => {
    it('processes partial and full refunds with status progression', async () => {
      const aptId = createTestAppointment(5000);
      const invoice = service.createInvoiceForAppointment(customerActor, aptId);

      const payment = await service.payInvoice(customerActor, {
        invoiceId: invoice.id,
        method: 'card',
      });

      // Partial refund: $20.00 (2000 cents) of $54.00
      const refund1 = await service.processRefund(ownerActor, {
        paymentId: payment.id,
        amountCents: 2000,
        reason: 'Courtesy credit',
      });

      expect(refund1.status).toBe('processed');
      const invAfterPartial = service.getInvoice(ownerActor, invoice.id);
      expect(invAfterPartial.status).toBe('partially_refunded');

      // Remaining refund: $34.00 (3400 cents)
      const refund2 = await service.processRefund(ownerActor, {
        paymentId: payment.id,
        amountCents: 3400,
        reason: 'Remaining balance refund',
      });

      expect(refund2.status).toBe('processed');
      const invAfterFull = service.getInvoice(ownerActor, invoice.id);
      expect(invAfterFull.status).toBe('refunded');

      // Attempting further refund should be rejected
      await expect(
        service.processRefund(ownerActor, {
          paymentId: payment.id,
          amountCents: 500,
          reason: 'Excess refund',
        }),
      ).rejects.toThrow(/Cannot refund payment with status 'refunded'|exceeds remaining refundable balance/i);
    });
  });
});
