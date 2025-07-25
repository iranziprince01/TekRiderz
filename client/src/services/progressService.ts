import { 
  getCourseProgress as getOfflineProgress, 
  saveProgress as saveOfflineProgress,
  type CourseProgress as OfflineCourseProgress
} from '../offline/progressManager';
import { 
  getCourseProgress, 
  markLessonComplete, 
  updateLessonProgress 
} from '../utils/api';
import { useAuth } from '../contexts/AuthContext';

export interface UnifiedProgress {
  courseId: string;
  totalLessons: number;
  completedLessons: number;
  overallProgress: number;
  lastActivity: string;
  lessons: {
    [lessonId: string]: {
      percentage: number;
      timeSpent: number;
      isCompleted: boolean;
      completedAt?: string;
      lastUpdated: string;
    };
  };
}

class ProgressService {
  private static instance: ProgressService;
  private syncQueue: Map<string, Promise<any>> = new Map();

  static getInstance(): ProgressService {
    if (!ProgressService.instance) {
      ProgressService.instance = new ProgressService();
    }
    return ProgressService.instance;
  }

  /**
   * Get unified progress for a course, combining offline and online data with validation
   */
  async getUnifiedProgress(userId: string, courseId: string): Promise<UnifiedProgress | null> {
    try {
      console.log('🔄 Fetching unified progress for:', { userId, courseId });
      
      // Get offline progress first
      const offlineProgress = await getOfflineProgress(userId, courseId);
      console.log('📱 Offline progress:', offlineProgress);
      
      // Get online progress
      let onlineProgress = null;
      try {
        const response = await getCourseProgress(courseId);
        if (response.success && response.data) {
          onlineProgress = response.data;
          console.log('🌐 Online progress:', onlineProgress);
        }
      } catch (error) {
        console.warn('⚠️ Failed to fetch online progress, using offline only:', error);
      }

      // Merge progress data with validation
      const mergedProgress = this.mergeProgress(offlineProgress, onlineProgress, courseId);
      console.log('✅ Merged progress:', mergedProgress);
      
      return mergedProgress;
    } catch (error) {
      console.error('❌ Failed to get unified progress:', error);
      return null;
    }
  }

  /**
   * Mark a lesson as complete with robust error handling and data consistency
   */
  async markLessonComplete(userId: string, courseId: string, lessonId: string, timeSpent: number = 0): Promise<boolean> {
    const operationKey = `${courseId}_${lessonId}_complete`;
    
    // Prevent duplicate operations
    if (this.syncQueue.has(operationKey)) {
      console.log('⏳ Operation already in progress, waiting...');
      await this.syncQueue.get(operationKey);
      return true;
    }

    const operation = this.performMarkComplete(userId, courseId, lessonId, timeSpent);
    this.syncQueue.set(operationKey, operation);
    
    try {
      const result = await operation;
      return result;
    } finally {
      this.syncQueue.delete(operationKey);
    }
  }

  private async performMarkComplete(userId: string, courseId: string, lessonId: string, timeSpent: number): Promise<boolean> {
    try {
      console.log('🎯 Marking lesson complete:', { userId, courseId, lessonId, timeSpent });
      
      const completedAt = new Date().toISOString();
      const progressData = {
        percentage: 100,
        timeSpent,
        isCompleted: true,
        completedAt,
        lastUpdated: completedAt
      };
      
      // Step 1: Save to offline storage first (immediate)
      const offlineSuccess = await saveOfflineProgress({
        userId,
        courseId,
        lessonId,
        progress: progressData
      });
      
      console.log('📱 Offline save result:', offlineSuccess);
      
      // Step 2: Save to online storage (with retry)
      let onlineSuccess = false;
      let retryCount = 0;
      const maxRetries = 3;
      
      while (!onlineSuccess && retryCount < maxRetries) {
        try {
          const response = await markLessonComplete(courseId, lessonId);
          onlineSuccess = response.success;
          
          if (onlineSuccess) {
            console.log('🌐 Online save successful on attempt:', retryCount + 1);
          } else {
            console.warn('⚠️ Online save failed, retrying...');
            retryCount++;
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // Exponential backoff
          }
        } catch (error) {
          console.warn(`⚠️ Online save attempt ${retryCount + 1} failed:`, error);
          retryCount++;
          if (retryCount < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          }
        }
      }
      
      // Step 3: Validate and sync data
      if (offlineSuccess) {
        // Always validate the saved data
        const validationResult = await this.validateProgressConsistency(userId, courseId, lessonId);
        console.log('✅ Progress validation result:', validationResult);
        
        // Trigger a sync to ensure consistency
        setTimeout(() => {
          this.syncProgressWithServer(userId, courseId).catch(error => {
            console.warn('⚠️ Background sync failed:', error);
          });
        }, 1000);
      }
      
      console.log('✅ Lesson completion result:', { offlineSuccess, onlineSuccess });
      return offlineSuccess; // Return true if offline save succeeded
      
    } catch (error) {
      console.error('❌ Failed to mark lesson complete:', error);
      return false;
    }
  }

  /**
   * Update lesson progress with robust error handling
   */
  async updateLessonProgress(
    userId: string, 
    courseId: string, 
    lessonId: string, 
    percentage: number, 
    timeSpent: number = 0,
    currentPosition?: number
  ): Promise<boolean> {
    try {
      console.log('📊 Updating lesson progress:', { userId, courseId, lessonId, percentage, timeSpent });
      
      const progressData = {
        percentage: Math.min(100, Math.max(0, percentage)),
        timeSpent,
        currentPosition,
        isCompleted: percentage >= 100,
        lastUpdated: new Date().toISOString()
      };
      
      // Save to offline storage first
      const offlineSuccess = await saveOfflineProgress({
        userId,
        courseId,
        lessonId,
        progress: progressData
      });
      
      // Try to save to online storage (non-blocking)
      let onlineSuccess = false;
      try {
        const response = await updateLessonProgress(courseId, lessonId, {
          timeSpent,
          currentPosition: currentPosition || 0,
          interactions: [{
            type: 'progress_update',
            timestamp: new Date().toISOString(),
            data: { percentage, isCompleted: percentage >= 100 }
          }]
        });
        onlineSuccess = response.success;
      } catch (error) {
        console.warn('⚠️ Failed to update online progress:', error);
      }
      
      console.log('✅ Progress update result:', { offlineSuccess, onlineSuccess });
      return offlineSuccess;
      
    } catch (error) {
      console.error('❌ Failed to update lesson progress:', error);
      return false;
    }
  }

  /**
   * Validate progress consistency between offline and online data
   */
  private async validateProgressConsistency(userId: string, courseId: string, lessonId: string): Promise<{
    isConsistent: boolean;
    offlineData: any;
    onlineData: any;
    discrepancies: string[];
  }> {
    try {
      const offlineData = await getOfflineProgress(userId, courseId);
      let onlineData = null;
      
      try {
        const response = await getCourseProgress(courseId);
        if (response.success && response.data) {
          onlineData = response.data;
        }
      } catch (error) {
        console.warn('⚠️ Could not fetch online data for validation:', error);
      }
      
      const discrepancies = [];
      
      if (offlineData && onlineData) {
        const offlineLesson = offlineData.lessons?.[lessonId];
        const onlineLesson = onlineData.lessons?.[lessonId];
        
        if (offlineLesson && onlineLesson) {
          if (offlineLesson.isCompleted !== onlineLesson.isCompleted) {
            discrepancies.push('Completion status mismatch');
          }
          if (Math.abs(offlineLesson.percentage - onlineLesson.percentage) > 5) {
            discrepancies.push('Progress percentage mismatch');
          }
        }
      }
      
      return {
        isConsistent: discrepancies.length === 0,
        offlineData,
        onlineData,
        discrepancies
      };
      
    } catch (error) {
      console.error('❌ Failed to validate progress consistency:', error);
      return {
        isConsistent: false,
        offlineData: null,
        onlineData: null,
        discrepancies: ['Validation failed']
      };
    }
  }

  /**
   * Sync progress with server to ensure consistency
   */
  private async syncProgressWithServer(userId: string, courseId: string): Promise<boolean> {
    try {
      console.log('🔄 Syncing progress with server:', { userId, courseId });
      
      // Get current offline progress
      const offlineProgress = await getOfflineProgress(userId, courseId);
      if (!offlineProgress) {
        console.log('📱 No offline progress to sync');
        return true;
      }
      
      // Send offline progress to server
      const completedLessons = Object.entries(offlineProgress.lessons)
        .filter(([_, lesson]) => lesson.isCompleted)
        .map(([lessonId, _]) => lessonId);
      
      if (completedLessons.length > 0) {
        try {
          // Update course progress on server
          const response = await fetch(`/api/v1/users/progress/${courseId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
              progress: offlineProgress.overallPercentage,
              completedLessons
            })
          });
          
          if (response.ok) {
            console.log('✅ Progress synced successfully');
            return true;
          } else {
            console.warn('⚠️ Failed to sync progress:', response.status);
            return false;
          }
        } catch (error) {
          console.warn('⚠️ Sync request failed:', error);
          return false;
        }
      }
      
      return true;
    } catch (error) {
      console.error('❌ Failed to sync progress with server:', error);
      return false;
    }
  }

  /**
   * Merge progress data with conflict resolution
   */
  private mergeProgress(
    offlineProgress: OfflineCourseProgress | null,
    onlineProgress: any,
    courseId: string
  ): UnifiedProgress | null {
    try {
      // Start with offline progress as base
      const baseProgress: UnifiedProgress = {
        courseId,
        totalLessons: offlineProgress?.totalLessons || 0,
        completedLessons: offlineProgress?.completedLessons || 0,
        overallProgress: offlineProgress?.overallPercentage || 0,
        lastActivity: offlineProgress?.lastActivity || new Date().toISOString(),
        lessons: offlineProgress?.lessons || {}
      };
      
      // Merge with online progress if available
      if (onlineProgress) {
        // Take the higher progress percentage
        baseProgress.overallProgress = Math.max(
          baseProgress.overallProgress,
          onlineProgress.overallProgress || 0
        );
        
        // Merge lesson data, preferring completed status from either source
        if (onlineProgress.lessons) {
          Object.entries(onlineProgress.lessons).forEach(([lessonId, onlineLesson]: [string, any]) => {
            const offlineLesson = baseProgress.lessons[lessonId];
            
            if (offlineLesson) {
              // Merge lesson data, preferring the higher completion status
              baseProgress.lessons[lessonId] = {
                percentage: Math.max(offlineLesson.percentage, onlineLesson.percentage || 0),
                timeSpent: Math.max(offlineLesson.timeSpent, onlineLesson.timeSpent || 0),
                isCompleted: offlineLesson.isCompleted || onlineLesson.isCompleted || false,
                completedAt: offlineLesson.completedAt || onlineLesson.completedAt,
                lastUpdated: new Date().toISOString()
              };
            } else {
              // Add online lesson data
              baseProgress.lessons[lessonId] = {
                percentage: onlineLesson.percentage || 0,
                timeSpent: onlineLesson.timeSpent || 0,
                isCompleted: onlineLesson.isCompleted || false,
                completedAt: onlineLesson.completedAt,
                lastUpdated: new Date().toISOString()
              };
            }
          });
        }
        
        // Update completed lessons count
        baseProgress.completedLessons = Object.values(baseProgress.lessons)
          .filter(lesson => lesson.isCompleted).length;
      }
      
      // Ensure data consistency
      baseProgress.overallProgress = Math.min(100, Math.max(0, baseProgress.overallProgress));
      baseProgress.completedLessons = Math.min(baseProgress.totalLessons, baseProgress.completedLessons);
      
      console.log('✅ Merged progress result:', {
        courseId,
        overallProgress: baseProgress.overallProgress,
        completedLessons: baseProgress.completedLessons,
        totalLessons: baseProgress.totalLessons
      });
      
      return baseProgress;
    } catch (error) {
      console.error('❌ Failed to merge progress:', error);
      return null;
    }
  }
}

// Export singleton instance
const progressService = ProgressService.getInstance();
export { progressService };

// React hook for using progress service
export const useProgressService = () => {
  const { user } = useAuth();

  const getProgress = async (courseId: string) => {
    if (!user?.id) return null;
    return await progressService.getUnifiedProgress(user.id, courseId);
  };

  const markComplete = async (courseId: string, lessonId: string, timeSpent: number = 0) => {
    if (!user?.id) return false;
    return await progressService.markLessonComplete(user.id, courseId, lessonId, timeSpent);
  };

  const updateProgress = async (
    courseId: string, 
    lessonId: string, 
    percentage: number, 
    timeSpent: number = 0,
    currentPosition?: number
  ) => {
    if (!user?.id) return false;
    return await progressService.updateLessonProgress(user.id, courseId, lessonId, percentage, timeSpent, currentPosition);
  };

  return {
    getProgress,
    markComplete,
    updateProgress
  };
}; 