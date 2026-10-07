import type { Db } from '../../db/sqlite';
import { newId } from '../../core/ids';

/**
 * Transactional notification outbox.
 *
 * Callers enqueue events inside the same DB transaction as the business
 * mutation (the "outbox pattern"). A background worker picks up `pending`
 * rows, delivers them via the configured channel, and marks them `sent`.
 * Failed deliveries are retried with exponential backoff up to max_attempts,
 * then promoted to `dead` for alerting.
 *
 * Supported channels: `push` (future: `email`, `sms`).
 * Supported statuses: pending → processing → sent | failed → dead.
 */

export type OutboxChannel = 'push' | 'email' | 'sms';
export type OutboxStatus = 'pending' | 'processing' | 'sent' | 'failed' | 'dead';

export interface OutboxMessage {
  id: string;
  eventType: string;
  payload: Record<string, unknown>;
  recipientId: string | null;
  channel: OutboxChannel;
  status: OutboxStatus;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: string;
  lastError: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface OutboxRow {
  id: string;
  event_type: string;
  payload: string;
  recipient_id: string | null;
  channel: string;
  status: string;
  attempts: number;
  max_attempts: number;
  next_attempt_at: string;
  last_error: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

function mapRow(row: OutboxRow): OutboxMessage {
  return {
    id: row.id,
    eventType: row.event_type,
    payload: JSON.parse(row.payload) as Record<string, unknown>,
    recipientId: row.recipient_id,
    channel: row.channel as OutboxChannel,
    status: row.status as OutboxStatus,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    nextAttemptAt: row.next_attempt_at,
    lastError: row.last_error,
    sentAt: row.sent_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Exponential backoff: 30s, 2m, 8m, 32m, ~2h */
function nextAttemptDelay(attempts: number): number {
  const base = 30_000; // 30 seconds in ms
  return base * Math.pow(4, attempts);
}

export interface EnqueueOutboxParams {
  eventType: string;
  payload: Record<string, unknown>;
  recipientId?: string | null;
  channel?: OutboxChannel;
  maxAttempts?: number;
  /** ISO string override for first attempt time (useful in tests) */
  nextAttemptAt?: string;
}

export class NotificationOutboxRepository {
  constructor(private readonly db: Db) {}

  enqueue(params: EnqueueOutboxParams): OutboxMessage {
    const id = newId('obx');
    const now = new Date().toISOString();
    const nextAttemptAt = params.nextAttemptAt ?? now;
    const maxAttempts = params.maxAttempts ?? 5;
    const channel = params.channel ?? 'push';

    this.db.run(
      `INSERT INTO notification_outbox
         (id, event_type, payload, recipient_id, channel, status, attempts, max_attempts, next_attempt_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'pending', 0, ?, ?, ?, ?)`,
      [
        id,
        params.eventType,
        JSON.stringify(params.payload),
        params.recipientId ?? null,
        channel,
        maxAttempts,
        nextAttemptAt,
        now,
        now,
      ],
    );

    return this.findById(id)!;
  }

  findById(id: string): OutboxMessage | null {
    const row = this.db.get<OutboxRow>(
      'SELECT * FROM notification_outbox WHERE id = ?',
      [id],
    );
    return row ? mapRow(row) : null;
  }

  /** Claim a batch of pending messages for processing */
  claimPending(limit = 10): OutboxMessage[] {
    const now = new Date().toISOString();
    const rows = this.db.all<OutboxRow>(
      `SELECT * FROM notification_outbox
       WHERE status IN ('pending', 'failed')
         AND next_attempt_at <= ?
       ORDER BY next_attempt_at ASC
       LIMIT ?`,
      [now, limit],
    );

    if (rows.length === 0) return [];

    const ids = rows.map((r) => r.id);
    const placeholders = ids.map(() => '?').join(', ');
    this.db.run(
      `UPDATE notification_outbox SET status = 'processing', updated_at = ? WHERE id IN (${placeholders})`,
      [now, ...ids],
    );

    return rows.map(mapRow);
  }

  /** Mark as successfully sent */
  markSent(id: string): void {
    const now = new Date().toISOString();
    this.db.run(
      `UPDATE notification_outbox
       SET status = 'sent', sent_at = ?, updated_at = ?
       WHERE id = ?`,
      [now, now, id],
    );
  }

  /** Record a delivery failure and schedule retry or mark dead */
  markFailed(id: string, error: string): void {
    const now = new Date().toISOString();
    const msg = this.findById(id);
    if (!msg) return;

    const newAttempts = msg.attempts + 1;
    const isDead = newAttempts >= msg.maxAttempts;
    const newStatus = isDead ? 'dead' : 'failed';
    const delay = isDead ? 0 : nextAttemptDelay(newAttempts);
    const nextAttempt = isDead ? now : new Date(Date.now() + delay).toISOString();

    this.db.run(
      `UPDATE notification_outbox
       SET status = ?, attempts = ?, last_error = ?, next_attempt_at = ?, updated_at = ?
       WHERE id = ?`,
      [newStatus, newAttempts, error, nextAttempt, now, id],
    );
  }

  /** Count messages by status for monitoring dashboards */
  statusCounts(): Record<OutboxStatus, number> {
    const rows = this.db.all<{ status: string; cnt: number }>(
      `SELECT status, COUNT(*) as cnt FROM notification_outbox GROUP BY status`,
    );
    const counts: Record<string, number> = {
      pending: 0,
      processing: 0,
      sent: 0,
      failed: 0,
      dead: 0,
    };
    for (const row of rows) {
      counts[row.status] = row.cnt;
    }
    return counts as Record<OutboxStatus, number>;
  }

  /** Retrieve messages for a given recipient for debugging */
  listForRecipient(recipientId: string, limit = 20): OutboxMessage[] {
    return this.db
      .all<OutboxRow>(
        `SELECT * FROM notification_outbox WHERE recipient_id = ? ORDER BY created_at DESC LIMIT ?`,
        [recipientId, limit],
      )
      .map(mapRow);
  }

  /** Prune successfully sent messages older than retentionDays */
  pruneOldSent(retentionDays = 30): number {
    const cutoff = new Date(Date.now() - retentionDays * 86400_000).toISOString();
    const result = this.db.run(
      `DELETE FROM notification_outbox WHERE status = 'sent' AND sent_at < ?`,
      [cutoff],
    );
    return result.changes;
  }
}
