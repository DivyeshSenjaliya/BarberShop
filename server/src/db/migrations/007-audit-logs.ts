import type { Migration } from '../migrate';

export const migration: Migration = {
  id: '007',
  name: 'audit-logs',
  sql: `
CREATE TABLE audit_logs (
  id                  TEXT PRIMARY KEY,
  user_id             TEXT REFERENCES users (id) ON DELETE SET NULL,
  action              TEXT NOT NULL,
  entity_type         TEXT NOT NULL,
  entity_id           TEXT NOT NULL,
  ip_address          TEXT,
  user_agent          TEXT,
  details             TEXT,
  created_at          TEXT NOT NULL
);

CREATE INDEX idx_audit_logs_user_time ON audit_logs (user_id, created_at DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs (action, created_at DESC);
CREATE INDEX idx_audit_logs_entity ON audit_logs (entity_type, entity_id);
`,
};
