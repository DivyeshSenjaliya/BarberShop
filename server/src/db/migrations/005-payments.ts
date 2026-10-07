import type { Migration } from '../migrate';

/**
 * Money and Ledger: invoices, payments, refunds, wallets, and wallet transaction journal.
 *
 * Design notes:
 * - Invoices record tax, discounts, subtotal, and total before payments.
 * - Payments track method ('card', 'cash', 'wallet', 'online'), status lifecycle,
 *   and idempotency keys to prevent duplicate charges.
 * - Refunds support both full and partial amounts with state transitions.
 * - Wallets store a verified non-negative balance, with every balance change
 *   strictly tracked in an immutable `wallet_transactions` ledger.
 */
export const migration: Migration = {
  id: '005',
  name: 'payments',
  sql: `
CREATE TABLE invoices (
  id              TEXT PRIMARY KEY,
  appointment_id  TEXT REFERENCES appointments (id) ON DELETE SET NULL,
  customer_id     TEXT NOT NULL REFERENCES users (id),
  shop_id         TEXT NOT NULL REFERENCES shops (id) ON DELETE CASCADE,
  invoice_number  TEXT NOT NULL UNIQUE,
  subtotal_cents  INTEGER NOT NULL CHECK (subtotal_cents >= 0),
  tax_cents       INTEGER NOT NULL DEFAULT 0 CHECK (tax_cents >= 0),
  discount_cents  INTEGER NOT NULL DEFAULT 0 CHECK (discount_cents >= 0),
  total_cents     INTEGER NOT NULL CHECK (total_cents >= 0),
  currency        TEXT NOT NULL DEFAULT 'USD',
  status          TEXT NOT NULL DEFAULT 'issued'
                  CHECK (status IN ('draft', 'issued', 'paid', 'partially_refunded', 'refunded', 'void')),
  issued_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  paid_at         TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at      TEXT
) STRICT;

CREATE INDEX idx_invoices_customer ON invoices (customer_id, created_at);
CREATE INDEX idx_invoices_shop_status ON invoices (shop_id, status);
CREATE INDEX idx_invoices_appointment ON invoices (appointment_id);

CREATE TABLE payments (
  id                TEXT PRIMARY KEY,
  invoice_id        TEXT REFERENCES invoices (id) ON DELETE SET NULL,
  appointment_id    TEXT REFERENCES appointments (id) ON DELETE SET NULL,
  customer_id       TEXT NOT NULL REFERENCES users (id),
  shop_id           TEXT NOT NULL REFERENCES shops (id) ON DELETE CASCADE,
  amount_cents      INTEGER NOT NULL CHECK (amount_cents > 0),
  currency          TEXT NOT NULL DEFAULT 'USD',
  method            TEXT NOT NULL CHECK (method IN ('card', 'cash', 'wallet', 'online')),
  provider          TEXT NOT NULL DEFAULT 'mock',
  provider_tx_id    TEXT,
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'successful', 'failed', 'refunded', 'partially_refunded')),
  failure_reason    TEXT,
  idempotency_key   TEXT UNIQUE,
  metadata          TEXT,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at        TEXT
) STRICT;

CREATE INDEX idx_payments_customer ON payments (customer_id, created_at);
CREATE INDEX idx_payments_shop_status ON payments (shop_id, status);
CREATE INDEX idx_payments_invoice ON payments (invoice_id);

CREATE TABLE refunds (
  id              TEXT PRIMARY KEY,
  payment_id      TEXT NOT NULL REFERENCES payments (id) ON DELETE CASCADE,
  amount_cents    INTEGER NOT NULL CHECK (amount_cents > 0),
  currency        TEXT NOT NULL DEFAULT 'USD',
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'processed', 'rejected', 'failed')),
  reason          TEXT NOT NULL,
  requested_by    TEXT NOT NULL REFERENCES users (id),
  processed_by    TEXT REFERENCES users (id) ON DELETE SET NULL,
  processed_at    TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE INDEX idx_refunds_payment ON refunds (payment_id);
CREATE INDEX idx_refunds_status ON refunds (status);

CREATE TABLE wallets (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
  balance_cents  INTEGER NOT NULL DEFAULT 0 CHECK (balance_cents >= 0),
  currency       TEXT NOT NULL DEFAULT 'USD',
  status         TEXT NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active', 'frozen', 'closed')),
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE TABLE wallet_transactions (
  id                   TEXT PRIMARY KEY,
  wallet_id            TEXT NOT NULL REFERENCES wallets (id) ON DELETE CASCADE,
  type                 TEXT NOT NULL CHECK (type IN ('topup', 'payment', 'refund', 'bonus', 'adjustment')),
  amount_cents         INTEGER NOT NULL,
  balance_after_cents  INTEGER NOT NULL CHECK (balance_after_cents >= 0),
  reference_id         TEXT,
  description          TEXT,
  created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE INDEX idx_wallet_txns_wallet_created ON wallet_transactions (wallet_id, created_at);
`,
};
