import type { Migration } from '../migrate';

/**
 * Identity: users, addresses, sessions and single-use tokens.
 *
 * Design notes:
 * - Emails are stored twice: as the user typed it, and normalised
 *   (trimmed + lowercased) with a partial unique index so soft-deleted
 *   accounts do not block re-registration.
 * - Password material never leaves this table in plaintext; the hash format
 *   carries its own parameters (`scrypt$N$r$p$salt$hash`).
 * - Refresh tokens are stored as SHA-256 hashes only, so a database leak
 *   cannot be replayed as a session.
 */
export const migration: Migration = {
  id: '001',
  name: 'identity',
  sql: `
CREATE TABLE users (
  id                   TEXT PRIMARY KEY,
  email                TEXT NOT NULL,
  email_normalised     TEXT NOT NULL,
  phone                TEXT,
  password_hash        TEXT NOT NULL,
  password_updated_at  TEXT NOT NULL,
  first_name           TEXT NOT NULL,
  last_name            TEXT NOT NULL,
  display_name         TEXT NOT NULL,
  avatar_url           TEXT,
  role                 TEXT NOT NULL DEFAULT 'customer'
                       CHECK (role IN ('customer', 'barber', 'manager', 'owner', 'admin')),
  status               TEXT NOT NULL DEFAULT 'active'
                       CHECK (status IN ('pending', 'active', 'suspended', 'deleted')),
  email_verified_at    TEXT,
  phone_verified_at    TEXT,
  locale               TEXT NOT NULL DEFAULT 'en',
  timezone             TEXT NOT NULL DEFAULT 'UTC',
  stripe_customer_ref  TEXT,
  last_login_at        TEXT,
  failed_login_count   INTEGER NOT NULL DEFAULT 0,
  locked_until         TEXT,
  created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at           TEXT
) STRICT;

CREATE UNIQUE INDEX idx_users_email_normalised
  ON users (email_normalised)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX idx_users_phone
  ON users (phone)
  WHERE phone IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX idx_users_role_status ON users (role, status);
CREATE INDEX idx_users_created_at ON users (created_at DESC);

CREATE TABLE addresses (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  label        TEXT NOT NULL DEFAULT 'Home',
  line1        TEXT NOT NULL,
  line2        TEXT,
  city         TEXT NOT NULL,
  region       TEXT,
  postal_code  TEXT NOT NULL,
  country      TEXT NOT NULL DEFAULT 'US',
  latitude     REAL CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)),
  longitude    REAL CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180)),
  is_default   INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at   TEXT
) STRICT;

CREATE INDEX idx_addresses_user ON addresses (user_id, is_default DESC) WHERE deleted_at IS NULL;

-- One active default address per user.
CREATE UNIQUE INDEX idx_addresses_one_default
  ON addresses (user_id)
  WHERE is_default = 1 AND deleted_at IS NULL;

CREATE TABLE auth_sessions (
  id                  TEXT PRIMARY KEY,
  user_id             TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  refresh_token_hash  TEXT NOT NULL UNIQUE,
  device_name         TEXT,
  user_agent          TEXT,
  ip_address          TEXT,
  issued_at           TEXT NOT NULL,
  expires_at          TEXT NOT NULL,
  last_used_at        TEXT,
  revoked_at          TEXT,
  revoked_reason      TEXT CHECK (revoked_reason IS NULL OR
                        revoked_reason IN ('logout', 'logout_all', 'rotated', 'password_change', 'expired', 'admin')),
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE INDEX idx_auth_sessions_user ON auth_sessions (user_id, revoked_at);
CREATE INDEX idx_auth_sessions_expiry ON auth_sessions (expires_at);

-- Single-use tokens (password reset, email verification, phone verification).
CREATE TABLE auth_tokens (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  purpose      TEXT NOT NULL CHECK (purpose IN ('password_reset', 'email_verification', 'phone_verification')),
  token_hash   TEXT NOT NULL UNIQUE,
  payload      TEXT,
  expires_at   TEXT NOT NULL,
  consumed_at  TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE INDEX idx_auth_tokens_user_purpose ON auth_tokens (user_id, purpose, consumed_at);
CREATE INDEX idx_auth_tokens_expiry ON auth_tokens (expires_at);
`,
};
