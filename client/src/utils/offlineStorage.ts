/**
 * Simple offline storage utility
 * Basic localStorage wrapper for offline data management
 */

export interface OfflineAction {
  id: string;
  type: string;
  data: any;
  timestamp: number;
  userId: string;
}

export interface OfflineProgress {
  courseId: string;
  lessonId: string;
  progress: number;
  completedAt?: string;
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  courseId: string;
  answers: any;
  score?: number;
  submittedAt: string;
}

class SimpleOfflineStorage {
  private static instance: SimpleOfflineStorage;

  static getInstance(): SimpleOfflineStorage {
    if (!SimpleOfflineStorage.instance) {
      SimpleOfflineStorage.instance = new SimpleOfflineStorage();
    }
    return SimpleOfflineStorage.instance;
  }

  // Save progress data
  async saveProgress(userId: string, progressData: OfflineProgress): Promise<void> {
    try {
      const key = `progress_${userId}_${progressData.courseId}`;
      localStorage.setItem(key, JSON.stringify(progressData));
    } catch (error) {
      console.warn('Failed to save progress:', error);
    }
  }

  // Get progress data
  async getProgress(userId: string, courseId: string): Promise<OfflineProgress | null> {
    try {
      const key = `progress_${userId}_${courseId}`;
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      return null;
    }
  }

  // Queue offline actions
  async queueAction(action: OfflineAction): Promise<void> {
    try {
      const key = 'offline_actions';
      const existing = localStorage.getItem(key);
      const actions = existing ? JSON.parse(existing) : [];
      actions.push(action);
      localStorage.setItem(key, JSON.stringify(actions));
    } catch (error) {
      console.warn('Failed to queue action:', error);
    }
  }

  // Get queued actions
  async getQueuedActions(): Promise<OfflineAction[]> {
    try {
      const key = 'offline_actions';
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      return [];
    }
  }

  // Clear queued actions
  async clearQueuedActions(): Promise<void> {
    try {
      localStorage.removeItem('offline_actions');
    } catch (error) {
      console.warn('Failed to clear queued actions:', error);
    }
  }

  // Save quiz attempt
  async saveQuizAttempt(attempt: QuizAttempt): Promise<void> {
    try {
      const key = `quiz_attempts_${attempt.quizId}`;
      const existing = localStorage.getItem(key);
      const attempts = existing ? JSON.parse(existing) : [];
      attempts.push(attempt);
      localStorage.setItem(key, JSON.stringify(attempts));
    } catch (error) {
      console.warn('Failed to save quiz attempt:', error);
    }
  }
}

export const offlineStorage = SimpleOfflineStorage.getInstance(); 