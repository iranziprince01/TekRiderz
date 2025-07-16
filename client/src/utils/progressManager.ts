// Comprehensive progress manager for offline-first progress tracking

import { offlineStorage, OfflineProgress } from './offlineStorage';
import { syncManager } from './syncManager';
import { apiClient } from './api';

export interface LessonProgress {
  startedAt: string;
  completedAt?: string;
  timeSpent: number;
  lastPosition?: number; // for videos
  interactions: {
    type: string;
    timestamp: string;
    data: any;
  }[];
  notes: {
    id: string;
    timestamp: number;
    content: string;
    createdAt: string;
  }[];
  bookmarks: {
    id: string;
    timestamp: number;
    title: string;
    createdAt: string;
  }[];
}

export interface SectionProgress {
  completedLessons: string[];
  progress: number; // 0-100
  timeSpent: number;
  startedAt: string;
  completedAt?: string;
  quizScore?: number;
  assignmentGrade?: number;
}

export interface CourseProgressData {
  userId: string;
  courseId: string;
  completedLessons: string[];
  completedSections: string[];
  currentLesson?: string;
  currentSection?: string;
  timeSpent: number;
  lastWatched?: string;
  overallProgress: number;
  sectionProgress: Record<string, SectionProgress>;
  lessonProgress: Record<string, LessonProgress>;
  quizScores: Record<string, any>;
  assignments: Record<string, any>;
  engagement: {
    sessionCount: number;
    averageSessionLength: number;
    longestSession: number;
    totalActiveTime: number;
    lastActiveAt: string;
    streakDays: number;
    completionVelocity: number;
    interactionRate: number;
  };
  achievements: {
    earnedAchievements: string[];
    progressTowardsAchievements: Record<string, number>;
  };
  lastSyncedAt: number;
  lastModifiedAt: number;
  pendingChanges: boolean;
}

class ProgressManager {
  private progressCache: Map<string, CourseProgressData> = new Map();
  private sessionStartTime: number = Date.now();
  private currentSession: {
    courseId?: string;
    lessonId?: string;
    startTime: number;
    interactions: number;
  } = { startTime: Date.now(), interactions: 0 };

  // Initialize progress for a user and course
  async initializeProgress(userId: string, courseId: string): Promise<CourseProgressData> {
    const progressId = `${userId}-${courseId}`;
    
    // Check cache first
    if (this.progressCache.has(progressId)) {
      return this.progressCache.get(progressId)!;
    }

    // Try to get from local storage
    let progress = await offlineStorage.getProgress(userId, courseId);
    
    if (!progress) {
      // Create new progress
      progress = {
        id: progressId,
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
        engagement: {
          sessionCount: 0,
          averageSessionLength: 0,
          longestSession: 0,
          totalActiveTime: 0,
          lastActiveAt: new Date().toISOString(),
          streakDays: 0,
          completionVelocity: 0,
          interactionRate: 0
        },
        achievements: {
          earnedAchievements: [],
          progressTowardsAchievements: {}
        },
        lastSyncedAt: 0,
        lastModifiedAt: Date.now(),
        pendingChanges: false
      };

      await offlineStorage.storeProgress(progress);
    }

    // Cache it
    this.progressCache.set(progressId, progress);

    return progress;
  }

  // Start a lesson
  async startLesson(
    userId: string, 
    courseId: string, 
    lessonId: string, 
    sectionId: string
  ): Promise<void> {
    const progress = await this.initializeProgress(userId, courseId);
    
    // Update current lesson/section
    progress.currentLesson = lessonId;
    progress.currentSection = sectionId;
    progress.lastWatched = new Date().toISOString();

    // Initialize lesson progress if not exists
    if (!progress.lessonProgress[lessonId]) {
      progress.lessonProgress[lessonId] = {
        startedAt: new Date().toISOString(),
        timeSpent: 0,
        interactions: [],
        notes: [],
        bookmarks: []
      };
    }

    // Update session info
    this.currentSession = {
      courseId,
      lessonId,
      startTime: Date.now(),
      interactions: 0
    };

    progress.lastModifiedAt = Date.now();
    progress.pendingChanges = true;

    // Save to cache and storage
    this.progressCache.set(`${userId}-${courseId}`, progress);
    await offlineStorage.storeProgress(progress);
  }

  // Complete a lesson
  async completeLesson(
    userId: string,
    courseId: string,
    lessonId: string,
    sectionId: string,
    timeSpent: number = 0
  ): Promise<void> {
    const progress = await this.initializeProgress(userId, courseId);

    // Add to completed lessons if not already there
    if (!progress.completedLessons.includes(lessonId)) {
      progress.completedLessons.push(lessonId);
    }

    // Update lesson progress
    const lessonProgress = progress.lessonProgress[lessonId] || {
      startedAt: new Date().toISOString(),
      timeSpent: 0,
      interactions: [],
      notes: [],
      bookmarks: []
    };

    lessonProgress.completedAt = new Date().toISOString();
    lessonProgress.timeSpent += timeSpent;
    progress.lessonProgress[lessonId] = lessonProgress;

    // Update total time spent
    progress.timeSpent += timeSpent;

    // Update section progress
    if (!progress.sectionProgress[sectionId]) {
      progress.sectionProgress[sectionId] = {
        completedLessons: [],
        progress: 0,
        timeSpent: 0,
        startedAt: new Date().toISOString()
      };
    }

    const sectionProgress = progress.sectionProgress[sectionId];
    if (!sectionProgress.completedLessons.includes(lessonId)) {
      sectionProgress.completedLessons.push(lessonId);
    }
    sectionProgress.timeSpent += timeSpent;

    // Update engagement metrics
    const sessionTime = Date.now() - this.currentSession.startTime;
    progress.engagement.sessionCount += 1;
    progress.engagement.totalActiveTime += sessionTime;
    progress.engagement.averageSessionLength = progress.engagement.totalActiveTime / progress.engagement.sessionCount;
    progress.engagement.longestSession = Math.max(progress.engagement.longestSession, sessionTime);
    progress.engagement.lastActiveAt = new Date().toISOString();
    progress.engagement.interactionRate = this.currentSession.interactions / (sessionTime / 1000 / 60); // interactions per minute

    progress.lastModifiedAt = Date.now();
    progress.pendingChanges = true;

    // Save to cache and storage
    this.progressCache.set(`${userId}-${courseId}`, progress);
    await offlineStorage.storeProgress(progress);

    // Queue for sync if online or when back online
    await syncManager.queueModuleCompletion(
      userId,
      courseId,
      lessonId,
      sectionId,
      timeSpent,
      this.calculateOverallProgress(progress)
    );
  }

  // Update lesson position (for videos)
  async updateLessonPosition(
    userId: string,
    courseId: string,
    lessonId: string,
    position: number
  ): Promise<void> {
    const progress = await this.initializeProgress(userId, courseId);

    // Initialize lesson progress if not exists
    if (!progress.lessonProgress[lessonId]) {
      progress.lessonProgress[lessonId] = {
        startedAt: new Date().toISOString(),
        timeSpent: 0,
        interactions: [],
        notes: [],
        bookmarks: []
      };
    }

    progress.lessonProgress[lessonId].lastPosition = position;
    progress.lastWatched = new Date().toISOString();
    progress.lastModifiedAt = Date.now();
    progress.pendingChanges = true;

    // Save to cache and storage
    this.progressCache.set(`${userId}-${courseId}`, progress);
    await offlineStorage.storeProgress(progress);
  }

  // Add interaction (video play, pause, seek, etc.)
  async addInteraction(
    userId: string,
    courseId: string,
    lessonId: string,
    interaction: {
      type: string;
      data: any;
    }
  ): Promise<void> {
    const progress = await this.initializeProgress(userId, courseId);

    // Initialize lesson progress if not exists
    if (!progress.lessonProgress[lessonId]) {
      progress.lessonProgress[lessonId] = {
        startedAt: new Date().toISOString(),
        timeSpent: 0,
        interactions: [],
        notes: [],
        bookmarks: []
      };
    }

    progress.lessonProgress[lessonId].interactions.push({
      ...interaction,
      timestamp: new Date().toISOString()
    });

    // Update session interaction count
    this.currentSession.interactions += 1;

    progress.lastModifiedAt = Date.now();
    progress.pendingChanges = true;

    // Save to cache and storage
    this.progressCache.set(`${userId}-${courseId}`, progress);
    await offlineStorage.storeProgress(progress);
  }

  // Add note
  async addNote(
    userId: string,
    courseId: string,
    lessonId: string,
    note: {
      timestamp: number;
      content: string;
    }
  ): Promise<void> {
    const progress = await this.initializeProgress(userId, courseId);

    // Initialize lesson progress if not exists
    if (!progress.lessonProgress[lessonId]) {
      progress.lessonProgress[lessonId] = {
        startedAt: new Date().toISOString(),
        timeSpent: 0,
        interactions: [],
        notes: [],
        bookmarks: []
      };
    }

    const noteId = `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    progress.lessonProgress[lessonId].notes.push({
      id: noteId,
      timestamp: note.timestamp,
      content: note.content,
      createdAt: new Date().toISOString()
    });

    progress.lastModifiedAt = Date.now();
    progress.pendingChanges = true;

    // Save to cache and storage
    this.progressCache.set(`${userId}-${courseId}`, progress);
    await offlineStorage.storeProgress(progress);
  }

  // Add bookmark
  async addBookmark(
    userId: string,
    courseId: string,
    lessonId: string,
    bookmark: {
      timestamp: number;
      title: string;
    }
  ): Promise<void> {
    const progress = await this.initializeProgress(userId, courseId);

    // Initialize lesson progress if not exists
    if (!progress.lessonProgress[lessonId]) {
      progress.lessonProgress[lessonId] = {
        startedAt: new Date().toISOString(),
        timeSpent: 0,
        interactions: [],
        notes: [],
        bookmarks: []
      };
    }

    const bookmarkId = `bookmark_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    progress.lessonProgress[lessonId].bookmarks.push({
      id: bookmarkId,
      timestamp: bookmark.timestamp,
      title: bookmark.title,
      createdAt: new Date().toISOString()
    });

    progress.lastModifiedAt = Date.now();
    progress.pendingChanges = true;

    // Save to cache and storage
    this.progressCache.set(`${userId}-${courseId}`, progress);
    await offlineStorage.storeProgress(progress);
  }

  // Update quiz score
  async updateQuizScore(
    userId: string,
    courseId: string,
    quizId: string,
    score: {
      score: number;
      maxScore: number;
      percentage: number;
      passed: boolean;
      answers: any[];
      timeSpent: number;
    }
  ): Promise<void> {
    const progress = await this.initializeProgress(userId, courseId);

    // Get existing quiz data
    const existingQuizData = progress.quizScores[quizId];
    
    if (existingQuizData) {
      // Update with best score
      if (score.percentage > existingQuizData.bestPercentage) {
        existingQuizData.bestScore = score.score;
        existingQuizData.bestPercentage = score.percentage;
      }
      existingQuizData.totalAttempts += 1;
      existingQuizData.passed = existingQuizData.passed || score.passed;
      existingQuizData.attempts.push({
        score: score.score,
        percentage: score.percentage,
        passed: score.passed,
        timeSpent: score.timeSpent,
        completedAt: new Date().toISOString()
      });
    } else {
      // First attempt
      progress.quizScores[quizId] = {
        bestScore: score.score,
        bestPercentage: score.percentage,
        totalAttempts: 1,
        passed: score.passed,
        certificationEligible: score.passed && score.percentage >= 80,
        attempts: [{
          score: score.score,
          percentage: score.percentage,
          passed: score.passed,
          timeSpent: score.timeSpent,
          completedAt: new Date().toISOString()
        }]
      };
    }

    progress.lastModifiedAt = Date.now();
    progress.pendingChanges = true;

    // Save to cache and storage
    this.progressCache.set(`${userId}-${courseId}`, progress);
    await offlineStorage.storeProgress(progress);
  }

  // Calculate overall progress
  private calculateOverallProgress(progress: CourseProgressData): number {
    if (progress.completedLessons.length === 0) return 0;
    
    // This would need to be calculated based on total lessons in the course
    // For now, return a basic calculation
    return Math.min(progress.completedLessons.length * 10, 100); // Assume 10 lessons max
  }

  // Get progress for a course
  async getProgress(userId: string, courseId: string): Promise<CourseProgressData | null> {
    const progressId = `${userId}-${courseId}`;
    
    // Check cache first
    if (this.progressCache.has(progressId)) {
      return this.progressCache.get(progressId)!;
    }

    // Get from storage
    const progress = await offlineStorage.getProgress(userId, courseId);
    if (progress) {
      this.progressCache.set(progressId, progress);
    }

    return progress;
  }

  // Get all progress for a user
  async getAllProgress(userId: string): Promise<CourseProgressData[]> {
    try {
      return await offlineStorage.getAllPendingProgress(userId);
    } catch (error) {
      console.error('Failed to get all progress:', error);
      return [];
    }
  }

  // Sync progress with server
  async syncProgress(userId: string, courseId: string): Promise<boolean> {
    try {
      const progress = await this.getProgress(userId, courseId);
      if (!progress || !progress.pendingChanges) {
        return true; // Nothing to sync
      }

      // Try to sync with server
      const response = await apiClient.updateCourseProgress(courseId, {
        progress: progress.overallProgress,
        completedLessons: progress.completedLessons,
        timeSpent: progress.timeSpent,
        lastWatched: progress.lastWatched,
        sectionProgress: progress.sectionProgress,
        lessonProgress: progress.lessonProgress,
        quizScores: progress.quizScores
      });

      if (response.success) {
        // Mark as synced
        progress.lastSyncedAt = Date.now();
        progress.pendingChanges = false;
        
        this.progressCache.set(`${userId}-${courseId}`, progress);
        await offlineStorage.storeProgress(progress);
        
        return true;
      }

      return false;
    } catch (error) {
      console.error('Failed to sync progress:', error);
      return false;
    }
  }

  // Hydrate app state from local storage
  async hydrateAppState(userId: string): Promise<{
    courses: CourseProgressData[];
    totalTimeSpent: number;
    completedCourses: number;
    activeCourses: number;
    achievements: string[];
  }> {
    try {
      const allProgress = await this.getAllProgress(userId);
      
      const totalTimeSpent = allProgress.reduce((sum, progress) => sum + progress.timeSpent, 0);
      const completedCourses = allProgress.filter(progress => progress.overallProgress >= 100).length;
      const activeCourses = allProgress.filter(progress => progress.overallProgress > 0 && progress.overallProgress < 100).length;
      const achievements = allProgress.reduce((all, progress) => {
        return [...all, ...progress.achievements.earnedAchievements];
      }, [] as string[]);

      return {
        courses: allProgress,
        totalTimeSpent,
        completedCourses,
        activeCourses,
        achievements: [...new Set(achievements)] // Remove duplicates
      };
    } catch (error) {
      console.error('Failed to hydrate app state:', error);
      return {
        courses: [],
        totalTimeSpent: 0,
        completedCourses: 0,
        activeCourses: 0,
        achievements: []
      };
    }
  }

  // Get learning analytics
  async getLearningAnalytics(userId: string): Promise<{
    weeklyProgress: number[];
    dailyActiveTime: number[];
    completionRate: number;
    averageQuizScore: number;
    streakDays: number;
    totalInteractions: number;
  }> {
    try {
      const allProgress = await this.getAllProgress(userId);
      
      // Calculate analytics
      const totalLessons = allProgress.reduce((sum, progress) => sum + progress.completedLessons.length, 0);
      const totalQuizzes = allProgress.reduce((sum, progress) => sum + Object.keys(progress.quizScores).length, 0);
      const totalQuizScore = allProgress.reduce((sum, progress) => {
        return sum + Object.values(progress.quizScores).reduce((quizSum: number, quiz: any) => {
          return quizSum + quiz.bestPercentage;
        }, 0);
      }, 0);

      const totalInteractions = allProgress.reduce((sum, progress) => {
        return sum + Object.values(progress.lessonProgress).reduce((lessonSum: number, lesson: any) => {
          return lessonSum + lesson.interactions.length;
        }, 0);
      }, 0);

      return {
        weeklyProgress: [0, 0, 0, 0, 0, 0, 0], // This would need real calculation
        dailyActiveTime: [0, 0, 0, 0, 0, 0, 0], // This would need real calculation
        completionRate: totalLessons > 0 ? (totalLessons / (totalLessons + 10)) * 100 : 0, // Rough calculation
        averageQuizScore: totalQuizzes > 0 ? totalQuizScore / totalQuizzes : 0,
        streakDays: allProgress[0]?.engagement.streakDays || 0,
        totalInteractions
      };
    } catch (error) {
      console.error('Failed to get learning analytics:', error);
      return {
        weeklyProgress: [0, 0, 0, 0, 0, 0, 0],
        dailyActiveTime: [0, 0, 0, 0, 0, 0, 0],
        completionRate: 0,
        averageQuizScore: 0,
        streakDays: 0,
        totalInteractions: 0
      };
    }
  }

  // Clear cache
  clearCache(): void {
    this.progressCache.clear();
  }

  // Get cache size
  getCacheSize(): number {
    return this.progressCache.size;
  }
}

// Create singleton instance
export const progressManager = new ProgressManager(); 