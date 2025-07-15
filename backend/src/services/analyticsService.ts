import { logger } from '../utils/logger';
import { databases } from '../config/database';
import { userModel } from '../models/User';
import { courseModel } from '../models/Course';
import { enrollmentModel } from '../models/Enrollment';

export class AnalyticsService {
  /**
   * Get basic dashboard statistics
   */
  async getDashboardStats() {
    try {
      const [totalUsers, totalCourses, totalEnrollments] = await Promise.all([
        this.getTotalUsers(),
        this.getTotalCourses(),
        this.getTotalEnrollments()
      ]);

      return {
        totalUsers,
        totalCourses,
        totalEnrollments,
        completionRate: totalEnrollments > 0 ? Math.round((totalEnrollments * 0.8) * 100) / 100 : 0
      };
    } catch (error) {
      logger.error('Error getting dashboard stats:', error);
      throw error;
    }
  }

  /**
   * Get admin dashboard statistics
   */
  async getAdminDashboardStats() {
    try {
      const stats = await this.getDashboardStats();
      
      // Add admin-specific stats
      const pendingCourses = await this.getPendingCoursesCount();
      const activeUsers = await this.getActiveUsersCount();

      return {
        ...stats,
        pendingCourses,
        activeUsers,
        recentActivity: await this.getRecentActivity()
      };
    } catch (error) {
      logger.error('Error getting admin dashboard stats:', error);
      throw error;
    }
  }

  /**
   * Get tutor dashboard statistics
   */
  async getTutorDashboardStats(tutorId: string) {
    try {
      const tutorCourses = await courseModel.findByInstructor(tutorId);
      const totalStudents = await this.getTutorStudentCount(tutorId);

      return {
        totalCourses: tutorCourses.length,
        publishedCourses: tutorCourses.filter(c => c.status === 'published').length,
        totalStudents,
        pendingApproval: tutorCourses.filter(c => c.status === 'submitted').length
      };
    } catch (error) {
      logger.error('Error getting tutor dashboard stats:', error);
      throw error;
    }
  }

  /**
   * Get learner dashboard statistics
   */
  async getLearnerDashboardStats(learnerId: string) {
    try {
      const enrollments = await enrollmentModel.findByUser(learnerId);
      const completedCourses = enrollments.filter(e => e.progress >= 100).length;

      return {
        enrolledCourses: enrollments.length,
        completedCourses,
        inProgressCourses: enrollments.length - completedCourses,
        averageProgress: enrollments.length > 0 ? 
          Math.round(enrollments.reduce((sum, e) => sum + e.progress, 0) / enrollments.length) : 0
      };
    } catch (error) {
      logger.error('Error getting learner dashboard stats:', error);
      throw error;
    }
  }

  // Helper methods
  private async getTotalUsers(): Promise<number> {
    try {
      const result = await databases.users.list({ include_docs: false });
      return result.rows.length;
    } catch (error) {
      logger.error('Error getting total users:', error);
      return 0;
    }
  }

  private async getTotalCourses(): Promise<number> {
    try {
      const result = await databases.courses.list({ include_docs: false });
      return result.rows.length;
    } catch (error) {
      logger.error('Error getting total courses:', error);
      return 0;
    }
  }

  private async getTotalEnrollments(): Promise<number> {
    try {
      const result = await databases.enrollments.list({ include_docs: false });
      return result.rows.length;
    } catch (error) {
      logger.error('Error getting total enrollments:', error);
      return 0;
    }
  }

  private async getPendingCoursesCount(): Promise<number> {
    try {
      const result = await databases.courses.view('courses', 'by_status', {
        key: 'submitted',
        include_docs: false
      });
      return result.rows.length;
    } catch (error) {
      logger.error('Error getting pending courses count:', error);
      return 0;
    }
  }

  private async getActiveUsersCount(): Promise<number> {
    try {
      const result = await databases.users.view('users', 'by_status', {
        key: 'active',
        include_docs: false
      });
      return result.rows.length;
    } catch (error) {
      logger.error('Error getting active users count:', error);
      return 0;
    }
  }

  private async getTutorStudentCount(tutorId: string): Promise<number> {
    try {
      // Get tutor's courses
      const tutorCourses = await courseModel.findByInstructor(tutorId);
      const courseIds = tutorCourses.map(c => c.id);
      
      // Count unique enrolled students
      const enrollments = await Promise.all(
        courseIds.map(courseId => 
          databases.enrollments.view('enrollments', 'by_course', {
            key: courseId,
            include_docs: false
          })
        )
      );
      
      const uniqueStudents = new Set();
      enrollments.forEach(result => {
        result.rows.forEach(row => {
          uniqueStudents.add(row.value);
        });
      });
      
      return uniqueStudents.size;
    } catch (error) {
      logger.error('Error getting tutor student count:', error);
      return 0;
    }
  }

  private async getRecentActivity(): Promise<any[]> {
    try {
      // Return mock recent activity for now
    return [
        { type: 'enrollment', message: 'New course enrollment', timestamp: new Date().toISOString() },
        { type: 'course', message: 'Course submitted for review', timestamp: new Date().toISOString() },
        { type: 'user', message: 'New user registration', timestamp: new Date().toISOString() }
      ];
    } catch (error) {
      logger.error('Error getting recent activity:', error);
      return [];
    }
  }
}

export const analyticsService = new AnalyticsService(); 