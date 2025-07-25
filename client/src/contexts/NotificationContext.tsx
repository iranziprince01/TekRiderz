import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { apiClient } from '../utils/api';

interface Notification {
  _id: string;
  title: string;
  message: string;
  notificationType: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  isRead: boolean;
  createdAt: string;
  actionUrl?: string;
  actionText?: string;
  metadata?: any;
}

interface NotificationStats {
  total: number;
  unread: number;
  read: number;
}

interface NotificationContextType {
  notifications: Notification[];
  stats: NotificationStats;
  loading: boolean;
  fetchNotifications: () => Promise<void>;
  fetchStats: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  refreshNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

interface NotificationProviderProps {
  children: React.ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [stats, setStats] = useState<NotificationStats>({ total: 0, unread: 0, read: 0 });
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const response = await apiClient.makeRequest('/notifications?limit=20');
      
      if (response.success) {
        setNotifications(response.data.notifications);
        setStats(response.data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchStats = useCallback(async () => {
    if (!user) return;
    
    try {
      const response = await apiClient.makeRequest('/notifications/stats');
      if (response.success) {
        setStats(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch notification stats:', error);
    }
  }, [user]);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const response = await apiClient.makeRequest(`/notifications/${notificationId}/read`, {
        method: 'PUT'
      });
      
      if (response.success) {
        setNotifications(prev => 
          prev.map(n => 
            n._id === notificationId ? { ...n, isRead: true } : n
          )
        );
        setStats(prev => ({ 
          ...prev, 
          unread: Math.max(0, prev.unread - 1), 
          read: prev.read + 1 
        }));
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      const response = await apiClient.makeRequest('/notifications/mark-all-read', {
        method: 'PUT'
      });
      
      if (response.success) {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        setStats(prev => ({ ...prev, unread: 0, read: prev.total }));
      }
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  }, []);

  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      const response = await apiClient.makeRequest(`/notifications/${notificationId}`, {
        method: 'DELETE'
      });
      
      if (response.success) {
        const deletedNotification = notifications.find(n => n._id === notificationId);
        setNotifications(prev => prev.filter(n => n._id !== notificationId));
        setStats(prev => ({ 
          ...prev, 
          total: prev.total - 1,
          unread: prev.unread - (deletedNotification?.isRead ? 0 : 1)
        }));
      }
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  }, [notifications]);

  const refreshNotifications = useCallback(() => {
    fetchNotifications();
    fetchStats();
  }, [fetchNotifications, fetchStats]);

  // Initial load
  useEffect(() => {
    if (user) {
      fetchNotifications();
      fetchStats();
    }
  }, [user, fetchNotifications, fetchStats]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!user) return;
    
    const interval = setInterval(() => {
      fetchStats();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [user, fetchStats]);

  const value: NotificationContextType = {
    notifications,
    stats,
    loading,
    fetchNotifications,
    fetchStats,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refreshNotifications
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export default NotificationProvider; 