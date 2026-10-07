import { createTestDb } from '../../test-support/db';
import { AuditLogsRepository } from './auditLogs';
import type { Db } from '../sqlite';

describe('AuditLogsRepository', () => {
  let db: Db;
  let repo: AuditLogsRepository;

  beforeEach(() => {
    db = createTestDb();
    repo = new AuditLogsRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  it('creates an audit log entry with structured details and timestamps', () => {
    const entry = repo.create({
      userId: null,
      action: 'auth.login_attempt',
      entityType: 'user',
      entityId: 'guest-anon',
      ipAddress: '192.168.1.50',
      userAgent: 'Mozilla/5.0 Mobile',
      details: { reason: 'invalid_password', email: 'alex@example.com' },
    });

    expect(entry.id).toMatch(/^aud_/);
    expect(entry.action).toBe('auth.login_attempt');
    expect(entry.entity_type).toBe('user');
    expect(entry.ip_address).toBe('192.168.1.50');
    expect(entry.details).toContain('invalid_password');

    const fetched = repo.findById(entry.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.id).toBe(entry.id);
  });

  it('filters audit logs by action and entityType with pagination', () => {
    repo.create({
      action: 'booking.created',
      entityType: 'booking',
      entityId: 'apt-1',
    });
    repo.create({
      action: 'booking.cancelled',
      entityType: 'booking',
      entityId: 'apt-1',
    });
    repo.create({
      action: 'payment.refund',
      entityType: 'payment',
      entityId: 'pay-99',
    });

    const bookingLogs = repo.list({ entityType: 'booking' });
    expect(bookingLogs).toHaveLength(2);
    expect(repo.count({ entityType: 'booking' })).toBe(2);

    const refundLogs = repo.list({ action: 'payment.refund' });
    expect(refundLogs).toHaveLength(1);
    expect(refundLogs[0]!.entity_id).toBe('pay-99');

    const paged = repo.list({ limit: 1, offset: 0 });
    expect(paged).toHaveLength(1);
  });
});
