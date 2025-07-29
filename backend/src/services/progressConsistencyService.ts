import { progressModel } from '../models/Progress';
import { courseModel } from '../models/Course';
import { enrollmentModel } from '../models/Enrollment';

import { logger } from '../utils/logger';
import { Progress } from '../types';

export class ProgressConsistencyService {
  private static instance: ProgressConsistencyService;

  static getInstance(): ProgressConsistencyService {
    if (!ProgressConsistencyService.instance) {
      ProgressConsistencyService.instance = new ProgressConsistencyService();
    }
    return ProgressConsistencyService.instance;
  }

  /**
   * Ensure progress consistency when updating lesson progress
   */
  async updateLessonProgressWithConsistency(
    userId: string,
    courseId: string,
    lessonId: string,
    progressData: {
      timeSpent: number;
      currentPosition: number;
      percentageWatched: number;
      isCompleted: boolean;
      interactions?: any[];
    }
  ): Promise<{
    success: boolean;
    progress: Progress;
    wasCompleted: boolean;
    preserved: boolean;
  }> {
    try {
      logger.info('🔄 Updating lesson progress with consistency checks:', {
        userId,
        courseId,
        lessonId,
        percentageWatched: progressData.percentageWatched,
        isCompleted: progressData.isCompleted
      });

      // Get or create progress record
      const progress = await progressModel.getOrCreateProgress(userId, courseId);
      
      // Check if lesson was already completed
      const existingLessonProgress = progress.lessonProgress?.[lessonId];
      const wasCompleted = !!(existingLessonProgress?.completedAt);
      let preserved = false;

      // Prevent downgrading completed lessons
      if (wasCompleted && !progressData.isCompleted) {
        logger.warn('⚠️ Attempting to mark completed lesson as incomplete, preserving completion status');
        preserved = true;
        
        return {
          success: true,
          progress,
          wasCompleted: true,
          preserved: true
        };
      }

      // Update lesson progress
      const updatedLessonProgress = {
        ...existingLessonProgress,
        timeSpent: Math.max(existingLessonProgress?.timeSpent || 0, progressData.timeSpent),
        lastPosition: progressData.currentPosition,
        interactions: [
          ...(existingLessonProgress?.interactions || []),
          ...(progressData.interactions || []),
          {
            type: 'progress_update',
            timestamp: new Date().toISOString(),
            data: {
              percentageWatched: progressData.percentageWatched,
              timeSpent: progressData.timeSpent,
              currentPosition: progressData.currentPosition,
              isCompleted: progressData.isCompleted
            }
          }
        ],
        startedAt: existingLessonProgress?.startedAt || new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      };

      // Mark as completed if criteria met
      if (progressData.isCompleted || progressData.percentageWatched >= 90) {
        if (!progress.completedLessons.includes(lessonId)) {
          progress.completedLessons.push(lessonId);
          updatedLessonProgress.completedAt = new Date().toISOString();
          
          logger.info('✅ Lesson marked as completed:', {
            userId,
            courseId,
            lessonId,
            percentageWatched: progressData.percentageWatched,
            completedAt: updatedLessonProgress.completedAt
          });
        }
      }

      // Update progress record
      const updatedProgress = await progressModel.update(progress._id!, {
        lessonProgress: {
          ...progress.lessonProgress,
          [lessonId]: updatedLessonProgress
        },
        completedLessons: progress.completedLessons,
        timeSpent: progress.timeSpent + progressData.timeSpent,
        currentLesson: lessonId,
        lastWatched: new Date().toISOString()
      } as Partial<Progress>);

      // Calculate and update overall progress
      const course = await courseModel.findById(courseId);
      const totalLessons = course?.totalLessons || 0;
      const completedLessons = updatedProgress.completedLessons.length;
      const progressPercentage = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

      const finalProgress = await progressModel.update(updatedProgress._id!, {
        overallProgress: Math.min(100, Math.max(0, progressPercentage)),
        lastWatched: new Date().toISOString()
      } as Partial<Progress>);



      // Verify the update
      const verificationProgress = await progressModel.findByUserAndCourse(userId, courseId);
      if (!verificationProgress || !verificationProgress.lessonProgress?.[lessonId]) {
        throw new Error('Progress update verification failed');
      }

      logger.info('✅ Lesson progress successfully updated and verified:', {
        userId,
        courseId,
        lessonId,
        finalProgress: verificationProgress.overallProgress,
        completedLessons: verificationProgress.completedLessons.length,
        totalLessons,
        lessonCompleted: !!(verificationProgress.lessonProgress[lessonId].completedAt)
      });

      return {
        success: true,
        progress: verificationProgress,
        wasCompleted,
        preserved
      };

    } catch (error) {
      logger.error('❌ Failed to update lesson progress with consistency:', error);
      throw error;
    }
  }

  /**
   * Ensure course progress consistency when revisiting completed courses
   */
  async ensureCourseProgressConsistency(
    userId: string,
    courseId: string
  ): Promise<{
    success: boolean;
    progress: Progress;
    wasInconsistent: boolean;
    fixes: string[];
  }> {
    try {
      logger.info('🔄 Ensuring course progress consistency:', { userId, courseId });

      const progress = await progressModel.findByUserAndCourse(userId, courseId);
      if (!progress) {
        logger.info('📱 No progress found, creating new progress record');
        const newProgress = await progressModel.getOrCreateProgress(userId, courseId);
        return {
          success: true,
          progress: newProgress,
          wasInconsistent: false,
          fixes: []
        };
      }

      const course = await courseModel.findById(courseId);
      if (!course) {
        throw new Error('Course not found');
      }

      const fixes: string[] = [];
      let wasInconsistent = false;

      // Check for inconsistencies
      const totalLessons = course.totalLessons || 0;
      const completedLessons = progress.completedLessons.length;
      const calculatedProgress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
      const storedProgress = progress.overallProgress || 0;

      // Fix progress percentage if inconsistent
      if (Math.abs(calculatedProgress - storedProgress) > 5) {
        fixes.push(`Progress percentage corrected: ${storedProgress}% → ${calculatedProgress}%`);
        wasInconsistent = true;
      }

      // Check for orphaned completed lessons
      const validLessonIds = this.extractLessonIdsFromCourse(course);
      const orphanedLessons = progress.completedLessons.filter(lessonId => !validLessonIds.includes(lessonId));
      
      if (orphanedLessons.length > 0) {
        fixes.push(`Removed ${orphanedLessons.length} orphaned completed lessons`);
        wasInconsistent = true;
      }

      // Apply fixes if needed
      if (wasInconsistent) {
        const cleanedCompletedLessons = progress.completedLessons.filter(lessonId => 
          validLessonIds.includes(lessonId)
        );

        const updatedProgress = await progressModel.update(progress._id!, {
          overallProgress: calculatedProgress,
          completedLessons: cleanedCompletedLessons,
          lastWatched: new Date().toISOString()
        } as Partial<Progress>);

        logger.info('✅ Course progress consistency fixes applied:', {
          userId,
          courseId,
          fixes,
          finalProgress: calculatedProgress,
          completedLessons: cleanedCompletedLessons.length
        });

        return {
          success: true,
          progress: updatedProgress,
          wasInconsistent: true,
          fixes
        };
      }

      logger.info('✅ Course progress is consistent:', {
        userId,
        courseId,
        progress: storedProgress,
        completedLessons
      });

      return {
        success: true,
        progress,
        wasInconsistent: false,
        fixes: []
      };

    } catch (error) {
      logger.error('❌ Failed to ensure course progress consistency:', error);
      throw error;
    }
  }

  /**
   * Extract all lesson IDs from course structure
   */
  private extractLessonIdsFromCourse(course: any): string[] {
    const lessonIds: string[] = [];
    
    if (course.sections) {
      course.sections.forEach((section: any) => {
        if (section.lessons) {
          section.lessons.forEach((lesson: any) => {
            if (lesson.id) {
              lessonIds.push(lesson.id);
            }
          });
        }
      });
    }

    return lessonIds;
  }

  /**
   * Sync progress with enrollment to ensure consistency
   */
  async syncProgressWithEnrollment(
    userId: string,
    courseId: string
  ): Promise<{
    success: boolean;
    enrollmentUpdated: boolean;
  }> {
    try {
      const [progress, enrollment] = await Promise.all([
        progressModel.findByUserAndCourse(userId, courseId),
        enrollmentModel.findByUserAndCourse(userId, courseId)
      ]);

      if (!progress || !enrollment) {
        return { success: true, enrollmentUpdated: false };
      }

      // Update enrollment progress to match actual progress
      const progressPercentage = progress.overallProgress || 0;
      const enrollmentProgress = enrollment.progress || 0;

      if (Math.abs(progressPercentage - enrollmentProgress) > 5) {
        await enrollmentModel.updateProgress(enrollment._id!, progressPercentage);
        
        logger.info('🔄 Enrollment progress synced:', {
          userId,
          courseId,
          oldProgress: enrollmentProgress,
          newProgress: progressPercentage
        });

        return { success: true, enrollmentUpdated: true };
      }

      return { success: true, enrollmentUpdated: false };

    } catch (error) {
      logger.error('❌ Failed to sync progress with enrollment:', error);
      return { success: false, enrollmentUpdated: false };
    }
  }
}

export const progressConsistencyService = ProgressConsistencyService.getInstance(); 