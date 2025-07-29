import { Router } from 'express';
import { authenticate, authorize, optionalAuth } from '../middleware/auth';
import { courseController } from '../controllers/courseController';
import { 
  normalizeCourseResponse,
  handleCourseFormData
} from './compatibility';
import { progressRateLimiter } from '../middleware/rateLimiter';

const router = Router();

// Get all published courses
router.get('/', optionalAuth, normalizeCourseResponse, courseController.getPublishedCourses);

// Get single course by ID
router.get('/:id', optionalAuth, courseController.getCourseById);

// Debug endpoint to check course existence
router.get('/:id/exists', optionalAuth, async (req: any, res: any) => {
  try {
    const { id: courseId } = req.params;
    const { courseModel } = await import('../models/Course');
    
    console.log('Checking if course exists:', courseId);
    const course = await courseModel.findById(courseId);
    
    res.json({
      success: true,
      exists: !!course,
      courseId,
      course: course ? {
        _id: course._id,
        id: course.id,
        title: course.title,
        type: course.type
      } : null
    });
  } catch (error) {
    console.error('Error checking course existence:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check course existence'
    });
  }
});

// Create new course (tutors only)
router.post('/', 
  authenticate, 
  authorize('tutor', 'admin'), 
  handleCourseFormData, 
  normalizeCourseResponse,
  courseController.createCourse
);

// Update course (tutors only)
router.put('/:id', 
  authenticate, 
  authorize('tutor', 'admin'), 
  handleCourseFormData, 
  normalizeCourseResponse,
  courseController.updateCourse
);

// Submit course for approval
router.post('/:id/submit', authenticate, authorize('tutor'), courseController.submitCourseForApproval);

// Publish approved course (tutors only)
router.post('/:id/publish', authenticate, authorize('tutor'), courseController.publishApprovedCourse);

// Get instructor courses
router.get('/instructor/my-courses', 
  authenticate, 
  authorize('tutor', 'admin'), 
  normalizeCourseResponse, 
  courseController.getInstructorCourses
);

// Enroll in course
router.post('/:id/enroll', authenticate, authorize('learner', 'tutor', 'admin'), courseController.enrollInCourse);

// Get course content (basic version)
router.get('/:id/content', authenticate, courseController.getCourseContent);

// Get course quizzes/assessments
router.get('/:id/quizzes', authenticate, courseController.getCourseQuizzes);

// Submit quiz - Enhanced with better validation and error handling
router.post('/:id/quizzes/:quizId/submit', authenticate, courseController.submitQuiz);

// Get quiz attempts status for a specific quiz
router.get('/:id/quizzes/:quizId/attempts', authenticate, courseController.getQuizAttempts);

// Get comprehensive grades and assessment results for a course
router.get('/:id/grades', authenticate, courseController.getCourseGrades);

// Get course home/overview with enrollment status and progress
router.get('/:id/home', optionalAuth, courseController.getCourseHome);

// Get course progress
router.get('/:id/progress', authenticate, progressRateLimiter, courseController.getCourseProgress);

// Update course progress
router.put('/:id/progress', authenticate, courseController.updateCourseProgress);

// Update lesson progress - Enhanced with comprehensive tracking
router.put('/:id/lessons/:lessonId/progress', authenticate, courseController.updateLessonProgress);

// Mark lesson as complete
router.post('/:id/lessons/:lessonId/complete', authenticate, courseController.completeLessonProgress);

export default router; 