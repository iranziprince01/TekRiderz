import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
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
  TrendingUp
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
  
  // State management
  const [quizzes, setQuizzes] = useState<Quiz[]>(initialQuizzes);
  const [grades, setGrades] = useState<QuizGrade[]>([]);
  const [userProgress, setUserProgress] = useState(initialUserProgress);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [currentQuiz, setCurrentQuiz] = useState<Quiz | null>(null);
  const [showQuizTaker, setShowQuizTaker] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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
      setCurrentQuiz(quiz);
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
      if (currentQuiz) {
        setQuizzes(prevQuizzes =>
          prevQuizzes.map(q =>
            q.id === currentQuiz.id
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
          quizId: currentQuiz.id,
          score: percentage,
          passed,
          attempts: (currentQuiz.attempts || 0) + 1
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
    setCurrentQuiz(null);
  };

  const getQuizStatus = (quiz: Quiz) => {
    if (quiz.isCompleted) {
      if (quiz.bestScore && quiz.bestScore >= quiz.passingScore) {
        return { status: 'passed', color: 'success', text: language === 'rw' ? 'Byarangiye' : 'Passed' };
      } else {
        return { status: 'failed', color: 'warning', text: language === 'rw' ? 'Ongera' : 'Retry' };
      }
    } else {
      return { status: 'available', color: 'default', text: language === 'rw' ? 'Biteguye' : 'Ready' };
    }
  };

  // Get grade data for a specific quiz
  const getQuizGrade = (quizId: string): QuizGrade | undefined => {
    return grades.find(grade => grade.id === quizId);
  };

  if (showQuizTaker && currentQuiz) {
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
                    setCurrentQuiz(null);
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
            ...currentQuiz,
            settings: currentQuiz.settings || {
              passingScore: currentQuiz.passingScore,
              maxAttempts: currentQuiz.maxAttempts,
              showCorrectAnswers: true,
              showScoreImmediately: true
            }
          }}
          courseId={courseId}
          onQuizComplete={handleQuizComplete}
          onCancel={handleCancelQuiz}
          currentAttempt={(currentQuiz.attempts || 0) + 1}
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
    const canTake = quiz.isUnlocked && (quiz.attempts < quiz.maxAttempts);
    const maxAttemptsReached = quiz.attempts >= quiz.maxAttempts;
    const grade = getQuizGrade(quiz.id);
    
    return (
      <Card className="p-6 hover:shadow-lg transition-shadow">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-4 flex-1">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              quiz.type === 'final' 
                ? 'bg-purple-100 dark:bg-purple-900' 
                : 'bg-blue-100 dark:bg-blue-900'
            }`}>
              {quiz.type === 'final' ? (
                <Trophy className={`w-6 h-6 ${
                  quiz.type === 'final' 
                    ? 'text-purple-600 dark:text-purple-400' 
                    : 'text-blue-600 dark:text-blue-400'
                }`} />
              ) : (
                <ClipboardList className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              )}
            </div>
            
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {quiz.title}
                </h3>
                <Badge variant={status.color as any}>
                  {status.text}
                </Badge>
                {quiz.type === 'final' && (
                  <Badge variant="info">
                    {language === 'rw' ? 'Ikizamini cya nyuma' : 'Final'}
                  </Badge>
                )}
              </div>
              
              {quiz.moduleTitle && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  {language === 'rw' ? 'Igice:' : 'Module:'} {quiz.moduleTitle}
                </p>
              )}
              
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                {quiz.description}
              </p>
              
              {/* Quiz Stats */}
              <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-4">
                <div className="flex items-center gap-1">
                  <ClipboardList className="w-4 h-4" />
                  {quiz.questions.length} {language === 'rw' ? 'ibibazo' : 'questions'}
                </div>
                
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4" />
                  {quiz.passingScore}% {language === 'rw' ? 'ntagomba kurangiza' : 'to pass'}
                </div>
                
                <div className="flex items-center gap-1">
                  <RotateCcw className="w-4 h-4" />
                  {quiz.attempts}/{quiz.maxAttempts} {language === 'rw' ? 'ibigeragezo' : 'attempts'}
                </div>
              </div>
              
              {/* Enhanced Grade Display */}
              {grade ? (
                <div className="space-y-3">
                  {/* Main Score Display */}
                  <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {grade.passed ? (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-600" />
                        )}
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {language === 'rw' ? 'Amanota ya nyuma:' : 'Final Grade:'}
                        </span>
                      </div>
                      <span className={`text-xl font-bold ${
                        grade.passed 
                          ? 'text-green-600' 
                          : 'text-red-600'
                      }`}>
                        {Math.round(grade.percentage)}%
                      </span>
                    </div>
                    
                    {/* Additional Grade Details */}
                    <div className="grid grid-cols-2 gap-4 text-xs text-gray-600 dark:text-gray-400">
                      <div className="flex items-center gap-1">
                        <BarChart3 className="w-3 h-3" />
                        <span>{grade.score}/{grade.maxScore} {language === 'rw' ? 'points' : 'points'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{grade.timeSpent} {language === 'rw' ? 'iminota' : 'min'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        <span>{grade.attempts} {language === 'rw' ? 'igerageza' : 'attempts'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Trophy className="w-3 h-3" />
                        <span className={grade.passed ? 'text-green-600' : 'text-red-600'}>
                          {grade.passed ? (language === 'rw' ? 'Byarangiye' : 'Passed') : (language === 'rw' ? 'Ntibyarangiye' : 'Failed')}
                        </span>
                      </div>
                    </div>
                    
                    {/* Completion Date */}
                    <div className="mt-2 pt-2 border-t border-blue-200 dark:border-blue-700">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {language === 'rw' ? 'Byarangiye ku ya:' : 'Completed on:'} {' '}
                        {new Date(grade.completedAt).toLocaleDateString(language === 'rw' ? 'rw' : 'en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              ) : quiz.isCompleted && quiz.bestScore !== undefined ? (
                // Fallback to basic score display if no detailed grade data
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {language === 'rw' ? 'Amanota meza:' : 'Best Score:'}
                    </span>
                    <span className={`text-lg font-bold ${
                      quiz.bestScore >= quiz.passingScore 
                        ? 'text-green-600' 
                        : 'text-orange-600'
                    }`}>
                      {quiz.bestScore}%
                    </span>
                  </div>
                </div>
              ) : null}

              {/* Max Attempts Message */}
              {maxAttemptsReached && (
                <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-700 dark:text-red-300">
                    {language === 'rw' 
                      ? 'Warangije ibigeragezo byose byemewe'
                      : 'You have used all available attempts'
                    }
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-end">
          {canTake ? (
            <Button
              onClick={() => handleTakeQuiz(quiz.id)}
              className={`${
                quiz.type === 'final'
                  ? 'bg-purple-600 hover:bg-purple-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              } text-white`}
            >
              {quiz.isCompleted ? (
                <>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  {language === 'rw' ? 'Ongera ukingize' : 'Retake Quiz'}
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  {language === 'rw' ? 'Tangira ikizamini' : 'Start Quiz'}
                </>
              )}
            </Button>
          ) : (
            <Button disabled variant="outline">
              {maxAttemptsReached ? (
                language === 'rw' ? 'Nta gerageza risigaye' : 'No attempts left'
              ) : (
                language === 'rw' ? 'Ntikigufunguye' : 'Not available'
              )}
            </Button>
          )}
        </div>
      </Card>
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