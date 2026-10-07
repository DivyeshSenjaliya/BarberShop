import type { Migration } from '../migrate';

export const migration: Migration = {
  id: '009',
  name: 'notification-outbox',
  sql: `
CREATE TABLE notification_outbox (
  id              TEXT PRIMARY KEY,
  event_type      TEXT NOT NULL,
  payload         TEXT NOT NULL,
  recipient_id    TEXT REFERENCES users (id) ON DELETE CASCADE,
  channel         TEXT NOT NULL DEFAULT 'push',
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'dead')),
  attempts        INTEGER NOT NULL DEFAULT 0,
  max_attempts    INTEGER NOT NULL DEFAULT 5,
  next_attempt_at TEXT NOT NULL,
  last_error      TEXT,
  sent_at         TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_outbox_status_next ON notification_outbox (status, next_attempt_at)
  WHERE status IN ('pending', 'processing');
CREATE INDEX idx_outbox_recipient ON notification_outbox (recipient_id, created_at DESC);
`,
};
