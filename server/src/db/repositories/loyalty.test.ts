import { newId } from '../../core/ids';
import { createTestDb } from '../../test-support/db';
import type { Db } from '../sqlite';
import { LoyaltyRepository, computeTier } from './loyalty';

describe('LoyaltyRepository', () => {
  let db: Db;
  let repo: LoyaltyRepository;
  let userId: string;

  beforeEach(() => {
    db = createTestDb();
    repo = new LoyaltyRepository(db);

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

  it('computes tier thresholds correctly', () => {
    expect(computeTier(0)).toBe('bronze');
    expect(computeTier(1999)).toBe('bronze');
    expect(computeTier(2000)).toBe('silver');
    expect(computeTier(4999)).toBe('silver');
    expect(computeTier(5000)).toBe('gold');
    expect(computeTier(9999)).toBe('gold');
    expect(computeTier(10000)).toBe('platinum');
  });

  it('lazily initializes account on credit and calculates tiered promotion', () => {
    const { account, transaction } = repo.creditPoints(
      userId,
      2500,
      'earned_booking',
      'bkd_123',
      'Haircut points',
    );

    expect(account.id).toMatch(/^lyt_/);
    expect(account.pointsBalance).toBe(2500);
    expect(account.lifetimeEarned).toBe(2500);
    expect(account.tier).toBe('silver');

    expect(transaction.id).toMatch(/^ltx_/);
    expect(transaction.points).toBe(2500);
    expect(transaction.balanceAfter).toBe(2500);
    expect(transaction.type).toBe('earned_booking');
  });

  it('debits points and updates balance and ledger journal', () => {
    repo.creditPoints(userId, 5000, 'promotional', null, 'Welcome points');

    const { account, transaction } = repo.debitPoints(
      userId,
      1500,
      'redeemed_discount',
      'inv_456',
      'Redeemed for $15 discount',
    );

    expect(account.pointsBalance).toBe(3500);
    expect(account.lifetimeEarned).toBe(5000);
    expect(account.lifetimeRedeemed).toBe(1500);

    expect(transaction.points).toBe(-1500);
    expect(transaction.balanceAfter).toBe(3500);

    const history = repo.listTransactions(userId);
    expect(history).toHaveLength(2);
    expect(history[0]!.type).toBe('redeemed_discount');
    expect(history[1]!.type).toBe('promotional');
  });

  it('prevents overdraft on debit with clear error', () => {
    repo.creditPoints(userId, 500, 'promotional');

    expect(() =>
      repo.debitPoints(userId, 1000, 'redeemed_discount'),
    ).toThrow(/insufficient points balance/i);
  });
});
