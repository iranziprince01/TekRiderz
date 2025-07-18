import React, { useState, useCallback } from 'react';
import { QuizData, QuizQuestion, QuizSettings } from '../../types/quiz';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { FileText, Settings, HelpCircle, BarChart3, Save, Download } from 'lucide-react';

interface JsonQuizCreatorProps {
  courseId: string;
  sectionId?: string;
  onQuizCreated: (quiz: QuizData) => void;
  initialQuiz?: QuizData;
}

const DEFAULT_QUIZ_SETTINGS: QuizSettings = {
  maxAttempts: 3,
  passingScore: 70,
  showCorrectAnswers: true,
  showScoreImmediately: true,
  randomizeQuestions: false,
  randomizeOptions: false,
  allowReview: true,
  requireSequential: false
};

export const JsonQuizCreator: React.FC<JsonQuizCreatorProps> = ({
  courseId,
  sectionId,
  onQuizCreated,
  initialQuiz
}) => {
  const [quizData, setQuizData] = useState<QuizData>(
    initialQuiz || {
      id: `quiz_${Date.now()}`,
      courseId,
      sectionId,
      title: '',
      description: '',
      instructions: 'Answer all questions to the best of your ability.',
      questions: [],
      settings: DEFAULT_QUIZ_SETTINGS,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
      difficulty: 'beginner',
      estimatedDuration: 10
    }
  );

  const [currentQuestion, setCurrentQuestion] = useState<Partial<QuizQuestion>>({
    type: 'multiple-choice',
    points: 1,
    required: true,
    options: [
      { id: 'a', text: '', isCorrect: false },
      { id: 'b', text: '', isCorrect: false }
    ]
  });

  const [isCreatingQuestion, setIsCreatingQuestion] = useState(false);
  const [editingQuestionIndex, setEditingQuestionIndex] = useState<number | null>(null);

  // Update quiz basic info
  const updateQuizInfo = useCallback((field: string, value: any) => {
    setQuizData(prev => ({
      ...prev,
      [field]: value,
      updatedAt: new Date().toISOString()
    }));
  }, []);

  // Update quiz settings
  const updateQuizSettings = useCallback((field: string, value: any) => {
    setQuizData(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        [field]: value
      },
      updatedAt: new Date().toISOString()
    }));
  }, []);

  // Add or update question
  const saveQuestion = useCallback(() => {
    if (!currentQuestion.question?.trim()) return;

    const questionData: QuizQuestion = {
      id: currentQuestion.id || `q_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type: currentQuestion.type!,
      question: currentQuestion.question!,
      points: currentQuestion.points || 1,
      required: currentQuestion.required ?? true,
      options: currentQuestion.options,
      correctAnswer: currentQuestion.correctAnswer,
      explanation: currentQuestion.explanation,
      hints: currentQuestion.hints,
      image: currentQuestion.image,
      leftItems: currentQuestion.leftItems,
      rightItems: currentQuestion.rightItems,
      correctMatches: currentQuestion.correctMatches
    };

    setQuizData(prev => {
      const newQuestions = [...prev.questions];
      
      if (editingQuestionIndex !== null) {
        newQuestions[editingQuestionIndex] = questionData;
      } else {
        newQuestions.push(questionData);
      }

      return {
        ...prev,
        questions: newQuestions,
        updatedAt: new Date().toISOString()
      };
    });

    // Reset form
    setCurrentQuestion({
      type: 'multiple-choice',
      points: 1,
      required: true,
      options: [
        { id: 'a', text: '', isCorrect: false },
        { id: 'b', text: '', isCorrect: false }
      ]
    });
    setIsCreatingQuestion(false);
    setEditingQuestionIndex(null);
  }, [currentQuestion, editingQuestionIndex]);

  // Edit existing question
  const editQuestion = useCallback((index: number) => {
    const question = quizData.questions[index];
    setCurrentQuestion(question);
    setEditingQuestionIndex(index);
    setIsCreatingQuestion(true);
  }, [quizData.questions]);

  // Delete question
  const deleteQuestion = useCallback((index: number) => {
    setQuizData(prev => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== index),
      updatedAt: new Date().toISOString()
    }));
  }, []);

  // Update current question
  const updateCurrentQuestion = useCallback((field: string, value: any) => {
    setCurrentQuestion(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  // Add option to multiple choice question
  const addOption = useCallback(() => {
    const nextLetter = String.fromCharCode(97 + (currentQuestion.options?.length || 0));
    setCurrentQuestion(prev => ({
      ...prev,
      options: [
        ...(prev.options || []),
        { id: nextLetter, text: '', isCorrect: false }
      ]
    }));
  }, [currentQuestion.options]);

  // Update option
  const updateOption = useCallback((optionId: string, field: string, value: any) => {
    setCurrentQuestion(prev => ({
      ...prev,
      options: prev.options?.map(opt => 
        opt.id === optionId ? { ...opt, [field]: value } : opt
      )
    }));
  }, []);

  // Remove option
  const removeOption = useCallback((optionId: string) => {
    setCurrentQuestion(prev => ({
      ...prev,
      options: prev.options?.filter(opt => opt.id !== optionId)
    }));
  }, []);

  // Set correct answer for multiple choice
  const setCorrectOption = useCallback((optionId: string) => {
    setCurrentQuestion(prev => ({
      ...prev,
      options: prev.options?.map(opt => ({
        ...opt,
        isCorrect: opt.id === optionId
      }))
    }));
  }, []);

  // Calculate estimated duration
  const calculateDuration = useCallback(() => {
    const baseTime = quizData.questions.length * 1.5; // 1.5 minutes per question
    const complexityMultiplier = quizData.difficulty === 'advanced' ? 1.5 : quizData.difficulty === 'intermediate' ? 1.2 : 1;
    return Math.ceil(baseTime * complexityMultiplier);
  }, [quizData.questions.length, quizData.difficulty]);

  // Save quiz
  const handleSaveQuiz = useCallback(() => {
    if (!quizData.title.trim() || quizData.questions.length === 0) {
      alert('Please add a title and at least one question');
      return;
    }

    const finalQuiz: QuizData = {
      ...quizData,
      estimatedDuration: calculateDuration(),
      updatedAt: new Date().toISOString()
    };

    onQuizCreated(finalQuiz);
  }, [quizData, calculateDuration, onQuizCreated]);

  // Preview quiz JSON
  const [showJsonPreview, setShowJsonPreview] = useState(false);

  return (
    <div className="space-y-6">
      {/* Quiz Basic Information */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold">Quiz Information</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Quiz Title *</label>
            <Input
              value={quizData.title}
              onChange={(e) => updateQuizInfo('title', e.target.value)}
              placeholder="e.g., React Fundamentals Quiz"
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Difficulty Level</label>
            <select
              value={quizData.difficulty}
              onChange={(e) => updateQuizInfo('difficulty', e.target.value as any)}
              className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-2">Description</label>
            <textarea
              value={quizData.description}
              onChange={(e) => updateQuizInfo('description', e.target.value)}
              placeholder="Brief description of what this quiz covers..."
              className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-2">Instructions for Students</label>
            <textarea
              value={quizData.instructions}
              onChange={(e) => updateQuizInfo('instructions', e.target.value)}
              placeholder="Instructions for taking the quiz..."
              className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
            />
          </div>
        </div>
      </Card>

      {/* Quiz Settings */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold">Quiz Settings</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Max Attempts</label>
            <Input
              type="number"
              value={quizData.settings.maxAttempts}
              onChange={(e) => updateQuizSettings('maxAttempts', parseInt(e.target.value))}
              min="1"
              max="10"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Passing Score (%)</label>
            <Input
              type="number"
              value={quizData.settings.passingScore}
              onChange={(e) => updateQuizSettings('passingScore', parseInt(e.target.value))}
              min="0"
              max="100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Time Limit (minutes)</label>
            <Input
              type="number"
              value={quizData.settings.timeLimit || ''}
              onChange={(e) => updateQuizSettings('timeLimit', e.target.value ? parseInt(e.target.value) : undefined)}
              placeholder="No limit"
              min="1"
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="showCorrectAnswers"
              checked={quizData.settings.showCorrectAnswers}
              onChange={(e) => updateQuizSettings('showCorrectAnswers', e.target.checked)}
              className="mr-2"
            />
            <label htmlFor="showCorrectAnswers" className="text-sm">Show correct answers after submission</label>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="showScoreImmediately"
              checked={quizData.settings.showScoreImmediately}
              onChange={(e) => updateQuizSettings('showScoreImmediately', e.target.checked)}
              className="mr-2"
            />
            <label htmlFor="showScoreImmediately" className="text-sm">Show score immediately</label>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="randomizeQuestions"
              checked={quizData.settings.randomizeQuestions}
              onChange={(e) => updateQuizSettings('randomizeQuestions', e.target.checked)}
              className="mr-2"
            />
            <label htmlFor="randomizeQuestions" className="text-sm">Randomize question order</label>
          </div>
        </div>
      </Card>

      {/* Questions List */}
      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold">Questions ({quizData.questions.length})</h3>
          </div>
          <Button
            onClick={() => setIsCreatingQuestion(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            + Add Question
          </Button>
        </div>

        {quizData.questions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No questions added yet. Click "Add Question" to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {quizData.questions.map((question, index) => (
              <div key={question.id} className="border rounded-lg p-4 bg-gray-50">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
                        {question.type.replace('-', ' ').toUpperCase()}
                      </span>
                      <span className="text-sm text-gray-600">{question.points} points</span>
                    </div>
                    <p className="font-medium mb-2">Q{index + 1}: {question.question}</p>
                    
                    {question.type === 'multiple-choice' && question.options && (
                      <div className="text-sm text-gray-600">
                        {question.options.map(option => (
                          <div key={option.id} className={`ml-4 ${option.isCorrect ? 'text-green-600 font-medium' : ''}`}>
                            {option.id}) {option.text} {option.isCorrect && '✓'}
                          </div>
                        ))}
                      </div>
                    )}

                    {question.type === 'true-false' && (
                      <div className="text-sm text-gray-600 ml-4">
                        Correct answer: {question.correctAnswer}
                      </div>
                    )}

                    {question.type === 'short-answer' && question.correctAnswer && (
                      <div className="text-sm text-gray-600 ml-4">
                        Correct answer: {question.correctAnswer}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => editQuestion(index)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteQuestion(index)}
                      className="text-red-600 hover:text-red-700"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Question Creation Modal */}
      {isCreatingQuestion && (
        <Card className="p-6 border-2 border-blue-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">
              {editingQuestionIndex !== null ? 'Edit Question' : 'Create New Question'}
            </h3>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreatingQuestion(false);
                setEditingQuestionIndex(null);
                setCurrentQuestion({
                  type: 'multiple-choice',
                  points: 1,
                  required: true,
                  options: [
                    { id: 'a', text: '', isCorrect: false },
                    { id: 'b', text: '', isCorrect: false }
                  ]
                });
              }}
            >
              Cancel
            </Button>
          </div>

          <div className="space-y-4">
            {/* Question Type and Points */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Question Type</label>
                <select
                  value={currentQuestion.type}
                  onChange={(e) => updateCurrentQuestion('type', e.target.value)}
                  className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="multiple-choice">Multiple Choice</option>
                  <option value="true-false">True/False</option>
                  <option value="short-answer">Short Answer</option>
                  <option value="essay">Essay</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Points</label>
                <Input
                  type="number"
                  value={currentQuestion.points || 1}
                  onChange={(e) => updateCurrentQuestion('points', parseInt(e.target.value))}
                  min="1"
                  max="10"
                />
              </div>
            </div>

            {/* Question Text */}
            <div>
              <label className="block text-sm font-medium mb-2">Question *</label>
              <textarea
                value={currentQuestion.question || ''}
                onChange={(e) => updateCurrentQuestion('question', e.target.value)}
                placeholder="Enter your question here..."
                className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
            </div>

            {/* Question Image */}
            <div>
              <label className="block text-sm font-medium mb-2">Image URL (Optional)</label>
              <Input
                value={currentQuestion.image || ''}
                onChange={(e) => updateCurrentQuestion('image', e.target.value)}
                placeholder="https://example.com/image.jpg"
              />
            </div>

            {/* Multiple Choice Options */}
            {currentQuestion.type === 'multiple-choice' && (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium">Answer Options</label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addOption}
                    disabled={(currentQuestion.options?.length || 0) >= 6}
                  >
                    + Add Option
                  </Button>
                </div>
                
                <div className="space-y-2">
                  {currentQuestion.options?.map((option) => (
                    <div key={option.id} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="correctAnswer"
                        checked={option.isCorrect}
                        onChange={() => setCorrectOption(option.id)}
                        className="text-blue-600"
                      />
                      <span className="w-8 text-center font-medium">{option.id})</span>
                      <Input
                        value={option.text}
                        onChange={(e) => updateOption(option.id, 'text', e.target.value)}
                        placeholder="Enter option text..."
                        className="flex-1"
                      />
                      {(currentQuestion.options?.length || 0) > 2 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeOption(option.id)}
                          className="text-red-600"
                        >
                          ✕
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* True/False */}
            {currentQuestion.type === 'true-false' && (
              <div>
                <label className="block text-sm font-medium mb-2">Correct Answer</label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="trueFalseAnswer"
                      value="true"
                      checked={currentQuestion.correctAnswer === 'true'}
                      onChange={(e) => updateCurrentQuestion('correctAnswer', e.target.value)}
                      className="mr-2"
                    />
                    True
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="trueFalseAnswer"
                      value="false"
                      checked={currentQuestion.correctAnswer === 'false'}
                      onChange={(e) => updateCurrentQuestion('correctAnswer', e.target.value)}
                      className="mr-2"
                    />
                    False
                  </label>
                </div>
              </div>
            )}

            {/* Short Answer */}
            {currentQuestion.type === 'short-answer' && (
              <div>
                <label className="block text-sm font-medium mb-2">Correct Answer</label>
                <Input
                  value={currentQuestion.correctAnswer || ''}
                  onChange={(e) => updateCurrentQuestion('correctAnswer', e.target.value)}
                  placeholder="Enter the correct answer..."
                />
              </div>
            )}

            {/* Explanation */}
            <div>
              <label className="block text-sm font-medium mb-2">Explanation (Optional)</label>
              <textarea
                value={currentQuestion.explanation || ''}
                onChange={(e) => updateCurrentQuestion('explanation', e.target.value)}
                placeholder="Explain why this is the correct answer..."
                className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsCreatingQuestion(false);
                  setEditingQuestionIndex(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={saveQuestion}
                disabled={!currentQuestion.question?.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {editingQuestionIndex !== null ? 'Update Question' : 'Add Question'}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Quiz Summary & Actions */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold">Quiz Summary</h3>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{quizData.questions.length}</div>
            <div className="text-sm text-gray-600">Questions</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {quizData.questions.reduce((sum, q) => sum + q.points, 0)}
            </div>
            <div className="text-sm text-gray-600">Total Points</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{calculateDuration()}</div>
            <div className="text-sm text-gray-600">Est. Duration (min)</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{quizData.settings.passingScore}%</div>
            <div className="text-sm text-gray-600">Passing Score</div>
          </div>
        </div>

        <div className="flex justify-between items-center">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowJsonPreview(!showJsonPreview)}
            >
              {showJsonPreview ? 'Hide' : 'Show'} JSON Preview
            </Button>
            
            <Button
              variant="outline"
              onClick={() => {
                const dataStr = JSON.stringify(quizData, null, 2);
                const dataBlob = new Blob([dataStr], { type: 'application/json' });
                const url = URL.createObjectURL(dataBlob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `${quizData.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_quiz.json`;
                link.click();
              }}
              disabled={quizData.questions.length === 0}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export JSON
            </Button>
          </div>

          <Button
            onClick={handleSaveQuiz}
            disabled={!quizData.title.trim() || quizData.questions.length === 0}
            className="bg-green-600 hover:bg-green-700 flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            Save Quiz
          </Button>
        </div>

        {/* JSON Preview */}
        {showJsonPreview && (
          <div className="mt-4">
            <h4 className="font-medium mb-2">Quiz JSON Data:</h4>
            <pre className="bg-gray-100 p-4 rounded text-xs overflow-auto max-h-96">
              {JSON.stringify(quizData, null, 2)}
            </pre>
          </div>
        )}
      </Card>


    </div>
  );
};

export default JsonQuizCreator; 