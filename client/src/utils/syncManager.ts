// Comprehensive sync manager for offline-first functionality

import { offlineStorage, OfflineAction, QuizAttempt, OfflineProgress } from './offlineStorage';
import { apiClient } from './api';

export interface SyncResult {
  success: boolean;
  actionId: string;
  error?: string;
  conflictResolution?: 'client_wins' | 'server_wins' | 'merge' | 'manual_required';
}

export interface SyncStatus {
  isActive: boolean;
  totalPending: number;
  currentAction?: string;
  lastSyncAt?: number;
  failedActions: number;
  successfulActions: number;
}

export interface ConflictData {
  actionId: string;
  clientData: any;
  serverData: any;
  conflictType: 'quiz_attempt' | 'progress' | 'profile';
  timestamp: number;
}

class SyncManager {
  private isRunning = false;
  private syncInterval: number | null = null;
  private backgroundSyncRegistration: ServiceWorkerRegistration | null = null;
  private retryDelays = [1000, 5000, 15000, 60000, 300000]; // Exponential backoff: 1s, 5s, 15s, 1m, 5m
  private maxRetryDelay = 300000; // 5 minutes
  private conflicts: ConflictData[] = [];
  private syncListeners: Array<(status: SyncStatus) => void> = [];

  constructor() {
    this.registerBackgroundSync();
    this.setupNetworkListeners();
  }

  // Initialize background sync if available
  private async registerBackgroundSync(): Promise<void> {
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      try {
        const registration = await navigator.serviceWorker.ready;
        this.backgroundSyncRegistration = registration;
        console.log('Background sync registered');
      } catch (error) {
        console.warn('Background sync not available:', error);
      }
    }
  }

  // Setup network listeners
  private setupNetworkListeners(): void {
    window.addEventListener('online', () => {
      console.log('Network connection restored, starting sync...');
      this.startPeriodicSync();
    });

    window.addEventListener('offline', () => {
      console.log('📡 Network connection lost, stopping sync...');
      this.stopPeriodicSync();
    });

    // Start sync if already online
    if (navigator.onLine) {
      this.startPeriodicSync();
    }
  }

  // Add sync status listener
  addSyncListener(listener: (status: SyncStatus) => void): () => void {
    this.syncListeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.syncListeners.indexOf(listener);
      if (index > -1) {
        this.syncListeners.splice(index, 1);
      }
    };
  }

  // Notify all listeners of sync status changes
  private notifyListeners(status: SyncStatus): void {
    this.syncListeners.forEach(listener => {
      try {
        listener(status);
      } catch (error) {
        console.error('Error in sync listener:', error);
      }
    });
  }

  // Start periodic sync
  startPeriodicSync(interval: number = 30000): void { // Every 30 seconds
    if (this.syncInterval) {
      this.stopPeriodicSync();
    }

    this.syncInterval = window.setInterval(() => {
      if (navigator.onLine && !this.isRunning) {
        this.syncAll();
      }
    }, interval);

    // Immediate sync
    if (navigator.onLine && !this.isRunning) {
      this.syncAll();
    }
  }

  // Stop periodic sync
  stopPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  // Queue quiz attempt for sync
  async queueQuizAttempt(
    userId: string,
    courseId: string,
    quizId: string,
    moduleId: string,
    sectionId: string,
    answers: Record<string, any>,
    timeSpent: number
  ): Promise<string> {
    const attemptId = `quiz_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Calculate score locally (basic validation)
    const score = this.calculateQuizScore(answers);
    
    const quizAttempt: QuizAttempt = {
      id: attemptId,
      userId,
      courseId,
      quizId,
      moduleId,
      sectionId,
      answers,
      score: score.points,
      maxScore: score.maxPoints,
      percentage: score.percentage,
      timeSpent,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      attemptNumber: await this.getNextAttemptNumber(userId, quizId),
      status: 'pending_sync',
      isOffline: true,
      syncRetryCount: 0
    };

    // Store the attempt
    await offlineStorage.storeQuizAttempt(quizAttempt);

    // Queue for sync
    await offlineStorage.addToSyncQueue({
      id: `quiz_attempt_${attemptId}`,
      type: 'quiz_attempt',
      data: quizAttempt,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: 5,
      userId,
      courseId,
      status: 'pending'
    });

    // Trigger immediate sync if online
    if (navigator.onLine) {
      this.syncAll();
    }

    // Use background sync if available
    if (this.backgroundSyncRegistration) {
      try {
        await this.backgroundSyncRegistration.sync.register('quiz-sync');
      } catch (error) {
        console.warn('Background sync registration failed:', error);
      }
    }

    return attemptId;
  }

  // Queue module completion for sync
  async queueModuleCompletion(
    userId: string,
    courseId: string,
    moduleId: string,
    sectionId: string,
    timeSpent: number,
    progress: number
  ): Promise<void> {
    const actionId = `module_completion_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await offlineStorage.addToSyncQueue({
      id: actionId,
      type: 'module_completion',
      data: {
        userId,
        courseId,
        moduleId,
        sectionId,
        timeSpent,
        progress,
        completedAt: new Date().toISOString()
      },
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: 3,
      userId,
      courseId,
      status: 'pending'
    });

    // Update local progress
    const existingProgress = await offlineStorage.getProgress(userId, courseId) || {
      id: `${userId}-${courseId}`,
      userId,
      courseId,
      completedLessons: [],
      completedSections: [],
      timeSpent: 0,
      overallProgress: 0,
      sectionProgress: {},
      lessonProgress: {},
      quizScores: {},
      assignments: {},
      lastSyncedAt: 0,
      lastModifiedAt: Date.now(),
      pendingChanges: true
    };

    // Update lesson progress
    if (!existingProgress.completedLessons.includes(moduleId)) {
      existingProgress.completedLessons.push(moduleId);
    }

    existingProgress.timeSpent += timeSpent;
    existingProgress.overallProgress = Math.max(existingProgress.overallProgress, progress);
    existingProgress.currentLesson = moduleId;
    existingProgress.currentSection = sectionId;
    existingProgress.lastWatched = new Date().toISOString();

    // Update lesson-specific progress
    existingProgress.lessonProgress[moduleId] = {
      startedAt: existingProgress.lessonProgress[moduleId]?.startedAt || new Date().toISOString(),
      completedAt: new Date().toISOString(),
      timeSpent: (existingProgress.lessonProgress[moduleId]?.timeSpent || 0) + timeSpent,
      interactions: existingProgress.lessonProgress[moduleId]?.interactions || [],
      notes: existingProgress.lessonProgress[moduleId]?.notes || [],
      bookmarks: existingProgress.lessonProgress[moduleId]?.bookmarks || []
    };

    await offlineStorage.storeProgress(existingProgress);

    if (navigator.onLine) {
      this.syncAll();
    }
  }

  // Queue course progress update
  async queueProgressUpdate(
    userId: string,
    courseId: string,
    progress: number,
    completedLessons: string[],
    timeSpent: number
  ): Promise<void> {
    const actionId = `progress_update_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await offlineStorage.addToSyncQueue({
      id: actionId,
      type: 'course_progress',
      data: {
        userId,
        courseId,
        progress,
        completedLessons,
        timeSpent,
        updatedAt: new Date().toISOString()
      },
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: 3,
      userId,
      courseId,
      status: 'pending'
    });

    if (navigator.onLine) {
      this.syncAll();
    }
  }

  // Sync all pending actions
  async syncAll(userId?: string): Promise<SyncResult[]> {
    if (this.isRunning) {
      console.log('Sync already running, skipping...');
      return [];
    }

    if (!navigator.onLine) {
      console.log('Offline, skipping sync...');
      return [];
    }

    this.isRunning = true;
    const results: SyncResult[] = [];

    try {
      // Get current user if not provided
      if (!userId) {
        // Try to get from auth context or storage
        const authData = localStorage.getItem('currentUser');
        if (authData) {
          const user = JSON.parse(authData);
          userId = user.id;
        }
      }

      if (!userId) {
        console.warn('No user ID available for sync');
        return results;
      }

      const pendingActions = await offlineStorage.getSyncQueue(userId);
      
      this.notifyListeners({
        isActive: true,
        totalPending: pendingActions.length,
        lastSyncAt: Date.now(),
        failedActions: 0,
        successfulActions: 0
      });

      console.log(`Starting sync of ${pendingActions.length} pending actions...`);

      let successCount = 0;
      let failCount = 0;

      for (const action of pendingActions) {
        try {
          this.notifyListeners({
            isActive: true,
            totalPending: pendingActions.length,
            currentAction: action.type,
            lastSyncAt: Date.now(),
            failedActions: failCount,
            successfulActions: successCount
          });

          const result = await this.syncAction(action);
          results.push(result);

          if (result.success) {
            successCount++;
            await offlineStorage.removeSyncAction(action.id);
            console.log(`Synced ${action.type} action successfully`);
          } else {
            failCount++;
            await this.handleSyncFailure(action, result.error || 'Unknown error');
          }
        } catch (error) {
          failCount++;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`❌ Failed to sync action ${action.id}:`, errorMessage);
          
          await this.handleSyncFailure(action, errorMessage);
          results.push({
            success: false,
            actionId: action.id,
            error: errorMessage
          });
        }
      }

      console.log(`✅ Sync completed: ${successCount} successful, ${failCount} failed`);

      this.notifyListeners({
        isActive: false,
        totalPending: failCount,
        lastSyncAt: Date.now(),
        failedActions: failCount,
        successfulActions: successCount
      });

    } catch (error) {
      console.error('❌ Sync process failed:', error);
      this.notifyListeners({
        isActive: false,
        totalPending: 0,
        lastSyncAt: Date.now(),
        failedActions: 0,
        successfulActions: 0
      });
    } finally {
      this.isRunning = false;
    }

    return results;
  }

  // Sync individual action
  private async syncAction(action: OfflineAction): Promise<SyncResult> {
    await offlineStorage.updateSyncAction(action.id, { status: 'syncing' });

    switch (action.type) {
      case 'quiz_attempt':
        return await this.syncQuizAttempt(action);
      case 'module_completion':
        return await this.syncModuleCompletion(action);
      case 'course_progress':
        return await this.syncCourseProgress(action);
      case 'user_data':
        return await this.syncUserData(action);
      case 'profile_update':
        return await this.syncProfileUpdate(action);
      default:
        return {
          success: false,
          actionId: action.id,
          error: `Unknown action type: ${action.type}`
        };
    }
  }

  // Sync quiz attempt
  private async syncQuizAttempt(action: OfflineAction): Promise<SyncResult> {
    const attempt = action.data as QuizAttempt;

    try {
      // Check for existing attempts to prevent duplicates
      const existingAttempts = await apiClient.getQuizAttempts(attempt.courseId, attempt.quizId);
      
      const duplicateAttempt = existingAttempts.data?.find((existing: any) => 
        existing.userId === attempt.userId &&
        existing.quizId === attempt.quizId &&
        Math.abs(new Date(existing.completedAt).getTime() - new Date(attempt.completedAt).getTime()) < 5000 // Within 5 seconds
      );

      if (duplicateAttempt) {
        console.log('Duplicate quiz attempt detected, skipping sync');
        
        // Update local attempt to mark as synced
        attempt.status = 'synced';
        attempt.submittedAt = duplicateAttempt.submittedAt;
        await offlineStorage.storeQuizAttempt(attempt);
        
        return {
          success: true,
          actionId: action.id,
          conflictResolution: 'server_wins'
        };
      }

      // Submit the quiz attempt
      const response = await apiClient.submitQuizAttempt(
        attempt.courseId,
        attempt.quizId,
        {
          answers: attempt.answers,
          timeSpent: attempt.timeSpent,
          completedAt: attempt.completedAt
        }
      );

      if (response.success) {
        // Update local attempt with server data
        attempt.status = 'synced';
        attempt.submittedAt = response.data.submittedAt;
        if (response.data.score !== undefined) {
          attempt.score = response.data.score;
          attempt.percentage = response.data.percentage;
        }
        
        await offlineStorage.storeQuizAttempt(attempt);

        return {
          success: true,
          actionId: action.id
        };
      } else {
        return {
          success: false,
          actionId: action.id,
          error: response.error || 'Quiz submission failed'
        };
      }
    } catch (error) {
      return {
        success: false,
        actionId: action.id,
        error: error instanceof Error ? error.message : 'Quiz sync failed'
      };
    }
  }

  // Sync module completion
  private async syncModuleCompletion(action: OfflineAction): Promise<SyncResult> {
    try {
      const { courseId, moduleId, timeSpent, progress } = action.data;

      const response = await apiClient.updateModuleProgress(courseId, moduleId, {
        completed: true,
        timeSpent,
        progress,
        completedAt: action.data.completedAt
      });

      if (response.success) {
        return {
          success: true,
          actionId: action.id
        };
      } else {
        return {
          success: false,
          actionId: action.id,
          error: response.error || 'Module completion sync failed'
        };
      }
    } catch (error) {
      return {
        success: false,
        actionId: action.id,
        error: error instanceof Error ? error.message : 'Module sync failed'
      };
    }
  }

  // Sync course progress
  private async syncCourseProgress(action: OfflineAction): Promise<SyncResult> {
    try {
      const { courseId, progress, completedLessons, timeSpent } = action.data;

      const response = await apiClient.updateCourseProgress(courseId, {
        progress,
        completedLessons,
        timeSpent,
        lastWatched: action.data.updatedAt
      });

      if (response.success) {
        // Update local progress sync status
        const localProgress = await offlineStorage.getProgress(action.userId, courseId);
        if (localProgress) {
          localProgress.lastSyncedAt = Date.now();
          localProgress.pendingChanges = false;
          await offlineStorage.storeProgress(localProgress);
        }

        return {
          success: true,
          actionId: action.id
        };
      } else {
        return {
          success: false,
          actionId: action.id,
          error: response.error || 'Progress sync failed'
        };
      }
    } catch (error) {
      return {
        success: false,
        actionId: action.id,
        error: error instanceof Error ? error.message : 'Progress sync failed'
      };
    }
  }

  // Sync user data
  private async syncUserData(action: OfflineAction): Promise<SyncResult> {
    try {
      const response = await apiClient.updateUser(action.data.userData);

      if (response.success) {
        return {
          success: true,
          actionId: action.id
        };
      } else {
        return {
          success: false,
          actionId: action.id,
          error: response.error || 'User data sync failed'
        };
      }
    } catch (error) {
      return {
        success: false,
        actionId: action.id,
        error: error instanceof Error ? error.message : 'User data sync failed'
      };
    }
  }

  // Sync profile update
  private async syncProfileUpdate(action: OfflineAction): Promise<SyncResult> {
    try {
      const response = await apiClient.updateProfile(action.data);

      if (response.success) {
        return {
          success: true,
          actionId: action.id
        };
      } else {
        return {
          success: false,
          actionId: action.id,
          error: response.error || 'Profile update sync failed'
        };
      }
    } catch (error) {
      return {
        success: false,
        actionId: action.id,
        error: error instanceof Error ? error.message : 'Profile sync failed'
      };
    }
  }

  // Handle sync failure with retry logic
  private async handleSyncFailure(action: OfflineAction, error: string): Promise<void> {
    const newRetryCount = action.retryCount + 1;
    
    if (newRetryCount >= action.maxRetries) {
      console.error(`❌ Action ${action.id} exceeded max retries (${action.maxRetries})`);
      await offlineStorage.updateSyncAction(action.id, {
        status: 'failed',
        retryCount: newRetryCount,
        errorMessage: error
      });
    } else {
      const delay = Math.min(
        this.retryDelays[newRetryCount - 1] || this.maxRetryDelay,
        this.maxRetryDelay
      );
      
      console.log(`⏰ Scheduling retry ${newRetryCount}/${action.maxRetries} for action ${action.id} in ${delay}ms`);
      
      await offlineStorage.updateSyncAction(action.id, {
        status: 'pending',
        retryCount: newRetryCount,
        lastRetryAt: Date.now(),
        errorMessage: error
      });

      // Schedule retry
      setTimeout(() => {
        if (navigator.onLine) {
          this.syncAll();
        }
      }, delay);
    }
  }

  // Calculate quiz score locally (basic implementation)
  private calculateQuizScore(answers: Record<string, any>): { points: number; maxPoints: number; percentage: number } {
    // This is a basic implementation - in a real app, you'd need the quiz questions to calculate properly
    const totalQuestions = Object.keys(answers).length;
    let correctAnswers = 0;

    // For now, assume all answers are correct (this would need proper question data)
    correctAnswers = totalQuestions;

    const percentage = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;

    return {
      points: correctAnswers,
      maxPoints: totalQuestions,
      percentage
    };
  }

  // Get next attempt number for a quiz
  private async getNextAttemptNumber(userId: string, quizId: string): Promise<number> {
    const attempts = await offlineStorage.getQuizAttempts(userId, undefined, quizId);
    return attempts.length + 1;
  }

  // Get sync status
  async getSyncStatus(userId: string): Promise<SyncStatus> {
    const pendingActions = await offlineStorage.getSyncQueue(userId);
    const failedActions = pendingActions.filter(action => action.status === 'failed');
    
    return {
      isActive: this.isRunning,
      totalPending: pendingActions.length,
      lastSyncAt: await offlineStorage.getSetting('lastSyncAt'),
      failedActions: failedActions.length,
      successfulActions: 0 // This would be tracked over time
    };
  }

  // Get conflicts
  getConflicts(): ConflictData[] {
    return [...this.conflicts];
  }

  // Resolve conflict
  async resolveConflict(
    conflictId: string, 
    resolution: 'client_wins' | 'server_wins' | 'merge'
  ): Promise<void> {
    const conflictIndex = this.conflicts.findIndex(c => c.actionId === conflictId);
    if (conflictIndex === -1) return;

    const conflict = this.conflicts[conflictIndex];
    
    // Remove from conflicts list
    this.conflicts.splice(conflictIndex, 1);

    // Apply resolution logic based on conflict type
    switch (resolution) {
      case 'client_wins':
        // Re-queue the action for sync
        await offlineStorage.addToSyncQueue({
          id: `resolved_${conflict.actionId}`,
          type: conflict.conflictType as any,
          data: conflict.clientData,
          timestamp: Date.now(),
          retryCount: 0,
          maxRetries: 3,
          userId: conflict.clientData.userId,
          status: 'pending'
        });
        break;
      
      case 'server_wins':
        // Discard local changes, update local data with server data
        // Implementation depends on data type
        break;
      
      case 'merge':
        // Implement merge logic based on data type
        // This would be highly specific to each data type
        break;
    }
  }

  // Force sync now
  async forceSyncNow(userId?: string): Promise<SyncResult[]> {
    if (!navigator.onLine) {
      throw new Error('Cannot sync while offline');
    }

    return await this.syncAll(userId);
  }

  // Clear all failed actions
  async clearFailedActions(userId: string): Promise<void> {
    const failedActions = await offlineStorage.getSyncQueue(userId);
    const failed = failedActions.filter(action => action.status === 'failed');
    
    for (const action of failed) {
      await offlineStorage.removeSyncAction(action.id);
    }
  }
}

// Create singleton instance
export const syncManager = new SyncManager();

// Export for use in service worker if needed
if (typeof window !== 'undefined') {
  (window as any).syncManager = syncManager;
} 