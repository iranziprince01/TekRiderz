import { notificationModel } from '../models/Notification';
import { userModel } from '../models/User';
import { courseModel } from '../models/Course';
import { enrollmentModel } from '../models/Enrollment';
import { progressModel } from '../models/Progress';
import { logger } from '../utils/logger';
import { NotificationType, NotificationPriority } from '../types';

export class NotificationService {
  // Create course enrollment notification
  async createEnrollmentNotification(userId: string, courseId: string): Promise<void> {
    try {
      const course = await courseModel.findById(courseId);
      if (!course) return;

      await notificationModel.createNotification({
        id: `enrollment_${userId}_${courseId}_${Date.now()}`,
        userId,
        title: 'Course Enrollment Successful',
        message: `You have successfully enrolled in "${course.title}". Start your learning journey now!`,
        notificationType: 'course_enrollment',
        priority: 'medium',
        actionUrl: `/course/${courseId}`,
        actionText: 'Start Learning',
        metadata: { courseId },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isRead: false
      });

      logger.info('Enrollment notification created:', { userId, courseId });
    } catch (error) {
      logger.error('Failed to create enrollment notification:', error);
    }
  }

  // Create course completion notification
  async createCompletionNotification(userId: string, courseId: string): Promise<void> {
    try {
      const course = await courseModel.findById(courseId);
      if (!course) return;

      await notificationModel.createNotification({
        id: `completion_${userId}_${courseId}_${Date.now()}`,
        userId,
        title: 'Course Completed! 🎉',
        message: `Congratulations! You have successfully completed "${course.title}". Your certificate is ready!`,
        notificationType: 'course_completion',
        priority: 'high',
        actionUrl: `/certificates`,
        actionText: 'View Certificate',
        metadata: { courseId },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isRead: false
      });

      logger.info('Completion notification created:', { userId, courseId });
    } catch (error) {
      logger.error('Failed to create completion notification:', error);
    }
  }

  // Create achievement unlocked notification
  async createAchievementNotification(userId: string, achievementId: string, achievementName: string): Promise<void> {
    try {
      await notificationModel.createNotification({
        id: `achievement_${userId}_${achievementId}_${Date.now()}`,
        userId,
        title: 'Achievement Unlocked! 🏆',
        message: `You've earned the "${achievementName}" achievement! Keep up the great work!`,
        notificationType: 'achievement_unlocked',
        priority: 'high',
        actionUrl: `/achievements`,
        actionText: 'View Achievements',
        metadata: { achievementId },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isRead: false
      });

      logger.info('Achievement notification created:', { userId, achievementId });
    } catch (error) {
      logger.error('Failed to create achievement notification:', error);
    }
  }

  // Create quiz reminder notification
  async createQuizReminderNotification(userId: string, courseId: string, quizTitle: string): Promise<void> {
    try {
      const course = await courseModel.findById(courseId);
      if (!course) return;

      await notificationModel.createNotification({
        id: `quiz_reminder_${userId}_${courseId}_${Date.now()}`,
        userId,
        title: 'Quiz Reminder',
        message: `Don't forget to complete the "${quizTitle}" quiz in "${course.title}" to continue your progress.`,
        notificationType: 'assignment_reminder',
        priority: 'medium',
        actionUrl: `/course/${courseId}`,
        actionText: 'Take Quiz',
        metadata: { courseId, quizTitle },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isRead: false
      });

      logger.info('Quiz reminder notification created:', { userId, courseId, quizTitle });
    } catch (error) {
      logger.error('Failed to create quiz reminder notification:', error);
    }
  }

  // Create course update notification
  async createCourseUpdateNotification(userId: string, courseId: string, updateType: string): Promise<void> {
    try {
      const course = await courseModel.findById(courseId);
      if (!course) return;

      await notificationModel.createNotification({
        id: `course_update_${userId}_${courseId}_${Date.now()}`,
        userId,
        title: 'Course Updated',
        message: `The course "${course.title}" has been updated with new ${updateType}. Check it out!`,
        notificationType: 'course_announcement',
        priority: 'medium',
        actionUrl: `/course/${courseId}`,
        actionText: 'View Updates',
        metadata: { courseId, updateType },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isRead: false
      });

      logger.info('Course update notification created:', { userId, courseId, updateType });
    } catch (error) {
      logger.error('Failed to create course update notification:', error);
    }
  }

  // Create system maintenance notification
  async createMaintenanceNotification(userIds: string[], maintenanceTime: string, duration: string): Promise<void> {
    try {
      await notificationModel.createSystemNotification({
        id: `maintenance_${Date.now()}`,
        title: 'Scheduled Maintenance',
        message: `We'll be performing scheduled maintenance on ${maintenanceTime} for ${duration}. The platform will be temporarily unavailable.`,
        notificationType: 'maintenance_notice',
        priority: 'high',
        actionUrl: '/status',
        actionText: 'Check Status',
        metadata: { maintenanceTime, duration },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isRead: false
      }, userIds);

      logger.info('Maintenance notification created:', { userIds: userIds.length, maintenanceTime });
    } catch (error) {
      logger.error('Failed to create maintenance notification:', error);
    }
  }

  // Create welcome notification for new users
  async createWelcomeNotification(userId: string): Promise<void> {
    try {
      await notificationModel.createNotification({
        id: `welcome_${userId}_${Date.now()}`,
        userId,
        title: 'Welcome to TekRiders! 🚀',
        message: 'Welcome to our learning platform! Explore courses, track your progress, and earn achievements as you learn.',
        notificationType: 'welcome_email',
        priority: 'medium',
        actionUrl: '/courses',
        actionText: 'Browse Courses',
        metadata: { isWelcome: true },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isRead: false
      });

      logger.info('Welcome notification created:', { userId });
    } catch (error) {
      logger.error('Failed to create welcome notification:', error);
    }
  }

  // Create progress milestone notification
  async createProgressMilestoneNotification(userId: string, courseId: string, milestone: number): Promise<void> {
    try {
      const course = await courseModel.findById(courseId);
      if (!course) return;

      await notificationModel.createNotification({
        id: `milestone_${userId}_${courseId}_${milestone}_${Date.now()}`,
        userId,
        title: 'Progress Milestone Reached! 📈',
        message: `Great job! You've reached ${milestone}% completion in "${course.title}". Keep going!`,
        notificationType: 'course_announcement',
        priority: 'medium',
        actionUrl: `/course/${courseId}`,
        actionText: 'Continue Learning',
        metadata: { courseId, milestone },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isRead: false
      });

      logger.info('Progress milestone notification created:', { userId, courseId, milestone });
    } catch (error) {
      logger.error('Failed to create progress milestone notification:', error);
    }
  }

  // Create learning streak notification
  async createStreakNotification(userId: string, streakDays: number): Promise<void> {
    try {
      await notificationModel.createNotification({
        id: `streak_${userId}_${streakDays}_${Date.now()}`,
        userId,
        title: `Learning Streak: ${streakDays} Days! 🔥`,
        message: `Amazing! You've maintained a ${streakDays}-day learning streak. Consistency is key to success!`,
        notificationType: 'achievement_unlocked',
        priority: 'medium',
        actionUrl: '/dashboard',
        actionText: 'View Dashboard',
        metadata: { streakDays },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isRead: false
      });

      logger.info('Streak notification created:', { userId, streakDays });
    } catch (error) {
      logger.error('Failed to create streak notification:', error);
    }
  }

  // Create grade posted notification
  async createGradeNotification(userId: string, courseId: string, quizTitle: string, score: number): Promise<void> {
    try {
      const course = await courseModel.findById(courseId);
      if (!course) return;

      const passed = score >= 50;
      const title = passed ? 'Quiz Passed! ✅' : 'Quiz Results Available';
      const message = passed 
        ? `Congratulations! You passed "${quizTitle}" with ${score}% in "${course.title}".`
        : `Your results for "${quizTitle}" in "${course.title}" are available. You scored ${score}%.`;

      await notificationModel.createNotification({
        id: `grade_${userId}_${courseId}_${Date.now()}`,
        userId,
        title,
        message,
        notificationType: 'grade_posted',
        priority: 'medium',
        actionUrl: `/course/${courseId}`,
        actionText: 'View Results',
        metadata: { courseId, quizTitle, score, passed },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isRead: false
      });

      logger.info('Grade notification created:', { userId, courseId, quizTitle, score });
    } catch (error) {
      logger.error('Failed to create grade notification:', error);
    }
  }

  // Create inactivity reminder notification
  async createInactivityReminderNotification(userId: string, daysInactive: number): Promise<void> {
    try {
      await notificationModel.createNotification({
        id: `inactivity_${userId}_${daysInactive}_${Date.now()}`,
        userId,
        title: 'We Miss You! 📚',
        message: `It's been ${daysInactive} days since your last learning session. Don't break your momentum - continue your learning journey!`,
        notificationType: 'assignment_reminder',
        priority: 'low',
        actionUrl: '/courses',
        actionText: 'Resume Learning',
        metadata: { daysInactive },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isRead: false
      });

      logger.info('Inactivity reminder notification created:', { userId, daysInactive });
    } catch (error) {
      logger.error('Failed to create inactivity reminder notification:', error);
    }
  }

  // Create course deadline notification
  async createDeadlineNotification(userId: string, courseId: string, deadline: string): Promise<void> {
    try {
      const course = await courseModel.findById(courseId);
      if (!course) return;

      await notificationModel.createNotification({
        id: `deadline_${userId}_${courseId}_${Date.now()}`,
        userId,
        title: 'Course Deadline Approaching',
        message: `The deadline for "${course.title}" is approaching on ${deadline}. Complete your assignments to stay on track!`,
        notificationType: 'course_deadline',
        priority: 'high',
        actionUrl: `/course/${courseId}`,
        actionText: 'View Course',
        metadata: { courseId, deadline },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isRead: false
      });

      logger.info('Deadline notification created:', { userId, courseId, deadline });
    } catch (error) {
      logger.error('Failed to create deadline notification:', error);
    }
  }

  // Smart notification system - analyzes user behavior and sends contextual notifications
  async analyzeAndSendSmartNotifications(userId: string): Promise<void> {
    try {
      // Get user progress and enrollment data
      const [user, enrollments, progress] = await Promise.all([
        userModel.findById(userId),
        enrollmentModel.getUserEnrollments(userId, { limit: 1000 }),
        progressModel.getUserProgress(userId, { limit: 1000 })
      ]);

      if (!user) return;

      // Check for learning streak
      const lastActive = user.lastLogin ? new Date(user.lastLogin) : null;
      if (lastActive) {
        const daysSinceLastActive = Math.floor((Date.now() - lastActive.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysSinceLastActive >= 7) {
          await this.createInactivityReminderNotification(userId, daysSinceLastActive);
        }
      }

      // Check for progress milestones
      for (const enrollment of enrollments.enrollments) {
        if (enrollment.status === 'active' && enrollment.progress > 0) {
          const progressRecord = progress.progress.find(p => p.courseId === enrollment.courseId);
          if (progressRecord) {
            const milestone = Math.floor(progressRecord.overallProgress / 25) * 25; // 25%, 50%, 75%
            if (milestone > 0 && milestone % 25 === 0) {
              await this.createProgressMilestoneNotification(userId, enrollment.courseId, milestone);
            }
          }
        }
      }

      logger.info('Smart notifications analyzed for user:', { userId });
    } catch (error) {
      logger.error('Failed to analyze and send smart notifications:', error);
    }
  }

  // Clean up old notifications
  async cleanupOldNotifications(): Promise<void> {
    try {
      const result = await notificationModel.cleanupOldNotifications(30); // Keep 30 days
      logger.info('Old notifications cleaned up:', result);
    } catch (error) {
      logger.error('Failed to cleanup old notifications:', error);
    }
  }
}

export const notificationService = new NotificationService();
export default notificationService; 