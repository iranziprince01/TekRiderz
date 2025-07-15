import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { apiClient, isDevelopment } from '../../utils/api';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Alert } from '../../components/ui/Alert';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { FileUploadComponent } from '../../components/course/FileUploadComponent';
import { 
  BookOpen, 
  Video, 
  Award, 
  CheckCircle,
  ArrowLeft,
  Plus,
  Trash2,
  Upload,
  Save,
  Send,
  X,
  AlertCircle,
  Info
} from 'lucide-react';

// Types
interface ModuleQuizQuestion {
  id: string;
  questionText: string;
  type: 'multiple_choice';
  options: [string, string, string, string];
  correctAnswer: number;
  points: number;
}

interface ModuleQuiz {
  id: string;
  title: string;
  description: string;
  instructions: string;
  questions: ModuleQuizQuestion[];
  settings: {
    timeLimit: number;
    attempts: number;
    passingScore: number;
    shuffleQuestions: boolean;
    shuffleOptions: boolean;
    showResultsImmediately: boolean;
    showCorrectAnswers: boolean;
    allowReview: boolean;
    requireSequential: boolean;
  };
  grading: {
    autoGrade: boolean;
    gradingMethod: 'highest' | 'average' | 'latest';
    feedbackEnabled: boolean;
    detailedFeedback: boolean;
  };
  availability: {
    availableFrom?: string;
    availableUntil?: string;
    unlockConditions?: string[];
  };
}

interface Module {
  id: string;
  title: string;
  description: string;
  videoFileId?: string;
  videoUrl?: string;
  quiz: ModuleQuiz;
  order: number;
}

interface FinalAssessmentQuestion {
  id: string;
  questionText: string;
  type: 'multiple_choice';
  options: [string, string, string, string];
  correctAnswer: number;
  points: number;
}

interface FinalAssessment {
  id: string;
  title: string;
  description: string;
  instructions: string;
  questions: FinalAssessmentQuestion[];
  settings: {
    timeLimit: number;
    attempts: number;
    passingScore: number;
    shuffleQuestions: boolean;
    shuffleOptions: boolean;
    showResultsImmediately: boolean;
    showCorrectAnswers: boolean;
    allowReview: boolean;
    requireSequential: boolean;
  };
  grading: {
    autoGrade: boolean;
    gradingMethod: 'highest' | 'average' | 'latest';
    feedbackEnabled: boolean;
    detailedFeedback: boolean;
  };
}

interface CourseData {
  // Course Details
  title: string;
  shortDescription: string;
  description: string;
  thumbnail?: string;
  thumbnailFileId?: string;
  category: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
  learningObjectives: string[];
  
  // Modules
  modules: Module[];
  
  // Assessment (Optional)
  finalAssessment?: FinalAssessment;
  
  // Metadata
  status: 'draft' | 'pending' | 'submitted';
}

const CATEGORIES = [
  { value: 'programming', label: 'Programming' },
  { value: 'design', label: 'Design' },
  { value: 'business-tech', label: 'Business Tech' },
  { value: 'general-it', label: 'General IT' }
];

const LEVELS = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' }
];

const CourseCreation: React.FC = () => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [courseId, setCourseId] = useState<string | null>(null);

  const [courseData, setCourseData] = useState<CourseData>({
    title: '',
    shortDescription: '',
    description: '',
    category: '',
    level: 'beginner',
    tags: [],
    learningObjectives: [],
    modules: [],
    status: 'draft'
  });

  const [newTag, setNewTag] = useState('');
  const [newObjective, setNewObjective] = useState('');

  // Manual save only - no auto-save functionality
  // Users must manually save drafts or submit course
  const autoSave = {
    saving: false,
    lastSaved: null,
    hasUnsavedChanges: false
  };

  const tabs = [
    { id: 0, name: 'Course Details', icon: BookOpen },
    { id: 1, name: 'Modules', icon: Video },
    { id: 2, name: 'Assessment', icon: Award },
    { id: 3, name: 'Submission', icon: CheckCircle }
  ];

  // Helper functions
  const addTag = () => {
    if (newTag.trim() && !courseData.tags.includes(newTag.trim())) {
      setCourseData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }));
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setCourseData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const addObjective = () => {
    if (newObjective.trim()) {
      setCourseData(prev => ({
        ...prev,
        learningObjectives: [...prev.learningObjectives, newObjective.trim()]
      }));
      setNewObjective('');
    }
  };

  const removeObjective = (objToRemove: string) => {
    setCourseData(prev => ({
      ...prev,
      learningObjectives: prev.learningObjectives.filter(obj => obj !== objToRemove)
    }));
  };

  const addModule = () => {
    const newModule: Module = {
      id: `module-${Date.now()}`,
      title: '',
      description: '',
      quiz: {
        id: `module-quiz-${Date.now()}`,
        title: '',
        description: '',
        instructions: '',
        questions: Array.from({ length: 3 }, (_, i) => ({
          id: `q-${Date.now()}-${i}`,
          questionText: '',
          type: 'multiple_choice',
          options: ['', '', '', ''],
          correctAnswer: 0,
          points: 1,
        })),
        settings: {
          timeLimit: 0, // Untimed quiz
          attempts: 3, // Exactly 3 attempts
          passingScore: 70,
          shuffleQuestions: true,
          shuffleOptions: true,
          showResultsImmediately: false,
          showCorrectAnswers: true,
          allowReview: true,
          requireSequential: false,
        },
        grading: {
          autoGrade: true,
          gradingMethod: 'highest',
          feedbackEnabled: true,
          detailedFeedback: true,
        },
        availability: {},
      },
      order: courseData.modules.length
    };

    setCourseData(prev => ({
      ...prev,
      modules: [...prev.modules, newModule]
    }));
  };

  const updateModule = (moduleId: string, updates: Partial<Module>) => {
    setCourseData(prev => ({
      ...prev,
      modules: prev.modules.map(module =>
        module.id === moduleId ? { ...module, ...updates } : module
      )
    }));
  };

  const removeModule = (moduleId: string) => {
    setCourseData(prev => ({
      ...prev,
      modules: prev.modules.filter(module => module.id !== moduleId)
    }));
  };

    const handleThumbnailUpload = (fileData: {
    fileId: string;
    filename: string;
    url: string;
    size: number;
    type: string;
  }) => {
    setCourseData(prev => ({
      ...prev,
      thumbnailFileId: fileData.fileId,
      thumbnail: fileData.url
    }));
  };

  const handleVideoUpload = (moduleId: string, fileData: {
    fileId: string;
    filename: string;
    url: string;
    size: number;
    type: string;
  }) => {
    updateModule(moduleId, {
      videoFileId: fileData.fileId,
      videoUrl: fileData.url
    });
  };

  const enableAssessment = () => {
    setCourseData(prev => ({
      ...prev,
      finalAssessment: {
          id: `final-assessment-${Date.now()}`,
          title: '',
          description: '',
          instructions: '',
          questions: Array.from({ length: 10 }, (_, i) => ({
            id: `final-q-${Date.now()}-${i}`,
            questionText: '',
            type: 'multiple_choice',
            options: ['', '', '', ''],
            correctAnswer: 0,
            points: 1,
          })),
          settings: {
            timeLimit: 0, // Untimed quiz
            attempts: 3, // Exactly 3 attempts
            passingScore: 70,
            shuffleQuestions: true,
            shuffleOptions: true,
            showResultsImmediately: false,
            showCorrectAnswers: true,
            allowReview: true,
            requireSequential: false,
          },
          grading: {
            autoGrade: true,
            gradingMethod: 'highest',
            feedbackEnabled: true,
            detailedFeedback: true,
          },
      }
    }));
  };

  const disableAssessment = () => {
    setCourseData(prev => ({
      ...prev,
      finalAssessment: undefined
    }));
  };

  const saveDraft = async () => {
    setSaving(true);
    setError('');
    
    try {
      // Validate required fields
      if (!courseData.title || !courseData.shortDescription || !courseData.description) {
        setError('Please fill in all required fields');
        return;
      }

      // Prepare course data for backend
      const formData = new FormData();
      
      // Basic course info
      formData.append('title', courseData.title);
      formData.append('shortDescription', courseData.shortDescription);
      formData.append('description', courseData.description);
      formData.append('category', courseData.category);
      formData.append('level', courseData.level);
      formData.append('language', 'en');
      formData.append('price', '0');
      formData.append('currency', 'USD');
      formData.append('status', 'draft');
      
      // Arrays as JSON strings
      formData.append('tags', JSON.stringify(courseData.tags));
      formData.append('requirements', JSON.stringify([]));
      formData.append('learningObjectives', JSON.stringify(courseData.learningObjectives));
      formData.append('targetAudience', 'General learners');
      
      // Convert modules to sections format expected by backend
      const sections = courseData.modules.map((module, index) => ({
        id: module.id,
        title: module.title,
        description: module.description,
        order: index + 1,
        isPublished: true, // Set to true so they appear in course
        isRequired: true,
        estimatedDuration: 1800, // 30 minutes default
        learningObjectives: [],
        lessons: module.videoUrl ? [{
          id: `lesson_${module.id}`,
          title: module.title,
          description: module.description,
          type: 'video',
          content: {
            videoUrl: module.videoUrl,
            videoFileId: module.videoFileId, // Include file ID for backend processing
            duration: 1800
          },
          order: 1,
          isPublished: true, // Set to true so they appear in course
          isRequired: true,
          estimatedDuration: 30,
          // Store quiz in the lesson where the quiz submission handler expects it
          quiz: module.quiz.questions.length > 0 ? {
            id: module.quiz.id,
            title: module.quiz.title || `${module.title} Quiz`,
            description: module.quiz.description || `Quiz for ${module.title}`,
            instructions: module.quiz.instructions || 'Answer all questions to complete this module.',
            questions: module.quiz.questions.map(q => ({
              id: q.id,
              questionText: q.questionText,
              type: q.type,
              options: q.options,
              correctAnswer: q.correctAnswer,
              points: q.points
            })),
            settings: module.quiz.settings,
            grading: module.quiz.grading,
            availability: module.quiz.availability
          } : undefined // Only include quiz if it has questions
        }] : [],
        // Remove moduleQuiz as it's now stored in lessons
        // moduleQuiz: null
      }));
      
      formData.append('sections', JSON.stringify(sections));
      
      // Add final assessment if exists
      if (courseData.finalAssessment) {
        formData.append('finalAssessment', JSON.stringify({
          id: courseData.finalAssessment.id,
          title: courseData.finalAssessment.title,
          description: courseData.finalAssessment.description,
          instructions: courseData.finalAssessment.instructions,
          questions: courseData.finalAssessment.questions.map(q => ({
            id: q.id,
            questionText: q.questionText,
            type: q.type,
            options: q.options,
            correctAnswer: q.correctAnswer,
            points: q.points
          })),
          settings: courseData.finalAssessment.settings,
          grading: courseData.finalAssessment.grading
        }));
      }
      
      // Add thumbnail file if exists
      if (courseData.thumbnailFileId) {
        formData.append('thumbnailFileId', courseData.thumbnailFileId);
      }
      
      // Calculate totals
      const totalLessons = sections.reduce((total, section) => total + section.lessons.length, 0);
      const totalDuration = sections.reduce((total, section) => total + section.estimatedDuration, 0);
      
      formData.append('totalLessons', totalLessons.toString());
      formData.append('totalDuration', totalDuration.toString());
      
      // Set content flags based on course content
      const contentFlags = {
        hasVideo: courseData.modules.some(m => m.videoUrl),
        hasQuizzes: courseData.modules.length > 0 || !!courseData.finalAssessment,
        hasAssignments: false,
        hasCertificate: false,
        hasPrerequisites: false,
        isAccessible: false
      };
      
      formData.append('contentFlags', JSON.stringify(contentFlags));

      console.log('Saving course draft...', { 
        title: courseData.title,
        sections: sections.length,
        totalLessons,
        totalDuration,
        contentFlags
      });

      const result = await apiClient.createCourse(formData);
      
      if (result.success) {
        setSuccess('Course saved as draft successfully!');
        setTimeout(() => setSuccess(''), 3000);
        
        // Store the course ID for later submission
        if (result.data && typeof result.data === 'object' && 'course' in result.data) {
          const createdCourse = result.data.course as any;
          const newCourseId = createdCourse._id || createdCourse.id;
          setCourseId(newCourseId);
          console.log('Course created with ID:', newCourseId);
          return newCourseId;
        }
      } else {
        throw new Error(result.error || 'Failed to save course');
      }
    } catch (error) {
      console.error('Error saving course:', error);
      setError(error instanceof Error ? error.message : 'Failed to save course');
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const submitCourse = async () => {
    setLoading(true);
    setError('');
    
    try {
      // Validate required fields
      if (!courseData.title || !courseData.shortDescription || !courseData.description) {
        setError('Please fill in all required fields');
        return;
      }

      if (courseData.modules.length === 0) {
        setError('Please add at least one module');
        return;
      }

      // Check if modules have required content
      const incompleteModules = courseData.modules.filter(module => 
        !module.title || !module.description || !module.videoUrl
      );
      
      if (incompleteModules.length > 0) {
        setError('Please complete all modules (title, description, and video required)');
        return;
      }

      // First save as draft and get course ID
      const createdCourseId = await saveDraft();
      
      if (!createdCourseId) {
        throw new Error('Failed to create course - no course ID returned');
      }

      // Then submit for approval using the actual course ID
      console.log('Submitting course for approval...', createdCourseId);
      const response = await apiClient.submitCourse(createdCourseId);

      if (response.success) {
        // All courses go through approval process regardless of environment
        setSuccess('Course submitted successfully! It will be reviewed by an administrator before publication.');
        setTimeout(() => {
          navigate('/tutor/courses');
        }, 3000);
      } else {
        throw new Error(response.error || 'Failed to submit course');
      }
    } catch (error) {
      console.error('Error submitting course:', error);
      setError(error instanceof Error ? error.message : 'Failed to submit course');
    } finally {
      setLoading(false);
    }
  };

  const canProceed = (tabIndex: number) => {
    switch (tabIndex) {
      case 0:
        return courseData.title && courseData.shortDescription && courseData.description && 
               courseData.category && courseData.tags.length > 0 && courseData.learningObjectives.length > 0;
      case 1:
        return courseData.modules.length > 0;
      case 2:
        return true; // Assessment is optional
      case 3:
        return courseData.title && courseData.modules.length > 0;
      default:
        return false;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                onClick={() => navigate('/dashboard')}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  Create New Course
                </h1>
                  <p className="text-gray-600 dark:text-gray-400">
                  Build and publish your course step by step
                </p>
                      </div>
                      </div>
            
            {/* Manual save only - no auto-save status */}
            <div className="flex items-center space-x-4">
              <Button 
                onClick={saveDraft}
                disabled={saving}
                variant="outline"
                size="sm"
                className="shadow-sm"
              >
                {saving ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                {language === 'rw' ? 'Bika Igishushanyo' : 'Save Draft'}
              </Button>
            </div>
          </div>
        </div>

        {/* Error and Success Messages */}
        {error && (
          <Alert variant="error" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
            <Button variant="ghost" size="sm" onClick={() => setError('')} className="ml-auto">
              <X className="h-4 w-4" />
            </Button>
          </Alert>
        )}

        {success && (
          <Alert variant="success" className="mb-6">
            <CheckCircle className="h-4 w-4" />
            <span>{success}</span>
            <Button variant="ghost" size="sm" onClick={() => setSuccess('')} className="ml-auto">
              <X className="h-4 w-4" />
            </Button>
          </Alert>
        )}

        {/* Tab Navigation */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-8">
          <div className="flex">
            {tabs.map((tab, index) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(index)}
                className={`flex-1 flex items-center justify-center space-x-2 py-4 px-6 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === index
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                <span>{tab.name}</span>
                {canProceed(index) && <CheckCircle className="w-4 h-4 text-green-500" />}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          {/* Course Details Tab */}
          {activeTab === 0 && (
            <div className="p-6 space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Course Details
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Provide basic information about your course
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Course Title *
                  </label>
                  <Input
                    type="text"
                    value={courseData.title}
                    onChange={(e) => setCourseData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Enter course title"
                    className="w-full"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Short Description *
                  </label>
                  <Input
                    type="text"
                    value={courseData.shortDescription}
                    onChange={(e) => setCourseData(prev => ({ ...prev, shortDescription: e.target.value }))}
                    placeholder="Brief course description"
                    className="w-full"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Detailed Description *
                  </label>
                  <textarea
                    value={courseData.description}
                    onChange={(e) => setCourseData(prev => ({ ...prev, description: e.target.value }))}
                    rows={4}
                    placeholder="Detailed course description"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Category *
                  </label>
                  <select
                    value={courseData.category}
                    onChange={(e) => setCourseData(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">Select category</option>
                    {CATEGORIES.map(category => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Level *
                  </label>
                  <select
                    value={courseData.level}
                    onChange={(e) => setCourseData(prev => ({ ...prev, level: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  >
                    {LEVELS.map(level => (
                      <option key={level.value} value={level.value}>
                        {level.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Course Thumbnail
                  </label>
                  <FileUploadComponent
                    fileType="thumbnail"
                    entityType="course"
                    currentFileUrl={courseData.thumbnail}
                    onFileUploaded={handleThumbnailUpload}
                    onFileDeleted={() => setCourseData(prev => ({ ...prev, thumbnail: undefined, thumbnailFileId: undefined }))}
                    maxSize={10}
                    className="w-full"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Tags *
                  </label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {courseData.tags.map(tag => (
                      <span
                        key={tag}
                        className="inline-flex items-center px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-full text-sm"
                      >
                        {tag}
                        <button
                          onClick={() => removeTag(tag)}
                          className="ml-2 text-blue-600 hover:text-blue-800"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex space-x-2">
                    <Input
                      type="text"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      placeholder="Add tag"
                      className="flex-1"
                      onKeyPress={(e) => e.key === 'Enter' && addTag()}
                    />
                    <Button onClick={addTag} variant="outline">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Learning Objectives *
                  </label>
                  <div className="space-y-2 mb-3">
                    {courseData.learningObjectives.map((objective, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">
                          • {objective}
                        </span>
                        <button
                          onClick={() => removeObjective(objective)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex space-x-2">
                    <Input
                      type="text"
                      value={newObjective}
                      onChange={(e) => setNewObjective(e.target.value)}
                      placeholder="Add learning objective"
                      className="flex-1"
                      onKeyPress={(e) => e.key === 'Enter' && addObjective()}
                    />
                    <Button onClick={addObjective} variant="outline">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Modules Tab */}
          {activeTab === 1 && (
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    Course Modules
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400">
                    Add modules with content and short quizzes
                  </p>
                </div>
                <Button onClick={addModule} className="flex items-center space-x-2">
                  <Plus className="w-4 h-4" />
                  <span>Add Module</span>
                </Button>
              </div>

              {courseData.modules.length === 0 ? (
                <Card className="p-8 text-center">
                  <Video className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    No modules added yet
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Start by adding your first course module
                  </p>
                  <Button onClick={addModule} className="flex items-center space-x-2">
                    <Plus className="w-4 h-4" />
                    <span>Add First Module</span>
                  </Button>
                </Card>
              ) : (
                <div className="space-y-6">
                  {courseData.modules.map((module, index) => (
                    <Card key={module.id} className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          Module {index + 1}
                        </h3>
            <Button
              variant="outline"
                          size="sm"
                          onClick={() => removeModule(module.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
            </Button>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Module Title *
                          </label>
                          <Input
                            type="text"
                            value={module.title}
                            onChange={(e) => updateModule(module.id, { title: e.target.value })}
                            placeholder="Enter module title"
                            className="w-full"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Module Description *
                          </label>
                          <textarea
                            value={module.description}
                            onChange={(e) => updateModule(module.id, { description: e.target.value })}
                            rows={2}
                            placeholder="Describe what students will learn"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Module Video *
                          </label>
                          <FileUploadComponent
                            fileType="video"
                            entityType="course"
                            currentFileUrl={module.videoUrl}
                            onFileUploaded={(fileData) => handleVideoUpload(module.id, fileData)}
                            onFileDeleted={() => updateModule(module.id, { videoUrl: undefined, videoFileId: undefined })}
                            maxSize={100}
                            className="w-full"
                          />
                        </div>

                        <div>
                          <h4 className="text-md font-medium text-gray-900 dark:text-white mb-3">
                            Module Quiz (3 Questions)
                          </h4>
                          <div className="space-y-4">
                            {module.quiz.questions.map((question, qIndex) => (
                              <div key={question.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                <div className="mb-3">
                                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Question {qIndex + 1} *
                                  </label>
                                  <Input
                                    type="text"
                                    value={question.questionText}
                                                                          onChange={(e) => {
                                        const newQuestions = [...module.quiz.questions];
                                        newQuestions[qIndex] = { ...question, questionText: e.target.value };
                                        updateModule(module.id, { quiz: { ...module.quiz, questions: newQuestions } });
                                      }}
                                    placeholder="Enter question"
                                    className="w-full"
                                  />
                                </div>
                                <div className="space-y-2">
                                  {question.options.map((option, oIndex) => (
                                    <div key={oIndex} className="flex items-center space-x-2">
                                      <input
                                        type="radio"
                                        name={`correct-${question.id}`}
                                        checked={question.correctAnswer === oIndex}
                                        onChange={() => {
                                          const newQuestions = [...module.quiz.questions];
                                          newQuestions[qIndex] = { ...question, correctAnswer: oIndex };
                                          updateModule(module.id, { quiz: { ...module.quiz, questions: newQuestions } });
                                        }}
                                        className="w-4 h-4 text-blue-600"
                                      />
                                      <Input
                                        type="text"
                                        value={option}
                                        onChange={(e) => {
                                          const newQuestions = [...module.quiz.questions];
                                          const newOptions = [...question.options] as [string, string, string, string];
                                          newOptions[oIndex] = e.target.value;
                                          newQuestions[qIndex] = { ...question, options: newOptions };
                                          updateModule(module.id, { quiz: { ...module.quiz, questions: newQuestions } });
                                        }}
                                        placeholder={`Option ${oIndex + 1}`}
                                        className="flex-1"
                                      />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Assessment Tab */}
          {activeTab === 2 && (
            <div className="p-6 space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Final Assessment (Optional)
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Add a comprehensive assessment with 10 multiple choice questions
                </p>
              </div>

              <Card className="p-6">
                <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
                    <Award className="w-8 h-8 text-blue-600" />
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Add Final Assessment
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Test students' overall understanding
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    {courseData.finalAssessment ? (
                      <>
                        <span className="text-sm text-green-600 font-medium">
                          Assessment Enabled
                        </span>
              <Button
                variant="outline"
                          onClick={disableAssessment}
                          className="text-red-600 hover:text-red-700"
                        >
                          Remove
                        </Button>
                      </>
                    ) : (
                      <Button onClick={enableAssessment} className="flex items-center space-x-2">
                        <Plus className="w-4 h-4" />
                        <span>Add Assessment</span>
              </Button>
                    )}
                  </div>
                </div>
              </Card>

              {courseData.finalAssessment && (
                <div className="space-y-6">
                  <Card className="p-6">
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Assessment Title *
                      </label>
                      <Input
                        type="text"
                        value={courseData.finalAssessment.title}
                        onChange={(e) => setCourseData(prev => ({
                          ...prev,
                          finalAssessment: prev.finalAssessment ? {
                            ...prev.finalAssessment,
                            title: e.target.value
                          } : undefined
                        }))}
                        placeholder="Enter assessment title"
                        className="w-full"
                      />
                    </div>
                  </Card>

                  <Card className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Assessment Questions (10 Questions)
                    </h3>
                    <div className="space-y-6">
                      {courseData.finalAssessment.questions.map((question, qIndex) => (
                        <div key={question.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                          <div className="mb-3">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Question {qIndex + 1} *
                            </label>
                            <Input
                              type="text"
                              value={question.questionText}
                              onChange={(e) => {
                                const newQuestions = [...courseData.finalAssessment!.questions];
                                newQuestions[qIndex] = { ...question, questionText: e.target.value };
                                setCourseData(prev => ({
                                  ...prev,
                                  finalAssessment: prev.finalAssessment ? {
                                    ...prev.finalAssessment,
                                    questions: newQuestions
                                  } : undefined
                                }));
                              }}
                              placeholder="Enter question"
                              className="w-full"
                            />
                          </div>
                          <div className="space-y-2">
                            {question.options.map((option, oIndex) => (
                              <div key={oIndex} className="flex items-center space-x-2">
                                <input
                                  type="radio"
                                  name={`final-correct-${question.id}`}
                                  checked={question.correctAnswer === oIndex}
                                  onChange={() => {
                                    const newQuestions = [...courseData.finalAssessment!.questions];
                                    newQuestions[qIndex] = { ...question, correctAnswer: oIndex };
                                    setCourseData(prev => ({
                                      ...prev,
                                      finalAssessment: prev.finalAssessment ? {
                                        ...prev.finalAssessment,
                                        questions: newQuestions
                                      } : undefined
                                    }));
                                  }}
                                  className="w-4 h-4 text-blue-600"
                                />
                                <Input
                                  type="text"
                                  value={option}
                                  onChange={(e) => {
                                    const newQuestions = [...courseData.finalAssessment!.questions];
                                    const newOptions = [...question.options] as [string, string, string, string];
                                    newOptions[oIndex] = e.target.value;
                                    newQuestions[qIndex] = { ...question, options: newOptions };
                                    setCourseData(prev => ({
                                      ...prev,
                                      finalAssessment: prev.finalAssessment ? {
                                        ...prev.finalAssessment,
                                        questions: newQuestions
                                      } : undefined
                                    }));
                                  }}
                                  placeholder={`Option ${oIndex + 1}`}
                                  className="flex-1"
                                />
                                {question.correctAnswer === oIndex && (
                                  <span className="text-green-600 text-sm font-medium">Correct</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              )}
            </div>
          )}

          {/* Submission Tab */}
          {activeTab === 3 && (
            <div className="p-6 space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Review & Submit
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Review your course details and submit for approval
                </p>
              </div>

              <Card className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Course Summary
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm font-medium text-gray-500">Title:</span>
                      <p className="text-gray-900 dark:text-white">{courseData.title || 'Not set'}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-500">Category:</span>
                      <p className="text-gray-900 dark:text-white">{courseData.category || 'Not set'}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-500">Level:</span>
                      <p className="text-gray-900 dark:text-white">{courseData.level}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-500">Modules:</span>
                      <p className="text-gray-900 dark:text-white">{courseData.modules.length}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-500">Tags:</span>
                      <p className="text-gray-900 dark:text-white">{courseData.tags.length}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-500">Final Assessment:</span>
                      <p className="text-gray-900 dark:text-white">
                        {courseData.finalAssessment ? 'Yes' : 'No'}
                      </p>
                    </div>
                  </div>

                  <div>
                    <span className="text-sm font-medium text-gray-500">Description:</span>
                    <p className="text-gray-900 dark:text-white">{courseData.description || 'Not set'}</p>
                  </div>

                  <div>
                    <span className="text-sm font-medium text-gray-500">Learning Objectives:</span>
                    <ul className="list-disc list-inside text-gray-900 dark:text-white">
                      {courseData.learningObjectives.map((obj, index) => (
                        <li key={index}>{obj}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Card>

              <Card className="p-6 bg-blue-50 dark:bg-blue-900/20">
                <div className="flex items-center space-x-3">
                  <Info className="w-5 h-5 text-blue-600" />
                  <div>
                    <h4 className="font-medium text-blue-900 dark:text-blue-100">
                      Submission Guidelines
                    </h4>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      Once submitted, your course will be reviewed by our team. You can save as draft to continue editing later.
                    </p>
                  </div>
                </div>
              </Card>

              <div className="flex items-center space-x-4">
                <Button
                  onClick={saveDraft}
                  variant="outline"
                  disabled={saving}
                  className="flex items-center space-x-2"
                >
                  {saving ? <LoadingSpinner size="sm" /> : <Save className="w-4 h-4" />}
                  <span>Save Draft</span>
                </Button>
                <Button
                  onClick={submitCourse}
                  disabled={loading || !canProceed(3)}
                  className="flex items-center space-x-2"
                >
                  {loading ? <LoadingSpinner size="sm" /> : <Send className="w-4 h-4" />}
                  <span>Submit for Approval</span>
                </Button>
              </div>
            </div>
          )}

          {/* Navigation Footer */}
          <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
            <Button
              variant="outline"
              onClick={() => setActiveTab(Math.max(0, activeTab - 1))}
              disabled={activeTab === 0}
            >
              Previous
            </Button>
            <div className="text-sm text-gray-500">
              Step {activeTab + 1} of {tabs.length}
            </div>
            <Button
              onClick={() => setActiveTab(Math.min(tabs.length - 1, activeTab + 1))}
              disabled={activeTab === tabs.length - 1}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CourseCreation; 