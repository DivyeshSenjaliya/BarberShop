import { newId } from '../../core/ids';
import { createTestDb, createTestLogger } from '../../test-support/db';
import type { Db } from '../../db/sqlite';
import { NotificationsRepository } from '../../db/repositories/notifications';
import { NotificationsService } from './notifications';

describe('NotificationsService', () => {
  let db: Db;
  let notificationsRepo: NotificationsRepository;
  let service: NotificationsService;
  let userId: string;

  beforeEach(() => {
    db = createTestDb();
    notificationsRepo = new NotificationsRepository(db);
    service = new NotificationsService({
      notificationsRepo,
      logger: createTestLogger(),
    });

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

  it('dispatches in-app notifications and manages read status', () => {
    const notif = service.dispatch({
      userId,
      type: 'booking_confirmed',
      title: 'Appointment Booked',
      message: 'You are booked for 10:00 AM',
      data: { appointmentId: 'bkd_1' },
    });

    expect(notif.id).toMatch(/^ntf_/);
    expect(service.getUnreadCount(userId)).toBe(1);

    const list = service.listNotifications(userId);
    expect(list).toHaveLength(1);
    expect(list[0]!.title).toBe('Appointment Booked');

    service.markRead(notif.id, userId);
    expect(service.getUnreadCount(userId)).toBe(0);
  });

  it('manages user notification preferences', () => {
    const initialPrefs = service.getPreferences(userId);
    expect(initialPrefs.emailBookingUpdates).toBe(true);

    const updated = service.updatePreferences(userId, {
      emailPromotions: true,
      pushReminders: false,
    });

    expect(updated.emailPromotions).toBe(true);
    expect(updated.pushReminders).toBe(false);
  });
});
