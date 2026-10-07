import { newId } from '../core/ids';
import { createTestDb } from '../test-support/db';
import type { Db } from './sqlite';

describe('growth schema (migration 006)', () => {
  let db: Db;
  let shopId: string;
  let customerId: string;
  let ownerId: string;

  beforeEach(() => {
    db = createTestDb();

    ownerId = newId('usr');
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

  it('enforces coupon codes uniqueness and discount types', () => {
    const couponId = newId('coup');
    db.run(
      `INSERT INTO coupons (id, shop_id, code, discount_type, discount_value, starts_at, expires_at)
       VALUES (?, ?, 'SUMMER20', 'percentage', 2000, '2026-06-01T00:00:00.000Z', '2026-08-31T23:59:59.000Z')`,
      [couponId, shopId],
    );

    // Duplicate code
    expect(() =>
      db.run(
        `INSERT INTO coupons (id, shop_id, code, discount_type, discount_value, starts_at, expires_at)
         VALUES (?, ?, 'SUMMER20', 'fixed', 500, '2026-06-01T00:00:00.000Z', '2026-08-31T23:59:59.000Z')`,
        [newId('coup'), shopId],
      ),
    ).toThrow(/UNIQUE constraint failed/i);

    // Invalid discount type
    expect(() =>
      db.run(
        `INSERT INTO coupons (id, shop_id, code, discount_type, discount_value, starts_at, expires_at)
         VALUES (?, ?, 'INVALID', 'bogo', 100, '2026-06-01T00:00:00.000Z', '2026-08-31T23:59:59.000Z')`,
        [newId('coup'), shopId],
      ),
    ).toThrow(/CHECK constraint failed/i);
  });

  it('records coupon redemptions', () => {
    const couponId = newId('coup');
    db.run(
      `INSERT INTO coupons (id, shop_id, code, discount_type, discount_value, starts_at, expires_at)
       VALUES (?, ?, 'WELCOME10', 'fixed', 1000, '2026-01-01T00:00:00.000Z', '2026-12-31T23:59:59.000Z')`,
      [couponId, shopId],
    );

    const redId = newId('rdm');
    db.run(
      `INSERT INTO coupon_redemptions (id, coupon_id, user_id, discount_cents)
       VALUES (?, ?, ?, 1000)`,
      [redId, couponId, customerId],
    );

    const row = db.get<{ discount_cents: number }>(
      `SELECT discount_cents FROM coupon_redemptions WHERE id = ?`,
      [redId],
    );
    expect(row?.discount_cents).toBe(1000);
  });

  it('creates and tracks loyalty accounts and transactions', () => {
    const accId = newId('lyt');
    db.run(
      `INSERT INTO loyalty_accounts (id, user_id, points_balance, lifetime_earned, tier)
       VALUES (?, ?, 100, 100, 'bronze')`,
      [accId, customerId],
    );

    // User can only have one loyalty account
    expect(() =>
      db.run(
        `INSERT INTO loyalty_accounts (id, user_id) VALUES (?, ?)`,
        [newId('lyt'), customerId],
      ),
    ).toThrow(/UNIQUE constraint failed/i);

    // Transaction ledger
    const txId = newId('ltx');
    db.run(
      `INSERT INTO loyalty_transactions (id, account_id, type, points, balance_after, description)
       VALUES (?, ?, 'earned_booking', 100, 100, 'Points earned for haircut')`,
      [txId, accId],
    );

    const tx = db.get<{ points: number; type: string }>(
      `SELECT points, type FROM loyalty_transactions WHERE id = ?`,
      [txId],
    );
    expect(tx?.points).toBe(100);
    expect(tx?.type).toBe('earned_booking');
  });

  it('creates reviews and enforces 1-5 rating range', () => {
    const revId = newId('rev');
    db.run(
      `INSERT INTO reviews (id, customer_id, shop_id, rating, comment)
       VALUES (?, ?, ?, 5, 'Great haircut and clean shop!')`,
      [revId, customerId, shopId],
    );

    // Rating must be between 1 and 5
    expect(() =>
      db.run(
        `INSERT INTO reviews (id, customer_id, shop_id, rating, comment)
         VALUES (?, ?, ?, 6, 'Over the top rating')`,
        [newId('rev'), customerId, shopId],
      ),
    ).toThrow(/CHECK constraint failed/i);

    expect(() =>
      db.run(
        `INSERT INTO reviews (id, customer_id, shop_id, rating, comment)
         VALUES (?, ?, ?, 0, 'Zero star rating')`,
        [newId('rev'), customerId, shopId],
      ),
    ).toThrow(/CHECK constraint failed/i);
  });

  it('supports review reports and moderation', () => {
    const revId = newId('rev');
    db.run(
      `INSERT INTO reviews (id, customer_id, shop_id, rating, comment)
       VALUES (?, ?, ?, 1, 'Terrible experience')`,
      [revId, customerId, shopId],
    );

    const repId = newId('rpt');
    db.run(
      `INSERT INTO review_reports (id, review_id, reporter_id, reason, details)
       VALUES (?, ?, ?, 'spam', 'Bot generated spam text')`,
      [repId, revId, ownerId],
    );

    const report = db.get<{ reason: string; status: string }>(
      `SELECT reason, status FROM review_reports WHERE id = ?`,
      [repId],
    );
    expect(report?.reason).toBe('spam');
    expect(report?.status).toBe('pending');
  });

  it('handles customer favorites with unique target constraint', () => {
    const favId = newId('fav');
    db.run(
      `INSERT INTO favorites (id, user_id, target_type, target_id)
       VALUES (?, ?, 'shop', ?)`,
      [favId, customerId, shopId],
    );

    // Duplicate favorite of same shop by same user
    expect(() =>
      db.run(
        `INSERT INTO favorites (id, user_id, target_type, target_id)
         VALUES (?, ?, 'shop', ?)`,
        [newId('fav'), customerId, shopId],
      ),
    ).toThrow(/UNIQUE constraint failed/i);
  });

  it('records notifications and user notification preferences', () => {
    const notifId = newId('ntf');
    db.run(
      `INSERT INTO notifications (id, user_id, type, title, message)
       VALUES (?, ?, 'booking_confirmed', 'Appointment Confirmed', 'Your appointment is confirmed for Oct 19 at 9:00 AM')`,
      [notifId, customerId],
    );

    const prefId = newId('prf');
    db.run(
      `INSERT INTO notification_preferences (id, user_id, email_booking_updates, push_reminders)
       VALUES (?, ?, 1, 1)`,
      [prefId, customerId],
    );

    const pref = db.get<{ email_booking_updates: number }>(
      `SELECT email_booking_updates FROM notification_preferences WHERE id = ?`,
      [prefId],
    );
    expect(pref?.email_booking_updates).toBe(1);
  });
});
