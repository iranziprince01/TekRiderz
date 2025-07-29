import { databases } from '../config/database';
import { courseModel } from '../models/Course';
import { enrollmentModel } from '../models/Enrollment';
import { logger } from '../utils/logger';

export class EnrollmentSyncService {
  /**
   * Sync enrollment count for a specific course
   */
  static async syncCourseEnrollmentCount(courseId: string): Promise<number> {
    try {
      // Get real-time enrollment count
      const enrollmentsView = await databases.enrollments.view('enrollments', 'by_course', {
        key: courseId,
        include_docs: false,
      });
      
      const realCount = enrollmentsView.rows.length;
      
      // Update course with correct count
      await courseModel.update(courseId, {
        enrollmentCount: realCount
      } as any);
      
      logger.info('Enrollment count synced for course:', { courseId, count: realCount });
      return realCount;
    } catch (error) {
      logger.error('Failed to sync enrollment count for course:', { courseId, error });
      throw error;
    }
  }

  /**
   * Sync enrollment counts for all courses
   */
  static async syncAllEnrollmentCounts(): Promise<{
    totalCourses: number;
    syncedCourses: number;
    errors: number;
  }> {
    try {
      logger.info('Starting enrollment count sync for all courses...');
      
      const coursesResult = await courseModel.findAll({ limit: 1000 });
      const courses = coursesResult.docs;
      const publishedCourses = courses.filter((course: any) => course.status === 'published' || course.status === 'approved');
      
      let syncedCount = 0;
      let errorCount = 0;
      
      for (const course of publishedCourses) {
        try {
          await this.syncCourseEnrollmentCount(course._id || course.id);
          syncedCount++;
        } catch (error) {
          logger.error('Failed to sync course:', { courseId: course._id, error });
          errorCount++;
        }
      }
      
      const result = {
        totalCourses: publishedCourses.length,
        syncedCourses: syncedCount,
        errors: errorCount
      };
      
      logger.info('Enrollment count sync completed:', result);
      return result;
    } catch (error) {
      logger.error('Failed to sync all enrollment counts:', error);
      throw error;
    }
  }

  /**
   * Verify enrollment count consistency
   */
  static async verifyEnrollmentCounts(): Promise<{
    totalCourses: number;
    consistentCourses: number;
    inconsistentCourses: Array<{
      courseId: string;
      courseTitle: string;
      storedCount: number;
      realCount: number;
    }>;
  }> {
    try {
      const coursesResult = await courseModel.findAll({ limit: 1000 });
      const courses = coursesResult.docs;
      const publishedCourses = courses.filter((course: any) => course.status === 'published' || course.status === 'approved');
      
      const inconsistentCourses: Array<{
        courseId: string;
        courseTitle: string;
        storedCount: number;
        realCount: number;
      }> = [];
      
      let consistentCount = 0;
      
      for (const course of publishedCourses) {
        const courseId = course._id || course.id;
        const storedCount = course.enrollmentCount || 0;
        
        try {
          const enrollmentsView = await databases.enrollments.view('enrollments', 'by_course', {
            key: courseId,
            include_docs: false,
          });
          
          const realCount = enrollmentsView.rows.length;
          
          if (storedCount === realCount) {
            consistentCount++;
          } else {
            inconsistentCourses.push({
              courseId,
              courseTitle: course.title,
              storedCount,
              realCount
            });
          }
        } catch (error) {
          logger.error('Failed to verify course enrollment count:', { courseId, error });
          inconsistentCourses.push({
            courseId,
            courseTitle: course.title,
            storedCount,
            realCount: -1 // Error indicator
          });
        }
      }
      
      const result = {
        totalCourses: publishedCourses.length,
        consistentCourses: consistentCount,
        inconsistentCourses
      };
      
      logger.info('Enrollment count verification completed:', result);
      return result;
    } catch (error) {
      logger.error('Failed to verify enrollment counts:', error);
      throw error;
    }
  }

  /**
   * Auto-sync enrollment counts (can be called periodically)
   */
  static async autoSyncEnrollmentCounts(): Promise<void> {
    try {
      logger.info('Starting auto-sync of enrollment counts...');
      
      // First verify current state
      const verification = await this.verifyEnrollmentCounts();
      
      if (verification.inconsistentCourses.length > 0) {
        logger.warn('Found inconsistent enrollment counts, syncing...', {
          inconsistentCount: verification.inconsistentCourses.length
        });
        
        // Sync only inconsistent courses
        for (const course of verification.inconsistentCourses) {
          if (course.realCount >= 0) { // Skip courses with errors
            try {
              await this.syncCourseEnrollmentCount(course.courseId);
            } catch (error) {
              logger.error('Failed to auto-sync course:', { courseId: course.courseId, error });
            }
          }
        }
        
        logger.info('Auto-sync completed');
      } else {
        logger.info('All enrollment counts are consistent, no sync needed');
      }
    } catch (error) {
      logger.error('Auto-sync failed:', error);
    }
  }
} 