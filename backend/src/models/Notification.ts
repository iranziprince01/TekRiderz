import { BaseModel } from './BaseModel';
import { Notification, NotificationType, NotificationPriority } from '../types';
import { logger } from '../utils/logger';
import { databases } from '../config/database';

export class NotificationModel extends BaseModel<Notification> {
  constructor() {
    super('notifications', 'notification');
  }

  // Create a new notification
  async createNotification(notificationData: Omit<Notification, '_id' | '_rev' | 'type'>): Promise<Notification> {
    try {
      const notification = await this.create({
        type: 'notification',
        ...notificationData
      });

      logger.info('Notification created:', {
        notificationId: notification._id,
        userId: notification.userId,
        notificationType: notification.notificationType,
        priority: notification.priority
      });

      return notification;
    } catch (error) {
      logger.error('Failed to create notification:', error);
      throw error;
    }
  }

  // Get notifications for a user
  async getUserNotifications(
    userId: string,
    options: {
      limit?: number;
      skip?: number;
      unreadOnly?: boolean;
      type?: NotificationType;
      priority?: NotificationPriority;
    } = {}
  ): Promise<{
    notifications: Notification[];
    total: number;
    unreadCount: number;
  }> {
    try {
      const { limit = 20, skip = 0, unreadOnly = false, type, priority } = options;

      // Get all notifications for user
      const result = await databases.notifications.view('notifications', 'by_user', {
        key: userId,
        include_docs: true,
        limit: 1000, // Get all to filter properly
      });

      let notifications = result.rows.map(row => row.doc as Notification);

      // Apply filters
      if (unreadOnly) {
        notifications = notifications.filter(n => !n.isRead);
      }

      if (type) {
        notifications = notifications.filter(n => n.notificationType === type);
      }

      if (priority) {
        notifications = notifications.filter(n => n.priority === priority);
      }

      // Sort by creation date (newest first)
      notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // Apply pagination
      const total = notifications.length;
      const unreadCount = notifications.filter(n => !n.isRead).length;
      const paginatedNotifications = notifications.slice(skip, skip + limit);

      return {
        notifications: paginatedNotifications,
        total,
        unreadCount
      };
    } catch (error) {
      logger.error('Failed to get user notifications:', { userId, options, error });
      throw error;
    }
  }

  // Mark notification as read
  async markAsRead(notificationId: string): Promise<Notification> {
    try {
      const notification = await this.findById(notificationId);
      if (!notification) {
        throw new Error('Notification not found');
      }

      const updatedNotification = await this.update(notificationId, {
        isRead: true,
        readAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } as Partial<Notification>);

      logger.info('Notification marked as read:', { notificationId, userId: notification.userId });
      return updatedNotification;
    } catch (error) {
      logger.error('Failed to mark notification as read:', { notificationId, error });
      throw error;
    }
  }

  // Mark all notifications as read for a user
  async markAllAsRead(userId: string): Promise<{ updatedCount: number }> {
    try {
      const result = await databases.notifications.view('notifications', 'by_user', {
        key: userId,
        include_docs: true,
      });

      const unreadNotifications = result.rows
        .map(row => row.doc as Notification)
        .filter(n => !n.isRead);

      // Update all unread notifications
      const updatePromises = unreadNotifications.map(notification =>
        this.update(notification._id!, {
          isRead: true,
          readAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        } as Partial<Notification>)
      );

      await Promise.all(updatePromises);

      logger.info('All notifications marked as read:', { userId, updatedCount: unreadNotifications.length });
      return { updatedCount: unreadNotifications.length };
    } catch (error) {
      logger.error('Failed to mark all notifications as read:', { userId, error });
      throw error;
    }
  }

  // Delete notification
  async deleteNotification(notificationId: string): Promise<void> {
    try {
      const notification = await this.findById(notificationId);
      if (!notification) {
        throw new Error('Notification not found');
      }

      await this.delete(notificationId);
      logger.info('Notification deleted:', { notificationId, userId: notification.userId });
    } catch (error) {
      logger.error('Failed to delete notification:', { notificationId, error });
      throw error;
    }
  }

  // Get notification statistics for a user
  async getUserNotificationStats(userId: string): Promise<{
    total: number;
    unread: number;
    read: number;
    byType: Record<NotificationType, number>;
    byPriority: Record<NotificationPriority, number>;
  }> {
    try {
      const result = await databases.notifications.view('notifications', 'by_user', {
        key: userId,
        include_docs: true,
      });

      const notifications = result.rows.map(row => row.doc as Notification);

      const stats = {
        total: notifications.length,
        unread: notifications.filter(n => !n.isRead).length,
        read: notifications.filter(n => n.isRead).length,
        byType: {} as Record<NotificationType, number>,
        byPriority: {} as Record<NotificationPriority, number>
      };

      // Count by type
      notifications.forEach(n => {
        stats.byType[n.notificationType] = (stats.byType[n.notificationType] || 0) + 1;
      });

      // Count by priority
      notifications.forEach(n => {
        stats.byPriority[n.priority] = (stats.byPriority[n.priority] || 0) + 1;
      });

      return stats;
    } catch (error) {
      logger.error('Failed to get notification stats:', { userId, error });
      throw error;
    }
  }

  // Create system-wide notification
  async createSystemNotification(
    notificationData: Omit<Notification, '_id' | '_rev' | 'type' | 'userId'>,
    userIds?: string[]
  ): Promise<Notification[]> {
    try {
      let targetUserIds: string[] = [];

      if (userIds && userIds.length > 0) {
        targetUserIds = userIds;
      } else {
        // Get all active users if no specific users provided
        const usersResult = await databases.users.view('users', 'by_status', {
          key: 'active',
          include_docs: false,
        });
        targetUserIds = usersResult.rows
          .map(row => row.key[1])
          .filter((userId): userId is string => userId !== undefined); // Filter out undefined values
      }

      // Create notification for each user
      const notificationPromises = targetUserIds.map(userId =>
        this.createNotification({
          ...notificationData,
          userId
        })
      );

      const notifications = await Promise.all(notificationPromises);

      logger.info('System notification created:', {
        notificationType: notificationData.notificationType,
        targetUsers: targetUserIds.length,
        createdCount: notifications.length
      });

      return notifications;
    } catch (error) {
      logger.error('Failed to create system notification:', error);
      throw error;
    }
  }

  // Clean up old notifications (older than 30 days)
  async cleanupOldNotifications(daysToKeep: number = 30): Promise<{ deletedCount: number }> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await databases.notifications.view('notifications', 'by_created_at', {
        endkey: cutoffDate.toISOString(),
        include_docs: true,
      });

      const oldNotifications = result.rows.map(row => row.doc as Notification);

      // Delete old notifications
      const deletePromises = oldNotifications.map(notification =>
        this.delete(notification._id!)
      );

      await Promise.all(deletePromises);

      logger.info('Old notifications cleaned up:', { deletedCount: oldNotifications.length, cutoffDate });
      return { deletedCount: oldNotifications.length };
    } catch (error) {
      logger.error('Failed to cleanup old notifications:', error);
      throw error;
    }
  }
}

export const notificationModel = new NotificationModel();
export default notificationModel; 