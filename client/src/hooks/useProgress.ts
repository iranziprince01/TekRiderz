import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  progressManager, 
  saveProgress, 
  getProgress, 
  getCourseProgress, 
  getAllUserProgress,
  deleteProgress,
  clearAllProgress,
  syncProgressWithServer,
  getDatabaseInfo,
  type ProgressData,
  type CourseProgress
} from '../offline/progressManager';

export const useProgress = () => {
  const { user } = useAuth();
  const [courseProgress, setCourseProgress] = useState<CourseProgress | null>(null);
  const [lessonProgress, setLessonProgress] = useState<ProgressData['progress'] | null>(null);
  const [allProgress, setAllProgress] = useState<ProgressData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dbInfo, setDbInfo] = useState<any>(null);

  const userId = user?.id;

  // Get database info
  const fetchDatabaseInfo = useCallback(async () => {
    try {
      const info = await getDatabaseInfo();
      setDbInfo(info);
      return info;
    } catch (err) {
      console.error('Failed to get database info:', err);
      setError('Failed to get database info');
      return null;
    }
  }, []);

  // Save progress for a lesson
  const saveLessonProgress = useCallback(async (
    courseId: string,
    lessonId: string,
    progressData: Omit<ProgressData['progress'], 'lastUpdated'>
  ) => {
    if (!userId) {
      setError('User not authenticated');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const success = await saveProgress({
        userId,
        courseId,
        lessonId,
        progress: {
          ...progressData,
          lastUpdated: new Date().toISOString()
        }
      });

      if (success) {
        // Refresh course progress
        await fetchCourseProgress(courseId);
        console.log('✅ Progress saved successfully');
      } else {
        setError('Failed to save progress');
      }

      return success;
    } catch (err) {
      console.error('Failed to save progress:', err);
      setError('Failed to save progress');
      return false;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Mark lesson as completed
  const markLessonComplete = useCallback(async (
    courseId: string,
    lessonId: string,
    timeSpent: number = 0
  ) => {
    return saveLessonProgress(courseId, lessonId, {
      percentage: 100,
      timeSpent,
      isCompleted: true,
      completedAt: new Date().toISOString()
    });
  }, [saveLessonProgress]);

  // Update lesson progress
  const updateLessonProgress = useCallback(async (
    courseId: string,
    lessonId: string,
    percentage: number,
    timeSpent: number = 0,
    currentPosition?: number
  ) => {
    return saveLessonProgress(courseId, lessonId, {
      percentage,
      timeSpent,
      currentPosition,
      isCompleted: percentage >= 100
    });
  }, [saveLessonProgress]);

  // Fetch course progress
  const fetchCourseProgress = useCallback(async (courseId: string) => {
    if (!userId) {
      setError('User not authenticated');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const progress = await getCourseProgress(userId, courseId);
      setCourseProgress(progress);
      return progress;
    } catch (err) {
      console.error('Failed to fetch course progress:', err);
      setError('Failed to fetch course progress');
      return null;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Fetch lesson progress
  const fetchLessonProgress = useCallback(async (courseId: string, lessonId: string) => {
    if (!userId) {
      setError('User not authenticated');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const progress = await getProgress(userId, courseId, lessonId);
      setLessonProgress(progress);
      return progress;
    } catch (err) {
      console.error('Failed to fetch lesson progress:', err);
      setError('Failed to fetch lesson progress');
      return null;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Fetch all user progress
  const fetchAllProgress = useCallback(async () => {
    if (!userId) {
      setError('User not authenticated');
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      const progress = await getAllUserProgress(userId);
      setAllProgress(progress);
      return progress;
    } catch (err) {
      console.error('Failed to fetch all progress:', err);
      setError('Failed to fetch all progress');
      return [];
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Delete progress
  const deleteLessonProgress = useCallback(async (courseId: string, lessonId?: string) => {
    if (!userId) {
      setError('User not authenticated');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const success = await deleteProgress(userId, courseId, lessonId);
      if (success) {
        // Refresh course progress
        await fetchCourseProgress(courseId);
        console.log('🗑️ Progress deleted successfully');
      } else {
        setError('Failed to delete progress');
      }
      return success;
    } catch (err) {
      console.error('Failed to delete progress:', err);
      setError('Failed to delete progress');
      return false;
    } finally {
      setLoading(false);
    }
  }, [userId, fetchCourseProgress]);

  // Clear all progress
  const clearAllUserProgress = useCallback(async () => {
    if (!userId) {
      setError('User not authenticated');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const success = await clearAllProgress(userId);
      if (success) {
        setCourseProgress(null);
        setLessonProgress(null);
        setAllProgress([]);
        console.log('🗑️ All progress cleared successfully');
      } else {
        setError('Failed to clear all progress');
      }
      return success;
    } catch (err) {
      console.error('Failed to clear all progress:', err);
      setError('Failed to clear all progress');
      return false;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Sync progress with server
  const syncProgress = useCallback(async (courseId: string) => {
    if (!userId) {
      setError('User not authenticated');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const success = await syncProgressWithServer(userId, courseId);
      if (success) {
        console.log('🔄 Progress synced successfully');
      } else {
        setError('Failed to sync progress');
      }
      return success;
    } catch (err) {
      console.error('Failed to sync progress:', err);
      setError('Failed to sync progress');
      return false;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Initialize database info on mount
  useEffect(() => {
    fetchDatabaseInfo();
  }, [fetchDatabaseInfo]);

  return {
    // State
    courseProgress,
    lessonProgress,
    allProgress,
    loading,
    error,
    dbInfo,
    
    // Actions
    saveLessonProgress,
    markLessonComplete,
    updateLessonProgress,
    fetchCourseProgress,
    fetchLessonProgress,
    fetchAllProgress,
    deleteLessonProgress,
    clearAllUserProgress,
    syncProgress,
    fetchDatabaseInfo,
    
    // Utilities
    isLessonCompleted: (lessonId: string) => {
      return courseProgress?.lessons[lessonId]?.isCompleted || false;
    },
    
    getLessonProgress: (lessonId: string) => {
      return courseProgress?.lessons[lessonId] || null;
    },
    
    getOverallPercentage: () => {
      return courseProgress?.overallPercentage || 0;
    },
    
    getCompletedLessons: () => {
      return courseProgress?.completedLessons || 0;
    },
    
    getTotalLessons: () => {
      return courseProgress?.totalLessons || 0;
    },
    
    getTotalTimeSpent: () => {
      return courseProgress?.totalTimeSpent || 0;
    },
    
    getLastActivity: () => {
      return courseProgress?.lastActivity || null;
    }
  };
}; 