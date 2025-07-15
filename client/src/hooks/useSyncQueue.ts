// Simple React hook for sync queue management
import { useState, useEffect, useCallback } from 'react';
import { offlineSync } from '../utils/offlineSync';
import { offlineOperations } from '../utils/offlineOperations';
import { useAuth } from '../contexts/AuthContext';
import { useNetworkStatus } from './useNetworkStatus';

export interface SyncStatus {
  isActive: boolean;
  totalPending: number;
  lastSyncAt?: string;
}

export interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  errors: string[];
}

export interface UseSyncQueueReturn {
  // Status
  syncStatus: SyncStatus;
  isOnline: boolean;
  pendingCount: number;
  
  // Actions
  syncNow: () => Promise<SyncResult>;
  queueQuizAttempt: (
    courseId: string,
    quizId: string,
    answers: Record<string, any>
  ) => Promise<void>;
  queueProgressUpdate: (
    courseId: string,
    progressData: any
  ) => Promise<void>;
  clearFailedActions: () => Promise<void>;
  
  // Utilities
  getLastSyncTime: () => Date | null;
}

export const useSyncQueue = (): UseSyncQueueReturn => {
  const { user } = useAuth();
  const { isOnline } = useNetworkStatus();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isActive: false,
    totalPending: 0
  });

  // Update sync status
  const updateSyncStatus = useCallback(async () => {
    if (!user) return;
    
    try {
      const stats = await offlineSync.getStats();
      setSyncStatus({
        isActive: false, // We could track this if needed
        totalPending: stats.totalItems,
        lastSyncAt: stats.lastSyncAt
      });
    } catch (error) {
      console.warn('Failed to get sync status:', error);
    }
  }, [user]);

  // Monitor sync status
  useEffect(() => {
    updateSyncStatus();
    
    // Update status every 10 seconds
    const interval = setInterval(updateSyncStatus, 10000);
    
    return () => clearInterval(interval);
  }, [updateSyncStatus]);

  // Sync now
  const syncNow = useCallback(async (): Promise<SyncResult> => {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    if (!isOnline) {
      throw new Error('Cannot sync while offline');
    }

    try {
      const result = await offlineSync.forceSyncNow();
      await updateSyncStatus(); // Refresh status after sync
      return result;
    } catch (error) {
      console.error('Failed to force sync:', error);
      throw error;
    }
  }, [user?.id, isOnline, updateSyncStatus]);

  // Queue quiz attempt
  const queueQuizAttempt = useCallback(async (
    courseId: string,
    quizId: string,
    answers: Record<string, any>
  ): Promise<void> => {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    try {
      await offlineOperations.submitQuiz({
        courseId,
        quizId,
        answers,
        submittedAt: new Date().toISOString()
      }, user.id);
      
      await updateSyncStatus();
    } catch (error) {
      console.error('Failed to queue quiz attempt:', error);
      throw error;
    }
  }, [user?.id, updateSyncStatus]);

  // Queue progress update
  const queueProgressUpdate = useCallback(async (
    courseId: string,
    progressData: any
  ): Promise<void> => {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    try {
      await offlineOperations.updateVideoProgress({
        courseId,
        ...progressData
      }, user.id);
      
      await updateSyncStatus();
    } catch (error) {
      console.error('Failed to queue progress update:', error);
      throw error;
    }
  }, [user?.id, updateSyncStatus]);

  // Clear failed actions (simplified)
  const clearFailedActions = useCallback(async (): Promise<void> => {
    try {
      await offlineSync.clearSyncQueue();
      await updateSyncStatus();
    } catch (error) {
      console.error('Failed to clear failed actions:', error);
      throw error;
    }
  }, [updateSyncStatus]);

  // Get last sync time
  const getLastSyncTime = useCallback((): Date | null => {
    const lastSync = localStorage.getItem('lastSyncAt');
    return lastSync ? new Date(lastSync) : null;
  }, []);

  return {
    // Status
    syncStatus,
    isOnline,
    pendingCount: syncStatus.totalPending,
    
    // Actions
    syncNow,
    queueQuizAttempt,
    queueProgressUpdate,
    clearFailedActions,
    
    // Utilities
    getLastSyncTime
  };
}; 