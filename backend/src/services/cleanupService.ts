import { logger } from '../utils/logger';
import { databases } from '../config/database';
import { courseModel } from '../models/Course';
import { enrollmentModel } from '../models/Enrollment';
import { progressModel } from '../models/Progress';
import { userModel } from '../models/User';

export interface CleanupResult {
  deletedCourses: string[];
  deletedEnrollments: string[];
  deletedProgress: string[];
  deletedThumbnails: string[];
  deletedPdfs: string[];
  errors: string[];
}

export class CleanupService {
  private static instance: CleanupService;
  private isRunning = false;
  private lastCleanupTime = 0;
  private readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

  static getInstance(): CleanupService {
    if (!CleanupService.instance) {
      CleanupService.instance = new CleanupService();
    }
    return CleanupService.instance;
  }

  /**
   * Perform comprehensive cleanup of orphaned data
   */
  async performCleanup(): Promise<CleanupResult> {
    if (this.isRunning) {
      logger.info('Cleanup already running, skipping...');
      return {
        deletedCourses: [],
        deletedEnrollments: [],
        deletedProgress: [],
        deletedThumbnails: [],
        deletedPdfs: [],
        errors: ['Cleanup already running']
      };
    }

    // Rate limiting
    const now = Date.now();
    if (now - this.lastCleanupTime < this.CLEANUP_INTERVAL) {
      logger.info('Cleanup rate limited, skipping...');
      return {
        deletedCourses: [],
        deletedEnrollments: [],
        deletedProgress: [],
        deletedThumbnails: [],
        deletedPdfs: [],
        errors: ['Rate limited']
      };
    }

    this.isRunning = true;
    this.lastCleanupTime = now;

    const result: CleanupResult = {
      deletedCourses: [],
      deletedEnrollments: [],
      deletedProgress: [],
      deletedThumbnails: [],
      deletedPdfs: [],
      errors: []
    };

    try {
      logger.info('Starting comprehensive cleanup...');

      // 1. Clean up orphaned enrollments (courses that don't exist)
      await this.cleanupOrphanedEnrollments(result);

      // 2. Clean up orphaned progress records
      await this.cleanupOrphanedProgress(result);

      // 3. Clean up orphaned thumbnails and PDFs
      await this.cleanupOrphanedFiles(result);

      // 4. Clean up orphaned user references
      await this.cleanupOrphanedUserReferences(result);

      // 5. Validate and fix data integrity
      await this.validateDataIntegrity(result);

      logger.info('Cleanup completed successfully:', {
        deletedEnrollments: result.deletedEnrollments.length,
        deletedProgress: result.deletedProgress.length,
        deletedThumbnails: result.deletedThumbnails.length,
        deletedPdfs: result.deletedPdfs.length,
        errors: result.errors.length
      });

    } catch (error) {
      logger.error('Cleanup failed:', error);
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      this.isRunning = false;
    }

    return result;
  }

  /**
   * Clean up enrollments for courses that no longer exist
   */
  private async cleanupOrphanedEnrollments(result: CleanupResult): Promise<void> {
    try {
      logger.info('Cleaning up orphaned enrollments...');

      // Get all enrollments
      const enrollmentsResult = await enrollmentModel.findAll({ limit: 10000 });
      const enrollments = enrollmentsResult.docs;

      // Get all course IDs
      const coursesResult = await courseModel.findAll({ limit: 10000 });
      const existingCourseIds = new Set(coursesResult.docs.map(course => course._id || course.id));

      // Find orphaned enrollments
      const orphanedEnrollments = enrollments.filter(enrollment => 
        !existingCourseIds.has(enrollment.courseId)
      );

      logger.info(`Found ${orphanedEnrollments.length} orphaned enrollments`);

      // Delete orphaned enrollments
      for (const enrollment of orphanedEnrollments) {
        try {
          await enrollmentModel.delete(enrollment._id!);
          result.deletedEnrollments.push(enrollment._id!);
          
          logger.info('Deleted orphaned enrollment:', {
            enrollmentId: enrollment._id,
            courseId: enrollment.courseId,
            userId: enrollment.userId
          });
        } catch (error) {
          logger.error('Failed to delete orphaned enrollment:', {
            enrollmentId: enrollment._id,
            error
          });
          result.errors.push(`Failed to delete enrollment ${enrollment._id}: ${error}`);
        }
      }
    } catch (error) {
      logger.error('Failed to cleanup orphaned enrollments:', error);
      result.errors.push(`Enrollment cleanup failed: ${error}`);
    }
  }

  /**
   * Clean up progress records for courses that no longer exist
   */
  private async cleanupOrphanedProgress(result: CleanupResult): Promise<void> {
    try {
      logger.info('Cleaning up orphaned progress records...');

      // Get all progress records
      const progressResult = await progressModel.findAll({ limit: 10000 });
      const progressRecords = progressResult.docs;

      // Get all course IDs
      const coursesResult = await courseModel.findAll({ limit: 10000 });
      const existingCourseIds = new Set(coursesResult.docs.map(course => course._id || course.id));

      // Find orphaned progress records
      const orphanedProgress = progressRecords.filter(progress => 
        !existingCourseIds.has(progress.courseId)
      );

      logger.info(`Found ${orphanedProgress.length} orphaned progress records`);

      // Delete orphaned progress records
      for (const progress of orphanedProgress) {
        try {
          await progressModel.delete(progress._id!);
          result.deletedProgress.push(progress._id!);
          
          logger.info('Deleted orphaned progress record:', {
            progressId: progress._id,
            courseId: progress.courseId,
            userId: progress.userId
          });
        } catch (error) {
          logger.error('Failed to delete orphaned progress record:', {
            progressId: progress._id,
            error
          });
          result.errors.push(`Failed to delete progress ${progress._id}: ${error}`);
        }
      }
    } catch (error) {
      logger.error('Failed to cleanup orphaned progress records:', error);
      result.errors.push(`Progress cleanup failed: ${error}`);
    }
  }

  /**
   * Clean up orphaned files (thumbnails and PDFs)
   */
  private async cleanupOrphanedFiles(result: CleanupResult): Promise<void> {
    try {
      logger.info('Cleaning up orphaned files...');

      // Get all courses to collect valid file references
      const coursesResult = await courseModel.findAll({ limit: 10000 });
      const courses = coursesResult.docs;

      // Collect all valid file references
      const validThumbnails = new Set<string>();
      const validPdfs = new Set<string>();

      for (const course of courses) {
        // Collect thumbnails
        if (course.thumbnail) {
          validThumbnails.add(course.thumbnail);
        }

        // Collect PDFs from course content
        if (course.sections) {
          for (const section of course.sections) {
            if (section.lessons) {
              for (const lesson of section.lessons) {
                if (lesson.content?.documentUrl) {
                  validPdfs.add(lesson.content.documentUrl);
                }
              }
            }
          }
        }
      }

      // Note: For external services (Cloudinary, Firebase), we don't delete files
      // as they might be shared or referenced elsewhere. Instead, we log orphaned references.
      logger.info('File cleanup completed (external services - no deletion):', {
        validThumbnails: validThumbnails.size,
        validPdfs: validPdfs.size
      });

    } catch (error) {
      logger.error('Failed to cleanup orphaned files:', error);
      result.errors.push(`File cleanup failed: ${error}`);
    }
  }

  /**
   * Clean up orphaned user references
   */
  private async cleanupOrphanedUserReferences(result: CleanupResult): Promise<void> {
    try {
      logger.info('Cleaning up orphaned user references...');

      // Get all users
      const usersResult = await userModel.getAllUsers();
      const existingUserIds = new Set(usersResult.map(user => user._id || user.id));

      // Get all enrollments and check for orphaned user references
      const enrollmentsResult = await enrollmentModel.findAll({ limit: 10000 });
      const enrollments = enrollmentsResult.docs;

      const orphanedEnrollments = enrollments.filter(enrollment => 
        !existingUserIds.has(enrollment.userId)
      );

      logger.info(`Found ${orphanedEnrollments.length} enrollments with orphaned user references`);

      // Delete enrollments with orphaned user references
      for (const enrollment of orphanedEnrollments) {
        try {
          await enrollmentModel.delete(enrollment._id!);
          result.deletedEnrollments.push(enrollment._id!);
          
          logger.info('Deleted enrollment with orphaned user reference:', {
            enrollmentId: enrollment._id,
            userId: enrollment.userId
          });
        } catch (error) {
          logger.error('Failed to delete enrollment with orphaned user:', {
            enrollmentId: enrollment._id,
            error
          });
          result.errors.push(`Failed to delete orphaned user enrollment ${enrollment._id}: ${error}`);
        }
      }

      // Clean up progress records with orphaned user references
      const progressResult = await progressModel.findAll({ limit: 10000 });
      const progressRecords = progressResult.docs;

      const orphanedProgress = progressRecords.filter(progress => 
        !existingUserIds.has(progress.userId)
      );

      logger.info(`Found ${orphanedProgress.length} progress records with orphaned user references`);

      for (const progress of orphanedProgress) {
        try {
          await progressModel.delete(progress._id!);
          result.deletedProgress.push(progress._id!);
          
          logger.info('Deleted progress record with orphaned user reference:', {
            progressId: progress._id,
            userId: progress.userId
          });
        } catch (error) {
          logger.error('Failed to delete progress with orphaned user:', {
            progressId: progress._id,
            error
          });
          result.errors.push(`Failed to delete orphaned user progress ${progress._id}: ${error}`);
        }
      }

    } catch (error) {
      logger.error('Failed to cleanup orphaned user references:', error);
      result.errors.push(`User reference cleanup failed: ${error}`);
    }
  }

  /**
   * Validate and fix data integrity issues
   */
  private async validateDataIntegrity(result: CleanupResult): Promise<void> {
    try {
      logger.info('Validating data integrity...');

      // Check for courses with invalid instructor references
      const coursesResult = await courseModel.findAll({ limit: 10000 });
      const courses = coursesResult.docs;

      const usersResult = await userModel.getAllUsers();
      const existingUserIds = new Set(usersResult.map(user => user._id || user.id));

      for (const course of courses) {
        if (course.instructorId && !existingUserIds.has(course.instructorId)) {
          logger.warn('Course has invalid instructor reference:', {
            courseId: course._id,
            courseTitle: course.title,
            instructorId: course.instructorId
          });
          
          // Update course to remove invalid instructor reference
          try {
            await courseModel.update(course._id!, {
              instructorId: null,
              instructorName: 'Unknown Instructor'
            } as any);
            
            logger.info('Fixed invalid instructor reference for course:', {
              courseId: course._id,
              courseTitle: course.title
            });
          } catch (error) {
            logger.error('Failed to fix invalid instructor reference:', {
              courseId: course._id,
              error
            });
            result.errors.push(`Failed to fix instructor reference for course ${course._id}: ${error}`);
          }
        }
      }

    } catch (error) {
      logger.error('Failed to validate data integrity:', error);
      result.errors.push(`Data integrity validation failed: ${error}`);
    }
  }

  /**
   * Get cleanup statistics
   */
  async getCleanupStats(): Promise<{
    lastCleanupTime: number;
    isRunning: boolean;
    nextCleanupTime: number;
  }> {
    return {
      lastCleanupTime: this.lastCleanupTime,
      isRunning: this.isRunning,
      nextCleanupTime: this.lastCleanupTime + this.CLEANUP_INTERVAL
    };
  }

  /**
   * Force immediate cleanup
   */
  async forceCleanup(): Promise<CleanupResult> {
    this.lastCleanupTime = 0; // Reset rate limiting
    return this.performCleanup();
  }
}

export const cleanupService = CleanupService.getInstance(); 