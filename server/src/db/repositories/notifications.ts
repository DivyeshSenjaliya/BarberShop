import { newId } from '../../core/ids';
import type { Db } from '../sqlite';

export type NotificationType =
  | 'booking_confirmed'
  | 'booking_reminder'
  | 'booking_cancelled'
  | 'booking_rescheduled'
  | 'payment_success'
  | 'payment_failed'
  | 'refund_processed'
  | 'review_request'
  | 'promotional'
  | 'system';

export interface NotificationRecord {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

interface NotificationRow {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  data_json: string | null;
  read_at: string | null;
  created_at: string;
}

export interface NotificationPreferencesRecord {
  id: string;
  userId: string;
  emailBookingUpdates: boolean;
  emailReminders: boolean;
  emailPromotions: boolean;
  pushBookingUpdates: boolean;
  pushReminders: boolean;
  pushPromotions: boolean;
  smsBookingUpdates: boolean;
  createdAt: string;
  updatedAt: string;
}

interface NotificationPreferencesRow {
  id: string;
  user_id: string;
  email_booking_updates: number;
  email_reminders: number;
  email_promotions: number;
  push_booking_updates: number;
  push_reminders: number;
  push_promotions: number;
  sms_booking_updates: number;
  created_at: string;
  updated_at: string;
}

function mapNotificationRow(row: NotificationRow): NotificationRecord {
  let data: Record<string, unknown> | null = null;
  if (row.data_json) {
    try {
      data = JSON.parse(row.data_json);
    } catch {
      data = null;
    }
  }

  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    message: row.message,
    data,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

function mapPreferencesRow(row: NotificationPreferencesRow): NotificationPreferencesRecord {
  return {
    id: row.id,
    userId: row.user_id,
    emailBookingUpdates: row.email_booking_updates === 1,
    emailReminders: row.email_reminders === 1,
    emailPromotions: row.email_promotions === 1,
    pushBookingUpdates: row.push_booking_updates === 1,
    pushReminders: row.push_reminders === 1,
    pushPromotions: row.push_promotions === 1,
    smsBookingUpdates: row.sms_booking_updates === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const NotificationColumns = `id, user_id, type, title, message, data_json, read_at, created_at`;
const PreferenceColumns = `
  id, user_id, email_booking_updates, email_reminders, email_promotions,
  push_booking_updates, push_reminders, push_promotions, sms_booking_updates,
  created_at, updated_at`;

export class NotificationsRepository {
  constructor(private readonly db: Db) {}

  create(input: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    data?: Record<string, unknown> | null;
  }): NotificationRecord {
    const id = newId('ntf');
    const now = new Date().toISOString();
    const dataJson = input.data ? JSON.stringify(input.data) : null;

    this.db.run(
      `INSERT INTO notifications (id, user_id, type, title, message, data_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, input.userId, input.type, input.title, input.message, dataJson, now],
    );

    const row = this.db.get<NotificationRow>(
      `SELECT ${NotificationColumns} FROM notifications WHERE id = ?`,
      [id],
    );
    return mapNotificationRow(row!);
  }

  listByUser(userId: string, unreadOnly = false, limit = 50, offset = 0): NotificationRecord[] {
    const clauses = ['user_id = ?'];
    const params: unknown[] = [userId];

    if (unreadOnly) {
      clauses.push('read_at IS NULL');
    }

    return this.db
      .all<NotificationRow>(
        `SELECT ${NotificationColumns} FROM notifications WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      )
      .map(mapNotificationRow);
  }

  countUnread(userId: string): number {
    const row = this.db.get<{ count: number }>(
      `SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND read_at IS NULL`,
      [userId],
    );
    return row?.count ?? 0;
  }

  markAsRead(notificationId: string, userId: string): boolean {
    const now = new Date().toISOString();
    const res = this.db.run(
      `UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ? AND read_at IS NULL`,
      [now, notificationId, userId],
    );
    return res.changes > 0;
  }

  markAllAsRead(userId: string): number {
    const now = new Date().toISOString();
    const res = this.db.run(
      `UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL`,
      [now, userId],
    );
    return res.changes;
  }

  getPreferences(userId: string): NotificationPreferencesRecord {
    const existing = this.db.get<NotificationPreferencesRow>(
      `SELECT ${PreferenceColumns} FROM notification_preferences WHERE user_id = ?`,
      [userId],
    );
    if (existing) return mapPreferencesRow(existing);

    const id = newId('prf');
    const now = new Date().toISOString();

    this.db.run(
      `INSERT OR IGNORE INTO notification_preferences (
         id, user_id, email_booking_updates, email_reminders, email_promotions,
         push_booking_updates, push_reminders, push_promotions, sms_booking_updates,
         created_at, updated_at
       ) VALUES (?, ?, 1, 1, 0, 1, 1, 0, 1, ?, ?)`,
      [id, userId, now, now],
    );

    const row = this.db.get<NotificationPreferencesRow>(
      `SELECT ${PreferenceColumns} FROM notification_preferences WHERE user_id = ?`,
      [userId],
    );
    return mapPreferencesRow(row!);
  }

  updatePreferences(
    userId: string,
    updates: Partial<Omit<NotificationPreferencesRecord, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>,
  ): NotificationPreferencesRecord {
    // Ensure row exists
    this.getPreferences(userId);

    const now = new Date().toISOString();
    const sets: string[] = ['updated_at = ?'];
    const params: unknown[] = [now];

    if (updates.emailBookingUpdates !== undefined) {
      sets.push('email_booking_updates = ?');
      params.push(updates.emailBookingUpdates ? 1 : 0);
    }
    if (updates.emailReminders !== undefined) {
      sets.push('email_reminders = ?');
      params.push(updates.emailReminders ? 1 : 0);
    }
    if (updates.emailPromotions !== undefined) {
      sets.push('email_promotions = ?');
      params.push(updates.emailPromotions ? 1 : 0);
    }
    if (updates.pushBookingUpdates !== undefined) {
      sets.push('push_booking_updates = ?');
      params.push(updates.pushBookingUpdates ? 1 : 0);
    }
    if (updates.pushReminders !== undefined) {
      sets.push('push_reminders = ?');
      params.push(updates.pushReminders ? 1 : 0);
    }
    if (updates.pushPromotions !== undefined) {
      sets.push('push_promotions = ?');
      params.push(updates.pushPromotions ? 1 : 0);
    }
    if (updates.smsBookingUpdates !== undefined) {
      sets.push('sms_booking_updates = ?');
      params.push(updates.smsBookingUpdates ? 1 : 0);
    }

    params.push(userId);
    this.db.run(
      `UPDATE notification_preferences SET ${sets.join(', ')} WHERE user_id = ?`,
      params,
    );

    return this.getPreferences(userId);
  }
}
