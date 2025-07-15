import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { ProgressBar } from '../common/ProgressBar';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { apiClient } from '../../utils/api';
import { 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Trophy,
  Target,
  Brain,
  Lightbulb,
  RotateCcw,
  Play,
  BookOpen,
  HelpCircle,
  Award,
  TrendingUp,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  Flag,
  Star
} from 'lucide-react';

interface QuizQuestion {
  id: string;
  type: 'multiple-choice' | 'true-false' | 'multiple-select' | 'fill-blank' | 'drag-drop';
  question: string;
  options?: string[];
  correctAnswer: string | string[] | number;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  points: number;
  hints?: string[];
  category?: string;
  imageUrl?: string;
  videoUrl?: string;
}

interface QuizConfig {
  id: string;
  title: string;
  description: string;
  questions: QuizQuestion[];
  passingScore: number; // percentage
  maxAttempts: number;
  showCorrectAnswers: boolean;
  showExplanations: boolean;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  allowRetry: boolean;
  isAdaptive: boolean;
  courserId: string;
  moduleId?: string;
}

interface QuizAttempt {
  id: string;
  startTime: Date;
  endTime?: Date;
  answers: QuizAnswer[];
  score: number;
  passed: boolean;
  timeSpent: number;
  analytics: QuizAnalytics;
}

interface QuizAnswer {
  questionId: string;
  userAnswer: string | string[];
  isCorrect: boolean;
  timeSpent: number;
  hintsUsed: number;
  confidence: number; // 1-5 scale
}

interface QuizAnalytics {
  totalQuestions: number;
  correctAnswers: number;
  averageTimePerQuestion: number;
  difficultyBreakdown: {
    easy: { correct: number; total: number };
    medium: { correct: number; total: number };
    hard: { correct: number; total: number };
  };
  categoryPerformance: Record<string, { correct: number; total: number }>;
  adaptiveRecommendations: string[];
  weakAreas: string[];
  strongAreas: string[];
  improvementSuggestions: string[];
}

interface AutoGradedQuizProps {
  config: QuizConfig;
  onComplete: (attempt: QuizAttempt) => void;
  onProgress?: (progress: number) => void;
  onRetake?: () => void;
  onNextModule?: () => void;
  canRetake?: boolean;
  hasNextModule?: boolean;
  currentAttempt?: number;
  maxAttempts?: number;
  className?: string;
  isReadOnly?: boolean; // For completed courses
}

export const AutoGradedQuiz: React.FC<AutoGradedQuizProps> = ({
  config,
  onComplete,
  onProgress,
  onRetake,
  onNextModule,
  canRetake = true,
  hasNextModule = true,
  currentAttempt = 1,
  isReadOnly = false,
  maxAttempts = 3,
  className = ''
}) => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [isActive, setIsActive] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [confidence, setConfidence] = useState<Record<string, number>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<string>>(new Set());
  const [reviewedQuestions, setReviewedQuestions] = useState<Set<string>>(new Set());
  const [hintsUsed, setHintsUsed] = useState<Record<string, number>>({});
  const [showHint, setShowHint] = useState(false);
  const [currentHintIndex, setCurrentHintIndex] = useState(0);
  const [questionsOrder, setQuestionsOrder] = useState<number[]>([]);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [questionStartTime, setQuestionStartTime] = useState<Date | null>(null);
  const [questionTimes, setQuestionTimes] = useState<Record<string, number>>({});
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [attemptInfo, setAttemptInfo] = useState<{
    currentAttempts: number;
    maxAttempts: number;
    remainingAttempts: number;
    canTakeQuiz: boolean;
    bestScore: number;
    passed: boolean;
  } | null>(null);
  
  const currentQuestion = config.questions[questionsOrder[currentQuestionIndex]];
  const maxAttemptsAllowed = 3; // Fixed to exactly 3 attempts as requested

  // Initialize quiz
  useEffect(() => {
    initializeQuiz();
    fetchAttemptInfo();
  }, [config]);

  // Listen for retry events from toast notifications
  useEffect(() => {
    const handleRetryQuiz = () => {
      if (canRetake && currentAttempt < maxAttempts && onRetake) {
        onRetake();
      }
    };
    
    window.addEventListener('retryQuiz', handleRetryQuiz);
    
    return () => {
      window.removeEventListener('retryQuiz', handleRetryQuiz);
    };
  }, [canRetake, currentAttempt, maxAttempts, onRetake]);

  const fetchAttemptInfo = async () => {
    try {
      const response = await apiClient.getQuizAttempts(config.courserId, config.id);
      if (response.success && response.data) {
        // Override maxAttempts to ensure exactly 3 attempts
        const attemptData = {
          ...response.data,
          maxAttempts: maxAttemptsAllowed,
          remainingAttempts: Math.max(0, maxAttemptsAllowed - response.data.currentAttempts)
        };
        setAttemptInfo(attemptData);
      }
    } catch (error) {
      console.warn('Failed to fetch quiz attempt info:', error);
    }
  };

  const initializeQuiz = () => {
    // Shuffle questions if enabled
    let order = Array.from({ length: config.questions.length }, (_, i) => i);
    if (config.shuffleQuestions) {
      order = shuffleArray(order);
    }
    setQuestionsOrder(order);
    setStartTime(new Date());
    setQuestionStartTime(new Date());
  };

  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startQuiz = () => {
    // Check if user can take the quiz
    if (attemptInfo && !attemptInfo.canTakeQuiz) {
      setError(`You have reached the maximum number of attempts (${maxAttemptsAllowed}) for this quiz.`);
      return;
    }
    
    setIsActive(true);
    setStartTime(new Date());
    setQuestionStartTime(new Date());
    setError(''); // Clear any previous errors
  };

  const handleAnswer = (questionId: string, answer: string | string[]) => {
    // Prevent answering for completed courses
    if (isReadOnly) {
      return;
    }
    
    // Record time spent on current question
    if (questionStartTime) {
      const timeSpent = Date.now() - questionStartTime.getTime();
      setQuestionTimes(prev => ({
        ...prev,
        [questionId]: (prev[questionId] || 0) + timeSpent
      }));
    }

    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));

    // Auto-advance for single-choice questions
    if (currentQuestion.type === 'multiple-choice' || currentQuestion.type === 'true-false') {
      setTimeout(() => {
        if (currentQuestionIndex < config.questions.length - 1) {
          nextQuestion();
        }
      }, 500);
    }
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < config.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setQuestionStartTime(new Date());
      setShowHint(false);
      setCurrentHintIndex(0);
      
      // Update progress
      onProgress?.((currentQuestionIndex + 2) / config.questions.length * 100);
    } else {
      handleSubmit();
    }
  };

  const previousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
      setQuestionStartTime(new Date());
      setShowHint(false);
      setCurrentHintIndex(0);
    }
  };

  const toggleFlag = () => {
    const questionId = currentQuestion.id;
    setFlaggedQuestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(questionId)) {
        newSet.delete(questionId);
      } else {
        newSet.add(questionId);
      }
      return newSet;
    });
  };

  const useHint = () => {
    if (currentQuestion.hints && currentQuestion.hints.length > 0) {
      setHintsUsed(prev => ({
        ...prev,
        [currentQuestion.id]: (prev[currentQuestion.id] || 0) + 1
      }));
      setShowHint(true);
    }
  };

  const nextHint = () => {
    if (currentQuestion.hints && currentHintIndex < currentQuestion.hints.length - 1) {
      setCurrentHintIndex(prev => prev + 1);
      setHintsUsed(prev => ({
        ...prev,
        [currentQuestion.id]: (prev[currentQuestion.id] || 0) + 1
      }));
    }
  };

  const handleSubmit = async () => {
    // Prevent submission for completed courses
    if (isReadOnly) {
      setError('Quiz submission is disabled for completed courses.');
      return;
    }
    
    setIsActive(false);
    setIsCompleted(true);
    setIsLoading(true);
    setError('');

    try {
      const endTime = new Date();
      const totalTimeSpent = startTime ? endTime.getTime() - startTime.getTime() : 0;
      
      // Validate that all questions are answered
      const unansweredQuestions = config.questions.filter(q => !answers[q.id]);
      if (unansweredQuestions.length > 0) {
        setError(`Please answer all questions before submitting. Missing: ${unansweredQuestions.length} question(s).`);
        setIsLoading(false);
        setIsCompleted(false);
        setIsActive(true);
        return;
      }
      
      // Prepare answers for backend submission
      const submissionAnswers = Object.entries(answers).map(([questionId, answer]) => ({
        questionId,
        answer,
        timeSpent: questionTimes[questionId] || 0,
        hintsUsed: hintsUsed[questionId] || 0,
        confidence: confidence[questionId] || 3
      }));

      // Submit to backend for enhanced grading with retry logic
      if (user) {
        let response;
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
          try {
            // Ensure we have a valid token before submission
            const token = await apiClient.getToken();
            if (!token) {
              throw new Error('Authentication token not available');
            }
            
            response = await apiClient.submitQuizAttempt(config.courserId, {
              quizId: config.id,
              answers: submissionAnswers,
              score: 0, // Let backend calculate
              timeSpent: totalTimeSpent
            });

            if (response.success) {
              break; // Success, exit retry loop
            } else {
              throw new Error(response.error || 'Failed to submit quiz');
            }
          } catch (submitError) {
            retryCount++;
            console.warn(`Quiz submission attempt ${retryCount} failed:`, submitError);
            
            if (retryCount >= maxRetries) {
              throw submitError;
            }
            
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          }
        }

        if (!response || !response.success) {
          throw new Error('Failed to submit quiz after multiple attempts');
        }

        // Use backend grading results
        const backendResult = response.data;
        
        const attemptData: QuizAttempt = {
          id: `attempt-${Date.now()}`,
          startTime: startTime!,
          endTime,
          answers: backendResult.results.map((result: any) => ({
            questionId: result.questionId,
            userAnswer: result.userAnswer,
            isCorrect: result.isCorrect,
            timeSpent: result.timeSpent || 0,
            hintsUsed: result.hintsUsed || 0,
            confidence: confidence[result.questionId] || 3
          })),
          score: backendResult.score,
          passed: backendResult.passed,
          timeSpent: totalTimeSpent,
          analytics: {
            totalQuestions: backendResult.totalQuestions,
            correctAnswers: backendResult.correctAnswers,
            averageTimePerQuestion: backendResult.grading.averageTimePerQuestion || 0,
            difficultyBreakdown: backendResult.grading.difficultyAnalysis || {
              easy: { correct: 0, total: 0 },
              medium: { correct: 0, total: 0 },
              hard: { correct: 0, total: 0 }
            },
            categoryPerformance: {},
            adaptiveRecommendations: backendResult.grading.detailedFeedback?.recommendations || [],
            weakAreas: backendResult.grading.detailedFeedback?.improvements || [],
            strongAreas: backendResult.grading.detailedFeedback?.strengths || [],
            improvementSuggestions: backendResult.grading.detailedFeedback?.improvements || []
          }
        };

        setAttempt(attemptData);
        setShowResults(true);
        
        // Enhanced completion notification
        const isImprovement = backendResult.grading.allowRetake && 
                             backendResult.grading.difficultyAnalysis?.previousBestScore &&
                             backendResult.score > backendResult.grading.difficultyAnalysis.previousBestScore;
        
        // Show success notification
        if (backendResult.passed) {
          console.log(`🎉 Quiz Passed! Score: ${backendResult.score}%`);
          
          // Trigger success notification
          window.dispatchEvent(new CustomEvent('quizSuccess', {
            detail: {
              title: config.title,
              score: backendResult.score,
              passed: true,
              isImprovement,
              attempts: backendResult.quiz.currentAttempt,
              maxAttempts: backendResult.quiz.maxAttempts
            }
          }));
        } else {
          console.log(`Quiz Failed. Score: ${backendResult.score}%. Attempts: ${backendResult.quiz.currentAttempt}/${backendResult.quiz.maxAttempts}`);
          
          // Trigger failure notification with retry info
          window.dispatchEvent(new CustomEvent('quizFailure', {
            detail: {
              title: config.title,
              score: backendResult.score,
              passed: false,
              canRetry: backendResult.grading.allowRetake,
              attemptsLeft: backendResult.quiz.maxAttempts - backendResult.quiz.currentAttempt,
              passingScore: config.passingScore,
              isImprovement
            }
          }));
        }
        
        onComplete(attemptData);
        
        // Refresh attempt info after submission
        await fetchAttemptInfo();
      } else {
        // Fallback to frontend grading if not authenticated
        const gradedAnswers = gradeQuiz();
        const analytics = generateAnalytics(gradedAnswers);
        const score = calculateScore(gradedAnswers);
        const passed = score >= config.passingScore;

        const attemptData: QuizAttempt = {
          id: `attempt-${Date.now()}`,
          startTime: startTime!,
          endTime,
          answers: gradedAnswers,
          score,
          passed,
          timeSpent: totalTimeSpent,
          analytics
        };

        setAttempt(attemptData);
        setShowResults(true);
        onComplete(attemptData);
      }
    } catch (err: any) {
      console.error('Quiz submission error:', err);
      if (err.message && err.message.includes('maximum number of attempts')) {
        setError('You have reached the maximum number of attempts for this quiz.');
      } else {
        setError(err.message || 'Failed to submit quiz. Please try again.');
      }
      setIsCompleted(false);
      setIsActive(true);
    } finally {
      setIsLoading(false);
    }
  };

  const gradeQuiz = (): QuizAnswer[] => {
    return config.questions.map(question => {
      const userAnswer = answers[question.id];
      const isCorrect = checkAnswer(question, userAnswer);
      
      return {
        questionId: question.id,
        userAnswer: userAnswer || '',
        isCorrect,
        timeSpent: questionTimes[question.id] || 0,
        hintsUsed: hintsUsed[question.id] || 0,
        confidence: confidence[question.id] || 3
      };
    });
  };

  const checkAnswer = (question: QuizQuestion, userAnswer: string | string[]): boolean => {
    if (!userAnswer) return false;

    switch (question.type) {
      case 'multiple-choice':
      case 'true-false':
        return userAnswer === question.correctAnswer;
      
      case 'multiple-select':
        const correctAnswers = Array.isArray(question.correctAnswer) 
          ? question.correctAnswer 
          : [question.correctAnswer as string];
        const userAnswers = Array.isArray(userAnswer) ? userAnswer : [userAnswer];
        return correctAnswers.length === userAnswers.length &&
               correctAnswers.every(answer => userAnswers.includes(answer));
      
      case 'fill-blank':
        const correct = question.correctAnswer as string;
        const user = userAnswer as string;
        return correct.toLowerCase().trim() === user.toLowerCase().trim();
      
      default:
        return false;
    }
  };

  const calculateScore = (gradedAnswers: QuizAnswer[]): number => {
    const totalPoints = config.questions.reduce((sum, q) => sum + q.points, 0);
    const earnedPoints = gradedAnswers.reduce((sum, answer) => {
      const question = config.questions.find(q => q.id === answer.questionId);
      return sum + (answer.isCorrect ? (question?.points || 0) : 0);
    }, 0);
    
    return Math.round((earnedPoints / totalPoints) * 100);
  };

  const generateAnalytics = (gradedAnswers: QuizAnswer[]): QuizAnalytics => {
    const analytics: QuizAnalytics = {
      totalQuestions: config.questions.length,
      correctAnswers: gradedAnswers.filter(a => a.isCorrect).length,
      averageTimePerQuestion: Object.values(questionTimes).reduce((a, b) => a + b, 0) / config.questions.length,
      difficultyBreakdown: {
        easy: { correct: 0, total: 0 },
        medium: { correct: 0, total: 0 },
        hard: { correct: 0, total: 0 }
      },
      categoryPerformance: {},
      adaptiveRecommendations: [],
      weakAreas: [],
      strongAreas: [],
      improvementSuggestions: []
    };

    // Analyze by difficulty and category
    config.questions.forEach(question => {
      const answer = gradedAnswers.find(a => a.questionId === question.id);
      const isCorrect = answer?.isCorrect || false;

      // Difficulty breakdown
      analytics.difficultyBreakdown[question.difficulty].total++;
      if (isCorrect) {
        analytics.difficultyBreakdown[question.difficulty].correct++;
      }

      // Category performance
      if (question.category) {
        if (!analytics.categoryPerformance[question.category]) {
          analytics.categoryPerformance[question.category] = { correct: 0, total: 0 };
        }
        analytics.categoryPerformance[question.category].total++;
        if (isCorrect) {
          analytics.categoryPerformance[question.category].correct++;
        }
      }
    });

    // Generate recommendations
    Object.entries(analytics.categoryPerformance).forEach(([category, performance]) => {
      const percentage = (performance.correct / performance.total) * 100;
      if (percentage < 60) {
        analytics.weakAreas.push(category);
        analytics.improvementSuggestions.push(`Review ${category} concepts`);
      } else if (percentage > 80) {
        analytics.strongAreas.push(category);
      }
    });

    return analytics;
  };

  const renderQuestion = () => {
    if (!currentQuestion) return null;

    const questionOptions = config.shuffleOptions && currentQuestion.options
      ? shuffleArray([...currentQuestion.options])
      : currentQuestion.options;

    return (
      <Card className="p-6 mb-6">
        {/* Question Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Badge variant="info">
              Question {currentQuestionIndex + 1} of {config.questions.length}
            </Badge>
            <Badge variant={
              currentQuestion.difficulty === 'easy' ? 'success' :
              currentQuestion.difficulty === 'medium' ? 'warning' : 'error'
            }>
              {currentQuestion.difficulty}
            </Badge>
            {currentQuestion.category && (
              <Badge variant="default">{currentQuestion.category}</Badge>
            )}
            <div className="flex items-center space-x-1 text-sm text-gray-500">
              <Trophy className="w-4 h-4" />
              <span>{currentQuestion.points} pts</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleFlag}
              className={flaggedQuestions.has(currentQuestion.id) ? 'text-orange-600' : ''}
            >
              <Flag className="w-4 h-4" />
            </Button>
            {currentQuestion.hints && currentQuestion.hints.length > 0 && (
              <Button variant="ghost" size="sm" onClick={useHint}>
                <Lightbulb className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Question Content */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-4">{currentQuestion.question}</h3>
          
          {currentQuestion.imageUrl && (
            <img 
              src={currentQuestion.imageUrl} 
              alt="Question visual" 
              className="max-w-full h-auto rounded-lg mb-4"
            />
          )}

          {/* Answer Options */}
          <div className="space-y-3">
            {currentQuestion.type === 'multiple-choice' && questionOptions?.map((option, index) => (
              <label key={index} className="flex items-center space-x-3 p-3 rounded-lg border border-gray-200 hover:border-blue-300 cursor-pointer transition-colors">
                <input
                  type="radio"
                  name={currentQuestion.id}
                  value={option}
                  checked={answers[currentQuestion.id] === option}
                  onChange={(e) => handleAnswer(currentQuestion.id, e.target.value)}
                  className="text-blue-600"
                />
                <span>{option}</span>
              </label>
            ))}

            {currentQuestion.type === 'true-false' && (
              <div className="grid grid-cols-2 gap-4">
                {['True', 'False'].map((option) => (
                  <label key={option} className="flex items-center justify-center space-x-2 p-4 rounded-lg border border-gray-200 hover:border-blue-300 cursor-pointer transition-colors">
                    <input
                      type="radio"
                      name={currentQuestion.id}
                      value={option}
                      checked={answers[currentQuestion.id] === option}
                      onChange={(e) => handleAnswer(currentQuestion.id, e.target.value)}
                      className="text-blue-600"
                    />
                    <span className="font-medium">{option}</span>
                  </label>
                ))}
              </div>
            )}

            {currentQuestion.type === 'multiple-select' && questionOptions?.map((option, index) => (
              <label key={index} className="flex items-center space-x-3 p-3 rounded-lg border border-gray-200 hover:border-blue-300 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  value={option}
                  checked={(answers[currentQuestion.id] as string[] || []).includes(option)}
                  onChange={(e) => {
                    const currentAnswers = (answers[currentQuestion.id] as string[]) || [];
                    const newAnswers = e.target.checked
                      ? [...currentAnswers, option]
                      : currentAnswers.filter(a => a !== option);
                    handleAnswer(currentQuestion.id, newAnswers);
                  }}
                  className="text-blue-600"
                />
                <span>{option}</span>
              </label>
            ))}

            {currentQuestion.type === 'fill-blank' && (
              <input
                type="text"
                placeholder="Type your answer here..."
                value={(answers[currentQuestion.id] as string) || ''}
                onChange={(e) => handleAnswer(currentQuestion.id, e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
          </div>

          {/* Confidence Level */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              How confident are you in your answer?
            </label>
            <div className="flex space-x-2">
              {[1, 2, 3, 4, 5].map((level) => (
                <button
                  key={level}
                  onClick={() => setConfidence(prev => ({ ...prev, [currentQuestion.id]: level }))}
                  className={`p-2 rounded-full ${
                    confidence[currentQuestion.id] === level
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  }`}
                >
                  <Star className="w-4 h-4" />
                </button>
              ))}
            </div>
          </div>

          {/* Hint Display */}
          {showHint && currentQuestion.hints && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-yellow-800">
                  💡 Hint {currentHintIndex + 1} of {currentQuestion.hints.length}
                </h4>
                {currentHintIndex < currentQuestion.hints.length - 1 && (
                  <Button variant="ghost" size="sm" onClick={nextHint}>
                    Next Hint
                  </Button>
                )}
              </div>
              <p className="text-yellow-700">{currentQuestion.hints[currentHintIndex]}</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <Button
            variant="outline"
            onClick={previousQuestion}
            disabled={currentQuestionIndex === 0}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>

          <div className="text-sm text-gray-500">
            {currentQuestionIndex + 1} / {config.questions.length}
          </div>

          {currentQuestionIndex === config.questions.length - 1 ? (
            <Button 
              onClick={handleSubmit} 
              disabled={isLoading || isReadOnly}
              className={isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}
            >
              {isLoading ? 'Submitting...' : 
               isReadOnly ? 'Quiz Disabled (Course Completed)' : 'Submit Quiz'}
            </Button>
          ) : (
            <Button onClick={nextQuestion} disabled={isReadOnly}>
              Next
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </Card>
    );
  };

  const renderResults = () => {
    if (!attempt) return null;

    return (
      <div className="space-y-6">
        {/* Score Card */}
        <Card className="p-6 text-center">
          <div className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center mb-4 ${
            attempt.passed ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
          }`}>
            {attempt.passed ? (
              <Trophy className="w-12 h-12" />
            ) : (
              <RotateCcw className="w-12 h-12" />
            )}
          </div>
          
          <h2 className="text-3xl font-bold mb-2">{attempt.score}%</h2>
          <p className="text-lg mb-4">
            {attempt.passed ? (
              <span className="text-green-600 font-medium">🎉 Congratulations! You passed!</span>
            ) : (
              <span className="text-red-600 font-medium">Keep learning! You can retry.</span>
            )}
          </p>
          
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Correct Answers</p>
              <p className="font-semibold">{attempt.analytics.correctAnswers}/{attempt.analytics.totalQuestions}</p>
            </div>
            <div>
              <p className="text-gray-600">Time Spent</p>
              <p className="font-semibold">{Math.round(attempt.timeSpent / 1000 / 60)} min</p>
            </div>
            <div>
              <p className="text-gray-600">Avg per Question</p>
              <p className="font-semibold">{Math.round(attempt.analytics.averageTimePerQuestion / 1000)}s</p>
            </div>
          </div>
        </Card>

        {/* Performance Analysis */}
        <Card className="p-6">
          <h3 className="text-xl font-semibold mb-4">Performance Analysis</h3>
          
          {/* Difficulty Breakdown */}
          <div className="mb-6">
            <h4 className="font-medium mb-3">Performance by Difficulty</h4>
            <div className="space-y-2">
              {Object.entries(attempt.analytics.difficultyBreakdown).map(([difficulty, stats]) => (
                <div key={difficulty} className="flex items-center justify-between">
                  <span className="capitalize">{difficulty}</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${
                          difficulty === 'easy' ? 'bg-green-500' :
                          difficulty === 'medium' ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${(stats.correct / stats.total) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-600">
                      {stats.correct}/{stats.total}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recommendations */}
          {attempt.analytics.improvementSuggestions.length > 0 && (
            <div>
              <h4 className="font-medium mb-3">Improvement Suggestions</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                {attempt.analytics.improvementSuggestions.map((suggestion, index) => (
                  <li key={index}>{suggestion}</li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        {/* Action Buttons */}
        <Card className="p-4 bg-gray-50 dark:bg-gray-800">
          {/* Debug Info */}
          {/* Quiz Performance Summary */}
          <div className="mb-6 p-4 bg-white dark:bg-gray-700 rounded-lg border">
            <h4 className="font-medium text-gray-900 dark:text-white mb-3">Quiz Performance Summary</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{attempt.score}%</div>
                <div className="text-gray-600 dark:text-gray-400">Current Score</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">{attemptInfo?.bestScore || attempt.score}%</div>
                <div className="text-gray-600 dark:text-gray-400">Best Score</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{currentAttempt}</div>
                <div className="text-gray-600 dark:text-gray-400">Current Attempt</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{maxAttempts - currentAttempt}</div>
                <div className="text-gray-600 dark:text-gray-400">Attempts Left</div>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col gap-4">
            {/* Quiz Status Message */}
            <div className="text-center">
              {attempt.passed ? (
                <div className="flex items-center justify-center gap-2 text-green-600 mb-4">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium text-lg">Quiz Passed!</span>
                </div>
              ) : (
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 text-red-600 mb-2">
                    <XCircle className="w-5 h-5" />
                    <span className="font-medium text-lg">Quiz Failed</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Your score: {attempt.score}%
                  </p>
                  <p className="text-sm text-gray-600">
                    Passing score: {config.passingScore}%
                  </p>
                  {canRetake && currentAttempt < maxAttempts && (
                    <p className="text-sm text-blue-600 mt-2">
                      You can retake this quiz to improve your score
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Navigation Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {/* Retake Quiz Button */}
              {!attempt.passed && canRetake && currentAttempt < maxAttempts && onRetake && (
                <Button 
                  onClick={onRetake}
                  className="flex items-center justify-center gap-2 min-w-[140px]"
                >
                  <RotateCcw className="w-4 h-4" />
                  Retake Quiz
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full ml-2">
                    {maxAttempts - currentAttempt} left
                  </span>
                </Button>
              )}

              {/* Next Module Button */}
              {(attempt.passed || currentAttempt >= maxAttempts) && hasNextModule && onNextModule && (
                <Button 
                  onClick={onNextModule}
                  className="flex items-center justify-center gap-2 min-w-[140px]"
                  variant={attempt.passed ? "primary" : "outline"}
                >
                  <ChevronRight className="w-4 h-4" />
                  Next Module
                </Button>
              )}

              {/* Review Answers Button */}
              <Button 
                variant="outline" 
                onClick={() => setShowResults(false)}
                className="flex items-center justify-center gap-2 min-w-[140px]"
              >
                <Eye className="w-4 h-4" />
                Review Answers
              </Button>
            </div>

            {/* Attempt Counter */}
            <div className="text-center text-sm text-gray-500">
              <div className="flex items-center justify-center gap-2">
                <Flag className="w-4 h-4" />
                <span>Attempt {currentAttempt} of {maxAttempts}</span>
              </div>
              {currentAttempt >= maxAttempts && !attempt.passed && (
                <p className="text-red-600 mt-1">
                  No more attempts available
                </p>
              )}
            </div>
          </div>
        </Card>
      </div>
    );
  };

  if (showResults) {
    return (
      <div className={`max-w-4xl mx-auto ${className}`}>
        {renderResults()}
      </div>
    );
  }

  if (!isActive && !isCompleted) {
    return (
      <Card className="p-8 text-center max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold mb-4">{config.title}</h2>
        {isReadOnly && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-center gap-2">
              <BookOpen className="w-5 h-5 text-yellow-600" />
              <span className="text-yellow-800 font-medium">Read-Only Mode</span>
            </div>
            <p className="text-sm text-yellow-700 mt-1">
              This quiz is disabled because the course has been completed. You can review the questions but cannot submit new answers.
            </p>
          </div>
        )}
        <p className="text-gray-600 mb-6">{config.description}</p>
        
        <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
          <div className="p-4 bg-gray-50 rounded-lg">
            <Target className="w-6 h-6 mx-auto mb-2 text-gray-600" />
            <p className="font-medium">Passing Score</p>
            <p>{config.passingScore}%</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <BookOpen className="w-6 h-6 mx-auto mb-2 text-gray-600" />
            <p className="font-medium">Questions</p>
            <p>{config.questions.length}</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <RotateCcw className="w-6 h-6 mx-auto mb-2 text-gray-600" />
            <p className="font-medium">
              {attemptInfo ? 'Attempts Remaining' : 'Max Attempts'}
            </p>
            <p>
              {attemptInfo 
                ? `${attemptInfo.remainingAttempts} of ${attemptInfo.maxAttempts}`
                : maxAttemptsAllowed
              }
            </p>
          </div>
        </div>

        {attemptInfo && attemptInfo.bestScore > 0 && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-800">Previous Best Score</p>
                <p className="text-lg font-bold text-blue-900">{attemptInfo.bestScore}%</p>
              </div>
              {attemptInfo.passed && (
                <div className="flex items-center px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Passed
                </div>
              )}
            </div>
          </div>
        )}

        {attemptInfo && !attemptInfo.canTakeQuiz ? (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <XCircle className="w-5 h-5 text-red-500 mr-2" />
              <span className="text-red-700 font-medium">
                You have reached the maximum number of attempts ({maxAttemptsAllowed}) for this quiz.
              </span>
            </div>
            {attemptInfo.bestScore > 0 && (
              <p className="mt-2 text-sm text-red-600">
                Your best score was {attemptInfo.bestScore}%.
              </p>
            )}
          </div>
        ) : (
          <Button 
            onClick={startQuiz} 
            size="lg"
            disabled={attemptInfo ? !attemptInfo.canTakeQuiz : false}
          >
            <Play className="w-5 h-5 mr-2" />
            {attemptInfo && attemptInfo.currentAttempts > 0 ? 'Retake Quiz' : 'Start Quiz'}
          </Button>
        )}
      </Card>
    );
  }

  return (
    <div className={`max-w-4xl mx-auto ${className}`}>
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
            <span className="text-red-700">{error}</span>
          </div>
        </div>
      )}

      {/* Quiz Header */}
      <div className="mb-6 p-4 bg-white rounded-lg shadow-sm border">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">{config.title}</h2>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-blue-600">
              <Target className="w-4 h-4" />
              <span className="text-sm font-medium">
                {attemptInfo ? 'Attempts Remaining' : 'Max Attempts'}
              </span>
            </div>
            {flaggedQuestions.size > 0 && (
              <div className="flex items-center space-x-1 text-orange-600">
                <Flag className="w-4 h-4" />
                <span className="text-sm">{flaggedQuestions.size} flagged</span>
              </div>
            )}
          </div>
        </div>
        
        {attemptInfo && attemptInfo.bestScore > 0 && (
          <div className="mt-2 text-sm text-gray-600">
            Best Score: <span className="font-medium text-gray-800">{attemptInfo.bestScore}%</span>
            {attemptInfo.passed && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                <CheckCircle className="w-3 h-3 mr-1" />
                Passed
              </span>
            )}
          </div>
        )}
        
        <div className="mt-4">
          <ProgressBar 
            value={(currentQuestionIndex + 1) / config.questions.length * 100}
            className="h-2"
          />
        </div>
      </div>

      {/* Question */}
      {renderQuestion()}
    </div>
  );
}; 