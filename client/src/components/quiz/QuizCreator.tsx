import React, { useState, useCallback } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Alert } from '../ui/Alert';
import { Badge } from '../ui/Badge';
import { 
  Plus, 
  Trash2, 
  ChevronUp, 
  ChevronDown, 
  Settings,
  Eye,
  Save,
  AlertCircle,
  CheckCircle,
  Clock,
  Target,
  HelpCircle,
  BookOpen,
  RotateCcw,
  Lightbulb
} from 'lucide-react';

export interface QuizQuestion {
  id: string;
  questionText: string;
  type: 'multiple-choice' | 'true-false' | 'multiple-select' | 'fill-blank' | 'essay';
  options?: string[];
  correctAnswer: string | string[] | number;
  points: number;
  explanation?: string;
  hints?: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  category?: string;
  timeLimit?: number;
  required: boolean;
}

export interface QuizSettings {
  timeLimit: number; // in minutes
  attempts: number;
  passingScore: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showResultsImmediately: boolean;
  showCorrectAnswers: boolean;
  allowReview: boolean;
  requireSequential: boolean;
  partialCredit: boolean;
  feedbackEnabled: boolean;
  detailedFeedback: boolean;
  availability?: {
    availableFrom?: string;
    availableUntil?: string;
    unlockConditions?: string[];
  };
}

export interface Quiz {
  id: string;
  title: string;
  description: string;
  instructions: string;
  questions: QuizQuestion[];
  settings: QuizSettings;
  category?: string;
  estimatedDuration: number;
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
}

interface QuizCreatorProps {
  quiz?: Quiz;
  onSave: (quiz: Quiz) => void;
  onCancel: () => void;
  className?: string;
}

const QUESTION_TYPES = [
  { value: 'multiple-choice', label: 'Multiple Choice', icon: '●' },
      { value: 'true-false', label: 'True/False', icon: 'TF' },
  { value: 'multiple-select', label: 'Multiple Select', icon: '☑' },
  { value: 'fill-blank', label: 'Fill in the Blank', icon: '___' },
  { value: 'essay', label: 'Essay', icon: '✍' }
] as const;

const DIFFICULTY_LEVELS = [
  { value: 'easy', label: 'Easy', color: 'bg-green-100 text-green-800' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'hard', label: 'Hard', color: 'bg-red-100 text-red-800' }
] as const;

export const QuizCreator: React.FC<QuizCreatorProps> = ({
  quiz,
  onSave,
  onCancel,
  className = ''
}) => {
  const [currentQuiz, setCurrentQuiz] = useState<Quiz>(quiz || {
    id: `quiz-${Date.now()}`,
    title: '',
    description: '',
    instructions: 'Answer all questions to complete the quiz.',
    questions: [],
    settings: {
      timeLimit: 0,
      attempts: 2,
      passingScore: 70,
      shuffleQuestions: false,
      shuffleOptions: false,
      showResultsImmediately: true,
      showCorrectAnswers: true,
      allowReview: true,
      requireSequential: false,
      partialCredit: false,
      feedbackEnabled: true,
      detailedFeedback: true
    },
    category: '',
    estimatedDuration: 10,
    difficulty: 'medium',
    tags: []
  });

  const [activeTab, setActiveTab] = useState<'basic' | 'questions' | 'settings'>('basic');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [previewMode, setPreviewMode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Validation
  const validateQuiz = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!currentQuiz.title.trim()) {
      newErrors.title = 'Quiz title is required';
    }

    if (!currentQuiz.description.trim()) {
      newErrors.description = 'Quiz description is required';
    }

    if (currentQuiz.questions.length === 0) {
      newErrors.questions = 'At least one question is required';
    }

    // Validate questions
    currentQuiz.questions.forEach((question, index) => {
      if (!question.questionText.trim()) {
        newErrors[`question-${index}-text`] = 'Question text is required';
      }

      if (question.type === 'multiple-choice' || question.type === 'multiple-select') {
        if (!question.options || question.options.length < 2) {
          newErrors[`question-${index}-options`] = 'At least 2 options are required';
        }
        if (question.options && question.options.some(opt => !opt.trim())) {
          newErrors[`question-${index}-options`] = 'All options must have text';
        }
      }

      if (question.type === 'fill-blank' || question.type === 'essay') {
        if (!question.correctAnswer || (typeof question.correctAnswer === 'string' && !question.correctAnswer.trim())) {
          newErrors[`question-${index}-answer`] = 'Expected answer is required';
        }
      }
    });

    if (currentQuiz.settings.passingScore < 0 || currentQuiz.settings.passingScore > 100) {
      newErrors.passingScore = 'Passing score must be between 0 and 100';
    }

    if (currentQuiz.settings.attempts < 1) {
      newErrors.attempts = 'At least 1 attempt must be allowed';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [currentQuiz]);

  // Add question
  const addQuestion = useCallback((type: QuizQuestion['type'] = 'multiple-choice') => {
    const newQuestion: QuizQuestion = {
      id: `question-${Date.now()}`,
      questionText: '',
      type,
      points: 1,
      difficulty: 'medium',
      required: true,
      correctAnswer: type === 'multiple-choice' ? 0 : '',
      options: type === 'multiple-choice' || type === 'multiple-select' ? ['', '', '', ''] : undefined,
      explanation: '',
      hints: []
    };

    setCurrentQuiz(prev => ({
      ...prev,
      questions: [...prev.questions, newQuestion]
    }));
  }, []);

  // Update question
  const updateQuestion = useCallback((questionId: string, updates: Partial<QuizQuestion>) => {
    setCurrentQuiz(prev => ({
      ...prev,
      questions: prev.questions.map(q => 
        q.id === questionId ? { ...q, ...updates } : q
      )
    }));
  }, []);

  // Remove question
  const removeQuestion = useCallback((questionId: string) => {
    setCurrentQuiz(prev => ({
      ...prev,
      questions: prev.questions.filter(q => q.id !== questionId)
    }));
  }, []);

  // Move question
  const moveQuestion = useCallback((questionId: string, direction: 'up' | 'down') => {
    setCurrentQuiz(prev => {
      const questions = [...prev.questions];
      const index = questions.findIndex(q => q.id === questionId);
      if (index === -1) return prev;

      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= questions.length) return prev;

      [questions[index], questions[newIndex]] = [questions[newIndex], questions[index]];
      
      return { ...prev, questions };
    });
  }, []);

  // Add option to question
  const addOption = useCallback((questionId: string) => {
    updateQuestion(questionId, {
      options: [...(currentQuiz.questions.find(q => q.id === questionId)?.options || []), '']
    });
  }, [updateQuestion, currentQuiz.questions]);

  // Remove option from question
  const removeOption = useCallback((questionId: string, optionIndex: number) => {
    const question = currentQuiz.questions.find(q => q.id === questionId);
    if (!question?.options) return;

    const newOptions = question.options.filter((_, index) => index !== optionIndex);
    updateQuestion(questionId, { options: newOptions });
  }, [updateQuestion, currentQuiz.questions]);

  // Add hint to question
  const addHint = useCallback((questionId: string) => {
    const question = currentQuiz.questions.find(q => q.id === questionId);
    if (!question) return;

    updateQuestion(questionId, {
      hints: [...(question.hints || []), '']
    });
  }, [updateQuestion, currentQuiz.questions]);

  // Update hint
  const updateHint = useCallback((questionId: string, hintIndex: number, hintText: string) => {
    const question = currentQuiz.questions.find(q => q.id === questionId);
    if (!question?.hints) return;

    const newHints = [...question.hints];
    newHints[hintIndex] = hintText;
    updateQuestion(questionId, { hints: newHints });
  }, [updateQuestion, currentQuiz.questions]);

  // Remove hint
  const removeHint = useCallback((questionId: string, hintIndex: number) => {
    const question = currentQuiz.questions.find(q => q.id === questionId);
    if (!question?.hints) return;

    const newHints = question.hints.filter((_, index) => index !== hintIndex);
    updateQuestion(questionId, { hints: newHints });
  }, [updateQuestion, currentQuiz.questions]);

  // Save quiz
  const handleSave = useCallback(() => {
    if (validateQuiz()) {
      onSave(currentQuiz);
    }
  }, [validateQuiz, onSave, currentQuiz]);

  // Render question editor
  const renderQuestionEditor = (question: QuizQuestion, index: number) => {
    const hasError = (field: string) => !!errors[`question-${index}-${field}`];

    return (
      <Card key={question.id} className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Badge variant="outline" className="text-sm">
              Question {index + 1}
            </Badge>
            <select
              value={question.type}
              onChange={(e) => updateQuestion(question.id, { 
                type: e.target.value as QuizQuestion['type'],
                correctAnswer: e.target.value === 'multiple-choice' ? 0 : '',
                options: e.target.value === 'multiple-choice' || e.target.value === 'multiple-select' 
                  ? ['', '', '', ''] : undefined
              })}
              className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
            >
              {QUESTION_TYPES.map(type => (
                <option key={type.value} value={type.value}>
                  {type.icon} {type.label}
                </option>
              ))}
            </select>
            <select
              value={question.difficulty}
              onChange={(e) => updateQuestion(question.id, { 
                difficulty: e.target.value as QuizQuestion['difficulty']
              })}
              className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
            >
              {DIFFICULTY_LEVELS.map(level => (
                <option key={level.value} value={level.value}>
                  {level.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => moveQuestion(question.id, 'up')}
              disabled={index === 0}
            >
              <ChevronUp className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => moveQuestion(question.id, 'down')}
              disabled={index === currentQuiz.questions.length - 1}
            >
              <ChevronDown className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeQuestion(question.id)}
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Question Text */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Question Text *
          </label>
          <textarea
            value={question.questionText}
            onChange={(e) => updateQuestion(question.id, { questionText: e.target.value })}
            rows={2}
            placeholder="Enter your question..."
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              hasError('text') ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {hasError('text') && (
            <p className="mt-1 text-sm text-red-600">{errors[`question-${index}-text`]}</p>
          )}
        </div>

        {/* Question Options */}
        {(question.type === 'multiple-choice' || question.type === 'multiple-select') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Options *
            </label>
            <div className="space-y-2">
              {question.options?.map((option, optionIndex) => (
                <div key={optionIndex} className="flex items-center space-x-2">
                  <input
                    type={question.type === 'multiple-choice' ? 'radio' : 'checkbox'}
                    name={`correct-${question.id}`}
                    checked={
                      question.type === 'multiple-choice' 
                        ? question.correctAnswer === optionIndex
                        : Array.isArray(question.correctAnswer) && question.correctAnswer.includes(optionIndex)
                    }
                    onChange={(e) => {
                      if (question.type === 'multiple-choice') {
                        updateQuestion(question.id, { correctAnswer: optionIndex });
                      } else {
                        const currentAnswers = Array.isArray(question.correctAnswer) 
                          ? question.correctAnswer as number[]
                          : [];
                        
                        if (e.target.checked) {
                          updateQuestion(question.id, { 
                            correctAnswer: [...currentAnswers, optionIndex] 
                          });
                        } else {
                          updateQuestion(question.id, { 
                            correctAnswer: currentAnswers.filter(a => a !== optionIndex) 
                          });
                        }
                      }
                    }}
                    className="w-4 h-4 text-blue-600"
                  />
                  <Input
                    value={option}
                    onChange={(e) => {
                      const newOptions = [...(question.options || [])];
                      newOptions[optionIndex] = e.target.value;
                      updateQuestion(question.id, { options: newOptions });
                    }}
                    placeholder={`Option ${optionIndex + 1}`}
                    className="flex-1"
                  />
                  {question.options && question.options.length > 2 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeOption(question.id, optionIndex)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => addOption(question.id)}
                className="mt-2"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Option
              </Button>
            </div>
            {hasError('options') && (
              <p className="mt-1 text-sm text-red-600">{errors[`question-${index}-options`]}</p>
            )}
          </div>
        )}

        {/* Fill in the Blank / Essay Answer */}
        {(question.type === 'fill-blank' || question.type === 'essay') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {question.type === 'fill-blank' ? 'Expected Answer *' : 'Sample Answer/Rubric *'}
            </label>
            <textarea
              value={question.correctAnswer as string}
              onChange={(e) => updateQuestion(question.id, { correctAnswer: e.target.value })}
              rows={question.type === 'essay' ? 4 : 2}
              placeholder={
                question.type === 'fill-blank' 
                  ? 'Enter the expected answer...'
                  : 'Enter sample answer or grading rubric...'
              }
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                hasError('answer') ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {hasError('answer') && (
              <p className="mt-1 text-sm text-red-600">{errors[`question-${index}-answer`]}</p>
            )}
          </div>
        )}

        {/* True/False */}
        {question.type === 'true-false' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Correct Answer *
            </label>
            <div className="flex space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name={`correct-${question.id}`}
                  value="true"
                  checked={question.correctAnswer === 'true'}
                  onChange={(e) => updateQuestion(question.id, { correctAnswer: e.target.value })}
                  className="w-4 h-4 text-blue-600 mr-2"
                />
                True
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name={`correct-${question.id}`}
                  value="false"
                  checked={question.correctAnswer === 'false'}
                  onChange={(e) => updateQuestion(question.id, { correctAnswer: e.target.value })}
                  className="w-4 h-4 text-blue-600 mr-2"
                />
                False
              </label>
            </div>
          </div>
        )}

        {/* Points */}
        <div className="flex items-center space-x-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Points
            </label>
            <Input
              type="number"
              value={question.points}
              onChange={(e) => updateQuestion(question.id, { points: parseInt(e.target.value) || 1 })}
              min="1"
              className="w-20"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Time Limit (seconds)
            </label>
            <Input
              type="number"
              value={question.timeLimit || ''}
              onChange={(e) => updateQuestion(question.id, { timeLimit: parseInt(e.target.value) || undefined })}
              min="0"
              placeholder="No limit"
              className="w-32"
            />
          </div>
        </div>

        {/* Explanation */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Explanation (optional)
          </label>
          <textarea
            value={question.explanation || ''}
            onChange={(e) => updateQuestion(question.id, { explanation: e.target.value })}
            rows={2}
            placeholder="Explain the correct answer..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Hints */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Hints (optional)
          </label>
          <div className="space-y-2">
            {question.hints?.map((hint, hintIndex) => (
              <div key={hintIndex} className="flex items-center space-x-2">
                <Lightbulb className="w-4 h-4 text-yellow-500" />
                <Input
                  value={hint}
                  onChange={(e) => updateHint(question.id, hintIndex, e.target.value)}
                  placeholder={`Hint ${hintIndex + 1}`}
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeHint(question.id, hintIndex)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => addHint(question.id)}
              className="mt-2"
            >
              <Lightbulb className="w-4 h-4 mr-2" />
              Add Hint
            </Button>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className={`max-w-4xl mx-auto ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quiz Creator</h1>
          <p className="text-gray-600 mt-1">Create and customize your quiz</p>
        </div>
        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            onClick={() => setPreviewMode(!previewMode)}
            className="flex items-center space-x-2"
          >
            <Eye className="w-4 h-4" />
            <span>Preview</span>
          </Button>
          <Button
            variant="outline"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="flex items-center space-x-2"
          >
            <Save className="w-4 h-4" />
            <span>Save Quiz</span>
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {Object.keys(errors).length > 0 && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <div>
            <p className="font-medium">Please fix the following errors:</p>
            <ul className="mt-2 list-disc list-inside text-sm">
              {Object.values(errors).map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        </Alert>
      )}

      {/* Tabs */}
      <div className="flex space-x-1 mb-6">
        {[
          { id: 'basic', label: 'Basic Info', icon: BookOpen },
          { id: 'questions', label: 'Questions', icon: HelpCircle },
          { id: 'settings', label: 'Settings', icon: Settings }
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

      {/* Basic Info Tab */}
      {activeTab === 'basic' && (
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Quiz Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quiz Title *
                </label>
                <Input
                  value={currentQuiz.title}
                  onChange={(e) => setCurrentQuiz(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter quiz title..."
                  className={errors.title ? 'border-red-500' : ''}
                />
                {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <Input
                  value={currentQuiz.category || ''}
                  onChange={(e) => setCurrentQuiz(prev => ({ ...prev, category: e.target.value }))}
                  placeholder="e.g., Math, Science, History..."
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description *
              </label>
              <textarea
                value={currentQuiz.description}
                onChange={(e) => setCurrentQuiz(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                placeholder="Describe what this quiz covers..."
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.description ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.description && <p className="mt-1 text-sm text-red-600">{errors.description}</p>}
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Instructions
              </label>
              <textarea
                value={currentQuiz.instructions}
                onChange={(e) => setCurrentQuiz(prev => ({ ...prev, instructions: e.target.value }))}
                rows={3}
                placeholder="Instructions for students taking this quiz..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </Card>
        </div>
      )}

      {/* Questions Tab */}
      {activeTab === 'questions' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Questions ({currentQuiz.questions.length})</h3>
            <div className="flex items-center space-x-2">
              <select
                onChange={(e) => addQuestion(e.target.value as QuizQuestion['type'])}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                value=""
              >
                <option value="">Add Question Type...</option>
                {QUESTION_TYPES.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.icon} {type.label}
                  </option>
                ))}
              </select>
              <Button
                onClick={() => addQuestion()}
                className="flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Add Question</span>
              </Button>
            </div>
          </div>

          {currentQuiz.questions.length === 0 ? (
            <Card className="p-8 text-center">
              <HelpCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No questions yet</h3>
              <p className="text-gray-600 mb-4">Start building your quiz by adding questions</p>
              <Button
                onClick={() => addQuestion()}
                className="flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Add First Question</span>
              </Button>
            </Card>
          ) : (
            <div className="space-y-4">
              {currentQuiz.questions.map((question, index) => 
                renderQuestionEditor(question, index)
              )}
            </div>
          )}
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Quiz Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Clock className="w-4 h-4 inline mr-1" />
                  Time Limit (minutes)
                </label>
                <Input
                  type="number"
                  value={currentQuiz.settings.timeLimit}
                  onChange={(e) => setCurrentQuiz(prev => ({
                    ...prev,
                    settings: { ...prev.settings, timeLimit: parseInt(e.target.value) || 0 }
                  }))}
                  min="0"
                  placeholder="0 = No limit"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <RotateCcw className="w-4 h-4 inline mr-1" />
                  Number of Attempts
                </label>
                <Input
                  type="number"
                  value={currentQuiz.settings.attempts}
                  onChange={(e) => setCurrentQuiz(prev => ({
                    ...prev,
                    settings: { ...prev.settings, attempts: parseInt(e.target.value) || 1 }
                  }))}
                  min="1"
                  className={errors.attempts ? 'border-red-500' : ''}
                />
                {errors.attempts && <p className="mt-1 text-sm text-red-600">{errors.attempts}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Target className="w-4 h-4 inline mr-1" />
                  Passing Score (%)
                </label>
                <Input
                  type="number"
                  value={currentQuiz.settings.passingScore}
                  onChange={(e) => setCurrentQuiz(prev => ({
                    ...prev,
                    settings: { ...prev.settings, passingScore: parseInt(e.target.value) || 70 }
                  }))}
                  min="0"
                  max="100"
                  className={errors.passingScore ? 'border-red-500' : ''}
                />
                {errors.passingScore && <p className="mt-1 text-sm text-red-600">{errors.passingScore}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quiz Difficulty
                </label>
                <select
                  value={currentQuiz.difficulty}
                  onChange={(e) => setCurrentQuiz(prev => ({
                    ...prev,
                    difficulty: e.target.value as Quiz['difficulty']
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {DIFFICULTY_LEVELS.map(level => (
                    <option key={level.value} value={level.value}>
                      {level.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <h4 className="text-md font-medium text-gray-900">Question and Answer Settings</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { key: 'shuffleQuestions', label: 'Shuffle Questions' },
                  { key: 'shuffleOptions', label: 'Shuffle Answer Options' },
                  { key: 'showResultsImmediately', label: 'Show Results Immediately' },
                  { key: 'showCorrectAnswers', label: 'Show Correct Answers' },
                  { key: 'allowReview', label: 'Allow Review' },
                  { key: 'requireSequential', label: 'Require Sequential Order' },
                  { key: 'partialCredit', label: 'Enable Partial Credit' },
                  { key: 'feedbackEnabled', label: 'Enable Feedback' }
                ].map(setting => (
                  <label key={setting.key} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={currentQuiz.settings[setting.key as keyof QuizSettings] as boolean}
                      onChange={(e) => setCurrentQuiz(prev => ({
                        ...prev,
                        settings: { ...prev.settings, [setting.key]: e.target.checked }
                      }))}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-sm text-gray-700">{setting.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}; 