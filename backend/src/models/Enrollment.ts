import { BaseModel } from './BaseModel';
import { Enrollment, EnrollmentStatus } from '../types';
import { logger } from '../utils/logger';
import { databases } from '../config/database';

export class EnrollmentModel extends BaseModel<Enrollment> {
  constructor() {
    super('enrollments', 'enrollment');
  }

  // Create enrollment with proper validation
  async create(enrollmentData: Omit<Enrollment, '_id' | '_rev' | 'createdAt' | 'updatedAt'>): Promise<Enrollment> {
    try {
      const enrollmentWithDefaults = {
        ...enrollmentData,
        type: 'enrollment' as const,
        status: enrollmentData.status || 'active',
        progress: 0,
        enrolledAt: new Date().toISOString(),
      };

      return await super.create(enrollmentWithDefaults);
    } catch (error) {
      logger.error('Failed to create enrollment:', error);
      throw error;
    }
  }

  // Find enrollment by user and course
  async findByUserAndCourse(userId: string, courseId: string): Promise<Enrollment | null> {
    try {
      const result = await databases.enrollments.view('enrollments', 'by_user', {
        key: userId,
        include_docs: true,
      });

      const enrollment = result.rows.find(row => 
        row.doc && (row.doc as any).courseId === courseId
      );

      return enrollment ? enrollment.doc as Enrollment : null;
    } catch (error) {
      logger.error('Failed to find enrollment by user and course:', { userId, courseId, error });
      throw error;
    }
  }

  // Get user enrollments with pagination
  async getUserEnrollments(userId: string, options: {
    page?: number;
    limit?: number;
    status?: EnrollmentStatus;
  } = {}): Promise<{
    enrollments: Enrollment[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    try {
      const page = options.page || 1;
      const limit = options.limit || 10;
      const skip = (page - 1) * limit;

      const result = await databases.enrollments.view('enrollments', 'by_user', {
        key: userId,
        include_docs: true,
        limit,
        skip,
      });

      let enrollments = result.rows.map(row => row.doc as Enrollment);

      // Filter by status if provided
      if (options.status) {
        enrollments = enrollments.filter(enrollment => enrollment.status === options.status);
      }

      // Get total count
      const totalResult = await databases.enrollments.view('enrollments', 'by_user', {
        key: userId,
        include_docs: false,
      });
      
      let total = totalResult.rows.length;
      if (options.status) {
        // Need to count filtered results
        const allEnrollments = await databases.enrollments.view('enrollments', 'by_user', {
          key: userId,
          include_docs: true,
        });
        total = allEnrollments.rows
          .map(row => row.doc as Enrollment)
          .filter(enrollment => enrollment.status === options.status).length;
      }

      const pages = Math.ceil(total / limit);

      return {
        enrollments: enrollments.slice(0, limit),
        pagination: {
          page,
          limit,
          total,
          pages,
        },
      };
    } catch (error) {
      logger.error('Failed to get user enrollments:', { userId, options, error });
      throw error;
    }
  }

  // Get course enrollments with pagination
  async getCourseEnrollments(courseId: string, options: {
    page?: number;
    limit?: number;
    status?: EnrollmentStatus;
  } = {}): Promise<{
    enrollments: Enrollment[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    try {
      const page = options.page || 1;
      const limit = options.limit || 10;
      const skip = (page - 1) * limit;

      const result = await databases.enrollments.view('enrollments', 'by_course', {
        key: courseId,
        include_docs: true,
        limit,
        skip,
      });

      let enrollments = result.rows.map(row => row.doc as Enrollment);

      // Filter by status if provided
      if (options.status) {
        enrollments = enrollments.filter(enrollment => enrollment.status === options.status);
      }

      // Get total count
      const totalResult = await databases.enrollments.view('enrollments', 'by_course', {
        key: courseId,
        include_docs: false,
      });
      
      let total = totalResult.rows.length;
      if (options.status) {
        // Need to count filtered results
        const allEnrollments = await databases.enrollments.view('enrollments', 'by_course', {
          key: courseId,
          include_docs: true,
        });
        total = allEnrollments.rows
          .map(row => row.doc as Enrollment)
          .filter(enrollment => enrollment.status === options.status).length;
      }

      const pages = Math.ceil(total / limit);

      return {
        enrollments: enrollments.slice(0, limit),
        pagination: {
          page,
          limit,
          total,
          pages,
        },
      };
    } catch (error) {
      logger.error('Failed to get course enrollments:', { courseId, options, error });
      throw error;
    }
  }

  // Enroll user in course
  async enrollUser(userId: string, courseId: string, paymentId?: string): Promise<Enrollment> {
    try {
      // Check if already enrolled
      const existingEnrollment = await this.findByUserAndCourse(userId, courseId);
      if (existingEnrollment) {
        if (existingEnrollment.status === 'active') {
          throw new Error('User is already enrolled in this course');
        } else if (existingEnrollment.status === 'completed') {
          // User has completed the course - allow access by returning existing enrollment
          // This enables them to review content and certificates
          logger.info('User accessing completed course:', { 
            userId, 
            courseId, 
            enrollmentId: existingEnrollment._id,
            completedAt: existingEnrollment.completedAt 
          });
          return existingEnrollment;
        } else if (existingEnrollment.status === 'suspended') {
          // Reactivate enrollment
          return await this.update(existingEnrollment._id!, {
            status: 'active' as EnrollmentStatus,
            enrolledAt: new Date().toISOString(),
            paymentId,
          } as Partial<Enrollment>);
        }
      }

      // Create new enrollment
      const enrollmentData = {
        type: 'enrollment',
        id: this.generateId(), // Keep this for now, BaseModel will ensure consistency
        userId,
        courseId,
        status: 'active' as EnrollmentStatus,
        enrolledAt: new Date().toISOString(),
        progress: 0,
      } as any;

      if (paymentId) {
        enrollmentData.paymentId = paymentId;
      }

      const enrollment = await this.create(enrollmentData);

      logger.info('User enrolled in course:', { userId, courseId, enrollmentId: enrollment._id });
      return enrollment;
    } catch (error) {
      logger.error('Failed to enroll user:', { userId, courseId, error });
      throw error;
    }
  }

  // Update enrollment progress
  async updateProgress(enrollmentId: string, progress: number): Promise<Enrollment> {
    try {
      const currentEnrollment = await this.findById(enrollmentId);
      if (!currentEnrollment) {
        throw new Error('Enrollment not found');
      }

      const updateData: Partial<Enrollment> = {
        progress: Math.max(0, Math.min(100, progress)), // Ensure 0-100 range
        lastAccessedAt: new Date().toISOString(),
      };

      // Check if course is being completed (transition from < 100% to 100%)
      const wasCompleted = currentEnrollment.status === 'completed';
      const isNowCompleted = progress >= 100;
      const isNewCompletion = isNowCompleted && !wasCompleted;

      // Mark as completed if progress is 100%
      if (isNowCompleted && currentEnrollment.status === 'active') {
        updateData.status = 'completed';
        updateData.completedAt = new Date().toISOString();
        
        // Mark as read-only for completed courses (standard e-learning platform behavior)
        updateData.isReadOnly = true;
        updateData.completionMetadata = {
          completedAt: updateData.completedAt,
          finalProgress: progress,
          completionType: 'automatic', // automatic vs manual
          canRetake: false, // Standard e-learning platform behavior
  
          completionMethod: 'progress_based' // progress_based vs exam_based
        };
        
        logger.info('Course completed and marked as read-only:', {
          enrollmentId,
          userId: currentEnrollment.userId,
          courseId: currentEnrollment.courseId,
          progress: progress,
          previousStatus: currentEnrollment.status,
          isReadOnly: true,
          completedAt: updateData.completedAt
        });

      }

      const updatedEnrollment = await this.update(enrollmentId, updateData);

      return updatedEnrollment;
    } catch (error) {
      logger.error('Failed to update enrollment progress:', { enrollmentId, progress, error });
      throw error;
    }
  }

  // Complete enrollment
  async completeEnrollment(enrollmentId: string): Promise<Enrollment> {
    try {
      return await this.update(enrollmentId, {
        status: 'completed' as EnrollmentStatus,
        progress: 100,
        completedAt: new Date().toISOString(),
      } as Partial<Enrollment>);
    } catch (error) {
      logger.error('Failed to complete enrollment:', { enrollmentId, error });
      throw error;
    }
  }

  // Suspend enrollment
  async suspendEnrollment(enrollmentId: string): Promise<Enrollment> {
    try {
      return await this.update(enrollmentId, {
        status: 'suspended' as EnrollmentStatus,
      } as Partial<Enrollment>);
    } catch (error) {
      logger.error('Failed to suspend enrollment:', { enrollmentId, error });
      throw error;
    }
  }

  // Refund enrollment
  async refundEnrollment(enrollmentId: string, refundId: string): Promise<Enrollment> {
    try {
      return await this.update(enrollmentId, {
        status: 'refunded' as EnrollmentStatus,
        refundId,
      } as Partial<Enrollment>);
    } catch (error) {
      logger.error('Failed to refund enrollment:', { enrollmentId, refundId, error });
      throw error;
    }
  }

  // Get enrollment statistics
  async getEnrollmentStats(): Promise<{
    total: number;
    active: number;
    completed: number;
    suspended: number;
    refunded: number;
    byDate: { [date: string]: number };
  }> {
    try {
      const allEnrollments = await databases.enrollments.view('enrollments', 'all_enrollments', {
        include_docs: true,
      });

      const enrollments = allEnrollments.rows.map(row => row.doc as Enrollment);
      
      const stats = {
        total: enrollments.length,
        active: 0,
        completed: 0,
        suspended: 0,
        refunded: 0,
        byDate: {} as { [date: string]: number },
      };

      enrollments.forEach(enrollment => {
        // Count by status
        const status = enrollment.status;
        if (status === 'active' || status === 'completed' || status === 'suspended' || status === 'refunded') {
          stats[status]++;
        }

        // Count by enrollment date
        if (enrollment.enrolledAt) {
          const enrollDate = enrollment.enrolledAt.split('T')[0] || 'unknown'; // Get date part only
          stats.byDate[enrollDate] = (stats.byDate[enrollDate] || 0) + 1;
        }
      });

      return stats;
    } catch (error) {
      logger.error('Failed to get enrollment statistics:', error);
      throw error;
    }
  }

  // Get user's completed courses
  async getUserCompletedCourses(userId: string): Promise<Enrollment[]> {
    try {
      const result = await databases.enrollments.view('enrollments', 'by_user', {
        key: userId,
        include_docs: true,
      });

      return result.rows
        .map(row => row.doc as Enrollment)
        .filter(enrollment => enrollment.status === 'completed');
    } catch (error) {
      logger.error('Failed to get user completed courses:', { userId, error });
      throw error;
    }
  }

  // Check if user can access course
  async canUserAccessCourse(userId: string, courseId: string): Promise<boolean> {
    try {
      const enrollment = await this.findByUserAndCourse(userId, courseId);
      return enrollment !== null && enrollment.status === 'active';
    } catch (error) {
      logger.error('Failed to check course access:', { userId, courseId, error });
      return false;
    }
  }

  // Get recent enrollments
  async getRecentEnrollments(limit: number = 10): Promise<Enrollment[]> {
    try {
      const result = await databases.enrollments.view('enrollments', 'by_date', {
        include_docs: true,
        limit,
        descending: true,
      });

      return result.rows.map(row => row.doc as Enrollment);
    } catch (error) {
      logger.error('Failed to get recent enrollments:', error);
      throw error;
    }
  }

  // Get enrollments for multiple courses (for instructor analytics)
  async getEnrollmentsByCourses(courseIds: string[], options: {
    page?: number;
    limit?: number;
    status?: EnrollmentStatus;
    courseId?: string;
  } = {}): Promise<{
    enrollments: (Enrollment & { userName?: string; userEmail?: string; courseName?: string })[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    try {
      const page = options.page || 1;
      const limit = options.limit || 10;
      const skip = (page - 1) * limit;

      // Get all enrollments for the course IDs
      const allEnrollments: Enrollment[] = [];
      
      for (const courseId of courseIds) {
        try {
          const result = await databases.enrollments.view('enrollments', 'by_course', {
            key: courseId,
            include_docs: true,
          });
          
          const courseEnrollments = result.rows.map(row => row.doc as Enrollment);
          allEnrollments.push(...courseEnrollments);
        } catch (error) {
          logger.warn('Failed to get enrollments for course:', { courseId, error });
          // Continue with other courses
        }
      }

      // Filter by status if provided
      let filteredEnrollments = allEnrollments;
      if (options.status) {
        filteredEnrollments = allEnrollments.filter(enrollment => enrollment.status === options.status);
      }

      // Filter by specific course if provided
      if (options.courseId) {
        filteredEnrollments = filteredEnrollments.filter(enrollment => enrollment.courseId === options.courseId);
      }

      // Sort by enrollment date (newest first)
      filteredEnrollments.sort((a, b) => {
        const dateA = new Date(a.enrolledAt || 0).getTime();
        const dateB = new Date(b.enrolledAt || 0).getTime();
        return dateB - dateA;
      });

      const total = filteredEnrollments.length;
      const pages = Math.ceil(total / limit);
      const paginatedEnrollments = filteredEnrollments.slice(skip, skip + limit);

      // Enhance enrollments with user and course information
      const enhancedEnrollments = await Promise.all(
        paginatedEnrollments.map(async (enrollment) => {
          let enhancedEnrollment = enrollment as Enrollment & { 
            userName?: string; 
            userEmail?: string; 
            courseName?: string; 
          };

          // Get user information
          try {
            const userResult = await databases.users.get(enrollment.userId);
            if (userResult) {
              const user = userResult as any; // Cast to bypass typing issues
              enhancedEnrollment.userName = user.name || 'Unknown User';
              enhancedEnrollment.userEmail = user.email || 'unknown@example.com';
            }
          } catch (userError) {
            logger.warn('Failed to get user info for enrollment:', { 
              enrollmentId: enrollment._id, 
              userId: enrollment.userId, 
              error: userError 
            });
            enhancedEnrollment.userName = 'Unknown User';
            enhancedEnrollment.userEmail = 'unknown@example.com';
          }

          // Get course information
          try {
            const courseResult = await databases.courses.get(enrollment.courseId);
            if (courseResult) {
              const course = courseResult as any; // Cast to bypass typing issues
              enhancedEnrollment.courseName = course.title || 'Unknown Course';
            }
          } catch (courseError) {
            logger.warn('Failed to get course info for enrollment:', { 
              enrollmentId: enrollment._id, 
              courseId: enrollment.courseId, 
              error: courseError 
            });
            enhancedEnrollment.courseName = 'Unknown Course';
          }

          return enhancedEnrollment;
        })
      );

      return {
        enrollments: enhancedEnrollments,
        pagination: {
          page,
          limit,
          total,
          pages,
        },
      };
    } catch (error) {
      logger.error('Failed to get enrollments by courses:', { courseIds, options, error });
      throw error;
    }
  }

  // Get course enrollments with enhanced student information
  async getCourseEnrollmentsWithStudents(courseId: string, options: {
    page?: number;
    limit?: number;
    status?: EnrollmentStatus;
  } = {}): Promise<{
    enrollments: (Enrollment & { userName?: string; userEmail?: string })[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    try {
      const page = options.page || 1;
      const limit = options.limit || 10;
      const skip = (page - 1) * limit;

      const result = await databases.enrollments.view('enrollments', 'by_course', {
        key: courseId,
        include_docs: true,
        limit,
        skip,
      });

      let enrollments = result.rows.map(row => row.doc as Enrollment);

      // Filter by status if provided
      if (options.status) {
        enrollments = enrollments.filter(enrollment => enrollment.status === options.status);
      }

      // Get total count
      const totalResult = await databases.enrollments.view('enrollments', 'by_course', {
        key: courseId,
        include_docs: false,
      });
      
      let total = totalResult.rows.length;
      if (options.status) {
        // Need to count filtered results
        const allEnrollments = await databases.enrollments.view('enrollments', 'by_course', {
          key: courseId,
          include_docs: true,
        });
        total = allEnrollments.rows
          .map(row => row.doc as Enrollment)
          .filter(enrollment => enrollment.status === options.status).length;
      }

      const pages = Math.ceil(total / limit);

      // Enhance enrollments with user information
      const enhancedEnrollments = await Promise.all(
        enrollments.map(async (enrollment) => {
          let enhancedEnrollment = enrollment as Enrollment & { 
            userName?: string; 
            userEmail?: string; 
          };

          // Get user information
          try {
            const userResult = await databases.users.get(enrollment.userId);
            if (userResult) {
              const user = userResult as any; // Cast to bypass typing issues
              enhancedEnrollment.userName = user.name || 'Unknown User';
              enhancedEnrollment.userEmail = user.email || 'unknown@example.com';
            }
          } catch (userError) {
            logger.warn('Failed to get user info for enrollment:', { 
              enrollmentId: enrollment._id, 
              userId: enrollment.userId, 
              error: userError 
            });
            enhancedEnrollment.userName = 'Unknown User';
            enhancedEnrollment.userEmail = 'unknown@example.com';
          }

          return enhancedEnrollment;
        })
      );

      return {
        enrollments: enhancedEnrollments.slice(0, limit),
        pagination: {
          page,
          limit,
          total,
          pages,
        },
      };
    } catch (error) {
      logger.error('Failed to get course enrollments with students:', { courseId, options, error });
      throw error;
    }
  }

  // Get enrollments by user (simple method for analytics)
  async findByUser(userId: string): Promise<Enrollment[]> {
    try {
      const result = await this.getUserEnrollments(userId, {
        limit: 1000 // Get all enrollments for this user
      });
      return result.enrollments;
    } catch (error) {
      logger.error('Failed to find enrollments by user:', error);
      return [];
    }
  }
}

export const enrollmentModel = new EnrollmentModel();
export default enrollmentModel; 