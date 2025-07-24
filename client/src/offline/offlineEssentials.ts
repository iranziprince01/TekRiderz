import { localDB } from './db';
import { saveProgress, getProgress, getCourseProgress } from './progressManager';
import { cacheModule, getCachedModule, updateCachedModule } from './cacheService';

// Essential offline functionality for demonstration

/**
 * Essential offline progress tracking
 * This ensures progress is properly saved even when offline
 */
export const saveOfflineProgress = async (
  userId: string,
  courseId: string,
  moduleId: string,
  progressData: {
    percentage: number;
    timeSpent: number;
    isCompleted: boolean;
    currentPosition?: number;
  }
): Promise<boolean> => {
  try {
    console.log('💾 Saving offline progress:', { courseId, moduleId, percentage: progressData.percentage });
    
    // Save progress to local database
    const success = await saveProgress({
      userId,
      courseId,
      lessonId: moduleId,
      moduleId,
      progress: {
        ...progressData,
        completedAt: progressData.isCompleted ? new Date().toISOString() : undefined,
        lastUpdated: new Date().toISOString(),
        interactions: [],
        notes: [],
        bookmarks: []
      },
      metadata: {
        courseTitle: 'Offline Course',
        lessonTitle: 'Offline Module',
        moduleTitle: 'Offline Module'
      }
    });

    if (success && progressData.isCompleted) {
      // Update module completion status in cache
      try {
        const cachedModule = await getCachedModule(moduleId);
        if (cachedModule) {
          const updatedModule = {
            ...cachedModule,
            isCompleted: true
          };
          await updateCachedModule(updatedModule);
          console.log('✅ Module marked as completed in offline cache:', moduleId);
        }
      } catch (cacheError) {
        console.warn('Failed to update module completion in cache:', cacheError);
      }
    }

    return success;
  } catch (error) {
    console.error('❌ Failed to save offline progress:', error);
    return false;
  }
};

/**
 * Essential offline module completion
 * Handles module completion in offline mode
 */
export const completeOfflineModule = async (
  userId: string,
  courseId: string,
  moduleId: string
): Promise<boolean> => {
  try {
    console.log('✅ Completing offline module:', moduleId);
    
    // Save completion progress
    const progressSaved = await saveOfflineProgress(userId, courseId, moduleId, {
      percentage: 100,
      timeSpent: 0,
      isCompleted: true
    });

    if (!progressSaved) {
      console.error('Failed to save module completion progress');
      return false;
    }

    // Update module in cache
    try {
      const cachedModule = await getCachedModule(moduleId);
      if (cachedModule) {
        const updatedModule = {
          ...cachedModule,
          isCompleted: true
        };
        await updateCachedModule(updatedModule);
        console.log('✅ Module completion saved to offline cache');
      }
    } catch (cacheError) {
      console.warn('Failed to update module in cache:', cacheError);
    }

    return true;
  } catch (error) {
    console.error('❌ Failed to complete offline module:', error);
    return false;
  }
};

/**
 * Essential offline status detection
 * More robust offline detection for demonstration
 */
export const getEssentialOfflineStatus = (): {
  isOffline: boolean;
  hasLocalData: boolean;
  canAccessCourses: boolean;
  lastSync: string | null;
} => {
  const isOffline = !navigator.onLine;
  const hasLocalData = localStorage.getItem('currentUserId') !== null;
  const lastSync = localStorage.getItem('lastSync');
  
  return {
    isOffline,
    hasLocalData,
    canAccessCourses: isOffline && hasLocalData,
    lastSync: lastSync ? new Date(lastSync).toLocaleString() : null
  };
};

/**
 * Essential offline error recovery
 * Handles common offline errors gracefully
 */
export const handleOfflineError = (error: any, context: string): {
  canRecover: boolean;
  message: string;
  action?: string;
} => {
  console.error(`Offline error in ${context}:`, error);

  // Network errors
  if (error.name === 'NetworkError' || error.message?.includes('network')) {
    return {
      canRecover: true,
      message: 'Network connection lost. Working in offline mode.',
      action: 'continue_offline'
    };
  }

  // Database errors
  if (error.name === 'QuotaExceededError' || error.message?.includes('quota')) {
    return {
      canRecover: false,
      message: 'Storage quota exceeded. Please clear some data.',
      action: 'clear_storage'
    };
  }

  // Cache errors
  if (error.name === 'NotFoundError' || error.message?.includes('not found')) {
    return {
      canRecover: true,
      message: 'Some cached data is missing. Loading available content.',
      action: 'load_available'
    };
  }

  // Generic offline error
  return {
    canRecover: true,
    message: 'Working in offline mode with limited functionality.',
    action: 'continue_offline'
  };
};

/**
 * Essential offline data validation
 * Validates that essential offline data is available
 */
export const validateOfflineData = async (): Promise<{
  isValid: boolean;
  issues: string[];
  canProceed: boolean;
}> => {
  const issues: string[] = [];
  let canProceed = true;

  try {
    // Check if user is cached
    const userId = localStorage.getItem('currentUserId');
    if (!userId) {
      issues.push('No cached user found');
      canProceed = false;
    }

    // Check if courses are cached
    if (localDB) {
      try {
        const result = await localDB.allDocs({
          include_docs: true,
          startkey: 'course_',
          endkey: 'course_\ufff0'
        });
        
        if (result.rows.length === 0) {
          issues.push('No cached courses found');
          canProceed = false;
        }
      } catch (error) {
        issues.push('Failed to check cached courses');
        canProceed = false;
      }
    } else {
      issues.push('Local database not available');
      canProceed = false;
    }

    return {
      isValid: issues.length === 0,
      issues,
      canProceed
    };
  } catch (error) {
    console.error('Failed to validate offline data:', error);
    return {
      isValid: false,
      issues: ['Failed to validate offline data'],
      canProceed: false
    };
  }
};

/**
 * Essential offline initialization
 * Ensures offline functionality is ready for demonstration
 */
export const initializeOfflineEssentials = async (): Promise<{
  success: boolean;
  message: string;
  offlineReady: boolean;
}> => {
  try {
    console.log('🔧 Initializing offline essentials...');
    
    // Validate offline data
    const validation = await validateOfflineData();
    
    if (!validation.canProceed) {
      return {
        success: false,
        message: `Offline mode not ready: ${validation.issues.join(', ')}`,
        offlineReady: false
      };
    }

    // Set last sync timestamp
    localStorage.setItem('lastSync', new Date().toISOString());
    
    console.log('✅ Offline essentials initialized successfully');
    
    return {
      success: true,
      message: 'Offline mode ready for demonstration',
      offlineReady: true
    };
  } catch (error) {
    console.error('❌ Failed to initialize offline essentials:', error);
    return {
      success: false,
      message: 'Failed to initialize offline mode',
      offlineReady: false
    };
  }
};

/**
 * Essential offline cleanup
 * Cleans up offline data when needed
 */
export const cleanupOfflineEssentials = async (): Promise<void> => {
  try {
    console.log('🧹 Cleaning up offline essentials...');
    
    // Clear sync timestamp
    localStorage.removeItem('lastSync');
    
    console.log('✅ Offline essentials cleaned up');
  } catch (error) {
    console.error('❌ Failed to cleanup offline essentials:', error);
  }
}; 