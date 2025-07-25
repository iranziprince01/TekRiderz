import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { notificationModel } from '../models/Notification';
import { notificationService } from '../services/notificationService';
import { logger } from '../utils/logger';
import { ApiResponse } from '../types';

const router = Router();

// Get user notifications
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const unreadOnly = req.query.unreadOnly === 'true';
    const type = req.query.type as string;
    const priority = req.query.priority as string;

    const result = await notificationModel.getUserNotifications(req.user.id, {
      limit,
      skip: (page - 1) * limit,
      unreadOnly,
      type: type as any,
      priority: priority as any
    });

    const response: ApiResponse = {
      success: true,
      data: {
        notifications: result.notifications,
        pagination: {
          page,
          limit,
          total: result.total,
          pages: Math.ceil(result.total / limit)
        },
        stats: {
          total: result.total,
          unread: result.unreadCount,
          read: result.total - result.unreadCount
        }
      }
    };

    return res.json(response);
  } catch (error) {
    logger.error('Failed to get notifications:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve notifications'
    });
  }
});

// Get notification statistics
router.get('/stats', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const stats = await notificationModel.getUserNotificationStats(req.user.id);

    const response: ApiResponse = {
      success: true,
      data: stats
    };

    return res.json(response);
  } catch (error) {
    logger.error('Failed to get notification stats:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve notification statistics'
    });
  }
});

// Mark notification as read
router.put('/:id/read', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const { id: notificationId } = req.params;

    if (!notificationId) {
      return res.status(400).json({
        success: false,
        error: 'Notification ID is required'
      });
    }

    // Verify notification belongs to user
    const notification = await notificationModel.findById(notificationId);
    if (!notification || notification.userId !== req.user.id) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found'
      });
    }

    const updatedNotification = await notificationModel.markAsRead(notificationId);

    const response: ApiResponse = {
      success: true,
      data: {
        notification: updatedNotification,
        message: 'Notification marked as read'
      }
    };

    return res.json(response);
  } catch (error) {
    logger.error('Failed to mark notification as read:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to mark notification as read'
    });
  }
});

// Mark all notifications as read
router.put('/mark-all-read', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const result = await notificationModel.markAllAsRead(req.user.id);

    const response: ApiResponse = {
      success: true,
      data: {
        updatedCount: result.updatedCount,
        message: `Marked ${result.updatedCount} notifications as read`
      }
    };

    return res.json(response);
  } catch (error) {
    logger.error('Failed to mark all notifications as read:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to mark all notifications as read'
    });
  }
});

// Delete notification
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const { id: notificationId } = req.params;

    if (!notificationId) {
      return res.status(400).json({
        success: false,
        error: 'Notification ID is required'
      });
    }

    // Verify notification belongs to user
    const notification = await notificationModel.findById(notificationId);
    if (!notification || notification.userId !== req.user.id) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found'
      });
    }

    await notificationModel.deleteNotification(notificationId);

    const response: ApiResponse = {
      success: true,
      message: 'Notification deleted successfully'
    };

    return res.json(response);
  } catch (error) {
    logger.error('Failed to delete notification:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete notification'
    });
  }
});

// Trigger smart notifications analysis
router.post('/analyze', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Only allow admins or the user themselves to trigger analysis
    if (req.user.role !== 'admin' && req.user.id !== req.body.userId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to trigger notification analysis'
      });
    }

    const userId = req.body.userId || req.user.id;
    await notificationService.analyzeAndSendSmartNotifications(userId);

    const response: ApiResponse = {
      success: true,
      message: 'Smart notifications analysis completed'
    };

    return res.json(response);
  } catch (error) {
    logger.error('Failed to analyze smart notifications:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to analyze smart notifications'
    });
  }
});

// Create test notification (admin only)
router.post('/test', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    const { userId, title, message, type, priority } = req.body;

    if (!userId || !title || !message) {
      return res.status(400).json({
        success: false,
        error: 'userId, title, and message are required'
      });
    }

    const notification = await notificationModel.createNotification({
      id: `test_${Date.now()}`,
      userId,
      title,
      message,
      notificationType: type || 'info',
      priority: priority || 'medium',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isRead: false
    });

    const response: ApiResponse = {
      success: true,
      data: {
        notification,
        message: 'Test notification created successfully'
      }
    };

    return res.json(response);
  } catch (error) {
    logger.error('Failed to create test notification:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create test notification'
    });
  }
});

// Cleanup old notifications (admin only)
router.post('/cleanup', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    await notificationService.cleanupOldNotifications();

    const response: ApiResponse = {
      success: true,
      message: 'Old notifications cleanup completed'
    };

    return res.json(response);
  } catch (error) {
    logger.error('Failed to cleanup old notifications:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to cleanup old notifications'
    });
  }
});

export default router; 