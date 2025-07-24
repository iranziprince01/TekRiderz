import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { submitQuiz } from '../../utils/api';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { 
  ArrowLeft,
  ArrowRight, 
  CheckCircle,
  XCircle,
  Clock,
  Flag,
  Target,
  AlertCircle,
  Trophy,
  Star,
  TrendingUp,
  RotateCcw,
  Lightbulb,
  Send
} from 'lucide-react';

interface QuizQuestion {
  id: string;
  type: 'multiple-choice' | 'true-false' | 'multiple-select' | 'fill-blank' | 'essay';
  question: string;
  points?: number;
  options?: { id: string; text: string; isCorrect?: boolean }[];
  correctAnswer?: any;
  explanation?: string;
  hints?: string[];
  image?: string;
}

interface Quiz {
  id: string;
  title: string;
  description: string;
  questions: QuizQuestion[];
  settings: {
    passingScore: number;
    maxAttempts: number;
    showCorrectAnswers?: boolean;
    showScoreImmediately?: boolean;
  };
  type: 'module' | 'final';
  moduleTitle?: string;
}

interface QuizTakerProps {
  quiz: Quiz;
  courseId: string;
  onQuizComplete: (result: any) => void;
  onCancel: () => void;
  currentAttempt?: number;
}

interface QuizResult {
  score: number;
  passed: boolean;
  totalQuestions: number;
  correctAnswers: number;
  percentage: number;
  feedback?: string;
  showCorrectAnswers?: boolean;
  gradeSavedToAccount?: boolean;
}

export const QuizTaker: React.FC<QuizTakerProps> = ({
  quiz,
  courseId,
  onQuizComplete,
  onCancel,
  currentAttempt = 1
}) => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { theme } = useTheme();
  
  // Safety checks for required props
  if (!quiz || !courseId || !quiz.questions || !Array.isArray(quiz.questions)) {
    console.error('QuizTaker: Missing or invalid required props:', {
      hasQuiz: !!quiz,
      hasCourseId: !!courseId,
      hasQuestions: quiz?.questions && Array.isArray(quiz.questions),
      questionsLength: quiz?.questions?.length
    });
    
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {language === 'rw' ? 'Ikizamini ntikigiye neza' : 'Quiz Not Available'}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {language === 'rw' 
              ? 'Ikizamini kitagiye neza cyangwa nta bibazo birimo. Garuka ku bizamini.'
              : 'The quiz is not properly configured or has no questions. Please go back to assessments.'
            }
          </p>
          <Button
            onClick={onCancel}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {language === 'rw' ? 'Garuka ku bizamini' : 'Back to Assessments'}
          </Button>
        </Card>
      </div>
    );
  }
  
  if (quiz.questions.length === 0) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="p-8 text-center">
          <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {language === 'rw' ? 'Nta bibazo biri muri iki kizamini' : 'No Questions Available'}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {language === 'rw' 
              ? 'Iki kizamini nta bibazo kirimo. Garuka ku bizamini.'
              : 'This quiz has no questions. Please go back to assessments.'
            }
          </p>
          <Button
            onClick={onCancel}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {language === 'rw' ? 'Garuka ku bizamini' : 'Back to Assessments'}
          </Button>
        </Card>
      </div>
    );
  }
  
  // Quiz state
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<{ [questionId: string]: any }>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<string>>(new Set());
  
  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [quizResult, setQuizResult] = useState<any>(null);
  const [showInstructions, setShowInstructions] = useState(true);
  const [usedHints, setUsedHints] = useState<{ [questionId: string]: number }>({});

  // Accessibility event listeners
  useEffect(() => {
    const handleStartCurrentQuiz = () => {
      console.log('🎯 Accessibility: Starting current quiz');
      if (showInstructions) {
        setShowInstructions(false);
      }
    };

    const handleSubmitCurrentQuiz = () => {
      console.log('🎯 Accessibility: Submitting current quiz');
      if (!showInstructions && !showResults && !isSubmitting) {
        handleSubmitQuiz();
      }
    };

    const handleNextQuestionEvent = () => {
      console.log('🎯 Accessibility: Moving to next question');
      if (!showInstructions && !showResults) {
        handleNextQuestion();
      }
    };

    const handlePreviousQuestionEvent = () => {
      console.log('🎯 Accessibility: Moving to previous question');
      if (!showInstructions && !showResults) {
        handlePreviousQuestion();
      }
    };

    // Add event listeners
    window.addEventListener('startCurrentQuiz', handleStartCurrentQuiz);
    window.addEventListener('submitCurrentQuiz', handleSubmitCurrentQuiz);
    window.addEventListener('continueNextQuestion', handleNextQuestionEvent);
    window.addEventListener('continuePreviousQuestion', handlePreviousQuestionEvent);

    // Cleanup
    return () => {
      window.removeEventListener('startCurrentQuiz', handleStartCurrentQuiz);
      window.removeEventListener('submitCurrentQuiz', handleSubmitCurrentQuiz);
      window.removeEventListener('continueNextQuestion', handleNextQuestionEvent);
      window.removeEventListener('continuePreviousQuestion', handlePreviousQuestionEvent);
    };
  }, [showInstructions, showResults, isSubmitting]);

  // Keyboard navigation for quiz interactions
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle keyboard shortcuts when quiz is active (not in instructions or results)
      if (showInstructions || showResults) return;

      switch (event.key) {
        case 'ArrowRight':
        case 'n':
          event.preventDefault();
          if (currentQuestionIndex < quiz.questions.length - 1) {
            handleNextQuestion();
          }
          break;
        case 'ArrowLeft':
        case 'p':
          event.preventDefault();
          if (currentQuestionIndex > 0) {
            handlePreviousQuestion();
          }
          break;
        case 'Enter':
          event.preventDefault();
          if (event.ctrlKey) {
            // Ctrl+Enter submits the quiz
            if (!isSubmitting) {
              handleSubmitQuiz();
            }
          }
          break;
        case ' ':
          event.preventDefault();
          // Space toggles flag on current question
          toggleQuestionFlag(quiz.questions[currentQuestionIndex].id);
          break;
        case 'h':
          event.preventDefault();
          // 'h' key uses hint if available
          const currentQuestion = quiz.questions[currentQuestionIndex];
          if (currentQuestion.hints && currentQuestion.hints.length > 0) {
            useHint(currentQuestion.id);
          }
          break;
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
          event.preventDefault();
          // Number keys navigate to specific questions
          const questionIndex = parseInt(event.key) - 1;
          if (questionIndex >= 0 && questionIndex < quiz.questions.length) {
            handleQuestionNavigation(questionIndex);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentQuestionIndex, showInstructions, showResults, isSubmitting, quiz.questions]);

  const currentQuestion = quiz.questions[currentQuestionIndex];
  const totalQuestions = quiz.questions.length;
  const isLastQuestion = currentQuestionIndex === totalQuestions - 1;
  const answeredQuestions = Object.keys(answers).length;

  const handleAnswerChange = (questionId: string, answer: any) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleQuestionNavigation = (index: number) => {
    setCurrentQuestionIndex(index);
  };

  const toggleQuestionFlag = (questionId: string) => {
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

  const useHint = (questionId: string) => {
    setUsedHints(prev => ({
      ...prev,
      [questionId]: (prev[questionId] || 0) + 1
    }));
  };

  const handleSubmitQuiz = async () => {
    if (!courseId || !quiz) return;
    
    setIsSubmitting(true);
    
    try {
      // Prepare answers for submission
      const answersArray = Object.entries(answers).map(([questionId, answer]) => ({
        questionId,
        answer,
        timeSpent: 5, // Simple time tracking
        hintsUsed: 0,
        confidence: 3
      }));

      const response = await submitQuiz(courseId, quiz.id, answersArray, 300);

      if (response.success && response.data) {
        const { score, passed, totalQuestions, correctAnswers, grading } = response.data;
        
        // Check if grade was properly saved
        if (grading?.gradeSavedToAccount) {
          console.log('✅ Quiz grade successfully saved to account:', {
            score,
            passed,
            gradeSavedToAccount: grading.gradeSavedToAccount
          });
        } else {
          console.warn('⚠️ Quiz graded but save status unclear');
        }
        
        const quizResult = {
          score,
          passed,
          totalQuestions,
          correctAnswers,
          percentage: Math.round((correctAnswers / totalQuestions) * 100),
          feedback: grading?.feedback || 'Quiz completed',
          showCorrectAnswers: grading?.showCorrectAnswers || false,
          gradeSavedToAccount: grading?.gradeSavedToAccount || false,
          results: response.data.results || [],
          grading: grading || {}
        };
        
        setQuizResult(quizResult);
        setShowResults(true);
        
        // Call onQuizComplete with properly structured result
        try {
          await onQuizComplete({
            score: score,
            passed: passed,
            percentage: Math.round((correctAnswers / totalQuestions) * 100),
            totalQuestions: totalQuestions,
            correctAnswers: correctAnswers,
            gradeSaved: grading?.gradeSavedToAccount || false
          });
        } catch (completeError) {
          console.warn('Error in onQuizComplete callback:', completeError);
          // Don't prevent showing results if callback fails
        }
        
        // Dispatch progress update event for other components
        window.dispatchEvent(new CustomEvent('quiz-completed', {
          detail: { 
            courseId, 
            quizId: quiz.id, 
            passed, 
            score,
            gradeSaved: grading?.gradeSavedToAccount 
          }
        }));
        
      } else {
        throw new Error(response.error || 'Failed to submit quiz');
      }
    } catch (error) {
      console.error('Quiz submission failed:', error);
      
      // Show user-friendly error message
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      alert(
        language === 'rw'
          ? `Habayeho ikosa: ${errorMessage}. Ongera ugerageze.`
          : `An error occurred: ${errorMessage}. Please try again.`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderQuestion = (question: QuizQuestion) => {
    const questionAnswer = answers[question.id];

    switch (question.type) {
      case 'multiple-choice':
        return (
          <div className="space-y-3">
            {question.options?.map((option) => (
              <label
                key={option.id}
                className="flex items-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
              >
                <input
                  type="radio"
                  name={question.id}
                  value={option.id}
                  checked={questionAnswer === option.id}
                  onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                  className="mr-3 h-4 w-4 text-blue-600"
                />
                <span className="text-gray-900 dark:text-white">{option.text}</span>
              </label>
            ))}
          </div>
        );

      case 'true-false':
        return (
          <div className="space-y-3">
            {['true', 'false'].map((value) => (
              <label
                key={value}
                className="flex items-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
              >
                <input
                  type="radio"
                  name={question.id}
                  value={value}
                  checked={questionAnswer === value}
                  onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                  className="mr-3 h-4 w-4 text-blue-600"
                />
                <span className="text-gray-900 dark:text-white">
                  {value === 'true' 
                    ? (language === 'rw' ? 'Byakuri' : 'True')
                    : (language === 'rw' ? 'Ntibikuri' : 'False')
                  }
                </span>
              </label>
            ))}
          </div>
        );

      case 'multiple-select':
        const selectedOptions = questionAnswer || [];
        return (
          <div className="space-y-3">
            {question.options?.map((option) => (
              <label
                key={option.id}
                className="flex items-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedOptions.includes(option.id)}
                  onChange={(e) => {
                    const newSelection = e.target.checked
                      ? [...selectedOptions, option.id]
                      : selectedOptions.filter((id: string) => id !== option.id);
                    handleAnswerChange(question.id, newSelection);
                  }}
                  className="mr-3 h-4 w-4 text-blue-600 rounded"
                />
                <span className="text-gray-900 dark:text-white">{option.text}</span>
              </label>
            ))}
          </div>
        );

      case 'fill-blank':
        return (
          <div>
            <input
              type="text"
              value={questionAnswer || ''}
              onChange={(e) => handleAnswerChange(question.id, e.target.value)}
              placeholder={language === 'rw' ? 'Andika igisubizo cyawe...' : 'Type your answer...'}
              className="w-full p-4 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>
        );

      case 'essay':
        return (
          <div>
            <textarea
              value={questionAnswer || ''}
              onChange={(e) => handleAnswerChange(question.id, e.target.value)}
              placeholder={language === 'rw' ? 'Andika igisubizo cyawe kirambuye...' : 'Write your detailed answer...'}
              rows={6}
              className="w-full p-4 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-vertical"
            />
          </div>
        );

      default:
        return <div>Unsupported question type</div>;
    }
  };

  const renderResults = () => {
    if (!quizResult) return null;

    const { score, passed, correctAnswers, totalQuestions, results, grading } = quizResult;

    return (
      <div className="space-y-6">
        {/* Results Header */}
        <Card className={`p-8 text-center ${passed ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'}`}>
          <div className="mb-4">
            {passed ? (
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
            ) : (
              <XCircle className="w-16 h-16 text-red-500 mx-auto" />
            )}
          </div>
          
          <h2 className={`text-3xl font-bold mb-2 ${passed ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
            {passed 
              ? (language === 'rw' ? 'Ikizamini cyarangiye neza!' : 'Quiz Passed!')
              : (language === 'rw' ? 'Ikizamini cyarangiye ariko...' : 'Quiz Completed')
            }
          </h2>
          
          <div className="space-y-2">
            <div className={`text-6xl font-bold ${passed ? 'text-green-600' : 'text-red-600'}`}>
              {Math.round(score)}%
            </div>
            <div className="text-gray-600 dark:text-gray-400">
              {correctAnswers}/{totalQuestions} {language === 'rw' ? 'ibibazo byasubijweho neza' : 'correct answers'}
            </div>
            <div className="text-sm text-gray-500">
              {grading.passingScore}% {language === 'rw' ? 'ntagomba kurangiza' : 'required to pass'}
            </div>
          </div>
        </Card>

        {/* Detailed Results */}
        {grading.showCorrectAnswers && results && (
          <Card className="p-6">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              {language === 'rw' ? 'Ibisubizo birambuye' : 'Detailed Results'}
            </h3>
            
            <div className="space-y-4">
              {results.map((result: any, index: number) => {
                const question = quiz.questions.find(q => q.id === result.questionId);
                if (!question) return null;

                return (
                  <div key={result.questionId} className={`p-4 rounded-lg border ${result.isCorrect ? 'border-green-200 bg-green-50 dark:bg-green-900/20' : 'border-red-200 bg-red-50 dark:bg-red-900/20'}`}>
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        {language === 'rw' ? 'Ikibazo' : 'Question'} {index + 1}
                      </h4>
                      <div className="flex items-center gap-2">
                        {result.isCorrect ? (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-500" />
                        )}
                        <span className="text-sm font-medium">
                          {result.points}/{result.maxPoints} {language === 'rw' ? 'utunguranye' : 'pts'}
                        </span>
                      </div>
                    </div>
                    
                    <p className="text-gray-700 dark:text-gray-300 mb-3">{question.question}</p>
                    
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="font-medium text-gray-600 dark:text-gray-400">
                          {language === 'rw' ? 'Igisubizo cyawe:' : 'Your answer:'}
                        </span>
                        <span className="ml-2 text-gray-900 dark:text-white">
                          {Array.isArray(result.userAnswer) ? result.userAnswer.join(', ') : result.userAnswer}
                        </span>
                      </div>
                      
                      {!result.isCorrect && result.correctAnswer && (
                        <div>
                          <span className="font-medium text-gray-600 dark:text-gray-400">
                            {language === 'rw' ? 'Igisubizo cy\'ukuri:' : 'Correct answer:'}
                          </span>
                          <span className="ml-2 text-green-600">
                            {Array.isArray(result.correctAnswer) ? result.correctAnswer.join(', ') : result.correctAnswer}
                          </span>
                        </div>
                      )}
                      
                      {result.explanation && (
                        <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-blue-800 dark:text-blue-200">
                          <span className="font-medium">{language === 'rw' ? 'Igisobanuro:' : 'Explanation:'}</span>
                          <span className="ml-2">{result.explanation}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}


      </div>
    );
  };

  // Handle quiz instructions view
      if (showInstructions) {
      return (
        <div className="max-w-4xl mx-auto space-y-6">
          <Card className="p-8">
            <div className="text-center mb-6">
              <Trophy className="w-16 h-16 text-blue-500 mx-auto mb-4" />
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                {quiz.title}
              </h1>
              <p className="text-gray-600 dark:text-gray-400">{quiz.description}</p>
            </div>

            {/* Quiz Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="text-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <Target className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-blue-600">{totalQuestions}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {language === 'rw' ? 'Ibibazo' : 'Questions'}
                </div>
              </div>
              
              <div className="text-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-green-600">{quiz.settings.passingScore}%</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {language === 'rw' ? 'Ntagomba kurangiza' : 'To Pass'}
                </div>
              </div>
              
              <div className="text-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <RotateCcw className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-purple-600">{quiz.settings.maxAttempts}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {language === 'rw' ? 'Ibigeragezo' : 'Attempts'}
                </div>
              </div>
            </div>

            {/* Instructions */}
            <div className="mb-8 p-6 border border-gray-200 dark:border-gray-700 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                {language === 'rw' ? 'Amabwiriza' : 'Instructions'}
              </h3>
              <ul className="space-y-2 text-gray-700 dark:text-gray-300">
                <li>• {language === 'rw' ? 'Subiza ibibazo byose neza' : 'Answer all questions carefully'}</li>
                <li>• {language === 'rw' ? 'Ntukurikirana igihe' : 'This quiz is untimed - take your time'}</li>
                <li>• {language === 'rw' ? 'Ushobora gusubira inyuma no gukomeza' : 'You can navigate back and forth between questions'}</li>
                <li>• {language === 'rw' ? 'Ushobora gufata' : 'You can flag questions for review'} {quiz.settings.maxAttempts} {language === 'rw' ? 'ibigeragezo' : 'attempts maximum'}</li>
                <li>• {language === 'rw' ? 'Ukeneye' : 'You need'} {quiz.settings.passingScore}% {language === 'rw' ? 'kurangiza' : 'to pass'}</li>
              </ul>
            </div>

            {/* Attempt Info */}
            {currentAttempt > 1 && (
              <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p className="text-yellow-800 dark:text-yellow-200">
                  {language === 'rw' ? 'Iki ni igerageza' : 'This is attempt'} {currentAttempt} {language === 'rw' ? 'kuri' : 'of'} {quiz.settings.maxAttempts}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-center space-x-4">
              <Button
                onClick={() => setShowInstructions(false)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3"
                aria-label={language === 'rw' ? 'Tangira ikizamini (Ctrl+S)' : 'Start Quiz (Ctrl+S)'}
                title={language === 'rw' ? 'Tangira ikizamini (Ctrl+S)' : 'Start Quiz (Ctrl+S)'}
              >
                {language === 'rw' ? 'Tangira ikizamini' : 'Start Quiz'}
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              
              <Button
                onClick={onCancel}
                variant="outline"
                className="px-8 py-3"
                aria-label={language === 'rw' ? 'Guca (Ctrl+B)' : 'Cancel (Ctrl+B)'}
                title={language === 'rw' ? 'Guca (Ctrl+B)' : 'Cancel (Ctrl+B)'}
              >
                {language === 'rw' ? 'Guca' : 'Cancel'}
              </Button>
            </div>
           </Card>
       </div>
     );
   }

  if (showResults) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        {renderResults()}
      </div>
    );
  }

  // Main quiz interface
  return (
    <div className="max-w-6xl mx-auto space-y-6">
        {/* Quiz Header */}
        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {quiz.title}
              </h1>
              {quiz.moduleTitle && (
                <p className="text-gray-600 dark:text-gray-400">
                  {quiz.moduleTitle}
                </p>
              )}
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-center">
                <Target className="w-5 h-5 text-gray-400 mx-auto" />
                <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {answeredQuestions}/{totalQuestions}
                </div>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(currentQuestionIndex + 1) / totalQuestions * 100}%` }}
            />
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Question Navigation Sidebar */}
          <Card className="p-4 lg:col-span-1">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
              {language === 'rw' ? 'Ibibazo' : 'Questions'}
            </h3>
            
            <div className="grid grid-cols-5 lg:grid-cols-1 gap-2">
              {quiz.questions.map((question, index) => (
                <button
                  key={question.id}
                  onClick={() => handleQuestionNavigation(index)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleQuestionNavigation(index);
                    }
                  }}
                  className={`p-2 text-sm font-medium rounded transition-colors relative ${
                    index === currentQuestionIndex
                      ? 'bg-blue-600 text-white'
                      : answers[question.id] !== undefined
                      ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                  aria-label={`${language === 'rw' ? 'Ikibazo' : 'Question'} ${index + 1}${flaggedQuestions.has(question.id) ? `, ${language === 'rw' ? 'gifashwe' : 'flagged'}` : ''}`}
                  title={`${language === 'rw' ? 'Ikibazo' : 'Question'} ${index + 1} (${index + 1})`}
                  tabIndex={0}
                >
                  {index + 1}
                  {flaggedQuestions.has(question.id) && (
                    <Flag className="w-3 h-3 text-orange-500 absolute -top-1 -right-1" />
                  )}
                </button>
              ))}
            </div>

            <div className="mt-6 space-y-2 text-xs text-gray-500 dark:text-gray-400">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-600 rounded"></div>
                {language === 'rw' ? 'Ikibazo kirimo' : 'Current'}
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-100 dark:bg-green-900 rounded"></div>
                {language === 'rw' ? 'Byasubijweho' : 'Answered'}
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-gray-100 dark:bg-gray-800 rounded"></div>
                {language === 'rw' ? 'Bidasubijweho' : 'Not answered'}
              </div>
            </div>
          </Card>

          {/* Main Question Area */}
          <div className="lg:col-span-3 space-y-6">
            {/* Current Question */}
            <Card className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <Badge variant="default">
                      {language === 'rw' ? 'Ikibazo' : 'Question'} {currentQuestionIndex + 1}
                    </Badge>
                    
                    {currentQuestion.points && (
                      <Badge variant="info">
                        {currentQuestion.points} {language === 'rw' ? 'utunguranye' : 'pts'}
                      </Badge>
                    )}
                    
                    <Badge variant={currentQuestion.type === 'essay' ? 'warning' : 'info'}>
                      {currentQuestion.type.replace('-', ' ')}
                    </Badge>
                  </div>
                  
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                    {currentQuestion.question}
                  </h2>
                  
                  {currentQuestion.image && (
                    <img 
                      src={currentQuestion.image} 
                      alt="Question" 
                      className="mb-4 max-w-full h-auto rounded-lg"
                    />
                  )}
                </div>
                
                <div className="flex items-center gap-2 ml-4">
                  {currentQuestion.hints && currentQuestion.hints.length > 0 && (
                    <Button
                      onClick={() => useHint(currentQuestion.id)}
                      variant="outline"
                      size="sm"
                      disabled={(usedHints[currentQuestion.id] || 0) >= currentQuestion.hints.length}
                      aria-label={language === 'rw' ? 'Koresha ubufasha (h)' : 'Use hint (h)'}
                      title={language === 'rw' ? 'Koresha ubufasha (h)' : 'Use hint (h)'}
                    >
                      <Lightbulb className="w-4 h-4" />
                    </Button>
                  )}
                  
                  <Button
                    onClick={() => toggleQuestionFlag(currentQuestion.id)}
                    variant="outline"
                    size="sm"
                    className={flaggedQuestions.has(currentQuestion.id) ? 'text-orange-600 border-orange-600' : ''}
                    aria-label={language === 'rw' ? 'Fata ikibazo (Space)' : 'Flag question (Space)'}
                    title={language === 'rw' ? 'Fata ikibazo (Space)' : 'Flag question (Space)'}
                  >
                    <Flag className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Show hint if used */}
              {usedHints[currentQuestion.id] > 0 && currentQuestion.hints && (
                <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Lightbulb className="w-4 h-4 text-yellow-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                        {language === 'rw' ? 'Ubufasha:' : 'Hint:'}
                      </p>
                      <p className="text-sm text-yellow-700 dark:text-yellow-300">
                        {currentQuestion.hints[Math.min(usedHints[currentQuestion.id] - 1, currentQuestion.hints.length - 1)]}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {renderQuestion(currentQuestion)}
            </Card>

            {/* Navigation Controls */}
            <Card className="p-4">
              <div className="flex justify-between items-center">
                <Button
                  onClick={handlePreviousQuestion}
                  disabled={currentQuestionIndex === 0}
                  variant="outline"
                  aria-label={language === 'rw' ? 'Inyuma (Ctrl+Left)' : 'Previous (Ctrl+Left)'}
                  title={language === 'rw' ? 'Inyuma (Ctrl+Left)' : 'Previous (Ctrl+Left)'}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  {language === 'rw' ? 'Inyuma' : 'Previous'}
                </Button>

                <div className="flex items-center space-x-3">
                  {isLastQuestion ? (
                    <Button
                      onClick={handleSubmitQuiz}
                      disabled={isSubmitting}
                      className="bg-green-600 hover:bg-green-700 text-white"
                      aria-label={language === 'rw' ? 'Hera ikizamini (Ctrl+Enter)' : 'Submit Quiz (Ctrl+Enter)'}
                      title={language === 'rw' ? 'Hera ikizamini (Ctrl+Enter)' : 'Submit Quiz (Ctrl+Enter)'}
                    >
                      {isSubmitting ? (
                        <LoadingSpinner size="sm" />
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-2" />
                          {language === 'rw' ? 'Hera ikizamini' : 'Submit Quiz'}
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button
                      onClick={handleNextQuestion}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                      aria-label={language === 'rw' ? 'Komeza (Ctrl+Right)' : 'Next (Ctrl+Right)'}
                      title={language === 'rw' ? 'Komeza (Ctrl+Right)' : 'Next (Ctrl+Right)'}
                    >
                      {language === 'rw' ? 'Komeza' : 'Next'}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          </div>
        </div>
    </div>
  );
}; 