import { newId } from '../core/ids';
import { createTestDb } from '../test-support/db';
import type { Db } from './sqlite';

describe('payments schema (migration 005)', () => {
  let db: Db;
  let shopId: string;
  let customerId: string;

  beforeEach(() => {
    db = createTestDb();

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
      `INSERT INTO shops (id, owner_id, name, slug) VALUES (?, ?, 'Shelby Cuts', 'shelby-cuts')`,
      [shopId, ownerId],
    );
  });

  afterEach(() => db.close());

  it('inserts and enforces invoice constraints and unique invoice numbers', () => {
    const invId = newId('inv');
    db.run(
      `INSERT INTO invoices (id, customer_id, shop_id, invoice_number, subtotal_cents, tax_cents, discount_cents, total_cents)
       VALUES (?, ?, ?, 'INV-2026-0001', 3000, 300, 500, 2800)`,
      [invId, customerId, shopId],
    );

    // Duplicate invoice_number
    expect(() =>
      db.run(
        `INSERT INTO invoices (id, customer_id, shop_id, invoice_number, subtotal_cents, total_cents)
         VALUES (?, ?, ?, 'INV-2026-0001', 3000, 3000)`,
        [newId('inv'), customerId, shopId],
      ),
    ).toThrow(/UNIQUE constraint failed/i);
  });

  it('enforces payment methods and idempotency key uniqueness', () => {
    const payId = newId('pay');
    db.run(
      `INSERT INTO payments (id, customer_id, shop_id, amount_cents, method, status, idempotency_key)
       VALUES (?, ?, ?, 3500, 'card', 'successful', 'idem_12345')`,
      [payId, customerId, shopId],
    );

    // Duplicate idempotency_key
    expect(() =>
      db.run(
        `INSERT INTO payments (id, customer_id, shop_id, amount_cents, method, status, idempotency_key)
         VALUES (?, ?, ?, 3500, 'card', 'successful', 'idem_12345')`,
        [newId('pay'), customerId, shopId],
      ),
    ).toThrow(/UNIQUE constraint failed/i);

    // Invalid payment method
    expect(() =>
      db.run(
        `INSERT INTO payments (id, customer_id, shop_id, amount_cents, method)
         VALUES (?, ?, ?, 3500, 'bitcoin')`,
        [newId('pay'), customerId, shopId],
      ),
    ).toThrow(/CHECK constraint failed/i);
  });

  it('enforces non-negative wallet balance and records transactions', () => {
    const walId = newId('wal');
    db.run(
      `INSERT INTO wallets (id, user_id, balance_cents) VALUES (?, ?, 5000)`,
      [walId, customerId],
    );

    // Record topup transaction
    db.run(
      `INSERT INTO wallet_transactions (id, wallet_id, type, amount_cents, balance_after_cents, description)
       VALUES (?, ?, 'topup', 5000, 5000, 'Card topup')`,
      [newId('txn'), walId],
    );

    // Wallet balance cannot be negative
    expect(() =>
      db.run(`UPDATE wallets SET balance_cents = -100 WHERE id = ?`, [walId]),
    ).toThrow(/CHECK constraint failed/i);

    // Transaction balance_after_cents cannot be negative
    expect(() =>
      db.run(
        `INSERT INTO wallet_transactions (id, wallet_id, type, amount_cents, balance_after_cents)
         VALUES (?, ?, 'payment', -6000, -1000)`,
        [newId('txn'), walId],
      ),
    ).toThrow(/CHECK constraint failed/i);
  });
});
