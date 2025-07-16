// React hook for sync queue management and status

import { useState, useEffect, useCallback, useRef } from 'react';
import { syncManager, SyncStatus, SyncResult, ConflictData } from '../utils/syncManager';
import { offlineStorage } from '../utils/offlineStorage';
import { useAuth } from '../contexts/AuthContext';

export interface UseSyncQueueReturn {
  // Status
  syncStatus: SyncStatus;
  isOnline: boolean;
  pendingCount: number;
  
  // Actions
  syncNow: () => Promise<SyncResult[]>;
  queueQuizAttempt: (
    courseId: string,
    quizId: string,
    moduleId: string,
    sectionId: string,
    answers: Record<string, any>,
    timeSpent: number
  ) => Promise<string>;
  queueModuleCompletion: (
    courseId: string,
    moduleId: string,
    sectionId: string,
    timeSpent: number,
    progress: number
  ) => Promise<void>;
  queueProgressUpdate: (
    courseId: string,
    progress: number,
    completedLessons: string[],
    timeSpent: number
  ) => Promise<void>;
  clearFailedActions: () => Promise<void>;
  
  // Conflicts
  conflicts: ConflictData[];
  resolveConflict: (conflictId: string, resolution: 'client_wins' | 'server_wins' | 'merge') => Promise<void>;
  
  // Utilities
  retryFailedActions: () => Promise<void>;
  getLastSyncTime: () => Date | null;
}

export const useSyncQueue = (): UseSyncQueueReturn => {
  const { user } = useAuth();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isActive: false,
    totalPending: 0,
    failedActions: 0,
    successfulActions: 0
  });
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [conflicts, setConflicts] = useState<ConflictData[]>([]);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Network status monitoring
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setIsOnline(true);
      console.log('Back online - sync queue will resume');
    };

    const handleOffline = () => {
      setIsOnline(false);
      console.log('📡 Gone offline - sync queue paused');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Subscribe to sync status updates
  useEffect(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    try {
      unsubscribeRef.current = syncManager.addSyncListener((status: SyncStatus) => {
        setSyncStatus(status || {
          isActive: false,
          totalPending: 0,
          failedActions: 0,
          successfulActions: 0
        });
      });
    } catch (error) {
      console.error('Failed to subscribe to sync status:', error);
    }

    // Initial status load
    if (user?.id) {
      syncManager.getSyncStatus(user.id).then(setSyncStatus);
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [user?.id]);

  // Update conflicts
  useEffect(() => {
    const updateConflicts = () => {
      setConflicts(syncManager.getConflicts());
    };

    // Check for conflicts every 5 seconds
    const conflictInterval = setInterval(updateConflicts, 5000);
    updateConflicts(); // Initial check

    return () => clearInterval(conflictInterval);
  }, []);

  // Sync now
  const syncNow = useCallback(async (): Promise<SyncResult[]> => {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    if (!isOnline) {
      throw new Error('Cannot sync while offline');
    }

    try {
      return await syncManager.forceSyncNow(user.id);
    } catch (error) {
      console.error('Failed to force sync:', error);
      throw error;
    }
  }, [user?.id, isOnline]);

  // Queue quiz attempt
  const queueQuizAttempt = useCallback(async (
    courseId: string,
    quizId: string,
    moduleId: string,
    sectionId: string,
    answers: Record<string, any>,
    timeSpent: number
  ): Promise<string> => {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    try {
      const attemptId = await syncManager.queueQuizAttempt(
        user.id,
        courseId,
        quizId,
        moduleId,
        sectionId,
        answers,
        timeSpent
      );

      // Update sync status immediately
      if (user.id) {
        const status = await syncManager.getSyncStatus(user.id);
        setSyncStatus(status);
      }

      return attemptId;
    } catch (error) {
      console.error('Failed to queue quiz attempt:', error);
      throw error;
    }
  }, [user?.id]);

  // Queue module completion
  const queueModuleCompletion = useCallback(async (
    courseId: string,
    moduleId: string,
    sectionId: string,
    timeSpent: number,
    progress: number
  ): Promise<void> => {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    try {
      await syncManager.queueModuleCompletion(
        user.id,
        courseId,
        moduleId,
        sectionId,
        timeSpent,
        progress
      );

      // Update sync status immediately
      const status = await syncManager.getSyncStatus(user.id);
      setSyncStatus(status);
    } catch (error) {
      console.error('Failed to queue module completion:', error);
      throw error;
    }
  }, [user?.id]);

  // Queue progress update
  const queueProgressUpdate = useCallback(async (
    courseId: string,
    progress: number,
    completedLessons: string[],
    timeSpent: number
  ): Promise<void> => {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    try {
      await syncManager.queueProgressUpdate(
        user.id,
        courseId,
        progress,
        completedLessons,
        timeSpent
      );

      // Update sync status immediately
      const status = await syncManager.getSyncStatus(user.id);
      setSyncStatus(status);
    } catch (error) {
      console.error('Failed to queue progress update:', error);
      throw error;
    }
  }, [user?.id]);

  // Clear failed actions
  const clearFailedActions = useCallback(async (): Promise<void> => {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    try {
      await syncManager.clearFailedActions(user.id);
      
      // Update sync status
      const status = await syncManager.getSyncStatus(user.id);
      setSyncStatus(status);
    } catch (error) {
      console.error('Failed to clear failed actions:', error);
      throw error;
    }
  }, [user?.id]);

  // Resolve conflict
  const resolveConflict = useCallback(async (
    conflictId: string,
    resolution: 'client_wins' | 'server_wins' | 'merge'
  ): Promise<void> => {
    try {
      await syncManager.resolveConflict(conflictId, resolution);
      
      // Update conflicts list
      setConflicts(syncManager.getConflicts());
      
      // Update sync status if user exists
      if (user?.id) {
        const status = await syncManager.getSyncStatus(user.id);
        setSyncStatus(status);
      }
    } catch (error) {
      console.error('Failed to resolve conflict:', error);
      throw error;
    }
  }, [user?.id]);

  // Retry failed actions
  const retryFailedActions = useCallback(async (): Promise<void> => {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    if (!isOnline) {
      throw new Error('Cannot retry while offline');
    }

    try {
      // Get failed actions and reset them to pending
      const pendingActions = await offlineStorage.getSyncQueue(user.id);
      const failedActions = pendingActions.filter(action => action.status === 'failed');

      for (const action of failedActions) {
        await offlineStorage.updateSyncAction(action.id, {
          status: 'pending',
          retryCount: 0,
          errorMessage: undefined,
          lastRetryAt: undefined
        });
      }

      // Trigger sync
      await syncNow();
    } catch (error) {
      console.error('Failed to retry failed actions:', error);
      throw error;
    }
  }, [user?.id, isOnline, syncNow]);

  // Get last sync time
  const getLastSyncTime = useCallback((): Date | null => {
    if (syncStatus.lastSyncAt) {
      return new Date(syncStatus.lastSyncAt);
    }
    return null;
  }, [syncStatus.lastSyncAt]);

  return {
    // Status
    syncStatus,
    isOnline,
    pendingCount: syncStatus.totalPending,
    
    // Actions
    syncNow,
    queueQuizAttempt,
    queueModuleCompletion,
    queueProgressUpdate,
    clearFailedActions,
    
    // Conflicts
    conflicts,
    resolveConflict,
    
    // Utilities
    retryFailedActions,
    getLastSyncTime
  };
};

// Helper hook for monitoring sync activity
export const useSyncActivity = () => {
  const { syncStatus } = useSyncQueue();
  
  return {
    isActive: syncStatus.isActive,
    currentAction: syncStatus.currentAction,
    progress: syncStatus.totalPending > 0 
      ? ((syncStatus.successfulActions) / (syncStatus.successfulActions + syncStatus.totalPending)) * 100 
      : 100
  };
};

// Helper hook for getting pending counts by type
export const usePendingCounts = () => {
  const { user } = useAuth();
  const [counts, setCounts] = useState({
    quizAttempts: 0,
    moduleCompletions: 0,
    progressUpdates: 0,
    userDataUpdates: 0,
    total: 0
  });

  useEffect(() => {
    const updateCounts = async () => {
      if (!user?.id) return;

      try {
        const pendingActions = await offlineStorage.getSyncQueue(user.id);
        
        const newCounts = {
          quizAttempts: pendingActions.filter(a => a.type === 'quiz_attempt').length,
          moduleCompletions: pendingActions.filter(a => a.type === 'module_completion').length,
          progressUpdates: pendingActions.filter(a => a.type === 'course_progress').length,
          userDataUpdates: pendingActions.filter(a => a.type === 'user_data' || a.type === 'profile_update').length,
          total: pendingActions.length
        };

        setCounts(newCounts);
      } catch (error) {
        console.error('Failed to get pending counts:', error);
      }
    };

    updateCounts();
    
    // Update every 30 seconds
    const interval = setInterval(updateCounts, 30000);
    return () => clearInterval(interval);
  }, [user?.id]);

  return counts;
};

// Hook for offline quiz functionality
export const useOfflineQuiz = (courseId: string, quizId: string) => {
  const { queueQuizAttempt } = useSyncQueue();
  const { user } = useAuth();
  const [attempts, setAttempts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load previous attempts
  useEffect(() => {
    const loadAttempts = async () => {
      if (!user?.id) return;

      try {
        const storedAttempts = await offlineStorage.getQuizAttempts(user.id, courseId, quizId);
        setAttempts(storedAttempts);
      } catch (error) {
        console.error('Failed to load quiz attempts:', error);
      }
    };

    loadAttempts();
  }, [user?.id, courseId, quizId]);

  // Submit quiz attempt
  const submitAttempt = useCallback(async (
    moduleId: string,
    sectionId: string,
    answers: Record<string, any>,
    timeSpent: number
  ): Promise<string> => {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    setIsLoading(true);
    
    try {
      const attemptId = await queueQuizAttempt(
        courseId,
        quizId,
        moduleId,
        sectionId,
        answers,
        timeSpent
      );

      // Reload attempts to include the new one
      const updatedAttempts = await offlineStorage.getQuizAttempts(user.id, courseId, quizId);
      setAttempts(updatedAttempts);

      return attemptId;
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, courseId, quizId, queueQuizAttempt]);

  // Get best attempt
  const getBestAttempt = useCallback(() => {
    if (attempts.length === 0) return null;
    
    return attempts.reduce((best, current) => {
      return current.percentage > (best?.percentage || 0) ? current : best;
    }, null);
  }, [attempts]);

  // Get attempt count
  const getAttemptCount = useCallback(() => {
    return attempts.length;
  }, [attempts]);

  // Check if quiz is passed
  const isPassed = useCallback((passingScore: number = 70) => {
    const bestAttempt = getBestAttempt();
    return bestAttempt ? bestAttempt.percentage >= passingScore : false;
  }, [getBestAttempt]);

  return {
    attempts,
    isLoading,
    submitAttempt,
    getBestAttempt,
    getAttemptCount,
    isPassed
  };
}; 