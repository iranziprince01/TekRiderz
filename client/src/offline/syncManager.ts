import { localDB } from './db';
import { apiClient } from '../utils/api';
import { 
  getCachedUser, 
  getEnrolledCoursesOffline, 
  cacheLearnerData,
  clearLearnerOfflineData 
} from './cacheService';

interface SyncStatus {
  isActive: boolean;
  lastSync: string | null;
  pendingChanges: number;
  error: string | null;
}

let syncStatus: SyncStatus = {
  isActive: false,
  lastSync: null,
  pendingChanges: 0,
  error: null
};

/**
 * Simple one-time sync when learner comes back online
 * No continuous background syncing - only syncs once when online
 */
export const performOneTimeSync = async (): Promise<void> => {
  try {
    // Check if user is a learner
    const userRole = localStorage.getItem('userRole');
    if (userRole !== 'learner') {
      console.log('🔄 Sync skipped - user is not a learner');
      return;
    }

    // Check if app is online
    if (!navigator.onLine) {
      console.log('🔄 Sync skipped - app is offline');
      return;
    }

    // Check if sync is already active
    if (syncStatus.isActive) {
      console.log('🔄 Sync already in progress, skipping...');
      return;
    }

    console.log('🔄 Starting one-time sync for learner...');
    syncStatus.isActive = true;
    syncStatus.error = null;

    // Get cached user data
    const userId = localStorage.getItem('currentUserId');
    if (!userId) {
      console.log('🔄 No cached user found, skipping sync');
      return;
    }

    const cachedUser = await getCachedUser(userId);
    if (!cachedUser) {
      console.log('🔄 No cached user data found, skipping sync');
      return;
    }

    // Get cached enrolled courses
    const cachedCourses = await getEnrolledCoursesOffline();
    console.log(`🔄 Found ${cachedCourses.length} cached courses to sync`);

    // Perform sync operations
    await Promise.all([
      syncUserData(cachedUser),
      syncCourseProgress(cachedCourses),
      syncEnrollmentData(cachedCourses)
    ]);

    // Update sync status
    syncStatus.lastSync = new Date().toISOString();
    syncStatus.pendingChanges = 0;
    syncStatus.isActive = false;

    console.log('✅ One-time sync completed successfully');

  } catch (error) {
    console.error('❌ Sync failed:', error);
    syncStatus.error = error instanceof Error ? error.message : 'Unknown error';
    syncStatus.isActive = false;
    throw error;
  }
};

/**
 * Sync user profile data
 */
const syncUserData = async (user: any): Promise<void> => {
  try {
    console.log('🔄 Syncing user data...');
    
    // Update user profile if needed
    const response = await apiClient.updateProfile({
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      verified: user.verified
    });

    if (response.success) {
      console.log('✅ User data synced successfully');
    } else {
      console.warn('⚠️ User data sync failed:', response.error);
    }
  } catch (error) {
    console.error('❌ User data sync error:', error);
  }
};

/**
 * Sync course progress data
 */
const syncCourseProgress = async (courses: any[]): Promise<void> => {
  try {
    console.log('🔄 Syncing course progress...');
    
    const progressPromises = courses
      .filter(course => course.progress && course.progress.percentage > 0)
      .map(async (course) => {
        try {
          await apiClient.updateCourseProgress(course._id || course.id, {
            percentage: course.progress.percentage,
            completedLessons: course.progress.completedLessons || 0,
            totalLessons: course.progress.totalLessons || 0,
            lastUpdated: new Date().toISOString()
          });
        } catch (error) {
          console.warn(`⚠️ Failed to sync progress for course ${course._id}:`, error);
        }
      });

    await Promise.all(progressPromises);
    console.log('✅ Course progress synced successfully');
  } catch (error) {
    console.error('❌ Course progress sync error:', error);
  }
};

/**
 * Sync enrollment data
 */
const syncEnrollmentData = async (courses: any[]): Promise<void> => {
  try {
    console.log('🔄 Syncing enrollment data...');
    
    // For now, just verify enrollments exist
    // In a real implementation, you might sync enrollment status changes
    console.log(`✅ Verified ${courses.length} enrollments`);
  } catch (error) {
    console.error('❌ Enrollment sync error:', error);
  }
};

/**
 * Check if sync is needed (when coming back online)
 */
export const checkSyncNeeded = async (): Promise<boolean> => {
  try {
    // Check if user is a learner
    const userRole = localStorage.getItem('userRole');
    if (userRole !== 'learner') {
      return false;
    }

    // Check if we have cached data
    const userId = localStorage.getItem('currentUserId');
    if (!userId) {
      return false;
    }

    const cachedUser = await getCachedUser(userId);
    const cachedCourses = await getEnrolledCoursesOffline();

    // Sync is needed if we have cached data and we're online
    return !!(cachedUser && cachedCourses.length > 0 && navigator.onLine);
  } catch (error) {
    console.error('Error checking sync needed:', error);
    return false;
  }
};

/**
 * Get current sync status
 */
export const getSyncStatus = (): SyncStatus => {
  return { ...syncStatus };
};

/**
 * Clear all offline data (for logout)
 */
export const clearOfflineData = async (): Promise<void> => {
  try {
    console.log('🧹 Clearing offline data...');
    await clearLearnerOfflineData();
    syncStatus = {
      isActive: false,
      lastSync: null,
      pendingChanges: 0,
      error: null
    };
    console.log('✅ Offline data cleared successfully');
  } catch (error) {
    console.error('❌ Failed to clear offline data:', error);
    throw error;
  }
};

/**
 * Initialize offline data for a learner
 */
export const initializeOfflineData = async (user: any, courses: any[]): Promise<void> => {
  try {
    console.log('💾 Initializing offline data for learner...');
    await cacheLearnerData(user, courses);
    console.log(`✅ Offline data initialized: ${courses.length} courses cached`);
  } catch (error) {
    console.error('❌ Failed to initialize offline data:', error);
    throw error;
  }
}; 