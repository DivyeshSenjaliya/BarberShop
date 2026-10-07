import { newId } from '../../core/ids';
import { createTestDb } from '../../test-support/db';
import type { Db } from '../sqlite';
import { PaymentsRepository } from './payments';

describe('PaymentsRepository', () => {
  let db: Db;
  let repo: PaymentsRepository;
  let shopId: string;
  let customerId: string;

  beforeEach(() => {
    db = createTestDb();
    repo = new PaymentsRepository(db);

    const ownerId = newId('usr');
    db.run(
      `INSERT INTO users (id, email, email_normalised, password_hash, password_updated_at,
                          first_name, last_name, display_name, role)
       VALUES (?, 'owner@shop.com', 'owner@shop.com', 'h', '2026-10-07T00:00:00.000Z',
               'Arthur', 'Shelby', 'Arthur Shelby', 'owner')`,
      [ownerId],
    );

    customerId = newId('usr');
    db.run(
      `INSERT INTO users (id, email, email_normalised, password_hash, password_updated_at,
                          first_name, last_name, display_name, role)
       VALUES (?, 'cust@gmail.com', 'cust@gmail.com', 'h', '2026-10-07T00:00:00.000Z',
               'Tommy', 'Shelby', 'Tommy Shelby', 'customer')`,
      [customerId],
    );

    shopId = newId('shop');
    db.run(
      `INSERT INTO shops (id, owner_id, name, slug) VALUES (?, ?, 'Garrison Cuts', 'garrison-cuts')`,
      [shopId, ownerId],
    );
  });

  afterEach(() => db.close());

  describe('invoices', () => {
    it('creates, retrieves, and updates invoice status', () => {
      const invoice = repo.createInvoice({
        customerId,
        shopId,
        subtotalCents: 4000,
        taxCents: 400,
        discountCents: 500,
        totalCents: 3900,
      });

      expect(invoice.id).toMatch(/^inv_/);
      expect(invoice.invoiceNumber).toMatch(/^INV-/);
      expect(invoice.status).toBe('issued');
      expect(invoice.totalCents).toBe(3900);

      const byNumber = repo.findInvoiceByNumber(invoice.invoiceNumber);
      expect(byNumber).toEqual(invoice);

      const paid = repo.updateInvoiceStatus(invoice.id, 'paid');
      expect(paid.status).toBe('paid');
      expect(paid.paidAt).not.toBeNull();
    });
  });

  describe('payments and refunds', () => {
    it('creates payments, tracks idempotency, and updates status', () => {
      const payment = repo.createPayment({
        customerId,
        shopId,
        amountCents: 3500,
        method: 'card',
        provider: 'stripe_mock',
        idempotencyKey: 'idem_key_999',
      });

      expect(payment.id).toMatch(/^pay_/);
      expect(payment.status).toBe('pending');

      const byIdem = repo.findByIdempotencyKey('idem_key_999');
      expect(byIdem).toEqual(payment);

      const successful = repo.updatePaymentStatus(payment.id, 'successful', 'tx_stripe_123');
      expect(successful.status).toBe('successful');
      expect(successful.providerTxId).toBe('tx_stripe_123');
    });

    it('creates and updates refunds for a payment', () => {
      const payment = repo.createPayment({
        customerId,
        shopId,
        amountCents: 5000,
        method: 'card',
        status: 'successful',
      });

      const refund = repo.createRefund({
        paymentId: payment.id,
        amountCents: 2500,
        reason: 'Customer was charged for unperformed service',
        requestedBy: customerId,
      });

      expect(refund.id).toMatch(/^rfnd_/);
      expect(refund.status).toBe('pending');
      expect(refund.amountCents).toBe(2500);

      const processed = repo.updateRefundStatus(refund.id, 'processed', customerId);
      expect(processed.status).toBe('processed');
      expect(processed.processedAt).not.toBeNull();

      const list = repo.listRefundsForPayment(payment.id);
      expect(list).toHaveLength(1);
    });
  });
});
