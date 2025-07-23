import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, adminOnly } from '../middleware/auth';
import { userModel } from '../models/User';
import { courseModel } from '../models/Course';
import { enrollmentModel } from '../models/Enrollment';
import { progressModel } from '../models/Progress';
import { courseWorkflowService } from '../services/courseWorkflowService';
import { emailService } from '../services/emailService';
import { logger } from '../utils/logger';
import { createRateLimiter } from '../middleware/rateLimiter';

// Create admin-specific rate limiter
const adminRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 200, // 200 requests per minute for admin operations
  message: 'Too many admin operations, please slow down.'
});
import { config } from '../config/config';
import { User, Course, Enrollment, Progress, CourseStatus, CourseCategory, CourseLevel, CourseWorkflowHistory, UserRole, UserStatus } from '../types';
import { body } from 'express-validator';
import { validate } from '../middleware/validation';
// Performance service removed - using basic analytics instead

const router = Router();

// Apply admin rate limiter to all admin routes
router.use(adminRateLimiter);

// Development rate limiting info middleware
const addAdminRateLimitInfo = (req: Request, res: Response, next: NextFunction) => {
  if (config.server.isDevelopment) {
    res.set({
      'X-Dev-Mode': 'true',
      'X-Admin-Rate-Limit': 'Enhanced admin rate limiting enabled',
      'X-Rate-Limit-Info': 'Use /api/debug/rate-limits to view current status',
    });
  }
  next();
};

// Apply to all admin routes
router.use(addAdminRateLimitInfo);

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(adminOnly);

// Validation for course approval/rejection
const courseApprovalValidation = [
  body('feedback').optional().isObject().withMessage('Feedback must be an object'),
  body('feedback.overallScore').optional().isInt({ min: 0, max: 100 }).withMessage('Overall score must be between 0 and 100'),
  body('feedback.criteria').optional().isObject().withMessage('Criteria must be an object'),
  body('feedback.criteria.contentQuality').optional().isInt({ min: 0, max: 100 }).withMessage('Content quality score must be between 0 and 100'),
  body('feedback.criteria.technicalQuality').optional().isInt({ min: 0, max: 100 }).withMessage('Technical quality score must be between 0 and 100'),
  body('feedback.criteria.marketability').optional().isInt({ min: 0, max: 100 }).withMessage('Marketability score must be between 0 and 100'),
  body('feedback.criteria.accessibility').optional().isInt({ min: 0, max: 100 }).withMessage('Accessibility score must be between 0 and 100'),
  body('feedback.criteria.engagement').optional().isInt({ min: 0, max: 100 }).withMessage('Engagement score must be between 0 and 100'),
  body('feedback.feedback').optional().isObject().withMessage('Feedback details must be an object'),
  body('feedback.feedback.strengths').optional().isArray().withMessage('Strengths must be an array'),
  body('feedback.feedback.improvements').optional().isArray().withMessage('Improvements must be an array'),
  body('feedback.feedback.requirements').optional().isArray().withMessage('Requirements must be an array'),
  body('feedback.detailedComments').optional().isArray().withMessage('Detailed comments must be an array'),
  body('feedback.estimatedRevisionTime').optional().isString().withMessage('Estimated revision time must be a string'),
  validate,
];

// Get admin dashboard statistics
router.get('/stats', async (req: Request, res: Response) => {
  try {
    // Use proper model methods to fetch data
    let courses: Course[];
    try {
      courses = await courseModel.getAllCourses();
      logger.info('Successfully fetched courses for stats:', { 
        count: courses.length,
        statuses: courses.map(c => c.status)
      });
    } catch (courseError) {
      logger.error('Failed to fetch courses using getAllCourses, trying fallback:', courseError);
      
      // Fallback: try with findAll
      try {
        const coursesResult = await courseModel.findAll({ limit: 10000 });
        courses = coursesResult.docs;
        logger.info('Fallback: Successfully fetched courses using findAll:', { count: courses.length });
      } catch (fallbackError) {
        logger.error('Both methods failed to fetch courses:', fallbackError);
        courses = []; // Default to empty array if all methods fail
      }
    }

    const [usersResult, enrollmentsResult, progressResult] = await Promise.all([
      userModel.findAll({ limit: 10000 }),
      enrollmentModel.findAll({ limit: 10000 }),
      progressModel.findAll({ limit: 10000 })
    ]);

    const users = usersResult.docs;
    const enrollments = enrollmentsResult.docs;
    const progress = progressResult.docs;

    logger.info('Successfully fetched all stats data:', {
      coursesCount: courses.length,
      usersCount: users.length,
      enrollmentsCount: enrollments.length,
      progressCount: progress.length
    });

    // Generate diverse recent activities from multiple sources
    const activities: Array<{
      id: string;
      type: string;
      description: string;
      user: string;
      timestamp: string;
      status: string;
      courseName?: string;
      userName?: string;
      adminAction?: boolean;
    }> = [];

    // Add recent user registrations (only tutors and learners - admins are rare)
    const recentUsers = users
      .filter(u => u.createdAt && (u.role === 'tutor' || u.role === 'learner'))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 3);

    recentUsers.forEach((user, index) => {
      activities.push({
        id: `user-${user._id || index}`,
        type: 'registration',
        description: `New ${user.role} joined the platform`,
        user: user.name || user.email?.split('@')[0] || 'Unknown User',
        userName: user.name || user.email?.split('@')[0] || 'Unknown User',
        timestamp: user.createdAt,
        status: 'completed'
      });
    });

    // Add recent user status changes (admin actions)
    const recentStatusChanges = users
      .filter(u => u.updatedAt && u.updatedAt !== u.createdAt)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 2);

    recentStatusChanges.forEach((user, index) => {
      const statusAction = user.status === 'active' ? 'activated' : 
                          user.status === 'inactive' ? 'deactivated' : 
                          user.status === 'suspended' ? 'suspended' : 'updated';
      
      activities.push({
        id: `user-status-${user._id || index}`,
        type: 'user_management',
        description: `User account ${statusAction}`,
        user: user.name || user.email?.split('@')[0] || 'Unknown User',
        userName: user.name || user.email?.split('@')[0] || 'Unknown User',
        timestamp: user.updatedAt,
        status: user.status === 'active' ? 'completed' : 'pending',
        adminAction: true
      });
    });

    // Add recent course submissions (important tutor activity)
    const recentCourseSubmissions = courses
      .filter(c => c.status === 'submitted' && c.submittedAt)
      .sort((a, b) => new Date(b.submittedAt!).getTime() - new Date(a.submittedAt!).getTime())
      .slice(0, 2); // Limit to avoid spam

    for (const course of recentCourseSubmissions) {
      try {
        const instructor = users.find(u => u._id === course.instructorId);
        activities.push({
          id: `course-submit-${course._id}`,
          type: 'submission',
          description: `Course submitted for approval`,
          user: instructor?.name || instructor?.email?.split('@')[0] || 'Unknown Instructor',
          userName: instructor?.name || instructor?.email?.split('@')[0] || 'Unknown Instructor',
          courseName: course.title,
          timestamp: course.submittedAt!,
          status: 'pending'
        });
      } catch (err) {
        // Skip if instructor not found
      }
    }

    // Add recent course approvals (important admin activity)
    const recentApprovals = courses
      .filter(c => c.status === 'published' && c.approvedAt)
      .sort((a, b) => new Date(b.approvedAt!).getTime() - new Date(a.approvedAt!).getTime())
      .slice(0, 2); // Limit to key events

    for (const course of recentApprovals) {
      try {
        const instructor = users.find(u => u._id === course.instructorId);
        activities.push({
          id: `course-approve-${course._id}`,
          type: 'approval',
          description: `Course approved and published`,
          user: instructor?.name || instructor?.email?.split('@')[0] || 'Unknown Instructor',
          userName: instructor?.name || instructor?.email?.split('@')[0] || 'Unknown Instructor',
          courseName: course.title,
          timestamp: course.approvedAt!,
          status: 'completed',
          adminAction: true
        });
      } catch (err) {
        // Skip if instructor not found
      }
    }

    // Add recent enrollments (important learner activity) - but limit to avoid spam
    const recentEnrollments = enrollments
      .filter(e => e.createdAt)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 3); // Reduced from 4 to 3

    for (const enrollment of recentEnrollments) {
      try {
        const user = users.find(u => u._id === enrollment.userId);
        const course = courses.find(c => c._id === enrollment.courseId);
        activities.push({
          id: `enrollment-${enrollment._id}`,
          type: 'enrollment',
          description: `Learner enrolled in course`,
          user: user?.name || user?.email?.split('@')[0] || 'Unknown Student',
          userName: user?.name || user?.email?.split('@')[0] || 'Unknown Student',
          courseName: course?.title || 'Unknown Course',
          timestamp: enrollment.createdAt,
          status: 'completed'
        });
      } catch (err) {
        // Skip if user or course not found
      }
    }

    // Add recent course completions (achievement milestones only)
    const completedEnrollments = enrollments
      .filter(e => e.status === 'completed' && e.completedAt)
      .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime())
      .slice(0, 2); // Reduced from 3 to 2 - only major achievements

    for (const enrollment of completedEnrollments) {
      try {
        const user = users.find(u => u._id === enrollment.userId);
        const course = courses.find(c => c._id === enrollment.courseId);
        activities.push({
          id: `completion-${enrollment._id}`,
          type: 'completion',
          description: `Learner completed course`,
          user: user?.name || user?.email?.split('@')[0] || 'Unknown Student',
          userName: user?.name || user?.email?.split('@')[0] || 'Unknown Student',
          courseName: course?.title || 'Unknown Course',
          timestamp: enrollment.completedAt!,
          status: 'completed'
        });
      } catch (err) {
        // Skip if user or course not found
      }
    }

    // Sort all activities by timestamp (most recent first) and take top 8 to avoid overwhelming
    const sortedActivities = activities
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 8); // Reduced from 10 to 8 for better performance

    const stats = {
      overview: {
        totalUsers: users.length,
        totalCourses: courses.length,
        totalEnrollments: enrollments.length,
        activeUsers: users.filter((u: User) => u.status === 'active').length,
      },
      users: {
        total: users.length,
        active: users.filter((u: User) => u.status === 'active').length,
        inactive: users.filter((u: User) => u.status === 'inactive').length,
        suspended: users.filter((u: User) => u.status === 'suspended').length,
        admins: users.filter((u: User) => u.role === 'admin').length,
        tutors: users.filter((u: User) => u.role === 'tutor').length,
        learners: users.filter((u: User) => u.role === 'learner').length,
      },
      courses: {
        total: courses.length,
        published: courses.filter((c: Course) => c.status === 'published').length,
        draft: courses.filter((c: Course) => c.status === 'draft').length,
        submitted: courses.filter((c: Course) => c.status === 'submitted').length,
        approved: courses.filter((c: Course) => c.status === 'approved').length,
        rejected: courses.filter((c: Course) => c.status === 'rejected').length,
        pendingApproval: courses.filter((c: Course) => c.status === 'submitted').length,
      },
      enrollments: {
        total: enrollments.length,
        active: enrollments.filter((e: Enrollment) => e.status === 'active').length,
        completed: enrollments.filter((e: Enrollment) => e.status === 'completed').length,
        suspended: enrollments.filter((e: Enrollment) => e.status === 'suspended').length,
      },
      progress: {
        averageProgress: progress.length > 0 ? 
          progress.reduce((sum: number, p: Progress) => sum + (p.completedLessons.length * 10), 0) / progress.length : 0,
        activeUsers: progress.filter((p: Progress) => p.timeSpent > 0).length,
      },
      recent: {
        activities: sortedActivities,
        pendingCourses: courses.filter((c: Course) => c.status === 'submitted').slice(0, 5).map(course => ({
          id: course._id,
          title: course.title,
          instructorName: users.find(u => u._id === course.instructorId)?.name || 'Unknown Instructor',
          submittedAt: course.submittedAt || course.createdAt,
          status: course.status
        })),
      }
    };

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    });
    return;
  } catch (error) {
    logger.error('Failed to fetch admin stats', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics',
    });
    return;
  }
});

// Get all users with pagination and filtering
router.get('/users', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const role = req.query.role as string;
    const status = req.query.status as string;
    const search = req.query.search as string;

    logger.info('Admin fetching users:', { page, limit, role, status, search });

    // Use the enhanced getAllUsers method for consistent data fetching
    let users: User[];
    try {
      users = await userModel.getAllUsers();
      logger.info('Successfully fetched users for admin:', { count: users.length });
    } catch (userError) {
      logger.error('Failed to fetch users using getAllUsers, trying fallback:', userError);
      
      // Fallback: try with findAll
      try {
        const usersResult = await userModel.findAll({ limit: 10000 });
        users = usersResult.docs;
        logger.info('Fallback: Successfully fetched users using findAll:', { count: users.length });
      } catch (fallbackError) {
        logger.error('Both methods failed to fetch users:', fallbackError);
        throw fallbackError;
      }
    }

    // Apply filters
    let filteredUsers = users;

    if (role) {
      filteredUsers = filteredUsers.filter((user: User) => user.role === role);
    }
    if (status) {
      filteredUsers = filteredUsers.filter((user: User) => user.status === status);
    }
    if (search) {
      const searchLower = search.toLowerCase();
      filteredUsers = filteredUsers.filter((user: User) => 
        user.name.toLowerCase().includes(searchLower) ||
        user.email.toLowerCase().includes(searchLower) ||
        (user.profile?.bio && user.profile.bio.toLowerCase().includes(searchLower))
      );
    }

    // Pagination
    const total = filteredUsers.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

    // Remove sensitive data and enhance user info
    const safeUsers = paginatedUsers.map((user: User) => ({
      id: user.id || user._id,
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      verified: user.verified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLogin: user.lastLogin,
      avatar: user.avatar,
      profile: user.profile ? {
        bio: user.profile.bio,
        location: user.profile.location,
        website: user.profile.website,
        expertise: user.profile.expertise,
        socialMedia: user.profile.socialMedia
      } : null,
    }));

    logger.info('Admin users fetched successfully:', { 
      total, 
      filtered: filteredUsers.length,
      paginated: paginatedUsers.length
    });

    res.json({
      success: true,
      data: {
        users: safeUsers,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: limit,
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    logger.error('Failed to fetch users for admin:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Update user status
router.put('/users/:userId/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { status, isActive } = req.body;

    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
      return;
    }

    // Handle both status and isActive formats for compatibility
    let finalStatus: 'active' | 'inactive' | 'suspended';
    if (status) {
      if (!['active', 'inactive', 'suspended'].includes(status)) {
        res.status(400).json({
          success: false,
          message: 'Invalid status. Must be active, inactive, or suspended.',
        });
        return;
      }
      finalStatus = status as 'active' | 'inactive' | 'suspended';
    } else if (typeof isActive === 'boolean') {
      finalStatus = isActive ? 'active' : 'inactive';
    } else {
      res.status(400).json({
        success: false,
        message: 'Either status or isActive must be provided.',
      });
      return;
    }

    const user = await userModel.findById(userId);
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
      });
      return;
    }

    await userModel.update(userId, { status: finalStatus });

    logger.info('User status updated', {
      userId,
      newStatus: finalStatus,
      adminId: (req as any).user.id,
    });

    res.json({
      success: true,
      message: 'User status updated successfully',
    });
    return;
  } catch (error) {
    logger.error('Failed to update user status', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to update user status',
    });
    return;
  }
});

// Create new user (Admin only)
router.post('/users', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, role } = req.body;
    const admin = (req as any).user;

    // Validate required fields
    if (!name || !email || !password || !role) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: name, email, password, role',
      });
      return;
    }

    // Validate role
    const allowedRoles = ['admin', 'tutor', 'learner'];
    if (!allowedRoles.includes(role)) {
      res.status(400).json({
        success: false,
        message: 'Invalid role. Allowed values: ' + allowedRoles.join(', '),
      });
      return;
    }

    // Check if user already exists
    const existingUser = await userModel.findByEmail(email);
    if (existingUser) {
      res.status(409).json({
        success: false,
        message: 'User with this email already exists',
      });
      return;
    }

    // Create user data
    const userData = {
      type: 'user' as const,
      id: '', // Will be set by the database
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: password, // Will be hashed by the model
      role: role as UserRole,
      status: 'active' as UserStatus,
      verified: true, // Admin-created users are auto-verified
      profile: {
        bio: '',
        expertise: [],
        location: '',
        website: '',
        socialMedia: {},
      },
      preferences: {
        language: 'en' as const,
        notifications: {
          email: true,
          push: true,
          marketing: false,
        },
        accessibility: {
          highContrast: false,
          largeText: false,
          screenReader: false,
          reducedMotion: false,
        },
      },
      refreshTokens: [],
    };

    // Create user
    const user = await userModel.create(userData);

    logger.info('User created by admin:', {
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      adminId: admin.id,
    });

    // Remove sensitive data
    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      verified: user.verified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: { user: safeUser },
    });
    return;
  } catch (error) {
    logger.error('Failed to create user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create user',
    });
    return;
  }
});

// Update user (Admin only)
router.put('/users/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { name, email, role, status } = req.body;
    const admin = (req as any).user;

    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
      return;
    }

    const user = await userModel.findById(userId);
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
      });
      return;
    }

    // Prepare update data
    const updateData: any = {
      updatedAt: new Date().toISOString(),
    };

    if (name && name.trim()) {
      updateData.name = name.trim();
    }

    if (email && email.trim()) {
      const emailLower = email.toLowerCase().trim();
      
      // Check if email is already taken by another user
      if (emailLower !== user.email) {
        const existingUser = await userModel.findByEmail(emailLower);
        if (existingUser && existingUser.id !== userId) {
          res.status(409).json({
            success: false,
            message: 'Email is already taken by another user',
          });
          return;
        }
      }
      
      updateData.email = emailLower;
    }

    if (role) {
      const allowedRoles = ['admin', 'tutor', 'learner'];
      if (!allowedRoles.includes(role)) {
        res.status(400).json({
          success: false,
          message: 'Invalid role. Allowed values: ' + allowedRoles.join(', '),
        });
        return;
      }
      updateData.role = role;
    }

    if (status) {
      const allowedStatuses = ['active', 'inactive', 'suspended'];
      if (!allowedStatuses.includes(status)) {
        res.status(400).json({
          success: false,
          message: 'Invalid status. Allowed values: ' + allowedStatuses.join(', '),
        });
        return;
      }
      updateData.status = status;
    }

    // Update user
    const updatedUser = await userModel.update(userId, updateData);

    logger.info('User updated by admin:', {
      userId,
      adminId: admin.id,
      changes: Object.keys(updateData),
    });

    // Remove sensitive data
    const safeUser = {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      status: updatedUser.status,
      verified: updatedUser.verified,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
    };

    res.json({
      success: true,
      message: 'User updated successfully',
      data: { user: safeUser },
    });
  } catch (error) {
    logger.error('Failed to update user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user',
    });
  }
});

// Get all courses (Admin) - with pagination and filtering
router.get('/courses', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 12;
    const status = req.query.status as CourseStatus;
    const category = req.query.category as CourseCategory;
    const level = req.query.level as CourseLevel;
    const search = req.query.search as string;
    const sortBy = req.query.sortBy as string || 'createdAt';
    const sortOrder = req.query.sortOrder as string || 'desc';

    logger.info('Admin fetching all courses:', { page, limit, status, category, level, search, sortBy, sortOrder });

    // Use the enhanced getAllCourses method for consistent data fetching
    let courses: Course[];
    try {
      courses = await courseModel.getAllCourses();
      logger.info('Successfully fetched courses for admin:', { count: courses.length });
    } catch (courseError) {
      logger.error('Failed to fetch courses using getAllCourses, trying fallback:', courseError);
      
      // Fallback: try with findAll
      try {
        const coursesResult = await courseModel.findAll({ limit: 10000 });
        courses = coursesResult.docs;
        logger.info('Fallback: Successfully fetched courses using findAll:', { count: courses.length });
      } catch (fallbackError) {
        logger.error('Both methods failed to fetch courses:', fallbackError);
        throw fallbackError;
      }
    }

    // Apply filters
    let filteredCourses = courses;

    if (status) {
      filteredCourses = filteredCourses.filter(course => course.status === status);
    }

    if (category) {
      filteredCourses = filteredCourses.filter(course => course.category === category);
    }

    if (level) {
      filteredCourses = filteredCourses.filter(course => course.level === level);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      filteredCourses = filteredCourses.filter(course => 
        course.title.toLowerCase().includes(searchLower) ||
        course.description.toLowerCase().includes(searchLower) ||
        course.instructorName.toLowerCase().includes(searchLower) ||
        (course.tags && course.tags.some(tag => tag.toLowerCase().includes(searchLower)))
      );
    }

    // Apply sorting
    filteredCourses.sort((a, b) => {
      let aValue: any = a[sortBy as keyof Course];
      let bValue: any = b[sortBy as keyof Course];

      // Handle nested properties
      if (sortBy === 'rating') {
        aValue = a.rating?.average || 0;
        bValue = b.rating?.average || 0;
      } else if (sortBy === 'enrollments') {
        aValue = a.enrollmentCount || 0;
        bValue = b.enrollmentCount || 0;
      }

      // Convert to strings for comparison if needed
      if (typeof aValue === 'string') aValue = aValue.toLowerCase();
      if (typeof bValue === 'string') bValue = bValue.toLowerCase();

      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    // Apply pagination
    const total = filteredCourses.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedCourses = filteredCourses.slice(startIndex, endIndex);

    // Enhance courses with additional data
    const enhancedCourses = await Promise.all(
      paginatedCourses.map(async (course) => {
        try {
          // Get enrollment count
          const courseId = course._id || course.id;
          if (!courseId) {
            throw new Error('Course ID is missing');
          }
          
          let enrollmentCount = 0;
          try {
            const enrollments = await enrollmentModel.getCourseEnrollments(courseId as string, { limit: 10000 });
            enrollmentCount = enrollments.enrollments.length;
          } catch (enrollmentError) {
            logger.warn('Failed to fetch enrollment count:', { courseId, error: enrollmentError });
            enrollmentCount = course.enrollmentCount || 0;
          }

          // Get instructor info
          let instructorName = course.instructorName || 'Unknown';
          let instructorEmail = 'Unknown';
          if (course.instructorId) {
            try {
              const instructor = await userModel.findById(course.instructorId);
              if (instructor) {
                instructorName = instructor.name || 'Unknown';
                instructorEmail = instructor.email || 'Unknown';
              }
            } catch (error) {
              logger.warn('Failed to fetch instructor info:', { courseId: course._id, error });
            }
          }

          return {
            ...course,
            id: course._id || course.id,
            _id: course._id,
            instructorName,
            instructorEmail,
            enrollments: enrollmentCount,
            enrollmentCount,
            rating: course.rating?.average || 0,
            totalRatings: course.rating?.count || 0,
            isActive: course.status !== 'archived',
            // Add additional fields for admin display
            submittedAt: course.submittedAt,
            approvedAt: course.approvedAt,
            publishedAt: course.publishedAt,
            rejectedAt: course.rejectedAt,
            rejectionReason: course.rejectionReason,
            qualityScore: course.qualityScore,
            workflowHistory: course.workflowHistory,
            validationResult: course.validationResult,
            approvalFeedback: course.approvalFeedback,
          };
        } catch (error) {
          logger.error('Failed to enhance course data:', { courseId: course._id, error });
          return {
            ...course,
            id: course._id || course.id,
            _id: course._id,
            instructorName: course.instructorName || 'Unknown',
            instructorEmail: 'Unknown',
            enrollments: 0,
            enrollmentCount: 0,
            rating: 0,
            totalRatings: 0,
            isActive: course.status !== 'archived',
          };
        }
      })
    );

    logger.info('Admin courses fetched successfully:', { 
      total, 
      filtered: filteredCourses.length,
      paginated: paginatedCourses.length
    });

    res.json({
      success: true,
      data: {
        courses: enhancedCourses,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: limit,
        },
      },
    });
  } catch (error) {
    logger.error('Failed to fetch admin courses:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch courses',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get pending courses (Admin) - separate endpoint for pending courses
router.get('/courses/pending', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 12;

    logger.info('Admin fetching pending courses:', { page, limit });

    // Get all courses and filter for pending/submitted status
    let courses: Course[];
    try {
      courses = await courseModel.getAllCourses();
    } catch (error) {
      logger.error('Failed to fetch courses using getAllCourses, trying fallback:', error);
      const coursesResult = await courseModel.findAll({ limit: 10000 });
      courses = coursesResult.docs;
    }

    // Filter for pending courses (including the new pending status)
    const pendingCourses = courses.filter(course => 
      course.status === 'pending' || course.status === 'submitted' || course.status === 'under_review'
    );

    // Apply pagination
    const total = pendingCourses.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedCourses = pendingCourses.slice(startIndex, endIndex);

    // Enhance courses with additional data
    const enhancedCourses = await Promise.all(
      paginatedCourses.map(async (course) => {
        try {
          // Get instructor info
          let instructorName = course.instructorName || 'Unknown';
          let instructorEmail = 'Unknown';
          if (course.instructorId) {
            try {
              const instructor = await userModel.findById(course.instructorId);
              if (instructor) {
                instructorName = instructor.name || 'Unknown';
                instructorEmail = instructor.email || 'Unknown';
              }
            } catch (error) {
              logger.warn('Failed to fetch instructor info:', { courseId: course._id, error });
            }
          }

          return {
            ...course,
            id: course._id || course.id,
            instructorName,
            instructorEmail,
            submittedAt: course.submittedAt || course.createdAt,
            qualityScore: course.qualityScore || 0,
          };
        } catch (error) {
          logger.error('Failed to enhance pending course data:', { courseId: course._id, error });
          return {
            ...course,
            id: course._id || course.id,
            instructorName: course.instructorName || 'Unknown',
            instructorEmail: 'Unknown',
            submittedAt: course.submittedAt || course.createdAt,
            qualityScore: course.qualityScore || 0,
          };
        }
      })
    );

    logger.info('Admin pending courses fetched successfully:', { 
      total, 
      paginated: paginatedCourses.length
    });

    res.json({
      success: true,
      data: {
        courses: enhancedCourses,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    logger.error('Failed to fetch pending courses:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending courses',
    });
  }
});

// Update course status (Admin) - approve/reject courses
router.put('/courses/:courseId/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const { courseId } = req.params;
    const { status, reason, notes } = req.body;
    const admin = (req as any).user;

    if (!courseId) {
      res.status(400).json({
        success: false,
        message: 'Course ID is required',
      });
      return;
    }

    if (!status) {
      res.status(400).json({
        success: false,
        message: 'Status is required',
      });
      return;
    }

    // Validate status
    const allowedStatuses: CourseStatus[] = ['approved', 'rejected', 'under_review', 'published', 'archived'];
    if (!allowedStatuses.includes(status as CourseStatus)) {
      res.status(400).json({
        success: false,
        message: 'Invalid status. Allowed values: ' + allowedStatuses.join(', '),
      });
      return;
    }

    const course = await courseModel.findById(courseId);
    if (!course) {
      res.status(404).json({
        success: false,
        message: 'Course not found',
      });
      return;
    }

    // Prepare update data
    const updateData: any = {
      status: status as CourseStatus,
      updatedAt: new Date().toISOString(),
    };

    // Set status-specific timestamps
    if (status === 'approved') {
      updateData.approvedAt = new Date().toISOString();
      updateData.publishedAt = new Date().toISOString(); // Auto-publish after approval
      updateData.status = 'published'; // Set status to published
      // Note: Courses are auto-published when approved by admin
    } else if (status === 'rejected') {
      updateData.rejectedAt = new Date().toISOString();
      updateData.rejectionReason = reason || 'No reason provided';
    } else if (status === 'under_review') {
      updateData.reviewStartedAt = new Date().toISOString();
    } else if (status === 'published') {
      updateData.publishedAt = new Date().toISOString();
    } else if (status === 'archived') {
      updateData.archivedAt = new Date().toISOString();
    }

    // Add to workflow history
    const workflowEntry = {
      id: `workflow_${Date.now()}`,
      action: status === 'approved' ? 'approve' : status === 'rejected' ? 'reject' : 'review',
      fromStatus: course.status,
      toStatus: status as CourseStatus,
      performedBy: admin.id,
      performedByRole: admin.role,
      timestamp: new Date().toISOString(),
      reason: reason || undefined,
      notes: notes || undefined,
    } as CourseWorkflowHistory;

    updateData.workflowHistory = [...(course.workflowHistory || []), workflowEntry];

    // Add approval feedback if provided
    if (notes && status === 'approved') {
      updateData.approvalFeedback = {
        id: `feedback_${Date.now()}`,
        reviewerId: admin.id,
        reviewerName: admin.name,
        status: 'approved',
        overallScore: 85, // Default score for approved courses
        criteria: {
          contentQuality: 85,
          technicalQuality: 85,
          marketability: 85,
          accessibility: 85,
          engagement: 85,
        },
        feedback: {
          strengths: ['Course approved by admin'],
          improvements: [],
          requirements: [],
        },
        detailedComments: notes ? [{ section: 'general', comment: notes, severity: 'minor' as const }] : [],
        reviewedAt: new Date().toISOString(),
      };
    }

    // Update the course
    const updatedCourse = await courseModel.update(courseId, updateData);

    logger.info('Course status updated by admin:', {
      courseId,
      oldStatus: course.status,
      newStatus: status,
      adminId: admin.id,
      reason: reason || 'No reason provided',
    });

    // Send email notification to instructor
    if (course.instructorId) {
      try {
        const instructor = await userModel.findById(course.instructorId);
        if (instructor) {
          const emailService = require('../services/emailService');
          if (status === 'approved') {
            await emailService.sendCourseApprovalEmail(instructor.email, course.title, notes);
          } else if (status === 'rejected') {
            await emailService.sendCourseRejectionEmail(instructor.email, course.title, reason || 'No reason provided');
          }
        }
      } catch (emailError) {
        logger.warn('Failed to send email notification:', emailError);
      }
    }

    res.json({
      success: true,
      message: `Course ${status} successfully`,
      data: {
        course: updatedCourse,
        workflowHistory: updateData.workflowHistory,
      },
    });
    return;
  } catch (error) {
    logger.error('Failed to update course status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update course status',
    });
    return;
  }
});

// Get all courses with admin view
router.get('/courses', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as string;
    const search = req.query.search as string;

    // Use the Course model's getAllCourses method which properly handles course documents
    let courses: Course[];
    try {
      courses = await courseModel.getAllCourses();
      logger.info('Successfully fetched courses:', { 
        count: courses.length,
        statuses: courses.map(c => c.status)
      });
    } catch (courseError) {
      logger.error('Failed to fetch courses using getAllCourses, trying fallback:', courseError);
      
      // Fallback: try with findAll
      try {
        const coursesResult = await courseModel.findAll({ limit: 10000 });
        courses = coursesResult.docs;
        logger.info('Fallback: Successfully fetched courses using findAll:', { count: courses.length });
      } catch (fallbackError) {
        logger.error('Both methods failed to fetch courses:', fallbackError);
        throw fallbackError;
      }
    }

    // Apply filters
    if (status) {
      courses = courses.filter((course: Course) => course.status === status);
    }
    if (search) {
      const searchLower = search.toLowerCase();
      courses = courses.filter((course: Course) => 
        course.title.toLowerCase().includes(searchLower) ||
        course.description.toLowerCase().includes(searchLower)
      );
    }

    // Pagination
    const total = courses.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedCourses = courses.slice(startIndex, endIndex);

    // Get instructor information for each course with proper error handling
    const coursesWithInstructor = await Promise.all(
      paginatedCourses.map(async (course: Course) => {
        let instructor = null;
        let instructorName = 'Unknown';
        let instructorEmail = 'Unknown';
        
        // Only try to fetch instructor if instructorId exists and is valid
        if (course.instructorId && course.instructorId.trim() !== '') {
          try {
            instructor = await userModel.findById(course.instructorId);
            if (instructor) {
              instructorName = instructor.name || 'Unknown';
              instructorEmail = instructor.email || 'Unknown';
            }
          } catch (userError) {
            logger.warn('Failed to fetch instructor for course:', { 
              courseId: course._id, 
              instructorId: course.instructorId, 
              error: userError 
            });
          }
        } else {
          logger.warn('Course has no valid instructor ID:', { 
            courseId: course._id, 
            instructorId: course.instructorId 
          });
        }

        return {
          ...course,
          id: course._id || course.id,
          instructorName,
          instructorEmail,
        };
      })
    );

    logger.info('Successfully processed courses with instructor info:', { 
      totalCourses: courses.length,
      paginatedCount: paginatedCourses.length,
      processedCount: coursesWithInstructor.length
    });

    res.json({
      success: true,
      data: {
        courses: coursesWithInstructor,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: limit,
        },
      },
    });
    return;
  } catch (error) {
    logger.error('Failed to fetch courses', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch courses',
    });
    return;
  }
});

// Update course status (approve/reject/archive)
router.put('/courses/:courseId/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const { courseId } = req.params;
    const { status, reason } = req.body;

    if (!courseId) {
      res.status(400).json({
        success: false,
        message: 'Course ID is required',
      });
      return;
    }

    if (!['submitted', 'approved', 'rejected', 'published', 'archived'].includes(status)) {
      res.status(400).json({
        success: false,
        message: 'Invalid status. Must be submitted, approved, rejected, published, or archived.',
      });
      return;
    }

    const course = await courseModel.findById(courseId);
    if (!course) {
      res.status(404).json({
        success: false,
        message: 'Course not found',
      });
      return;
    }

    // Admin approves courses and auto-publishes them
    const finalStatus = status === 'approved' ? 'published' : status;
    
    const updateData: any = { 
      status: finalStatus,
      rejectionReason: status === 'rejected' ? reason : undefined,
    };
    
    // Auto-publish when approved
    if (status === 'approved') {
      updateData.publishedAt = new Date().toISOString();
    }
    
    await courseModel.update(courseId, updateData);

    // Send email notification to instructor
    try {
      const instructor = await userModel.findById(course.instructorId);
      if (instructor) {
        if (finalStatus === 'approved') {
          await emailService.sendCourseApprovalEmail(instructor.email, course.title, true);
        } else if (status === 'rejected') {
          await emailService.sendCourseApprovalEmail(instructor.email, course.title, false, reason);
        }
      }
    } catch (emailError) {
      logger.error('Failed to send email notification', { 
        courseId, 
        instructorId: course.instructorId, 
        error: emailError 
      });
    }

    logger.info('Course status updated', {
      courseId,
      newStatus: finalStatus,
      reason,
      adminId: (req as any).user.id,
    });

    res.json({
      success: true,
      message: `Course ${finalStatus === 'published' ? 'approved and published' : finalStatus} successfully`,
      data: {
        courseId,
        status: finalStatus,
        reason,
      },
    });
  } catch (error) {
    logger.error('Failed to update course status', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to update course status',
    });
  }
});

// Get pending courses for review
router.get('/courses/pending', async (req: Request, res: Response) => {
  try {
    // Use the Course model's getAllCourses method which properly handles course documents
    let courses: Course[];
    try {
      courses = await courseModel.getAllCourses();
      logger.info('Successfully fetched courses for pending review:', { 
        count: courses.length,
        statuses: courses.map(c => c.status)
      });
    } catch (courseError) {
      logger.error('Failed to fetch courses using getAllCourses, trying fallback:', courseError);
      
      // Fallback: try with findAll
      try {
        const coursesResult = await courseModel.findAll({ limit: 10000 });
        courses = coursesResult.docs;
        logger.info('Fallback: Successfully fetched courses using findAll:', { count: courses.length });
      } catch (fallbackError) {
        logger.error('Both methods failed to fetch courses:', fallbackError);
        throw fallbackError;
      }
    }

    const pendingCourses = courses.filter((course: Course) => course.status === 'submitted');
    
    const coursesWithInstructor = await Promise.all(
      pendingCourses.map(async (course: Course) => {
        let instructor = null;
        let instructorName = 'Unknown';
        let instructorEmail = 'Unknown';
        
        // Only try to fetch instructor if instructorId exists and is valid
        if (course.instructorId && course.instructorId.trim() !== '') {
          try {
            instructor = await userModel.findById(course.instructorId);
            if (instructor) {
              instructorName = instructor.name || 'Unknown';
              instructorEmail = instructor.email || 'Unknown';
            }
          } catch (userError) {
            logger.warn('Failed to fetch instructor for pending course:', { 
              courseId: course._id, 
              instructorId: course.instructorId, 
              error: userError 
            });
          }
        } else {
          logger.warn('Pending course has no valid instructor ID:', { 
            courseId: course._id, 
            instructorId: course.instructorId 
          });
        }

        return {
          ...course,
          id: course._id || course.id,
          instructorName,
          instructorEmail,
        };
      })
    );

    logger.info('Successfully processed pending courses:', { 
      totalPending: pendingCourses.length,
      processedCount: coursesWithInstructor.length
    });

    res.json({
      success: true,
      data: coursesWithInstructor,
    });
    return;
  } catch (error) {
    logger.error('Failed to fetch pending courses', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending courses',
    });
    return;
  }
});

// Get analytics for a specific course
router.get('/courses/:courseId/analytics', async (req: Request, res: Response): Promise<void> => {
  try {
    const { courseId } = req.params;

    if (!courseId) {
      res.status(400).json({
        success: false,
        message: 'Course ID is required',
      });
      return;
    }

    const course = await courseModel.findById(courseId);
    if (!course) {
      res.status(404).json({
        success: false,
        message: 'Course not found',
      });
      return;
    }

    const [enrollmentsResult, progressResult] = await Promise.all([
      enrollmentModel.getCourseEnrollments(courseId, { limit: 10000 }),
      progressModel.getCourseProgress(courseId, { limit: 10000 })
    ]);

    const enrollments = enrollmentsResult.enrollments;
    const progress = progressResult.progress;

    const analytics = {
      course: {
        id: course.id,
        title: course.title,
        status: course.status,
        createdAt: course.createdAt,
      },
      enrollments: {
        total: enrollments.length,
        active: enrollments.filter((e: Enrollment) => e.status === 'active').length,
        completed: enrollments.filter((e: Enrollment) => e.status === 'completed').length,
        suspended: enrollments.filter((e: Enrollment) => e.status === 'suspended').length,
        refunded: enrollments.filter((e: Enrollment) => e.status === 'refunded').length,
      },
      progress: {
        total: progress.length,
        averageProgress: progress.length > 0 ? 
          progress.reduce((sum: number, p: Progress) => sum + (p.completedLessons.length * 10), 0) / progress.length : 0,
        withProgress: progress.filter((p: Progress) => p.completedLessons.length > 0).length,
        activeUsers: progress.filter((p: Progress) => p.timeSpent > 0).length,
        totalTimeSpent: progress.reduce((sum: number, p: Progress) => sum + p.timeSpent, 0),
      },
    };

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    logger.error('Failed to fetch course analytics', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch course analytics',
    });
  }
});

// Get system analytics
router.get('/analytics', async (req: Request, res: Response) => {
  try {
    const period = req.query.period as string || '30'; // Default to 30 days
    const periodDays = parseInt(period);

    // Calculate date ranges
    const now = new Date();
    const periodStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
    const endDate = now.toISOString();
    const startDate = periodStart.toISOString();

    // Use proper model methods to fetch data
    let courses: Course[];
    try {
      courses = await courseModel.getAllCourses();
      logger.info('Successfully fetched courses for analytics:', { 
        count: courses.length,
        statuses: courses.map(c => c.status)
      });
    } catch (courseError) {
      logger.error('Failed to fetch courses using getAllCourses, trying fallback:', courseError);
      
      // Fallback: try with findAll
      try {
        const coursesResult = await courseModel.findAll({ limit: 10000 });
        courses = coursesResult.docs;
        logger.info('Fallback: Successfully fetched courses using findAll:', { count: courses.length });
      } catch (fallbackError) {
        logger.error('Both methods failed to fetch courses:', fallbackError);
        courses = []; // Default to empty array if all methods fail
      }
    }

    const [usersResult, enrollmentsResult, progressResult] = await Promise.all([
      userModel.findAll({ limit: 10000 }),
      enrollmentModel.findAll({ limit: 10000 }),
      progressModel.findAll({ limit: 10000 })
    ]);

    const users = usersResult.docs;
    const enrollments = enrollmentsResult.docs;
    const progress = progressResult.docs;

    logger.info('Successfully fetched all analytics data:', {
      coursesCount: courses.length,
      usersCount: users.length,
      enrollmentsCount: enrollments.length,
      progressCount: progress.length
    });

    // Filter data by period
    const recentUsers = users.filter((u: User) => u.createdAt && new Date(u.createdAt) >= periodStart);
    const recentCourses = courses.filter((c: Course) => c.createdAt && new Date(c.createdAt) >= periodStart);
    const recentEnrollments = enrollments.filter((e: Enrollment) => e.createdAt && new Date(e.createdAt) >= periodStart);
    const recentProgress = progress.filter((p: Progress) => {
      try {
        const createdAt = p.createdAt;
        const lastWatched = p.lastWatched;
        const lastActivity = lastWatched || createdAt;
        return lastActivity && new Date(lastActivity) >= periodStart;
      } catch (error) {
        return false;
      }
    });

    // Calculate enrollment timeline for charts
    const enrollmentTimeline: Array<{ date: string; enrollments: number }> = [];
    const timelineMap = new Map<string, number>();
    
    // Generate timeline for the period
    for (let i = 0; i < periodDays; i++) {
      const date = new Date(periodStart.getTime() + i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      if (dateStr) {
        timelineMap.set(dateStr, 0);
      }
    }

    // Count enrollments by date
    recentEnrollments.forEach((enrollment: Enrollment) => {
      const dateStr = enrollment.createdAt ? enrollment.createdAt.split('T')[0] : '';
      if (dateStr && timelineMap.has(dateStr)) {
        timelineMap.set(dateStr, timelineMap.get(dateStr)! + 1);
      }
    });

    // Convert to timeline array
    timelineMap.forEach((count, date) => {
      enrollmentTimeline.push({ date, enrollments: count });
    });

    // Calculate completion rate
    const completedEnrollments = enrollments.filter((e: Enrollment) => e.status === 'completed').length;
    const completionRate = enrollments.length > 0 ? (completedEnrollments / enrollments.length) * 100 : 0;

    // Calculate average time to complete
    const completedProgress = progress.filter((p: Progress) => p.completedLessons.length > 0);
    const avgTimeToComplete = completedProgress.length > 0 ? 
      completedProgress.reduce((sum, p) => sum + p.timeSpent, 0) / completedProgress.length : 0;

    // Calculate user retention (users who have activity in the last 7 days)
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const activeUsers = progress.filter((p: Progress) => {
      const lastActivity = p.lastWatched || p.createdAt;
      return lastActivity && new Date(lastActivity) >= weekAgo;
    }).length;
    const userRetention = users.length > 0 ? (activeUsers / users.length) * 100 : 0;

    // Calculate average progress
    const avgProgress = progress.length > 0 ? 
      progress.reduce((sum, p) => sum + (p.completedLessons.length * 10), 0) / progress.length : 0;

    // Calculate average time spent
    const avgTimeSpent = progress.length > 0 ? 
      progress.reduce((sum, p) => sum + p.timeSpent, 0) / progress.length : 0;

    const analytics = {
      period: {
        days: periodDays,
        startDate,
        endDate
      },
      overview: {
        totalUsers: users.length,
        totalCourses: courses.length,
        totalEnrollments: enrollments.length,
        activeUsers: activeUsers,
      },
      enrollments: {
        total: enrollments.length,
        byStatus: {
          active: enrollments.filter((e: Enrollment) => e.status === 'active').length,
          completed: enrollments.filter((e: Enrollment) => e.status === 'completed').length,
          suspended: enrollments.filter((e: Enrollment) => e.status === 'suspended').length,
          refunded: enrollments.filter((e: Enrollment) => e.status === 'refunded').length,
        },
        timeline: enrollmentTimeline,
      },
      progress: {
        averageProgress: Math.round(avgProgress),
        averageTimeSpent: Math.round(avgTimeSpent),
        completedCourses: completedEnrollments,
        activeUsers: activeUsers,
      },
      performance: {
        completionRate: Math.round(completionRate),
        averageTimeToComplete: Math.round(avgTimeToComplete),
        userRetention: Math.round(userRetention),
      },
      growth: {
        newUsers: recentUsers.length,
        newCourses: recentCourses.length,
        newEnrollments: recentEnrollments.length,
      },
      engagement: {
        averageEnrollmentsPerUser: users.length > 0 ? Math.round((enrollments.length / users.length) * 100) / 100 : 0,
        averageTimeSpent: Math.round(avgTimeSpent),
        completionRate: Math.round(completionRate),
      },
    };

    res.json({
      success: true,
      data: { analytics },
    });
    return;
  } catch (error) {
    logger.error('Failed to fetch system analytics', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch system analytics',
    });
    return;
  }
});

// Delete/deactivate user
router.delete('/users/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { force = false } = req.query; // Allow force deletion

    logger.info('Admin delete user request:', { userId, force });

    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
      return;
    }

    let user = await userModel.findById(userId);
    
    // If not found by direct ID, try to find in all users (as a fallback)
    if (!user) {
      logger.warn('User not found by direct ID, trying fallback search:', { userId });
      try {
        const allUsers = await userModel.getAllUsers();
        user = allUsers.find(u => u._id === userId || u.id === userId) || null;
        if (user) {
          logger.info('Found user via fallback search:', { userId, foundId: user._id });
        }
      } catch (fallbackError) {
        logger.error('Fallback user search failed:', fallbackError);
      }
    }
    
    if (!user) {
      logger.warn('User not found for deletion after all attempts:', { userId });
      res.status(404).json({
        success: false,
        message: 'User not found',
      });
      return;
    }

    // Don't allow deletion of admin users unless forced
    if (user.role === 'admin' && !force) {
      res.status(403).json({
        success: false,
        message: 'Cannot delete admin users. Use force=true to delete anyway.',
      });
      return;
    }

    // Check if user has enrollments or courses
    let hasConstraints = false;
    const constraintDetails = [];

    try {
      // Check if user is a tutor with courses
      if (user.role === 'tutor') {
        const coursesResult = await courseModel.findAll({ limit: 1000 });
        const tutorCourses = coursesResult.docs.filter((course: any) => course.instructorId === userId);
        
        if (tutorCourses.length > 0) {
          hasConstraints = true;
          constraintDetails.push(`${tutorCourses.length} courses as instructor`);
        }
      }

      // Check if user has enrollments
      if (user.role === 'learner') {
        const enrollmentsResult = await enrollmentModel.findAll({ limit: 1000 });
        const userEnrollments = enrollmentsResult.docs.filter((enrollment: any) => enrollment.userId === userId);
        
        if (userEnrollments.length > 0) {
          hasConstraints = true;
          constraintDetails.push(`${userEnrollments.length} course enrollments`);
        }
      }
    } catch (checkError) {
      logger.warn('Failed to check user constraints during deletion:', checkError);
    }

    // If user has constraints and not forced, return error
    if (hasConstraints && !force) {
      res.status(400).json({
        success: false,
        message: `User has associated data and cannot be deleted. Use force=true to delete anyway.`,
        data: {
          constraints: constraintDetails,
          suggestion: 'Consider deactivating the user instead of deleting'
        }
      });
      return;
    }

    // Proceed with actual deletion from CouchDB using the user's _id
    const actualUserId = user._id || userId;
    logger.info('Attempting to delete user:', { userId, actualUserId, userName: user.name });
    
    const deleted = await userModel.delete(actualUserId);
    
    if (!deleted) {
      res.status(500).json({
        success: false,
        message: 'Failed to delete user from database',
      });
      return;
    }

    logger.info('User deleted by admin', {
      userId,
      userName: user.name,
      userRole: user.role,
      force,
      constraints: constraintDetails,
      adminId: (req as any).user.id,
    });

    res.json({
      success: true,
      message: force ? 'User force deleted successfully' : 'User deleted successfully',
    });
  } catch (error) {
    logger.error('Failed to delete user', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to delete user',
    });
  }
});

// ================================
// ADMIN PROFILE MANAGEMENT
// ================================

// Get admin profile
router.get('/profile', async (req: Request, res: Response): Promise<void> => {
  try {
    const adminId = (req as any).user.id;
    const admin = await userModel.findById(adminId);

    if (!admin) {
      res.status(404).json({
        success: false,
        message: 'Admin profile not found',
      });
      return;
    }

    // Get admin statistics
    const [usersResult, coursesResult, enrollmentsResult] = await Promise.all([
      userModel.findAll({ limit: 10000 }).catch(() => ({ docs: [] })),
      courseModel.getAllCourses().catch(() => []),
      enrollmentModel.findAll({ limit: 10000 }).catch(() => ({ docs: [] }))
    ]);

    const users = usersResult.docs || [];
    const courses = Array.isArray(coursesResult) ? coursesResult : [];
    const enrollments = enrollmentsResult.docs || [];

    const statistics = {
      totalUsers: users.length,
      totalCourses: courses.length,
      totalEnrollments: enrollments.length,
      totalLogins: (admin as any).loginCount || 0,
      systemUptime: process.uptime ? `${Math.floor(process.uptime() / 86400)}d ${Math.floor((process.uptime() % 86400) / 3600)}h` : 'N/A',
      lastBackup: 'N/A', // This would come from your backup system
    };

    // Remove sensitive data
    const profileData = {
      id: admin.id || admin._id,
      firstName: admin.name ? admin.name.split(' ')[0] : '',
      lastName: admin.name ? admin.name.split(' ').slice(1).join(' ') : '',
      email: admin.email,
      phone: (admin.profile as any)?.phone || '',
      bio: admin.profile?.bio || '',
      avatar: admin.avatar,
      role: admin.role,
      status: admin.status,
      lastLogin: admin.lastLogin,
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt,
      preferences: {
        language: admin.preferences?.language || 'en',
        timezone: (admin.preferences as any)?.timezone || 'UTC',
        theme: (admin.preferences as any)?.theme || 'light',
        autoLogout: (admin.preferences as any)?.autoLogout || 30,
        notifications: {
          email: admin.preferences?.notifications?.email ?? true,
          push: admin.preferences?.notifications?.push ?? true,
          sms: (admin.preferences?.notifications as any)?.sms ?? false,
        },
        twoFactorEnabled: (admin.preferences as any)?.twoFactorEnabled ?? false,
      },
      permissions: (admin as any).permissions || ['admin:*'],
      statistics,
    };

    logger.info('Admin profile fetched', { adminId });

    res.json({
      success: true,
      data: profileData,
    });
  } catch (error) {
    logger.error('Failed to fetch admin profile', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch admin profile',
    });
  }
});

// Update admin profile
router.put('/profile', async (req: Request, res: Response): Promise<void> => {
  try {
    const adminId = (req as any).user.id;
    const {
      firstName,
      lastName,
      email,
      phone,
      bio,
      preferences,
    } = req.body;

    const admin = await userModel.findById(adminId);
    if (!admin) {
      res.status(404).json({
        success: false,
        message: 'Admin profile not found',
      });
      return;
    }

    // Prepare update data
    const updateData: any = {
      updatedAt: new Date().toISOString(),
    };

    // Update name if provided
    if (firstName || lastName) {
      const fullName = `${firstName || ''} ${lastName || ''}`.trim();
      if (fullName) {
        updateData.name = fullName;
      }
    }

    // Update email if provided and different
    if (email && email !== admin.email) {
      const emailLower = email.toLowerCase().trim();
      
      // Check if email is already taken
      const existingUser = await userModel.findByEmail(emailLower);
      if (existingUser && existingUser.id !== adminId) {
        res.status(409).json({
          success: false,
          message: 'Email is already taken',
        });
        return;
      }
      
      updateData.email = emailLower;
    }

    // Update profile fields
    updateData.profile = {
      ...admin.profile,
      phone: phone || (admin.profile as any)?.phone || '',
      bio: bio || admin.profile?.bio || '',
    };

    // Update preferences
    if (preferences) {
      updateData.preferences = {
        ...admin.preferences,
        language: preferences.language || admin.preferences?.language || 'en',
        timezone: preferences.timezone || (admin.preferences as any)?.timezone || 'UTC',
        theme: preferences.theme || (admin.preferences as any)?.theme || 'light',
        autoLogout: preferences.autoLogout || (admin.preferences as any)?.autoLogout || 30,
        notifications: {
          email: preferences.notifications?.email ?? admin.preferences?.notifications?.email ?? true,
          push: preferences.notifications?.push ?? admin.preferences?.notifications?.push ?? true,
          sms: preferences.notifications?.sms ?? (admin.preferences?.notifications as any)?.sms ?? false,
        },
        twoFactorEnabled: preferences.twoFactorEnabled ?? (admin.preferences as any)?.twoFactorEnabled ?? false,
      };
    }

    // Update the admin profile
    const updatedAdmin = await userModel.update(adminId, updateData);

    logger.info('Admin profile updated', { adminId });

    // Return updated profile (without sensitive data)
    const profileData = {
      id: updatedAdmin.id || updatedAdmin._id,
      firstName: updatedAdmin.name ? updatedAdmin.name.split(' ')[0] : '',
      lastName: updatedAdmin.name ? updatedAdmin.name.split(' ').slice(1).join(' ') : '',
      email: updatedAdmin.email,
      phone: (updatedAdmin.profile as any)?.phone || '',
      bio: updatedAdmin.profile?.bio || '',
      avatar: updatedAdmin.avatar,
      role: updatedAdmin.role,
      status: updatedAdmin.status,
      lastLogin: updatedAdmin.lastLogin,
      createdAt: updatedAdmin.createdAt,
      updatedAt: updatedAdmin.updatedAt,
      preferences: updatedAdmin.preferences,
    };

    res.json({
      success: true,
      message: 'Admin profile updated successfully',
      data: profileData,
    });
  } catch (error) {
    logger.error('Failed to update admin profile', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to update admin profile',
    });
  }
});

// ================================
// COURSE CRUD OPERATIONS
// ================================

// Create new course (Admin)
router.post('/courses', async (req: Request, res: Response) => {
  try {
    const {
      title,
      description,
      category,
      level,
      language,
      duration,
      instructorId,
      tags,
      thumbnail,
      price,
      currency,
      objectives,
      prerequisites,
      lessons,
      resources,
      skills,
      status = 'draft'
    } = req.body;

    // Validate required fields
    if (!title || !description || !category || !level || !language || !instructorId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: title, description, category, level, language, instructorId',
      });
    }

    // Validate instructor exists
    const instructor = await userModel.findById(instructorId);
    if (!instructor) {
      return res.status(404).json({
        success: false,
        message: 'Instructor not found',
      });
    }

    // Validate instructor role
    if (instructor.role !== 'tutor' && instructor.role !== 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Instructor must be a tutor or admin',
      });
    }

    // Create course data
    const courseData: Omit<Course, '_id' | '_rev' | 'createdAt' | 'updatedAt'> = {
      type: 'course',
      id: '', // Will be set by the database
      title,
      description,
      shortDescription: description.substring(0, 150) + (description.length > 150 ? '...' : ''),
      category,
      level,
      language,
      instructorId,
      instructorName: instructor.name,
      tags: tags || [],
      thumbnail: thumbnail || '',
      previewVideo: '',
      price: price || 0,
      currency: currency || 'USD',
      requirements: prerequisites || [],
      learningObjectives: objectives || [],
      targetAudience: 'General learners',
      sections: lessons ? lessons.map((lesson: any, index: number) => ({
        id: `section-${index}`,
        title: lesson.title || `Section ${index + 1}`,
        description: lesson.description || '',
        lessons: [lesson],
        order: index,
        estimatedDuration: lesson.duration || 0,
        learningObjectives: [],
        isPublished: true,
      })) : [],
      totalDuration: duration || 0,
      totalLessons: lessons ? lessons.length : 0,
      status,
      
      // Versioning
      version: '1.0.0',
      isCurrentVersion: true,
      
      // Quality and validation
      qualityScore: 0,
      validationResult: {
        isValid: true,
        errors: [],
        warnings: [],
        score: 0
      },
      
      // Workflow tracking
      workflowHistory: [],
      
      // Content flags
      contentFlags: {
        hasVideo: false,
        hasQuizzes: false,
        hasAssignments: false,

        hasPrerequisites: (prerequisites && prerequisites.length > 0),
        isAccessible: false
      },
      
      // Metrics
      metrics: {
        views: 0,
        completionRate: 0,
        avgTimeToComplete: 0,
        dropoffPoints: [],
        engagement: {
          avgSessionDuration: 0,
          returnRate: 0,
          discussionPosts: 0
        },
        performance: {
          avgQuizScore: 0,
          assignmentSubmissionRate: 0,
  
        }
      },
      
      // Rating
      rating: {
        average: 0,
        count: 0,
        distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
      },
      
      // Business metrics
      enrollmentCount: 0,
      completionCount: 0,
      revenue: 0,
      
      // SEO
      seo: {
        metaTitle: title,
        metaDescription: description.substring(0, 150),
        keywords: tags || [],
        slug: title?.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || ''
      },
      
      // Accessibility
      accessibility: {
        compliantWith: [],
        hasTranscriptions: false,
        hasCaptions: false,
        hasAudioDescriptions: false,
        keyboardNavigable: false,
        screenReaderOptimized: false
      },
      
      // Scheduling
      schedule: {
        cohortBased: false
      }
    };

    const course = await courseModel.create(courseData);

    logger.info('Course created by admin', {
      courseId: course.id,
      title: course.title,
      instructorId: course.instructorId,
      adminId: (req as any).user.id,
    });

    res.status(201).json({
      success: true,
      message: 'Course created successfully',
      data: {
        ...course,
        instructorName: instructor.name,
        instructorEmail: instructor.email,
      },
    });
    return;
  } catch (error) {
    logger.error('Failed to create course', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to create course',
    });
    return;
  }
});

// Get single course details (Admin)
router.get('/courses/:courseId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { courseId } = req.params;

    if (!courseId) {
      res.status(400).json({
        success: false,
        message: 'Course ID is required',
      });
      return;
    }

    const course = await courseModel.findById(courseId);
    if (!course) {
      res.status(404).json({
        success: false,
        message: 'Course not found',
      });
      return;
    }

    // Get instructor information
    let instructor = null;
    let instructorName = 'Unknown';
    let instructorEmail = 'Unknown';
    
    if (course.instructorId && course.instructorId.trim() !== '') {
      try {
        instructor = await userModel.findById(course.instructorId);
        if (instructor) {
          instructorName = instructor.name || 'Unknown';
          instructorEmail = instructor.email || 'Unknown';
        }
      } catch (userError) {
        logger.warn('Failed to fetch instructor for course:', { 
          courseId: course._id, 
          instructorId: course.instructorId, 
          error: userError 
        });
      }
    }

    // Get course statistics
    const [enrollmentsResult, progressResult] = await Promise.all([
      enrollmentModel.getCourseEnrollments(courseId, { limit: 10000 }).catch(() => ({ enrollments: [] })),
      progressModel.getCourseProgress(courseId, { limit: 10000 }).catch(() => ({ progress: [] }))
    ]);

    const enrollments = enrollmentsResult.enrollments || [];
    const progress = progressResult.progress || [];

    const courseWithDetails = {
      ...course,
      id: course._id || course.id,
      instructorName,
      instructorEmail,
      enrollments: enrollments.length,
      activeEnrollments: enrollments.filter((e: Enrollment) => e.status === 'active').length,
      completedEnrollments: enrollments.filter((e: Enrollment) => e.status === 'completed').length,
      totalProgress: progress.length,
      averageProgress: progress.length > 0 ? 
        progress.reduce((sum: number, p: Progress) => sum + (p.completedLessons.length * 10), 0) / progress.length : 0,
    };

    logger.info('Course details fetched by admin', {
      courseId,
      adminId: (req as any).user.id,
    });

    res.json({
      success: true,
      data: courseWithDetails,
    });
  } catch (error) {
    logger.error('Failed to fetch course details', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch course details',
    });
  }
});

// Update course details (Admin)
router.put('/courses/:courseId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { courseId } = req.params;
    const updateData = req.body;

    if (!courseId) {
      res.status(400).json({
        success: false,
        message: 'Course ID is required',
      });
      return;
    }

    // Remove system fields that shouldn't be updated directly
    const allowedFields = [
      'title', 'description', 'category', 'level', 'language', 'duration', 
      'instructorId', 'tags', 'thumbnail', 'price', 'currency', 
      'objectives', 'prerequisites', 'lessons', 'resources', 'skills'
    ];

    const filteredData = Object.keys(updateData)
      .filter(key => allowedFields.includes(key))
      .reduce((obj, key) => {
        obj[key] = updateData[key];
        return obj;
      }, {} as any);

    if (Object.keys(filteredData).length === 0) {
      res.status(400).json({
        success: false,
        message: 'No valid fields to update',
      });
      return;
    }

    const course = await courseModel.findById(courseId);
    if (!course) {
      res.status(404).json({
        success: false,
        message: 'Course not found',
      });
      return;
    }

    // Validate instructor if instructorId is being updated
    if (filteredData.instructorId) {
      const instructor = await userModel.findById(filteredData.instructorId);
      if (!instructor) {
        res.status(404).json({
          success: false,
          message: 'Instructor not found',
        });
        return;
      }
      if (instructor.role !== 'tutor' && instructor.role !== 'admin') {
        res.status(400).json({
          success: false,
          message: 'Instructor must be a tutor or admin',
        });
        return;
      }
    }

    // Add updated timestamp
    filteredData.updatedAt = new Date().toISOString();

    const updatedCourse = await courseModel.update(courseId, filteredData);

    // Get instructor information for response
    let instructorName = 'Unknown';
    let instructorEmail = 'Unknown';
    const finalInstructorId = filteredData.instructorId || course.instructorId;
    
    if (finalInstructorId && finalInstructorId.trim() !== '') {
      try {
        const instructor = await userModel.findById(finalInstructorId);
        if (instructor) {
          instructorName = instructor.name || 'Unknown';
          instructorEmail = instructor.email || 'Unknown';
        }
      } catch (userError) {
        logger.warn('Failed to fetch instructor for updated course:', { 
          courseId, 
          instructorId: finalInstructorId, 
          error: userError 
        });
      }
    }

    logger.info('Course updated by admin', {
      courseId,
      updatedFields: Object.keys(filteredData),
      adminId: (req as any).user.id,
    });

    res.json({
      success: true,
      message: 'Course updated successfully',
      data: {
        ...updatedCourse,
        instructorName,
        instructorEmail,
      },
    });
  } catch (error) {
    logger.error('Failed to update course', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to update course',
    });
  }
});

// Delete course (Admin)
router.delete('/courses/:courseId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { courseId } = req.params;
    const { force = false } = req.query; // Allow force deletion

    if (!courseId) {
      res.status(400).json({
        success: false,
        message: 'Course ID is required',
      });
      return;
    }

    const course = await courseModel.findById(courseId);
    if (!course) {
      res.status(404).json({
        success: false,
        message: 'Course not found',
      });
      return;
    }

    // Check if course has enrollments
    const enrollmentsResult = await enrollmentModel.getCourseEnrollments(courseId, { limit: 1 })
      .catch(() => ({ enrollments: [] }));
    const hasEnrollments = enrollmentsResult.enrollments && enrollmentsResult.enrollments.length > 0;

    if (hasEnrollments && !force) {
      res.status(400).json({
        success: false,
        message: 'Course has enrollments and cannot be deleted. Use force=true to delete anyway or archive instead.',
        data: {
          enrollments: enrollmentsResult.enrollments.length,
          suggestion: 'Consider archiving the course instead of deleting it'
        }
      });
      return;
    }

    // If force delete or no enrollments, proceed with deletion
    await courseModel.delete(courseId);

    // Clean up enrollments when course is deleted
    if (hasEnrollments) {
      try {
        // Get all enrollments for this course
        const allEnrollments = await enrollmentModel.getCourseEnrollments(courseId, { limit: 10000 });
        
        // Delete all enrollments for this course
        for (const enrollment of allEnrollments.enrollments) {
          try {
            await enrollmentModel.delete(enrollment._id!);
            logger.info('Deleted enrollment for deleted course:', {
              enrollmentId: enrollment._id,
              userId: enrollment.userId,
              courseId: enrollment.courseId
            });
          } catch (enrollmentDeleteError) {
            logger.error('Failed to delete enrollment:', {
              enrollmentId: enrollment._id,
              error: enrollmentDeleteError
            });
          }
        }
        
        // Also clean up progress records for this course
        try {
          const { progressModel } = await import('../models/Progress');
          const progressResult = await progressModel.getCourseProgress(courseId, { limit: 10000 });
          
          for (const progress of progressResult.progress) {
            try {
              await progressModel.delete(progress._id!);
              logger.info('Deleted progress record for deleted course:', {
                progressId: progress._id,
                userId: progress.userId,
                courseId: progress.courseId
              });
            } catch (progressDeleteError) {
              logger.error('Failed to delete progress record:', {
                progressId: progress._id,
                error: progressDeleteError
              });
            }
          }
        } catch (progressCleanupError) {
          logger.error('Failed to cleanup progress records during course delete:', progressCleanupError);
        }
        
        logger.info('Cleaned up enrollments for deleted course', {
          courseId,
          enrollmentsDeleted: allEnrollments.enrollments.length,
          adminId: (req as any).user.id,
        });
      } catch (cleanupError) {
        logger.error('Failed to cleanup enrollments during course delete:', cleanupError);
      }
    }

    logger.info('Course deleted by admin', {
      courseId,
      courseTitle: course.title,
      force,
      adminId: (req as any).user.id,
    });

    res.json({
      success: true,
      message: force ? 'Course force deleted successfully' : 'Course deleted successfully',
    });
  } catch (error) {
    logger.error('Failed to delete course', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to delete course',
    });
  }
});

// Get all submitted courses for review - Using workflow service
router.get('/courses/submitted', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const sortBy = req.query.sortBy as 'submittedAt' | 'title' | 'qualityScore' || 'submittedAt';
    const sortOrder = req.query.sortOrder as 'asc' | 'desc' || 'desc';

    const result = await courseWorkflowService.getSubmittedCourses({
      page,
      limit,
      sortBy,
      sortOrder,
    });

    logger.info('Admin fetched submitted courses:', {
      adminId: (req as any).user.id,
      page,
      limit,
      totalCourses: result.pagination.total,
      sortBy,
      sortOrder
    });

    res.json({
      success: true,
      data: {
        courses: result.courses,
        pagination: result.pagination,
      },
    });
  } catch (error) {
    logger.error('Failed to fetch submitted courses:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch submitted courses',
    });
  }
});

// Get courses under review
router.get('/courses/under-review', async (req: Request, res: Response) => {
  try {
    const courses = await courseWorkflowService.getCoursesUnderReview();

    logger.info('Admin fetched courses under review:', {
      adminId: (req as any).user.id,
      courseCount: courses.length
    });

    res.json({
      success: true,
      data: {
        courses,
        total: courses.length,
      },
    });
  } catch (error) {
    logger.error('Failed to fetch courses under review:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch courses under review',
    });
  }
});

// Start course review - Using workflow service
router.post('/courses/:courseId/start-review', async (req: Request, res: Response): Promise<void> => {
  try {
    const { courseId } = req.params;
    const admin = (req as any).user;

    if (!courseId) {
      res.status(400).json({
        success: false,
        message: 'Course ID is required',
      });
      return;
    }

    const course = await courseWorkflowService.startReview(courseId, admin);

    logger.info('Course review started:', {
      courseId,
      adminId: admin.id,
      courseTitle: course.title,
      status: course.status
    });

    res.json({
      success: true,
      message: 'Course review started successfully',
      data: {
        course,
        status: course.status,
        reviewStartedAt: course.reviewStartedAt,
        workflowHistory: course.workflowHistory
      },
    });
  } catch (error) {
    logger.error('Failed to start course review:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to start course review',
    });
  }
});

// Approve course - Using workflow service
router.post('/courses/:courseId/approve', courseApprovalValidation, async (req: Request, res: Response): Promise<void> => {
  try {
    const { courseId } = req.params;
    const { feedback } = req.body;
    const admin = (req as any).user;

    if (!courseId) {
      res.status(400).json({
        success: false,
        message: 'Course ID is required',
      });
      return;
    }

    const course = await courseWorkflowService.approveCourse(courseId, admin, feedback || {});

    logger.info('Course approved:', {
      courseId,
      adminId: admin.id,
      courseTitle: course.title,
      status: course.status,
      overallScore: course.approvalFeedback?.overallScore
    });

    res.json({
      success: true,
      message: 'Course approved and published successfully',
      data: {
        course,
        status: course.status,
        approvedAt: course.approvedAt,
        publishedAt: course.publishedAt,
        approvalFeedback: course.approvalFeedback,
        workflowHistory: course.workflowHistory
      },
    });
  } catch (error) {
    logger.error('Failed to approve course:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to approve course',
    });
  }
});

// Reject course - Using workflow service
router.post('/courses/:courseId/reject', courseApprovalValidation, async (req: Request, res: Response): Promise<void> => {
  try {
    const { courseId } = req.params;
    const { reason, feedback } = req.body;
    const admin = (req as any).user;

    if (!courseId) {
      res.status(400).json({
        success: false,
        message: 'Course ID is required',
      });
      return;
    }

    if (!reason) {
      res.status(400).json({
        success: false,
        message: 'Rejection reason is required',
      });
      return;
    }

    const course = await courseWorkflowService.rejectCourse(courseId, admin, feedback || {}, reason);

    logger.info('Course rejected:', {
      courseId,
      adminId: admin.id,
      courseTitle: course.title,
      status: course.status,
      reason,
      overallScore: course.approvalFeedback?.overallScore
    });

    res.json({
      success: true,
      message: 'Course rejected successfully',
      data: {
        course,
        status: course.status,
        rejectedAt: course.rejectedAt,
        rejectionReason: course.rejectionReason,
        approvalFeedback: course.approvalFeedback,
        workflowHistory: course.workflowHistory
      },
    });
  } catch (error) {
    logger.error('Failed to reject course:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to reject course',
    });
  }
});

// Get course workflow history (admin only)
router.get('/courses/:courseId/workflow-history', async (req: Request, res: Response): Promise<void> => {
  try {
    const { courseId } = req.params;
    const admin = (req as any).user;

    if (!courseId) {
      res.status(400).json({
        success: false,
        message: 'Course ID is required',
      });
      return;
    }

    const course = await courseModel.findById(courseId);
    if (!course) {
      res.status(404).json({
        success: false,
        message: 'Course not found',
      });
      return;
    }

    logger.info('Admin accessed course workflow history:', {
      courseId,
      adminId: admin.id,
      courseTitle: course.title
    });

    res.json({
      success: true,
      data: {
        courseId,
        title: course.title,
        instructorId: course.instructorId,
        instructorName: course.instructorName,
        currentStatus: course.status,
        workflowHistory: course.workflowHistory || [],
        approvalFeedback: course.approvalFeedback,
        validationResult: course.validationResult,
        qualityScore: course.qualityScore,
        contentFlags: course.contentFlags
      },
    });
  } catch (error) {
    logger.error('Failed to get course workflow history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve course workflow history',
    });
  }
});

// Get course validation result (admin only)
router.get('/courses/:courseId/validation', async (req: Request, res: Response): Promise<void> => {
  try {
    const { courseId } = req.params;
    const admin = (req as any).user;

    if (!courseId) {
      res.status(400).json({
        success: false,
        message: 'Course ID is required',
      });
      return;
    }

    const course = await courseModel.findById(courseId);
    if (!course) {
      res.status(404).json({
        success: false,
        message: 'Course not found',
      });
      return;
    }

    logger.info('Admin accessed course validation result:', {
      courseId,
      adminId: admin.id,
      courseTitle: course.title
    });

    res.json({
      success: true,
      data: {
        courseId,
        title: course.title,
        validationResult: course.validationResult,
        qualityScore: course.qualityScore,
        contentFlags: course.contentFlags,
        sections: course.sections?.length || 0,
        lessons: course.totalLessons || 0,
        duration: course.totalDuration || 0,
      },
    });
  } catch (error) {
    logger.error('Failed to get course validation result:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve course validation result',
    });
  }
});

// ================================
// ENHANCED ADMIN FEATURES
// ================================

// Bulk user operations
router.post('/users/bulk-action', async (req: Request, res: Response): Promise<void> => {
  try {
    const { action, userIds, data } = req.body;
    const admin = (req as any).user;

    if (!action || !userIds || !Array.isArray(userIds)) {
      res.status(400).json({
        success: false,
        message: 'Action and userIds array are required',
      });
      return;
    }

    const allowedActions = ['activate', 'deactivate', 'suspend', 'delete', 'update-role'];
    if (!allowedActions.includes(action)) {
      res.status(400).json({
        success: false,
        message: 'Invalid action. Allowed: ' + allowedActions.join(', '),
      });
      return;
    }

    const results = [];
    const errors = [];

    for (const userId of userIds) {
      try {
        const user = await userModel.findById(userId);
        if (!user) {
          errors.push({ userId, error: 'User not found' });
          continue;
        }

        // Prevent bulk operations on admin users
        if (user.role === 'admin' && action === 'delete') {
          errors.push({ userId, error: 'Cannot delete admin users' });
          continue;
        }

        let updateData: any = { updatedAt: new Date().toISOString() };

        switch (action) {
          case 'activate':
            updateData.status = 'active';
            break;
          case 'deactivate':
            updateData.status = 'inactive';
            break;
          case 'suspend':
            updateData.status = 'suspended';
            break;
          case 'delete':
            updateData.status = 'inactive'; // Soft delete
            break;
          case 'update-role':
            if (data?.role && ['admin', 'tutor', 'learner'].includes(data.role)) {
              updateData.role = data.role;
            } else {
              errors.push({ userId, error: 'Invalid role provided' });
              continue;
            }
            break;
        }

        const updatedUser = await userModel.update(userId, updateData);
        results.push({ userId, success: true, user: updatedUser });
      } catch (error: any) {
        errors.push({ userId, error: error.message });
      }
    }

    logger.info('Bulk user operation completed', {
      action,
      totalUsers: userIds.length,
      successful: results.length,
      failed: errors.length,
      adminId: admin.id,
    });

    res.json({
      success: true,
      message: `Bulk ${action} completed`,
      data: {
        results,
        errors,
        summary: {
          total: userIds.length,
          successful: results.length,
          failed: errors.length,
        },
      },
    });
  } catch (error) {
    logger.error('Bulk user operation failed:', error);
    res.status(500).json({
      success: false,
      message: 'Bulk operation failed',
    });
  }
});

// Basic user search
router.get('/users/search', async (req: Request, res: Response) => {
  try {
    const { query, role, page = 1, limit = 50 } = req.query;

    const usersResult = await userModel.findAll({ limit: 10000 });
    let users = usersResult.docs;

    // Simple search by name or email
    if (query) {
      const searchLower = (query as string).toLowerCase();
      users = users.filter((user: User) => 
        user.name.toLowerCase().includes(searchLower) ||
        user.email.toLowerCase().includes(searchLower)
      );
    }

    // Filter by role if specified
    if (role) {
      users = users.filter((user: User) => user.role === role);
    }

    // Simple pagination
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedUsers = users.slice(startIndex, startIndex + limitNum);

    // Return basic user data
    const safeUsers = paginatedUsers.map((user: User) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      verified: user.verified,
      createdAt: user.createdAt,
    }));

    res.json({
      success: true,
      data: {
        users: safeUsers,
        total: users.length,
        page: pageNum,
        limit: limitNum,
      },
    });
  } catch (error) {
    logger.error('User search failed:', error);
    res.status(500).json({
      success: false,
      message: 'User search failed',
    });
  }
});

// User activity tracking
router.get('/users/:userId/activity', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { limit = 50, page = 1 } = req.query;

    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
      return;
    }

    const user = await userModel.findById(userId);
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
      });
      return;
    }

    // Get user's enrollments, progress, and other activities
    const [enrollmentsResult, progressResult] = await Promise.all([
      enrollmentModel.findAll({ limit: 1000 }),
      progressModel.findAll({ limit: 1000 })
    ]);

    const userEnrollments = enrollmentsResult.docs.filter((e: Enrollment) => e.userId === userId);
    const userProgress = progressResult.docs.filter((p: Progress) => p.userId === userId);

    // Combine activities
    const activities = [
      ...userEnrollments.map((enrollment: Enrollment) => ({
        id: enrollment._id,
        type: 'enrollment',
        description: `Enrolled in course: ${enrollment.courseId}`,
        timestamp: enrollment.createdAt,
        data: enrollment,
      })),
      ...userProgress.map((progress: Progress) => ({
        id: progress._id,
        type: 'progress',
        description: `Progress update: ${progress.completedLessons.length} lessons completed`,
        timestamp: progress.lastWatched || progress.createdAt,
        data: progress,
      })),
    ];

    // Sort by timestamp (newest first)
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Pagination
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const total = activities.length;
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    const paginatedActivities = activities.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
        },
        activities: paginatedActivities,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(total / limitNum),
          totalItems: total,
          itemsPerPage: limitNum,
        },
        summary: {
          totalEnrollments: userEnrollments.length,
          activeEnrollments: userEnrollments.filter(e => e.status === 'active').length,
          completedEnrollments: userEnrollments.filter(e => e.status === 'completed').length,
          totalProgress: userProgress.length,
          averageProgress: userProgress.length > 0 ? 
            userProgress.reduce((sum, p) => sum + (p.completedLessons.length * 10), 0) / userProgress.length : 0,
        },
      },
    });
  } catch (error) {
    logger.error('Failed to fetch user activity:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user activity',
    });
  }
});

// System settings management
router.get('/settings', async (req: Request, res: Response) => {
  try {
    // In a real implementation, you'd fetch from a settings database
    const settings = {
      platform: {
        name: 'TekRiders',
        version: '1.0.0',
        maintenance: false,
        registrationEnabled: true,
        emailVerificationRequired: true,

      },
      email: {
        enabled: true,
        provider: 'smtp',
        fromName: 'TekRiders',
        fromEmail: 'noreply@tekriders.com',
      },
      security: {
        passwordMinLength: 8,
        sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
        maxLoginAttempts: 5,
        lockoutDuration: 30 * 60 * 1000, // 30 minutes
        twoFactorEnabled: false,
      },
      content: {
        autoApproval: false,
        moderationEnabled: true,
        qualityScoreThreshold: 70,
        maxCoursesPerInstructor: 100,
        maxSectionsPerCourse: 50,
        maxLessonsPerSection: 100,
      },
      notifications: {
        emailNotifications: true,
        pushNotifications: false,
        smsNotifications: false,
        adminNotifications: true,
      },
    };

    res.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    logger.error('Failed to fetch system settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch system settings',
    });
  }
});

// Update system settings
router.put('/settings', async (req: Request, res: Response) => {
  try {
    const { category, settings } = req.body;
    const admin = (req as any).user;

    if (!category || !settings) {
      return res.status(400).json({
        success: false,
        message: 'Category and settings are required',
      });
    }

    const allowedCategories = ['platform', 'email', 'security', 'content', 'notifications'];
    if (!allowedCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category. Allowed: ' + allowedCategories.join(', '),
      });
    }

    // In a real implementation, you'd update the settings in a database
    logger.info('System settings updated', {
      category,
      settings,
      adminId: admin.id,
    });

    res.json({
      success: true,
      message: 'Settings updated successfully',
      data: {
        category,
        settings,
        updatedAt: new Date().toISOString(),
        updatedBy: admin.id,
      },
    });
    return;
  } catch (error) {
    logger.error('Failed to update system settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update system settings',
    });
    return;
  }
});

// Audit logs
router.get('/audit-logs', async (req: Request, res: Response) => {
  try {
    const {
      action,
      userId,
      dateFrom,
      dateTo,
      page = 1,
      limit = 50,
      sortBy = 'timestamp',
      sortOrder = 'desc'
    } = req.query;

    // In a real implementation, you'd fetch from an audit logs database
    // For now, we'll create mock data based on recent activities
    const mockLogs = [
      {
        id: '1',
        action: 'user.create',
        userId: 'admin-1',
        userName: 'Admin User',
        targetId: 'user-123',
        targetType: 'user',
        description: 'Created new user account',
        timestamp: new Date().toISOString(),
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0...',
        success: true,
      },
      {
        id: '2',
        action: 'course.approve',
        userId: 'admin-1',
        userName: 'Admin User',
        targetId: 'course-456',
        targetType: 'course',
        description: 'Approved course submission',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0...',
        success: true,
      },
      {
        id: '3',
        action: 'user.status.update',
        userId: 'admin-1',
        userName: 'Admin User',
        targetId: 'user-789',
        targetType: 'user',
        description: 'Updated user status to suspended',
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0...',
        success: true,
      },
    ];

    let filteredLogs = mockLogs;

    // Apply filters
    if (action) {
      filteredLogs = filteredLogs.filter(log => log.action.includes(action as string));
    }

    if (userId) {
      filteredLogs = filteredLogs.filter(log => log.userId === userId);
    }

    if (dateFrom || dateTo) {
      const fromDate = dateFrom ? new Date(dateFrom as string) : new Date(0);
      const toDate = dateTo ? new Date(dateTo as string) : new Date();
      
      filteredLogs = filteredLogs.filter(log => {
        const logDate = new Date(log.timestamp);
        return logDate >= fromDate && logDate <= toDate;
      });
    }

    // Sort logs
    filteredLogs.sort((a, b) => {
      const aValue = a[sortBy as keyof typeof a] as string;
      const bValue = b[sortBy as keyof typeof b] as string;
      
      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    // Pagination
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const total = filteredLogs.length;
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    const paginatedLogs = filteredLogs.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: {
        logs: paginatedLogs,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(total / limitNum),
          totalItems: total,
          itemsPerPage: limitNum,
        },
        filters: {
          action,
          userId,
          dateFrom,
          dateTo,
          sortBy,
          sortOrder,
        },
      },
    });
  } catch (error) {
    logger.error('Failed to fetch audit logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch audit logs',
    });
  }
});

// System health check
router.get('/health', async (req: Request, res: Response) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      services: {
        database: 'healthy',
        email: 'healthy',
        storage: 'healthy',
        websocket: 'healthy',
      },
      metrics: {
        activeUsers: 0,
        totalCourses: 0,
        totalEnrollments: 0,
        systemLoad: process.cpuUsage(),
      },
    };

    // Check database connectivity
    try {
      await userModel.findAll({ limit: 1 });
      health.services.database = 'healthy';
    } catch (error) {
      health.services.database = 'unhealthy';
      health.status = 'degraded';
    }

    // Check email service
    try {
      await emailService.verifyConnection();
      health.services.email = 'healthy';
    } catch (error) {
      health.services.email = 'unhealthy';
      health.status = 'degraded';
    }

    // Get basic metrics
    try {
      const [usersResult, coursesResult, enrollmentsResult] = await Promise.all([
        userModel.findAll({ limit: 1 }),
        courseModel.findAll({ limit: 1 }),
        enrollmentModel.findAll({ limit: 1 })
      ]);

      health.metrics.activeUsers = usersResult.docs.length;
      health.metrics.totalCourses = coursesResult.docs.length;
      health.metrics.totalEnrollments = enrollmentsResult.docs.length;
    } catch (error) {
      logger.warn('Failed to fetch health metrics:', error);
    }

    res.json({
      success: true,
      data: health,
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(500).json({
      success: false,
      message: 'Health check failed',
      data: {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: (error as any).message,
      },
    });
  }
});

// Export data (CSV, JSON)
router.get('/export/:type', async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const { format = 'json', dateFrom, dateTo } = req.query;

    if (!type || !['users', 'courses', 'enrollments', 'analytics'].includes(type)) {
      res.status(400).json({
        success: false,
        message: 'Invalid export type. Allowed: users, courses, enrollments, analytics',
      });
      return;
    }

    if (!['json', 'csv'].includes(format as string)) {
      res.status(400).json({
        success: false,
        message: 'Invalid format. Allowed: json, csv',
      });
      return;
    }

    let data: any[] = [];
    let filename = '';

    switch (type) {
      case 'users':
        const usersResult = await userModel.findAll({ limit: 10000 });
        data = usersResult.docs.map((user: User) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
          verified: user.verified,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        }));
        filename = `users_export_${new Date().toISOString().split('T')[0]}`;
        break;

      case 'courses':
        const coursesResult = await courseModel.findAll({ limit: 10000 });
        data = coursesResult.docs.map((course: Course) => ({
          id: course.id,
          title: course.title,
          description: course.description,
          category: course.category,
          level: course.level,
          status: course.status,
          instructorId: course.instructorId,
          instructorName: course.instructorName,
          price: course.price,
          enrollmentCount: course.enrollmentCount,
          rating: course.rating?.average || 0,
          createdAt: course.createdAt,
          updatedAt: course.updatedAt,
        }));
        filename = `courses_export_${new Date().toISOString().split('T')[0]}`;
        break;

      case 'enrollments':
        const enrollmentsResult = await enrollmentModel.findAll({ limit: 10000 });
        data = enrollmentsResult.docs.map((enrollment: Enrollment) => ({
          id: enrollment._id,
          userId: enrollment.userId,
          courseId: enrollment.courseId,
          status: enrollment.status,
          enrolledAt: enrollment.createdAt,
          completedAt: enrollment.completedAt,
          progress: enrollment.progress || 0,
        }));
        filename = `enrollments_export_${new Date().toISOString().split('T')[0]}`;
        break;

      case 'analytics':
        // Export analytics data
        const analyticsData = {
          exportedAt: new Date().toISOString(),
          totalUsers: (await userModel.findAll({ limit: 10000 })).docs.length,
          totalCourses: (await courseModel.findAll({ limit: 10000 })).docs.length,
          totalEnrollments: (await enrollmentModel.findAll({ limit: 10000 })).docs.length,
        };
        data = [analyticsData];
        filename = `analytics_export_${new Date().toISOString().split('T')[0]}`;
        break;
    }

    // Set appropriate headers based on format
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      
      // Convert JSON to CSV (simple implementation)
      if (data.length > 0) {
        const headers = Object.keys(data[0]).join(',');
        const rows = data.map(item => Object.values(item).join(','));
        res.send([headers, ...rows].join('\n'));
      } else {
        res.send('No data available');
      }
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
      res.json({ data, filename, exportedAt: new Date().toISOString() });
    }

    logger.info('Data exported successfully:', {
      type,
      format,
      recordCount: data.length,
      adminId: (req as any).user.id,
    });

  } catch (error) {
    logger.error('Failed to export data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export data',
    });
  }
});

// Bulk course operations
router.post('/courses/bulk-action', async (req: Request, res: Response): Promise<void> => {
  try {
    const { action, courseIds, data } = req.body;
    const admin = (req as any).user;

    if (!action || !courseIds || !Array.isArray(courseIds)) {
      res.status(400).json({
        success: false,
        message: 'Action and courseIds array are required',
      });
      return;
    }

    const allowedActions = ['approve', 'reject', 'archive', 'publish', 'delete'];
    if (!allowedActions.includes(action)) {
      res.status(400).json({
        success: false,
        message: 'Invalid action. Allowed: ' + allowedActions.join(', '),
      });
      return;
    }

    const results = [];
    const errors = [];

    for (const courseId of courseIds) {
      try {
        const course = await courseModel.findById(courseId);
        if (!course) {
          errors.push({ courseId, error: 'Course not found' });
          continue;
        }

        let updateData: any = { updatedAt: new Date().toISOString() };

        switch (action) {
          case 'approve':
            updateData.status = 'approved';
            updateData.approvedAt = new Date().toISOString();
            break;
          case 'reject':
            updateData.status = 'rejected';
            updateData.rejectedAt = new Date().toISOString();
            updateData.rejectionReason = data?.reason || 'Bulk rejection';
            break;
          case 'archive':
            updateData.status = 'archived';
            updateData.archivedAt = new Date().toISOString();
            break;
          case 'publish':
            updateData.status = 'published';
            updateData.publishedAt = new Date().toISOString();
            break;
          case 'delete':
            // Check for enrollments before deletion
            const enrollmentsResult = await enrollmentModel.getCourseEnrollments(courseId, { limit: 1 })
              .catch(() => ({ enrollments: [] }));
            if (enrollmentsResult.enrollments?.length > 0 && !data?.force) {
              errors.push({ courseId, error: 'Course has enrollments. Use force=true to delete anyway.' });
              continue;
            }
            await courseModel.delete(courseId);
            results.push({ courseId, success: true, action: 'deleted' });
            continue;
        }

        const updatedCourse = await courseModel.update(courseId, updateData);
        results.push({ courseId, success: true, course: updatedCourse });
      } catch (error: any) {
        errors.push({ courseId, error: error.message });
      }
    }

    logger.info('Bulk course action completed:', {
      action,
      adminId: admin.id,
      totalCourses: courseIds.length,
      successful: results.length,
      errors: errors.length
    });

    res.json({
      success: true,
      message: `Bulk ${action} completed`,
      data: {
        results,
        errors,
        summary: {
          total: courseIds.length,
          successful: results.length,
          failed: errors.length
        }
      },
    });
  } catch (error) {
    logger.error('Failed to perform bulk course action:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to perform bulk course action',
    });
  }
});

// Real-time notifications management
router.get('/notifications', async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, type, status } = req.query;

    // Mock notifications - in real implementation, fetch from notifications database
    const mockNotifications = [
      {
        id: '1',
        type: 'course_submission',
        title: 'New Course Submission',
        message: 'A new course "React Fundamentals" has been submitted for review',
        data: { courseId: 'course-123', instructorId: 'user-456' },
        status: 'unread',
        createdAt: new Date().toISOString(),
        priority: 'high',
      },
      {
        id: '2',
        type: 'user_signup',
        title: 'New User Registration',
        message: 'New user "John Doe" has registered as a tutor',
        data: { userId: 'user-789' },
        status: 'unread',
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        priority: 'medium',
      },
      {
        id: '3',
        type: 'system_alert',
        title: 'System Maintenance',
        message: 'Scheduled maintenance will occur tonight at 2 AM',
        data: { maintenanceTime: '2024-01-20T02:00:00Z' },
        status: 'read',
        createdAt: new Date(Date.now() - 7200000).toISOString(),
        priority: 'low',
      },
    ];

    let filteredNotifications = mockNotifications;

    // Apply filters
    if (type) {
      filteredNotifications = filteredNotifications.filter(n => n.type === type);
    }

    if (status) {
      filteredNotifications = filteredNotifications.filter(n => n.status === status);
    }

    // Pagination
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const total = filteredNotifications.length;
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    const paginatedNotifications = filteredNotifications.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: {
        notifications: paginatedNotifications,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(total / limitNum),
          totalItems: total,
          itemsPerPage: limitNum,
        },
        summary: {
          total: mockNotifications.length,
          unread: mockNotifications.filter(n => n.status === 'unread').length,
          high: mockNotifications.filter(n => n.priority === 'high').length,
          medium: mockNotifications.filter(n => n.priority === 'medium').length,
          low: mockNotifications.filter(n => n.priority === 'low').length,
        },
      },
    });
  } catch (error) {
    logger.error('Failed to fetch notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
    });
  }
});

// Mark notifications as read
router.put('/notifications/:notificationId/read', async (req: Request, res: Response) => {
  try {
    const { notificationId } = req.params;
    const admin = (req as any).user;

    // In real implementation, update notification status in database
    logger.info('Notification marked as read', {
      notificationId,
      adminId: admin.id,
    });

    res.json({
      success: true,
      message: 'Notification marked as read',
    });
  } catch (error) {
    logger.error('Failed to mark notification as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read',
    });
  }
});



export { router as adminRoutes };
export default router; 