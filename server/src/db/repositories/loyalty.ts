import { newId } from '../../core/ids';
import type { Db } from '../sqlite';

export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum';
export type LoyaltyTxType =
  | 'earned_booking'
  | 'redeemed_discount'
  | 'referral_bonus'
  | 'promotional'
  | 'manual_adjustment'
  | 'expired';

export interface LoyaltyAccountRecord {
  id: string;
  userId: string;
  pointsBalance: number;
  lifetimeEarned: number;
  lifetimeRedeemed: number;
  tier: LoyaltyTier;
  createdAt: string;
  updatedAt: string;
}

interface LoyaltyAccountRow {
  id: string;
  user_id: string;
  points_balance: number;
  lifetime_earned: number;
  lifetime_redeemed: number;
  tier: LoyaltyTier;
  created_at: string;
  updated_at: string;
}

export interface LoyaltyTransactionRecord {
  id: string;
  accountId: string;
  type: LoyaltyTxType;
  points: number;
  balanceAfter: number;
  referenceId: string | null;
  description: string | null;
  createdAt: string;
}

interface LoyaltyTransactionRow {
  id: string;
  account_id: string;
  type: LoyaltyTxType;
  points: number;
  balance_after: number;
  reference_id: string | null;
  description: string | null;
  created_at: string;
}

function mapAccountRow(row: LoyaltyAccountRow): LoyaltyAccountRecord {
  return {
    id: row.id,
    userId: row.user_id,
    pointsBalance: row.points_balance,
    lifetimeEarned: row.lifetime_earned,
    lifetimeRedeemed: row.lifetime_redeemed,
    tier: row.tier,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTransactionRow(row: LoyaltyTransactionRow): LoyaltyTransactionRecord {
  return {
    id: row.id,
    accountId: row.account_id,
    type: row.type,
    points: row.points,
    balanceAfter: row.balance_after,
    referenceId: row.reference_id,
    description: row.description,
    createdAt: row.created_at,
  };
}

export function computeTier(lifetimeEarned: number): LoyaltyTier {
  if (lifetimeEarned >= 10000) return 'platinum';
  if (lifetimeEarned >= 5000) return 'gold';
  if (lifetimeEarned >= 2000) return 'silver';
  return 'bronze';
}

const AccountColumns = `
  id, user_id, points_balance, lifetime_earned, lifetime_redeemed,
  tier, created_at, updated_at`;

const TransactionColumns = `
  id, account_id, type, points, balance_after, reference_id, description, created_at`;

export class LoyaltyRepository {
  constructor(private readonly db: Db) {}

  findByUserId(userId: string): LoyaltyAccountRecord | null {
    const row = this.db.get<LoyaltyAccountRow>(
      `SELECT ${AccountColumns} FROM loyalty_accounts WHERE user_id = ?`,
      [userId],
    );
    return row ? mapAccountRow(row) : null;
  }

  getOrCreateAccount(userId: string): LoyaltyAccountRecord {
    const existing = this.findByUserId(userId);
    if (existing) return existing;

    const id = newId('lyt');
    const now = new Date().toISOString();

    this.db.run(
      `INSERT OR IGNORE INTO loyalty_accounts (
         id, user_id, points_balance, lifetime_earned, lifetime_redeemed,
         tier, created_at, updated_at
       ) VALUES (?, ?, 0, 0, 0, 'bronze', ?, ?)`,
      [id, userId, now, now],
    );

    return this.findByUserId(userId)!;
  }

  creditPoints(
    userId: string,
    points: number,
    type: LoyaltyTxType,
    referenceId?: string | null,
    description?: string | null,
  ): { account: LoyaltyAccountRecord; transaction: LoyaltyTransactionRecord } {
    if (points <= 0) throw new Error('credited points must be greater than zero');

    return this.db.transaction(() => {
      const account = this.getOrCreateAccount(userId);
      const newBalance = account.pointsBalance + points;
      const newLifetime = account.lifetimeEarned + points;
      const newTier = computeTier(newLifetime);
      const now = new Date().toISOString();

      this.db.run(
        `UPDATE loyalty_accounts
         SET points_balance = ?,
             lifetime_earned = ?,
             tier = ?,
             updated_at = ?
         WHERE id = ?`,
        [newBalance, newLifetime, newTier, now, account.id],
      );

      const txId = newId('ltx');
      this.db.run(
        `INSERT INTO loyalty_transactions (
           id, account_id, type, points, balance_after, reference_id, description, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          txId,
          account.id,
          type,
          points,
          newBalance,
          referenceId ?? null,
          description ?? null,
          now,
        ],
      );

      const updatedAccount = this.findByUserId(userId)!;
      const txRow = this.db.get<LoyaltyTransactionRow>(
        `SELECT ${TransactionColumns} FROM loyalty_transactions WHERE id = ?`,
        [txId],
      );

      return {
        account: updatedAccount,
        transaction: mapTransactionRow(txRow!),
      };
    });
  }

  debitPoints(
    userId: string,
    points: number,
    type: LoyaltyTxType,
    referenceId?: string | null,
    description?: string | null,
  ): { account: LoyaltyAccountRecord; transaction: LoyaltyTransactionRecord } {
    if (points <= 0) throw new Error('debited points must be greater than zero');

    return this.db.transaction(() => {
      const account = this.getOrCreateAccount(userId);
      if (account.pointsBalance < points) {
        throw new Error(
          `insufficient points balance: requested ${points}, available ${account.pointsBalance}`,
        );
      }

      const newBalance = account.pointsBalance - points;
      const newRedeemed = account.lifetimeRedeemed + points;
      const now = new Date().toISOString();

      this.db.run(
        `UPDATE loyalty_accounts
         SET points_balance = ?,
             lifetime_redeemed = ?,
             updated_at = ?
         WHERE id = ?`,
        [newBalance, newRedeemed, now, account.id],
      );

      const txId = newId('ltx');
      this.db.run(
        `INSERT INTO loyalty_transactions (
           id, account_id, type, points, balance_after, reference_id, description, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          txId,
          account.id,
          type,
          -points,
          newBalance,
          referenceId ?? null,
          description ?? null,
          now,
        ],
      );

      const updatedAccount = this.findByUserId(userId)!;
      const txRow = this.db.get<LoyaltyTransactionRow>(
        `SELECT ${TransactionColumns} FROM loyalty_transactions WHERE id = ?`,
        [txId],
      );

      return {
        account: updatedAccount,
        transaction: mapTransactionRow(txRow!),
      };
    });
  }

  listTransactions(
    userId: string,
    limit = 50,
    offset = 0,
  ): LoyaltyTransactionRecord[] {
    const account = this.findByUserId(userId);
    if (!account) return [];

    return this.db
      .all<LoyaltyTransactionRow>(
        `SELECT ${TransactionColumns}
         FROM loyalty_transactions
         WHERE account_id = ?
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
        [account.id, limit, offset],
      )
      .map(mapTransactionRow);
  }
}
