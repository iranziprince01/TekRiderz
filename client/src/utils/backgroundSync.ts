// Background Sync System for TekRiders
// Handles syncing offline actions, progress, and data when connectivity returns

import { 
  getOfflineActions, 
  removeOfflineAction, 
  updateOfflineAction,
  getUnsyncedProgress,
  saveProgress,
  getAllCourses,
  saveCourse,
  getCurrentUser,
  saveUserData
} from './indexedDB';
import type { OfflineAction, ProgressData, CourseData, UserData } from './indexedDB';
import { apiClient } from './api';

// Types for sync operations
export interface SyncResult {
  success: boolean;
  syncedActions: number;
  failedActions: number;
  syncedProgress: number;
  failedProgress: number;
  errors: string[];
  duration: number;
}

export interface SyncOptions {
  maxRetries: number;
  batchSize: number;
  priorityOrder: boolean;
  includeProgress: boolean;
  includeActions: boolean;
  timeout: number;
}

export interface SyncEventHandlers {
  onSyncStart?: () => void;
  onSyncComplete?: (result: SyncResult) => void;
  onSyncProgress?: (progress: number, total: number) => void;
  onSyncError?: (error: string) => void;
}

// Default sync options
const DEFAULT_SYNC_OPTIONS: SyncOptions = {
  maxRetries: 3,
  batchSize: 10,
  priorityOrder: true,
  includeProgress: true,
  includeActions: true,
  timeout: 30000 // 30 seconds
};

// Sync state management
let isSyncing = false;
let lastSyncTime = 0;
let syncHandlers: SyncEventHandlers = {};

// Initialize background sync
export function initBackgroundSync(handlers: SyncEventHandlers = {}): void {
  syncHandlers = handlers;
  
  // Listen for online events
  window.addEventListener('online', handleNetworkOnline);
  
  // Register for background sync if supported
  if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
    navigator.serviceWorker.ready.then(registration => {
      // Register background sync
      return registration.sync.register('background-sync');
    }).catch(error => {
      console.error('Failed to register background sync:', error);
    });
  }

  console.log('Background sync initialized');
}

// Handle network coming online
async function handleNetworkOnline(): Promise<void> {
  console.log('Network detected, starting sync...');
  
  // Wait a bit for connection to stabilize
  setTimeout(() => {
    performFullSync();
  }, 2000);
}

// Perform full synchronization
export async function performFullSync(
  options: Partial<SyncOptions> = {}
): Promise<SyncResult> {
  if (isSyncing) {
    console.log('Sync already in progress');
    return createEmptySyncResult();
  }

  const syncOptions = { ...DEFAULT_SYNC_OPTIONS, ...options };
  const startTime = Date.now();
  
  isSyncing = true;
  syncHandlers.onSyncStart?.();

  const result: SyncResult = {
    success: false,
    syncedActions: 0,
    failedActions: 0,
    syncedProgress: 0,
    failedProgress: 0,
    errors: [],
    duration: 0
  };

  try {
    console.log('Starting full sync...');

    // Sync in priority order
    if (syncOptions.includeActions) {
      const actionResult = await syncOfflineActions(syncOptions);
      result.syncedActions = actionResult.synced;
      result.failedActions = actionResult.failed;
      result.errors.push(...actionResult.errors);
    }

    if (syncOptions.includeProgress) {
      const progressResult = await syncProgress(syncOptions);
      result.syncedProgress = progressResult.synced;
      result.failedProgress = progressResult.failed;
      result.errors.push(...progressResult.errors);
    }

    // Sync user data
    await syncUserData();

    // Sync course data
    await syncCourseData();

    result.success = result.errors.length === 0;
    result.duration = Date.now() - startTime;
    lastSyncTime = Date.now();

    console.log('Sync completed:', result);
    syncHandlers.onSyncComplete?.(result);

  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : 'Unknown sync error');
    result.duration = Date.now() - startTime;
    console.error('Sync failed:', error);
    syncHandlers.onSyncError?.(result.errors.join(', '));
  } finally {
    isSyncing = false;
  }

  return result;
}

// Sync offline actions
async function syncOfflineActions(options: SyncOptions): Promise<{
  synced: number;
  failed: number;
  errors: string[];
}> {
  const result = { synced: 0, failed: 0, errors: [] };

  try {
    let actions = await getOfflineActions();
    
    // Sort by priority if enabled
    if (options.priorityOrder) {
      actions = actions.sort((a, b) => a.priority - b.priority);
    }

    // Process in batches
    for (let i = 0; i < actions.length; i += options.batchSize) {
      const batch = actions.slice(i, i + options.batchSize);
      
      for (const action of batch) {
        try {
          const success = await syncSingleAction(action, options);
          
          if (success) {
            await removeOfflineAction(action.id);
            result.synced++;
          } else {
            result.failed++;
            
            // Update retry count
            const updatedAction = {
              ...action,
              retryCount: action.retryCount + 1
            };

            if (updatedAction.retryCount >= updatedAction.maxRetries) {
              await removeOfflineAction(action.id);
              result.errors.push(`Action ${action.id} exceeded max retries`);
            } else {
              await updateOfflineAction(updatedAction);
            }
          }
        } catch (error) {
          result.failed++;
          result.errors.push(`Action ${action.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        // Update progress
        syncHandlers.onSyncProgress?.(i + batch.indexOf(action) + 1, actions.length);
      }
    }
  } catch (error) {
    result.errors.push(`Failed to sync actions: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return result;
}

// Sync single action
async function syncSingleAction(action: OfflineAction, options: SyncOptions): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout);

    const response = await fetch(action.endpoint, {
      method: action.method,
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(action.data),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    console.error(`Failed to sync action ${action.id}:`, error);
    return false;
  }
}

// Sync progress data
async function syncProgress(options: SyncOptions): Promise<{
  synced: number;
  failed: number;
  errors: string[];
}> {
  const result = { synced: 0, failed: 0, errors: [] };

  try {
    const unsyncedProgress = await getUnsyncedProgress();
    
    for (const progress of unsyncedProgress) {
      try {
        const success = await syncSingleProgress(progress, options);
        
        if (success) {
          // Mark as synced
          const syncedProgress = { ...progress, synced: true };
          await saveProgress(syncedProgress);
          result.synced++;
        } else {
          result.failed++;
        }
      } catch (error) {
        result.failed++;
        result.errors.push(`Progress ${progress.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  } catch (error) {
    result.errors.push(`Failed to sync progress: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return result;
}

// Sync single progress entry
async function syncSingleProgress(progress: ProgressData, options: SyncOptions): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout);

    const response = await fetch(`/api/courses/${progress.courseId}/progress`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify({
        moduleId: progress.moduleId,
        progress: progress.progress,
        timeSpent: progress.timeSpent,
        lastPosition: progress.lastPosition,
        completed: progress.completed,
        quizAnswers: progress.quizAnswers,
        timestamp: progress.timestamp
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    console.error(`Failed to sync progress ${progress.id}:`, error);
    return false;
  }
}

// Sync user data
async function syncUserData(): Promise<void> {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return;

    // Fetch latest user data from server
    const response = await apiClient.get('/auth/me');
    if (response.data) {
      const updatedUser: UserData = {
        ...currentUser,
        name: response.data.name,
        email: response.data.email,
        avatar: response.data.avatar,
        role: response.data.role,
        lastSync: Date.now()
      };

      await saveUserData(updatedUser);
      console.log('User data synced');
    }
  } catch (error) {
    console.error('Failed to sync user data:', error);
  }
}

// Sync course data
async function syncCourseData(): Promise<void> {
  try {
    const localCourses = await getAllCourses();
    
    for (const course of localCourses) {
      try {
        // Fetch latest course data
        const response = await apiClient.get(`/courses/${course.id}`);
        if (response.data) {
          const updatedCourse: CourseData = {
            ...course,
            title: response.data.title,
            description: response.data.description,
            instructor: response.data.instructor,
            lastAccessed: course.lastAccessed, // Keep local access time
            cachedAt: course.cachedAt // Keep cache time
          };

          await saveCourse(updatedCourse);
        }
      } catch (error) {
        console.error(`Failed to sync course ${course.id}:`, error);
      }
    }

    console.log('Course data synced');
  } catch (error) {
    console.error('Failed to sync course data:', error);
  }
}

// Get auth headers for API calls
function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Request immediate sync
export async function requestImmediateSync(): Promise<SyncResult> {
  if (!navigator.onLine) {
    throw new Error('Cannot sync while offline');
  }

  return performFullSync();
}

// Queue sync for later (when back online)
export function queueSyncForLater(): void {
  if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
    navigator.serviceWorker.ready.then(registration => {
      return registration.sync.register('queued-sync');
    }).catch(error => {
      console.error('Failed to queue sync:', error);
    });
  } else {
    // Fallback: check periodically for network
    const checkInterval = setInterval(() => {
      if (navigator.onLine) {
        clearInterval(checkInterval);
        performFullSync();
      }
    }, 30000); // Check every 30 seconds
  }
}

// Get sync status
export function getSyncStatus(): {
  isSyncing: boolean;
  lastSyncTime: number;
  timeSinceLastSync: number;
} {
  return {
    isSyncing,
    lastSyncTime,
    timeSinceLastSync: Date.now() - lastSyncTime
  };
}

// Check if sync is needed
export async function isSyncNeeded(): Promise<boolean> {
  try {
    const [actions, progress] = await Promise.all([
      getOfflineActions(),
      getUnsyncedProgress()
    ]);

    return actions.length > 0 || progress.length > 0;
  } catch (error) {
    console.error('Failed to check if sync is needed:', error);
    return false;
  }
}

// Force sync reset (clear all pending items)
export async function forceSyncReset(): Promise<void> {
  try {
    const actions = await getOfflineActions();
    for (const action of actions) {
      await removeOfflineAction(action.id);
    }

    const progress = await getUnsyncedProgress();
    for (const prog of progress) {
      const syncedProgress = { ...prog, synced: true };
      await saveProgress(syncedProgress);
    }

    console.log('Sync queue reset');
  } catch (error) {
    console.error('Failed to reset sync queue:', error);
  }
}

// Cleanup old sync data
export async function cleanupSyncData(olderThanDays: number = 7): Promise<void> {
  try {
    const cutoff = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
    const actions = await getOfflineActions();
    
    for (const action of actions) {
      if (action.timestamp < cutoff) {
        await removeOfflineAction(action.id);
      }
    }

    console.log('Old sync data cleaned up');
  } catch (error) {
    console.error('Failed to cleanup sync data:', error);
  }
}

// Create empty sync result
function createEmptySyncResult(): SyncResult {
  return {
    success: false,
    syncedActions: 0,
    failedActions: 0,
    syncedProgress: 0,
    failedProgress: 0,
    errors: ['Sync already in progress'],
    duration: 0
  };
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  window.removeEventListener('online', handleNetworkOnline);
});

// Export default initialization
export default initBackgroundSync; 