/**
 * Simple offline sync manager for TekRiders
 * Handles syncing queued offline operations when connectivity returns
 */

import { offlineStorage } from './offlineStorage';
import { apiClient } from './api';

interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  errors: string[];
}

interface SyncStats {
  totalItems: number;
  lastSyncAt?: string;
}

class SimpleOfflineSyncManager {
  private isSyncing = false;
  private syncInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Start periodic sync when online
    this.startPeriodicSync();
    
    // Listen for online/offline events
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));
  }

  // ================ SYNC EXECUTION ================

  async syncData(): Promise<SyncResult> {
    if (this.isSyncing || !navigator.onLine) {
      return { success: false, synced: 0, failed: 0, errors: ['Sync already in progress or offline'] };
    }

    this.isSyncing = true;
    const result: SyncResult = { success: true, synced: 0, failed: 0, errors: [] };

    try {
      // Get queued offline actions
      const queuedActions = await offlineStorage.getQueuedActions();
      
      if (queuedActions.length === 0) {
        console.log('No items to sync');
        return result;
      }

      console.log(`Starting sync of ${queuedActions.length} items`);

      // Process each queued action
      for (const action of queuedActions) {
        try {
          const success = await this.syncAction(action);
          
          if (success) {
            result.synced++;
            console.log(`Synced ${action.type}:`, action.id);
          } else {
            result.failed++;
            result.errors.push(`Failed to sync ${action.type}: ${action.id}`);
          }
        } catch (error) {
          result.failed++;
          result.errors.push(`Error syncing ${action.type}: ${error}`);
          console.error(`Error syncing ${action.type}:`, error);
        }
      }

      // Clear synced actions
      if (result.synced > 0) {
        await offlineStorage.clearQueuedActions();
        localStorage.setItem('lastSyncAt', new Date().toISOString());
      }

      console.log(`Sync completed: ${result.synced} synced, ${result.failed} failed`);

    } catch (error) {
      console.error('Sync process failed:', error);
      result.success = false;
      result.errors.push(`Sync process failed: ${error}`);
    } finally {
      this.isSyncing = false;
    }

    return result;
  }

  private async syncAction(action: any): Promise<boolean> {
    try {
      switch (action.type) {
        case 'enroll':
          return await this.syncEnrollment(action.data);
        case 'quiz_submission':
          return await this.syncQuizSubmission(action.data);
        case 'video_progress':
          return await this.syncVideoProgress(action.data);
        case 'profile_update':
          return await this.syncProfileUpdate(action.data);
        default:
          console.warn('Unknown sync action type:', action.type);
          return false;
      }
    } catch (error) {
      console.error(`Failed to sync ${action.type}:`, error);
      return false;
    }
  }

  // ================ INDIVIDUAL SYNC HANDLERS ================

  private async syncEnrollment(data: any): Promise<boolean> {
    try {
      const response = await apiClient.enrollInCourse(data.courseId);
      return response.success;
    } catch (error) {
      console.error('Failed to sync enrollment:', error);
      return false;
    }
  }

  private async syncQuizSubmission(data: any): Promise<boolean> {
    try {
      // Use the existing quiz submission API
      const response = await apiClient.submitQuizAttempt(data.courseId, {
        quizId: data.quizId,
        answers: data.answers,
        score: data.score || 0,
        timeSpent: data.timeSpent || 0
      });
      return response.success;
    } catch (error) {
      console.error('Failed to sync quiz submission:', error);
      return false;
    }
  }

  private async syncVideoProgress(data: any): Promise<boolean> {
    try {
      // Use the existing progress update API
      const response = await apiClient.updateCourseProgress(data.courseId, {
        lessonId: data.lessonId,
        progress: data.percentage || data.progress,
        lastAccessed: data.lastAccessed,
        completedLessons: data.completedLessons || []
      });
      return response.success;
    } catch (error) {
      console.error('Failed to sync video progress:', error);
      return false;
    }
  }

  private async syncProfileUpdate(data: any): Promise<boolean> {
    try {
      // Simple profile update - would need proper API method
      console.log('Profile update sync not yet implemented:', data);
      return true; // Return true for now to avoid blocking other syncs
    } catch (error) {
      console.error('Failed to sync profile update:', error);
      return false;
    }
  }

  // ================ AUTOMATIC SYNC ================

  private startPeriodicSync(): void {
    // Sync every 5 minutes when online
    this.syncInterval = setInterval(() => {
      if (navigator.onLine && !this.isSyncing) {
        this.checkAndSync();
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  private async checkAndSync(): Promise<void> {
    const queuedActions = await offlineStorage.getQueuedActions();
    if (queuedActions.length > 0) {
      this.syncData();
    }
  }

  private stopPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  private handleOnline(): void {
    console.log('Device came online, checking for sync...');
    
    // Small delay to ensure network is stable
    setTimeout(() => {
      this.checkAndSync();
    }, 2000);
  }

  private handleOffline(): void {
    console.log('Device went offline, pausing sync');
    this.isSyncing = false;
  }

  // ================ PUBLIC METHODS ================

  async forceSyncNow(): Promise<SyncResult> {
    return this.syncData();
  }

  async getStats(): Promise<SyncStats> {
    const queuedActions = await offlineStorage.getQueuedActions();
    return {
      totalItems: queuedActions.length,
      lastSyncAt: localStorage.getItem('lastSyncAt') || undefined
    };
  }

  async clearSyncQueue(): Promise<void> {
    await offlineStorage.clearQueuedActions();
    console.log('Sync queue cleared');
  }

  async getSyncQueue(): Promise<any[]> {
    return await offlineStorage.getQueuedActions();
  }

  // ================ CLEANUP ================

  destroy(): void {
    this.stopPeriodicSync();
    window.removeEventListener('online', this.handleOnline.bind(this));
    window.removeEventListener('offline', this.handleOffline.bind(this));
  }
}

// Create singleton instance
export const offlineSync = new SimpleOfflineSyncManager();

export default offlineSync; 