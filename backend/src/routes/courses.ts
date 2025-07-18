import { Router } from 'express';
import { authenticate, authorize, optionalAuth } from '../middleware/auth';
import { courseController } from '../controllers/courseController';
import { 
  normalizeCourseResponse,
  handleCourseFormData
} from './compatibility';

const router = Router();

// Get all published courses
router.get('/', optionalAuth, normalizeCourseResponse, courseController.getAllCourses);

// Get single course by ID
router.get('/:id', optionalAuth, courseController.getCourseById);

// Create new course (tutors only)
router.post('/', 
  authenticate, 
  authorize('tutor', 'admin'), 
  handleCourseFormData, 
  normalizeCourseResponse,
  courseController.createCourse
);

// Submit course for approval
router.post('/:id/submit', authenticate, authorize('tutor'), courseController.submitCourseForApproval);

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
router.get('/:id/progress', authenticate, courseController.getCourseProgress);

// Update course progress
router.put('/:id/progress', authenticate, courseController.updateCourseProgress);

// Update lesson progress - Enhanced with comprehensive tracking
router.put('/:id/lessons/:lessonId/progress', authenticate, courseController.updateLessonProgress);

// Mark lesson as complete
router.post('/:id/lessons/:lessonId/complete', authenticate, courseController.completeLessonProgress);

export default router; 