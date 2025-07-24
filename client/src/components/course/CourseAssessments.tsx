import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { getCourseQuizzes, getCourse, getCourseGrades } from '../../utils/api';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { QuizTaker } from './QuizTaker';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { 
  ClipboardList,
  CheckCircle,
  XCircle,
  Clock,
  Star,
  ArrowRight,
  Play,
  Trophy,
  RotateCcw,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  BarChart3,
  TrendingUp,
  Target,
  Eye,
  Lock
} from 'lucide-react';

interface Quiz {
  id: string;
  title: string;
  description: string;
  moduleTitle?: string;
  type: 'module' | 'final';
  questions: any[];
  passingScore: number;
  maxAttempts: number;
  isCompleted: boolean;
  bestScore?: number;
  attempts: number;
  isUnlocked: boolean;
  settings?: {
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

interface CourseAssessmentsProps {
  courseId: string;
  quizzes?: Quiz[];
  onTakeQuiz?: (quizId: string) => void;
  userProgress?: {
    completedQuizzes: number;
    totalQuizzes: number;
    averageScore: number;
  };
}

export const CourseAssessments: React.FC<CourseAssessmentsProps> = ({ 
  courseId,
  quizzes: initialQuizzes = [],
  onTakeQuiz,
  userProgress: initialUserProgress
}) => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { theme } = useTheme();
  
  const [quizzes, setQuizzes] = useState<Quiz[]>(initialQuizzes);
  const [grades, setGrades] = useState<QuizGrade[]>([]);
  const [course, setCourse] = useState<any>(null);
  const [userProgress, setUserProgress] = useState(initialUserProgress);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [showQuizTaker, setShowQuizTaker] = useState(false);
  const [highlightedQuiz, setHighlightedQuiz] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Handle accessibility events
  useEffect(() => {
    const handleHighlightQuiz = (event: CustomEvent) => {
      const { action } = event.detail;
      // Find the first available quiz to highlight
      const availableQuiz = quizzes.find(q => q.isUnlocked && !q.isCompleted);
      if (availableQuiz) {
        setHighlightedQuiz(availableQuiz.id);
        setTimeout(() => {
          const quizElement = document.getElementById(`quiz-${availableQuiz.id}`);
          if (quizElement) {
            quizElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            quizElement.classList.add('ring-2', 'ring-blue-500', 'ring-opacity-50');
            setTimeout(() => {
              quizElement.classList.remove('ring-2', 'ring-blue-500', 'ring-opacity-50');
            }, 3000);
          }
        }, 500);
      }
    };

    const handleHighlightFinalQuiz = (event: CustomEvent) => {
      const { action } = event.detail;
      // Find the final quiz
      const finalQuiz = quizzes.find(q => q.type === 'final');
      if (finalQuiz) {
        setHighlightedQuiz(finalQuiz.id);
        setTimeout(() => {
          const quizElement = document.getElementById(`quiz-${finalQuiz.id}`);
          if (quizElement) {
            quizElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            quizElement.classList.add('ring-2', 'ring-blue-500', 'ring-opacity-50');
            setTimeout(() => {
              quizElement.classList.remove('ring-2', 'ring-blue-500', 'ring-opacity-50');
            }, 3000);
          }
        }, 500);
      }
    };

    const handleContinueNextQuiz = () => {
      const nextQuiz = quizzes.find(q => q.isUnlocked && !q.isCompleted);
      if (nextQuiz) {
        handleTakeQuiz(nextQuiz.id);
      } else {
        // If no next quiz, go back to modules or course home
        navigate(`/course/${courseId}/modules`);
      }
    };

    const handleStartCurrentQuiz = () => {
      if (selectedQuiz) {
        setShowQuizTaker(true);
      }
    };

    const handleSubmitCurrentQuiz = () => {
      // This would be handled in the QuizTaker component
      console.log('Submit current quiz event received');
    };

    // Add event listeners
    window.addEventListener('highlightQuiz', handleHighlightQuiz as EventListener);
    window.addEventListener('highlightFinalQuiz', handleHighlightFinalQuiz as EventListener);
    window.addEventListener('continueNextQuiz', handleContinueNextQuiz);
    window.addEventListener('startCurrentQuiz', handleStartCurrentQuiz);
    window.addEventListener('submitCurrentQuiz', handleSubmitCurrentQuiz);

    return () => {
      window.removeEventListener('highlightQuiz', handleHighlightQuiz as EventListener);
      window.removeEventListener('highlightFinalQuiz', handleHighlightFinalQuiz as EventListener);
      window.removeEventListener('continueNextQuiz', handleContinueNextQuiz);
      window.removeEventListener('startCurrentQuiz', handleStartCurrentQuiz);
      window.removeEventListener('submitCurrentQuiz', handleSubmitCurrentQuiz);
    };
  }, [quizzes, selectedQuiz, courseId, navigate]);

  // Enhanced quiz navigation with accessibility support
  const handleQuizAction = (quiz: Quiz, action: 'take' | 'review' | 'retake') => {
    switch (action) {
      case 'take':
        if (quiz.isUnlocked && !quiz.isCompleted) {
          handleTakeQuiz(quiz.id);
        }
        break;
      case 'review':
        if (quiz.isCompleted) {
          handleTakeQuiz(quiz.id);
        }
        break;
      case 'retake':
        if (quiz.isCompleted && quiz.attempts < quiz.maxAttempts) {
          handleTakeQuiz(quiz.id);
        }
        break;
    }
  };

  // Keyboard navigation support for quizzes
  const handleQuizKeyDown = (event: React.KeyboardEvent, quiz: Quiz) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (quiz.isUnlocked) {
        handleTakeQuiz(quiz.id);
      }
    }
  };

  // Fetch all quizzes, course data, and grades
  const fetchAssessmentsData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError('');

    try {
      // Fetch data with individual error handling to prevent total failure
      const [quizzesResult, courseResult, gradesResult] = await Promise.allSettled([
        getCourseQuizzes(courseId),
        getCourse(courseId),
        getCourseGrades(courseId)
      ]);

      // Extract successful responses
      const quizzesResponse = quizzesResult.status === 'fulfilled' ? quizzesResult.value : { success: false, data: null };
      const courseResponse = courseResult.status === 'fulfilled' ? courseResult.value : { success: false, data: null };
      const gradesResponse = gradesResult.status === 'fulfilled' ? gradesResult.value : { success: false, data: null };

      console.log('Fetched assessments data:', {
        quizzesSuccess: quizzesResponse.success,
        courseSuccess: courseResponse.success,
        gradesSuccess: gradesResponse.success,
        quizzesCount: quizzesResponse.data?.quizzes?.length || 0,
        gradesCount: gradesResponse.data?.grades?.length || 0,
        errors: {
          quiz: quizzesResult.status === 'rejected' ? quizzesResult.reason : null,
          course: courseResult.status === 'rejected' ? courseResult.reason : null,
          grades: gradesResult.status === 'rejected' ? gradesResult.reason : null,
        }
      });

      let allQuizzes: Quiz[] = [];
      
      // Process API quizzes
      if (quizzesResponse.success && quizzesResponse.data?.quizzes) {
        allQuizzes = quizzesResponse.data.quizzes.map((quiz: any) => ({
          id: quiz.id,
          title: quiz.title,
          description: quiz.description,
          moduleTitle: quiz.moduleTitle,
          type: quiz.type || 'module',
          questions: quiz.questions || [],
          passingScore: quiz.passingScore || 70,
          maxAttempts: quiz.maxAttempts || 3,
          isCompleted: quiz.isCompleted || false,
          bestScore: quiz.bestScore,
          attempts: quiz.attempts || 0,
          isUnlocked: true, // All quizzes are always unlocked
          settings: {
            timeLimit: quiz.timeLimit,
            passingScore: quiz.passingScore || 70,
            maxAttempts: quiz.maxAttempts || 3,
            showCorrectAnswers: quiz.showCorrectAnswers ?? true,
            showScoreImmediately: quiz.showScoreImmediately ?? true
          }
        }));
      }

      // Extract quizzes from course structure if not found in API
      if (courseResponse.success && courseResponse.data?.course) {
        const course = courseResponse.data.course;
        
        // Extract module quizzes from sections/lessons
        if (course.sections && Array.isArray(course.sections)) {
          course.sections.forEach((section: any, sectionIndex: number) => {
            if (section.lessons && Array.isArray(section.lessons)) {
              section.lessons.forEach((lesson: any, lessonIndex: number) => {
                if (lesson.quiz && !allQuizzes.find(q => q.id === lesson.quiz.id)) {
                  const moduleTitle = lesson.title || section.title || `Module ${sectionIndex + 1}`;
                  
                  allQuizzes.push({
                    id: lesson.quiz.id,
                    title: lesson.quiz.title || `${moduleTitle} Quiz`,
                    description: lesson.quiz.description || `Test your knowledge of ${moduleTitle}`,
                    moduleTitle,
                    type: 'module',
                    questions: lesson.quiz.questions || [],
                    passingScore: lesson.quiz.passingScore || 70,
                    maxAttempts: lesson.quiz.maxAttempts || 3,
                    isCompleted: false,
                    bestScore: undefined,
                    attempts: 0,
                    isUnlocked: true,
                    settings: {
                      passingScore: lesson.quiz.passingScore || 70,
                      maxAttempts: lesson.quiz.maxAttempts || 3,
                      showCorrectAnswers: lesson.quiz.settings?.showCorrectAnswers ?? true,
                      showScoreImmediately: lesson.quiz.settings?.showScoreImmediately ?? true
                    }
                  });
                }
              });
            }
            
            // Check for section-level module quizzes
            if (section.moduleQuiz && !allQuizzes.find(q => q.id === section.moduleQuiz.id)) {
              const moduleTitle = section.title || `Module ${sectionIndex + 1}`;
              
              allQuizzes.push({
                id: section.moduleQuiz.id,
                title: section.moduleQuiz.title || `${moduleTitle} Assessment`,
                description: section.moduleQuiz.description || `Assessment for ${moduleTitle}`,
                moduleTitle,
                type: 'module',
                questions: section.moduleQuiz.questions || [],
                passingScore: section.moduleQuiz.passingScore || 70,
                maxAttempts: section.moduleQuiz.maxAttempts || 3,
                isCompleted: false,
                bestScore: undefined,
                attempts: 0,
                isUnlocked: true,
                settings: {
                  passingScore: section.moduleQuiz.passingScore || 70,
                  maxAttempts: section.moduleQuiz.maxAttempts || 3,
                  showCorrectAnswers: section.moduleQuiz.settings?.showCorrectAnswers ?? true,
                  showScoreImmediately: section.moduleQuiz.settings?.showScoreImmediately ?? true
                }
              });
            }
          });
        }

        // Add final assessment if present
        if (course.finalAssessment && !allQuizzes.find(q => q.id === course.finalAssessment.id)) {
          allQuizzes.push({
            id: course.finalAssessment.id,
            title: course.finalAssessment.title || 'Final Assessment',
            description: course.finalAssessment.description || 'Comprehensive final assessment',
            moduleTitle: 'Final Assessment',
            type: 'final',
            questions: course.finalAssessment.questions || [],
            passingScore: course.finalAssessment.settings?.passingScore || 70,
            maxAttempts: course.finalAssessment.settings?.attempts || 3,
            isCompleted: false,
            bestScore: undefined,
            attempts: 0,
            isUnlocked: true,
            settings: {
              passingScore: course.finalAssessment.settings?.passingScore || 70,
              maxAttempts: course.finalAssessment.settings?.attempts || 3,
              showCorrectAnswers: course.finalAssessment.settings?.showCorrectAnswers ?? true,
              showScoreImmediately: course.finalAssessment.settings?.showResultsImmediately ?? true
            }
          });
        }
      }

      // Create sample quizzes if none found
      if (allQuizzes.length === 0) {
        console.log('No quizzes found, creating sample assessments...');
        
        // Create sample module quizzes
        for (let i = 1; i <= 3; i++) {
          allQuizzes.push({
            id: `sample_module_quiz_${i}`,
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
                type: 'multiple-choice',
                question: `What is the primary learning objective of Module ${i}?`,
                points: 1,
                options: [
                  { id: 'a', text: 'Understanding basic principles', isCorrect: i === 1 },
                  { id: 'b', text: 'Applying intermediate concepts', isCorrect: i === 2 },
                  { id: 'c', text: 'Mastering advanced techniques', isCorrect: i === 3 },
                  { id: 'd', text: 'All of the above', isCorrect: false }
                ],
                correctAnswer: i === 1 ? 'a' : i === 2 ? 'b' : 'c'
              }
            ],
            passingScore: 70,
            maxAttempts: 3,
            isCompleted: false,
            bestScore: undefined,
            attempts: 0,
            isUnlocked: true,
            settings: {
              passingScore: 70,
              maxAttempts: 3,
              showCorrectAnswers: true,
              showScoreImmediately: true
            }
          });
        }

        // Create final assessment
        allQuizzes.push({
          id: `sample_final_${courseId}`,
          title: 'Final Course Assessment',
          description: 'Comprehensive assessment covering all course material and concepts.',
          moduleTitle: 'Final Assessment',
          type: 'final',
          questions: [
            {
              id: 'final_q1',
              type: 'multiple-choice',
              question: 'Which statement best describes the overall course content?',
              points: 2,
              options: [
                { id: 'a', text: 'A comprehensive journey from basics to advanced concepts', isCorrect: true },
                { id: 'b', text: 'Only introductory material', isCorrect: false },
                { id: 'c', text: 'Advanced concepts only', isCorrect: false },
                { id: 'd', text: 'Unrelated topics', isCorrect: false }
              ],
              correctAnswer: 'a'
            },
            {
              id: 'final_q2',
              type: 'multiple-select',
              question: 'What skills have you developed through this course? (Select all that apply)',
              points: 2,
              options: [
                { id: 'a', text: 'Critical thinking', isCorrect: true },
                { id: 'b', text: 'Problem solving', isCorrect: true },
                { id: 'c', text: 'Practical application', isCorrect: true },
                { id: 'd', text: 'None of the above', isCorrect: false }
              ],
              correctAnswers: ['a', 'b', 'c']
            }
          ],
          passingScore: 70,
          maxAttempts: 3,
          isCompleted: false,
          bestScore: undefined,
          attempts: 0,
          isUnlocked: true,
          settings: {
            passingScore: 70,
            maxAttempts: 3,
            showCorrectAnswers: true,
            showScoreImmediately: true
          }
        });
      }

      // Process grades data with fallback
      let gradesData: QuizGrade[] = [];
      if (gradesResponse.success && gradesResponse.data?.grades) {
        gradesData = gradesResponse.data.grades;
      } else {
        console.warn('Grades API failed, continuing without detailed grade data:', {
          success: gradesResponse.success,
          error: gradesResult.status === 'rejected' ? gradesResult.reason : 'Unknown error'
        });
      }

      // Calculate completed quizzes and average score
      const completedQuizzes = allQuizzes.filter(q => q.isCompleted).length;
      const totalQuizzes = allQuizzes.length;
      
      // Calculate average from grades data (more accurate) with fallback to quiz data
      let averageScore = 0;
      if (gradesData.length > 0) {
        averageScore = Math.round(gradesData.reduce((sum, grade) => sum + grade.percentage, 0) / gradesData.length);
      } else {
        // Fallback: calculate from quiz bestScore data
        const completedQuizzesWithScores = allQuizzes.filter(q => q.isCompleted && q.bestScore !== undefined);
        if (completedQuizzesWithScores.length > 0) {
          averageScore = Math.round(completedQuizzesWithScores.reduce((sum, quiz) => sum + (quiz.bestScore || 0), 0) / completedQuizzesWithScores.length);
        }
      }

      const calculatedProgress = {
        completedQuizzes,
        totalQuizzes,
        averageScore: isNaN(averageScore) ? 0 : averageScore
      };

      setQuizzes(allQuizzes);
      setGrades(gradesData);
      setUserProgress(calculatedProgress);

      console.log('Assessments data fetching completed:', {
        totalQuizzes: allQuizzes.length,
        moduleQuizzes: allQuizzes.filter(q => q.type === 'module').length,
        finalAssessments: allQuizzes.filter(q => q.type === 'final').length,
        completedQuizzes,
        gradesCount: gradesData.length,
        averageScore: calculatedProgress.averageScore,
        sampleQuizzesCreated: allQuizzes.some(q => q.id.startsWith('sample_'))
      });

    } catch (err: any) {
      console.error('Error fetching assessments data:', err);
      
      // Try to provide partial functionality even if some APIs fail
      if (quizzes.length > 0) {
        // If we already have some quiz data, just show a warning
        console.warn('Some data may be outdated due to API errors');
        setError(''); // Clear error to allow partial functionality
      } else {
        // Only show full error if we have no data at all
        setError(err.message || 'Failed to load assessments and grades. Please try again.');
      }
    } finally {
      setLoading(false);
      if (!showLoading) setRefreshing(false);
    }
  };

  // Initial data fetch
  useEffect(() => {
    if (courseId) {
      fetchAssessmentsData();
    }
  }, [courseId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAssessmentsData(false);
  };

  const handleTakeQuiz = (quizId: string) => {
    const quiz = quizzes.find(q => q.id === quizId);
    if (quiz) {
      setSelectedQuiz(quiz);
      setShowQuizTaker(true);
    }
  };

  const handleQuizComplete = async (result: any) => {
    console.log('Quiz completed:', result);
    
    try {
      // Safely extract result properties with fallbacks
      const score = typeof result?.score === 'number' ? result.score : 0;
      const passed = Boolean(result?.passed);
      const percentage = typeof result?.percentage === 'number' ? result.percentage : score;
      
      // Update quiz status in local state immediately
      if (selectedQuiz) {
        setQuizzes(prevQuizzes =>
          prevQuizzes.map(q =>
            q.id === selectedQuiz.id
              ? {
                  ...q,
                  isCompleted: passed || q.isCompleted,
                  bestScore: Math.max(q.bestScore || 0, percentage),
                  attempts: (q.attempts || 0) + 1
                }
              : q
          )
        );
        
        console.log('✅ Local quiz state updated successfully:', {
          quizId: selectedQuiz.id,
          score: percentage,
          passed,
          attempts: (selectedQuiz.attempts || 0) + 1
        });
      }

      // Try to refresh data from server, but don't crash if it fails
      try {
        await fetchAssessmentsData(false);
        console.log('✅ Assessment data refreshed successfully');
      } catch (refreshError) {
        console.warn('⚠️ Failed to refresh data after quiz completion (non-critical):', refreshError);
        // This is non-critical - user can still see their results
      }
      
    } catch (error) {
      console.error('❌ Error in handleQuizComplete:', error);
      // Don't throw the error - let the quiz results still show
    }
    
    // Stay in quiz taker to show results
  };

  const handleCancelQuiz = () => {
    setShowQuizTaker(false);
    setSelectedQuiz(null);
  };

  const getQuizStatus = (quiz: Quiz) => {
    if (quiz.isCompleted) {
      if (quiz.bestScore && quiz.bestScore >= quiz.passingScore) {
        return { 
          status: 'passed', 
          color: 'success', 
          text: language === 'rw' ? 'Byarangiye' : 'Passed',
          icon: <CheckCircle className="w-4 h-4 text-green-600" />,
          variant: 'success' as const
        };
      } else {
        return { 
          status: 'failed', 
          color: 'warning', 
          text: language === 'rw' ? 'Ongera' : 'Retry',
          icon: <XCircle className="w-4 h-4 text-red-600" />,
          variant: 'error' as const
        };
      }
    } else {
      return { 
        status: 'available', 
        color: 'default', 
        text: language === 'rw' ? 'Biteguye' : 'Ready',
        icon: <Clock className="w-4 h-4 text-blue-600" />,
        variant: 'default' as const
      };
    }
  };

  // Get grade data for a specific quiz
  const getQuizGrade = (quizId: string): QuizGrade | undefined => {
    return grades.find(grade => grade.id === quizId);
  };

  if (showQuizTaker && selectedQuiz) {
    return (
      <ErrorBoundary
        fallback={
          <div className="max-w-4xl mx-auto space-y-6">
            <Card className="p-8 text-center">
              <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                {language === 'rw' ? 'Ikizamini cyanze' : 'Quiz Error'}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {language === 'rw' 
                  ? 'Habayeho ikosa mu kizamini. Ongera ugerageze cyangwa garuka ku bizamini.'
                  : 'An error occurred with the quiz. Please try again or go back to assessments.'
                }
              </p>
              <div className="flex justify-center space-x-4">
                <Button
                  onClick={() => {
                    setShowQuizTaker(false);
                    setSelectedQuiz(null);
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {language === 'rw' ? 'Garuka ku bizamini' : 'Back to Assessments'}
                </Button>
                <Button
                  onClick={() => window.location.reload()}
                  variant="outline"
                >
                  {language === 'rw' ? 'Vugurura urupapuro' : 'Reload Page'}
                </Button>
              </div>
            </Card>
          </div>
        }
      >
        <QuizTaker
          quiz={{
            ...selectedQuiz,
            settings: selectedQuiz.settings || {
              passingScore: selectedQuiz.passingScore,
              maxAttempts: selectedQuiz.maxAttempts,
              showCorrectAnswers: true,
              showScoreImmediately: true
            }
          }}
          courseId={courseId}
          onQuizComplete={handleQuizComplete}
          onCancel={handleCancelQuiz}
          currentAttempt={(selectedQuiz.attempts || 0) + 1}
        />
      </ErrorBoundary>
    );
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="p-8 text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            {language === 'rw' ? 'Turashaka ibizamini n\'amanota...' : 'Loading assessments and grades...'}
          </p>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {language === 'rw' ? 'Habayeho ikosa' : 'Error Loading Data'}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
          <Button
            onClick={() => fetchAssessmentsData()}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            {language === 'rw' ? 'Ongera ugerageze' : 'Try Again'}
          </Button>
        </Card>
      </div>
    );
  }

  const moduleQuizzes = quizzes.filter(quiz => quiz.type === 'module');
  const finalAssessment = quizzes.find(quiz => quiz.type === 'final');

  const QuizCard = ({ quiz }: { quiz: Quiz }) => {
    const status = getQuizStatus(quiz);
    const grade = getQuizGrade(quiz.id);
    const canTake = quiz.isUnlocked && !quiz.isCompleted;
    const canRetake = quiz.isCompleted && quiz.attempts < quiz.maxAttempts;
    
    return (
      <div 
        id={`quiz-${quiz.id}`}
        className={`transition-all duration-300 ${
          highlightedQuiz === quiz.id ? 'ring-2 ring-blue-500 ring-opacity-50 rounded-lg' : ''
        }`}
      >
        <div
          onClick={() => handleQuizAction(quiz, 'take')}
          onKeyDown={(event: React.KeyboardEvent) => handleQuizKeyDown(event, quiz)}
          role="button"
          tabIndex={0}
          className="cursor-pointer"
        >
          <Card className="p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start gap-4 flex-1">
              {/* Quiz Icon */}
              <div className="flex-shrink-0">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  quiz.type === 'final' 
                    ? 'bg-purple-100 dark:bg-purple-900/20' 
                    : 'bg-blue-100 dark:bg-blue-900/20'
                }`}>
                  {quiz.type === 'final' ? (
                    <Trophy className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  ) : (
                    <ClipboardList className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  )}
                </div>
              </div>

              {/* Quiz Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                    {quiz.title}
                  </h3>
                  {quiz.type === 'final' && (
                    <Badge variant="default" className="bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300">
                      {language === 'rw' ? 'Ikizamini cya Nyuma' : 'Final'}
                    </Badge>
                  )}
                </div>
                
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-3 line-clamp-2">
                  {quiz.description}
                </p>

                {/* Quiz Stats */}
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>{quiz.questions.length} {language === 'rw' ? 'ibibazo' : 'questions'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Target className="w-4 h-4" />
                    <span>{quiz.passingScore}% {language === 'rw' ? 'kugirango uhagaze' : 'to pass'}</span>
                  </div>
                  {quiz.attempts > 0 && (
                    <div className="flex items-center gap-1">
                      <RotateCcw className="w-4 h-4" />
                      <span>{quiz.attempts}/{quiz.maxAttempts} {language === 'rw' ? 'igerageza' : 'attempts'}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Status & Actions */}
            <div className="flex flex-col items-end gap-3">
              {/* Status Badge */}
              <div className="flex items-center gap-2">
                {status.icon}
                <Badge variant={status.variant} className="text-xs">
                  {status.text}
                </Badge>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {canTake ? (
                  <Button
                    onClick={() => handleQuizAction(quiz, 'take')}
                    className={`${
                      quiz.type === 'final'
                        ? 'bg-purple-600 hover:bg-purple-700 text-white'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                    aria-label={language === 'rw' ? 'Tangira ikizamini' : 'Start quiz'}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    {language === 'rw' ? 'Tangira' : 'Start'}
                  </Button>
                ) : quiz.isCompleted ? (
                  <div className="flex items-center gap-2">
                    {canRetake && (
                      <Button
                        onClick={() => handleQuizAction(quiz, 'retake')}
                        variant="outline"
                        className="border-gray-300 text-gray-700 hover:bg-gray-50"
                        aria-label={language === 'rw' ? 'Subiramo ikizamini' : 'Retake quiz'}
                      >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        {language === 'rw' ? 'Subiramo' : 'Retake'}
                      </Button>
                    )}
                    <Button
                      onClick={() => handleQuizAction(quiz, 'review')}
                      variant="outline"
                      className="border-blue-300 text-blue-700 hover:bg-blue-50"
                      aria-label={language === 'rw' ? 'Reba ikizamini' : 'Review quiz'}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      {language === 'rw' ? 'Reba' : 'Review'}
                    </Button>
                  </div>
                ) : (
                  <Button
                    disabled
                    variant="outline"
                    className="border-gray-300 text-gray-400 cursor-not-allowed"
                  >
                    <Lock className="w-4 h-4 mr-2" />
                    {language === 'rw' ? 'Ntibikora' : 'Locked'}
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Grade Display */}
          {grade && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {language === 'rw' ? 'Amanota yawe:' : 'Your score:'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-lg font-semibold ${
                    grade.passed ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    {grade.percentage}%
                  </span>
                  <Badge variant={grade.passed ? 'success' : 'error'} className="text-xs">
                    {grade.passed 
                      ? (language === 'rw' ? 'Uheze' : 'Passed')
                      : (language === 'rw' ? 'Ntibyageze' : 'Failed')
                    }
                  </Badge>
                </div>
              </div>
            </div>
          )}
          </Card>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
        {/* Enhanced Progress Header with Grades Overview */}
        <Card className="p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          {language === 'rw' ? 'Ibizamini n\'Amanota' : 'Assessments & Grades'}
        </h2>
        
        {userProgress && (
          <div className="space-y-6 mt-4">
            {/* Overall Progress Bar */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {language === 'rw' ? 'Iterambere muri rusange:' : 'Overall Progress:'}
                </span>
                <span className="text-sm font-bold text-gray-600">
                  {userProgress.totalQuizzes > 0 ? Math.round((userProgress.completedQuizzes / userProgress.totalQuizzes) * 100) : 0}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <div 
                  className="bg-blue-600 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${userProgress.totalQuizzes > 0 ? (userProgress.completedQuizzes / userProgress.totalQuizzes) * 100 : 0}%` }}
                />
              </div>
            </div>
            
            {/* Enhanced Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {userProgress.completedQuizzes}/{userProgress.totalQuizzes}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {language === 'rw' ? 'Ibizamini byarangiye' : 'Completed'}
                </div>
              </div>
              
              <div className="text-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className={`text-2xl font-bold ${
                  userProgress.averageScore >= 70 
                    ? 'text-green-600' 
                    : userProgress.averageScore >= 60 
                      ? 'text-yellow-600' 
                      : 'text-red-600'
                }`}>
                  {Math.round(userProgress.averageScore)}%
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {language === 'rw' ? 'Amanota yo hagati' : 'Average Grade'}
                </div>
              </div>
              
              <div className="text-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {grades.filter(g => g.passed).length}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {language === 'rw' ? 'Byarangiye neza' : 'Passed'}
                </div>
              </div>
              
              <div className="text-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {grades.reduce((sum, g) => sum + g.timeSpent, 0)}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {language === 'rw' ? 'Iminota yakoreshejwe' : 'Minutes Spent'}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Refresh Button */}
        <div className="flex justify-end mt-4">
          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {language === 'rw' ? 'Vugurura' : 'Refresh'}
          </Button>
        </div>
      </Card>

      {/* Module Quizzes */}
      {moduleQuizzes.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              {language === 'rw' ? 'Ibizamini by\'ibice' : 'Module Assessments'}
            </h3>
            <Badge variant="info" className="text-sm">
              {moduleQuizzes.filter(q => q.isCompleted).length} / {moduleQuizzes.length} {language === 'rw' ? 'byarangiye' : 'completed'}
            </Badge>
          </div>
          
          <div className="text-sm text-gray-600 dark:text-gray-400 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div className="flex items-start gap-2">
              <ClipboardList className="w-4 h-4 mt-0.5 text-gray-600" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  {language === 'rw' ? 'Amakuru y\'ibizamini' : 'About Module Assessments'}
                </p>
                <p className="mt-1">
                  {language === 'rw' 
                    ? 'Ibizamini byose biraboneka ubwo bwose. Reba amanota yawe yose hamwe n\'ibizamini.'
                    : 'All assessments are available anytime. View your grades and assessment details together.'
                  }
                </p>
              </div>
            </div>
          </div>
          
          <div className="grid gap-4">
            {moduleQuizzes.map(quiz => (
              <QuizCard key={quiz.id} quiz={quiz} />
            ))}
          </div>
        </div>
      )}

      {/* Final Assessment */}
      {finalAssessment && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              {language === 'rw' ? 'Ikizamini cya nyuma' : 'Final Assessment'}
            </h3>
            {finalAssessment.isCompleted && (
              <Badge variant="success" className="text-sm">
                {language === 'rw' ? 'Byarangiye' : 'Completed'}
              </Badge>
            )}
          </div>
          
          <div className="text-sm text-gray-600 dark:text-gray-400 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div className="flex items-start gap-2">
              <Trophy className="w-4 h-4 mt-0.5 text-gray-600" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  {language === 'rw' ? 'Ikizamini cya nyuma' : 'Final Assessment'}
                </p>
                <p className="mt-1">
                  {language === 'rw' 
                    ? 'Iki ni ikizamini cya nyuma cyaba gikomeye cyane kandi giraboneka ubwo bwose.'
                    : 'This comprehensive final assessment tests your overall understanding and is available anytime.'
                  }
                </p>
              </div>
            </div>
          </div>
          
          <QuizCard quiz={finalAssessment} />
        </div>
      )}

      {/* No Assessments Available */}
      {quizzes.length === 0 && (
        <Card className="p-12 text-center">
          <ClipboardList className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {language === 'rw' ? 'Nta bizamini biriho' : 'No Assessments Available'}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            {language === 'rw' 
              ? 'Nta bizamini byashyizweho muri iri somo'
              : 'No assessments have been created for this course yet'
            }
          </p>
        </Card>
      )}

      {/* Course Completion Status */}
      {userProgress && userProgress.completedQuizzes === userProgress.totalQuizzes && userProgress.averageScore >= 70 && (
        <Card className="p-8 text-center border-green-200 dark:border-green-800">
          <Trophy className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            {language === 'rw' ? 'Ushaka Waje!' : 'Course Completed!'}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {language === 'rw' 
              ? 'Warangije isomo ryose neza. Wahawe amanota meza!'
              : 'You have successfully completed the course with excellent grades!'
            }
          </p>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600 mb-2">{userProgress.averageScore}%</div>
            <div className="text-gray-600 dark:text-gray-400">
              {language === 'rw' ? 'Amanota ya nyuma' : 'Final Grade'}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}; 