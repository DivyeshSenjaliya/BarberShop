import { newId } from '../../core/ids';
import { createTestDb } from '../../test-support/db';
import type { Db } from '../sqlite';
import { WalletsRepository } from './wallets';

describe('WalletsRepository', () => {
  let db: Db;
  let repo: WalletsRepository;
  let userId: string;

  beforeEach(() => {
    db = createTestDb();
    repo = new WalletsRepository(db);

    userId = newId('usr');
    db.run(
      `INSERT INTO users (id, email, email_normalised, password_hash, password_updated_at,
                          first_name, last_name, display_name, role)
       VALUES (?, 'user@gmail.com', 'user@gmail.com', 'h', '2026-10-07T00:00:00.000Z',
               'Arthur', 'Shelby', 'Arthur Shelby', 'customer')`,
      [userId],
    );
  });

  afterEach(() => db.close());

  it('creates wallet idempotently and starts with zero balance', () => {
    const w1 = repo.getOrCreateWallet(userId);
    expect(w1.id).toMatch(/^wal_/);
    expect(w1.balanceCents).toBe(0);
    expect(w1.status).toBe('active');

    const w2 = repo.getOrCreateWallet(userId);
    expect(w2.id).toBe(w1.id);
  });

  it('credits wallet and logs transaction journal entry', () => {
    const wallet = repo.getOrCreateWallet(userId);

    const { wallet: updated, transaction } = repo.credit(
      wallet.id,
      5000,
      'topup',
      'ref_card_123',
      'Deposit via Credit Card',
    );

    expect(updated.balanceCents).toBe(5000);
    expect(transaction.amountCents).toBe(5000);
    expect(transaction.balanceAfterCents).toBe(5000);
    expect(transaction.type).toBe('topup');
  });

  it('debits wallet and rejects debit when funds are insufficient', () => {
    const wallet = repo.getOrCreateWallet(userId);
    repo.credit(wallet.id, 4000, 'topup');

    const { wallet: debited, transaction } = repo.debit(
      wallet.id,
      2500,
      'payment',
      'apt_1',
      'Payment for appointment',
    );

    expect(debited.balanceCents).toBe(1500);
    expect(transaction.amountCents).toBe(-2500);
    expect(transaction.balanceAfterCents).toBe(1500);

    // Overdraft attempt
    expect(() => repo.debit(wallet.id, 2000, 'payment')).toThrow(/insufficient/i);
  });

  it('lists transaction history in descending order', () => {
    const wallet = repo.getOrCreateWallet(userId);
    repo.credit(wallet.id, 5000, 'topup');
    repo.debit(wallet.id, 1000, 'payment');
    repo.credit(wallet.id, 500, 'bonus');

    const txs = repo.listTransactions(wallet.id);
    expect(txs).toHaveLength(3);
    expect(txs[0]!.type).toBe('bonus');
    expect(txs[1]!.type).toBe('payment');
    expect(txs[2]!.type).toBe('topup');
  });
});
