import { newId } from '../../core/ids';
import type { Db } from '../sqlite';

export type WalletStatus = 'active' | 'frozen' | 'closed';
export type WalletTxType = 'topup' | 'payment' | 'refund' | 'bonus' | 'adjustment';

export interface WalletRecord {
  id: string;
  userId: string;
  balanceCents: number;
  currency: string;
  status: WalletStatus;
  createdAt: string;
  updatedAt: string;
}

interface WalletRow {
  id: string;
  user_id: string;
  balance_cents: number;
  currency: string;
  status: WalletStatus;
  created_at: string;
  updated_at: string;
}

export interface WalletTransactionRecord {
  id: string;
  walletId: string;
  type: WalletTxType;
  amountCents: number;
  balanceAfterCents: number;
  referenceId: string | null;
  description: string | null;
  createdAt: string;
}

interface WalletTransactionRow {
  id: string;
  wallet_id: string;
  type: WalletTxType;
  amount_cents: number;
  balance_after_cents: number;
  reference_id: string | null;
  description: string | null;
  created_at: string;
}

function mapWalletRow(row: WalletRow): WalletRecord {
  return {
    id: row.id,
    userId: row.user_id,
    balanceCents: row.balance_cents,
    currency: row.currency,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTxRow(row: WalletTransactionRow): WalletTransactionRecord {
  return {
    id: row.id,
    walletId: row.wallet_id,
    type: row.type,
    amountCents: row.amount_cents,
    balanceAfterCents: row.balance_after_cents,
    referenceId: row.reference_id,
    description: row.description,
    createdAt: row.created_at,
  };
}

const WalletSelectColumns = `id, user_id, balance_cents, currency, status, created_at, updated_at`;
const TxSelectColumns = `id, wallet_id, type, amount_cents, balance_after_cents, reference_id, description, created_at`;

export class WalletsRepository {
  constructor(private readonly db: Db) {}

  getOrCreateWallet(userId: string, currency = 'USD'): WalletRecord {
    const existing = this.getWalletByUserId(userId);
    if (existing) return existing;

    const id = newId('wal');
    const now = new Date().toISOString();

    this.db.run(
      `INSERT INTO wallets (id, user_id, balance_cents, currency, status, created_at, updated_at)
       VALUES (?, ?, 0, ?, 'active', ?, ?)
       ON CONFLICT (user_id) DO NOTHING`,
      [id, userId, currency, now, now],
    );

    return this.requireWalletByUserId(userId);
  }

  getWalletByUserId(userId: string): WalletRecord | null {
    const row = this.db.get<WalletRow>(
      `SELECT ${WalletSelectColumns} FROM wallets WHERE user_id = ?`,
      [userId],
    );
    return row ? mapWalletRow(row) : null;
  }

  requireWalletByUserId(userId: string): WalletRecord {
    const wallet = this.getWalletByUserId(userId);
    if (!wallet) throw new Error(`wallet for user '${userId}' not found`);
    return wallet;
  }

  getWalletById(id: string): WalletRecord | null {
    const row = this.db.get<WalletRow>(
      `SELECT ${WalletSelectColumns} FROM wallets WHERE id = ?`,
      [id],
    );
    return row ? mapWalletRow(row) : null;
  }

  requireWalletById(id: string): WalletRecord {
    const wallet = this.getWalletById(id);
    if (!wallet) throw new Error(`wallet '${id}' not found`);
    return wallet;
  }

  credit(
    walletId: string,
    amountCents: number,
    type: WalletTxType,
    referenceId?: string | null,
    description?: string | null,
  ): { wallet: WalletRecord; transaction: WalletTransactionRecord } {
    if (amountCents <= 0) throw new Error('Credit amount must be positive');

    let txRow!: WalletTransactionRecord;

    this.db.transaction(() => {
      const current = this.requireWalletById(walletId);
      if (current.status !== 'active') throw new Error(`Cannot credit ${current.status} wallet`);

      const newBalance = current.balanceCents + amountCents;
      const now = new Date().toISOString();
      const txId = newId('txn');

      this.db.run(`UPDATE wallets SET balance_cents = ?, updated_at = ? WHERE id = ?`, [
        newBalance,
        now,
        walletId,
      ]);

      this.db.run(
        `INSERT INTO wallet_transactions (
           id, wallet_id, type, amount_cents, balance_after_cents, reference_id, description, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [txId, walletId, type, amountCents, newBalance, referenceId ?? null, description ?? null, now],
      );

      const createdTx = this.db.get<WalletTransactionRow>(
        `SELECT ${TxSelectColumns} FROM wallet_transactions WHERE id = ?`,
        [txId],
      );
      if (!createdTx) throw new Error('Failed to create wallet transaction');
      txRow = mapTxRow(createdTx);
    });

    return {
      wallet: this.requireWalletById(walletId),
      transaction: txRow,
    };
  }

  debit(
    walletId: string,
    amountCents: number,
    type: WalletTxType,
    referenceId?: string | null,
    description?: string | null,
  ): { wallet: WalletRecord; transaction: WalletTransactionRecord } {
    if (amountCents <= 0) throw new Error('Debit amount must be positive');

    let txRow!: WalletTransactionRecord;

    this.db.transaction(() => {
      const current = this.requireWalletById(walletId);
      if (current.status !== 'active') throw new Error(`Cannot debit ${current.status} wallet`);
      if (current.balanceCents < amountCents) {
        throw new Error('Insufficient wallet balance');
      }

      const newBalance = current.balanceCents - amountCents;
      const now = new Date().toISOString();
      const txId = newId('txn');

      this.db.run(`UPDATE wallets SET balance_cents = ?, updated_at = ? WHERE id = ?`, [
        newBalance,
        now,
        walletId,
      ]);

      this.db.run(
        `INSERT INTO wallet_transactions (
           id, wallet_id, type, amount_cents, balance_after_cents, reference_id, description, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [txId, walletId, type, -amountCents, newBalance, referenceId ?? null, description ?? null, now],
      );

      const createdTx = this.db.get<WalletTransactionRow>(
        `SELECT ${TxSelectColumns} FROM wallet_transactions WHERE id = ?`,
        [txId],
      );
      if (!createdTx) throw new Error('Failed to create wallet transaction');
      txRow = mapTxRow(createdTx);
    });

    return {
      wallet: this.requireWalletById(walletId),
      transaction: txRow,
    };
  }

  listTransactions(walletId: string, limit = 50, offset = 0): WalletTransactionRecord[] {
    return this.db
      .all<WalletTransactionRow>(
        `SELECT ${TxSelectColumns} FROM wallet_transactions WHERE wallet_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [walletId, limit, offset],
      )
      .map(mapTxRow);
  }
}
