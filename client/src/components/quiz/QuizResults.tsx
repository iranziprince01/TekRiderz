import React, { useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { ProgressBar } from '../common/ProgressBar';
import { 
  Trophy, 
  Target, 
  Clock, 
  TrendingUp, 
  BarChart3, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Eye,
  EyeOff,
  RotateCcw,
  BookOpen,
  Lightbulb,
  Star,
  Award,
  ChevronRight,
  ChevronDown,
  HelpCircle,
  Calendar,
  Timer,
  Zap,
  Brain,
  ThumbsUp,
  ThumbsDown,
  MessageCircle
} from 'lucide-react';

interface QuizResultsProps {
  quizResult: {
    score: number;
    passed: boolean;
    correctAnswers: number;
    totalQuestions: number;
    results: Array<{
      questionId: string;
      userAnswer: string | string[];
      correctAnswer?: string | string[];
      isCorrect: boolean;
      points: number;
      questionType: string;
      explanation?: string;
      timeSpent: number;
    }>;
    passingScore: number;
    grading: {
      autoGraded: boolean;
      gradedAt: string;
      totalPoints: number;
      maxPossiblePoints: number;
      letterGrade: string;
      feedback: string;
      detailedFeedback: {
        overall: string;
        strengths: string[];
        improvements: string[];
        recommendations: string[];
      };
      showCorrectAnswers: boolean;
      allowRetake: boolean;
      difficultyAnalysis: {
        easy: { correct: number; total: number; percentage: number };
        medium: { correct: number; total: number; percentage: number };
        hard: { correct: number; total: number; percentage: number };
      };
      partiallyCorrect: number;
      averageTimePerQuestion: number;
    };
    quiz: {
      id: string;
      title: string;
      description: string;
      timeLimit: number;
      maxAttempts: number;
      currentAttempt: number;
    };
    metadata: {
      timeSpent: number;
      submittedAt: string;
      lessonId?: string;
      sectionId?: string;
    };
  };
  questions: Array<{
    id: string;
    questionText: string;
    type: string;
    options?: string[];
    points: number;
    explanation?: string;
    hints?: string[];
    difficulty?: 'easy' | 'medium' | 'hard';
  }>;
  onRetake?: () => void;
  onContinue?: () => void;
  onReview?: () => void;
  className?: string;
}

export const QuizResults: React.FC<QuizResultsProps> = ({
  quizResult,
  questions,
  onRetake,
  onContinue,
  onReview,
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'details' | 'analytics' | 'feedback'>('overview');
  const [showCorrectAnswers, setShowCorrectAnswers] = useState(false);
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());
  const [showDifficultyBreakdown, setShowDifficultyBreakdown] = useState(false);

  const {
    score,
    passed,
    correctAnswers,
    totalQuestions,
    results,
    passingScore,
    grading,
    quiz,
    metadata
  } = quizResult;

  // Toggle question expansion
  const toggleQuestionExpansion = (questionId: string) => {
    const newExpanded = new Set(expandedQuestions);
    if (newExpanded.has(questionId)) {
      newExpanded.delete(questionId);
    } else {
      newExpanded.add(questionId);
    }
    setExpandedQuestions(newExpanded);
  };

  // Get performance color
  const getPerformanceColor = (percentage: number) => {
    if (percentage >= 90) return 'text-green-600';
    if (percentage >= 80) return 'text-blue-600';
    if (percentage >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Get difficulty color
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'hard': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Format time
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Render overview tab
  const renderOverview = () => (
    <div className="space-y-6">
      {/* Score Card */}
      <Card className="p-6">
        <div className="text-center">
          <div className={`text-6xl font-bold mb-2 ${getPerformanceColor(score)}`}>
            {score}%
          </div>
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Badge 
              variant={passed ? 'default' : 'secondary'}
              className={`text-lg px-4 py-2 ${passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
            >
              {passed ? (
                <>
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Passed
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5 mr-2" />
                  Failed
                </>
              )}
            </Badge>
            <Badge variant="outline" className="text-lg px-4 py-2">
              Grade: {grading.letterGrade}
            </Badge>
          </div>
          <p className="text-lg text-gray-600 mb-4">
            {grading.feedback}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{correctAnswers}</div>
              <div className="text-sm text-gray-600">Correct Answers</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-gray-600">{totalQuestions}</div>
              <div className="text-sm text-gray-600">Total Questions</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{formatTime(metadata.timeSpent)}</div>
              <div className="text-sm text-gray-600">Time Spent</div>
            </div>
          </div>
        </div>
      </Card>

      {/* Progress Bar */}
      <Card className="p-6">
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">Progress</span>
            <span className="text-sm text-gray-600">{score}% ({passingScore}% needed)</span>
          </div>
          <ProgressBar 
            progress={score} 
            className="h-3"
            color={passed ? 'bg-green-500' : 'bg-red-500'}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Points Earned:</span>
            <span className="font-medium">{grading.totalPoints} / {grading.maxPossiblePoints}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Attempt:</span>
            <span className="font-medium">{quiz.currentAttempt} / {quiz.maxAttempts}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Average Time:</span>
            <span className="font-medium">{formatTime(grading.averageTimePerQuestion)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Submitted:</span>
            <span className="font-medium">{new Date(metadata.submittedAt).toLocaleString()}</span>
          </div>
        </div>
      </Card>

      {/* Performance Summary */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <TrendingUp className="w-5 h-5 mr-2" />
          Performance Summary
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Strengths</h4>
            <ul className="space-y-1">
              {grading.detailedFeedback.strengths.map((strength, index) => (
                <li key={index} className="flex items-start">
                  <ThumbsUp className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-gray-600">{strength}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Areas for Improvement</h4>
            <ul className="space-y-1">
              {grading.detailedFeedback.improvements.map((improvement, index) => (
                <li key={index} className="flex items-start">
                  <ThumbsDown className="w-4 h-4 text-red-500 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-gray-600">{improvement}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Card>

      {/* Recommendations */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Lightbulb className="w-5 h-5 mr-2" />
          Recommendations
        </h3>
        <ul className="space-y-2">
          {grading.detailedFeedback.recommendations.map((recommendation, index) => (
            <li key={index} className="flex items-start">
              <ChevronRight className="w-4 h-4 text-blue-500 mr-2 mt-0.5 flex-shrink-0" />
              <span className="text-sm text-gray-600">{recommendation}</span>
            </li>
          ))}
        </ul>
      </Card>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        {grading.allowRetake && onRetake && (
          <Button 
            onClick={onRetake}
            variant="outline"
            className="flex items-center space-x-2"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Retake Quiz</span>
          </Button>
        )}
        {onReview && (
          <Button 
            onClick={onReview}
            variant="outline"
            className="flex items-center space-x-2"
          >
            <Eye className="w-4 h-4" />
            <span>Review Answers</span>
          </Button>
        )}
        {onContinue && (
          <Button 
            onClick={onContinue}
            className="flex items-center space-x-2"
          >
            <ChevronRight className="w-4 h-4" />
            <span>Continue Learning</span>
          </Button>
        )}
      </div>
    </div>
  );

  // Render details tab
  const renderDetails = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Question Details</h3>
        {grading.showCorrectAnswers && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCorrectAnswers(!showCorrectAnswers)}
            className="flex items-center space-x-2"
          >
            {showCorrectAnswers ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            <span>{showCorrectAnswers ? 'Hide' : 'Show'} Correct Answers</span>
          </Button>
        )}
      </div>

      {results.map((result, index) => {
        const question = questions.find(q => q.id === result.questionId);
        if (!question) return null;

        const isExpanded = expandedQuestions.has(result.questionId);

        return (
          <Card key={result.questionId} className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <Badge variant="outline" className="text-xs">
                    Question {index + 1}
                  </Badge>
                  <Badge 
                    variant={result.isCorrect ? 'default' : 'secondary'}
                    className={`text-xs ${
                      result.isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {result.isCorrect ? 'Correct' : 'Incorrect'}
                  </Badge>
                  {question.difficulty && (
                    <Badge variant="outline" className={`text-xs ${getDifficultyColor(question.difficulty)}`}>
                      {question.difficulty}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs">
                    {result.points} pts
                  </Badge>
                </div>
                <p className="text-sm font-medium text-gray-900 mb-2">
                  {question.questionText}
                </p>
                <div className="flex items-center space-x-4 text-xs text-gray-500">
                  <span className="flex items-center">
                    <Timer className="w-3 h-3 mr-1" />
                    {formatTime(result.timeSpent)}
                  </span>
                  <span className="flex items-center">
                    <HelpCircle className="w-3 h-3 mr-1" />
                    {result.questionType}
                  </span>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {result.isCorrect ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-500" />
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleQuestionExpansion(result.questionId)}
                >
                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {isExpanded && (
              <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
                <div>
                  <h5 className="text-sm font-medium text-gray-700 mb-2">Your Answer:</h5>
                  <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                    {Array.isArray(result.userAnswer) 
                      ? result.userAnswer.join(', ') 
                      : result.userAnswer}
                  </p>
                </div>

                {showCorrectAnswers && result.correctAnswer && (
                  <div>
                    <h5 className="text-sm font-medium text-gray-700 mb-2">Correct Answer:</h5>
                    <p className="text-sm text-gray-600 bg-green-50 p-2 rounded">
                      {Array.isArray(result.correctAnswer) 
                        ? result.correctAnswer.join(', ') 
                        : result.correctAnswer}
                    </p>
                  </div>
                )}

                {result.explanation && showCorrectAnswers && (
                  <div>
                    <h5 className="text-sm font-medium text-gray-700 mb-2">Explanation:</h5>
                    <p className="text-sm text-gray-600 bg-blue-50 p-2 rounded">
                      {result.explanation}
                    </p>
                  </div>
                )}

                {question.options && question.options.length > 0 && (
                  <div>
                    <h5 className="text-sm font-medium text-gray-700 mb-2">Options:</h5>
                    <div className="space-y-1">
                      {question.options.map((option, optIndex) => (
                        <div key={optIndex} className="flex items-center text-sm">
                          <span className="w-6 h-6 rounded-full border border-gray-300 flex items-center justify-center mr-2 text-xs">
                            {String.fromCharCode(65 + optIndex)}
                          </span>
                          <span className="text-gray-600">{option}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );

  // Render analytics tab
  const renderAnalytics = () => (
    <div className="space-y-6">
      {/* Difficulty Analysis */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <BarChart3 className="w-5 h-5 mr-2" />
          Performance by Difficulty
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(grading.difficultyAnalysis).map(([difficulty, stats]) => (
            <div key={difficulty} className="text-center">
              <div className={`text-2xl font-bold mb-2 ${getPerformanceColor(stats.percentage)}`}>
                {stats.percentage}%
              </div>
              <div className="text-sm text-gray-600 mb-2 capitalize">{difficulty}</div>
              <div className="text-xs text-gray-500">
                {stats.correct} / {stats.total} questions
              </div>
              <ProgressBar 
                progress={stats.percentage} 
                className="h-2 mt-2"
                color={stats.percentage >= 70 ? 'bg-green-500' : 'bg-red-500'}
              />
            </div>
          ))}
        </div>
      </Card>

      {/* Time Analysis */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Clock className="w-5 h-5 mr-2" />
          Time Analysis
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-gray-700 mb-3">Overall Stats</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Total Time:</span>
                <span className="text-sm font-medium">{formatTime(metadata.timeSpent)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Average per Question:</span>
                <span className="text-sm font-medium">{formatTime(grading.averageTimePerQuestion)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Quiz Time Limit:</span>
                <span className="text-sm font-medium">
                  {quiz.timeLimit > 0 ? `${quiz.timeLimit} minutes` : 'No limit'}
                </span>
              </div>
            </div>
          </div>
          <div>
            <h4 className="font-medium text-gray-700 mb-3">Time Distribution</h4>
            <div className="space-y-2">
              {results.slice(0, 5).map((result, index) => {
                const question = questions.find(q => q.id === result.questionId);
                return (
                  <div key={result.questionId} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 truncate mr-2">
                      Q{index + 1}: {question?.questionText?.substring(0, 20)}...
                    </span>
                    <span className="font-medium">{formatTime(result.timeSpent)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Card>

      {/* Performance Metrics */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Target className="w-5 h-5 mr-2" />
          Performance Metrics
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{correctAnswers}</div>
            <div className="text-sm text-gray-600">Correct</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{totalQuestions - correctAnswers}</div>
            <div className="text-sm text-gray-600">Incorrect</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">{grading.partiallyCorrect}</div>
            <div className="text-sm text-gray-600">Partial Credit</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{grading.totalPoints}</div>
            <div className="text-sm text-gray-600">Total Points</div>
          </div>
        </div>
      </Card>
    </div>
  );

  // Render feedback tab
  const renderFeedback = () => (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <MessageCircle className="w-5 h-5 mr-2" />
          Detailed Feedback
        </h3>
        <div className="prose max-w-none">
          <p className="text-gray-700 mb-4">{grading.detailedFeedback.overall}</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-green-700 mb-3 flex items-center">
                <Star className="w-4 h-4 mr-2" />
                What You Did Well
              </h4>
              <ul className="space-y-2">
                {grading.detailedFeedback.strengths.map((strength, index) => (
                  <li key={index} className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-gray-600">{strength}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-red-700 mb-3 flex items-center">
                <AlertCircle className="w-4 h-4 mr-2" />
                Areas to Focus On
              </h4>
              <ul className="space-y-2">
                {grading.detailedFeedback.improvements.map((improvement, index) => (
                  <li key={index} className="flex items-start">
                    <XCircle className="w-4 h-4 text-red-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-gray-600">{improvement}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Brain className="w-5 h-5 mr-2" />
          Learning Recommendations
        </h3>
        <div className="space-y-3">
          {grading.detailedFeedback.recommendations.map((recommendation, index) => (
            <div key={index} className="flex items-start p-3 bg-blue-50 rounded-lg">
              <Lightbulb className="w-5 h-5 text-blue-500 mr-3 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-gray-700">{recommendation}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );

  return (
    <div className={`max-w-4xl mx-auto ${className}`}>
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center mb-4">
          {passed ? (
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <Trophy className="w-8 h-8 text-green-600" />
            </div>
          ) : (
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
          )}
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Quiz Results
        </h1>
        <p className="text-gray-600">
          {quiz.title}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 mb-6">
        {[
          { id: 'overview', label: 'Overview', icon: TrendingUp },
          { id: 'details', label: 'Question Details', icon: HelpCircle },
          { id: 'analytics', label: 'Analytics', icon: BarChart3 },
          { id: 'feedback', label: 'Feedback', icon: MessageCircle }
        ].map(tab => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? 'default' : 'ghost'}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className="flex items-center space-x-2"
          >
            <tab.icon className="w-4 h-4" />
            <span>{tab.label}</span>
          </Button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'details' && renderDetails()}
        {activeTab === 'analytics' && renderAnalytics()}
        {activeTab === 'feedback' && renderFeedback()}
      </div>
    </div>
  );
}; 