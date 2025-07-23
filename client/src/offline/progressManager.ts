import { localDB } from './db';

export interface ProgressData {
  _id?: string;
  _rev?: string;
  type: 'progress';
  userId: string;
  courseId: string;
  lessonId?: string;
  moduleId?: string;
  progress: {
    percentage: number;
    timeSpent: number;
    currentPosition?: number;
    isCompleted: boolean;
    completedAt?: string;
    lastUpdated: string;
    interactions?: any[];
    notes?: any[];
    bookmarks?: any[];
  };
  metadata?: {
    courseTitle?: string;
    lessonTitle?: string;
    moduleTitle?: string;
    instructorName?: string;
  };
}

export interface CourseProgress {
  courseId: string;
  totalLessons: number;
  completedLessons: number;
  totalTimeSpent: number;
  overallPercentage: number;
  lastActivity: string;
  lessons: {
    [lessonId: string]: ProgressData['progress'];
  };
}

class ProgressManager {
  private db: any;

  constructor() {
    this.db = localDB;
  }

  /**
   * Save or update progress for a specific lesson
   */
  async saveProgress(progressData: Omit<ProgressData, '_id' | '_rev' | 'type'>): Promise<boolean> {
    try {
      if (!this.db) {
        console.warn('Database not available, using localStorage fallback');
        return this.saveProgressToLocalStorage(progressData);
      }

      const docId = `progress_${progressData.userId}_${progressData.courseId}_${progressData.lessonId || 'overall'}`;
      
      // Try to get existing progress
      let existingDoc: any = null;
      try {
        existingDoc = await this.db.get(docId);
      } catch (error) {
        // Document doesn't exist, will create new one
      }

      const progressDoc: ProgressData = {
        _id: docId,
        type: 'progress',
        userId: progressData.userId,
        courseId: progressData.courseId,
        lessonId: progressData.lessonId,
        moduleId: progressData.moduleId,
        progress: {
          ...progressData.progress,
          lastUpdated: new Date().toISOString()
        },
        metadata: progressData.metadata
      };

      // If document exists, preserve _rev
      if (existingDoc) {
        progressDoc._rev = existingDoc._rev;
      }

      const result = await this.db.put(progressDoc);
      console.log('✅ Progress saved successfully:', {
        docId,
        percentage: progressData.progress.percentage,
        isCompleted: progressData.progress.isCompleted
      });

      // Also save to localStorage as backup
      this.saveProgressToLocalStorage(progressData);

      return result.ok;
    } catch (error) {
      console.error('❌ Failed to save progress to database:', error);
      
      // Fallback to localStorage
      return this.saveProgressToLocalStorage(progressData);
    }
  }

  /**
   * Get progress for a specific lesson
   */
  async getProgress(userId: string, courseId: string, lessonId?: string): Promise<ProgressData['progress'] | null> {
    try {
      if (!this.db) {
        console.warn('Database not available, using localStorage fallback');
        return this.getProgressFromLocalStorage(userId, courseId, lessonId);
      }

      const docId = `progress_${userId}_${courseId}_${lessonId || 'overall'}`;
      const doc = await this.db.get(docId);
      
      if (doc && doc.type === 'progress') {
        console.log('📊 Retrieved progress from database:', {
          docId,
          percentage: doc.progress.percentage,
          isCompleted: doc.progress.isCompleted
        });
        return doc.progress;
      }
    } catch (error) {
      console.warn('Failed to get progress from database, trying localStorage:', error);
    }

    // Fallback to localStorage
    return this.getProgressFromLocalStorage(userId, courseId, lessonId);
  }

  /**
   * Get overall course progress
   */
  async getCourseProgress(userId: string, courseId: string): Promise<CourseProgress | null> {
    try {
      if (!this.db) {
        console.warn('Database not available, using localStorage fallback');
        return this.getCourseProgressFromLocalStorage(userId, courseId);
      }

      // Get all progress documents for this user and course
      const result = await this.db.allDocs({
        include_docs: true,
        startkey: `progress_${userId}_${courseId}_`,
        endkey: `progress_${userId}_${courseId}_\ufff0`
      });

      if (result.rows.length === 0) {
        return null;
      }

      const lessons: { [lessonId: string]: ProgressData['progress'] } = {};
      let totalTimeSpent = 0;
      let completedLessons = 0;
      let lastActivity = '';

      result.rows.forEach((row: any) => {
        const doc = row.doc as ProgressData;
        if (doc.type === 'progress' && doc.lessonId) {
          lessons[doc.lessonId] = doc.progress;
          totalTimeSpent += doc.progress.timeSpent || 0;
          
          if (doc.progress.isCompleted) {
            completedLessons++;
          }

          if (doc.progress.lastUpdated > lastActivity) {
            lastActivity = doc.progress.lastUpdated;
          }
        }
      });

      const totalLessons = Object.keys(lessons).length;
      const overallPercentage = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;

      const courseProgress: CourseProgress = {
        courseId,
        totalLessons,
        completedLessons,
        totalTimeSpent,
        overallPercentage,
        lastActivity,
        lessons
      };

      console.log('📊 Retrieved course progress from database:', {
        courseId,
        totalLessons,
        completedLessons,
        overallPercentage: `${overallPercentage.toFixed(1)}%`
      });

      return courseProgress;
    } catch (error) {
      console.error('❌ Failed to get course progress from database:', error);
      
      // Fallback to localStorage
      return this.getCourseProgressFromLocalStorage(userId, courseId);
    }
  }

  /**
   * Get all progress for a user
   */
  async getAllUserProgress(userId: string): Promise<ProgressData[]> {
    try {
      if (!this.db) {
        console.warn('Database not available, using localStorage fallback');
        return this.getAllUserProgressFromLocalStorage(userId);
      }

      const result = await this.db.allDocs({
        include_docs: true,
        startkey: `progress_${userId}_`,
        endkey: `progress_${userId}_\ufff0`
      });

      return result.rows
        .map((row: any) => row.doc as ProgressData)
        .filter((doc: ProgressData) => doc.type === 'progress');
    } catch (error) {
      console.error('❌ Failed to get all user progress from database:', error);
      
      // Fallback to localStorage
      return this.getAllUserProgressFromLocalStorage(userId);
    }
  }

  /**
   * Delete progress for a specific lesson
   */
  async deleteProgress(userId: string, courseId: string, lessonId?: string): Promise<boolean> {
    try {
      if (!this.db) {
        console.warn('Database not available, using localStorage fallback');
        return this.deleteProgressFromLocalStorage(userId, courseId, lessonId);
      }

      const docId = `progress_${userId}_${courseId}_${lessonId || 'overall'}`;
      const doc = await this.db.get(docId);
      await this.db.remove(doc);
      
      console.log('🗑️ Progress deleted successfully:', docId);
      return true;
    } catch (error) {
      console.error('❌ Failed to delete progress from database:', error);
      
      // Fallback to localStorage
      return this.deleteProgressFromLocalStorage(userId, courseId, lessonId);
    }
  }

  /**
   * Clear all progress for a user
   */
  async clearAllProgress(userId: string): Promise<boolean> {
    try {
      if (!this.db) {
        console.warn('Database not available, using localStorage fallback');
        return this.clearAllProgressFromLocalStorage(userId);
      }

      const result = await this.db.allDocs({
        startkey: `progress_${userId}_`,
        endkey: `progress_${userId}_\ufff0`
      });

      const deletePromises = result.rows.map(async (row: any) => {
        try {
          const doc = await this.db.get(row.id);
          await this.db.remove(doc);
        } catch (error) {
          console.warn('Failed to delete progress document:', row.id, error);
        }
      });

      await Promise.all(deletePromises);
      console.log('🗑️ All progress cleared successfully for user:', userId);
      return true;
    } catch (error) {
      console.error('❌ Failed to clear all progress from database:', error);
      
      // Fallback to localStorage
      return this.clearAllProgressFromLocalStorage(userId);
    }
  }

  // LocalStorage fallback methods
  private saveProgressToLocalStorage(progressData: Omit<ProgressData, '_id' | '_rev' | 'type'>): boolean {
    try {
      const key = `progress_${progressData.userId}_${progressData.courseId}_${progressData.lessonId || 'overall'}`;
      const data = {
        ...progressData,
        type: 'progress',
        lastUpdated: new Date().toISOString()
      };
      
      localStorage.setItem(key, JSON.stringify(data));
      console.log('💾 Progress saved to localStorage:', key);
      return true;
    } catch (error) {
      console.error('❌ Failed to save progress to localStorage:', error);
      return false;
    }
  }

  private getProgressFromLocalStorage(userId: string, courseId: string, lessonId?: string): ProgressData['progress'] | null {
    try {
      const key = `progress_${userId}_${courseId}_${lessonId || 'overall'}`;
      const data = localStorage.getItem(key);
      
      if (data) {
        const parsed = JSON.parse(data);
        console.log('📊 Retrieved progress from localStorage:', key);
        return parsed.progress;
      }
    } catch (error) {
      console.error('❌ Failed to get progress from localStorage:', error);
    }
    
    return null;
  }

  private getCourseProgressFromLocalStorage(userId: string, courseId: string): CourseProgress | null {
    try {
      const lessons: { [lessonId: string]: ProgressData['progress'] } = {};
      let totalTimeSpent = 0;
      let completedLessons = 0;
      let lastActivity = '';

      // Get all localStorage keys for this user and course
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`progress_${userId}_${courseId}_`) && key !== `progress_${userId}_${courseId}_overall`) {
          try {
            const data = JSON.parse(localStorage.getItem(key) || '');
            if (data.type === 'progress' && data.lessonId) {
              lessons[data.lessonId] = data.progress;
              totalTimeSpent += data.progress.timeSpent || 0;
              
              if (data.progress.isCompleted) {
                completedLessons++;
              }

              if (data.progress.lastUpdated > lastActivity) {
                lastActivity = data.progress.lastUpdated;
              }
            }
          } catch (error) {
            console.warn('Failed to parse localStorage progress:', key, error);
          }
        }
      }

      const totalLessons = Object.keys(lessons).length;
      const overallPercentage = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;

      return {
        courseId,
        totalLessons,
        completedLessons,
        totalTimeSpent,
        overallPercentage,
        lastActivity,
        lessons
      };
    } catch (error) {
      console.error('❌ Failed to get course progress from localStorage:', error);
      return null;
    }
  }

  private getAllUserProgressFromLocalStorage(userId: string): ProgressData[] {
    try {
      const progress: ProgressData[] = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`progress_${userId}_`)) {
          try {
            const data = JSON.parse(localStorage.getItem(key) || '');
            if (data.type === 'progress') {
              progress.push(data);
            }
          } catch (error) {
            console.warn('Failed to parse localStorage progress:', key, error);
          }
        }
      }
      
      return progress;
    } catch (error) {
      console.error('❌ Failed to get all user progress from localStorage:', error);
      return [];
    }
  }

  private deleteProgressFromLocalStorage(userId: string, courseId: string, lessonId?: string): boolean {
    try {
      const key = `progress_${userId}_${courseId}_${lessonId || 'overall'}`;
      localStorage.removeItem(key);
      console.log('🗑️ Progress deleted from localStorage:', key);
      return true;
    } catch (error) {
      console.error('❌ Failed to delete progress from localStorage:', error);
      return false;
    }
  }

  private clearAllProgressFromLocalStorage(userId: string): boolean {
    try {
      const keysToRemove: string[] = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`progress_${userId}_`)) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => localStorage.removeItem(key));
      console.log('🗑️ All progress cleared from localStorage for user:', userId);
      return true;
    } catch (error) {
      console.error('❌ Failed to clear all progress from localStorage:', error);
      return false;
    }
  }

  /**
   * Sync progress with remote server when online
   */
  async syncProgressWithServer(userId: string, courseId: string): Promise<boolean> {
    try {
      const courseProgress = await this.getCourseProgress(userId, courseId);
      if (!courseProgress) {
        console.log('No local progress to sync');
        return true;
      }

      // Here you would implement the actual sync with your backend
      // For now, we'll just log the sync attempt
      console.log('🔄 Syncing progress with server:', {
        courseId,
        overallPercentage: `${courseProgress.overallPercentage.toFixed(1)}%`,
        completedLessons: courseProgress.completedLessons,
        totalLessons: courseProgress.totalLessons
      });

      return true;
    } catch (error) {
      console.error('❌ Failed to sync progress with server:', error);
      return false;
    }
  }

  /**
   * Get database info for debugging
   */
  async getDatabaseInfo(): Promise<any> {
    try {
      if (!this.db) {
        return { status: 'fallback', name: 'localStorage' };
      }

      const info = await this.db.info();
      const allDocs = await this.db.allDocs({ include_docs: true });
      
      return {
        status: 'active',
        name: info.db_name,
        docCount: info.doc_count,
        progressDocs: allDocs.rows.filter((row: any) => row.doc?.type === 'progress').length
      };
    } catch (error) {
      console.error('❌ Failed to get database info:', error);
      return { status: 'error', error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

// Export singleton instance
export const progressManager = new ProgressManager();

// Export convenience functions
export const saveProgress = (progressData: Omit<ProgressData, '_id' | '_rev' | 'type'>) => 
  progressManager.saveProgress(progressData);

export const getProgress = (userId: string, courseId: string, lessonId?: string) => 
  progressManager.getProgress(userId, courseId, lessonId);

export const getCourseProgress = (userId: string, courseId: string) => 
  progressManager.getCourseProgress(userId, courseId);

export const getAllUserProgress = (userId: string) => 
  progressManager.getAllUserProgress(userId);

export const deleteProgress = (userId: string, courseId: string, lessonId?: string) => 
  progressManager.deleteProgress(userId, courseId, lessonId);

export const clearAllProgress = (userId: string) => 
  progressManager.clearAllProgress(userId);

export const syncProgressWithServer = (userId: string, courseId: string) => 
  progressManager.syncProgressWithServer(userId, courseId);

export const getDatabaseInfo = () => 
  progressManager.getDatabaseInfo(); 