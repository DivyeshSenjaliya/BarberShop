import { createTestDb } from '../../test-support/db';
import type { Db } from '../../db/sqlite';
import { NotificationOutboxRepository } from './outbox';
import { UsersRepository } from '../../db/repositories/users';
import { newId } from '../../core/ids';

describe('NotificationOutboxRepository', () => {
  let db: Db;
  let repo: NotificationOutboxRepository;

  beforeEach(() => {
    db = createTestDb();
    repo = new NotificationOutboxRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  function seedUser(): string {
    const users = new UsersRepository(db);
    const id = newId('usr');
    users.insert({
      id,
      email: `u-${id}@example.com`,
      passwordHash: 'hash',
      firstName: 'Outbox',
      lastName: 'User',
    });
    return id;
  }

  it('enqueues a message in pending status with correct defaults', () => {
    const recipientId = seedUser();

    const msg = repo.enqueue({
      eventType: 'booking.confirmed',
      payload: { bookingId: 'bkd_123', shopName: 'Downtown Cuts' },
      recipientId,
      channel: 'push',
    });

    expect(msg.id).toMatch(/^obx_/);
    expect(msg.status).toBe('pending');
    expect(msg.attempts).toBe(0);
    expect(msg.maxAttempts).toBe(5);
    expect(msg.eventType).toBe('booking.confirmed');
    expect(msg.payload.bookingId).toBe('bkd_123');
    expect(msg.recipientId).toBe(recipientId);
  });

  it('enqueues without a recipient for broadcast messages', () => {
    const msg = repo.enqueue({
      eventType: 'system.maintenance',
      payload: { message: 'Scheduled downtime at midnight' },
    });

    expect(msg.recipientId).toBeNull();
    expect(msg.status).toBe('pending');
  });

  it('claimPending only returns messages due for processing', () => {
    const recipientId = seedUser();

    // Past due — should be claimed
    repo.enqueue({
      eventType: 'booking.reminder',
      payload: { bookingId: 'bkd_001' },
      recipientId,
      nextAttemptAt: new Date(Date.now() - 1000).toISOString(),
    });

    // Future — should not be claimed
    repo.enqueue({
      eventType: 'booking.reminder',
      payload: { bookingId: 'bkd_002' },
      recipientId,
      nextAttemptAt: new Date(Date.now() + 60_000).toISOString(),
    });

    const claimed = repo.claimPending(10);
    expect(claimed).toHaveLength(1);
    expect(claimed[0]!.payload.bookingId).toBe('bkd_001');

    // Re-claim should return nothing (already 'processing')
    const reclaim = repo.claimPending(10);
    expect(reclaim).toHaveLength(0);
  });

  it('markSent transitions status to sent and sets sentAt', () => {
    const recipientId = seedUser();
    const msg = repo.enqueue({
      eventType: 'payment.receipt',
      payload: { amount: 1500 },
      recipientId,
    });

    repo.markSent(msg.id);

    const updated = repo.findById(msg.id);
    expect(updated?.status).toBe('sent');
    expect(updated?.sentAt).not.toBeNull();
  });

  it('markFailed increments attempts and schedules retry', () => {
    const recipientId = seedUser();
    const msg = repo.enqueue({
      eventType: 'push.send',
      payload: { title: 'New appointment' },
      recipientId,
      maxAttempts: 3,
    });

    repo.markFailed(msg.id, 'PUSH_SERVICE_UNAVAILABLE');
    const afterFirst = repo.findById(msg.id)!;
    expect(afterFirst.attempts).toBe(1);
    expect(afterFirst.status).toBe('failed');
    expect(afterFirst.lastError).toBe('PUSH_SERVICE_UNAVAILABLE');
    // Next attempt scheduled in future
    expect(new Date(afterFirst.nextAttemptAt).getTime()).toBeGreaterThan(Date.now());

    // Fail twice more → dead
    repo.markFailed(msg.id, 'TIMEOUT');
    repo.markFailed(msg.id, 'TIMEOUT');
    const dead = repo.findById(msg.id)!;
    expect(dead.status).toBe('dead');
    expect(dead.attempts).toBe(3);
  });

  it('statusCounts returns accurate per-status counts', () => {
    const recipientId = seedUser();

    const m1 = repo.enqueue({ eventType: 'e1', payload: {}, recipientId });
    const m2 = repo.enqueue({ eventType: 'e2', payload: {}, recipientId });
    const m3 = repo.enqueue({ eventType: 'e3', payload: {}, recipientId });

    repo.markSent(m1.id);
    repo.markFailed(m2.id, 'err');

    const counts = repo.statusCounts();
    expect(counts.sent).toBe(1);
    expect(counts.failed).toBe(1);
    expect(counts.pending).toBe(1);
    expect(counts.dead).toBe(0);
  });

  it('pruneOldSent removes sent messages older than retentionDays', () => {
    const recipientId = seedUser();
    const msg = repo.enqueue({ eventType: 'old', payload: {}, recipientId });
    repo.markSent(msg.id);

    // Override sent_at to be 31 days ago
    const oldDate = new Date(Date.now() - 31 * 86400_000).toISOString();
    db.run('UPDATE notification_outbox SET sent_at = ? WHERE id = ?', [oldDate, msg.id]);

    const pruned = repo.pruneOldSent(30);
    expect(pruned).toBe(1);
    expect(repo.findById(msg.id)).toBeNull();
  });

  it('listForRecipient returns all messages for recipient', () => {
    const recipientId = seedUser();

    repo.enqueue({ eventType: 'evt.1', payload: { seq: 1 }, recipientId });
    repo.enqueue({ eventType: 'evt.2', payload: { seq: 2 }, recipientId });
    repo.enqueue({ eventType: 'evt.3', payload: { seq: 3 }, recipientId });

    const messages = repo.listForRecipient(recipientId);
    expect(messages).toHaveLength(3);

    const eventTypes = new Set(messages.map((m) => m.eventType));
    expect(eventTypes.has('evt.1')).toBe(true);
    expect(eventTypes.has('evt.2')).toBe(true);
    expect(eventTypes.has('evt.3')).toBe(true);
  });
});
