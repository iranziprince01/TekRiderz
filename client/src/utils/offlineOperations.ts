/**
 * Offline Operations Manager for TekRiders Platform
 * Handles operations that need to be synced when coming back online
 */

interface OfflineOperation {
  id: string;
  type: 'enrollment' | 'quiz_submission' | 'profile_edit' | 'video_progress' | 'course_completion';
  data: any;
  timestamp: number;
  userId: string;
  status: 'pending' | 'syncing' | 'completed' | 'failed';
  retryCount: number;
}

class OfflineOperationsManager {
  private static instance: OfflineOperationsManager;
  private readonly DB_NAME = 'tekriders_offline_ops';
  private readonly MAX_RETRIES = 3;
  private operations: Map<string, OfflineOperation> = new Map();

  static getInstance(): OfflineOperationsManager {
    if (!OfflineOperationsManager.instance) {
      OfflineOperationsManager.instance = new OfflineOperationsManager();
    }
    return OfflineOperationsManager.instance;
  }

  constructor() {
    this.loadOperations();
  }

  /**
   * Load operations from localStorage (simple fallback instead of PouchDB for now)
   */
  private loadOperations(): void {
    try {
      const stored = localStorage.getItem(this.DB_NAME);
      if (stored) {
        const ops = JSON.parse(stored) as OfflineOperation[];
        ops.forEach(op => this.operations.set(op.id, op));
      }
    } catch (error) {
      console.warn('Failed to load offline operations:', error);
    }
  }

  /**
   * Save operations to localStorage
   */
  private saveOperations(): void {
    try {
      const ops = Array.from(this.operations.values());
      localStorage.setItem(this.DB_NAME, JSON.stringify(ops));
    } catch (error) {
      console.warn('Failed to save offline operations:', error);
    }
  }

  /**
   * Add an offline operation to the queue
   */
  addOperation(type: OfflineOperation['type'], data: any, userId: string): string {
    const id = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const operation: OfflineOperation = {
      id,
      type,
      data,
      timestamp: Date.now(),
      userId,
      status: 'pending',
      retryCount: 0
    };

    this.operations.set(id, operation);
    this.saveOperations();
    
    console.log(`📝 Offline operation queued: ${type}`, { id, userId });
    return id;
  }

  /**
   * Handle offline enrollment
   */
  async enrollInCourse(courseId: string, userId: string): Promise<void> {
    const enrollmentData = {
      courseId,
      enrolledAt: new Date().toISOString(),
      status: 'active'
    };

    this.addOperation('enrollment', enrollmentData, userId);

    // Update local cache to show enrollment immediately
    try {
      const enrolledCourses = JSON.parse(localStorage.getItem(`tekr_1.0.0_enrollments_${userId}`) || '{"data": [], "timestamp": 0, "expiry": 0}');
      if (enrolledCourses.data) {
        // Add course to enrolled courses if not already there
        const existingEnrollment = enrolledCourses.data.find((course: any) => course.id === courseId || course._id === courseId);
        if (!existingEnrollment) {
          // We'll need to get the course details from the courses cache
          const allCourses = JSON.parse(localStorage.getItem('tekr_1.0.0_courses') || '{"data": [], "timestamp": 0, "expiry": 0}');
          const courseDetails = allCourses.data?.find((course: any) => course.id === courseId || course._id === courseId);
          
          if (courseDetails) {
            enrolledCourses.data.push({
              ...courseDetails,
              enrollment: enrollmentData
            });
            localStorage.setItem(`tekr_1.0.0_enrollments_${userId}`, JSON.stringify(enrolledCourses));
          }
        }
      }
    } catch (error) {
      console.warn('Failed to update local enrollment cache:', error);
    }
  }

  /**
   * Handle offline quiz submission
   */
  async submitQuiz(quizData: any, userId: string): Promise<void> {
    this.addOperation('quiz_submission', quizData, userId);
  }

  /**
   * Handle offline profile edit
   */
  async updateProfile(profileData: any, userId: string): Promise<void> {
    this.addOperation('profile_edit', profileData, userId);

    // Update local profile cache immediately
    try {
      const profileCache = JSON.parse(localStorage.getItem(`tekr_1.0.0_profile_${userId}`) || '{"data": null, "timestamp": 0, "expiry": 0}');
      if (profileCache.data) {
        // Merge the new profile data
        profileCache.data = { ...profileCache.data, ...profileData };
        localStorage.setItem(`tekr_1.0.0_profile_${userId}`, JSON.stringify(profileCache));
      }
    } catch (error) {
      console.warn('Failed to update local profile cache:', error);
    }
  }

  /**
   * Handle offline video progress tracking
   */
  async updateVideoProgress(progressData: any, userId: string): Promise<void> {
    this.addOperation('video_progress', progressData, userId);
  }

  /**
   * Handle offline course completion
   */
  async completeCourse(completionData: any, userId: string): Promise<void> {
    this.addOperation('course_completion', completionData, userId);
  }

  /**
   * Sync all pending operations when coming back online
   */
  async syncPendingOperations(apiClient: any): Promise<void> {
    const pendingOps = Array.from(this.operations.values())
      .filter(op => op.status === 'pending' || op.status === 'failed')
      .sort((a, b) => a.timestamp - b.timestamp); // Sync in chronological order

    if (pendingOps.length === 0) {
      return;
    }

    console.log(`🔄 Syncing ${pendingOps.length} pending operations...`);

    for (const operation of pendingOps) {
      try {
        await this.syncOperation(operation, apiClient);
      } catch (error) {
        console.error(`Failed to sync operation ${operation.id}:`, error);
      }
    }
  }

  /**
   * Sync a single operation
   */
  private async syncOperation(operation: OfflineOperation, apiClient: any): Promise<void> {
    operation.status = 'syncing';
    this.saveOperations();

    try {
      let response;

      switch (operation.type) {
        case 'enrollment':
          response = await apiClient.enrollInCourse(operation.data.courseId);
          break;
        
        case 'quiz_submission':
          response = await apiClient.submitQuiz(operation.data);
          break;
        
        case 'profile_edit':
          response = await apiClient.updateUserProfile(operation.data);
          break;
        
        case 'video_progress':
          response = await apiClient.updateProgress(operation.data);
          break;
        
        case 'course_completion':
          response = await apiClient.completeCourse(operation.data);
          break;
        
        default:
          throw new Error(`Unknown operation type: ${operation.type}`);
      }

      if (response?.success) {
        operation.status = 'completed';
        console.log(`✅ Successfully synced ${operation.type} operation`);
        
        // Remove completed operations after a delay
        setTimeout(() => {
          this.operations.delete(operation.id);
          this.saveOperations();
        }, 5000);
      } else {
        throw new Error(response?.error || 'Sync failed');
      }

    } catch (error) {
      operation.retryCount++;
      
      if (operation.retryCount >= this.MAX_RETRIES) {
        operation.status = 'failed';
        console.error(`❌ Operation ${operation.id} failed after ${this.MAX_RETRIES} retries:`, error);
      } else {
        operation.status = 'pending';
        console.warn(`⚠️ Operation ${operation.id} failed, will retry (${operation.retryCount}/${this.MAX_RETRIES}):`, error);
      }
    }

    this.saveOperations();
  }

  /**
   * Get pending operations count for a user
   */
  getPendingCount(userId?: string): number {
    return Array.from(this.operations.values())
      .filter(op => 
        (op.status === 'pending' || op.status === 'failed') &&
        (!userId || op.userId === userId)
      ).length;
  }

  /**
   * Clear all operations for a user
   */
  clearUserOperations(userId: string): void {
    const userOps = Array.from(this.operations.entries())
      .filter(([_, op]) => op.userId === userId);
    
    userOps.forEach(([id]) => this.operations.delete(id));
    this.saveOperations();
  }

  /**
   * Clear all completed operations
   */
  clearCompletedOperations(): void {
    const completedOps = Array.from(this.operations.entries())
      .filter(([_, op]) => op.status === 'completed');
    
    completedOps.forEach(([id]) => this.operations.delete(id));
    this.saveOperations();
  }
}

export const offlineOperations = OfflineOperationsManager.getInstance();
export type { OfflineOperation }; 