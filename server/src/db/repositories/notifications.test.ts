import { newId } from '../../core/ids';
import { createTestDb } from '../../test-support/db';
import type { Db } from '../sqlite';
import { NotificationsRepository } from './notifications';

describe('NotificationsRepository', () => {
  let db: Db;
  let repo: NotificationsRepository;
  let userId: string;

  beforeEach(() => {
    db = createTestDb();
    repo = new NotificationsRepository(db);

    userId = newId('usr');
    db.run(
      `INSERT INTO users (id, email, email_normalised, password_hash, password_updated_at,
                          first_name, last_name, display_name, role)
       VALUES (?, 'cust@gmail.com', 'cust@gmail.com', 'h', '2026-10-07T00:00:00.000Z',
               'Customer', 'One', 'Customer One', 'customer')`,
      [userId],
    );
  });

  afterEach(() => db.close());

  it('creates notifications, counts unread, and marks as read', () => {
    const notif1 = repo.create({
      userId,
      type: 'booking_confirmed',
      title: 'Booking Confirmed',
      message: 'Your haircut is booked for Monday at 9:00 AM',
      data: { appointmentId: 'bkd_123', priceCents: 3500 },
    });

    const notif2 = repo.create({
      userId,
      type: 'promotional',
      title: '20% Off This Weekend',
      message: 'Use code WEEKEND20 at checkout',
    });

    expect(notif1.id).toMatch(/^ntf_/);
    expect(notif1.data).toEqual({ appointmentId: 'bkd_123', priceCents: 3500 });
    expect(repo.countUnread(userId)).toBe(2);

    // Mark single notif1 as read
    const marked = repo.markAsRead(notif1.id, userId);
    expect(marked).toBe(true);
    expect(repo.countUnread(userId)).toBe(1);

    const unread = repo.listByUser(userId, true);
    expect(unread).toHaveLength(1);
    expect(unread[0]!.id).toBe(notif2.id);

    // Mark all as read
    const allCount = repo.markAllAsRead(userId);
    expect(allCount).toBe(1);
    expect(repo.countUnread(userId)).toBe(0);
  });

  it('fetches default preferences and updates notification channels', () => {
    const defaultPrefs = repo.getPreferences(userId);
    expect(defaultPrefs.emailBookingUpdates).toBe(true);
    expect(defaultPrefs.emailPromotions).toBe(false);
    expect(defaultPrefs.pushReminders).toBe(true);

    const updated = repo.updatePreferences(userId, {
      emailPromotions: true,
      smsBookingUpdates: false,
    });

    expect(updated.emailPromotions).toBe(true);
    expect(updated.smsBookingUpdates).toBe(false);
    expect(updated.emailBookingUpdates).toBe(true); // unchanged
  });
});
