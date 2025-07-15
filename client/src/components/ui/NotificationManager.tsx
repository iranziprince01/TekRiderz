import React, { useState, useEffect } from 'react';
import { NotificationToast } from './NotificationToast';
import { apiClient } from '../../utils/api';

interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
}

interface NotificationManagerProps {
  userId?: string;
  maxNotifications?: number;
}

export const NotificationManager: React.FC<NotificationManagerProps> = ({
  userId,
  maxNotifications = 5
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    // Subscribe to real-time notifications only if the methods exist
    const handleNotification = (data: any) => {
      // Only show notifications relevant to the current user
      if (data.userId && data.userId !== userId) {
        return;
      }

      const notification: Notification = {
        id: `${Date.now()}-${Math.random()}`,
        type: data.type || 'info',
        title: data.title || 'Notification',
        message: data.message || '',
        duration: data.duration || 5000,
      };

      addNotification(notification);
    };

    // Check if subscription methods exist before using them
    try {
      if (typeof (apiClient as any).subscribeToUpdates === 'function') {
        (apiClient as any).subscribeToUpdates('course_notification', handleNotification);
        (apiClient as any).subscribeToUpdates('status_notification', handleNotification);
        (apiClient as any).subscribeToUpdates('system_notification', handleNotification);
      }
    } catch (error) {
      console.warn('Real-time notifications not available:', error);
    }

    return () => {
      // Cleanup subscriptions only if methods exist
      try {
        if (typeof (apiClient as any).unsubscribeFromUpdates === 'function') {
          (apiClient as any).unsubscribeFromUpdates('course_notification', handleNotification);
          (apiClient as any).unsubscribeFromUpdates('status_notification', handleNotification);
          (apiClient as any).unsubscribeFromUpdates('system_notification', handleNotification);
        }
      } catch (error) {
        console.warn('Failed to cleanup notification subscriptions:', error);
      }
    };
  }, [userId]);

  const addNotification = (notification: Notification) => {
    setNotifications(prev => {
      const newNotifications = [notification, ...prev];
      // Keep only the latest notifications
      return newNotifications.slice(0, maxNotifications);
    });
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // Helper function to add notifications programmatically
  const showNotification = (
    type: 'success' | 'error' | 'warning' | 'info',
    title: string,
    message: string,
    duration?: number
  ) => {
    const notification: Notification = {
      id: `${Date.now()}-${Math.random()}`,
      type,
      title,
      message,
      duration,
    };
    addNotification(notification);
  };

  // Global notification methods
  useEffect(() => {
    // Make notification methods globally available
    (window as any).showNotification = showNotification;
    
    return () => {
      delete (window as any).showNotification;
    };
  }, []);

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {notifications.map((notification, index) => (
        <div
          key={notification.id}
          style={{
            zIndex: 1000 - index,
            transform: `translateY(${index * 8}px)`,
          }}
        >
          <NotificationToast
            id={notification.id}
            type={notification.type}
            title={notification.title}
            message={notification.message}
            duration={notification.duration}
            onClose={removeNotification}
          />
        </div>
      ))}
    </div>
  );
};

export default NotificationManager; 