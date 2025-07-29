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
      
      try {
        const doc = await this.db.get(docId) as ProgressData;
        console.log('✅ Progress retrieved from database:', {
          docId,
          percentage: doc.progress.percentage,
          isCompleted: doc.progress.isCompleted
        });
        return doc.progress;
      } catch (error: any) {
        if (error.name === 'not_found') {
          console.log('No progress found for:', docId);
          return null;
        }
        throw error;
      }
    } catch (error) {
      console.error('❌ Failed to get progress from database:', error);
      
      // Fallback to localStorage
      return this.getProgressFromLocalStorage(userId, courseId, lessonId);
    }
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
        console.log('No progress found for course:', courseId);
        return null;
      }

      const lessons: { [lessonId: string]: ProgressData['progress'] } = {};
      let totalTimeSpent = 0;
      let completedLessons = 0;
      let lastActivity = '';

      result.rows.forEach((row: any) => {
        const doc = row.doc as ProgressData;
        const lessonId = doc.lessonId || 'overall';
        
        lessons[lessonId] = doc.progress;
        totalTimeSpent += doc.progress.timeSpent || 0;
        
        if (doc.progress.isCompleted) {
          completedLessons++;
        }
        
        if (doc.progress.lastUpdated > lastActivity) {
          lastActivity = doc.progress.lastUpdated;
        }
      });

      const totalLessons = Object.keys(lessons).length;
      const overallPercentage = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

      const courseProgress: CourseProgress = {
        courseId,
        totalLessons,
        completedLessons,
        totalTimeSpent,
        overallPercentage,
        lastActivity,
        lessons
      };

      console.log('✅ Course progress retrieved:', {
        courseId,
        totalLessons,
        completedLessons,
        overallPercentage
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

      return result.rows.map((row: any) => row.doc as ProgressData);
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
      
      try {
        const doc = await this.db.get(docId);
        const result = await this.db.remove(doc);
        console.log('✅ Progress deleted successfully:', docId);
        return result.ok;
      } catch (error: any) {
        if (error.name === 'not_found') {
          console.log('No progress found to delete:', docId);
          return true;
        }
        throw error;
      }
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

      const deletePromises = result.rows.map((row: any) => 
        this.db.remove(row.id, row.value.rev)
      );

      await Promise.all(deletePromises);
      console.log('✅ All progress cleared for user:', userId);
      return true;
    } catch (error) {
      console.error('❌ Failed to clear all progress from database:', error);
      
      // Fallback to localStorage
      return this.clearAllProgressFromLocalStorage(userId);
    }
  }

  /**
   * Sync progress with server when online
   */
  async syncProgressWithServer(userId: string, courseId: string): Promise<boolean> {
    try {
      console.log('🔄 Syncing progress with server...');
      
      // Get local progress
      const localProgress = await this.getCourseProgress(userId, courseId);
      if (!localProgress) {
        console.log('No local progress to sync');
        return true;
      }

      // TODO: Implement server sync when API is ready
      // For now, just log the sync attempt
      console.log('📊 Progress to sync:', {
        courseId,
        totalLessons: localProgress.totalLessons,
        completedLessons: localProgress.completedLessons,
        overallPercentage: localProgress.overallPercentage
      });

      return true;
    } catch (error) {
      console.error('❌ Failed to sync progress with server:', error);
      return false;
    }
  }

  /**
   * Get database information
   */
  async getDatabaseInfo(): Promise<any> {
    try {
      if (!this.db) {
        return { error: 'Database not available' };
      }

      const info = await this.db.info();
      const allDocs = await this.db.allDocs();
      
      const progressDocs = allDocs.rows.filter((row: any) => row.id.startsWith('progress_'));
      
      return {
        databaseName: info.db_name,
        documentCount: info.doc_count,
        updateSeq: info.update_seq,
        progressDocuments: progressDocs.length,
        totalDocuments: allDocs.rows.length
      };
    } catch (error) {
      console.error('Failed to get database info:', error);
      return { error: 'Failed to get database info' };
    }
  }

  // LocalStorage fallback methods
  private saveProgressToLocalStorage(progressData: Omit<ProgressData, '_id' | '_rev' | 'type'>): boolean {
    try {
      const key = `progress_${progressData.userId}_${progressData.courseId}_${progressData.lessonId || 'overall'}`;
      const data = {
        ...progressData,
        progress: {
          ...progressData.progress,
          lastUpdated: new Date().toISOString()
        }
      };
      
      localStorage.setItem(key, JSON.stringify(data));
      console.log('✅ Progress saved to localStorage:', key);
      return true;
    } catch (error) {
      console.error('Failed to save progress to localStorage:', error);
      return false;
    }
  }

  private getProgressFromLocalStorage(userId: string, courseId: string, lessonId?: string): ProgressData['progress'] | null {
    try {
      const key = `progress_${userId}_${courseId}_${lessonId || 'overall'}`;
      const data = localStorage.getItem(key);
      
      if (data) {
        const parsed = JSON.parse(data);
        return parsed.progress;
      }
      
      return null;
    } catch (error) {
      console.error('Failed to get progress from localStorage:', error);
      return null;
    }
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
        if (key && key.startsWith(`progress_${userId}_${courseId}_`)) {
          try {
            const data = JSON.parse(localStorage.getItem(key) || '');
            const lessonId = data.lessonId || 'overall';
            
            lessons[lessonId] = data.progress;
            totalTimeSpent += data.progress.timeSpent || 0;
            
            if (data.progress.isCompleted) {
              completedLessons++;
            }
            
            if (data.progress.lastUpdated > lastActivity) {
              lastActivity = data.progress.lastUpdated;
            }
          } catch (error) {
            console.warn('Failed to parse localStorage progress:', key);
          }
        }
      }

      if (Object.keys(lessons).length === 0) {
        return null;
      }

      const totalLessons = Object.keys(lessons).length;
      const overallPercentage = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

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
      console.error('Failed to get course progress from localStorage:', error);
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
            progress.push(data);
          } catch (error) {
            console.warn('Failed to parse localStorage progress:', key);
          }
        }
      }

      return progress;
    } catch (error) {
      console.error('Failed to get all user progress from localStorage:', error);
      return [];
    }
  }

  private deleteProgressFromLocalStorage(userId: string, courseId: string, lessonId?: string): boolean {
    try {
      const key = `progress_${userId}_${courseId}_${lessonId || 'overall'}`;
      localStorage.removeItem(key);
      console.log('✅ Progress deleted from localStorage:', key);
      return true;
    } catch (error) {
      console.error('Failed to delete progress from localStorage:', error);
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
      console.log('✅ All progress cleared from localStorage for user:', userId);
      return true;
    } catch (error) {
      console.error('Failed to clear all progress from localStorage:', error);
      return false;
    }
  }
}

const progressManager = new ProgressManager();

// Export functions
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