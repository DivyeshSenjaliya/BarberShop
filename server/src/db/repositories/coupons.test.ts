import { newId } from '../../core/ids';
import { createTestDb } from '../../test-support/db';
import type { Db } from '../sqlite';
import { CouponsRepository } from './coupons';

describe('CouponsRepository', () => {
  let db: Db;
  let repo: CouponsRepository;
  let shopId: string;
  let userId: string;

  beforeEach(() => {
    db = createTestDb();
    repo = new CouponsRepository(db);

    const ownerId = newId('usr');
    db.run(
      `INSERT INTO users (id, email, email_normalised, password_hash, password_updated_at,
                          first_name, last_name, display_name, role)
       VALUES (?, 'owner@shop.com', 'owner@shop.com', 'h', '2026-10-07T00:00:00.000Z',
               'Owner', 'Shop', 'Owner Shop', 'owner')`,
      [ownerId],
    );

    userId = newId('usr');
    db.run(
      `INSERT INTO users (id, email, email_normalised, password_hash, password_updated_at,
                          first_name, last_name, display_name, role)
       VALUES (?, 'cust@gmail.com', 'cust@gmail.com', 'h', '2026-10-07T00:00:00.000Z',
               'Customer', 'One', 'Customer One', 'customer')`,
      [userId],
    );

    shopId = newId('shop');
    db.run(
      `INSERT INTO shops (id, owner_id, name, slug) VALUES (?, ?, 'Crown Barber', 'crown-barber')`,
      [shopId, ownerId],
    );
  });

  afterEach(() => db.close());

  it('creates and retrieves a percentage coupon', () => {
    const coupon = repo.create({
      shopId,
      code: 'save20',
      discountType: 'percentage',
      discountValue: 2000, // 20%
      minOrderCents: 2500,
      maxDiscountCents: 1000,
      usageLimit: 100,
      startsAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2026-12-31T23:59:59.000Z',
    });

    expect(coupon.id).toMatch(/^coup_/);
    expect(coupon.code).toBe('SAVE20'); // uppercased
    expect(coupon.discountType).toBe('percentage');
    expect(coupon.discountValue).toBe(2000);
    expect(coupon.minOrderCents).toBe(2500);
    expect(coupon.maxDiscountCents).toBe(1000);
    expect(coupon.timesUsed).toBe(0);
    expect(coupon.isActive).toBe(true);

    const found = repo.findByCode('save20');
    expect(found).toEqual(coupon);
  });

  it('filters coupons by shop and active status', () => {
    repo.create({
      shopId,
      code: 'ACTIVE1',
      discountType: 'fixed',
      discountValue: 500,
      startsAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2026-12-31T23:59:59.000Z',
    });

    const inactive = repo.create({
      shopId,
      code: 'INACTIVE1',
      discountType: 'fixed',
      discountValue: 500,
      startsAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2026-12-31T23:59:59.000Z',
    });

    repo.deactivate(inactive.id);

    const activeList = repo.list({ shopId, isActive: true });
    expect(activeList).toHaveLength(1);
    expect(activeList[0]!.code).toBe('ACTIVE1');

    const allList = repo.list({ shopId });
    expect(allList).toHaveLength(2);
  });

  it('tracks redemptions and increments timesUsed', () => {
    const coupon = repo.create({
      shopId,
      code: 'REDEEM10',
      discountType: 'fixed',
      discountValue: 1000,
      startsAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2026-12-31T23:59:59.000Z',
    });

    const redemption = repo.recordRedemption({
      couponId: coupon.id,
      userId,
      discountCents: 1000,
    });

    expect(redemption.id).toMatch(/^rdm_/);
    expect(redemption.discountCents).toBe(1000);

    const updatedCoupon = repo.findById(coupon.id);
    expect(updatedCoupon?.timesUsed).toBe(1);

    expect(repo.countRedemptionsByUser(coupon.id, userId)).toBe(1);

    const userRedemptions = repo.listUserRedemptions(userId);
    expect(userRedemptions).toHaveLength(1);
    expect(userRedemptions[0]!.couponId).toBe(coupon.id);
  });
});
