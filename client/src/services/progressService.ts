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

  static getInstance(): ProgressService {
    if (!ProgressService.instance) {
      ProgressService.instance = new ProgressService();
    }
    return ProgressService.instance;
  }

  /**
   * Get unified progress for a course, combining offline and online data
   */
  async getUnifiedProgress(userId: string, courseId: string): Promise<UnifiedProgress | null> {
    try {
      // Get offline progress first
      const offlineProgress = await getOfflineProgress(userId, courseId);
      
      // Get online progress
      let onlineProgress = null;
      try {
        const response = await getCourseProgress(courseId);
        if (response.success && response.data) {
          onlineProgress = response.data;
        }
      } catch (error) {
        console.warn('Failed to fetch online progress, using offline only:', error);
      }

      // Merge progress data
      return this.mergeProgress(offlineProgress, onlineProgress, courseId);
    } catch (error) {
      console.error('Failed to get unified progress:', error);
      return null;
    }
  }

  /**
   * Mark a lesson as complete in both offline and online systems
   */
  async markLessonComplete(userId: string, courseId: string, lessonId: string, timeSpent: number = 0): Promise<boolean> {
    try {
      const completedAt = new Date().toISOString();
      
      // Mark complete offline
      const offlineSuccess = await saveOfflineProgress({
        userId,
        courseId,
        lessonId,
        progress: {
          percentage: 100,
          timeSpent,
          isCompleted: true,
          completedAt,
          lastUpdated: completedAt
        }
      });
      
      // Mark complete online
      let onlineSuccess = false;
      try {
        const response = await markLessonComplete(courseId, lessonId);
        onlineSuccess = response.success;
      } catch (error) {
        console.warn('Failed to mark lesson complete online:', error);
      }

      console.log('✅ Lesson marked complete:', {
        lessonId,
        offlineSuccess,
        onlineSuccess,
        timeSpent
      });

      return offlineSuccess || onlineSuccess;
    } catch (error) {
      console.error('Failed to mark lesson complete:', error);
      return false;
    }
  }

  /**
   * Update lesson progress in both systems
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
      const lastUpdated = new Date().toISOString();
      
      // Update offline progress
      const offlineSuccess = await saveOfflineProgress({
        userId,
        courseId,
        lessonId,
        progress: {
          percentage,
          timeSpent,
          currentPosition,
          isCompleted: percentage >= 100,
          completedAt: percentage >= 100 ? lastUpdated : undefined,
          lastUpdated
        }
      });
      
      // Update online progress
      let onlineSuccess = false;
      try {
        const response = await updateLessonProgress(courseId, lessonId, {
          timeSpent,
          currentPosition
        });
        onlineSuccess = response.success;
      } catch (error) {
        console.warn('Failed to update lesson progress online:', error);
      }

      console.log('📊 Lesson progress updated:', {
        lessonId,
        percentage,
        offlineSuccess,
        onlineSuccess
      });

      return offlineSuccess || onlineSuccess;
    } catch (error) {
      console.error('Failed to update lesson progress:', error);
      return false;
    }
  }

  /**
   * Merge offline and online progress data
   */
  private mergeProgress(
    offlineProgress: OfflineCourseProgress | null,
    onlineProgress: any,
    courseId: string
  ): UnifiedProgress | null {
    // Use offline progress as base
    if (!offlineProgress) {
      return null;
    }

    const mergedProgress: UnifiedProgress = {
      courseId,
      totalLessons: offlineProgress.totalLessons,
      completedLessons: offlineProgress.completedLessons,
      overallProgress: offlineProgress.overallPercentage,
      lastActivity: offlineProgress.lastActivity,
      lessons: { ...offlineProgress.lessons }
    };

    // Merge with online progress if available
    if (onlineProgress) {
      // Update completed lessons count
      if (onlineProgress.completedLessons !== undefined) {
        mergedProgress.completedLessons = Math.max(
          mergedProgress.completedLessons,
          onlineProgress.completedLessons
        );
      }

      // Update overall progress
      if (onlineProgress.progress !== undefined) {
        const onlineProgressValue = Number(onlineProgress.progress);
        if (!isNaN(onlineProgressValue)) {
          mergedProgress.overallProgress = Math.max(
            mergedProgress.overallProgress,
            onlineProgressValue
          );
        }
      }

      // Merge lesson-level progress
      if (onlineProgress.completedLessons && Array.isArray(onlineProgress.completedLessons)) {
        onlineProgress.completedLessons.forEach((lessonId: string) => {
          if (!mergedProgress.lessons[lessonId]) {
            mergedProgress.lessons[lessonId] = {
              percentage: 100,
              timeSpent: 0,
              isCompleted: true,
              completedAt: new Date().toISOString(),
              lastUpdated: new Date().toISOString()
            };
          } else if (!mergedProgress.lessons[lessonId].isCompleted) {
            mergedProgress.lessons[lessonId].isCompleted = true;
            mergedProgress.lessons[lessonId].percentage = 100;
            mergedProgress.lessons[lessonId].completedAt = new Date().toISOString();
          }
        });
      }
    }

    // Recalculate overall progress based on merged lesson data
    const completedLessons = Object.values(mergedProgress.lessons).filter(lesson => lesson.isCompleted).length;
    const totalLessons = Object.keys(mergedProgress.lessons).length;
    
    if (totalLessons > 0) {
      mergedProgress.completedLessons = completedLessons;
      mergedProgress.overallProgress = Math.round((completedLessons / totalLessons) * 100);
    }

    console.log('🔄 Merged progress:', {
      courseId,
      totalLessons: mergedProgress.totalLessons,
      completedLessons: mergedProgress.completedLessons,
      overallProgress: mergedProgress.overallProgress,
      offlineLessons: offlineProgress ? Object.keys(offlineProgress.lessons).length : 0,
      mergedLessons: Object.keys(mergedProgress.lessons).length
    });

    return mergedProgress;
  }
}

export const progressService = ProgressService.getInstance();

// React hook for using the progress service
export const useProgressService = () => {
  const { user } = useAuth();

  const getProgress = async (courseId: string) => {
    if (!user?.id) return null;
    return progressService.getUnifiedProgress(user.id, courseId);
  };

  const markComplete = async (courseId: string, lessonId: string, timeSpent: number = 0) => {
    if (!user?.id) return false;
    return progressService.markLessonComplete(user.id, courseId, lessonId, timeSpent);
  };

  const updateProgress = async (
    courseId: string, 
    lessonId: string, 
    percentage: number, 
    timeSpent: number = 0,
    currentPosition?: number
  ) => {
    if (!user?.id) return false;
    return progressService.updateLessonProgress(user.id, courseId, lessonId, percentage, timeSpent, currentPosition);
  };

  return {
    getProgress,
    markComplete,
    updateProgress
  };
}; 