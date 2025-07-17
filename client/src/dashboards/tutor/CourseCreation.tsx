import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { apiClient } from '../../utils/api';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Alert } from '../../components/ui/Alert';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { FileUploadComponent } from '../../components/course/FileUploadComponent';
import { 
  Video, 
  Award, 
  CheckCircle,
  Plus,
  Trash2,
  Save,
  Send,
  X,
  AlertCircle,
  Info
} from 'lucide-react';

// Simple types
interface QuizQuestion {
  id: string;
  questionText: string;
  options: [string, string, string, string];
  correctAnswer: number;
  points: number;
}

interface ModuleData {
  id: string;
  title: string;
  description: string;
  videoFileId?: string;
  videoUrl?: string;
  questions: QuizQuestion[];
}

interface FinalAssessment {
  id: string;
  title: string;
  description: string;
  questions: QuizQuestion[];
  settings: {
    timeLimit: number;
    attempts: number;
    passingScore: number;
    shuffleQuestions: boolean;
    showResultsImmediately: boolean;
  };
}

interface CourseData {
  title: string;
  description: string;
  category: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  thumbnail?: string;
  thumbnailFileId?: string;
  modules: ModuleData[];
  finalAssessment?: FinalAssessment;
}

// Simple session management - just refresh tokens periodically
let sessionTimer: NodeJS.Timeout | null = null;

const startSessionMaintenance = (refreshTokenFn: () => Promise<void>) => {
  if (sessionTimer) clearInterval(sessionTimer);
  
  sessionTimer = setInterval(async () => {
    try {
      await refreshTokenFn();
      console.log('🔄 Session refreshed');
    } catch (error) {
      console.warn('Session refresh failed:', error);
    }
  }, 10 * 60 * 1000); // 10 minutes
};

const stopSessionMaintenance = () => {
  if (sessionTimer) {
    clearInterval(sessionTimer);
    sessionTimer = null;
  }
};

const CourseCreation: React.FC = () => {
  const { user, refreshToken } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();

  // Simple state - no complex objects or effects
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [courseData, setCourseData] = useState<CourseData>({
    title: '',
    description: '',
    category: '',
    level: 'beginner',
    modules: []
  });

  // Start session maintenance on mount (simple, no dependencies)
  React.useEffect(() => {
    startSessionMaintenance(refreshToken);
    return () => stopSessionMaintenance();
  }, []); // Empty dependency array - runs once

  const steps = [
    'Course Details',
    'Modules & Content',
    'Assessment',
    'Review & Submit'
  ];

  const categories = [
    { value: 'programming', label: 'Programming' },
    { value: 'design', label: 'Design' },
    { value: 'business_tech', label: 'Business Tech' },
    { value: 'general_it', label: 'General IT' }
  ];

  const levels = [
    { value: 'beginner', label: 'Beginner' },
    { value: 'intermediate', label: 'Intermediate' },
    { value: 'advanced', label: 'Advanced' }
  ];

  // Simple handlers - no complex logic
  const updateCourse = (field: keyof CourseData, value: any) => {
    setCourseData(prev => ({ ...prev, [field]: value }));
  };

  const addModule = () => {
    const newModule: ModuleData = {
      id: `module-${Date.now()}`,
      title: '',
      description: '',
      questions: []
    };
    
    setCourseData(prev => ({
      ...prev,
      modules: [...prev.modules, newModule]
    }));
  };

  const updateModule = (moduleId: string, field: keyof ModuleData, value: any) => {
      setCourseData(prev => ({
        ...prev,
      modules: prev.modules.map(module => 
        module.id === moduleId ? { ...module, [field]: value } : module
      )
      }));
  };

  const removeModule = (moduleId: string) => {
    setCourseData(prev => ({
      ...prev,
      modules: prev.modules.filter(module => module.id !== moduleId)
    }));
  };

  const addQuestion = (moduleId: string) => {
    const newQuestion: QuizQuestion = {
      id: `q-${Date.now()}`,
          questionText: '',
          options: ['', '', '', ''],
          correctAnswer: 0,
      points: 1
    };

    updateModule(moduleId, 'questions', [
      ...courseData.modules.find(m => m.id === moduleId)?.questions || [],
      newQuestion
    ]);
  };

  const updateQuestion = (moduleId: string, questionId: string, field: keyof QuizQuestion, value: any) => {
    const module = courseData.modules.find(m => m.id === moduleId);
    if (!module) return;

    const updatedQuestions = module.questions.map(q => 
      q.id === questionId ? { ...q, [field]: value } : q
    );

    updateModule(moduleId, 'questions', updatedQuestions);
  };

  const updateQuestionOption = (moduleId: string, questionId: string, optionIndex: number, value: string) => {
    const module = courseData.modules.find(m => m.id === moduleId);
    if (!module) return;

    const updatedQuestions = module.questions.map(q => {
      if (q.id === questionId) {
        const newOptions = [...q.options] as [string, string, string, string];
        newOptions[optionIndex] = value;
        return { ...q, options: newOptions };
      }
      return q;
    });

    updateModule(moduleId, 'questions', updatedQuestions);
  };

  const removeQuestion = (moduleId: string, questionId: string) => {
    const module = courseData.modules.find(m => m.id === moduleId);
    if (!module) return;

    const updatedQuestions = module.questions.filter(q => q.id !== questionId);
    updateModule(moduleId, 'questions', updatedQuestions);
  };

  // Assessment handlers
  const enableAssessment = () => {
    const newAssessment: FinalAssessment = {
      id: `assessment-${Date.now()}`,
      title: 'Final Assessment',
      description: 'Complete this assessment to finish the course',
      questions: [],
        settings: {
        timeLimit: 60,
        attempts: 3,
          passingScore: 70,
          shuffleQuestions: true,
        showResultsImmediately: false
      }
    };
    updateCourse('finalAssessment', newAssessment);
  };

  const disableAssessment = () => {
    updateCourse('finalAssessment', undefined);
  };

  const addAssessmentQuestion = () => {
    if (!courseData.finalAssessment) return;
    
    const newQuestion: QuizQuestion = {
      id: `aq-${Date.now()}`,
      questionText: '',
      options: ['', '', '', ''],
      correctAnswer: 0,
      points: 1
    };

    const updatedAssessment = {
      ...courseData.finalAssessment,
      questions: [...courseData.finalAssessment.questions, newQuestion]
    };
    
    updateCourse('finalAssessment', updatedAssessment);
  };

  const updateAssessmentQuestion = (questionId: string, field: keyof QuizQuestion, value: any) => {
    if (!courseData.finalAssessment) return;

    const updatedQuestions = courseData.finalAssessment.questions.map(q => 
      q.id === questionId ? { ...q, [field]: value } : q
    );

    const updatedAssessment = {
      ...courseData.finalAssessment,
      questions: updatedQuestions
    };
    
    updateCourse('finalAssessment', updatedAssessment);
  };

  const updateAssessmentQuestionOption = (questionId: string, optionIndex: number, value: string) => {
    if (!courseData.finalAssessment) return;

    const updatedQuestions = courseData.finalAssessment.questions.map(q => {
      if (q.id === questionId) {
        const newOptions = [...q.options] as [string, string, string, string];
        newOptions[optionIndex] = value;
        return { ...q, options: newOptions };
      }
      return q;
    });

    const updatedAssessment = {
      ...courseData.finalAssessment,
      questions: updatedQuestions
    };
    
    updateCourse('finalAssessment', updatedAssessment);
  };

  const removeAssessmentQuestion = (questionId: string) => {
    if (!courseData.finalAssessment) return;

    const updatedQuestions = courseData.finalAssessment.questions.filter(q => q.id !== questionId);
    
    const updatedAssessment = {
      ...courseData.finalAssessment,
      questions: updatedQuestions
    };
    
    updateCourse('finalAssessment', updatedAssessment);
  };

    const handleThumbnailUpload = (fileData: {
    fileId: string;
    filename: string;
    url: string;
    size: number;
    type: string;
  }) => {
    updateCourse('thumbnailFileId', fileData.fileId);
    updateCourse('thumbnail', fileData.url);
  };

  const handleVideoUpload = (moduleId: string, fileData: {
    fileId: string;
    filename: string;
    url: string;
    size: number;
    type: string;
  }) => {
    updateModule(moduleId, 'videoFileId', fileData.fileId);
    updateModule(moduleId, 'videoUrl', fileData.url);
  };

  const saveDraft = async () => {
    setSaving(true);
    setError('');
    
    try {
      const payload = {
        title: courseData.title,
        description: courseData.description,
        category: courseData.category,
        level: courseData.level,
        language: 'en',
        status: 'draft',
        thumbnailFileId: courseData.thumbnailFileId,
        modules: courseData.modules.map((module, index) => ({
          id: module.id,
          title: module.title,
          order: index + 1,
          description: module.description,
          videoFileId: module.videoFileId,
          videoUrl: module.videoUrl,
          quiz: module.questions.length > 0 ? {
            id: `quiz-${module.id}`,
            title: `${module.title} Quiz`,
            questions: module.questions.map(q => ({
              id: q.id,
              questionText: q.questionText,
            type: 'multiple_choice',
              options: q.options,
              correctAnswer: q.correctAnswer,
              points: q.points
          })),
          settings: {
              timeLimit: 0,
              attempts: 3,
            passingScore: 70,
            shuffleQuestions: true,
            shuffleOptions: true,
            showResultsImmediately: false,
            showCorrectAnswers: true,
            allowReview: true,
              requireSequential: false
          },
          grading: {
            autoGrade: true,
            gradingMethod: 'highest',
            feedbackEnabled: true,
              detailedFeedback: true
            }
          } : null
                 })),
         finalAssessment: courseData.finalAssessment ? {
           id: courseData.finalAssessment.id,
           title: courseData.finalAssessment.title,
           description: courseData.finalAssessment.description,
           questions: courseData.finalAssessment.questions.map(q => ({
             id: q.id,
             questionText: q.questionText,
             type: 'multiple_choice',
             options: q.options,
             correctAnswer: q.correctAnswer,
             points: q.points
           })),
           settings: courseData.finalAssessment.settings,
           grading: {
             autoGrade: true,
             gradingMethod: 'highest',
             feedbackEnabled: true,
             detailedFeedback: true
           }
         } : null,
         type: 'course',
         createdAt: new Date().toISOString(),
         updatedAt: new Date().toISOString(),
         createdBy: user?.id,
         instructorId: user?.id,
         moduleCount: courseData.modules.length,
         totalQuestions: courseData.modules.reduce((total, module) => total + module.questions.length, 0) + 
                        (courseData.finalAssessment?.questions.length || 0)
       };

      await apiClient.createCourse(payload);
      setSuccess('Course draft saved successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error: any) {
      setError(error?.response?.data?.message || 'Failed to save course');
    } finally {
      setSaving(false);
    }
  };

  const submitCourse = async () => {
    setLoading(true);
    setError('');
    
    try {
      // First save as draft to ensure all data is saved
      const payload = {
        title: courseData.title,
        description: courseData.description,
        category: courseData.category,
        level: courseData.level,
        language: 'en',
        status: 'draft',
        thumbnailFileId: courseData.thumbnailFileId,
        modules: courseData.modules.map((module, index) => ({
        id: module.id,
        title: module.title,
        order: index + 1,
          description: module.description,
          videoFileId: module.videoFileId,
            videoUrl: module.videoUrl,
          quiz: module.questions.length > 0 ? {
            id: `quiz-${module.id}`,
            title: `${module.title} Quiz`,
            questions: module.questions.map(q => ({
              id: q.id,
              questionText: q.questionText,
              type: 'multiple_choice',
              options: q.options,
              correctAnswer: q.correctAnswer,
              points: q.points
            })),
            settings: {
              timeLimit: 0,
              attempts: 3,
              passingScore: 70,
              shuffleQuestions: true,
              shuffleOptions: true,
              showResultsImmediately: false,
              showCorrectAnswers: true,
              allowReview: true,
              requireSequential: false
            },
            grading: {
              autoGrade: true,
              gradingMethod: 'highest',
              feedbackEnabled: true,
              detailedFeedback: true
            }
          } : null
        })),
        finalAssessment: courseData.finalAssessment ? {
          id: courseData.finalAssessment.id,
          title: courseData.finalAssessment.title,
          description: courseData.finalAssessment.description,
          questions: courseData.finalAssessment.questions.map(q => ({
            id: q.id,
            questionText: q.questionText,
            type: 'multiple_choice',
            options: q.options,
            correctAnswer: q.correctAnswer,
            points: q.points
          })),
          settings: courseData.finalAssessment.settings,
          grading: {
            autoGrade: true,
            gradingMethod: 'highest',
            feedbackEnabled: true,
            detailedFeedback: true
          }
        } : null,
        type: 'course',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: user?.id,
        instructorId: user?.id,
        moduleCount: courseData.modules.length,
        totalQuestions: courseData.modules.reduce((total, module) => total + module.questions.length, 0) + 
                       (courseData.finalAssessment?.questions.length || 0)
      };

      // Create or update the course
      const courseResponse = await apiClient.createCourse(payload);
      const courseId = courseResponse.data?.course?._id || courseResponse.data?.course?.id;

      if (!courseId) {
        throw new Error('Failed to create course');
      }

      // Then submit it for approval (changes status to 'submitted')
      await apiClient.submitCourse(courseId);
      
      setSuccess('Course submitted for review! It will now appear in admin pending approvals.');
        setTimeout(() => {
        navigate('/dashboard/courses');
      }, 2000);
    } catch (error: any) {
      setError(error?.response?.data?.message || 'Failed to submit course');
    } finally {
      setLoading(false);
    }
  };

  const isStepValid = (step: number) => {
    switch (step) {
      case 0:
        return courseData.title.length >= 10 && 
               courseData.description.length >= 50 && 
               courseData.category && 
               courseData.level;
      case 1:
        return courseData.modules.length > 0 && 
               courseData.modules.every(m => m.title.length >= 5 && m.description.length >= 20);
      case 2:
        return true; // Assessment is optional
      case 3:
        return true; // Review step is always valid if previous steps are valid
      default:
        return false;
    }
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1 && isStepValid(currentStep)) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-5xl mx-auto px-4">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200">
        {/* Header */}
          <div className="px-8 py-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  {language === 'rw' ? 'Kuramo Amasomo' : 'Create Course'}
                </h1>
                <p className="text-gray-600">
                  Build and publish your course step by step
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Step {currentStep + 1} of {steps.length}</p>
                <div className="w-32 bg-gray-200 rounded-full h-2 mt-1">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                  ></div>
                </div>
                      </div>
                      </div>
            
            {/* Progress Steps */}
            <div className="mt-6">
              <div className="flex items-center justify-between">
                {steps.map((step, index) => (
                  <div key={index} className="flex items-center flex-1">
                    <div className="flex items-center">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-200 ${
                        index <= currentStep 
                          ? 'bg-blue-600 text-white shadow-lg' 
                          : 'bg-white border-2 border-gray-300 text-gray-400'
                      }`}>
                        {index < currentStep ? (
                          <CheckCircle className="w-5 h-5" />
                        ) : (
                          index + 1
                        )}
            </div>
                      <span className={`ml-3 text-sm font-medium ${
                        index <= currentStep ? 'text-blue-600' : 'text-gray-500'
                      }`}>
                        {step}
                      </span>
                    </div>
                    {index < steps.length - 1 && (
                      <div className={`flex-1 mx-4 h-0.5 transition-all duration-200 ${
                        index < currentStep ? 'bg-blue-600' : 'bg-gray-300'
                      }`} />
                    )}
                  </div>
                ))}
              </div>
          </div>
        </div>

          {/* Content */}
          <div className="p-8">
        {error && (
              <Alert variant="error" className="mb-8">
            <span>{error}</span>
          </Alert>
        )}

        {success && (
              <Alert variant="success" className="mb-8">
            <span>{success}</span>
          </Alert>
        )}

            {/* Step 0: Course Details */}
            {currentStep === 0 && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-900">Course Details</h2>
                
              <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Course Title *
                  </label>
                  <Input
                    value={courseData.title}
                    onChange={(e) => updateCourse('title', e.target.value)}
                    placeholder="Enter course title (minimum 10 characters)"
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {courseData.title.length}/100 characters
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Course Description *
                  </label>
                  <textarea
                    value={courseData.description}
                    onChange={(e) => updateCourse('description', e.target.value)}
                    placeholder="Describe your course (minimum 50 characters)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={4}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {courseData.description.length}/2000 characters
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category *
                  </label>
                  <select
                    value={courseData.category}
                      onChange={(e) => updateCourse('category', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select category</option>
                      {categories.map(cat => (
                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                    Level *
                  </label>
                  <select
                    value={courseData.level}
                      onChange={(e) => updateCourse('level', e.target.value as any)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {levels.map(level => (
                        <option key={level.value} value={level.value}>{level.label}</option>
                    ))}
                  </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Course Thumbnail
                  </label>
                  <FileUploadComponent
                    fileType="thumbnail"
                    onFileUploaded={handleThumbnailUpload}
                    maxSize={5}
                    className="w-full"
                  />
              </div>
            </div>
          )}

            {/* Step 1: Modules */}
            {currentStep === 1 && (
              <div className="space-y-6">
              <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900">Modules & Content</h2>
                  <Button onClick={addModule} size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Module
                </Button>
              </div>

              {courseData.modules.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <Video className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No modules yet</h3>
                    <p className="text-gray-500 mb-4">Add your first module to get started</p>
                    <Button onClick={addModule}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Module
                  </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {courseData.modules.map((module, moduleIndex) => (
                      <Card key={module.id} className="p-4">
                      <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-medium">Module {moduleIndex + 1}</h3>
            <Button
                            onClick={() => removeModule(module.id)}
              variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                        >
                            <X className="w-4 h-4" />
            </Button>
                      </div>

                      <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                            Module Title *
                          </label>
                          <Input
                            value={module.title}
                              onChange={(e) => updateModule(module.id, 'title', e.target.value)}
                            placeholder="Enter module title"
                          />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                            Module Description *
                          </label>
                          <textarea
                            value={module.description}
                              onChange={(e) => updateModule(module.id, 'description', e.target.value)}
                              placeholder="Describe this module"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              rows={3}
                          />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Module Video
                          </label>
                          <FileUploadComponent
                            fileType="video"
                            onFileUploaded={(fileData) => handleVideoUpload(module.id, fileData)}
                            maxSize={100}
                          />
                        </div>

                          {/* Quiz Questions */}
                        <div>
                            <div className="flex items-center justify-between mb-3">
                              <label className="block text-sm font-medium text-gray-700">
                                Quiz Questions
                                  </label>
                              <Button
                                onClick={() => addQuestion(module.id)}
                                variant="outline"
                                size="sm"
                              >
                                <Plus className="w-4 h-4 mr-1" />
                                Add Question
                              </Button>
                            </div>

                            {module.questions.map((question, qIndex) => (
                              <div key={question.id} className="border border-gray-200 rounded-lg p-4 mb-3">
                                <div className="flex items-center justify-between mb-3">
                                  <span className="text-sm font-medium text-gray-700">
                                    Question {qIndex + 1}
                                  </span>
                                  <Button
                                    onClick={() => removeQuestion(module.id, question.id)}
                                    variant="outline"
                                    size="sm"
                                    className="text-red-600"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>

                                <div className="space-y-3">
                                  <Input
                                    value={question.questionText}
                                    onChange={(e) => updateQuestion(module.id, question.id, 'questionText', e.target.value)}
                                    placeholder="Enter question text"
                                  />

                                  <div className="grid grid-cols-2 gap-2">
                                    {question.options.map((option, optIndex) => (
                                      <div key={optIndex} className="flex items-center space-x-2">
                                      <input
                                        type="radio"
                                        name={`correct-${question.id}`}
                                          checked={question.correctAnswer === optIndex}
                                          onChange={() => updateQuestion(module.id, question.id, 'correctAnswer', optIndex)}
                                          className="text-blue-600"
                                      />
                                      <Input
                                        value={option}
                                          onChange={(e) => updateQuestionOption(module.id, question.id, optIndex, e.target.value)}
                                          placeholder={`Option ${optIndex + 1}`}
                                        className="flex-1"
                                      />
                                    </div>
                                  ))}
                                  </div>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

                         {/* Step 2: Assessment */}
             {currentStep === 2 && (
               <div className="space-y-6">
                <div className="flex items-center justify-between">
                   <h2 className="text-xl font-semibold text-gray-900">Final Assessment</h2>
                   <div className="flex items-center space-x-2">
                     <input
                       type="checkbox"
                       id="enableAssessment"
                       checked={!!courseData.finalAssessment}
                       onChange={(e) => {
                         if (e.target.checked) {
                           enableAssessment();
                         } else {
                           disableAssessment();
                         }
                       }}
                       className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                     />
                     <label htmlFor="enableAssessment" className="text-sm font-medium text-gray-700">
                       Include final assessment
                     </label>
                    </div>
                  </div>

                 {!courseData.finalAssessment ? (
                   <div className="text-center py-12 bg-gray-50 rounded-lg">
                     <Award className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                     <h3 className="text-lg font-medium text-gray-900 mb-2">No final assessment</h3>
                     <p className="text-gray-500 mb-4">Add an optional final assessment to test overall course knowledge</p>
                     <Button onClick={enableAssessment}>
                       <Award className="w-4 h-4 mr-2" />
                       Add Assessment
                        </Button>
                  </div>
                 ) : (
                <div className="space-y-6">
                  <Card className="p-6">
                       <div className="space-y-4">
                         <div>
                           <label className="block text-sm font-medium text-gray-700 mb-2">
                        Assessment Title *
                      </label>
                      <Input
                        value={courseData.finalAssessment.title}
                             onChange={(e) => updateCourse('finalAssessment', {
                               ...courseData.finalAssessment!,
                            title: e.target.value
                             })}
                        placeholder="Enter assessment title"
                           />
                         </div>

                         <div>
                           <label className="block text-sm font-medium text-gray-700 mb-2">
                             Assessment Description
                           </label>
                           <textarea
                             value={courseData.finalAssessment.description}
                             onChange={(e) => updateCourse('finalAssessment', {
                               ...courseData.finalAssessment!,
                               description: e.target.value
                             })}
                             placeholder="Describe the final assessment"
                             className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                             rows={3}
                           />
                         </div>

                         <div className="grid grid-cols-3 gap-4">
                           <div>
                             <label className="block text-sm font-medium text-gray-700 mb-2">
                               Time Limit (minutes)
                             </label>
                             <Input
                               type="number"
                               value={courseData.finalAssessment.settings.timeLimit}
                               onChange={(e) => updateCourse('finalAssessment', {
                                 ...courseData.finalAssessment!,
                                 settings: {
                                   ...courseData.finalAssessment!.settings,
                                   timeLimit: parseInt(e.target.value) || 0
                                 }
                               })}
                               placeholder="60"
                             />
                           </div>

                           <div>
                             <label className="block text-sm font-medium text-gray-700 mb-2">
                               Max Attempts
                             </label>
                             <Input
                               type="number"
                               value={courseData.finalAssessment.settings.attempts}
                               onChange={(e) => updateCourse('finalAssessment', {
                                 ...courseData.finalAssessment!,
                                 settings: {
                                   ...courseData.finalAssessment!.settings,
                                   attempts: parseInt(e.target.value) || 1
                                 }
                               })}
                               placeholder="3"
                             />
                           </div>

                           <div>
                             <label className="block text-sm font-medium text-gray-700 mb-2">
                               Passing Score (%)
                             </label>
                             <Input
                               type="number"
                               value={courseData.finalAssessment.settings.passingScore}
                               onChange={(e) => updateCourse('finalAssessment', {
                                 ...courseData.finalAssessment!,
                                 settings: {
                                   ...courseData.finalAssessment!.settings,
                                   passingScore: parseInt(e.target.value) || 70
                                 }
                               })}
                               placeholder="70"
                             />
                           </div>
                         </div>
                    </div>
                  </Card>

                  <Card className="p-6">
                       <div className="flex items-center justify-between mb-4">
                         <h3 className="text-lg font-medium text-gray-900">Assessment Questions</h3>
                         <Button onClick={addAssessmentQuestion} size="sm">
                           <Plus className="w-4 h-4 mr-2" />
                           Add Question
                         </Button>
                       </div>

                       {courseData.finalAssessment.questions.length === 0 ? (
                         <div className="text-center py-8 bg-gray-50 rounded-lg">
                           <h4 className="text-md font-medium text-gray-900 mb-2">No questions yet</h4>
                           <p className="text-gray-500 mb-4">Add questions to test students' knowledge</p>
                           <Button onClick={addAssessmentQuestion} size="sm">
                             <Plus className="w-4 h-4 mr-2" />
                             Add First Question
                           </Button>
                         </div>
                       ) : (
                         <div className="space-y-4">
                      {courseData.finalAssessment.questions.map((question, qIndex) => (
                             <div key={question.id} className="border border-gray-200 rounded-lg p-4">
                               <div className="flex items-center justify-between mb-3">
                                 <span className="text-sm font-medium text-gray-700">
                                   Question {qIndex + 1}
                                 </span>
                                 <Button
                                   onClick={() => removeAssessmentQuestion(question.id)}
                                   variant="outline"
                                   size="sm"
                                   className="text-red-600"
                                 >
                                   <Trash2 className="w-4 h-4" />
                                 </Button>
                               </div>

                               <div className="space-y-3">
                            <Input
                              value={question.questionText}
                                   onChange={(e) => updateAssessmentQuestion(question.id, 'questionText', e.target.value)}
                                   placeholder="Enter question text"
                                 />

                                 <div className="grid grid-cols-2 gap-2">
                                   {question.options.map((option, optIndex) => (
                                     <div key={optIndex} className="flex items-center space-x-2">
                                <input
                                  type="radio"
                                         name={`correct-assessment-${question.id}`}
                                         checked={question.correctAnswer === optIndex}
                                         onChange={() => updateAssessmentQuestion(question.id, 'correctAnswer', optIndex)}
                                         className="text-blue-600"
                                />
                                <Input
                                  value={option}
                                         onChange={(e) => updateAssessmentQuestionOption(question.id, optIndex, e.target.value)}
                                         placeholder={`Option ${optIndex + 1}`}
                                  className="flex-1"
                                />
                              </div>
                            ))}
                                 </div>
                          </div>
                        </div>
                      ))}
                    </div>
                       )}
                  </Card>
                </div>
              )}
            </div>
          )}

             {/* Step 3: Review */}
             {currentStep === 3 && (
               <div className="space-y-6">
                 <h2 className="text-xl font-semibold text-gray-900">Review & Submit</h2>

              <Card className="p-6">
                   <h3 className="text-lg font-medium mb-4">Course Summary</h3>
                   <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                       <span className="font-medium text-gray-500">Title:</span>
                       <p className="text-gray-900">{courseData.title || 'Not set'}</p>
                    </div>
                    <div>
                       <span className="font-medium text-gray-500">Category:</span>
                       <p className="text-gray-900">{courseData.category || 'Not set'}</p>
                    </div>
                    <div>
                       <span className="font-medium text-gray-500">Level:</span>
                       <p className="text-gray-900">{courseData.level}</p>
                    </div>
                    <div>
                       <span className="font-medium text-gray-500">Modules:</span>
                       <p className="text-gray-900">{courseData.modules.length}</p>
                    </div>
                    <div>
                       <span className="font-medium text-gray-500">Module Questions:</span>
                       <p className="text-gray-900">{courseData.modules.reduce((total, module) => total + module.questions.length, 0)}</p>
                    </div>
                    <div>
                       <span className="font-medium text-gray-500">Final Assessment:</span>
                       <p className="text-gray-900">
                         {courseData.finalAssessment ? 
                           `Yes (${courseData.finalAssessment.questions.length} questions)` : 
                           'No'
                         }
                      </p>
                    </div>
                  </div>

                   {courseData.description && (
                     <div className="mt-4 pt-4 border-t border-gray-200">
                       <span className="font-medium text-gray-500">Description:</span>
                       <p className="text-gray-900 mt-1">{courseData.description}</p>
                  </div>
                   )}
              </Card>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex">
                    <Info className="w-5 h-5 text-yellow-600 mr-3 mt-0.5" />
                  <div>
                      <h4 className="text-sm font-medium text-yellow-800">Ready to Submit?</h4>
                      <p className="text-sm text-yellow-700 mt-1">
                        Once submitted, your course will be reviewed by administrators before being published.
                    </p>
                  </div>
                </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-8 py-6 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Button
                  onClick={saveDraft}
                  disabled={saving}
                  variant="outline"
                  className="px-6"
                >
                  {saving ? <LoadingSpinner size="sm" /> : <Save className="w-4 h-4 mr-2" />}
                  Save Draft
                </Button>
                
                {saving && (
                  <span className="text-sm text-gray-600">Saving...</span>
                )}
              </div>

              <div className="flex items-center space-x-3">
                {currentStep > 0 && (
            <Button
                    onClick={prevStep} 
              variant="outline"
                    className="px-6"
            >
              Previous
            </Button>
                )}
                
                {currentStep < steps.length - 1 ? (
            <Button
                    onClick={nextStep}
                    disabled={!isStepValid(currentStep)}
                    className="px-6 bg-blue-600 hover:bg-blue-700"
            >
              Next
            </Button>
                ) : (
                  <Button 
                    onClick={submitCourse}
                    disabled={loading || !isStepValid(currentStep)}
                    className="px-6 bg-green-600 hover:bg-green-700 text-white"
                  >
                    {loading ? <LoadingSpinner size="sm" /> : <Send className="w-4 h-4 mr-2" />}
                    Submit Course
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CourseCreation; 