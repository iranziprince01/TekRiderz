import { Request, Response, NextFunction } from 'express';
import { courseModel } from '../models/Course';
import { enrollmentModel } from '../models/Enrollment';
import { progressModel } from '../models/Progress';
import { logger } from '../utils/logger';
import { ApiResponse, Progress } from '../types';
import { quizGradingService } from '../services/quizGradingService';

export class CourseController {
  // Get all published courses
  async getAllCourses(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      // Use basic find method instead of findPublished
      const result = await courseModel.findAll({
        limit,
        skip: (page - 1) * limit
      });

      // Filter for published courses
      const publishedCourses = result.docs.filter((course: any) => course.status === 'published');

      // Check enrollment status for each course if user is authenticated
      let coursesWithEnrollment = publishedCourses;
      if (req.user) {
        logger.info('Checking enrollment status for user:', { userId: req.user.id, coursesCount: publishedCourses.length });
        
        coursesWithEnrollment = await Promise.all(
          publishedCourses.map(async (course: any) => {
            try {
              const enrollment = await enrollmentModel.findByUserAndCourse(req.user!.id, course._id || course.id);
              const isEnrolled = !!enrollment;
              
              logger.info('Course enrollment check:', { 
                courseId: course._id || course.id, 
                courseTitle: course.title,
                userId: req.user!.id,
                isEnrolled,
                enrollmentId: enrollment?._id,
                progress: enrollment?.progress || 0
              });
              
              return {
                ...course,
                isEnrolled,
                enrollmentId: enrollment?._id,
                progress: enrollment?.progress || 0
              };
            } catch (error) {
              logger.warn('Failed to check enrollment for course:', { courseId: course._id || course.id, error });
              return {
                ...course,
                isEnrolled: false,
                enrollmentId: null,
                progress: 0
              };
            }
          })
        );
        
        const enrolledCount = coursesWithEnrollment.filter((c: any) => c.isEnrolled).length;
        logger.info('Enrollment status check complete:', { 
          userId: req.user.id, 
          totalCourses: coursesWithEnrollment.length,
          enrolledCourses: enrolledCount
        });
      } else {
        coursesWithEnrollment = publishedCourses.map((course: any) => ({
          ...course,
          isEnrolled: false,
          enrollmentId: null,
          progress: 0
        }));
      }

      const response: ApiResponse = {
        success: true,
        data: {
          courses: coursesWithEnrollment,
          pagination: {
            page,
            limit,
            total: coursesWithEnrollment.length,
            pages: Math.ceil(coursesWithEnrollment.length / limit)
          }
        }
      };

      res.json(response);
    } catch (error) {
      logger.error('Failed to get courses:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve courses'
      });
    }
  }

  // Get single course by ID
  async getCourseById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id: courseId } = req.params;

      if (!courseId) {
        res.status(400).json({
          success: false,
          error: 'Course ID is required'
        });
        return;
      }

      const course = await courseModel.findById(courseId);
      if (!course) {
        res.status(404).json({
          success: false,
          error: 'Course not found'
        });
        return;
      }

      // Check if user is enrolled (if authenticated)
      let isEnrolled = false;
      let enrollmentId = null;
      let enrollment = null;

      if (req.user) {
        try {
          enrollment = await enrollmentModel.findByUserAndCourse(req.user.id, courseId);
          if (enrollment) {
            isEnrolled = true;
            enrollmentId = enrollment._id;
          }
        } catch (error) {
          // Ignore enrollment check errors for now
        }
      }

      const response: ApiResponse = {
        success: true,
        data: {
          course,
          isEnrolled,
          enrollmentId,
          enrollment // Include full enrollment data with completion status
        }
      };

      res.json(response);
    } catch (error) {
      logger.error('Failed to get course:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve course'
      });
    }
  }

  // Create new course (tutors only)
  async createCourse(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      // Enhanced validation for course creation
      const validationErrors = [];
      
      // Validate required fields
      if (!req.body.title || req.body.title.trim().length < 3) {
        validationErrors.push('Title must be at least 3 characters long');
      }
      
      if (!req.body.description || req.body.description.trim().length < 20) {
        validationErrors.push('Description must be at least 20 characters long');
      }
      
      if (!req.body.category) {
        validationErrors.push('Category is required');
      }
      
      if (!req.body.level) {
        validationErrors.push('Level is required');
      }

      // Validate thumbnail URL if provided
      if (req.body.thumbnail && req.body.thumbnail.trim() !== '') {
        const thumbnailUrl = req.body.thumbnail.trim();
        
        // Basic URL validation - skip validation for now to prevent errors
        try {
          if (!CourseController.isValidUrl(thumbnailUrl) && !CourseController.isValidBase64Image(thumbnailUrl)) {
            console.warn('Thumbnail URL validation failed, but allowing submission:', thumbnailUrl);
          }
        } catch (urlError) {
          console.warn('Thumbnail URL validation error, but allowing submission:', urlError);
        }
      }

      // Return validation errors if any
      if (validationErrors.length > 0) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validationErrors
        });
        return;
      }

      // Prepare course data with proper defaults and validation
      const courseData = {
        ...req.body,
        // Ensure required fields
        instructorId: req.user.id,
        instructorName: req.user.name || req.user.email || 'Unknown Instructor',
        status: 'draft' as const,
        enrollmentCount: 0,
        type: 'course' as const,
        
        // Clean and validate thumbnail URL
        thumbnail: req.body.thumbnail ? req.body.thumbnail.trim() : '',
        
        // Ensure proper data types for arrays
        tags: Array.isArray(req.body.tags) ? req.body.tags : [],
        requirements: Array.isArray(req.body.requirements) ? req.body.requirements : [],
        learningObjectives: Array.isArray(req.body.learningObjectives) ? req.body.learningObjectives : [],
        sections: Array.isArray(req.body.sections) ? req.body.sections : [],
        
        // Ensure proper data types for numbers
        totalDuration: parseInt(req.body.totalDuration) || 0,
        totalLessons: parseInt(req.body.totalLessons) || 0,
        price: parseFloat(req.body.price) || 0,
        
        // Ensure string fields are properly trimmed
        title: req.body.title.trim(),
        description: req.body.description.trim(),
        shortDescription: req.body.shortDescription ? 
          req.body.shortDescription.trim() : 
          req.body.description.trim().substring(0, 150) + (req.body.description.length > 150 ? '...' : ''),
        
        // Additional metadata
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Create the course using the course model
      const course = await courseModel.create(courseData);

      logger.info('Course created successfully:', {
        courseId: course._id,
        courseIdField: course.id,
        title: course.title,
        instructorId: req.user.id,
        hasThumbnail: !!course.thumbnail,
        thumbnailType: course.thumbnail ? CourseController.getThumbnailType(course.thumbnail) : 'none'
      });

      const response: ApiResponse = {
        success: true,
        data: {
          course,
          message: 'Course created successfully'
        }
      };

      res.status(201).json(response);
    } catch (error) {
      logger.error('Failed to create course:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Failed to create course';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      res.status(500).json({
        success: false,
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  }

  // Helper method to validate URLs
  private static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  // Helper method to validate base64 images
  private static isValidBase64Image(str: string): boolean {
    const base64Pattern = /^data:image\/(png|jpg|jpeg|gif|webp|bmp);base64,/;
    return base64Pattern.test(str);
  }

  // Helper method to determine thumbnail type
  private static getThumbnailType(thumbnail: string): string {
    if (thumbnail.includes('cloudinary.com')) return 'cloudinary';
    if (thumbnail.startsWith('data:image')) return 'base64';
    if (thumbnail.startsWith('http')) return 'external';
    return 'relative';
  }

  // Update course (tutors only)
  async updateCourse(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id: courseId } = req.params;
      
      console.log('Update course request:', {
        courseId,
        userId: req.user?.id,
        userRole: req.user?.role,
        bodyKeys: Object.keys(req.body || {})
      });
      
      if (!courseId) {
        res.status(400).json({
          success: false,
          error: 'Course ID is required'
        });
        return;
      }

      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      // Check if course exists and user owns it
      console.log('Looking for course with ID:', courseId);
      const existingCourse = await courseModel.findById(courseId);
      console.log('Course lookup result:', {
        found: !!existingCourse,
        courseId: existingCourse?._id,
        courseTitle: existingCourse?.title,
        instructorId: existingCourse?.instructorId
      });
      
      if (!existingCourse) {
        res.status(404).json({
          success: false,
          error: 'Course not found'
        });
        return;
      }

      // Ensure user can only update their own courses (unless admin)
      if (req.user.role !== 'admin' && existingCourse.instructorId !== req.user.id) {
        res.status(403).json({
          success: false,
          error: 'You can only update your own courses'
        });
        return;
      }

      // Prepare update data
      const updateData = {
        ...req.body,
        updatedAt: new Date().toISOString()
      };

      // If course is published/approved, create a new version
      if (existingCourse.status === 'published' || existingCourse.status === 'approved') {
        console.log('Updating published course - creating new version');
        
        // Increment version number
        const currentVersion = existingCourse.version || '1.0.0';
        const versionParts = currentVersion.split('.');
        const majorVersion = parseInt(versionParts[0] || '1') || 1;
        const minorVersion = parseInt(versionParts[1] || '0') || 0;
        const patchVersion = parseInt(versionParts[2] || '0') || 0;
        
        updateData.version = `${majorVersion}.${minorVersion + 1}.${patchVersion}`;
        updateData.isCurrentVersion = true;
        
        // Add to workflow history
        const workflowEntry = {
          id: `workflow_${Date.now()}`,
          action: 'update',
          fromStatus: existingCourse.status,
          toStatus: existingCourse.status, // Status remains the same
          performedBy: req.user.id,
          performedByRole: req.user.role,
          timestamp: new Date().toISOString(),
          reason: 'Course content updated',
          notes: 'New version created with updated content'
        };
        
        updateData.workflowHistory = [
          ...(existingCourse.workflowHistory || []),
          workflowEntry
        ];
        
        console.log('Created new version:', updateData.version);
      }

      // Update the course
      const updatedCourse = await courseModel.update(courseId, updateData);

      logger.info('Course updated:', {
        courseId,
        title: updatedCourse.title,
        instructorId: req.user.id,
        newVersion: updateData.version,
        wasPublished: existingCourse.status === 'published' || existingCourse.status === 'approved'
      });

      // If course was published, notify enrolled learners about the update
      if (existingCourse.status === 'published' || existingCourse.status === 'approved') {
        try {
          const { enrollmentModel } = await import('../models/Enrollment');
          const enrollments = await enrollmentModel.getCourseEnrollments(courseId, { limit: 1000 });
          
          if (enrollments.enrollments && enrollments.enrollments.length > 0) {
            console.log(`Notifying ${enrollments.enrollments.length} enrolled learners about course update`);
            
            // In a real implementation, you would send notifications/emails here
            // For now, we'll just log it
            enrollments.enrollments.forEach(enrollment => {
              console.log(`Learner ${enrollment.userId} will be notified about course update to version ${updateData.version}`);
            });
          }
        } catch (notificationError) {
          console.warn('Failed to notify learners about course update:', notificationError);
        }
      }

      const response: ApiResponse = {
        success: true,
        data: { 
          course: updatedCourse,
          message: 'Course updated successfully'
        }
      };

      res.json(response);
    } catch (error) {
      logger.error('Failed to update course:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update course'
      });
    }
  }

  // Submit course for approval
  async submitCourseForApproval(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id: courseId } = req.params;
      
      if (!courseId) {
        res.status(400).json({
          success: false,
          error: 'Course ID is required'
        });
        return;
      }

      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      // Update course status to submitted
      const course = await courseModel.update(courseId, {
        status: 'submitted',
        submittedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      logger.info('Course submitted for approval:', {
        courseId,
        title: course.title,
        instructorId: req.user.id
      });

      const response: ApiResponse = {
        success: true,
        data: { 
          course,
          message: 'Course submitted for approval successfully'
        }
      };

      res.json(response);
    } catch (error) {
      logger.error('Failed to submit course:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to submit course'
      });
    }
  }

  // Publish approved course (tutors only)
  async publishApprovedCourse(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id: courseId } = req.params;
      
      if (!courseId) {
        res.status(400).json({
          success: false,
          error: 'Course ID is required'
        });
        return;
      }

      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      // Get the course and verify ownership
      const course = await courseModel.findById(courseId);
      if (!course) {
        res.status(404).json({
          success: false,
          error: 'Course not found'
        });
        return;
      }

      // Verify the course belongs to the requesting tutor
      if (course.instructorId !== req.user.id) {
        res.status(403).json({
          success: false,
          error: 'You can only publish your own courses'
        });
        return;
      }

      // Verify the course is approved
      if (course.status !== 'approved') {
        res.status(400).json({
          success: false,
          error: 'Only approved courses can be published. Current status: ' + course.status
        });
        return;
      }

      // Update course status to published
      const updatedCourse = await courseModel.update(courseId, {
        status: 'published',
        publishedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      logger.info('Course published by tutor:', {
        courseId,
        title: course.title,
        instructorId: req.user.id
      });

      const response: ApiResponse = {
        success: true,
        data: { 
          course: updatedCourse,
          message: 'Course published successfully and is now available to learners'
        }
      };

      res.json(response);
    } catch (error) {
      logger.error('Failed to publish course:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to publish course'
      });
    }
  }

  // Get instructor courses
  async getInstructorCourses(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      // Get all courses and filter by instructor
      const result = await courseModel.findAll({
        limit,
        skip: (page - 1) * limit
      });

      const instructorCourses = result.docs.filter((course: any) => course.instructorId === req.user!.id);

      const response: ApiResponse = {
        success: true,
        data: {
          courses: instructorCourses,
          pagination: {
            page,
            limit,
            total: instructorCourses.length,
            pages: Math.ceil(instructorCourses.length / limit)
          }
        }
      };

      res.json(response);
    } catch (error) {
      logger.error('Failed to get instructor courses:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve courses'
      });
    }
  }

  // Enroll in course
  async enrollInCourse(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id: courseId } = req.params;
      
      if (!courseId) {
        res.status(400).json({
          success: false,
          error: 'Course ID is required'
        });
        return;
      }

      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      // Check if course exists and is published
      const course = await courseModel.findById(courseId);
      if (!course) {
        res.status(404).json({
          success: false,
          error: 'Course not found'
        });
        return;
      }

      if (course.status !== 'published') {
        res.status(400).json({
          success: false,
          error: 'Course is not available for enrollment'
        });
        return;
      }

      // Check if already enrolled
      const existingEnrollment = await enrollmentModel.findByUserAndCourse(req.user.id, courseId);
      if (existingEnrollment) {
        const response: ApiResponse = {
          success: true,
          data: {
            enrollment: existingEnrollment,
            message: 'Already enrolled in this course',
            course: {
              id: course._id || course.id,
              title: course.title,
              thumbnail: course.thumbnail,
              instructorName: course.instructorName
            }
          }
        };
        res.json(response);
        return;
      }

      // Create enrollment with proper structure
      const enrollmentData = {
        id: `enrollment_${Date.now()}`,
        type: 'enrollment' as const,
        userId: req.user.id,
        courseId,
        enrolledAt: new Date().toISOString(),
        status: 'active' as const,
        progress: 0,
        completedLessons: [],
        lastAccessedAt: new Date().toISOString()
      };

      const enrollment = await enrollmentModel.create(enrollmentData);

      // Create initial progress record
      try {
        await progressModel.getOrCreateProgress(req.user.id, courseId);
      } catch (error) {
        // Ignore progress creation errors for now
        logger.warn('Failed to create initial progress:', error);
      }

      logger.info('User enrolled in course:', {
        userId: req.user.id, 
        courseId,
        enrollmentId: enrollment._id
      });

      const response: ApiResponse = {
        success: true,
        data: {
          enrollment,
          message: 'Successfully enrolled in course',
          course: {
            id: course._id || course.id,
            title: course.title,
            thumbnail: course.thumbnail,
            instructorName: course.instructorName
          }
        }
      };

      res.status(201).json(response);
    } catch (error) {
      logger.error('Failed to enroll in course:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to enroll in course'
      });
    }
  }

  // Get course content (basic version)
  async getCourseContent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id: courseId } = req.params;
      
      if (!courseId) {
        res.status(400).json({
          success: false,
          error: 'Course ID is required'
        });
        return;
      }

      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      const course = await courseModel.findById(courseId);
      if (!course) {
        res.status(404).json({
          success: false,
          error: 'Course not found'
        });
        return;
      }

      // Get user progress if available
      let progress = null;
      try {
        progress = await progressModel.findByUserAndCourse(req.user.id, courseId);
      } catch (error) {
        // Ignore progress errors for now
      }

      const response: ApiResponse = {
        success: true,
        data: {
          course: {
            ...course,
            sections: course.sections || []
          },
          progress: {
            overallProgress: progress?.overallProgress || 0,
            completedLessons: progress?.completedLessons || [],
            currentLesson: progress?.currentLesson,
            timeSpent: progress?.timeSpent || 0
          }
        }
      };

      res.json(response);
    } catch (error) {
      logger.error('Failed to get course content:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve course content'
      });
    }
  }

  // Get course quizzes/assessments
  async getCourseQuizzes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const courseId = req.params.id;
      
      if (!courseId) {
        res.status(400).json({
          success: false,
          error: 'Course ID is required'
        });
        return;
      }

      const course = await courseModel.findById(courseId);
      if (!course) {
        res.status(404).json({
          success: false,
          error: 'Course not found'
        });
        return;
      }

      // Validate user enrollment - enhanced for free courses
      let enrollment = await enrollmentModel.findByUserAndCourse(req.user!.id, courseId);
      
      // For free courses, auto-enroll users who try to access quizzes
      if (!enrollment) {
        try {
          logger.info('Auto-enrolling user for quiz access:', { userId: req.user!.id, courseId });
          enrollment = await enrollmentModel.enrollUser(req.user!.id, courseId);
          
          // Update course enrollment count
          await courseModel.updateEnrollmentCount(courseId, 1);
          
          logger.info('User auto-enrolled for quiz access:', { 
            userId: req.user!.id, 
            courseId, 
            enrollmentId: enrollment._id 
          });
        } catch (enrollError) {
          logger.error('Failed to auto-enroll user for quiz:', { userId: req.user!.id, courseId, error: enrollError });
          res.status(403).json({
            success: false,
            error: 'Unable to access course quizzes. Please try again.'
          });
          return;
        }
      }
      
      // Allow access for active and completed enrollments
      if (enrollment.status !== 'active' && enrollment.status !== 'completed') {
        res.status(403).json({
          success: false,
          error: 'Course access is suspended. Please contact support.'
        });
        return;
      }

      // Get user's quiz progress/scores
      const progress = await progressModel.findByUserAndCourse(req.user!.id, courseId);
      const quizScores = progress?.quizScores || {};

      // Extract all quizzes from course structure
      const allQuizzes: any[] = [];

      // Extract module quizzes from sections/lessons
      if (course.sections && Array.isArray(course.sections)) {
        course.sections.forEach((section: any, sectionIndex: number) => {
          // Check lessons for quizzes
          if (section.lessons && Array.isArray(section.lessons)) {
            section.lessons.forEach((lesson: any, lessonIndex: number) => {
              if (lesson.quiz) {
                const quizScore = quizScores[lesson.quiz.id];
                const moduleTitle = lesson.title || section.title || `Module ${sectionIndex + 1}`;
                
                allQuizzes.push({
                  id: lesson.quiz.id,
                  title: lesson.quiz.title || `${moduleTitle} Quiz`,
                  description: lesson.quiz.description || `Test your knowledge of ${moduleTitle}`,
                  moduleTitle,
                  type: 'module',
                  questions: lesson.quiz.questions || [],
                  questionsCount: lesson.quiz.questions?.length || 0,
                  estimatedDuration: lesson.quiz.estimatedDuration || 15,
                  passingScore: lesson.quiz.passingScore || lesson.quiz.settings?.passingScore || 70,
                  maxAttempts: lesson.quiz.maxAttempts || lesson.quiz.settings?.attempts || 3,
                  timeLimit: lesson.quiz.timeLimit || lesson.quiz.settings?.timeLimit || 0,
                  showCorrectAnswers: lesson.quiz.settings?.showCorrectAnswers ?? true,
                  showScoreImmediately: lesson.quiz.settings?.showResultsImmediately ?? true,
                  
                  // User progress data
                  isCompleted: quizScore?.passed || false,
                  bestScore: quizScore?.bestPercentage,
                  bestPercentage: quizScore?.bestPercentage,
                  attempts: quizScore?.totalAttempts || 0,
                  totalAttempts: quizScore?.totalAttempts || 0,
                  passed: quizScore?.passed || false,
                  isUnlocked: true, // All quizzes are always unlocked
                  
                  // Metadata
                  lessonId: lesson.id,
                  sectionId: section.id,
                  courseId: course._id || course.id
                });
              }
            });
          }
          
          // Check for section-level module quizzes
          if (section.moduleQuiz) {
            const quizScore = quizScores[section.moduleQuiz.id];
            const moduleTitle = section.title || `Module ${sectionIndex + 1}`;
            
            allQuizzes.push({
              id: section.moduleQuiz.id,
              title: section.moduleQuiz.title || `${moduleTitle} Assessment`,
              description: section.moduleQuiz.description || `Assessment for ${moduleTitle}`,
              moduleTitle,
              type: 'module',
              questions: section.moduleQuiz.questions || [],
              questionsCount: section.moduleQuiz.questions?.length || 0,
              estimatedDuration: section.moduleQuiz.estimatedDuration || 20,
              passingScore: section.moduleQuiz.passingScore || section.moduleQuiz.settings?.passingScore || 70,
              maxAttempts: section.moduleQuiz.maxAttempts || section.moduleQuiz.settings?.attempts || 3,
              timeLimit: section.moduleQuiz.timeLimit || section.moduleQuiz.settings?.timeLimit || 0,
              showCorrectAnswers: section.moduleQuiz.settings?.showCorrectAnswers ?? true,
              showScoreImmediately: section.moduleQuiz.settings?.showResultsImmediately ?? true,
              
              // User progress data
              isCompleted: quizScore?.passed || false,
              bestScore: quizScore?.bestPercentage,
              bestPercentage: quizScore?.bestPercentage,
              attempts: quizScore?.totalAttempts || 0,
              totalAttempts: quizScore?.totalAttempts || 0,
              passed: quizScore?.passed || false,
              isUnlocked: true, // All quizzes are always unlocked
              
              // Metadata
              sectionId: section.id,
              courseId: course._id || course.id
            });
          }
        });
      }

      // Add final assessment
      if (course.finalAssessment) {
        const finalScore = quizScores[course.finalAssessment.id];
        
        allQuizzes.push({
          id: course.finalAssessment.id,
          title: course.finalAssessment.title || 'Final Course Assessment',
          description: course.finalAssessment.description || 'Comprehensive assessment covering all course material',
          type: 'final',
          questions: course.finalAssessment.questions || [],
          questionsCount: course.finalAssessment.questions?.length || 0,
          estimatedDuration: 30,
          passingScore: course.finalAssessment.settings?.passingScore || 70,
          maxAttempts: course.finalAssessment.settings?.attempts || 3,
          timeLimit: course.finalAssessment.settings?.timeLimit || 0,
          showCorrectAnswers: course.finalAssessment.settings?.showCorrectAnswers ?? true,
          showScoreImmediately: course.finalAssessment.settings?.showResultsImmediately ?? true,
          
          // User progress data
          isCompleted: finalScore?.passed || false,
          bestScore: finalScore?.bestPercentage,
          bestPercentage: finalScore?.bestPercentage,
          attempts: finalScore?.totalAttempts || 0,
          totalAttempts: finalScore?.totalAttempts || 0,
          passed: finalScore?.passed || false,
          isUnlocked: true, // Always unlocked
          
          // Metadata
          courseId: course._id || course.id
        });
      }

      // If no quizzes found, create sample quizzes for demonstration
      if (allQuizzes.length === 0) {
        logger.info('No quizzes found in course, creating sample quizzes for demonstration:', { courseId });
        
        // Create sample module quizzes based on course sections or default
        const sectionCount = course.sections?.length || 3;
        for (let i = 1; i <= Math.min(sectionCount, 3); i++) {
          allQuizzes.push({
            id: `sample_module_quiz_${i}_${courseId}`,
            title: `Module ${i} Assessment`,
            description: `Test your understanding of Module ${i} concepts and material.`,
            moduleTitle: `Module ${i}`,
            type: 'module',
            questions: [
              {
                id: `q${i}_1`,
                type: 'multiple-choice',
                question: `Which of the following best describes the main concept covered in Module ${i}?`,
                points: 1,
                options: [
                  { id: 'a', text: 'Basic fundamentals and introduction', isCorrect: i === 1 },
                  { id: 'b', text: 'Intermediate concepts and applications', isCorrect: i === 2 },
                  { id: 'c', text: 'Advanced techniques and best practices', isCorrect: i === 3 },
                  { id: 'd', text: 'None of the above', isCorrect: false }
                ],
                correctAnswer: i === 1 ? 'a' : i === 2 ? 'b' : 'c',
                explanation: `Module ${i} focuses on ${i === 1 ? 'fundamental concepts' : i === 2 ? 'intermediate applications' : 'advanced techniques'}.`
              },
              {
                id: `q${i}_2`,
                type: 'true-false',
                question: `Module ${i} builds upon concepts from previous modules.`,
                points: 1,
                correctAnswer: i > 1 ? 'true' : 'false',
                explanation: `${i > 1 ? 'Yes, each module builds upon previous knowledge.' : 'No, Module 1 is introductory and standalone.'}`
              },
              {
                id: `q${i}_3`,
                type: 'multiple-select',
                question: `Which of the following are key learning objectives for Module ${i}? (Select all that apply)`,
                points: 2,
                options: [
                  { id: 'a', text: 'Understanding core concepts', isCorrect: true },
                  { id: 'b', text: 'Practical application skills', isCorrect: true },
                  { id: 'c', text: 'Historical background only', isCorrect: false },
                  { id: 'd', text: 'Assessment preparation', isCorrect: true }
                ],
                correctAnswer: ['a', 'b', 'd'],
                explanation: 'The module focuses on understanding, application, and assessment preparation.'
              }
            ],
            questionsCount: 3,
            estimatedDuration: 10,
            passingScore: 70,
            maxAttempts: 3,
            timeLimit: 0,
            showCorrectAnswers: true,
            showScoreImmediately: true,
            
            // User progress data
            isCompleted: false,
            bestScore: undefined,
            bestPercentage: undefined,
            attempts: 0,
            totalAttempts: 0,
            passed: false,
            isUnlocked: true,
            
            // Metadata
            courseId: course._id || course.id,
            isSample: true
          });
        }
        
        // Create sample final assessment
        allQuizzes.push({
          id: `sample_final_assessment_${courseId}`,
          title: 'Final Course Assessment',
          description: 'Comprehensive assessment covering all course modules and learning objectives.',
          type: 'final',
          questions: [
            {
              id: 'final_q1',
              type: 'multiple-choice',
              question: 'Which module introduced the fundamental concepts of this course?',
              points: 2,
              options: [
                { id: 'a', text: 'Module 1', isCorrect: true },
                { id: 'b', text: 'Module 2', isCorrect: false },
                { id: 'c', text: 'Module 3', isCorrect: false },
                { id: 'd', text: 'All modules equally', isCorrect: false }
              ],
              correctAnswer: 'a',
              explanation: 'Module 1 typically introduces fundamental concepts in any course structure.'
            },
            {
              id: 'final_q2',
              type: 'multiple-select',
              question: 'What are the key benefits of completing this course? (Select all that apply)',
              points: 3,
              options: [
                { id: 'a', text: 'Enhanced technical skills', isCorrect: true },
                { id: 'b', text: 'Better problem-solving abilities', isCorrect: true },
                { id: 'c', text: 'Industry-relevant knowledge', isCorrect: true },
                { id: 'd', text: 'Guaranteed employment', isCorrect: false }
              ],
              correctAnswer: ['a', 'b', 'c'],
              explanation: 'Courses provide skills and knowledge but cannot guarantee employment outcomes.'
            },
            {
              id: 'final_q3',
              type: 'essay',
              question: 'Describe how you would apply the concepts learned in this course to a real-world project. Provide specific examples and explain your reasoning. (Minimum 100 words)',
              points: 5,
              explanation: 'This question assesses your ability to synthesize and apply course concepts practically.'
            },
            {
              id: 'final_q4',
              type: 'fill-blank',
              question: 'The most important skill I learned in this course is _________ because it enables _________ in professional settings.',
              points: 2,
              explanation: 'This allows you to reflect on your personal learning outcomes.'
            },
            {
              id: 'final_q5',
              type: 'true-false',
              question: 'Continuous learning and skill development are essential for career growth in technology fields.',
              points: 1,
              correctAnswer: 'true',
              explanation: 'Technology fields evolve rapidly, making continuous learning essential for career success.'
            }
          ],
          questionsCount: 5,
          estimatedDuration: 45,
          passingScore: 70,
          maxAttempts: 3,
          timeLimit: 0,
          showCorrectAnswers: true,
          showScoreImmediately: true,
          
          // User progress data
          isCompleted: false,
          bestScore: undefined,
          bestPercentage: undefined,
          attempts: 0,
          totalAttempts: 0,
          passed: false,
          isUnlocked: true,
          
          // Metadata
          courseId: course._id || course.id,
          isSample: true
        });
      }

      // Calculate overall quiz statistics
      const totalQuizzes = allQuizzes.length;
      const completedQuizzes = allQuizzes.filter(q => q.isCompleted).length;
      const averageScore = allQuizzes.filter(q => q.bestScore !== undefined).length > 0
        ? Math.round(allQuizzes.filter(q => q.bestScore !== undefined).reduce((sum, q) => sum + (q.bestScore || 0), 0) / allQuizzes.filter(q => q.bestScore !== undefined).length)
        : 0;

      const response: ApiResponse = {
        success: true,
        data: { 
          quizzes: allQuizzes,
          stats: {
            totalQuizzes,
            completedQuizzes,
            averageScore,
            moduleQuizzes: allQuizzes.filter(q => q.type === 'module').length,
            finalAssessments: allQuizzes.filter(q => q.type === 'final').length,
            passedQuizzes: allQuizzes.filter(q => q.passed).length
          },
          course: {
            id: course._id || course.id,
            title: course.title
          }
        }
      };

      logger.info('Course quizzes fetched successfully:', {
        courseId,
        userId: req.user!.id,
        totalQuizzes,
        completedQuizzes,
        averageScore,
        hasSampleQuizzes: allQuizzes.some(q => q.isSample)
      });

      res.json(response);
    } catch (error) {
      logger.error('Failed to get course quizzes:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve course quizzes'
      });
    }
  }

  // Enhanced quiz submission with auto-grading and direct grade saving
  async submitQuiz(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id: courseId, quizId } = req.params;
      const { answers, timeSpent = 0, metadata = {} } = req.body;
      
      logger.info('Quiz submission received:', { 
        courseId, 
        quizId, 
        userId: req.user?.id,
        answersCount: answers ? answers.length : 0,
        timeSpent
      });
      
      // Basic validation
      if (!courseId || !quizId) {
        res.status(400).json({
          success: false,
          error: 'Course ID and Quiz ID are required'
        });
        return;
      }

      if (!answers || !Array.isArray(answers)) {
        res.status(400).json({
          success: false,
          error: 'Answers are required and must be an array'
        });
        return;
      }

      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      // Get course and quiz data
      const course = await courseModel.findById(courseId);
      if (!course) {
        res.status(404).json({
          success: false,
          error: 'Course not found'
        });
        return;
      }

      // Find quiz in course structure or use sample quiz
      let quiz: any = null;
      let lessonId: string | undefined;
      let sectionId: string | undefined;

      // Search in course sections for the quiz
      if (course.sections) {
        for (const section of course.sections) {
          if (section.lessons) {
            for (const lesson of section.lessons) {
              if (lesson.quiz && lesson.quiz.id === quizId) {
                  quiz = lesson.quiz;
                  lessonId = lesson.id;
                  sectionId = section.id;
                  break;
                }
              }
          }
          
          if (section.moduleQuiz && section.moduleQuiz.id === quizId) {
            quiz = section.moduleQuiz;
                    sectionId = section.id;
                    break;
                  }
        }
      }

      // Check final assessment
      if (!quiz && course.finalAssessment && course.finalAssessment.id === quizId) {
          quiz = course.finalAssessment;
      }

      // Generate sample quiz if not found (for demo purposes)
      if (!quiz && quizId.startsWith('sample_')) {
        quiz = this.generateSampleQuiz(quizId, course);
      }

      if (!quiz) {
        res.status(404).json({
          success: false,
          error: 'Quiz not found'
        });
        return;
      }

      // Check enrollment (allow for free courses)
      let enrollment = await enrollmentModel.findByUserAndCourse(req.user.id, courseId);
      if (!enrollment && course.price > 0) {
        res.status(403).json({
          success: false,
          error: 'You must be enrolled to take this quiz'
        });
        return;
      }

      // Check attempt limits
      const existingProgress = await progressModel.findByUserAndCourse(req.user.id, courseId);
      const existingQuizScore = existingProgress?.quizScores?.[quizId];
      const maxAttempts = quiz.settings?.maxAttempts || quiz.maxAttempts || 3;
      
      if (existingQuizScore && existingQuizScore.totalAttempts >= maxAttempts) {
        res.status(400).json({
          success: false,
          error: `Maximum attempts (${maxAttempts}) reached for this quiz`,
          data: {
            currentAttempts: existingQuizScore.totalAttempts,
            maxAttempts,
            bestScore: existingQuizScore.bestPercentage || 0
          }
        });
        return;
      }

      // Validate answers match quiz questions
      const questionMap = new Map();
      quiz.questions.forEach((question: any) => {
        questionMap.set(question.id, question);
      });

      const missingQuestions = quiz.questions.filter((q: any) => 
        !answers.some((a: any) => a.questionId === q.id)
      );

      if (missingQuestions.length > 0) {
        res.status(400).json({
          success: false,
          error: `Missing answers for ${missingQuestions.length} question(s)`
        });
        return;
      }

      // Auto-grade quiz using preset correct answers
      const gradingResponse = await quizGradingService.gradeQuiz(
        quiz.questions,
        answers.map((answer: any) => ({
          questionId: answer.questionId,
          answer: answer.answer,
          timeSpent: answer.timeSpent || 0,
          hintsUsed: answer.hintsUsed || 0,
          confidence: answer.confidence || 3
        })),
        {
          passingScore: quiz.settings?.passingScore || quiz.passingScore || 70,
          showCorrectAnswers: quiz.settings?.showCorrectAnswers ?? true
        }
      );

      const { results, summary } = gradingResponse;
      const { 
        totalQuestions, 
        correctAnswers, 
        percentage: score, 
        passed, 
        passingScore,
        totalPoints,
        maxPossiblePoints,
        letterGrade,
        feedback
      } = summary;

      // Log grading results
      logger.info('Quiz auto-graded successfully:', {
        courseId,
        quizId,
        userId: req.user.id,
        score,
        passed,
        totalPoints,
        maxPossiblePoints,
        attemptNumber: (existingQuizScore?.totalAttempts || 0) + 1
      });

      // Save quiz score to user progress (auto-save to account)
      try {
        logger.info('Saving quiz score to CouchDB:', {
          userId: req.user.id,
          courseId,
          quizId,
          score: totalPoints,
          percentage: score,
          passed
        });

        const progressUpdateResult = await progressModel.updateQuizScore(
          req.user.id,
          courseId,
          quizId,
          {
            score: totalPoints,
            maxScore: maxPossiblePoints,
            percentage: score,
            passed,
            answers: results,
            submittedAt: new Date().toISOString()
          }
        );

        // Verify the save was successful by checking the returned progress
        if (!progressUpdateResult || !progressUpdateResult.quizScores || !progressUpdateResult.quizScores[quizId]) {
          throw new Error('Quiz score was not properly saved to progress');
        }

        // If quiz passed, mark lesson as complete
        if (passed && lessonId) {
          try {
          await progressModel.completeLesson(req.user.id, courseId, lessonId);
            logger.info('Lesson marked as complete after quiz pass:', { lessonId });
          } catch (lessonError) {
            logger.warn('Failed to mark lesson complete but quiz score saved:', { lessonId, error: lessonError });
          }
        }

        logger.info('Quiz grade successfully saved to CouchDB:', {
            userId: req.user.id,
            courseId,
          quizId,
          score,
          passed,
          quizScoreId: progressUpdateResult.quizScores[quizId]?.attempts?.length || 0,
          totalAttempts: progressUpdateResult.quizScores[quizId]?.totalAttempts || 0
          });
      } catch (progressError) {
        logger.error('Critical: Failed to save quiz grade to CouchDB:', {
          userId: req.user.id,
          courseId,
          quizId,
          error: progressError,
          stack: progressError instanceof Error ? progressError.stack : undefined
        });
        
        res.status(500).json({
          success: false,
          error: 'Failed to save quiz results to your account. Please try again.',
          details: 'Quiz was graded but could not be saved'
        });
        return;
      }

      // Prepare response with clean navigation
      const response = {
        success: true,
        data: {
          // Quiz results
          score,
          passed,
          correctAnswers,
          totalQuestions,
          results: quiz.settings?.showCorrectAnswers ? results : results.map(r => ({
            questionId: r.questionId,
            userAnswer: r.userAnswer,
            isCorrect: r.isCorrect,
            points: r.points,
            timeSpent: r.timeSpent
          })),
          
          // Grading details
          grading: {
            autoGraded: true,
            gradedAt: new Date().toISOString(),
            totalPoints,
            maxPossiblePoints,
            letterGrade,
            feedback: feedback.overall,
            performance: feedback.performance,
            suggestions: feedback.suggestions,
            passingScore,
            showCorrectAnswers: quiz.settings?.showCorrectAnswers ?? true,
            allowRetake: !passed && (existingQuizScore?.totalAttempts || 0) + 1 < maxAttempts
          },
          
          // Quiz metadata
          quiz: {
            id: quiz.id,
            title: quiz.title,
            description: quiz.description,
            maxAttempts,
            currentAttempt: (existingQuizScore?.totalAttempts || 0) + 1
          },
          
          // Submission metadata
          metadata: {
            timeSpent,
            submittedAt: new Date().toISOString(),
            lessonId,
            sectionId,
            gradeSavedToAccount: true, // Indicate grade was saved
            ...metadata
          }
        }
      };

      res.json(response);
    } catch (error) {
      logger.error('Quiz submission failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to submit quiz. Please try again.'
      });
    }
  }

  // Helper method to generate sample quiz for demo
  private generateSampleQuiz(quizId: string, course: any): any {
    if (quizId.includes('final')) {
      return {
        id: quizId,
        title: 'Final Course Assessment',
        description: 'Comprehensive assessment covering all course material',
        questions: [
          {
            id: 'final_q1',
            type: 'multiple-choice',
            question: 'Which of the following best summarizes the main concepts of this course?',
            points: 2,
            options: [
              { id: 'a', text: 'Basic theoretical concepts only' },
              { id: 'b', text: 'Practical application and understanding' },
              { id: 'c', text: 'Historical background only' },
              { id: 'd', text: 'Advanced research topics' }
            ],
            correctAnswer: 'b',
            explanation: 'This course focuses on practical application and deep understanding of concepts.'
          },
          {
            id: 'final_q2',
            type: 'true-false',
            question: 'The concepts learned in this course can be applied in real-world scenarios.',
            points: 1,
            correctAnswer: 'true',
            explanation: 'Yes, the course is designed to provide practical, applicable knowledge.'
          }
        ],
        settings: {
          passingScore: 70,
          maxAttempts: 3,
          showCorrectAnswers: true,
          showScoreImmediately: true
        }
      };
    } else {
      // Module quiz
      const moduleNumber = quizId.match(/\d+/)?.[0] || '1';
      return {
        id: quizId,
        title: `Module ${moduleNumber} Quiz`,
        description: `Test your understanding of Module ${moduleNumber} concepts`,
        questions: [
          {
            id: `q${moduleNumber}_1`,
            type: 'multiple-choice',
            question: `What is the main focus of Module ${moduleNumber}?`,
            points: 1,
            options: [
              { id: 'a', text: 'Introduction to basic concepts' },
              { id: 'b', text: 'Advanced practical applications' },
              { id: 'c', text: 'Historical background' },
              { id: 'd', text: 'Research methodologies' }
            ],
            correctAnswer: 'a',
            explanation: 'Module focuses on introducing and understanding basic concepts.'
          },
          {
            id: `q${moduleNumber}_2`,
            type: 'true-false',
            question: `Module ${moduleNumber} builds upon previous knowledge.`,
            points: 1,
            correctAnswer: moduleNumber === '1' ? 'false' : 'true',
            explanation: moduleNumber === '1' 
              ? 'Module 1 is introductory and standalone.' 
              : 'Yes, each module builds upon previous knowledge.'
          }
        ],
        settings: {
          passingScore: 70,
          maxAttempts: 3,
          showCorrectAnswers: true,
          showScoreImmediately: true
        }
      };
    }
  }

  // Get quiz attempts status for a specific quiz
  async getQuizAttempts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id: courseId, quizId } = req.params;
      
      if (!courseId || !quizId) {
        res.status(400).json({
          success: false,
          error: 'Course ID and Quiz ID are required'
        });
        return;
      }

      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      // Get user progress
      const progress = await progressModel.findByUserAndCourse(req.user.id, courseId);
      const quizScore = progress?.quizScores?.[quizId];
      
      const maxAttempts = 3; // Fixed to exactly 3 attempts as requested
      const currentAttempts = quizScore?.totalAttempts || 0;
      const remainingAttempts = Math.max(0, maxAttempts - currentAttempts);
      const canTakeQuiz = remainingAttempts > 0;
      
      logger.info('Quiz attempts status requested:', {
        userId: req.user.id,
        courseId,
        quizId,
        currentAttempts,
        maxAttempts,
        remainingAttempts,
        canTakeQuiz
      });

      const response: ApiResponse = {
        success: true,
        data: {
          quizId,
          currentAttempts,
          maxAttempts,
          remainingAttempts,
          canTakeQuiz,
          bestScore: quizScore?.bestPercentage || 0,
          bestAttempt: quizScore?.attempts && quizScore.attempts.length > 0 ? 
            quizScore.attempts.reduce((best, current) => 
              current.percentage > (best?.percentage || 0) ? current : best) : null,
          lastAttempt: quizScore?.attempts && quizScore.attempts.length > 0 ? 
            quizScore.attempts[quizScore.attempts.length - 1] : null,
          passed: quizScore?.passed || false,
          attempts: quizScore?.attempts || []
        }
      };

      res.json(response);
    } catch (error) {
      logger.error('Failed to get quiz attempts status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve quiz attempts status'
      });
    }
  }

  // Get comprehensive grades and assessment results for a course
  async getCourseGrades(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id: courseId } = req.params;
      
      if (!courseId) {
        res.status(400).json({
          success: false,
          error: 'Course ID is required'
        });
        return;
      }

      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      const userId = req.user.id || (req.user as any)._id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'User ID is required'
        });
        return;
      }

      logger.info('Fetching course grades:', { 
        courseId, 
        userId 
      });

      // Get course and user progress data
      const course = await courseModel.findById(courseId);
      const userProgress = await progressModel.findByUserAndCourse(userId, courseId);

      if (!course) {
        res.status(404).json({
          success: false,
          error: 'Course not found'
        });
        return;
      }

      // If no progress found, return empty grades
      if (!userProgress) {
        res.json({
          success: true,
          data: {
            grades: [],
            overallStats: {
              overallGrade: 0,
              gradeLetterEquivalent: 'F',
              totalTimeSpent: 0,
              modulesCompleted: 0,
              totalModules: 0,
              coursePassed: false,
              completionDate: null
            },
            courseTitle: course.title,
            lastUpdated: new Date().toISOString()
          }
        });
        return;
      }

      // Process quiz grades from user progress
      const grades: any[] = [];
      let totalTimeSpent = 0;
      let totalScore = 0;
      let totalMaxScore = 0;
      let quizCount = 0;

      // Safely process quiz scores
      if (userProgress.quizScores && typeof userProgress.quizScores === 'object') {
        for (const [quizId, quizScoreData] of Object.entries(userProgress.quizScores)) {
          try {
            // Type-safe quiz score processing
            const quizScore = quizScoreData as any;
            
            if (!quizScore || typeof quizScore !== 'object') {
              logger.warn('Invalid quiz score data:', { quizId, quizScore });
              continue;
            }

            if ((quizScore.totalAttempts || 0) > 0) {
              // Get quiz details from course structure
              let quizTitle = 'Quiz';
              let moduleTitle = '';
              let quizType: 'module' | 'final' = 'module';

              // Find quiz in course structure
              if (course.sections && Array.isArray(course.sections)) {
                let found = false;
                for (const section of course.sections) {
                  if (found) break;
                  
                  if (section.lessons && Array.isArray(section.lessons)) {
                    for (const lesson of section.lessons) {
                      if (lesson.quiz && lesson.quiz.id === quizId) {
                        quizTitle = lesson.quiz.title || lesson.title || 'Module Quiz';
                        moduleTitle = section.title || 'Module';
                        quizType = 'module';
                        found = true;
              break;
            }
          }
                  }
                  
                  if (section.moduleQuiz && section.moduleQuiz.id === quizId) {
                    quizTitle = section.moduleQuiz.title || `${section.title} Assessment`;
                    moduleTitle = section.title || 'Module';
                    quizType = 'module';
                    found = true;
                  }
                }
              }

              // Check final assessment
              if (course.finalAssessment && course.finalAssessment.id === quizId) {
                quizTitle = course.finalAssessment.title || 'Final Assessment';
                moduleTitle = 'Final Assessment';
                quizType = 'final';
              }

              // Handle sample quizzes
              if (quizId.startsWith('sample_')) {
                if (quizId.includes('final')) {
                  quizTitle = 'Final Course Assessment';
                  moduleTitle = 'Final Assessment';
                  quizType = 'final';
                } else {
                  const moduleNumber = quizId.match(/\d+/)?.[0] || '1';
                  quizTitle = `Module ${moduleNumber} Quiz`;
                  moduleTitle = `Module ${moduleNumber}`;
                  quizType = 'module';
                }
              }

              // Get best attempt safely
              let bestAttempt: any = {};
              if (quizScore.attempts && Array.isArray(quizScore.attempts) && quizScore.attempts.length > 0) {
                bestAttempt = quizScore.attempts.reduce((best: any, current: any) => 
                  (current && current.percentage > (best?.percentage || 0)) ? current : best
                );
      }

              // Calculate time spent (convert seconds to minutes) safely
              const timeSpentMinutes = Math.round((bestAttempt.timeSpent || 0) / 60);
              totalTimeSpent += timeSpentMinutes;

              // Get best score safely
              const bestScore = quizScore.bestScore || quizScore.bestPercentage || 0;
              const percentage = Math.round(bestScore);

              // Add to totals for overall calculation
              totalScore += percentage;
              totalMaxScore += 100; // Assuming 100 is max score
              quizCount++;

              grades.push({
                id: quizId,
                quizTitle,
                moduleTitle,
                type: quizType,
                score: percentage,
                maxScore: 100,
                percentage,
                passingScore: 70, // Default passing score
                passed: (quizScore.passed || false) || percentage >= 70,
                attempts: quizScore.totalAttempts || 0,
                completedAt: bestAttempt.completedAt || bestAttempt.submittedAt || new Date().toISOString(),
                timeSpent: timeSpentMinutes
              });
            }
          } catch (quizError) {
            logger.error('Error processing quiz score:', { quizId, error: quizError });
            continue; // Skip this quiz and continue with others
          }
        }
      }

      // Calculate overall stats
      const overallGrade = quizCount > 0 ? Math.round(totalScore / quizCount) : 0;
      const moduleGrades = grades.filter(g => g.type === 'module');
      const finalGrade = grades.find(g => g.type === 'final');
      
      const overallStats = {
        overallGrade,
        gradeLetterEquivalent: this.getLetterGrade(overallGrade),
        totalTimeSpent,
        modulesCompleted: moduleGrades.filter(g => g.passed).length,
        totalModules: moduleGrades.length,
        coursePassed: overallGrade >= 70,
        completionDate: finalGrade?.completedAt || null
      };

      logger.info('Course grades fetched successfully:', {
        courseId,
        userId: req.user.id,
        totalGrades: grades.length,
        overallGrade,
        coursePassed: overallStats.coursePassed
      });

      res.json({
        success: true,
        data: {
          grades,
          overallStats,
          courseTitle: course.title,
          lastUpdated: new Date().toISOString()
            }
      });

    } catch (error) {
      logger.error('Failed to fetch course grades:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to load grades'
      });
    }
  }

  // Helper method to get letter grade
  private getLetterGrade(percentage: number): string {
    if (percentage >= 90) return 'A';
    if (percentage >= 80) return 'B';
    if (percentage >= 70) return 'C';
    if (percentage >= 60) return 'D';
    return 'F';
  }

  // Get course home/overview with enrollment status and progress
  async getCourseHome(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const courseId = req.params.id;
      
      if (!courseId) {
        res.status(400).json({
          success: false,
          error: 'Course ID is required'
        });
        return;
      }

      // Get course details
      const course = await courseModel.findById(courseId);
      if (!course) {
        res.status(404).json({
          success: false,
          error: 'Course not found'
        });
        return;
      }

      let isEnrolled = false;
      let enrollment = null;
      let progress = null;
      let recentActivity: Array<{
        type: string;
        title: string;
        date: string;
        sectionTitle?: string;
        score?: number;
        passed?: boolean;
      }> = [];
      let canEnroll = true;
      let enrollmentError = null;

      // If user is authenticated, get enrollment and progress info
      if (req.user) {
        try {
          enrollment = await enrollmentModel.findByUserAndCourse(req.user.id, courseId);
          isEnrolled = !!enrollment;

          if (isEnrolled) {
            progress = await progressModel.findByUserAndCourse(req.user.id, courseId);
            
            // Get recent activity from progress
            if (progress) {
              // Recent lesson completions
              const recentLessons = progress.completedLessons.slice(-5);
              for (const lessonId of recentLessons) {
                // Find lesson details
                for (const section of course.sections || []) {
                  const lesson = section.lessons?.find(l => l.id === lessonId);
                  if (lesson) {
                    const completionDate = progress.lessonProgress?.[lessonId]?.completedAt || progress.lastWatched || new Date().toISOString();
                    recentActivity.push({
                      type: 'lesson_completed',
                      title: `Completed: ${lesson.title}`,
                      date: completionDate,
                      sectionTitle: section.title
                    });
                    break;
                  }
                }
              }

              // Recent quiz attempts
              const quizScores = progress.quizScores || {};
              for (const [quizId, quizData] of Object.entries(quizScores)) {
                if (quizData.attempts && quizData.attempts.length > 0) {
                  const lastAttempt = quizData.attempts[quizData.attempts.length - 1];
                  if (lastAttempt) {
                    recentActivity.push({
                      type: 'quiz_attempted',
                      title: `Quiz ${quizData.passed ? 'Passed' : 'Attempted'}: ${quizId}`,
                      date: lastAttempt.completedAt || new Date().toISOString(),
                      score: lastAttempt.percentage || 0,
                      passed: quizData.passed
                    });
                  }
                }
              }

              // Sort by date (most recent first)
              recentActivity.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
              recentActivity = recentActivity.slice(0, 10); // Latest 10 activities
            }
          } else if (req.user.role === 'learner') {
            // Check if can enroll
            if (course.status !== 'published') {
              canEnroll = false;
              enrollmentError = 'Course is not yet available for enrollment';
            }
          }
        } catch (error) {
          logger.warn('Failed to get enrollment/progress info:', error);
        }
      }

      // Calculate course statistics
      const totalSections = course.sections?.length || 0;
      const totalLessons = course.totalLessons || 0;
      const totalDuration = course.totalDuration || 0;
      
      // Count quizzes and assignments
      let totalQuizzes = 0;
      let totalAssignments = 0;
      
      for (const section of course.sections || []) {
        for (const lesson of section.lessons || []) {
          if (lesson.quiz) totalQuizzes++;
          if (lesson.assignment) totalAssignments++;
        }
      }

      // Progress information
      const progressInfo = progress ? {
        percentage: totalLessons > 0 ? Math.round((progress.completedLessons.length / totalLessons) * 100) : 0,
        completedLessons: progress.completedLessons.length,
        totalLessons,
        timeSpent: progress.timeSpent,
        currentLesson: progress.currentLesson,
        lastAccessed: progress.lastWatched || enrollment?.lastAccessedAt,
        nextLesson: null as any, // Will be calculated
        estimatedTimeToComplete: totalDuration - (progress.timeSpent || 0)
      } : null;

      // Find next lesson to continue
      if (progressInfo && course.sections) {
        for (const section of course.sections) {
          for (const lesson of section.lessons || []) {
            if (!progress?.completedLessons.includes(lesson.id)) {
              progressInfo.nextLesson = {
                id: lesson.id,
                title: lesson.title,
                sectionTitle: section.title,
                type: lesson.type,
                duration: lesson.estimatedDuration
              };
              break;
            }
          }
          if (progressInfo.nextLesson) break;
        }
      }

      // Course features
      const features = {
        hasVideo: course.contentFlags?.hasVideo || totalLessons > 0,
        hasQuizzes: course.contentFlags?.hasQuizzes || totalQuizzes > 0,
        hasAssignments: course.contentFlags?.hasAssignments || totalAssignments > 0,

        hasDiscussions: false, // Placeholder
        downloadableContent: false, // Placeholder
        offlineAccess: false // Placeholder
      };

      // Learning path preview (first few sections)
      const learningPath = course.sections?.slice(0, 3).map(section => ({
        id: section.id,
        title: section.title,
        lessonsCount: section.lessons?.length || 0,
        duration: section.estimatedDuration,
        isCompleted: progress?.completedSections.includes(section.id) || false,
        isLocked: false // TODO: Implement prerequisites logic
      })) || [];

      logger.info('Course home data fetched:', {
        courseId,
        userId: req.user?.id || 'anonymous',
        isEnrolled,
        progressPercentage: progressInfo?.percentage || 0
      });

      const response: ApiResponse = {
        success: true,
        data: {
          // Course basic info
          course: {
            id: course._id || course.id,
            title: course.title,
            description: course.description,
            shortDescription: course.shortDescription,
            thumbnail: course.thumbnail,
            previewVideo: course.previewVideo,
            instructorName: course.instructorName,
            category: course.category,
            level: course.level,
            language: course.language,
            tags: course.tags,
            rating: course.rating,
            enrollmentCount: course.enrollmentCount,
            status: course.status,
            createdAt: course.createdAt,
            updatedAt: course.updatedAt
          },

          // Course statistics
          statistics: {
            totalSections,
            totalLessons,
            totalQuizzes,
            totalAssignments,
            totalDuration,
            difficultyLevel: course.level,
            estimatedCompletionTime: Math.ceil(totalDuration / 3600) // in hours
          },

          // Enrollment status
          enrollment: {
            isEnrolled,
            canEnroll: canEnroll && !isEnrolled,
            enrollmentError,
            status: enrollment?.status || null,
            enrolledAt: enrollment?.enrolledAt || null,
            lastAccessed: enrollment?.lastAccessedAt || null
          },

          // Progress information (only if enrolled)
          progress: progressInfo,

          // Recent activity (only if enrolled)
          recentActivity: isEnrolled ? recentActivity : [],

          // Course features and content flags
          features,

          // Learning path preview
          learningPath,

          // Learning objectives
          learningObjectives: course.learningObjectives || [],

          // Prerequisites
          requirements: course.requirements || [],

          // What you'll learn section
          whatYoullLearn: course.learningObjectives?.slice(0, 4) || [],

          // Instructor information
          instructor: {
            name: course.instructorName,
            id: course.instructorId,
            // TODO: Add more instructor details from user model
          },

          // Course access information
          access: {
            isPublished: course.status === 'published',
            isPreview: !isEnrolled, // Can preview some content
            requiresEnrollment: !isEnrolled && req.user?.role === 'learner',
            isInstructor: req.user?.id === course.instructorId,
            isAdmin: req.user?.role === 'admin'
          }
        }
      };

      res.json(response);
    } catch (error) {
      logger.error('Failed to get course home data:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve course home data'
      });
    }
  }

  // Get course progress
  async getCourseProgress(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const courseId = req.params.id;
      
      if (!courseId) {
        res.status(400).json({
          success: false,
          error: 'Course ID is required'
        });
        return;
      }

      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      const progress = await progressModel.findByUserAndCourse(req.user.id, courseId);
      const course = await courseModel.findById(courseId);
      
      const totalLessons = course?.totalLessons || 0;
      const completedLessons = progress?.completedLessons.length || 0;
      const progressPercentage = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

      const response: ApiResponse = {
        success: true,
        data: {
          courseId,
          progress: progressPercentage,
          completedLessons,
          totalLessons,
          timeSpent: progress?.timeSpent || 0,
          currentLesson: progress?.currentLesson,
          lastWatched: progress?.lastWatched
        }
      };

      res.json(response);
    } catch (error) {
      logger.error('Failed to get course progress:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve course progress'
      });
    }
  }

  // Update course progress
  async updateCourseProgress(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const courseId = req.params.id;
      const { progress } = req.body;

      if (!courseId) {
        res.status(400).json({
          success: false,
          error: 'Course ID is required'
        });
        return;
      }

      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      const progressRecord = await progressModel.getOrCreateProgress(req.user.id, courseId);
      
      // Update enrollment progress if it exists
      try {
        const enrollment = await enrollmentModel.findByUserAndCourse(req.user.id, courseId);
        if (enrollment) {
          await enrollmentModel.updateProgress(enrollment._id!, progress);
        }
      } catch (enrollmentError) {
        logger.warn('Failed to update enrollment progress:', enrollmentError);
      }

      const response: ApiResponse = {
        success: true,
        message: 'Course progress updated successfully',
        data: {
          courseId,
          progress,
          progressRecord
        }
      };

      res.json(response);
    } catch (error) {
      logger.error('Failed to update course progress:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update course progress'
      });
    }
  }

  // Update lesson progress - Enhanced with comprehensive tracking
  async updateLessonProgress(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id: courseId, lessonId } = req.params;
      const { 
        timeSpent = 0, 
        currentPosition = 0, 
        percentageWatched = 0,
        interactions = [],
        notes = [],
        bookmarks = [],
        isCompleted = false
      } = req.body;

      if (!courseId || !lessonId) {
        res.status(400).json({
          success: false,
          error: 'Course ID and Lesson ID are required'
        });
        return;
      }

      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      logger.info('Updating lesson progress:', {
        userId: req.user.id,
        courseId,
        lessonId,
        timeSpent,
        currentPosition,
        percentageWatched,
        isCompleted
      });

      // Get or create progress record
      const progress = await progressModel.getOrCreateProgress(req.user.id, courseId);

      // Update lesson-specific progress
      const existingLessonProgress = progress.lessonProgress?.[lessonId] || {
        timeSpent: 0,
        interactions: [],
        notes: [],
        bookmarks: [],
        startedAt: new Date().toISOString()
      };
      
      // Add video progress interaction if provided
      const videoProgressInteraction = percentageWatched > 0 ? {
        type: 'video_progress',
        timestamp: new Date().toISOString(),
        data: {
          currentPosition,
          percentageWatched,
          duration: req.body.duration || 0
        }
      } : null;
      
      const updatedInteractions = [
        ...(existingLessonProgress.interactions || []),
        ...interactions,
        ...(videoProgressInteraction ? [videoProgressInteraction] : [])
      ];
      
      const updatedLessonProgress = {
        ...existingLessonProgress,
        timeSpent: Math.max(existingLessonProgress.timeSpent || 0, timeSpent),
        lastPosition: currentPosition,
        interactions: updatedInteractions,
        notes: [...(existingLessonProgress.notes || []), ...notes],
        bookmarks: [...(existingLessonProgress.bookmarks || []), ...bookmarks],
        startedAt: existingLessonProgress.startedAt || new Date().toISOString(),
        ...(isCompleted && { completedAt: new Date().toISOString() })
      };

      // Mark lesson as completed if criteria met
      if (isCompleted || percentageWatched >= 90) {
        if (!progress.completedLessons.includes(lessonId)) {
          progress.completedLessons.push(lessonId);
          updatedLessonProgress.completedAt = new Date().toISOString();
        }
      }

      // Update the progress record
      const updatedProgress = await progressModel.update(progress._id!, {
        lessonProgress: {
          ...progress.lessonProgress,
          [lessonId]: updatedLessonProgress
        },
        completedLessons: progress.completedLessons,
        timeSpent: progress.timeSpent + timeSpent,
        currentLesson: lessonId,
        lastWatched: new Date().toISOString()
      } as Partial<Progress>);

      // Calculate overall course progress
      const course = await courseModel.findById(courseId);
      const totalLessons = course?.totalLessons || 0;
      const completedLessons = progress.completedLessons.length;
      const progressPercentage = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

      // Update enrollment progress
      try {
        const enrollment = await enrollmentModel.findByUserAndCourse(req.user.id, courseId);
        if (enrollment) {
          await enrollmentModel.updateProgress(enrollment._id!, progressPercentage);
        }
      } catch (enrollmentError) {
        logger.warn('Failed to update enrollment progress:', enrollmentError);
      }

      logger.info('Lesson progress updated successfully:', {
        userId: req.user.id,
        courseId,
        lessonId,
        overallProgress: progressPercentage,
        lessonCompleted: progress.completedLessons.includes(lessonId)
      });

      const response: ApiResponse = {
        success: true,
        message: 'Lesson progress updated successfully',
        data: {
          courseId,
          lessonId,
          progress: progressPercentage,
          completedLessons,
          totalLessons,
          timeSpent,
          currentPosition,
          percentageWatched,
          isCompleted: progress.completedLessons.includes(lessonId),
          lessonProgress: updatedLessonProgress
        }
      };

      res.json(response);
    } catch (error) {
      logger.error('Failed to update lesson progress:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update lesson progress'
      });
    }
  }

  // Mark lesson as complete
  async completeLessonProgress(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id: courseId, lessonId } = req.params;
      
      if (!courseId || !lessonId) {
        res.status(400).json({
          success: false,
          error: 'Course ID and Lesson ID are required'
        });
        return;
      }

      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      // Mark lesson as complete
      const progress = await progressModel.completeLesson(req.user.id, courseId, lessonId);
      
      // Update current lesson
      await progressModel.updateCurrentLesson(req.user.id, courseId, lessonId);

      // Calculate overall progress
      const course = await courseModel.findById(courseId);
      const totalLessons = course?.totalLessons || 0;
      const completedLessons = progress.completedLessons.length;
      const progressPercentage = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

      // Update enrollment progress
      try {
        const enrollment = await enrollmentModel.findByUserAndCourse(req.user.id, courseId);
        if (enrollment) {
          await enrollmentModel.updateProgress(enrollment._id!, progressPercentage);
        }
      } catch (enrollmentError) {
        logger.warn('Failed to update enrollment progress:', enrollmentError);
      }

      const response: ApiResponse = {
        success: true,
        message: 'Lesson marked as complete',
        data: {
          courseId,
          lessonId,
          progress: progressPercentage,
          completedLessons,
          totalLessons
        }
      };

      res.json(response);
    } catch (error) {
      logger.error('Failed to mark lesson as complete:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to mark lesson as complete'
      });
    }
  }
}

export const courseController = new CourseController();
export default courseController; 