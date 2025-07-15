/**
 * Simplified Progress Manager for TekRiders
 * Lightweight replacement for complex progressManager.ts
 */

import { offlineStorage } from './offlineStorage';
import { apiClient } from './api';

// ================ INTERFACES ================

export interface LessonProgress {
  startedAt: string;
  completedAt?: string;
  timeSpent: number;
  lastPosition?: number;
  interactions: Array<{
    type: string;
    timestamp: string;
    data: any;
  }>;
  notes: Array<{
    id: string;
    timestamp: number;
    content: string;
  }>;
  bookmarks: Array<{
    id: string;
    timestamp: number;
    title: string;
  }>;
}

export interface CourseProgressData {
  userId: string;
  courseId: string;
  enrollmentDate: string;
  lastAccessedAt: string;
  overallProgress: number;
  lessons: Record<string, LessonProgress>;
  quizzes: Record<string, {
    bestScore: number;
    attempts: Array<{
      score: number;
      maxScore: number;
      percentage: number;
      passed: boolean;
      completedAt: string;
      timeSpent: number;
    }>;
  }>;
  certificates: string[];
  timeSpent: number;
  isCompleted: boolean;
  completedAt?: string;
  lastModifiedAt: number;
  pendingChanges: boolean;
}

// ================ SIMPLE PROGRESS MANAGER ================

class SimpleProgressManager {
  private progressCache = new Map<string, CourseProgressData>();

  // Initialize progress for a user and course
  async initializeProgress(userId: string, courseId: string): Promise<CourseProgressData> {
    const progressId = `${userId}-${courseId}`;
    
    // Check cache first
    if (this.progressCache.has(progressId)) {
      return this.progressCache.get(progressId)!;
    }

    // Try to load from storage
    const stored = localStorage.getItem(`progress_${progressId}`);
    if (stored) {
      try {
        const progress = JSON.parse(stored);
        this.progressCache.set(progressId, progress);
        return progress;
      } catch (error) {
        console.warn('Failed to parse stored progress:', error);
      }
    }

    // Create new progress
    const progress: CourseProgressData = {
      userId,
      courseId,
      enrollmentDate: new Date().toISOString(),
      lastAccessedAt: new Date().toISOString(),
      overallProgress: 0,
      lessons: {},
      quizzes: {},
      certificates: [],
      timeSpent: 0,
      isCompleted: false,
      lastModifiedAt: Date.now(),
      pendingChanges: false
    };

    await this.saveProgress(progress);
    return progress;
  }

  // Get progress for user and course
  async getProgress(userId: string, courseId: string): Promise<CourseProgressData> {
    return this.initializeProgress(userId, courseId);
  }

  // Start a lesson
  async startLesson(userId: string, courseId: string, lessonId: string, sectionId: string): Promise<void> {
    const progress = await this.getProgress(userId, courseId);
    
    if (!progress.lessons[lessonId]) {
      progress.lessons[lessonId] = {
        startedAt: new Date().toISOString(),
        timeSpent: 0,
        interactions: [],
        notes: [],
        bookmarks: []
      };
    }

    progress.lastAccessedAt = new Date().toISOString();
    progress.lastModifiedAt = Date.now();
    progress.pendingChanges = true;

    await this.saveProgress(progress);
    await this.queueSyncAction('lesson_start', { userId, courseId, lessonId, sectionId });
  }

  // Complete a lesson
  async completeLesson(userId: string, courseId: string, lessonId: string, sectionId: string, timeSpent: number = 0): Promise<void> {
    const progress = await this.getProgress(userId, courseId);
    
    if (!progress.lessons[lessonId]) {
      progress.lessons[lessonId] = {
        startedAt: new Date().toISOString(),
        timeSpent: 0,
        interactions: [],
        notes: [],
        bookmarks: []
      };
    }

    progress.lessons[lessonId].completedAt = new Date().toISOString();
    progress.lessons[lessonId].timeSpent += timeSpent;
    progress.timeSpent += timeSpent;
    progress.lastAccessedAt = new Date().toISOString();
    progress.lastModifiedAt = Date.now();
    progress.pendingChanges = true;

    // Recalculate overall progress
    progress.overallProgress = this.calculateOverallProgress(progress);

    await this.saveProgress(progress);
    await this.queueSyncAction('lesson_complete', { 
      userId, courseId, lessonId, sectionId, timeSpent, 
      overallProgress: progress.overallProgress 
    });
  }

  // Update lesson position (for videos)
  async updateLessonPosition(userId: string, courseId: string, lessonId: string, position: number): Promise<void> {
    const progress = await this.getProgress(userId, courseId);
    
    if (!progress.lessons[lessonId]) {
      progress.lessons[lessonId] = {
        startedAt: new Date().toISOString(),
        timeSpent: 0,
        interactions: [],
        notes: [],
        bookmarks: []
      };
    }

    progress.lessons[lessonId].lastPosition = position;
    progress.lastAccessedAt = new Date().toISOString();
    progress.lastModifiedAt = Date.now();
    progress.pendingChanges = true;

    await this.saveProgress(progress);
  }

  // Add interaction
  async addInteraction(userId: string, courseId: string, lessonId: string, interaction: { type: string; data: any }): Promise<void> {
    const progress = await this.getProgress(userId, courseId);
    
    if (!progress.lessons[lessonId]) {
      progress.lessons[lessonId] = {
        startedAt: new Date().toISOString(),
        timeSpent: 0,
        interactions: [],
        notes: [],
        bookmarks: []
      };
    }

    progress.lessons[lessonId].interactions.push({
      ...interaction,
      timestamp: new Date().toISOString()
    });

    progress.lastAccessedAt = new Date().toISOString();
    progress.lastModifiedAt = Date.now();
    progress.pendingChanges = true;

    await this.saveProgress(progress);
  }

  // Add note
  async addNote(userId: string, courseId: string, lessonId: string, note: { timestamp: number; content: string }): Promise<void> {
    const progress = await this.getProgress(userId, courseId);
    
    if (!progress.lessons[lessonId]) {
      progress.lessons[lessonId] = {
        startedAt: new Date().toISOString(),
        timeSpent: 0,
        interactions: [],
        notes: [],
        bookmarks: []
      };
    }

    progress.lessons[lessonId].notes.push({
      id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...note
    });

    progress.lastAccessedAt = new Date().toISOString();
    progress.lastModifiedAt = Date.now();
    progress.pendingChanges = true;

    await this.saveProgress(progress);
  }

  // Add bookmark
  async addBookmark(userId: string, courseId: string, lessonId: string, bookmark: { timestamp: number; title: string }): Promise<void> {
    const progress = await this.getProgress(userId, courseId);
    
    if (!progress.lessons[lessonId]) {
      progress.lessons[lessonId] = {
        startedAt: new Date().toISOString(),
        timeSpent: 0,
        interactions: [],
        notes: [],
        bookmarks: []
      };
    }

    progress.lessons[lessonId].bookmarks.push({
      id: `bookmark-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...bookmark
    });

    progress.lastAccessedAt = new Date().toISOString();
    progress.lastModifiedAt = Date.now();
    progress.pendingChanges = true;

    await this.saveProgress(progress);
  }

  // Update quiz score
  async updateQuizScore(userId: string, courseId: string, quizId: string, score: {
    score: number;
    maxScore: number;
    percentage: number;
    passed: boolean;
    answers: any[];
    timeSpent: number;
  }): Promise<void> {
    const progress = await this.getProgress(userId, courseId);
    
    if (!progress.quizzes[quizId]) {
      progress.quizzes[quizId] = {
        bestScore: 0,
        attempts: []
      };
    }

    const attempt = {
      score: score.score,
      maxScore: score.maxScore,
      percentage: score.percentage,
      passed: score.passed,
      completedAt: new Date().toISOString(),
      timeSpent: score.timeSpent
    };

    progress.quizzes[quizId].attempts.push(attempt);
    progress.quizzes[quizId].bestScore = Math.max(progress.quizzes[quizId].bestScore, score.percentage);
    progress.timeSpent += score.timeSpent;
    progress.lastAccessedAt = new Date().toISOString();
    progress.lastModifiedAt = Date.now();
    progress.pendingChanges = true;

    await this.saveProgress(progress);
    await this.queueSyncAction('quiz_complete', { userId, courseId, quizId, score: attempt });
  }

  // Sync progress with server
  async syncProgress(userId: string, courseId: string): Promise<boolean> {
    try {
      const progress = await this.getProgress(userId, courseId);
      
      if (!navigator.onLine) {
        return false;
      }

      // Simple sync - just send the progress data
      await apiClient.post(`/api/progress/${courseId}`, progress);
      
      progress.pendingChanges = false;
      progress.lastModifiedAt = Date.now();
      await this.saveProgress(progress);
      
      return true;
    } catch (error) {
      console.warn('Sync failed:', error);
      return false;
    }
  }

  // Get learning analytics
  async getLearningAnalytics(userId: string): Promise<any> {
    // Simple analytics from localStorage data
    const keys = Object.keys(localStorage);
    const progressKeys = keys.filter(key => key.startsWith(`progress_${userId}-`));
    
    const analytics = {
      totalCourses: progressKeys.length,
      completedCourses: 0,
      totalTimeSpent: 0,
      averageProgress: 0
    };

    let totalProgress = 0;

    for (const key of progressKeys) {
      try {
        const data = JSON.parse(localStorage.getItem(key) || '{}');
        if (data.isCompleted) analytics.completedCourses++;
        analytics.totalTimeSpent += data.timeSpent || 0;
        totalProgress += data.overallProgress || 0;
      } catch (error) {
        console.warn('Failed to parse progress data:', error);
      }
    }

    analytics.averageProgress = progressKeys.length > 0 ? totalProgress / progressKeys.length : 0;

    return analytics;
  }

  // Hydrate app state
  async hydrateAppState(userId: string): Promise<any> {
    return {
      isHydrated: true,
      timestamp: Date.now()
    };
  }

  // ================ PRIVATE METHODS ================

  private async saveProgress(progress: CourseProgressData): Promise<void> {
    const progressId = `${progress.userId}-${progress.courseId}`;
    this.progressCache.set(progressId, progress);
    localStorage.setItem(`progress_${progressId}`, JSON.stringify(progress));
  }

  private calculateOverallProgress(progress: CourseProgressData): number {
    const lessons = Object.values(progress.lessons);
    if (lessons.length === 0) return 0;
    
    const completedLessons = lessons.filter(lesson => lesson.completedAt).length;
    return Math.round((completedLessons / lessons.length) * 100);
  }

  private async queueSyncAction(type: string, data: any): Promise<void> {
    await offlineStorage.queueAction({
      id: `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      data,
      timestamp: Date.now(),
      userId: data.userId
    });
  }
}

// Create and export singleton instance
export const progressManager = new SimpleProgressManager();
export default progressManager; 