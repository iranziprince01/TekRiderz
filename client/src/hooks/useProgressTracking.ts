// React hook for offline-first progress tracking

import { useState, useEffect, useCallback, useRef } from 'react';
import { progressManager, CourseProgressData, LessonProgress } from '../utils/progressManager';
import { useAuth } from '../contexts/AuthContext';

export interface UseProgressTrackingReturn {
  // Progress data
  progress: CourseProgressData | null;
  isLoading: boolean;
  error: string | null;

  // Lesson management
  startLesson: (lessonId: string, sectionId: string) => Promise<void>;
  completeLesson: (lessonId: string, sectionId: string, timeSpent?: number) => Promise<void>;
  updateLessonPosition: (lessonId: string, position: number) => Promise<void>;
  
  // Interactions
  addInteraction: (lessonId: string, interaction: { type: string; data: any }) => Promise<void>;
  addNote: (lessonId: string, note: { timestamp: number; content: string }) => Promise<void>;
  addBookmark: (lessonId: string, bookmark: { timestamp: number; title: string }) => Promise<void>;
  
  // Quiz handling
  updateQuizScore: (quizId: string, score: {
    score: number;
    maxScore: number;
    percentage: number;
    passed: boolean;
    answers: any[];
    timeSpent: number;
  }) => Promise<void>;
  
  // Analytics
  getCompletionPercentage: () => number;
  getTotalTimeSpent: () => number;
  getCurrentLesson: () => string | undefined;
  getLessonProgress: (lessonId: string) => LessonProgress | null;
  getQuizScore: (quizId: string) => any;
  
  // Sync
  syncProgress: () => Promise<boolean>;
  hasPendingChanges: () => boolean;
  
  // Utilities
  refreshProgress: () => Promise<void>;
}

export const useProgressTracking = (courseId: string): UseProgressTrackingReturn => {
  const { user } = useAuth();
  const [progress, setProgress] = useState<CourseProgressData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sessionStartRef = useRef<number>(Date.now());
  const currentLessonStartRef = useRef<number | null>(null);

  // Initialize progress when component mounts or user/course changes
  useEffect(() => {
    const initializeProgress = async () => {
      if (!user?.id || !courseId) {
        setProgress(null);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        
        const progressData = await progressManager.initializeProgress(user.id, courseId);
        setProgress(progressData);
      } catch (err) {
        console.error('Failed to initialize progress:', err);
        setError(err instanceof Error ? err.message : 'Failed to load progress');
      } finally {
        setIsLoading(false);
      }
    };

    initializeProgress();
  }, [user?.id, courseId]);

  // Start a lesson
  const startLesson = useCallback(async (lessonId: string, sectionId: string): Promise<void> => {
    if (!user?.id || !courseId) return;

    try {
      currentLessonStartRef.current = Date.now();
      await progressManager.startLesson(user.id, courseId, lessonId, sectionId);
      
      // Refresh progress state
      const updatedProgress = await progressManager.getProgress(user.id, courseId);
      if (updatedProgress) {
        setProgress(updatedProgress);
      }
    } catch (err) {
      console.error('Failed to start lesson:', err);
      setError(err instanceof Error ? err.message : 'Failed to start lesson');
      throw err;
    }
  }, [user?.id, courseId]);

  // Complete a lesson
  const completeLesson = useCallback(async (
    lessonId: string, 
    sectionId: string, 
    timeSpent?: number
  ): Promise<void> => {
    if (!user?.id || !courseId) return;

    try {
      // Calculate time spent if not provided
      const calculatedTimeSpent = timeSpent || (
        currentLessonStartRef.current 
          ? Date.now() - currentLessonStartRef.current 
          : 0
      );

      await progressManager.completeLesson(
        user.id, 
        courseId, 
        lessonId, 
        sectionId, 
        calculatedTimeSpent
      );
      
      currentLessonStartRef.current = null;
      
      // Refresh progress state
      const updatedProgress = await progressManager.getProgress(user.id, courseId);
      if (updatedProgress) {
        setProgress(updatedProgress);
      }
    } catch (err) {
      console.error('Failed to complete lesson:', err);
      setError(err instanceof Error ? err.message : 'Failed to complete lesson');
      throw err;
    }
  }, [user?.id, courseId]);

  // Update lesson position (for videos)
  const updateLessonPosition = useCallback(async (
    lessonId: string, 
    position: number
  ): Promise<void> => {
    if (!user?.id || !courseId) return;

    try {
      await progressManager.updateLessonPosition(user.id, courseId, lessonId, position);
      
      // Refresh progress state
      const updatedProgress = await progressManager.getProgress(user.id, courseId);
      if (updatedProgress) {
        setProgress(updatedProgress);
      }
    } catch (err) {
      console.error('Failed to update lesson position:', err);
      // Don't throw for position updates as they're frequent
    }
  }, [user?.id, courseId]);

  // Add interaction
  const addInteraction = useCallback(async (
    lessonId: string, 
    interaction: { type: string; data: any }
  ): Promise<void> => {
    if (!user?.id || !courseId) return;

    try {
      await progressManager.addInteraction(user.id, courseId, lessonId, interaction);
      
      // Refresh progress state
      const updatedProgress = await progressManager.getProgress(user.id, courseId);
      if (updatedProgress) {
        setProgress(updatedProgress);
      }
    } catch (err) {
      console.error('Failed to add interaction:', err);
      // Don't throw for interactions as they're frequent
    }
  }, [user?.id, courseId]);

  // Add note
  const addNote = useCallback(async (
    lessonId: string, 
    note: { timestamp: number; content: string }
  ): Promise<void> => {
    if (!user?.id || !courseId) return;

    try {
      await progressManager.addNote(user.id, courseId, lessonId, note);
      
      // Refresh progress state
      const updatedProgress = await progressManager.getProgress(user.id, courseId);
      if (updatedProgress) {
        setProgress(updatedProgress);
      }
    } catch (err) {
      console.error('Failed to add note:', err);
      setError(err instanceof Error ? err.message : 'Failed to add note');
      throw err;
    }
  }, [user?.id, courseId]);

  // Add bookmark
  const addBookmark = useCallback(async (
    lessonId: string, 
    bookmark: { timestamp: number; title: string }
  ): Promise<void> => {
    if (!user?.id || !courseId) return;

    try {
      await progressManager.addBookmark(user.id, courseId, lessonId, bookmark);
      
      // Refresh progress state
      const updatedProgress = await progressManager.getProgress(user.id, courseId);
      if (updatedProgress) {
        setProgress(updatedProgress);
      }
    } catch (err) {
      console.error('Failed to add bookmark:', err);
      setError(err instanceof Error ? err.message : 'Failed to add bookmark');
      throw err;
    }
  }, [user?.id, courseId]);

  // Update quiz score
  const updateQuizScore = useCallback(async (
    quizId: string, 
    score: {
      score: number;
      maxScore: number;
      percentage: number;
      passed: boolean;
      answers: any[];
      timeSpent: number;
    }
  ): Promise<void> => {
    if (!user?.id || !courseId) return;

    try {
      await progressManager.updateQuizScore(user.id, courseId, quizId, score);
      
      // Refresh progress state
      const updatedProgress = await progressManager.getProgress(user.id, courseId);
      if (updatedProgress) {
        setProgress(updatedProgress);
      }
    } catch (err) {
      console.error('Failed to update quiz score:', err);
      setError(err instanceof Error ? err.message : 'Failed to update quiz score');
      throw err;
    }
  }, [user?.id, courseId]);

  // Get completion percentage
  const getCompletionPercentage = useCallback((): number => {
    return progress?.overallProgress || 0;
  }, [progress]);

  // Get total time spent
  const getTotalTimeSpent = useCallback((): number => {
    return progress?.timeSpent || 0;
  }, [progress]);

  // Get current lesson
  const getCurrentLesson = useCallback((): string | undefined => {
    return progress?.currentLesson;
  }, [progress]);

  // Get lesson progress
  const getLessonProgress = useCallback((lessonId: string): LessonProgress | null => {
    return progress?.lessonProgress[lessonId] || null;
  }, [progress]);

  // Get quiz score
  const getQuizScore = useCallback((quizId: string): any => {
    return progress?.quizScores[quizId] || null;
  }, [progress]);

  // Sync progress
  const syncProgress = useCallback(async (): Promise<boolean> => {
    if (!user?.id || !courseId) return false;

    try {
      const success = await progressManager.syncProgress(user.id, courseId);
      
      if (success) {
        // Refresh progress state after successful sync
        const updatedProgress = await progressManager.getProgress(user.id, courseId);
        if (updatedProgress) {
          setProgress(updatedProgress);
        }
      }
      
      return success;
    } catch (err) {
      console.error('Failed to sync progress:', err);
      setError(err instanceof Error ? err.message : 'Failed to sync progress');
      return false;
    }
  }, [user?.id, courseId]);

  // Check if has pending changes
  const hasPendingChanges = useCallback((): boolean => {
    return progress?.pendingChanges || false;
  }, [progress]);

  // Refresh progress
  const refreshProgress = useCallback(async (): Promise<void> => {
    if (!user?.id || !courseId) return;

    try {
      setIsLoading(true);
      const updatedProgress = await progressManager.getProgress(user.id, courseId);
      if (updatedProgress) {
        setProgress(updatedProgress);
      }
    } catch (err) {
      console.error('Failed to refresh progress:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh progress');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, courseId]);

  return {
    // Progress data
    progress,
    isLoading,
    error,

    // Lesson management
    startLesson,
    completeLesson,
    updateLessonPosition,
    
    // Interactions
    addInteraction,
    addNote,
    addBookmark,
    
    // Quiz handling
    updateQuizScore,
    
    // Analytics
    getCompletionPercentage,
    getTotalTimeSpent,
    getCurrentLesson,
    getLessonProgress,
    getQuizScore,
    
    // Sync
    syncProgress,
    hasPendingChanges,
    
    // Utilities
    refreshProgress
  };
};

// Hook for learning analytics across all courses
export const useLearningAnalytics = () => {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState({
    weeklyProgress: [0, 0, 0, 0, 0, 0, 0],
    dailyActiveTime: [0, 0, 0, 0, 0, 0, 0],
    completionRate: 0,
    averageQuizScore: 0,
    streakDays: 0,
    totalInteractions: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadAnalytics = async () => {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }

      try {
        const analyticsData = await progressManager.getLearningAnalytics(user.id);
        setAnalytics(analyticsData);
      } catch (error) {
        console.error('Failed to load analytics:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadAnalytics();
  }, [user?.id]);

  return {
    analytics,
    isLoading
  };
};

// Hook for app state hydration
export const useAppStateHydration = () => {
  const { user } = useAuth();
  const [appState, setAppState] = useState({
    courses: [] as CourseProgressData[],
    totalTimeSpent: 0,
    completedCourses: 0,
    activeCourses: 0,
    achievements: [] as string[]
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const hydrateState = async () => {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }

      try {
        const hydratedState = await progressManager.hydrateAppState(user.id);
        setAppState(hydratedState);
      } catch (error) {
        console.error('Failed to hydrate app state:', error);
      } finally {
        setIsLoading(false);
      }
    };

    hydrateState();
  }, [user?.id]);

  const refreshAppState = useCallback(async () => {
    if (!user?.id) return;

    try {
      setIsLoading(true);
      const hydratedState = await progressManager.hydrateAppState(user.id);
      setAppState(hydratedState);
    } catch (error) {
      console.error('Failed to refresh app state:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  return {
    appState,
    isLoading,
    refreshAppState
  };
}; 