import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation, Routes, Route } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { 
  apiClient, 
  getCourseProgress, 
  markLessonComplete, 
  getCourseQuizzes, 
  submitQuiz,
  updateLessonProgress
} from '../utils/api';
import { getCoursePermissions } from '../utils/coursePermissions';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Alert } from '../components/ui/Alert';
import CourseLayout from '../components/layout/CourseLayout';
import { CourseHome } from '../components/course/CourseHome';
import { ModulesList } from '../components/course/ModulesList';
import { ModulePage } from '../components/course/ModulePage';
import { CourseAssessments } from '../components/course/CourseAssessments';
import { CheckCircle, AlertCircle } from 'lucide-react';

// Define clean interfaces
interface Course {
  id: string;
  title: string;
  description: string;
  thumbnail?: string;
  category: string;
  level: string;
  status: string;
  enrollmentCount?: number;
  rating?: { average: number; count: number };
  totalLessons?: number;
  totalDuration?: number;
  instructorName: string;
  learningObjectives?: string[];
}

interface Module {
  id: string;
  title: string;
  description: string;
  estimatedDuration: number;
  videoUrl: string;
  videoProvider: 'youtube';
  order: number;
  isCompleted: boolean;
  isUnlocked: boolean;
  nextModuleId?: string;
  hasQuiz?: boolean;
}

interface Quiz {
  id: string;
  title: string;
  description: string;
  moduleTitle?: string;
  type: 'module' | 'final';
  questions: any[]; // Changed from number to any[]
  estimatedDuration: number;
  passingScore: number;
  maxAttempts: number;
  isCompleted: boolean;
  bestScore?: number;
    attempts: number;
  isUnlocked: boolean;
  settings?: {
    timeLimit?: number;
    passingScore: number;
    maxAttempts: number;
    showCorrectAnswers?: boolean;
    showScoreImmediately?: boolean;
  };
}

interface QuizGrade {
  id: string;
  quizTitle: string;
  moduleTitle?: string;
  type: 'module' | 'final';
  score: number;
  maxScore: number;
  percentage: number;
  passingScore: number;
  passed: boolean;
  attempts: number;
  completedAt: string;
  timeSpent: number;
}

interface CourseData {
  course: Course;
  modules: Module[];
  quizzes: Quiz[];
  grades: QuizGrade[];
  isEnrolled: boolean;
  userProgress?: {
    completedLessons: number;
    totalLessons: number;
    overallProgress: number;
    completedModules: number;
    totalModules: number;
    completedQuizzes: number;
    totalQuizzes: number;
    averageScore: number;
  };
  overallStats?: {
    overallGrade: number;
    gradeLetterEquivalent: string;
    totalTimeSpent: number;
    modulesCompleted: number;
    totalModules: number;
    coursePassed: boolean;
    completionDate?: string;
  };
}

const Course: React.FC = () => {
  const { id: courseId } = useParams<{ id: string }>();
  const { moduleId } = useParams<{ moduleId?: string }>();
  const { user } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const [courseData, setCourseData] = useState<CourseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [permissions, setPermissions] = useState<any>(null);

  // Fetch course data
  useEffect(() => {
    if (courseId) {
      fetchCourseData();
    }
  }, [courseId]);

  // Handle success message from navigation
  useEffect(() => {
    if (location.state?.message) {
      setSuccess(location.state.message);
      setTimeout(() => setSuccess(''), 5000);
      // Clear navigation state
      navigate(location.pathname, { replace: true });
    }
  }, [location.state, navigate]);



  // Fetch course permissions
  useEffect(() => {
    if (courseData && user) {
      const coursePermissions = getCoursePermissions(
        user,
        courseData.course as any
      );
      setPermissions(coursePermissions);
    }
  }, [courseData, user]);

  const fetchCourseData = async () => {
    setLoading(true);
    setError('');

    try {
      // Fetch course data
      const courseResponse = await apiClient.getCourse(courseId!);
      
      if (!courseResponse.success || !courseResponse.data) {
        setError('Failed to load course data');
        return;
      }

      const course = courseResponse.data.course || courseResponse.data;
      const isEnrolled = courseResponse.data.isEnrolled || false;

      // Fetch real user progress from CouchDB
      let progressData = null;
      let quizzesData = null;

    if (isEnrolled) {
        try {
          const [progressResponse, quizzesResponse] = await Promise.all([
            getCourseProgress(courseId!),
            getCourseQuizzes(courseId!)
          ]);

          progressData = progressResponse.success ? progressResponse.data : null;
          quizzesData = quizzesResponse.success ? quizzesResponse.data : null;
          
          // Debug logging for troubleshooting
          console.log('Fetched course data:', {
            courseSuccess: courseResponse.success,
            progressSuccess: progressResponse.success,
            progressData: progressData,
            completedLessonsType: typeof progressData?.completedLessons,
            completedLessonsIsArray: Array.isArray(progressData?.completedLessons),
            quizzesSuccess: quizzesResponse.success
          });
        } catch (progressError) {
          console.warn('Failed to fetch some course data:', progressError);
        }
      }

      // Transform sections/lessons to modules with real progress
      const modules: Module[] = [];
      
      // Ensure completedLessons is always an array
      let completedLessons: string[] = [];
      if (progressData?.completedLessons) {
        if (Array.isArray(progressData.completedLessons)) {
          completedLessons = progressData.completedLessons;
        } else if (progressData.completedLessons.length !== undefined) {
          // If it's array-like but not an array, convert it
          completedLessons = Array.from(progressData.completedLessons);
        } else {
          console.warn('completedLessons is not an array:', progressData.completedLessons);
          completedLessons = [];
        }
      }
      
      if (course.sections && Array.isArray(course.sections)) {
        try {
          course.sections.forEach((section: any, sectionIndex: number) => {
            if (section && section.lessons && Array.isArray(section.lessons)) {
              section.lessons.forEach((lesson: any, lessonIndex: number) => {
                if (lesson && lesson.type === 'video' && lesson.content?.videoUrl) {
                  const moduleOrder = sectionIndex * 10 + lessonIndex + 1;
                  
                  // Safe check for lesson completion
                  let isCompleted = false;
                  try {
                    isCompleted = Array.isArray(completedLessons) && completedLessons.includes(lesson.id);
                  } catch (error) {
                    console.warn('Error checking lesson completion:', error, { lesson: lesson.id, completedLessons });
                    isCompleted = false;
                  }
                  
                  const isFirstModule = moduleOrder === 1;
                  const prevModuleCompleted = modules.length === 0 || modules[modules.length - 1].isCompleted;
                  
                  modules.push({
                    id: lesson.id || `lesson_${sectionIndex}_${lessonIndex}`,
                    title: lesson.title || `Module ${moduleOrder}`,
                    description: lesson.description || section.description || '',
                    estimatedDuration: lesson.estimatedDuration || 15,
                    videoUrl: lesson.content.videoUrl,
                    videoProvider: 'youtube',
                    order: moduleOrder,
                isCompleted,
                    isUnlocked: isFirstModule || prevModuleCompleted,
                    nextModuleId: undefined, // Will be set below
                    hasQuiz: !!(lesson.quiz || section.moduleQuiz)
              });
            }
          });
            }
          });
        } catch (sectionsError) {
          console.error('Error processing course sections:', sectionsError);
          // Continue with empty modules array
        }
      }

      // Set next module IDs and fix unlock logic
      modules.forEach((module, index) => {
        if (index < modules.length - 1) {
          module.nextModuleId = modules[index + 1].id;
        }
        // Fix unlock logic: unlock next module if current is completed
        if (index > 0) {
          module.isUnlocked = modules[index - 1].isCompleted;
        }
      });

      // Transform quizzes with real data - fetch all quizzes and make them all unlocked
      const quizzes: Quiz[] = [];
      const quizScores = progressData?.quizScores || {};
      
      // Add module quizzes from API
      if (quizzesData?.quizzes) {
        quizzesData.quizzes.forEach((quiz: any) => {
          const quizScore = quizScores[quiz.id];
          quizzes.push({
            id: quiz.id,
            title: quiz.title,
            description: quiz.description,
            moduleTitle: quiz.moduleTitle,
            type: quiz.type || 'module',
            questions: quiz.questions || [], // Ensure questions is an array
            estimatedDuration: quiz.estimatedDuration || 15,
            passingScore: quiz.passingScore || 70,
            maxAttempts: quiz.maxAttempts || 3,
            isCompleted: quizScore?.passed || false,
            bestScore: quizScore?.bestPercentage,
            attempts: quizScore?.totalAttempts || 0,
            isUnlocked: true, // Always unlocked regardless of module completion
            settings: {
              timeLimit: quiz.timeLimit,
              passingScore: quiz.passingScore || 70,
              maxAttempts: quiz.maxAttempts || 3,
              showCorrectAnswers: quiz.showCorrectAnswers ?? true,
              showScoreImmediately: quiz.showScoreImmediately ?? true
            }
          });
        });
      }

      // Extract module quizzes from course sections/lessons if not in API response
      if (course.sections) {
        course.sections.forEach((section: any, sectionIndex: number) => {
          if (section.lessons) {
            section.lessons.forEach((lesson: any, lessonIndex: number) => {
              // Check if lesson has a quiz
              if (lesson.quiz && !quizzes.find(q => q.id === lesson.quiz.id)) {
                const quizScore = quizScores[lesson.quiz.id];
                const moduleTitle = lesson.title || section.title || `Module ${sectionIndex + 1}`;
                
                quizzes.push({
                  id: lesson.quiz.id,
                  title: lesson.quiz.title || `${moduleTitle} Quiz`,
                  description: lesson.quiz.description || `Quiz for ${moduleTitle}`,
                  moduleTitle,
                  type: 'module',
                  questions: lesson.quiz.questions || [], // Ensure questions is an array
                  estimatedDuration: lesson.quiz.estimatedDuration || 15,
                  passingScore: lesson.quiz.passingScore || 70,
                  maxAttempts: lesson.quiz.maxAttempts || 3,
                  isCompleted: quizScore?.passed || false,
                  bestScore: quizScore?.bestPercentage,
                  attempts: quizScore?.totalAttempts || 0,
                  isUnlocked: true // Always unlocked
                });
              }
            });
          }
          
          // Check if section has a module quiz
          if (section.moduleQuiz && !quizzes.find(q => q.id === section.moduleQuiz.id)) {
            const quizScore = quizScores[section.moduleQuiz.id];
            const moduleTitle = section.title || `Module ${sectionIndex + 1}`;
            
            quizzes.push({
              id: section.moduleQuiz.id,
              title: section.moduleQuiz.title || `${moduleTitle} Assessment`,
              description: section.moduleQuiz.description || `Assessment for ${moduleTitle}`,
              moduleTitle,
              type: 'module',
              questions: section.moduleQuiz.questions || [], // Ensure questions is an array
              estimatedDuration: section.moduleQuiz.estimatedDuration || 20,
              passingScore: section.moduleQuiz.passingScore || 70,
              maxAttempts: section.moduleQuiz.maxAttempts || 3,
              isCompleted: quizScore?.passed || false,
              bestScore: quizScore?.bestPercentage,
              attempts: quizScore?.totalAttempts || 0,
              isUnlocked: true // Always unlocked
            });
          }
        });
      }

      // Add final assessment
      if (course.finalAssessment) {
        const finalScore = quizScores[course.finalAssessment.id];
        quizzes.push({
          id: course.finalAssessment.id,
          title: course.finalAssessment.title,
          description: course.finalAssessment.description,
          type: 'final',
          questions: course.finalAssessment.questions || [], // Ensure questions is an array
          estimatedDuration: 30,
          passingScore: 70,
          maxAttempts: 3,
          isCompleted: finalScore?.passed || false,
          bestScore: finalScore?.bestPercentage,
          attempts: finalScore?.totalAttempts || 0,
          isUnlocked: true // Always unlocked regardless of module completion
        });
      }

      // If no quizzes found, create sample assessments for demonstration
      if (quizzes.length === 0 && modules.length > 0) {
        console.log('No quizzes found, creating sample assessments...');
        
        // Create a quiz for each module
        modules.forEach((module, index) => {
          const quizId = `sample_quiz_${module.id}`;
          quizzes.push({
            id: quizId,
            title: `${module.title} Quiz`,
            description: `Test your knowledge of the concepts covered in ${module.title}`,
            moduleTitle: module.title,
            type: 'module',
            questions: [], // Sample questions
            estimatedDuration: 10,
            passingScore: 70,
            maxAttempts: 3,
            isCompleted: false,
            bestScore: undefined,
            attempts: 0,
            isUnlocked: true
          });
        });
        
        // Create a final assessment
        const finalQuizId = `sample_final_${courseId}`;
        quizzes.push({
          id: finalQuizId,
          title: 'Final Course Assessment',
          description: 'Comprehensive assessment covering all course material',
          moduleTitle: 'Final Assessment',
          type: 'final',
          questions: [], // Sample questions
          estimatedDuration: 30,
          passingScore: 70,
          maxAttempts: 3,
          isCompleted: false,
          bestScore: undefined,
          attempts: 0,
          isUnlocked: true
        });
      }

      console.log('All quizzes loaded:', {
        totalQuizzes: quizzes.length,
        moduleQuizzes: quizzes.filter(q => q.type === 'module').length,
        finalAssessments: quizzes.filter(q => q.type === 'final').length,
        unlockedQuizzes: quizzes.filter(q => q.isUnlocked).length,
        allUnlocked: quizzes.every(q => q.isUnlocked)
      });

      // Grades are now handled by CourseAssessments component
      const grades: QuizGrade[] = [];

      // Calculate real user progress with proper fallbacks
      let completedModules = modules.filter(m => m.isCompleted).length;
      const completedQuizzes = quizzes.filter(q => q.isCompleted).length;
      const averageScore = grades.length > 0 ? 
        Math.round(grades.reduce((sum, g) => sum + g.percentage, 0) / grades.length) : 0;

      // Calculate progress percentage with proper handling
      let calculatedProgress = 0;
      if (modules.length > 0 && typeof completedModules === 'number') {
        calculatedProgress = Math.round((completedModules / modules.length) * 100);
        // Ensure it's a valid number
        if (isNaN(calculatedProgress)) {
          calculatedProgress = 0;
        }
      }

      // Use API progress if available, otherwise use calculated progress
      let finalProgress = 0;
      if (progressData?.progress !== undefined && progressData?.progress !== null) {
        const apiProgress = Number(progressData.progress);
        finalProgress = !isNaN(apiProgress) ? Math.round(apiProgress) : 0;
          } else {
        finalProgress = calculatedProgress;
      }

      // Fix module completion inconsistency: if progress is 100%, ensure all modules are marked complete
      let adjustedModules = [...modules];
      if (finalProgress === 100 && completedModules < modules.length) {
        console.log('Fixing module completion inconsistency: progress is 100% but not all modules marked complete');
        adjustedModules = modules.map(module => ({
          ...module,
            isCompleted: true,
          isUnlocked: true
        }));
        
        // Recalculate completed modules after fixing the inconsistency
        completedModules = adjustedModules.filter(m => m.isCompleted).length;
        console.log('Module completion fixed:', {
          beforeAdjustment: modules.filter(m => m.isCompleted).length,
          afterAdjustment: completedModules,
          totalModules: modules.length,
          progress: finalProgress
        });
      }
      
      // Also check if all modules are manually completed but progress isn't 100%
      if (completedModules === modules.length && modules.length > 0 && finalProgress < 100) {
        console.log('All modules completed manually, updating progress to 100%');
        finalProgress = 100;
      }
      
      // Final validation: ensure consistency
      const finalCompletedModules = adjustedModules.filter(m => m.isCompleted).length;
      
      // If progress is 100%, force all modules to be completed
      if (finalProgress === 100 && finalCompletedModules < adjustedModules.length && adjustedModules.length > 0) {
        adjustedModules = adjustedModules.map(module => ({
          ...module,
          isCompleted: true,
          isUnlocked: true
        }));
        
        console.log('Final consistency check: forced all modules to completed state');
      }

      // Check localStorage backup if API progress seems inconsistent
      if (finalProgress === 0 && user) {
        try {
          const progressKey = `course_progress_${courseId}_${user.id}`;
          const backupData = localStorage.getItem(progressKey);
          if (backupData) {
            const backup = JSON.parse(backupData);
            const backupAge = Date.now() - backup.timestamp;
            
            // Use backup if it's recent (within 24 hours) and higher than API
            const backupProgress = Number(backup.progress);
            if (backupAge < 24 * 60 * 60 * 1000 && !isNaN(backupProgress) && backupProgress > finalProgress) {
              console.warn('Using localStorage backup due to API inconsistency:', {
                apiProgress: finalProgress,
                backupProgress: backupProgress,
                backupAge: Math.round(backupAge / 1000 / 60) + ' minutes ago'
              });
              finalProgress = Math.round(backupProgress);
              
              // If backup shows 100%, mark all modules complete
              if (finalProgress === 100) {
                adjustedModules = adjustedModules.map(module => ({
                  ...module,
                  isCompleted: true,
              isUnlocked: true
                }));
              }
            }
          }
        } catch (storageError) {
          console.warn('Failed to check progress backup:', storageError);
        }
      }

      // Ensure finalProgress is a valid number
      const validFinalProgress = typeof finalProgress === 'number' && !isNaN(finalProgress) ? finalProgress : 0;
      
      // Get final counts after all adjustments
      const finalCompletedCount = adjustedModules.filter(m => m.isCompleted).length;

      const userProgress = {
        completedLessons: finalCompletedCount,
        totalLessons: adjustedModules.length,
        overallProgress: Math.max(0, Math.min(100, validFinalProgress)), // Ensure valid percentage
        completedModules: finalCompletedCount, // Use the adjusted count
        totalModules: adjustedModules.length,
        completedQuizzes,
        totalQuizzes: quizzes.length,
        averageScore: typeof averageScore === 'number' && !isNaN(averageScore) ? averageScore : 0
      };

      // Overall stats - simplified since grades are handled in assessments
      const overallStats = undefined;

      console.log('Final user progress calculated:', {
        completedModules: userProgress.completedModules,
        totalModules: userProgress.totalModules,
        overallProgress: userProgress.overallProgress,
        modulesActuallyCompleted: adjustedModules.filter(m => m.isCompleted).length,
        progressConsistent: userProgress.overallProgress === 100 ? userProgress.completedModules === userProgress.totalModules : true
      });

      setCourseData({
        course: {
          id: course.id || course._id,
          title: course.title,
          description: course.description,
          thumbnail: course.thumbnail,
          category: course.category,
          level: course.level,
          status: course.status,
          enrollmentCount: course.enrollmentCount,
          rating: course.rating,
          totalLessons: adjustedModules.length,
          totalDuration: course.totalDuration,
          instructorName: course.instructorName,
          learningObjectives: course.learningObjectives
        },
        modules: adjustedModules,
        quizzes,
        grades,
        isEnrolled,
        userProgress,
        overallStats
      });

    } catch (err: any) {
      console.error('Error fetching course:', err);
      
      // Provide more specific error messages
      let errorMessage = 'Failed to load course. Please try again.';
      if (err.message) {
        if (err.message.includes('TypeError')) {
          errorMessage = 'Data format error. Please refresh the page.';
        } else if (err.message.includes('Network')) {
          errorMessage = 'Network error. Please check your connection.';
        } else if (err.message.includes('404')) {
          errorMessage = 'Course not found. Please verify the course ID.';
        } else {
          errorMessage = `Error: ${err.message}`;
        }
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to get letter grade
  const getLetterGrade = (percentage: number) => {
    if (percentage >= 90) return 'A';
    if (percentage >= 80) return 'B';
    if (percentage >= 70) return 'C';
    if (percentage >= 60) return 'D';
    return 'F';
  };

  const handleMarkModuleComplete = async (moduleId: string) => {
    if (!courseData) return;

    try {
      // Mark lesson as complete in CouchDB
      const response = await markLessonComplete(courseId!, moduleId);
      
      if (response.success) {
        // Update local state with real progress from API
        const updatedModules = courseData.modules.map(module => {
          if (module.id === moduleId) {
            return { ...module, isCompleted: true };
          }
          // Unlock next module
          const currentIndex = courseData.modules.findIndex(m => m.id === moduleId);
          if (courseData.modules.findIndex(m => m.id === module.id) === currentIndex + 1) {
            return { ...module, isUnlocked: true };
          }
          return module;
        });

        const completedCount = updatedModules.filter(m => m.isCompleted).length;
        const totalModules = updatedModules.length;
        
        // Calculate progress with proper validation
        let progressPercentage = 0;
        if (totalModules > 0) {
          progressPercentage = Math.round((completedCount / totalModules) * 100);
        }
        
        // Use API progress if available, otherwise use calculated
        const apiProgress = response.data?.progress;
        const finalProgress = apiProgress !== undefined && apiProgress !== null 
          ? Math.round(apiProgress) 
          : progressPercentage;

        // Ensure progress is valid (0-100)
        const validProgress = Math.max(0, Math.min(100, finalProgress));
        
        setCourseData({
          ...courseData,
          modules: updatedModules,
          userProgress: {
            ...courseData.userProgress!,
            completedModules: completedCount,
            completedLessons: completedCount,
            overallProgress: validProgress
          }
        });

        // Update lesson progress tracking with completion data
        await updateLessonProgress(courseId!, moduleId, {
          timeSpent: 0, // Will be tracked by video player
          currentPosition: 100, // Mark as fully watched
          interactions: [{
            type: 'lesson_completed',
            timestamp: new Date().toISOString(),
            data: { 
              moduleId, 
              completedManually: true,
              newProgress: validProgress,
              totalModules,
              completedModules: completedCount,
              isCompleted: true
            }
          }]
        });

        // Also update overall course progress via enrollment to ensure persistence  
        try {
          const enrollmentResponse = await apiClient.updateCourseProgress(courseId!, { progress: validProgress });
          if (enrollmentResponse.success) {
            console.log('Overall course progress updated via enrollment:', validProgress);
          }
        } catch (progressError) {
          console.warn('Failed to update overall course progress:', progressError);
        }

        // Save progress to localStorage as backup
        try {
          const progressKey = `course_progress_${courseId}_${user?.id}`;
          const progressBackup = {
            courseId: courseId!,
            userId: user?.id,
            progress: validProgress,
            completedModules: completedCount,
            totalModules,
            timestamp: Date.now(),
            moduleId
          };
          localStorage.setItem(progressKey, JSON.stringify(progressBackup));
          console.log('Progress backup saved to localStorage:', progressBackup);
        } catch (storageError) {
          console.warn('Failed to save progress backup:', storageError);
        }

        // Force refresh course data to ensure consistency
        setTimeout(() => {
          fetchCourseData();
        }, 1000);

        // Trigger a progress update event for other components
        window.dispatchEvent(new CustomEvent('courseProgressUpdated', {
          detail: { courseId: courseId!, progress: validProgress, moduleId }
        }));

        console.log('Module marked complete in CouchDB:', {
          moduleId,
          courseId: courseId!,
          newProgress: validProgress,
          completedCount,
          totalModules
        });

        } else {
        console.error('Failed to mark module complete:', response.error);
        throw new Error(response.error || 'Failed to mark module as complete');
        }
      } catch (error) {
      console.error('Error marking module complete:', error);
      // Could show a toast error here
    }
  };

  const handleTakeQuiz = async (quizId: string) => {
    if (!courseData) return;

    try {
      // Navigate to assessments page which will handle the quiz taking
      navigate(`/course/${courseId}/assessments`);
    } catch (error) {
      console.error('Error navigating to quiz:', error);
      setError('Failed to access quiz. Please try again.');
    }
  };

  if (loading) {
  return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner size="lg" />
        <span className="ml-3 text-gray-600 dark:text-gray-400">
          {language === 'rw' ? 'Turimo gushaka isomo...' : 'Loading course...'}
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto mt-8">
        <Alert variant="error">
          <AlertCircle className="w-4 h-4" />
          {error}
        </Alert>
      </div>
    );
  }

  if (!courseData) {
    return (
      <div className="max-w-2xl mx-auto mt-8">
        <Alert variant="error">
          <AlertCircle className="w-4 h-4" />
          {language === 'rw' ? 'Isomo ntibona' : 'Course not found'}
        </Alert>
      </div>
    );
  }



  return (
    <>
      {/* Success Message */}
      {success && (
        <div className="fixed top-4 right-4 z-50 max-w-md">
          <Alert variant="success">
            <CheckCircle className="h-4 w-4" />
            {success}
          </Alert>
      </div>
      )}

      <CourseLayout 
        courseTitle={courseData?.course.title || 'Loading...'}
        courseProgress={courseData?.userProgress?.overallProgress || 0}
        permissions={permissions}
      >
        <Routes>
          {/* Course Home */}
          <Route 
            path="/" 
            element={
              <CourseHome 
                course={courseData.course}
                isEnrolled={courseData.isEnrolled}
                userProgress={courseData.userProgress}
              />
            } 
          />
          
          {/* Modules List */}
          <Route 
            path="/modules" 
            element={
              <ModulesList 
                courseId={courseData.course.id}
                modules={courseData.modules}
                userProgress={courseData.userProgress}
              />
            } 
          />
          
          {/* Individual Module */}
          <Route 
            path="/module/:moduleId" 
            element={
              <ModulePageWrapper 
                courseData={courseData}
                onMarkComplete={handleMarkModuleComplete}
              />
            } 
          />
          
          {/* Assessments & Grades (Combined) */}
          <Route 
            path="/assessments" 
            element={
              <CourseAssessments 
                courseId={courseData.course.id}
                quizzes={courseData.quizzes}
                onTakeQuiz={handleTakeQuiz}
                userProgress={courseData.userProgress}
              />
            } 
          />
          
          {/* Analytics */}
          <Route 
            path="/analytics" 
            element={
              <div className="p-8 text-center">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  {language === 'rw' ? 'Isesengura rizaza' : 'Analytics Coming Soon'}
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          {language === 'rw' 
                    ? 'Ibyerekeye isesengura bizongera bigaragare vuba'
                    : 'Course analytics will be available soon'
                  }
              </p>
            </div>
            } 
          />
          
          {/* Management */}
          <Route 
            path="/management" 
            element={
              <div className="p-8 text-center">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          {language === 'rw' ? 'Icunga ry\'isomo' : 'Course Management'}
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          {language === 'rw' 
                    ? 'Ibikoresho byo gucunga isomo bizongera bigaragare vuba'
                    : 'Course management tools will be available soon'
                  }
          </p>
        </div>
            } 
          />
        </Routes>
      </CourseLayout>
    </>
  );
};

// Wrapper component for ModulePage to handle moduleId param
const ModulePageWrapper: React.FC<{
  courseData: CourseData;
  onMarkComplete: (moduleId: string) => Promise<void>;
}> = ({ courseData, onMarkComplete }) => {
  const { moduleId } = useParams<{ moduleId: string }>();
  const module = courseData.modules.find(m => m.id === moduleId);

  if (!module) {
    return (
      <div className="max-w-2xl mx-auto mt-8">
        <Alert variant="error">
          <AlertCircle className="w-4 h-4" />
          Module not found
        </Alert>
      </div>
    );
  }

    return (
    <ModulePage 
      module={module}
      courseId={courseData.course.id}
      onMarkComplete={onMarkComplete}
    />
  );
};

export default Course; 