import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { userModel } from '../models/User';
import { enrollmentModel } from '../models/Enrollment';
import { progressModel } from '../models/Progress';
import { courseModel } from '../models/Course';
import { validate } from '../middleware/validation';
import { logger } from '../utils/logger';
import { uploadAvatar, handleUploadError } from '../middleware/fileUpload';
import { fileService } from '../services/fileService';
import { body } from 'express-validator';

const router = Router();



// Validation middleware
const updateProfileValidation = [
  body('name').optional().trim().isLength({ min: 2, max: 50 }).withMessage('Name must be 2-50 characters'),
  body('profile.bio').optional().trim().isLength({ max: 500 }).withMessage('Bio must be max 500 characters'),
  body('profile.expertise').optional().isArray().withMessage('Expertise must be an array'),
  body('profile.location').optional().trim().isLength({ max: 100 }).withMessage('Location must be max 100 characters'),
  body('profile.website').optional().isURL().withMessage('Website must be a valid URL'),
  validate,
];

const progressValidation = [
  // Allow both formats: { progress: number } or just number
  body('progress').optional().isInt({ min: 0, max: 100 }).withMessage('Progress must be between 0 and 100'),
  // Custom validation to handle raw number format
  (req: Request, res: Response, next: NextFunction) => {
    // If body is a number, convert to { progress: number }
    if (typeof req.body === 'number') {
      const progressValue = req.body;
      if (progressValue >= 0 && progressValue <= 100) {
        req.body = { progress: progressValue };
        return next();
      } else {
        return res.status(400).json({
          success: false,
          error: 'Progress must be between 0 and 100',
        });
      }
    }
    // If body is string that represents a number, parse it
    else if (typeof req.body === 'string') {
      const progressValue = parseInt(req.body, 10);
      if (!isNaN(progressValue) && progressValue >= 0 && progressValue <= 100) {
        req.body = { progress: progressValue };
        return next();
      } else {
        return res.status(400).json({
          success: false,
          error: 'Progress must be between 0 and 100',
        });
      }
    }
    // If body is object but missing progress, check if it's a valid number
    else if (typeof req.body === 'object' && req.body !== null && typeof req.body.progress === 'undefined') {
      return res.status(400).json({
        success: false,
        error: 'Progress field is required',
      });
    }
    // If we get here, the body is properly formatted - continue
    return next();
  },
  validate,
];

// Get user profile
router.get('/profile', authenticate, async (req: Request, res: Response) => {
  try {
    logger.info('GET /profile request:', { 
      hasUser: !!req.user,
      userId: req.user?.id,
      userEmail: req.user?.email,
      userRole: req.user?.role,
      hasAuthHeader: !!req.headers.authorization,
      authHeaderFormat: req.headers.authorization?.substring(0, 20) + '...'
    });

    if (!req.user) {
      logger.warn('Profile request without authenticated user');
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    logger.info('Looking up user profile:', { userId: req.user.id });
    let user = await userModel.findById(req.user.id);
    
    // If user not found by ID, try to find by email (fallback for ID mismatch)
    if (!user && req.user.email) {
      logger.warn('User not found by ID, trying email lookup:', { 
        userId: req.user.id,
        userEmail: req.user.email 
      });
      user = await userModel.findByEmail(req.user.email);
      
      if (user) {
        logger.info('User found by email fallback:', { 
          originalUserId: req.user.id,
          foundUserId: user.id || user._id,
          userEmail: req.user.email 
        });
      }
    }
    
    if (!user) {
      logger.error('User not found in database by ID or email:', { 
        userId: req.user.id,
        userEmail: req.user.email 
      });
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    logger.info('User found, fetching statistics:', { 
      userId: req.user.id,
      userName: user.name 
    });

    // Get user statistics
    const enrollmentResult = await enrollmentModel.getUserEnrollments(req.user.id, { limit: 1000 });
    const progressResult = await progressModel.getUserProgress(req.user.id, { limit: 1000 });
    
        const enrollments = enrollmentResult.enrollments;
    const progress = progressResult.progress;
    
    // Calculate completion statistics
    const completedCourses = progress.filter((p: any) => p.overallProgress >= 100).length;
    const totalEnrollments = enrollments.length;
    const averageProgress = progress.length > 0 
      ? progress.reduce((sum: number, p: any) => sum + p.overallProgress, 0) / progress.length 
      : 0;

    const userResponse = {
      id: user.id || user._id,
      _id: user._id,
      name: user.name || '',
      email: user.email || '',
      role: user.role || 'learner',
      status: user.status || 'active',
      verified: user.verified || false,
      avatar: user.avatar || null,
      createdAt: user.createdAt || new Date().toISOString(),
      lastLogin: user.lastLogin || new Date().toISOString(),
      profile: {
        bio: user.profile?.bio || '',
        location: user.profile?.location || '',
        phone: (user.profile as any)?.phone || '',
        website: user.profile?.website || '',
        expertise: user.profile?.expertise || [],
        education: (user.profile as any)?.education || '',
        experience: (user.profile as any)?.experience || '',
        socialMedia: user.profile?.socialMedia || {}
      },
      preferences: user.preferences || {
        language: 'en',
        notifications: {
          email: true,
          push: true,
          marketing: false
        }
      },
      stats: {
        totalEnrollments,
        completedCourses,
        averageProgress: Math.round(averageProgress),
        timeSpent: progress.reduce((sum: number, p: any) => sum + (p.timeSpent || 0), 0)
      }
    };

    logger.info('Profile data successfully retrieved and formatted:', { 
      userId: userResponse.id,
      userEmail: userResponse.email,
      userName: userResponse.name,
      hasProfile: !!userResponse.profile,
      profileFields: Object.keys(userResponse.profile),
      hasStats: !!userResponse.stats,
      documentId: user._id,
      documentRev: user._rev
    });

    return res.json({
      success: true,
      data: {
        user: userResponse
      },
    });
  } catch (error) {
    logger.error('Failed to get user profile:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get user profile',
    });
  }
});

// Update user profile
router.put('/profile', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const {
      name,
      bio,
      location,
      website,
      phone,
      expertise,
      education,
      experience,
      preferences,
      socialMedia,
    } = req.body;

    // Validate and sanitize input
    const updateData: any = {};

    if (name && typeof name === 'string') {
      updateData.name = name.trim();
    }

    // Update profile fields - handle all user types
    const profileFields: any = {};
    if (bio && typeof bio === 'string') profileFields.bio = bio.trim();
    if (location && typeof location === 'string') profileFields.location = location.trim();
    if (website && typeof website === 'string') profileFields.website = website.trim();
    if (phone && typeof phone === 'string') profileFields.phone = phone.trim();
    if (education && typeof education === 'string') profileFields.education = education.trim();
    if (experience && typeof experience === 'string') profileFields.experience = experience.trim();
    
    if (expertise && Array.isArray(expertise)) {
      profileFields.expertise = expertise.filter(item => 
        typeof item === 'string' && item.trim() !== ''
      ).map(item => item.trim());
    }

    if (socialMedia && typeof socialMedia === 'object') {
      profileFields.socialMedia = {
        twitter: socialMedia.twitter?.trim() || '',
        linkedin: socialMedia.linkedin?.trim() || '',
        github: socialMedia.github?.trim() || ''
      };
    }

    if (Object.keys(profileFields).length > 0) {
      updateData.profile = profileFields;
    }

    // Update preferences
    if (preferences && typeof preferences === 'object') {
      const preferencesFields: any = {};
      
      if (preferences.language && typeof preferences.language === 'string') {
        preferencesFields.language = preferences.language;
      }
      
      if (preferences.notifications && typeof preferences.notifications === 'object') {
        preferencesFields.notifications = {
          email: Boolean(preferences.notifications.email),
          push: Boolean(preferences.notifications.push),
          marketing: Boolean(preferences.notifications.marketing)
        };
      }
      
      if (preferences.accessibility && typeof preferences.accessibility === 'object') {
        preferencesFields.accessibility = {
          highContrast: Boolean(preferences.accessibility.highContrast),
          largeText: Boolean(preferences.accessibility.largeText),
          screenReader: Boolean(preferences.accessibility.screenReader),
          reducedMotion: Boolean(preferences.accessibility.reducedMotion)
        };
      }
      
      if (Object.keys(preferencesFields).length > 0) {
        updateData.preferences = preferencesFields;
      }
    }

    // Find user first (with email fallback)
    let existingUser = await userModel.findById(req.user.id);
    
    // If user not found by ID, try email fallback
    if (!existingUser && req.user.email) {
      logger.warn('User not found by ID for profile update, trying email lookup:', { 
        userId: req.user.id,
        userEmail: req.user.email 
      });
      existingUser = await userModel.findByEmail(req.user.email);
      
      if (existingUser) {
        logger.info('User found by email for profile update:', { 
          originalUserId: req.user.id,
          foundUserId: existingUser.id || existingUser._id,
          userEmail: req.user.email 
        });
      }
    }
    
    if (!existingUser) {
      logger.error('User not found for profile update by ID or email:', { 
        userId: req.user.id,
        userEmail: req.user.email 
      });
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    // Use the correct user ID for update
    const userIdToUpdate = existingUser.id || existingUser._id || req.user.id;
    const updatedUser = await userModel.update(userIdToUpdate, updateData);

    // Verify the update was persisted to CouchDB by fetching the updated document
    const verificationUser = await userModel.findById(userIdToUpdate);
    if (!verificationUser) {
      logger.error('Failed to verify profile update in CouchDB', { userIdToUpdate });
      return res.status(500).json({
        success: false,
        error: 'Profile update verification failed',
      });
    }

    logger.info('User profile updated and verified in CouchDB', { 
      originalUserId: req.user.id,
      actualUserId: userIdToUpdate,
      updatedFields: Object.keys(updateData),
      verificationId: verificationUser._id,
      verificationRev: verificationUser._rev,
      profileData: verificationUser.profile
    });

    const responseUser = {
      id: verificationUser.id || verificationUser._id,
      _id: verificationUser._id,
      _rev: verificationUser._rev,
      name: verificationUser.name,
      email: verificationUser.email,
      role: verificationUser.role,
      status: verificationUser.status,
      verified: verificationUser.verified,
      avatar: verificationUser.avatar,
      profile: verificationUser.profile,
      preferences: verificationUser.preferences,
      createdAt: verificationUser.createdAt,
      updatedAt: verificationUser.updatedAt,
    };

    return res.json({
      success: true,
      message: 'Profile updated and synchronized to CouchDB successfully',
      data: {
        user: responseUser,
      },
      meta: {
        persistenceVerified: true,
        lastUpdated: verificationUser.updatedAt,
        documentRevision: verificationUser._rev
      }
    });
  } catch (error) {
    logger.error('Failed to update user profile:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update user profile',
    });
  }
});

// Get user courses (enrolled courses)
router.get('/courses', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as any;

    // Get user enrollments
    const enrollments = await enrollmentModel.getUserEnrollments(req.user.id, {
      page,
      limit,
      status,
    });

    // Get course details for each enrollment
    const coursesWithProgress = await Promise.all(
      enrollments.enrollments.map(async (enrollment) => {
        try {
          const course = await courseModel.findById(enrollment.courseId);
          const progress = await progressModel.findByUserAndCourse(req.user!.id, enrollment.courseId);
          
          return {
            ...course,
            enrollment: {
              id: enrollment._id,
              enrolledAt: enrollment.enrolledAt,
              progress: enrollment.progress,
              status: enrollment.status,
            },
            progress: progress ? {
              completedLessons: progress.completedLessons.length,
              totalLessons: course?.totalLessons || 0,
              timeSpent: progress.timeSpent,
              currentLesson: progress.currentLesson,
              lastWatched: progress.lastWatched,
            } : null,
          };
        } catch (error) {
          logger.error('Failed to get course details for enrollment:', { enrollmentId: enrollment._id, error });
          return null;
        }
      })
    );

    const validCourses = coursesWithProgress.filter(course => course !== null);

    return res.json({
      success: true,
      data: {
        courses: validCourses,
        pagination: enrollments.pagination,
      },
    });
  } catch (error) {
    logger.error('Failed to get user courses:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve user courses',
    });
  }
});

// Enroll in course
router.post('/enroll/:courseId', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const courseId = req.params.courseId;
    if (!courseId) {
      return res.status(400).json({
        success: false,
        error: 'Course ID is required',
      });
    }

    // Check if course exists and is published
    const course = await courseModel.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        error: 'Course not found',
      });
    }

    if (course.status !== 'published') {
      return res.status(400).json({
        success: false,
        error: 'Course is not available for enrollment',
      });
    }

    // Check if already enrolled
    const existingEnrollment = await enrollmentModel.findByUserAndCourse(req.user.id, courseId);
    if (existingEnrollment && existingEnrollment.status === 'active') {
      return res.status(400).json({
        success: false,
        error: 'You are already enrolled in this course',
      });
    }

    // Create enrollment
    const enrollment = await enrollmentModel.enrollUser(req.user.id, courseId);

    // Update course enrollment count
    await courseModel.updateEnrollmentCount(courseId, 1);

    logger.info('User enrolled in course:', { userId: req.user.id, courseId, enrollmentId: enrollment._id });

    return res.status(201).json({
      success: true,
      message: 'Successfully enrolled in course',
      data: { enrollment },
    });
  } catch (error) {
    logger.error('Failed to enroll in course:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to enroll in course',
    });
  }
});

// Update course progress
router.put('/progress/:courseId', authenticate, progressValidation, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const courseId = req.params.courseId;
    if (!courseId) {
      return res.status(400).json({
        success: false,
        error: 'Course ID is required',
      });
    }

    const { progress } = req.body;

    // Check if user is enrolled
    const enrollment = await enrollmentModel.findByUserAndCourse(req.user.id, courseId);
    if (!enrollment || enrollment.status !== 'active') {
      return res.status(403).json({
        success: false,
        error: 'You are not enrolled in this course',
      });
    }

    // Update enrollment progress
    const updatedEnrollment = await enrollmentModel.updateProgress(enrollment._id!, progress);

    // Update progress tracking
    const progressRecord = await progressModel.getOrCreateProgress(req.user.id, courseId);
    
    logger.info('Course progress updated:', { 
      userId: req.user.id, 
      courseId, 
      progress,
      enrollmentId: enrollment._id 
    });

    return res.json({
      success: true,
      message: 'Progress updated successfully',
      data: { 
        enrollment: updatedEnrollment,
        progress: progressRecord,
      },
    });
  } catch (error) {
    logger.error('Failed to update course progress:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update course progress',
    });
  }
});

// Get user certificates
router.get('/certificates', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    // Get completed enrollments
    const completedEnrollments = await enrollmentModel.getUserCompletedCourses(req.user.id);

    // Get certificate details for each completed course
    const certificates = await Promise.all(
      completedEnrollments.map(async (enrollment) => {
        try {
          const course = await courseModel.findById(enrollment.courseId);
          return {
            id: enrollment._id,
            courseId: enrollment.courseId,
            courseName: course?.title || 'Unknown Course',
            completedAt: enrollment.completedAt,
            certificate: enrollment.certificate,
            instructor: course?.instructorName || 'Unknown Instructor',
          };
        } catch (error) {
          logger.error('Failed to get certificate details:', { enrollmentId: enrollment._id, error });
          return null;
        }
      })
    );

    const validCertificates = certificates.filter(cert => cert !== null);

    return res.json({
      success: true,
      data: { certificates: validCertificates },
    });
  } catch (error) {
    logger.error('Failed to get user certificates:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve user certificates',
    });
  }
});

// Get user learning statistics
router.get('/stats', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    // Get user enrollments
    const enrollments = await enrollmentModel.getUserEnrollments(req.user.id, { limit: 1000 });
    
    // Get user progress
    const progress = await progressModel.getUserProgress(req.user.id, { limit: 1000 });

    // Calculate statistics
    const totalCourses = enrollments.enrollments.length;
    const activeCourses = enrollments.enrollments.filter(e => e.status === 'active').length;
    const completedCourses = enrollments.enrollments.filter(e => e.status === 'completed').length;
    
    const totalTimeSpent = progress.progress.reduce((sum, p) => sum + p.timeSpent, 0);
    const totalLessonsCompleted = progress.progress.reduce((sum, p) => sum + p.completedLessons.length, 0);
    
    // Get learning streak
    const streak = await progressModel.getUserLearningStreak(req.user.id);

    const stats = {
      totalCourses,
      activeCourses,
      completedCourses,
      totalTimeSpent,
      totalLessonsCompleted,
      averageProgress: totalCourses > 0 ? Math.round(
        enrollments.enrollments.reduce((sum, e) => sum + e.progress, 0) / totalCourses
      ) : 0,
      streak,
    };

    return res.json({
      success: true,
      data: { stats },
    });
  } catch (error) {
    logger.error('Failed to get user statistics:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve user statistics',
    });
  }
});

// Upload user avatar
router.post('/avatar', authenticate, uploadAvatar, handleUploadError, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No avatar file provided',
      });
    }

    // Use file service to handle upload
    const result = await fileService.handleFileUpload(
      req.file,
      'image', // Use 'image' type for avatars
      {
      entityType: 'user',
      entityId: req.user.id,
      uploadedBy: req.user.id,
      }
    );

    // Update user profile with new avatar URL
    logger.info('Attempting to update user avatar:', { 
      userId: req.user.id,
      userEmail: req.user.email,
      avatarUrl: result.url 
    });
    
    // First check if user exists (with email fallback)
    let existingUser = await userModel.findById(req.user.id);
    
    // If user not found by ID, try email fallback
    if (!existingUser && req.user.email) {
      logger.warn('User not found by ID for avatar update, trying email lookup:', { 
        userId: req.user.id,
        userEmail: req.user.email 
      });
      existingUser = await userModel.findByEmail(req.user.email);
      
      if (existingUser) {
        logger.info('User found by email for avatar update:', { 
          originalUserId: req.user.id,
          foundUserId: existingUser.id || existingUser._id,
          userEmail: req.user.email 
        });
      }
    }
    
    if (!existingUser) {
      logger.error('User not found for avatar update by ID or email:', { 
        userId: req.user.id,
        userEmail: req.user.email 
      });
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    // Use the correct user ID for update
    const userIdToUpdate = existingUser.id || existingUser._id || req.user.id;
    const user = await userModel.update(userIdToUpdate, {
      avatar: result.url,
    } as any);

    logger.info('User avatar updated:', { 
      originalUserId: req.user.id,
      actualUserId: userIdToUpdate,
      avatarUrl: result.url,
      fileId: result.file._id 
    });

    const responseUser = {
      id: user.id || user._id,
      _id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      role: user.role,
      verified: user.verified
    };

    return res.json({
      success: true,
      message: 'Avatar uploaded successfully',
      data: {
        user: responseUser,
        file: {
          fileId: result.file._id,
          filename: result.file.filename,
          originalName: result.file.originalName,
          size: result.file.size,
          mimetype: result.file.mimetype,
          url: result.url,
          type: result.file.fileType,
          metadata: result.file.metadata,
        },
      },
    });
  } catch (error) {
    logger.error('Failed to upload avatar:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to upload avatar',
    });
  }
});

// Get user progress data
router.get('/progress', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const limit = parseInt(req.query.limit as string) || 100;
    
    // Get user progress
    const progress = await progressModel.getUserProgress(req.user.id, { limit });
    
    // Get user enrollments for additional context
    const enrollments = await enrollmentModel.getUserEnrollments(req.user.id, { limit: 1000 });
    
    // Calculate overall statistics
    const totalCourses = enrollments.enrollments.length;
    const completedCourses = enrollments.enrollments.filter(e => e.status === 'completed').length;
    const totalTimeSpent = progress.progress.reduce((sum, p) => sum + p.timeSpent, 0);
    const totalLessonsCompleted = progress.progress.reduce((sum, p) => sum + p.completedLessons.length, 0);
    
    // Get learning streak
    const streak = await progressModel.getUserLearningStreak(req.user.id);
    
    // Format progress data with course details
    const progressWithCourses = await Promise.all(
      progress.progress.map(async (p) => {
        try {
          const course = await courseModel.findById(p.courseId);
          const enrollment = enrollments.enrollments.find(e => e.courseId === p.courseId);
          
          return {
            courseId: p.courseId,
            courseName: course?.title || 'Unknown Course',
            progress: enrollment?.progress || 0,
            completedLessons: p.completedLessons.length,
            totalLessons: course?.totalLessons || 0,
            timeSpent: p.timeSpent,
            lastWatched: p.lastWatched,
            currentLesson: p.currentLesson,
            status: enrollment?.status || 'unknown',
          };
        } catch (error) {
          logger.error('Failed to get course details for progress:', { courseId: p.courseId, error });
          return null;
        }
      })
    );

    const validProgress = progressWithCourses.filter(p => p !== null);

    const stats = {
      overallProgress: totalCourses > 0 ? Math.round(
        enrollments.enrollments.reduce((sum, e) => sum + e.progress, 0) / totalCourses
      ) : 0,
      streakDays: streak,
      studyTimeHours: Math.round(totalTimeSpent / 60),
      completedCourses,
      totalCourses,
      totalLessonsCompleted,
    };

    return res.json({
      success: true,
      data: {
        progress: validProgress,
        stats,
      },
    });
  } catch (error) {
    logger.error('Failed to get user progress:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve user progress',
    });
  }
});

// Get user activity
router.get('/activity', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const limit = parseInt(req.query.limit as string) || 10;
    
    // Get recent progress updates
    const progress = await progressModel.getUserProgress(req.user.id, { limit: 50 });
    
    // Get recent enrollments
    const enrollments = await enrollmentModel.getUserEnrollments(req.user.id, { limit: 50 });
    
    // Create activity timeline
    const activities = [];
    
    // Add enrollment activities
    for (const enrollment of enrollments.enrollments) {
      try {
        const course = await courseModel.findById(enrollment.courseId);
        activities.push({
          type: 'enrollment',
          timestamp: enrollment.enrolledAt,
          courseId: enrollment.courseId,
          courseName: course?.title || 'Unknown Course',
          description: `Enrolled in ${course?.title || 'Unknown Course'}`,
        });
        
        if (enrollment.status === 'completed' && enrollment.completedAt) {
          activities.push({
            type: 'completion',
            timestamp: enrollment.completedAt,
            courseId: enrollment.courseId,
            courseName: course?.title || 'Unknown Course',
            description: `Completed ${course?.title || 'Unknown Course'}`,
          });
        }
      } catch (error) {
        logger.error('Failed to get course details for activity:', { courseId: enrollment.courseId, error });
      }
    }
    
    // Add lesson completion activities
    for (const p of progress.progress) {
      try {
        const course = await courseModel.findById(p.courseId);
        if (p.completedLessons.length > 0) {
          // Add recent lesson completions
          const recentLessons = p.completedLessons.slice(-3); // Last 3 lessons
          for (const lesson of recentLessons) {
            activities.push({
              type: 'lesson_completion',
              timestamp: p.lastWatched || p.updatedAt,
              courseId: p.courseId,
              courseName: course?.title || 'Unknown Course',
              description: `Completed lesson in ${course?.title || 'Unknown Course'}`,
              lessonId: lesson,
            });
          }
        }
      } catch (error) {
        logger.error('Failed to get course details for lesson activity:', { courseId: p.courseId, error });
      }
    }
    
    // Sort activities by timestamp (most recent first)
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    // Return limited activities
    const limitedActivities = activities.slice(0, limit);

    return res.json({
      success: true,
      data: {
        activities: limitedActivities,
      },
    });
  } catch (error) {
    logger.error('Failed to get user activity:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve user activity',
    });
  }
});

// Get user achievements
router.get('/achievements', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const limit = parseInt(req.query.limit as string) || 10;
    
    // Get user statistics
    const enrollments = await enrollmentModel.getUserEnrollments(req.user.id, { limit: 1000 });
    const progress = await progressModel.getUserProgress(req.user.id, { limit: 1000 });
    const streak = await progressModel.getUserLearningStreak(req.user.id);
    
    const totalCourses = enrollments.enrollments.length;
    const completedCourses = enrollments.enrollments.filter(e => e.status === 'completed').length;
    const totalTimeSpent = progress.progress.reduce((sum, p) => sum + p.timeSpent, 0);
    const totalLessonsCompleted = progress.progress.reduce((sum, p) => sum + p.completedLessons.length, 0);
    
    // Generate achievements based on user progress
    const achievements = [];
    
    // Course completion achievements
    if (completedCourses >= 1) {
      achievements.push({
        id: 'first_course',
        title: 'First Course Completed',
        description: 'Completed your first course',
        icon: 'STAR',
        category: 'learning',
        earnedAt: enrollments.enrollments.find(e => e.status === 'completed')?.completedAt,
        progress: 100,
        maxProgress: 100,
      });
    }
    
    if (completedCourses >= 5) {
      achievements.push({
        id: 'five_courses',
        title: 'Course Enthusiast',
        description: 'Completed 5 courses',
        icon: 'STAR',
        category: 'learning',
        earnedAt: new Date().toISOString(),
        progress: 100,
        maxProgress: 100,
      });
    }
    
    if (completedCourses >= 10) {
      achievements.push({
        id: 'ten_courses',
        title: 'Learning Master',
        description: 'Completed 10 courses',
        icon: 'TROPHY',
        category: 'learning',
        earnedAt: new Date().toISOString(),
        progress: 100,
        maxProgress: 100,
      });
    }
    
    // Streak achievements
    if (streak.currentStreak >= 7) {
      achievements.push({
        id: 'week_streak',
        title: 'Week Warrior',
        description: 'Maintained a 7-day learning streak',
        icon: 'FIRE',
        category: 'engagement',
        earnedAt: new Date().toISOString(),
        progress: 100,
        maxProgress: 100,
      });
    }
    
    if (streak.currentStreak >= 30) {
      achievements.push({
        id: 'month_streak',
        title: 'Monthly Champion',
        description: 'Maintained a 30-day learning streak',
        icon: 'STRONG',
        category: 'engagement',
        earnedAt: new Date().toISOString(),
        progress: 100,
        maxProgress: 100,
      });
    }
    
    // Time-based achievements
    if (totalTimeSpent >= 600) { // 10 hours
      achievements.push({
        id: 'ten_hours',
        title: 'Time Investor',
        description: 'Spent 10 hours learning',
        icon: 'CLOCK',
        category: 'learning',
        earnedAt: new Date().toISOString(),
        progress: 100,
        maxProgress: 100,
      });
    }
    
    // Lesson completion achievements
    if (totalLessonsCompleted >= 50) {
      achievements.push({
        id: 'fifty_lessons',
        title: 'Lesson Lover',
        description: 'Completed 50 lessons',
        icon: 'STAR',
        category: 'learning',
        earnedAt: new Date().toISOString(),
        progress: 100,
        maxProgress: 100,
      });
    }
    
    // Add progress-based achievements (not yet earned)
    if (completedCourses < 5) {
      achievements.push({
        id: 'five_courses_progress',
        title: 'Course Enthusiast',
        description: 'Complete 5 courses',
        icon: 'STAR',
        category: 'learning',
        earnedAt: null,
        progress: completedCourses,
        maxProgress: 5,
      });
    }
    
    if (streak.currentStreak < 7) {
      achievements.push({
        id: 'week_streak_progress',
        title: 'Week Warrior',
        description: 'Maintain a 7-day learning streak',
        icon: 'FIRE',
        category: 'engagement',
        earnedAt: null,
        progress: streak.currentStreak,
        maxProgress: 7,
      });
    }

    const stats = {
      totalAchievements: achievements.filter(a => a.earnedAt).length,
      totalPossible: achievements.length,
      completedCourses,
      totalTimeSpent: Math.round(totalTimeSpent / 60), // in hours
      currentStreak: streak,
    };

    return res.json({
      success: true,
      data: {
        achievements: achievements.slice(0, limit),
        stats,
      },
    });
  } catch (error) {
    logger.error('Failed to get user achievements:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve user achievements',
    });
  }
});

// Get course recommendations
router.get('/recommendations', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const limit = parseInt(req.query.limit as string) || 6;
    
    // Get user's enrolled courses
    const enrollments = await enrollmentModel.getUserEnrollments(req.user.id, { limit: 1000 });
    const enrolledCourseIds = enrollments.enrollments.map(e => e.courseId);
    
    // Get all published courses
    const allCoursesResult = await courseModel.getPublishedCourses({ limit: 100 });
    const allCourses = allCoursesResult.courses;
    
    // Filter out already enrolled courses
    const availableCourses = allCourses.filter((course: any) => !enrolledCourseIds.includes(course.id));
    
    // Simple recommendation algorithm:
    // 1. Prioritize courses from the same categories as enrolled courses
    // 2. Prioritize highly rated courses
    // 3. Prioritize popular courses
    
    const enrolledCourses = await Promise.all(
      enrolledCourseIds.map(async (courseId) => {
        try {
          return await courseModel.findById(courseId);
        } catch (error) {
          return null;
        }
      })
    );
    
    const validEnrolledCourses = enrolledCourses.filter(c => c !== null);
    const userCategories = [...new Set(validEnrolledCourses.map(c => c.category))];
    
    // Score and sort recommendations
    const scoredCourses = availableCourses.map((course: any) => {
      let score = 0;
      
      // Category match bonus
      if (userCategories.includes(course.category)) {
        score += 3;
      }
      
      // Rating bonus
      if (course.rating && course.rating.average) {
        score += course.rating.average;
      }
      
      // Popularity bonus (enrollment count)
      if (course.enrollmentCount) {
        score += Math.min(course.enrollmentCount / 10, 2); // Max 2 points for popularity
      }
      
      // Recency bonus (newer courses get slight boost)
      const daysSinceCreation = (Date.now() - new Date(course.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceCreation < 30) {
        score += 1;
      }
      
      return {
        ...course,
        recommendationScore: score,
      };
    });
    
    // Sort by score and return top recommendations
    scoredCourses.sort((a: any, b: any) => b.recommendationScore - a.recommendationScore);
    const recommendations = scoredCourses.slice(0, limit);

    return res.json({
      success: true,
      data: {
        recommendations,
      },
    });
  } catch (error) {
    logger.error('Failed to get course recommendations:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve course recommendations',
    });
  }
});

// Get user certificates (enhanced version)
router.get('/certificates', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    // Get completed enrollments
    const completedEnrollments = await enrollmentModel.getUserCompletedCourses(req.user.id);

    // Get certificate details for each completed course
    const certificates = await Promise.all(
      completedEnrollments.map(async (enrollment) => {
        try {
          const course = await courseModel.findById(enrollment.courseId);
          return {
            id: enrollment._id,
            courseId: enrollment.courseId,
            courseName: course?.title || 'Unknown Course',
            courseDescription: course?.description || '',
            completedAt: enrollment.completedAt,
            certificate: enrollment.certificate,
            instructor: course?.instructorName || 'Unknown Instructor',
            category: course?.category || 'General',
            level: course?.level || 'beginner',
            duration: course?.totalDuration || 0,
            rating: course?.rating?.average || 0,
            thumbnailUrl: course?.thumbnail || '',
          };
        } catch (error) {
          logger.error('Failed to get certificate details:', { enrollmentId: enrollment._id, error });
          return null;
        }
      })
    );

    const validCertificates = certificates.filter(cert => cert !== null);

    return res.json({
      success: true,
      data: { 
        certificates: validCertificates,
        totalCertificates: validCertificates.length,
      },
    });
  } catch (error) {
    logger.error('Failed to get user certificates:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve user certificates',
    });
  }
});

// Get leaderboard
router.get('/leaderboard', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const limit = parseInt(req.query.limit as string) || 10;
    
    // Get all users with their learning statistics
    const allUsers = await userModel.findAll({ limit: 1000 });
    
    // Calculate stats for each user
    const userStats = await Promise.all(
      allUsers.docs.map(async (user) => {
        try {
          const enrollments = await enrollmentModel.getUserEnrollments(user.id, { limit: 1000 });
          const progress = await progressModel.getUserProgress(user.id, { limit: 1000 });
          const streak = await progressModel.getUserLearningStreak(user.id);
          
          const completedCourses = enrollments.enrollments.filter(e => e.status === 'completed').length;
          const totalTimeSpent = progress.progress.reduce((sum, p) => sum + p.timeSpent, 0);
          const totalLessonsCompleted = progress.progress.reduce((sum, p) => sum + p.completedLessons.length, 0);
          
          // Calculate overall score
          const score = (completedCourses * 100) + (totalLessonsCompleted * 10) + (streak.currentStreak * 5) + Math.floor(totalTimeSpent / 60);
          
          return {
            id: user.id,
            name: user.name,
            avatar: user.avatar,
            completedCourses,
            totalTimeSpent: Math.round(totalTimeSpent / 60), // in hours
            streak,
            totalLessonsCompleted,
            score,
          };
        } catch (error) {
          logger.error('Failed to calculate user stats for leaderboard:', { userId: user.id, error });
          return null;
        }
      })
    );
    
    // Filter out null results and sort by score
    const validUserStats = userStats.filter(stat => stat !== null);
    validUserStats.sort((a, b) => b.score - a.score);
    
    // Add ranking
    const leaderboard = validUserStats.slice(0, limit).map((user, index) => ({
      ...user,
      rank: index + 1,
    }));
    
    // Find current user's position
    const currentUserIndex = validUserStats.findIndex(user => user.id === req.user!.id);
    const currentUserRank = currentUserIndex >= 0 ? currentUserIndex + 1 : null;

    return res.json({
      success: true,
      data: {
        leaderboard,
        currentUserRank,
        totalUsers: validUserStats.length,
      },
    });
  } catch (error) {
    logger.error('Failed to get leaderboard:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve leaderboard',
    });
  }
});

// Get dashboard statistics (comprehensive learner dashboard stats)
router.get('/dashboard-stats', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    logger.info('Getting dashboard stats for user:', { userId: req.user.id });

    // Get comprehensive user statistics
    const [enrollments, progress, streak] = await Promise.all([
      enrollmentModel.getUserEnrollments(req.user.id, { limit: 1000 }),
      progressModel.getUserProgress(req.user.id, { limit: 1000 }),
      progressModel.getUserLearningStreak(req.user.id)
    ]);

    // Calculate basic stats
    const totalCourses = enrollments.enrollments.length;
    const completedCourses = enrollments.enrollments.filter(e => e.status === 'completed').length;
    const inProgressCourses = enrollments.enrollments.filter(e => e.status === 'active').length;
    const totalTimeSpent = progress.progress.reduce((sum, p) => sum + p.timeSpent, 0);
    const totalLessonsCompleted = progress.progress.reduce((sum, p) => sum + p.completedLessons.length, 0);

    // Calculate completion rate
    const completionRate = totalCourses > 0 ? Math.round((completedCourses / totalCourses) * 100) : 0;

    // Get recent activity (last 5 activities)
    const recentActivity = [];
    
    // Add recent enrollments
    const recentEnrollments = enrollments.enrollments
      .sort((a, b) => new Date(b.enrolledAt).getTime() - new Date(a.enrolledAt).getTime())
      .slice(0, 3);
    
    for (const enrollment of recentEnrollments) {
      try {
        const course = await courseModel.findById(enrollment.courseId);
        recentActivity.push({
          type: 'enrollment',
          timestamp: enrollment.enrolledAt,
          description: `Enrolled in ${course?.title || 'Unknown Course'}`,
          courseId: enrollment.courseId,
          courseName: course?.title || 'Unknown Course',
        });
      } catch (error) {
        logger.error('Failed to get course details for recent activity:', { courseId: enrollment.courseId, error });
      }
    }

    // Add recent completions
    const recentCompletions = enrollments.enrollments
      .filter(e => e.status === 'completed' && e.completedAt)
      .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime())
      .slice(0, 2);
    
    for (const completion of recentCompletions) {
      try {
        const course = await courseModel.findById(completion.courseId);
        recentActivity.push({
          type: 'completion',
          timestamp: completion.completedAt!,
          description: `Completed ${course?.title || 'Unknown Course'}`,
          courseId: completion.courseId,
          courseName: course?.title || 'Unknown Course',
        });
      } catch (error) {
        logger.error('Failed to get course details for completion activity:', { courseId: completion.courseId, error });
      }
    }

    // Sort recent activity by timestamp and limit
    recentActivity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const limitedActivity = recentActivity.slice(0, 5);

    // Get certificates count
    const certificatesCount = completedCourses; // Each completed course gets a certificate

    // Calculate weekly progress
    const weeklyProgress = {
      lessonsCompleted: 0,
      timeSpent: 0,
      coursesCompleted: 0,
    };

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    // Calculate weekly stats from recent progress
    for (const p of progress.progress) {
      const lastUpdate = new Date(p.lastWatched || p.updatedAt);
      if (lastUpdate >= oneWeekAgo) {
        weeklyProgress.timeSpent += p.timeSpent;
        weeklyProgress.lessonsCompleted += p.completedLessons.length;
      }
    }

    // Count courses completed this week
    weeklyProgress.coursesCompleted = enrollments.enrollments.filter(e => 
      e.status === 'completed' && 
      e.completedAt && 
      new Date(e.completedAt) >= oneWeekAgo
    ).length;

    // Achievement progress
    const achievementProgress = {
      coursesCompleted: {
        current: completedCourses,
        next: completedCourses < 5 ? 5 : completedCourses < 10 ? 10 : 20,
        title: completedCourses < 5 ? 'Course Enthusiast' : completedCourses < 10 ? 'Learning Master' : 'Course Expert',
      },
      streak: {
        current: streak.currentStreak,
        next: streak.currentStreak < 7 ? 7 : streak.currentStreak < 30 ? 30 : 100,
        title: streak.currentStreak < 7 ? 'Week Warrior' : streak.currentStreak < 30 ? 'Monthly Champion' : 'Streak Legend',
      },
      timeSpent: {
        current: Math.round(totalTimeSpent / 60), // in hours
        next: Math.round(totalTimeSpent / 60) < 10 ? 10 : Math.round(totalTimeSpent / 60) < 50 ? 50 : 100,
        title: Math.round(totalTimeSpent / 60) < 10 ? 'Time Investor' : Math.round(totalTimeSpent / 60) < 50 ? 'Dedicated Learner' : 'Learning Master',
      },
    };

    const stats = {
      overview: {
        totalCourses,
        completedCourses,
        inProgressCourses,
        completionRate,
        totalTimeSpent: Math.round(totalTimeSpent / 60), // in hours
        totalLessonsCompleted,
        certificatesEarned: certificatesCount,
        currentStreak: streak.currentStreak,
        longestStreak: streak.longestStreak,
      },
      recentActivity: limitedActivity,
      weeklyProgress,
      achievementProgress,
      learningStreak: streak,
    };

    logger.info('Dashboard stats calculated successfully:', { 
      userId: req.user.id, 
      totalCourses,
      completedCourses,
      streak: streak.currentStreak,
    });

    return res.json({
      success: true,
      data: {
        stats,
      },
    });
  } catch (error) {
    logger.error('Failed to get dashboard stats:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve dashboard statistics',
    });
  }
});

export { router as userRoutes };
export default router; 