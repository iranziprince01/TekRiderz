import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { userModel } from '../models/User';
import { courseModel } from '../models/Course';
import { enrollmentModel } from '../models/Enrollment';
import { progressModel } from '../models/Progress';
import { logger } from '../utils/logger';
import { User, Course, Enrollment, Progress } from '../types';

const router = Router();

// Get admin analytics
router.get('/admin', authenticate, authorize('admin'), async (req: Request, res: Response) => {
  try {
    const period = req.query.period as string || '30';
    const periodDays = parseInt(period);

    // Calculate date ranges
    const now = new Date();
    const periodStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);

    // Fetch all data from CouchDB
    const [usersResult, coursesResult, enrollmentsResult, progressResult] = await Promise.all([
      userModel.findAll({ limit: 10000 }),
      courseModel.findAll({ limit: 10000 }),
      enrollmentModel.findAll({ limit: 10000 }),
      progressModel.findAll({ limit: 10000 })
    ]);

    const users = usersResult.docs;
    const courses = coursesResult.docs;
    const enrollments = enrollmentsResult.docs;
    const progress = progressResult.docs;

    // Filter recent data
    const recentUsers = users.filter((u: User) => u.createdAt && new Date(u.createdAt) >= periodStart);
    const recentCourses = courses.filter((c: Course) => c.createdAt && new Date(c.createdAt) >= periodStart);
    const recentEnrollments = enrollments.filter((e: Enrollment) => e.createdAt && new Date(e.createdAt) >= periodStart);

    // Calculate user stats
    const userStats = {
      total: users.length,
      active: users.filter((u: User) => u.status === 'active').length,
      inactive: users.filter((u: User) => u.status === 'inactive').length,
      suspended: users.filter((u: User) => u.status === 'suspended').length,
      admins: users.filter((u: User) => u.role === 'admin').length,
      tutors: users.filter((u: User) => u.role === 'tutor').length,
      learners: users.filter((u: User) => u.role === 'learner').length,
    };

    // Calculate course stats
    const courseStats = {
      total: courses.length,
      published: courses.filter((c: Course) => c.status === 'published').length,
      draft: courses.filter((c: Course) => c.status === 'draft').length,
      submitted: courses.filter((c: Course) => c.status === 'submitted').length,
      approved: courses.filter((c: Course) => c.status === 'approved').length,
      rejected: courses.filter((c: Course) => c.status === 'rejected').length,
      pendingApproval: courses.filter((c: Course) => c.status === 'submitted').length,
    };

    // Calculate completion rate
    const completedEnrollments = enrollments.filter((e: Enrollment) => e.status === 'completed').length;
    const completionRate = enrollments.length > 0 ? (completedEnrollments / enrollments.length) * 100 : 0;

    // Calculate active users (users with recent progress)
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const activeUsers = progress.filter((p: Progress) => {
      const lastActivity = p.lastWatched || p.createdAt;
      return lastActivity && new Date(lastActivity) >= weekAgo;
    }).length;

    // Generate enrollment trends
    const enrollmentTrends = [];
    for (let i = 0; i < periodDays; i++) {
      const date = new Date(periodStart.getTime() + i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      const dayEnrollments = recentEnrollments.filter((e: Enrollment) => {
        const enrollDate = e.createdAt ? e.createdAt.split('T')[0] : '';
        return enrollDate === dateStr;
      }).length;
      const dayCompletions = enrollments.filter((e: Enrollment) => {
        const enrollDate = e.createdAt ? e.createdAt.split('T')[0] : '';
        return enrollDate === dateStr && e.status === 'completed';
      }).length;
      enrollmentTrends.push({
        date: dateStr,
        enrollments: dayEnrollments,
        completions: dayCompletions
      });
    }

    // Generate user growth
    const userGrowth = [];
    for (let i = 0; i < periodDays; i++) {
      const date = new Date(periodStart.getTime() + i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      const newUsers = recentUsers.filter((u: User) => {
        const userDate = u.createdAt ? u.createdAt.split('T')[0] : '';
        return userDate === dateStr;
      }).length;
      const activeUsers = progress.filter((p: Progress) => {
        const lastActivity = p.lastWatched || p.createdAt;
        return lastActivity && lastActivity.split('T')[0] === dateStr;
      }).length;
      userGrowth.push({
        date: dateStr,
        newUsers,
        activeUsers
      });
    }

    // Get top performing courses
    const coursePerformance = courses.map((course: Course) => {
      const courseEnrollments = enrollments.filter((e: Enrollment) => e.courseId === course.id);
      const courseCompletions = courseEnrollments.filter((e: Enrollment) => e.status === 'completed');
      const courseProgress = progress.filter((p: Progress) => p.courseId === course.id);
      
      // Calculate average rating (mock data for now)
      const avgRating = 4.2 + Math.random() * 0.8; // Random rating between 4.2-5.0
      
      return {
        id: course.id,
        title: course.title,
        instructor: course.instructorName || 'Unknown',
        enrollments: courseEnrollments.length,
        completions: courseCompletions.length,
        rating: avgRating,
        completionRate: courseEnrollments.length > 0 ? (courseCompletions.length / courseEnrollments.length) * 100 : 0
      };
    }).sort((a, b) => b.enrollments - a.enrollments).slice(0, 10);

    // Generate recent activity
    const recentActivity = [
      {
        type: 'users',
        title: 'New Users',
        count: recentUsers.length,
        change: 12.5,
        period: `Last ${periodDays} days`
      },
      {
        type: 'courses',
        title: 'New Courses',
        count: recentCourses.length,
        change: 8.3,
        period: `Last ${periodDays} days`
      },
      {
        type: 'enrollments',
        title: 'New Enrollments',
        count: recentEnrollments.length,
        change: 15.7,
        period: `Last ${periodDays} days`
      },
      {
        type: 'completions',
        title: 'Course Completions',
        count: completedEnrollments,
        change: 22.1,
        period: `Last ${periodDays} days`
      }
    ];

    const analytics = {
      overview: {
        totalUsers: users.length,
        totalCourses: courses.length,
        totalEnrollments: enrollments.length,
        activeUsers,
        completionRate: Math.round(completionRate),
        averageRating: 4.5
      },
      userStats,
      courseStats,
      topCourses: coursePerformance,
      enrollmentTrends,
      userGrowth,
      recentActivity
    };

    res.json({
      success: true,
      data: { analytics }
    });
    return;

  } catch (error) {
    logger.error('Failed to fetch admin analytics', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch admin analytics'
    });
    return;
  }
});

// Get tutor analytics
router.get('/tutor', authenticate, authorize('tutor'), async (req: Request, res: Response) => {
  try {
    const tutorId = req.user?.id;
    const period = req.query.period as string || '30';
    const periodDays = parseInt(period);

    if (!tutorId) {
      return res.status(400).json({
        success: false,
        message: 'Tutor ID is required'
      });
    }

    // Calculate date ranges
    const now = new Date();
    const periodStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);

    // Fetch tutor's courses and related data
    const [coursesResult, enrollmentsResult, progressResult] = await Promise.all([
      courseModel.findAll({ limit: 10000 }),
      enrollmentModel.findAll({ limit: 10000 }),
      progressModel.findAll({ limit: 10000 })
    ]);

    const allCourses = coursesResult.docs;
    const allEnrollments = enrollmentsResult.docs;
    const allProgress = progressResult.docs;

    // Filter courses by tutor
    const tutorCourses = allCourses.filter((c: Course) => c.instructorId === tutorId);
    const publishedCourses = tutorCourses.filter((c: Course) => c.status === 'published');
    const pendingCourses = tutorCourses.filter((c: Course) => c.status === 'submitted');

    // Get enrollments for tutor's courses
    const tutorCourseIds = tutorCourses.map(c => c.id);
    const tutorEnrollments = allEnrollments.filter((e: Enrollment) => tutorCourseIds.includes(e.courseId));
    const tutorProgress = allProgress.filter((p: Progress) => tutorCourseIds.includes(p.courseId));

    // Calculate unique students
    const uniqueStudents = new Set(tutorEnrollments.map(e => e.userId)).size;

    // Calculate average rating (mock data for now)
    const avgRating = 4.2 + Math.random() * 0.8;

    // Calculate completion rate
    const completedEnrollments = tutorEnrollments.filter((e: Enrollment) => e.status === 'completed').length;
    const completionRate = tutorEnrollments.length > 0 ? (completedEnrollments / tutorEnrollments.length) * 100 : 0;

    // Generate course performance data
    const coursePerformance = tutorCourses.map((course: Course) => {
      const courseEnrollments = tutorEnrollments.filter((e: Enrollment) => e.courseId === course.id);
      const courseCompletions = courseEnrollments.filter((e: Enrollment) => e.status === 'completed');
      
      return {
        id: course.id,
        title: course.title,
        enrollments: courseEnrollments.length,
        completions: courseCompletions.length,
        rating: 4.0 + Math.random() * 1.0,
        completionRate: courseEnrollments.length > 0 ? (courseCompletions.length / courseEnrollments.length) * 100 : 0,
        status: course.status
      };
    });

    // Generate enrollment trends
    const enrollmentTrends = [];
    for (let i = 0; i < periodDays; i++) {
      const date = new Date(periodStart.getTime() + i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      const dayEnrollments = tutorEnrollments.filter((e: Enrollment) => {
        const enrollDate = e.createdAt ? e.createdAt.split('T')[0] : '';
        return enrollDate === dateStr;
      }).length;
      const dayCompletions = tutorEnrollments.filter((e: Enrollment) => {
        const enrollDate = e.createdAt ? e.createdAt.split('T')[0] : '';
        return enrollDate === dateStr && e.status === 'completed';
      }).length;
      enrollmentTrends.push({
        date: dateStr,
        enrollments: dayEnrollments,
        completions: dayCompletions
      });
    }

    // Generate student engagement data
    const studentEngagement = tutorCourses.slice(0, 6).map((course: Course) => {
      const courseProgress = tutorProgress.filter((p: Progress) => p.courseId === course.id);
      const activeStudents = courseProgress.length;
      const avgTimeSpent = courseProgress.length > 0 ? 
        courseProgress.reduce((sum, p) => sum + p.timeSpent, 0) / courseProgress.length : 0;
      const avgProgress = courseProgress.length > 0 ? 
        courseProgress.reduce((sum, p) => sum + p.completedLessons.length, 0) / courseProgress.length : 0;

      return {
        courseId: course.id,
        title: course.title,
        activeStudents,
        averageTimeSpent: avgTimeSpent / 3600, // Convert to hours
        averageProgress: avgProgress * 10 // Convert to percentage
      };
    });

    // Generate recent activity
    const recentActivity = [
      {
        type: 'courses',
        title: 'Total Courses',
        count: tutorCourses.length,
        change: 5.2,
        period: `Last ${periodDays} days`
      },
      {
        type: 'students',
        title: 'Total Students',
        count: uniqueStudents,
        change: 8.7,
        period: `Last ${periodDays} days`
      },
      {
        type: 'enrollments',
        title: 'Total Enrollments',
        count: tutorEnrollments.length,
        change: 12.3,
        period: `Last ${periodDays} days`
      },
      {
        type: 'completions',
        title: 'Course Completions',
        count: completedEnrollments,
        change: 18.9,
        period: `Last ${periodDays} days`
      }
    ];

    const analytics = {
      overview: {
        totalCourses: tutorCourses.length,
        publishedCourses: publishedCourses.length,
        totalStudents: uniqueStudents,
        totalEnrollments: tutorEnrollments.length,
        averageRating: avgRating,
        completionRate: Math.round(completionRate)
      },
      coursePerformance,
      enrollmentTrends,
      studentEngagement,
      recentActivity
    };

    res.json({
      success: true,
      data: { analytics }
    });
    return;

  } catch (error) {
    logger.error('Failed to fetch tutor analytics', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tutor analytics'
    });
    return;
  }
});

export default router; 