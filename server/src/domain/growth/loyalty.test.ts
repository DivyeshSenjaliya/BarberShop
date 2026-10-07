import { newId } from '../../core/ids';
import { createTestDb, createTestLogger } from '../../test-support/db';
import type { Db } from '../../db/sqlite';
import { LoyaltyRepository } from '../../db/repositories/loyalty';
import { LoyaltyService } from './loyalty';

describe('LoyaltyService', () => {
  let db: Db;
  let loyaltyRepo: LoyaltyRepository;
  let service: LoyaltyService;
  let userId: string;

  beforeEach(() => {
    db = createTestDb();
    loyaltyRepo = new LoyaltyRepository(db);
    service = new LoyaltyService({
      loyaltyRepo,
      logger: createTestLogger(),
    });

    userId = newId('usr');
    db.run(
      `INSERT INTO users (id, email, email_normalised, password_hash, password_updated_at,
                          first_name, last_name, display_name, role)
       VALUES (?, 'cust@gmail.com', 'cust@gmail.com', 'h', '2026-10-07T00:00:00.000Z',
               'Customer', 'One', 'Customer One', 'customer')`,
      [userId],
    );
  });

  afterEach(() => db.close());

  it('calculates points earned based on tier multipliers', () => {
    // $50.00 spend (5000 cents) -> base = 500 points
    expect(service.calculateEarnedPoints(5000, 'bronze')).toBe(500); // 1.0x
    expect(service.calculateEarnedPoints(5000, 'silver')).toBe(625); // 1.25x
    expect(service.calculateEarnedPoints(5000, 'gold')).toBe(750); // 1.5x
    expect(service.calculateEarnedPoints(5000, 'platinum')).toBe(1000); // 2.0x
  });

  it('awards booking points and increments balance', () => {
    const res = service.awardBookingPoints(userId, 'bkd_test_1', 4000); // $40.00 spend

    expect(res.pointsEarned).toBe(400);
    expect(res.newBalance).toBe(400);

    const account = service.getAccount(userId);
    expect(account.pointsBalance).toBe(400);
  });

  it('redeems points for discount amount and verifies remaining balance', () => {
    // Give 1000 points
    loyaltyRepo.creditPoints(userId, 1000, 'promotional');

    const res = service.redeemPointsForDiscount(userId, 500, 'inv_test_1');

    expect(res.discountCents).toBe(500);
    expect(res.remainingPoints).toBe(500);

    const account = service.getAccount(userId);
    expect(account.pointsBalance).toBe(500);
  });

  it('throws error when redeeming more points than available', () => {
    loyaltyRepo.creditPoints(userId, 200, 'promotional');

    expect(() =>
      service.redeemPointsForDiscount(userId, 500, 'inv_test_2'),
    ).toThrow(/insufficient points balance/i);
  });
});
