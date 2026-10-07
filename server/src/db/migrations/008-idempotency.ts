import type { Migration } from '../migrate';

export const migration: Migration = {
  id: '008',
  name: 'idempotency-keys',
  sql: `
CREATE TABLE idempotency_keys (
  id                TEXT PRIMARY KEY,
  key               TEXT NOT NULL,
  user_id           TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  method            TEXT NOT NULL,
  path              TEXT NOT NULL,
  status_code       INTEGER NOT NULL,
  response_body     TEXT NOT NULL,
  request_checksum  TEXT NOT NULL,
  expires_at        TEXT NOT NULL,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE UNIQUE INDEX idx_idempotency_keys_user_key ON idempotency_keys (user_id, key);
CREATE INDEX idx_idempotency_keys_expires ON idempotency_keys (expires_at);
`,
};
