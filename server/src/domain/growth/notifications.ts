import type { Logger } from '../../core/logger';
import type {
  NotificationsRepository,
  NotificationRecord,
  NotificationType,
  NotificationPreferencesRecord,
} from '../../db/repositories/notifications';

export interface DispatchNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface NotificationsServiceDeps {
  notificationsRepo: NotificationsRepository;
  logger: Logger;
}

export class NotificationsService {
  constructor(private readonly deps: NotificationsServiceDeps) {}

  dispatch(input: DispatchNotificationInput): NotificationRecord {
    const prefs = this.deps.notificationsRepo.getPreferences(input.userId);

    // Record in-app notification
    const notification = this.deps.notificationsRepo.create({
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      data: input.data,
    });

    this.deps.logger.info('notification dispatched', {
      notificationId: notification.id,
      userId: input.userId,
      type: input.type,
      emailOptIn: this.shouldSendEmail(input.type, prefs),
      pushOptIn: this.shouldSendPush(input.type, prefs),
    });

    return notification;
  }

  private shouldSendEmail(type: NotificationType, prefs: NotificationPreferencesRecord): boolean {
    switch (type) {
      case 'booking_confirmed':
      case 'booking_cancelled':
      case 'booking_rescheduled':
        return prefs.emailBookingUpdates;
      case 'booking_reminder':
        return prefs.emailReminders;
      case 'promotional':
        return prefs.emailPromotions;
      default:
        return true;
    }
  }

  private shouldSendPush(type: NotificationType, prefs: NotificationPreferencesRecord): boolean {
    switch (type) {
      case 'booking_confirmed':
      case 'booking_cancelled':
      case 'booking_rescheduled':
        return prefs.pushBookingUpdates;
      case 'booking_reminder':
        return prefs.pushReminders;
      case 'promotional':
        return prefs.pushPromotions;
      default:
        return true;
    }
  }

  listNotifications(userId: string, unreadOnly = false, limit = 50, offset = 0): NotificationRecord[] {
    return this.deps.notificationsRepo.listByUser(userId, unreadOnly, limit, offset);
  }

  getUnreadCount(userId: string): number {
    return this.deps.notificationsRepo.countUnread(userId);
  }

  markRead(notificationId: string, userId: string): boolean {
    return this.deps.notificationsRepo.markAsRead(notificationId, userId);
  }

  markAllRead(userId: string): number {
    return this.deps.notificationsRepo.markAllAsRead(userId);
  }

  getPreferences(userId: string): NotificationPreferencesRecord {
    return this.deps.notificationsRepo.getPreferences(userId);
  }

  updatePreferences(
    userId: string,
    updates: Partial<Omit<NotificationPreferencesRecord, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>,
  ): NotificationPreferencesRecord {
    return this.deps.notificationsRepo.updatePreferences(userId, updates);
  }
}
