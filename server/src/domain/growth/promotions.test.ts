import { newId } from '../../core/ids';
import { createTestDb, createTestLogger } from '../../test-support/db';
import type { Db } from '../../db/sqlite';
import { CouponsRepository } from '../../db/repositories/coupons';
import { PromotionsService } from './promotions';

describe('PromotionsService', () => {
  let db: Db;
  let couponsRepo: CouponsRepository;
  let service: PromotionsService;
  let shopId: string;
  let customerId: string;

  beforeEach(() => {
    db = createTestDb();
    couponsRepo = new CouponsRepository(db);
    service = new PromotionsService({
      couponsRepo,
      logger: createTestLogger(),
    });

    const ownerId = newId('usr');
    db.run(
      `INSERT INTO users (id, email, email_normalised, password_hash, password_updated_at,
                          first_name, last_name, display_name, role)
       VALUES (?, 'owner@shop.com', 'owner@shop.com', 'h', '2026-10-07T00:00:00.000Z',
               'Owner', 'Shop', 'Owner Shop', 'owner')`,
      [ownerId],
    );

    customerId = newId('usr');
    db.run(
      `INSERT INTO users (id, email, email_normalised, password_hash, password_updated_at,
                          first_name, last_name, display_name, role)
       VALUES (?, 'cust@gmail.com', 'cust@gmail.com', 'h', '2026-10-07T00:00:00.000Z',
               'Customer', 'One', 'Customer One', 'customer')`,
      [customerId],
    );

    shopId = newId('shop');
    db.run(
      `INSERT INTO shops (id, owner_id, name, slug) VALUES (?, ?, 'Crown Barber', 'crown-barber')`,
      [shopId, ownerId],
    );
  });

  afterEach(() => db.close());

  it('calculates percentage discounts capped at maximum discount limit', () => {
    // 25% discount, capped at $10.00 (1000 cents)
    const discount = service.calculateDiscount('percentage', 2500, 5000, 1000);
    expect(discount).toBe(1000); // 25% of 5000 is 1250, capped at 1000

    // Without cap
    const uncapped = service.calculateDiscount('percentage', 2000, 4000, null);
    expect(uncapped).toBe(800); // 20% of 4000 is 800
  });

  it('validates and applies valid coupon successfully', () => {
    couponsRepo.create({
      shopId,
      code: 'OCTOBER15',
      discountType: 'percentage',
      discountValue: 1500, // 15%
      minOrderCents: 3000,
      startsAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2026-12-31T23:59:59.000Z',
    });

    const res = service.validateCoupon({
      code: 'october15',
      userId: customerId,
      subtotalCents: 4000,
      shopId,
    });

    expect(res.valid).toBe(true);
    expect(res.discountCents).toBe(600); // 15% of 4000

    const applied = service.applyCoupon({
      code: 'october15',
      userId: customerId,
      subtotalCents: 4000,
      shopId,
    });

    expect(applied.discountCents).toBe(600);
    expect(couponsRepo.countRedemptionsByUser(res.coupon.id, customerId)).toBe(1);
  });

  it('rejects coupon when below minimum order amount', () => {
    couponsRepo.create({
      shopId,
      code: 'MIN50',
      discountType: 'fixed',
      discountValue: 1000,
      minOrderCents: 5000,
      startsAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2026-12-31T23:59:59.000Z',
    });

    expect(() =>
      service.validateCoupon({
        code: 'MIN50',
        userId: customerId,
        subtotalCents: 3500,
        shopId,
      }),
    ).toThrow(/minimum order amount/i);
  });

  it('rejects coupon when per-user usage limit is exceeded', () => {
    const coupon = couponsRepo.create({
      shopId,
      code: 'ONCEONLY',
      discountType: 'fixed',
      discountValue: 500,
      perUserLimit: 1,
      startsAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2026-12-31T23:59:59.000Z',
    });

    service.applyCoupon({
      code: 'ONCEONLY',
      userId: customerId,
      subtotalCents: 3000,
    });

    expect(() =>
      service.validateCoupon({
        code: 'ONCEONLY',
        userId: customerId,
        subtotalCents: 3000,
      }),
    ).toThrow(/already used coupon/i);
  });
});
