import { Router, Request, Response } from 'express';
import { courseModel } from '../models/Course';
import { enrollmentModel } from '../models/Enrollment';
import { progressModel } from '../models/Progress';
import { authenticate, authorize, optionalAuth } from '../middleware/auth';
import { logger } from '../utils/logger';
import { uploadCourseMedia, handleUploadError } from '../middleware/fileUpload';
import { Progress } from '../types';
import { 
  normalizeCourseResponse,
  handleCourseFormData
} from './compatibility';
import { quizGradingService } from '../services/quizGradingService';

const router = Router();

// Get all published courses
router.get('/', optionalAuth, normalizeCourseResponse, async (req: Request, res: Response) => {
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

    return res.json({
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
    });
  } catch (error) {
    logger.error('Failed to get courses:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve courses'
    });
  }
});

// Get single course by ID
router.get('/:id', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { id: courseId } = req.params;

    if (!courseId) {
      return res.status(400).json({
        success: false,
        error: 'Course ID is required'
      });
    }

    const course = await courseModel.findById(courseId);
    if (!course) {
      return res.status(404).json({
      success: false,
        error: 'Course not found'
      });
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

    return res.json({
      success: true,
      data: {
        course,
        isEnrolled,
        enrollmentId,
        enrollment // Include full enrollment data with completion status
      }
    });
  } catch (error) {
    logger.error('Failed to get course:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve course'
    });
  }
});

// Create new course (tutors only)
router.post('/', 
  authenticate, 
  authorize('tutor', 'admin'), 
  uploadCourseMedia, 
  handleUploadError, 
  handleCourseFormData, 
  normalizeCourseResponse,
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
      success: false,
          error: 'Authentication required'
        });
      }

      const courseData = {
        ...req.body,
        instructorId: req.user.id,
        instructorName: req.user.name || req.user.email || 'Unknown Instructor',
        status: 'draft' as const,
        enrollmentCount: 0,
        type: 'course' as const
      };

      const course = await courseModel.create(courseData);

      logger.info('Course created:', {
        courseId: course._id,
        title: course.title,
        instructorId: req.user.id
      });

      return res.status(201).json({
      success: true,
      data: {
          course,
          message: 'Course created successfully'
        }
    });
  } catch (error) {
      logger.error('Failed to create course:', error);
    return res.status(500).json({
      success: false,
        error: error instanceof Error ? error.message : 'Failed to create course'
      });
    }
  }
);

// Submit course for approval
router.post('/:id/submit', authenticate, authorize('tutor'), async (req: Request, res: Response) => {
  try {
    const { id: courseId } = req.params;
    
    if (!courseId) {
      return res.status(400).json({
        success: false,
        error: 'Course ID is required'
      });
    }

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
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

    return res.json({
      success: true,
      data: { 
        course,
        message: 'Course submitted for approval successfully'
      }
    });
  } catch (error) {
    logger.error('Failed to submit course:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to submit course'
    });
  }
});

// Get instructor courses
router.get('/instructor/my-courses', 
  authenticate, 
  authorize('tutor', 'admin'), 
  normalizeCourseResponse, 
  async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
          error: 'Authentication required'
        });
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      // Get all courses and filter by instructor
      const result = await courseModel.findAll({
        limit,
        skip: (page - 1) * limit
      });

      const instructorCourses = result.docs.filter((course: any) => course.instructorId === req.user!.id);

    return res.json({
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
    });
  } catch (error) {
      logger.error('Failed to get instructor courses:', error);
    return res.status(500).json({
      success: false,
        error: 'Failed to retrieve courses'
      });
    }
  }
);

// Enroll in course
router.post('/:id/enroll', authenticate, authorize('learner', 'tutor', 'admin'), async (req: Request, res: Response) => {
  try {
    const { id: courseId } = req.params;
    
    if (!courseId) {
      return res.status(400).json({
        success: false,
        error: 'Course ID is required'
      });
    }

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Check if course exists and is published
    const course = await courseModel.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        error: 'Course not found'
      });
    }

    if (course.status !== 'published') {
      return res.status(400).json({
        success: false,
        error: 'Course is not available for enrollment'
      });
    }

        // Check if already enrolled
    const existingEnrollment = await enrollmentModel.findByUserAndCourse(req.user.id, courseId);
    if (existingEnrollment) {
      return res.json({
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
      });
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

    return res.status(201).json({
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
    });
  } catch (error) {
    logger.error('Failed to enroll in course:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to enroll in course'
    });
  }
});

// Get course content (basic version)
router.get('/:id/content', authenticate, async (req: Request, res: Response) => {
  try {
    const { id: courseId } = req.params;
    
    if (!courseId) {
      return res.status(400).json({
        success: false,
        error: 'Course ID is required'
      });
    }

    if (!req.user) {
      return res.status(401).json({
      success: false,
        error: 'Authentication required'
      });
    }

    const course = await courseModel.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        error: 'Course not found'
      });
    }

    // Get user progress if available
    let progress = null;
    try {
      progress = await progressModel.findByUserAndCourse(req.user.id, courseId);
    } catch (error) {
      // Ignore progress errors for now
    }

    return res.json({
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
    });
  } catch (error) {
    logger.error('Failed to get course content:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve course content'
    });
  }
});

// Get course quizzes/assessments
router.get('/:id/quizzes', authenticate, async (req: Request, res: Response) => {
  try {
    const courseId = req.params.id;
    
    if (!courseId) {
      return res.status(400).json({
        success: false,
        error: 'Course ID is required'
      });
    }

    const course = await courseModel.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        error: 'Course not found'
      });
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
        return res.status(403).json({
          success: false,
          error: 'Unable to access course quizzes. Please try again.'
        });
      }
    }
    
    // Allow access for active and completed enrollments
    if (enrollment.status !== 'active' && enrollment.status !== 'completed') {
      return res.status(403).json({
        success: false,
        error: 'Course access is suspended. Please contact support.'
      });
    }

    logger.info('Fetching quizzes for course:', { 
      courseId, 
      sectionsCount: course.sections?.length || 0,
      userId: req.user?.id,
      enrollmentStatus: enrollment.status
    });

    // Extract quizzes from course sections
    const quizzes: any[] = [];
    let totalLessonsChecked = 0;
    let quizzesFound = 0;
    
    if (course.sections && Array.isArray(course.sections)) {
      course.sections.forEach((section: any, sectionIndex: number) => {
        logger.info('Processing section:', { 
          sectionId: section.id, 
          sectionTitle: section.title,
          lessonsCount: section.lessons?.length || 0 
        });
        
        if (section.lessons && Array.isArray(section.lessons)) {
          section.lessons.forEach((lesson: any, lessonIndex: number) => {
            totalLessonsChecked++;
            
            logger.info('Checking lesson for quiz:', { 
              lessonId: lesson.id, 
              lessonTitle: lesson.title,
              hasQuiz: !!lesson.quiz,
              quizStructure: lesson.quiz ? {
                id: lesson.quiz.id,
                hasQuestions: !!lesson.quiz.questions,
                questionsCount: lesson.quiz.questions?.length || 0
              } : null
            });

            // Check multiple quiz structures
            if (lesson.quiz && lesson.quiz.questions && lesson.quiz.questions.length > 0) {
              quizzesFound++;
              const quizId = lesson.quiz.id || `${lesson.id}_quiz`;
              
              quizzes.push({
                id: quizId,
                type: 'lesson',
                title: lesson.quiz.title || `${lesson.title} Quiz`,
                description: lesson.quiz.description || `Quiz for ${lesson.title}`,
                questions: lesson.quiz.questions.map((q: any, qIndex: number) => ({
                  id: q.id || `q${qIndex}`,
                  type: q.type || 'multiple-choice',
                  question: q.questionText || q.question || q.text,
                  options: q.options || q.choices || [],
                  // Remove correctAnswer from frontend response for security
                  // correctAnswer is only used for backend auto-grading
                  explanation: q.explanation || '',
                  points: q.points || 1
                })),
                timeLimit: 0, // Make quizzes untimed
                passingScore: lesson.quiz.settings?.passingScore || 70,
                maxAttempts: 3, // Allow exactly 3 attempts as requested
                lessonId: lesson.id,
                sectionId: section.id,
                lessonTitle: lesson.title,
                sectionTitle: section.title,
                order: sectionIndex * 100 + lessonIndex
              });
              
              logger.info('Added quiz to list:', { 
                quizId, 
                questionsCount: lesson.quiz.questions.length,
                lessonTitle: lesson.title 
              });
            }
          });
        }
      });
    }

    // Process final assessment if exists
    if (course.finalAssessment && course.finalAssessment.questions && course.finalAssessment.questions.length > 0) {
      quizzesFound++;
      const finalAssessmentId = course.finalAssessment.id || `final-assessment-${course.id}`;
      
      quizzes.push({
        id: finalAssessmentId,
        type: 'final',
        title: course.finalAssessment.title || 'Final Assessment',
        description: course.finalAssessment.description || 'This comprehensive assessment covers all course material.',
        questions: course.finalAssessment.questions.map((q: any, qIndex: number) => ({
          id: q.id || `final-q${qIndex}`,
          type: q.type || 'multiple-choice',
          question: q.questionText || q.question || q.text,
          options: q.options || q.choices || [],
          // Remove correctAnswer from frontend response for security
          // correctAnswer is only used for backend auto-grading
          explanation: q.explanation || '',
          points: q.points || 1
        })),
        timeLimit: 0, // Make quizzes untimed
        passingScore: course.finalAssessment.settings?.passingScore || 70,
        maxAttempts: 3, // Allow exactly 3 attempts as requested
        lessonId: null,
        sectionId: null,
        lessonTitle: null,
        sectionTitle: null,
        order: 9999 // Final assessment comes last
      });
      
      logger.info('Added final assessment to quiz list:', { 
        finalAssessmentId, 
        questionsCount: course.finalAssessment.questions.length,
        title: course.finalAssessment.title
      });
    }

    logger.info('Quiz extraction complete:', { 
      courseId, 
      totalLessonsChecked,
      quizzesFound,
      finalQuizzesCount: quizzes.length 
    });

    return res.json({
      success: true,
      data: { 
        quizzes,
        totalQuizzes: quizzes.length,
        moduleQuizzes: quizzes.filter(q => q.type === 'lesson').length,
        finalAssessments: quizzes.filter(q => q.type === 'final').length,
        canTakeQuizzes: req.user?.role === 'learner',
        debug: {
          sectionsCount: course.sections?.length || 0,
          lessonsChecked: totalLessonsChecked,
          quizzesFound: quizzesFound
        }
      }
    });
  } catch (error) {
    logger.error('Failed to get course quizzes:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve course quizzes'
    });
  }
});

// Submit quiz - Enhanced with better validation and error handling
router.post('/:id/quizzes/:quizId/submit', authenticate, async (req: Request, res: Response) => {
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
    
    // Enhanced validation
    if (!courseId || !quizId) {
      return res.status(400).json({
        success: false,
        error: 'Course ID and Quiz ID are required'
      });
    }

    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({
        success: false,
        error: 'Answers are required and must be an array'
      });
    }

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Validate user enrollment - enhanced for free courses
    let enrollment = await enrollmentModel.findByUserAndCourse(req.user.id, courseId);
    
    // For free courses, auto-enroll users who try to access quizzes
    if (!enrollment) {
      try {
        logger.info('Auto-enrolling user for quiz access:', { userId: req.user.id, courseId });
        enrollment = await enrollmentModel.enrollUser(req.user.id, courseId);
        
        // Update course enrollment count
        await courseModel.updateEnrollmentCount(courseId, 1);
        
        logger.info('User auto-enrolled for quiz access:', { 
          userId: req.user.id, 
          courseId, 
          enrollmentId: enrollment._id 
        });
      } catch (enrollError) {
        logger.error('Failed to auto-enroll user for quiz:', { userId: req.user.id, courseId, error: enrollError });
        return res.status(403).json({
          success: false,
          error: 'Unable to access course quizzes. Please try again.'
        });
      }
    }
    
    // Allow access for active and completed enrollments
    if (enrollment.status !== 'active' && enrollment.status !== 'completed') {
      return res.status(403).json({
        success: false,
        error: 'Course access is suspended. Please contact support.'
      });
    }

    // Get quiz from course
    const course = await courseModel.findById(courseId);
    if (!course) {
      logger.error('Course not found for quiz submission:', { courseId });
      return res.status(404).json({
        success: false,
        error: 'Course not found'
      });
    }

    let quiz: any = null;
    let lessonId: string | null = null;
    let sectionId: string | null = null;

    // Enhanced quiz finding logic - handle both lesson.quiz and section.moduleQuiz patterns
    if (course.sections && Array.isArray(course.sections)) {
      for (const section of course.sections) {
        // Check section-level moduleQuiz first (legacy pattern)
        if (section.moduleQuiz) {
          const possibleQuizIds: string[] = [
            section.moduleQuiz.id,
            `${section.id}_quiz`,
            `quiz_${section.id}`,
            `module-quiz-${section.id}`,
            quizId
          ].filter(Boolean);
          
          if (possibleQuizIds.includes(quizId)) {
            quiz = section.moduleQuiz;
            lessonId = section.lessons?.[0]?.id || section.id;
            sectionId = section.id;
            logger.info('Found quiz in section moduleQuiz:', { 
              quizId, 
              foundQuizId: section.moduleQuiz.id,
              lessonId,
              sectionId: section.id
            });
            break;
          }
        }
        
        // Check lesson-level quiz (current pattern)
        if (section.lessons && Array.isArray(section.lessons)) {
          for (const lesson of section.lessons) {
            if (lesson.quiz) {
              const possibleQuizIds: string[] = [
                lesson.quiz.id,
                `${lesson.id}_quiz`,
                `quiz_${lesson.id}`,
                `module-quiz-${lesson.id}`,
                quizId
              ].filter(Boolean);
              
              if (possibleQuizIds.includes(quizId)) {
                quiz = lesson.quiz;
                lessonId = lesson.id;
                sectionId = section.id;
                logger.info('Found quiz in lesson:', { 
                  quizId, 
                  foundQuizId: lesson.quiz.id,
                  lessonId: lesson.id,
                  sectionId: section.id
                });
                break;
              }
            }
            
            // Pattern matching for generated quiz IDs
            if (quizId.startsWith('module-quiz-')) {
              const moduleId = quizId.replace('module-quiz-', '');
              if (lesson.id === moduleId || lesson.id === `lesson_${moduleId}`) {
                if (lesson.quiz) {
                  quiz = lesson.quiz;
                  lessonId = lesson.id;
                  sectionId = section.id;
                  logger.info('Found quiz by pattern match in lesson:', { 
                    quizId, 
                    moduleId,
                    lessonId: lesson.id,
                    sectionId: section.id
                  });
                  break;
                }
              }
            }
          }
          if (quiz) break;
        }
      }
    }

    // Check final assessment if not found in sections
    if (!quiz && course.finalAssessment) {
      const possibleFinalAssessmentIds: string[] = [
        course.finalAssessment.id,
        `final-assessment-${course.id}`,
        `final-assessment-${course._id}`,
        'final-assessment',
        quizId
      ].filter(Boolean);
      
      if (possibleFinalAssessmentIds.includes(quizId)) {
        quiz = course.finalAssessment;
        lessonId = null;
        sectionId = null;
        logger.info('Found final assessment:', { 
          quizId, 
          foundQuizId: course.finalAssessment.id,
          questionsCount: course.finalAssessment.questions?.length || 0
        });
      }
    }

    if (!quiz) {
      logger.error('Quiz not found in course:', { 
        courseId,
        quizId, 
        sectionsCount: course.sections?.length || 0,
        lessonsChecked: course.sections?.reduce((total, section) => total + (section.lessons?.length || 0), 0) || 0,
        availableLessons: course.sections?.flatMap(s => s.lessons || []).map(l => ({
          id: l.id,
          title: l.title,
          hasQuiz: !!l.quiz,
          quizId: l.quiz?.id
        })) || []
      });
      return res.status(404).json({
        success: false,
        error: 'Quiz not found in course'
      });
    }

    // Validate quiz has questions
    if (!quiz.questions || quiz.questions.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Quiz has no questions'
      });
    }

    // Check attempts limit - FIXED to exactly 3 attempts
    const progress = await progressModel.findByUserAndCourse(req.user.id, courseId);
    const existingQuizScore = progress?.quizScores?.[quizId];
    const maxAttempts = 3; // Fixed to exactly 3 attempts as requested
    
    if (existingQuizScore && existingQuizScore.totalAttempts >= maxAttempts) {
      logger.warn('User exceeded maximum quiz attempts:', {
        userId: req.user.id,
        courseId,
        quizId,
        currentAttempts: existingQuizScore.totalAttempts,
        maxAttempts
      });
      
      return res.status(400).json({
        success: false,
        error: `You have reached the maximum number of attempts (${maxAttempts}) for this quiz.`,
        data: {
          currentAttempts: existingQuizScore.totalAttempts,
          maxAttempts,
          bestScore: existingQuizScore.bestPercentage || 0,
          passed: existingQuizScore.passed || false
        }
      });
    }

    // Validate answers match quiz questions
    const questionMap = new Map();
    quiz.questions.forEach((question: any) => {
      questionMap.set(question.id, question);
    });

    // Check if all questions are answered
    const missingQuestions = quiz.questions.filter((q: any) => 
      !answers.some((a: any) => a.questionId === q.id)
    );

    if (missingQuestions.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Missing answers for ${missingQuestions.length} question(s)`,
        data: {
          missingQuestions: missingQuestions.map((q: any) => q.id)
        }
      });
    }

    // Check for invalid question IDs
    const invalidAnswers = answers.filter((a: any) => !questionMap.has(a.questionId));
    if (invalidAnswers.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Invalid question ID(s) in answers: ${invalidAnswers.map(a => a.questionId).join(', ')}`
      });
    }

    // Use enhanced grading service
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
        showCorrectAnswers: quiz.settings?.showCorrectAnswers ?? true,
        partialCreditEnabled: quiz.settings?.partialCredit ?? false,
        timeLimit: 0 // Remove time limit for untimed quizzes
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

    // Log comprehensive grading results
    logger.info('Quiz auto-grading completed:', {
      courseId,
      quizId,
      userId: req.user.id,
      totalQuestions,
      correctAnswers,
      score,
      totalPoints,
      maxPossiblePoints,
      letterGrade,
      passed,
      passingScore,
      timeSpent,
      attemptNumber: (existingQuizScore?.totalAttempts || 0) + 1,
      questionBreakdown: results.map(r => ({
        questionId: r.questionId,
        correct: r.isCorrect,
        points: r.points
      }))
    });

    // Update progress with enhanced data
    try {
      const updatedProgress = await progressModel.updateQuizScore(
        req.user.id,
        courseId,
        quizId,
        {
          score,
          maxScore: 100,
          percentage: score,
          passed,
          answers: results,
          submittedAt: new Date().toISOString()
        }
      );

      // If quiz passed, mark lesson as complete
      if (passed && lessonId) {
        await progressModel.completeLesson(req.user.id, courseId, lessonId);
        logger.info('Lesson marked complete after quiz pass:', {
          userId: req.user.id,
          courseId,
          lessonId,
          quizScore: score
        });
      }
    } catch (progressError) {
      logger.error('Failed to update quiz progress:', progressError);
      return res.status(500).json({
        success: false,
        error: 'Failed to save quiz progress'
      });
    }

    // Return enhanced response
    return res.json({
      success: true,
      data: {
        score,
        passed,
        correctAnswers,
        totalQuestions,
        results: quiz.settings?.showCorrectAnswers ? results : results.map(r => ({
          questionId: r.questionId,
          userAnswer: r.userAnswer,
          isCorrect: r.isCorrect,
          points: r.points,
          questionType: r.questionType,
          timeSpent: r.timeSpent
        })),
        passingScore,
        grading: {
          autoGraded: true,
          gradedAt: new Date().toISOString(),
          totalPoints,
          maxPossiblePoints,
          letterGrade,
          feedback: feedback.overall,
          detailedFeedback: feedback,
          showCorrectAnswers: quiz.settings?.showCorrectAnswers ?? true,
          allowRetake: !passed && (existingQuizScore?.totalAttempts || 0) + 1 < maxAttempts,
          difficultyAnalysis: summary.difficultyAnalysis,
          partiallyCorrect: summary.partiallyCorrect,
          averageTimePerQuestion: summary.averageTimePerQuestion
        },
        quiz: {
          id: quiz.id,
          title: quiz.title,
          description: quiz.description,
          timeLimit: 0, // All quizzes are untimed
          maxAttempts,
          currentAttempt: (existingQuizScore?.totalAttempts || 0) + 1
        },
        metadata: {
          timeSpent,
          submittedAt: new Date().toISOString(),
          lessonId,
          sectionId,
          ...metadata
        }
      }
    });
  } catch (error) {
    logger.error('Failed to submit quiz:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to submit quiz. Please try again.'
    });
  }
});

// Get quiz attempts status for a specific quiz
router.get('/:id/quizzes/:quizId/attempts', authenticate, async (req: Request, res: Response) => {
  try {
    const { id: courseId, quizId } = req.params;
    
    if (!courseId || !quizId) {
      return res.status(400).json({
        success: false,
        error: 'Course ID and Quiz ID are required'
      });
    }

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
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

    return res.json({
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
    });
  } catch (error) {
    logger.error('Failed to get quiz attempts status:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve quiz attempts status'
    });
  }
});

// Get comprehensive grades and assessment results for a course
router.get('/:id/grades', authenticate, async (req: Request, res: Response) => {
  try {
    const courseId = req.params.id;
    
    if (!courseId) {
      return res.status(400).json({
        success: false,
        error: 'Course ID is required'
      });
    }

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Get course details
    const course = await courseModel.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        error: 'Course not found'
      });
    }

    // Get user progress for grades
    const progress = await progressModel.findByUserAndCourse(req.user.id, courseId);
    const enrollment = await enrollmentModel.findByUserAndCourse(req.user.id, courseId);

    if (!enrollment) {
      return res.status(403).json({
        success: false,
        error: 'You must be enrolled in this course to view grades'
      });
    }

    // Compile quiz grades
    const quizGrades = [];
    const quizScores = progress?.quizScores || {};
    
    for (const [quizId, quizData] of Object.entries(quizScores)) {
      // Find quiz details in course structure
      let quizDetails = null;
      let sectionTitle = '';
      let lessonTitle = '';
      
      for (const section of course.sections || []) {
        for (const lesson of section.lessons || []) {
          if (lesson.quiz?.id === quizId || `module-quiz-${lesson.id}` === quizId) {
            quizDetails = lesson.quiz;
            sectionTitle = section.title;
            lessonTitle = lesson.title;
            break;
          }
        }
        if (quizDetails) break;
      }

      quizGrades.push({
        quizId,
        title: quizDetails?.title || `${lessonTitle} Quiz`,
        sectionTitle,
        lessonTitle,
        attempts: quizData.attempts || [],
        bestScore: quizData.bestScore || 0,
        bestPercentage: quizData.bestPercentage || 0,
        totalAttempts: quizData.totalAttempts || 0,
                 passed: quizData.passed || false,
         passingScore: quizDetails?.settings?.passingScore || 70,
         maxAttempts: quizDetails?.settings?.attempts || 3,
         canRetake: (quizData.totalAttempts || 0) < (quizDetails?.settings?.attempts || 3) && !quizData.passed,
                 lastAttemptDate: quizData.attempts && quizData.attempts.length > 0 
           ? quizData.attempts[quizData.attempts.length - 1]?.completedAt || null
           : null,
         timeSpent: quizData.attempts ? quizData.attempts.reduce((total: number, attempt: any) => total + (attempt.timeSpent || 0), 0) : 0
      });
    }

    // Compile assignment grades (placeholder for future implementation)
    const assignmentGrades = [];
    const assignments = progress?.assignments || {};
    
    for (const [assignmentId, assignmentData] of Object.entries(assignments)) {
      assignmentGrades.push({
        assignmentId,
        title: `Assignment ${assignmentId}`,
        currentGrade: assignmentData.currentGrade || 0,
        passed: assignmentData.passed || false,
        submissions: assignmentData.submissions || [],
        requiresResubmission: assignmentData.requiresResubmission || false,
                 lastSubmissionDate: assignmentData.submissions && assignmentData.submissions.length > 0
           ? assignmentData.submissions[assignmentData.submissions.length - 1]?.submittedAt || null
           : null
      });
    }

    // Calculate overall grade statistics
    const passedQuizzes = quizGrades.filter(q => q.passed).length;
    const totalQuizzes = quizGrades.length;
    const averageQuizScore = quizGrades.length > 0 
      ? Math.round(quizGrades.reduce((sum, q) => sum + q.bestPercentage, 0) / quizGrades.length)
      : 0;

    const passedAssignments = assignmentGrades.filter(a => a.passed).length;
    const totalAssignments = assignmentGrades.length;
    const averageAssignmentGrade = assignmentGrades.length > 0
      ? Math.round(assignmentGrades.reduce((sum, a) => sum + (a.currentGrade || 0), 0) / assignmentGrades.length)
      : 0;

    // Calculate overall course grade
    const quizWeight = 0.7; // 70% weight for quizzes
    const assignmentWeight = 0.3; // 30% weight for assignments
    const overallGrade = Math.round(
      (averageQuizScore * quizWeight) + (averageAssignmentGrade * assignmentWeight)
    );

    // Determine letter grade
    const getLetterGrade = (percentage: number): string => {
      if (percentage >= 90) return 'A';
      if (percentage >= 80) return 'B';
      if (percentage >= 70) return 'C';
      if (percentage >= 60) return 'D';
      return 'F';
    };

    // Get completion statistics
    const completedLessons = progress?.completedLessons?.length || 0;
    const totalLessons = course.totalLessons || 0;
    const progressPercentage = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

    // Course completion status
    const isCompleted = enrollment.status === 'completed' || progressPercentage >= 100;
    const canEarnCertificate = isCompleted && overallGrade >= 70 && passedQuizzes === totalQuizzes;

    logger.info('Grades fetched for course:', {
      userId: req.user.id,
      courseId,
      overallGrade,
      quizzesCompleted: `${passedQuizzes}/${totalQuizzes}`,
      assignmentsCompleted: `${passedAssignments}/${totalAssignments}`,
      canEarnCertificate
    });

    return res.json({
      success: true,
      data: {
        courseId,
        courseName: course.title,
        enrollmentStatus: enrollment.status,
        overallGrade,
        letterGrade: getLetterGrade(overallGrade),
        isCompleted,
        canEarnCertificate,
        
        // Progress information
        progress: {
          percentage: progressPercentage,
          completedLessons,
          totalLessons,
          timeSpent: progress?.timeSpent || 0,
          lastAccessed: progress?.lastWatched || enrollment.lastAccessedAt
        },
        
        // Quiz performance
        quizPerformance: {
          averageScore: averageQuizScore,
          totalQuizzes,
          passedQuizzes,
          failedQuizzes: totalQuizzes - passedQuizzes,
          totalAttempts: quizGrades.reduce((sum, q) => sum + q.totalAttempts, 0),
          totalTimeSpent: quizGrades.reduce((sum, q) => sum + q.timeSpent, 0)
        },
        
        // Assignment performance
        assignmentPerformance: {
          averageGrade: averageAssignmentGrade,
          totalAssignments,
          passedAssignments,
          failedAssignments: totalAssignments - passedAssignments,
          pendingSubmissions: assignmentGrades.filter(a => a.requiresResubmission).length
        },
        
        // Detailed grades
        quizGrades: quizGrades.sort((a, b) => a.title.localeCompare(b.title)),
        assignmentGrades: assignmentGrades.sort((a, b) => a.title.localeCompare(b.title)),
        
        // Grade breakdown for display
        gradeBreakdown: {
          quizzes: {
            weight: quizWeight * 100,
            averageScore: averageQuizScore,
            contribution: Math.round(averageQuizScore * quizWeight)
          },
          assignments: {
            weight: assignmentWeight * 100,
            averageScore: averageAssignmentGrade,
            contribution: Math.round(averageAssignmentGrade * assignmentWeight)
          }
        },
        
        // Engagement metrics
        engagement: {
          totalTimeSpent: progress?.timeSpent || 0,
          averageSessionTime: progress?.engagement?.averageSessionLength || 0,
          sessionCount: progress?.engagement?.sessionCount || 0,
          lastActive: progress?.engagement?.lastActiveAt || enrollment.lastAccessedAt
        }
      }
    });
  } catch (error) {
    logger.error('Failed to get course grades:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve course grades'
    });
  }
});

// Get course home/overview with enrollment status and progress
router.get('/:id/home', optionalAuth, async (req: Request, res: Response) => {
  try {
    const courseId = req.params.id;
    
    if (!courseId) {
      return res.status(400).json({
        success: false,
        error: 'Course ID is required'
      });
    }

    // Get course details
    const course = await courseModel.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        error: 'Course not found'
      });
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
      hasCertificate: course.contentFlags?.hasCertificate || false,
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

    return res.json({
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
    });
  } catch (error) {
    logger.error('Failed to get course home data:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve course home data'
    });
  }
});

// Get course progress
router.get('/:id/progress', authenticate, async (req: Request, res: Response) => {
  try {
    const courseId = req.params.id;
    
    if (!courseId) {
      return res.status(400).json({
        success: false,
        error: 'Course ID is required'
      });
    }

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const progress = await progressModel.findByUserAndCourse(req.user.id, courseId);
    const course = await courseModel.findById(courseId);
    
    const totalLessons = course?.totalLessons || 0;
    const completedLessons = progress?.completedLessons.length || 0;
    const progressPercentage = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

    return res.json({
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
    });
  } catch (error) {
    logger.error('Failed to get course progress:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve course progress'
    });
  }
});

// Update course progress
router.put('/:id/progress', authenticate, async (req: Request, res: Response) => {
  try {
    const courseId = req.params.id;
    const { progress } = req.body;

    if (!courseId) {
      return res.status(400).json({
        success: false,
        error: 'Course ID is required'
      });
    }

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
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

    return res.json({
      success: true,
      message: 'Course progress updated successfully',
      data: {
        courseId,
        progress,
        progressRecord
      }
    });
  } catch (error) {
    logger.error('Failed to update course progress:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update course progress'
    });
  }
});

// Update lesson progress - Enhanced with comprehensive tracking
router.put('/:id/lessons/:lessonId/progress', authenticate, async (req: Request, res: Response) => {
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
      return res.status(400).json({
        success: false,
        error: 'Course ID and Lesson ID are required'
      });
    }

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
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

    return res.json({
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
    });
  } catch (error) {
    logger.error('Failed to update lesson progress:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update lesson progress'
    });
  }
});

// Mark lesson as complete
router.post('/:id/lessons/:lessonId/complete', authenticate, async (req: Request, res: Response) => {
  try {
    const { id: courseId, lessonId } = req.params;
    
    if (!courseId || !lessonId) {
      return res.status(400).json({
        success: false,
        error: 'Course ID and Lesson ID are required'
      });
    }

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
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

    return res.json({
      success: true,
      message: 'Lesson marked as complete',
      data: {
        courseId,
        lessonId,
        progress: progressPercentage,
        completedLessons,
        totalLessons
      }
    });
  } catch (error) {
    logger.error('Failed to mark lesson as complete:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to mark lesson as complete'
    });
  }
});



export default router; 