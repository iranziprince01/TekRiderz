import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { apiClient } from '../../utils/api';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import CloudinaryImageUpload from '../../components/course/CloudinaryImageUpload';
import YouTubeVideoInput from '../../components/course/YouTubeVideoInput';
import JsonQuizCreator from '../../components/course/JsonQuizCreator';
import { 
  Plus, 
  Trash2, 
  Save, 
  Send, 
  ArrowLeft,
  ArrowRight,
  GraduationCap,
  Video,
  ClipboardList,
  AlertCircle,
  Check,
  FileText,
  Award,
  Eye,
  Clock,
  Target
} from 'lucide-react';

interface ModuleQuiz {
  id: string;
  title: string;
  description: string;
  questions: any[];
  settings: {
    maxAttempts: number;
    passingScore: number;
    showCorrectAnswers: boolean;
  };
}

interface CourseModule {
  id: string;
  title: string;
  description: string;
  order: number;
  content: {
    videoProvider: 'youtube';
    videoUrl: string;
    videoId?: string;
  };
  quiz: ModuleQuiz;
  estimatedDuration: number;
}

interface FinalAssessment {
  id: string;
  title: string;
  description: string;
  questions: any[];
  settings: {
    maxAttempts: number;
    passingScore: number;
    showCorrectAnswers: boolean;
    timeLimit: number; // 0 for untimed
  };
}

interface CourseData {
  id?: string;
  title: string;
  description: string;
  category: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  language: 'en' | 'rw';
  thumbnail: string;
  modules: CourseModule[];
  finalAssessment?: FinalAssessment;
  tags: string[];
  requirements: string[];
  learningObjectives: string[];
  targetAudience: string;
}

const CATEGORIES = [
  { value: 'programming', label: 'Programming', labelRw: 'Porogaramu' },
  { value: 'design', label: 'Design', labelRw: 'Gushushanya' },
  { value: 'business-tech', label: 'Business Tech', labelRw: 'Ikoranabuhanga mu Bucuruzi' },
  { value: 'general-it', label: 'General IT', labelRw: 'Ikoranabuhanga Rusange' }
];

const STEPS = [
  { 
    id: 1, 
    title: 'Course Details', 
    titleRw: 'Amakuru y\'Isomo',
    icon: FileText, 
    description: 'Basic course information',
    descriptionRw: 'Amakuru y\'ibanze ku isomo'
  },
  { 
    id: 2, 
    title: 'Modules', 
    titleRw: 'Ibice',
    icon: Video, 
    description: 'Course content and quizzes',
    descriptionRw: 'Ibirimo by\'isomo n\'ibizamini'
  },
  { 
    id: 3, 
    title: 'Assessment', 
    titleRw: 'Ikizamini',
    icon: ClipboardList, 
    description: 'Final course assessment',
    descriptionRw: 'Ikizamini cya nyuma'
  },
  { 
    id: 4, 
    title: 'Review & Submit', 
    titleRw: 'Gusuzuma no Kohereza',
    icon: Check, 
    description: 'Review and publish course',
    descriptionRw: 'Gusuzuma no gutangaza isomo'
  }
];

export const CourseCreation: React.FC = () => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const { id: courseId } = useParams();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [isEditing] = useState(!!courseId);

  // Debug logging
  console.log('CourseCreation component initialized:', {
    courseId,
    isEditing,
    userId: user?.id,
    userRole: user?.role
  });

  // Helper function to safely convert errors to strings
  const safeErrorMessage = (error: any): string => {
    if (typeof error === 'string') return error;
    if (error?.message) return error.message;
    if (error?.toString) return error.toString();
    return 'An unexpected error occurred';
  };

  const [courseData, setCourseData] = useState<CourseData>({
    title: '',
    description: '',
    category: 'programming',
    level: 'beginner',
    language: 'en',
    thumbnail: '',
    modules: [],
    tags: [],
    requirements: [],
    learningObjectives: [],
    targetAudience: ''
  });



  // Load existing course data if editing
  useEffect(() => {
    if (isEditing && courseId) {
      console.log('Effect triggered: loading course data for editing', { isEditing, courseId });
      
      // Accept both MongoDB ObjectIds and custom course IDs
      if (typeof courseId !== 'string' || courseId.length < 5) {
        console.error('Invalid course ID format detected:', courseId);
        setError('Invalid course ID. Redirecting to courses list...');
        setTimeout(() => {
          navigate('/dashboard/courses', {
            state: {
              message: 'Invalid course ID detected. Please select a valid course to edit.',
              type: 'error'
            }
          });
        }, 2000);
        return;
      }
      
      loadCourseData();
    }
  }, [isEditing, courseId, navigate]);

  // Check if user has permission to edit this course
  useEffect(() => {
    if (isEditing && !loading && !error && courseData.title) {
      // Course loaded successfully, check permissions
      console.log('Course loaded, checking edit permissions');
    }
  }, [isEditing, loading, error, courseData.title]);

  const loadCourseData = async () => {
    setLoading(true);
    setError('');
    
    try {
      console.log('Loading course data for editing, courseId:', courseId);
      const response = await apiClient.getCourse(courseId!);
      
      if (response.success && response.data) {
        console.log('Course data loaded successfully:', response.data);
        
        // Extract course from response data structure
        const course = response.data.course || response.data;
        
        if (!course) {
          throw new Error('Course data not found in response');
        }
        
        console.log('Processing course data:', course);
        
        // Convert existing course structure to course creation format
        const modules = course.sections?.flatMap((section: any) => 
          section.lessons?.filter((lesson: any) => lesson.type === 'video').map((lesson: any, index: number) => ({
            id: lesson.id || `lesson_${index}`,
            title: lesson.title || 'Untitled Lesson',
            description: lesson.description || '',
            order: index,
            content: {
              videoProvider: lesson.content?.videoProvider || 'youtube',
              videoUrl: lesson.content?.videoUrl || '',
              videoId: lesson.content?.videoId || ''
            },
            quiz: lesson.quiz || {
              id: `quiz_${lesson.id || index}`,
              title: `${lesson.title || 'Lesson'} Quiz`,
              description: '',
              questions: [],
              settings: {
                maxAttempts: 3,
                passingScore: 70,
                showCorrectAnswers: true
              }
            },
            estimatedDuration: lesson.estimatedDuration || 15
          }))
        ) || [];
        
        console.log('Converted modules:', modules);
        
        setCourseData({
          title: course.title || '',
          description: course.description || '',
          category: course.category || 'programming',
          level: course.level || 'beginner',
          language: course.language || 'en',
          thumbnail: course.thumbnail || '',
          modules: modules,
          tags: course.tags || [],
          requirements: course.requirements || [],
          learningObjectives: course.learningObjectives || [],
          targetAudience: course.targetAudience || '',
          finalAssessment: course.finalAssessment
        });
        
        console.log('Course data set successfully for editing');
      } else {
        throw new Error(response.error || 'Failed to load course data');
      }
    } catch (error: any) {
      console.error('Error loading course data:', error);
      setError(`Failed to load course data: ${safeErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  };

  // Validation functions
  const validateStep1 = () => {
    return courseData.title.trim() !== '' && 
           courseData.description.trim() !== '';
  };



  const validateStep2 = () => {
    return courseData.modules.length > 0 && 
           courseData.modules.every(module => 
             module.title.trim() !== '' && 
             module.description.trim() !== '' && 
             module.content.videoUrl.trim() !== ''
           );
  };

  const validateStep3 = () => {
    return !courseData.finalAssessment || 
           (courseData.finalAssessment.title.trim() !== '' && 
            courseData.finalAssessment.description.trim() !== '' &&
            courseData.finalAssessment.questions.length >= 5);
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1: return validateStep1();
      case 2: return validateStep2();
      case 3: return validateStep3();
      default: return true;
    }
  };

  // Module management
  const addModule = () => {
    const newModule: CourseModule = {
      id: `module_${Date.now()}`,
      title: '',
      description: '',
      order: courseData.modules.length,
      content: {
        videoProvider: 'youtube',
        videoUrl: ''
      },
      quiz: {
        id: `quiz_${Date.now()}`,
        title: '',
        description: '',
        questions: [],
        settings: {
          maxAttempts: 3,
          passingScore: 70,
          showCorrectAnswers: true
        }
      },
      estimatedDuration: 15
    };
    
    setCourseData(prev => ({
      ...prev,
      modules: [...prev.modules, newModule]
    }));
  };

  const updateModule = (moduleId: string, updates: Partial<CourseModule>) => {
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

  // Final Assessment management
  const createFinalAssessment = () => {
    const assessment: FinalAssessment = {
      id: `assessment_${Date.now()}`,
      title: language === 'rw' ? 'Ikizamini cya Nyuma' : 'Final Assessment',
      description: '',
      questions: [],
      settings: {
        maxAttempts: 3,
        passingScore: 70,
        showCorrectAnswers: false,
        timeLimit: 0 // Untimed
      }
    };
    
    setCourseData(prev => ({ ...prev, finalAssessment: assessment }));
  };



  // Save and Submit functions
  const saveDraft = async () => {
    setSaving(true);
    setError('');
    
    try {
      // Import validation utilities
      const { validateCourseDraft, createCoursePayload, formatValidationErrors } = await import('../../utils/courseValidation');
      
      // Validate course data
      const validationResult = validateCourseDraft(courseData);
      
      // Show warnings but don't block draft saving
      if (validationResult.warnings.length > 0) {
        console.warn('Course draft warnings:', validationResult.warnings);
      }
      
      // Block saving only on errors
      if (!validationResult.isValid) {
        setError(formatValidationErrors(validationResult));
        return;
      }

      // Create properly structured course payload
      const coursePayload = createCoursePayload(courseData, user, 'draft');

      console.log('Saving course draft:', coursePayload);

      const response = isEditing 
        ? await apiClient.updateCourse(courseId!, coursePayload)
        : await apiClient.createCourse(coursePayload);

      if (response.success) {
        console.log('Course draft saved successfully:', response);
        const savedCourseId = response.data?.course?._id || response.data?.course?.id || response.data?._id || response.data?.id || courseId;
        
        // Navigate to courses list with success message for better reliability
        navigate('/dashboard/courses', {
          state: {
            message: language === 'rw' ? 'Isomo ryakingwa neza!' : 'Course saved successfully!',
            type: 'success'
          }
        });
      } else {
        console.error('Failed to save course draft:', response.error);
        setError(response.error || 'Failed to save course');
      }
    } catch (error: any) {
      console.error('Course draft save error:', error);
      setError(error.message || 'An error occurred while saving');
    } finally {
      setSaving(false);
    }
  };

  const submitForApproval = async () => {
    setSaving(true);
    setError('');
    
    try {
      // Import validation utilities
      const { validateCourseSubmission, createCoursePayload, formatValidationErrors } = await import('../../utils/courseValidation');
      
      // Validate course data for submission with enhanced error handling
      let validationResult;
      try {
        validationResult = validateCourseSubmission(courseData);
      } catch (validationError: any) {
        console.error('Validation function error:', validationError);
        setError(`Validation error: ${safeErrorMessage(validationError)}`);
        return;
      }
      
      if (!validationResult.isValid) {
        const formattedErrors = formatValidationErrors(validationResult);
        setError(formattedErrors || 'Validation failed');
        return;
      }

      // Show warnings to user but allow submission
      if (validationResult.warnings.length > 0) {
        console.warn('Course submission warnings:', validationResult.warnings);
      }

      // Create properly structured course payload as draft first
      let coursePayload;
      try {
        coursePayload = createCoursePayload(courseData, user, 'draft');
      } catch (payloadError: any) {
        console.error('Payload creation error:', payloadError);
        setError(`Payload error: ${safeErrorMessage(payloadError)}`);
        return;
      }

      console.log('Creating course as draft first:', coursePayload);

      // Step 1: Create/Update course as draft
      const response = isEditing 
        ? await apiClient.updateCourse(courseId!, coursePayload)
        : await apiClient.createCourse(coursePayload);

      if (!response.success) {
        console.error('Failed to create/update course:', response.error);
        setError(safeErrorMessage(response.error) || 'Failed to create course');
        return;
      }

      // Debug the response structure
      console.log('Full response structure:', JSON.stringify(response, null, 2));
      
      const newCourseId = response.data?.course?._id || response.data?.course?.id || response.data?._id || response.data?.id || courseId;
      
      console.log('Extracted course ID:', newCourseId);
      
      if (!newCourseId) {
        console.error('No course ID returned from create/update');
        setError('Course was created but submission failed - please try submitting from your courses page');
        return;
      }

      // Accept various ID formats (MongoDB ObjectIds or custom IDs)
      if (typeof newCourseId !== 'string' || newCourseId.length < 5) {
        console.error('Invalid course ID format:', newCourseId);
        setError('Course was created but has an invalid ID - please try submitting from your courses page');
        return;
      }

      console.log('Course created/updated successfully. Now submitting for approval...', newCourseId);

      // Step 2: Submit the draft course for approval (changes status to 'submitted')
      let submitResponse;
      try {
        submitResponse = await apiClient.submitCourse(newCourseId);
      } catch (submitError: any) {
        console.error('Failed to call submit API:', submitError);
        setError(`Failed to submit course: ${safeErrorMessage(submitError)}`);
        return;
      }

      if (submitResponse.success) {
        console.log('Course submitted for approval successfully:', submitResponse);
        
        // Show success message and navigate to courses list
        const successMessage = language === 'rw' 
          ? 'Isomo ryawe ryohererejwe kugira ngo ryemezwe! Rizagaragara mu masomo yawe rikaba "Bitegereje".' 
          : 'Course submitted for admin approval! It will appear in your courses list with "Pending" status.';
        
        // Always navigate to courses list for reliable user experience
        navigate('/dashboard/courses', { 
          state: { 
            message: successMessage,
            type: 'success'
          }
        });
      } else {
        console.error('Failed to submit course for approval:', submitResponse.error);
        setError(safeErrorMessage(submitResponse.error) || 'Course was created but failed to submit for approval. Please try submitting from your courses page.');
      }
    } catch (error: any) {
      console.error('Course submission error:', error);
      // Provide more detailed error information
      if (error.stack) {
        console.error('Error stack:', error.stack);
      }
      setError(`Submission failed: ${safeErrorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner />
          <p className="mt-4 text-gray-600">
            {isEditing 
              ? (language === 'rw' ? 'Turimo gufungura isomo...' : 'Loading course for editing...') 
              : (language === 'rw' ? 'Gukora...' : 'Loading...')
            }
          </p>
        </div>
      </div>
    );
  }

  // Show error if course data failed to load for editing
  if (error && isEditing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-red-800 mb-2">
              {language === 'rw' ? 'Ikosa ry\'aho gufungura isomo' : 'Error Loading Course'}
            </h3>
            <p className="text-red-600 mb-4">{error}</p>
            <div className="space-x-3">
              <Button 
                onClick={() => navigate('/dashboard/courses')}
                variant="outline"
              >
                {language === 'rw' ? 'Garuka' : 'Go Back'}
              </Button>
              <Button 
                onClick={() => {
                  setError('');
                  loadCourseData();
                }}
              >
                {language === 'rw' ? 'Ongera ugerageze' : 'Try Again'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Step 1: Course Details
  const renderStep1 = () => (
    <div className="space-y-8">
      {/* Basic Information Card */}
      <Card className="relative overflow-hidden border-0 shadow-lg bg-white">
        <div className="absolute inset-0 bg-gradient-to-r from-gray-50/50 to-slate-50/50"></div>
        <div className="relative p-8">
          <div className="flex items-center mb-6">
            <div className="p-3 bg-gray-100 rounded-xl">
              <FileText className="h-6 w-6 text-gray-600" />
            </div>
            <div className="ml-4">
              <h2 className="text-2xl font-bold text-gray-900">
                {language === 'rw' ? 'Amakuru y\'Ibanze' : 'Basic Information'}
              </h2>
              <p className="text-gray-600">
                {language === 'rw' ? 'Tanga amakuru y\'ibanze ku isomo ryawe' : 'Provide essential details about your course'}
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Course Title */}
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-3">
                {language === 'rw' ? 'Izina ry\'Isomo' : 'Course Title'} *
              </label>
              <input
                type="text"
                value={courseData.title}
                onChange={(e) => setCourseData(prev => ({ ...prev, title: e.target.value }))}
                placeholder={language === 'rw' ? 'Andika izina ry\'isomo' : 'Enter course title'}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 bg-gray-50 focus:bg-white"
                required
              />
            </div>

            {/* Course Description */}
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-3">
                {language === 'rw' ? 'Ibisobanuro' : 'Course Description'} *
              </label>
              <textarea
                value={courseData.description}
                onChange={(e) => setCourseData(prev => ({ ...prev, description: e.target.value }))}
                placeholder={language === 'rw' ? 'Sobanura isomo ryawe mu buryo bwambitse' : 'Provide a detailed description of your course'}
                rows={6}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 bg-gray-50 focus:bg-white resize-none"
                required
              />
            </div>

            {/* Category and Level */}
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-3">
                  {language === 'rw' ? 'Icyiciro' : 'Category'}
                </label>
                <div className="relative">
                  <select
                    value={courseData.category}
                    onChange={(e) => setCourseData(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 bg-gray-50 focus:bg-white appearance-none"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat.value} value={cat.value}>
                        {language === 'rw' ? cat.labelRw : cat.label}
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none">
                    <GraduationCap className="h-5 w-5 text-gray-400" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-3">
                  {language === 'rw' ? 'Urwego' : 'Level'}
                </label>
                <div className="relative">
                  <select
                    value={courseData.level}
                    onChange={(e) => setCourseData(prev => ({ ...prev, level: e.target.value as any }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 bg-gray-50 focus:bg-white appearance-none"
                  >
                    <option value="beginner">
                      {language === 'rw' ? 'Umutagira ubumenyi' : 'Beginner'}
                    </option>
                    <option value="intermediate">
                      {language === 'rw' ? 'Uzi bike' : 'Intermediate'}
                    </option>
                    <option value="advanced">
                      {language === 'rw' ? 'Umunyamuzi' : 'Advanced'}
                    </option>
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none">
                    <Target className="h-5 w-5 text-gray-400" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Course Thumbnail Card */}
      <Card className="border-0 shadow-lg bg-white">
        <div className="p-8">
          <div className="flex items-center mb-6">
            <div className="p-3 bg-gray-100 rounded-xl">
              <Eye className="h-6 w-6 text-gray-600" />
            </div>
            <div className="ml-4">
              <h3 className="text-xl font-bold text-gray-900">
                {language === 'rw' ? 'Ishusho y\'Isomo' : 'Course Thumbnail'} *
              </h3>
              <p className="text-gray-600">
                {language === 'rw' 
                  ? 'Shyiramo ishusho nziza izakorwa kugaragaza isomo ryawe'
                  : 'Upload an attractive image that represents your course'
                }
              </p>
            </div>
          </div>


          
          <div className="bg-gray-50 rounded-xl p-6">
            <CloudinaryImageUpload
              onImageUploaded={(url) => setCourseData(prev => ({ ...prev, thumbnail: url }))}
              currentImageUrl={courseData.thumbnail}
            />

          </div>


        </div>
      </Card>



    </div>
  );

  // Step 2: Modules
  const renderStep2 = () => (
    <div className="space-y-8">
      {/* Header */}
      <Card className="border-0 shadow-lg bg-white">
        <div className="p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <div className="p-3 bg-gray-100 rounded-xl">
                <Video className="h-6 w-6 text-gray-600" />
              </div>
              <div className="ml-4">
                <h2 className="text-2xl font-bold text-gray-900">
                  {language === 'rw' ? 'Ibice by\'Isomo' : 'Course Modules'}
                </h2>
                <p className="text-gray-600">
                  {language === 'rw' 
                    ? 'Kora ibice by\'isomo ryawe birangwa n\'amashusho n\'ibizamini'
                    : 'Create course modules with videos and quizzes'
                  }
                </p>
              </div>
            </div>
            <Button onClick={addModule} className="bg-gray-600 hover:bg-gray-700">
              <Plus className="h-4 w-4 mr-2" />
              {language === 'rw' ? 'Ongeraho Igice' : 'Add Module'}
            </Button>
          </div>

          {courseData.modules.length === 0 && (
            <div className="text-center py-12">
              <Video className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {language === 'rw' ? 'Ntamugace usobanuye' : 'No modules yet'}
              </h3>
              <p className="text-gray-500 mb-6">
                {language === 'rw' 
                  ? 'Tangira wongere igice cya mbere cy\'isomo ryawe'
                  : 'Start by adding your first course module'
                }
              </p>
              <Button onClick={addModule} className="bg-gray-600 hover:bg-gray-700">
                <Plus className="h-4 w-4 mr-2" />
                {language === 'rw' ? 'Ongeraho Igice' : 'Add Module'}
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Modules List */}
      <div className="space-y-6">
        {courseData.modules.map((module, index) => (
          <Card key={module.id} className="border-0 shadow-lg bg-white">
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <div className="flex items-center justify-center w-10 h-10 bg-gray-100 text-gray-600 rounded-full font-bold">
                    {index + 1}
                  </div>
                  <h3 className="ml-4 text-xl font-bold text-gray-900">
                    {language === 'rw' ? `Igice cya ${index + 1}` : `Module ${index + 1}`}
                  </h3>
                </div>
                <Button
                  onClick={() => removeModule(module.id)}
                  variant="outline"
                  className="text-red-600 border-red-200 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {/* Module Details and Video - 2 Column Layout */}
              <div className="grid lg:grid-cols-2 gap-8 mb-8">
                {/* Module Details */}
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-3">
                      {language === 'rw' ? 'Izina ry\'Igice' : 'Module Title'} *
                    </label>
                    <input
                      type="text"
                      value={module.title}
                      onChange={(e) => updateModule(module.id, { title: e.target.value })}
                      placeholder={language === 'rw' ? 'Andika izina ry\'igice' : 'Enter module title'}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 bg-gray-50 focus:bg-white"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-3">
                      {language === 'rw' ? 'Ibisobanuro' : 'Description'} *
                    </label>
                    <textarea
                      value={module.description}
                      onChange={(e) => updateModule(module.id, { description: e.target.value })}
                      placeholder={language === 'rw' ? 'Sobanura igice' : 'Describe this module'}
                      rows={4}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 bg-gray-50 focus:bg-white resize-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-3">
                      <Clock className="inline h-4 w-4 mr-2" />
                      {language === 'rw' ? 'Igihe Giteganijwe (mu minota)' : 'Estimated Duration (minutes)'}
                    </label>
                    <input
                      type="number"
                      value={module.estimatedDuration}
                      onChange={(e) => updateModule(module.id, { estimatedDuration: Number(e.target.value) })}
                      min="5"
                      max="120"
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 bg-gray-50 focus:bg-white"
                    />
                  </div>
                </div>

                {/* Video Section */}
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-3">
                      <Video className="inline h-4 w-4 mr-2" />
                      {language === 'rw' ? 'Amashusho ya YouTube' : 'YouTube Video'} *
                    </label>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <YouTubeVideoInput
                        onVideoAdded={(videoData) => updateModule(module.id, {
                          content: {
                            videoProvider: 'youtube',
                            videoUrl: videoData.videoUrl,
                            videoId: videoData.videoId
                          }
                        })}
                        currentVideoUrl={module.content.videoUrl}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Quiz Section - Full Width */}
              <div className="mt-8 pt-8 border-t border-gray-200">
                <div className="bg-gradient-to-r from-gray-50 to-slate-50 rounded-2xl p-8">
                  <div className="flex items-center mb-6">
                    <div className="p-3 bg-gray-100 rounded-xl">
                      <ClipboardList className="h-6 w-6 text-gray-600" />
                    </div>
                    <div className="ml-4">
                      <h4 className="text-xl font-bold text-gray-900">
                        {language === 'rw' ? 'Ikizamini cy\'Igice' : 'Module Quiz'}
                      </h4>
                      <p className="text-gray-600">
                        {language === 'rw' 
                          ? 'Kora ikizamini gisuzuma ibyigishijwe muri iki gice'
                          : 'Create a quiz to assess learning from this module'
                        }
                      </p>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-xl p-6 shadow-sm">
                    <JsonQuizCreator
                      courseId={courseId || 'new'}
                      sectionId={module.id}
                      onQuizCreated={(quizData) => updateModule(module.id, { 
                        quiz: {
                          id: quizData.id,
                          title: quizData.title || '',
                          description: quizData.description || '',
                          questions: quizData.questions,
                          settings: {
                            maxAttempts: 3,
                            passingScore: 70,
                            showCorrectAnswers: true
                          }
                        }
                      })}
                      initialQuiz={{
                        id: module.quiz.id,
                        courseId: courseId || 'new',
                        sectionId: module.id,
                        title: module.quiz.title,
                        description: module.quiz.description,
                        instructions: 'Answer all questions to the best of your ability.',
                        questions: module.quiz.questions,
                        settings: {
                          maxAttempts: 3,
                          passingScore: 70,
                          showCorrectAnswers: true,
                          showScoreImmediately: true,
                          randomizeQuestions: false,
                          randomizeOptions: false,
                          allowReview: true,
                          requireSequential: false
                        },
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        version: 1,
                        difficulty: 'beginner',
                        estimatedDuration: 10
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>


    </div>
  );

  // Step 3: Assessment
  const renderStep3 = () => (
    <div className="space-y-8">
      <Card className="border-0 shadow-xl bg-white">
        <div className="p-8">
          <div className="flex items-center mb-6">
            <div className="p-3 bg-gray-100 rounded-xl">
              <ClipboardList className="h-6 w-6 text-gray-600" />
            </div>
            <div className="ml-4">
              <h2 className="text-2xl font-bold text-gray-900">
                {language === 'rw' ? 'Ikizamini cya Nyuma' : 'Final Assessment'}
              </h2>
              <p className="text-gray-600">
                {language === 'rw' 
                  ? 'Kora ikizamini cya nyuma gisuzuma byose byigishijwe mu isomo'
                  : 'Create a comprehensive final assessment covering all course material'
                }
              </p>
            </div>
          </div>
          
          {!courseData.finalAssessment ? (
            <div className="text-center py-12">
              <div className="p-4 bg-gray-100 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                <Award className="h-10 w-10 text-gray-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {language === 'rw' ? 'Nta kizamini cya nyuma' : 'No Final Assessment'}
              </h3>
              <p className="text-gray-500 mb-8 max-w-md mx-auto">
                {language === 'rw' 
                  ? 'Kora ikizamini cya nyuma gisuzuma ubumenyi bwose bw\'abanyeshuri bageze ku kigero'
                  : 'Create a final assessment to test students\' comprehensive understanding'
                }
              </p>
              <Button onClick={createFinalAssessment} className="bg-gray-600 hover:bg-gray-700">
                <Plus className="h-4 w-4 mr-2" />
                {language === 'rw' ? 'Kora Ikizamini cya Nyuma' : 'Create Final Assessment'}
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Assessment Title */}
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-3">
                  {language === 'rw' ? 'Izina ry\'Ikizamini' : 'Assessment Title'} *
                </label>
                <input
                  type="text"
                  value={courseData.finalAssessment.title}
                  onChange={(e) => setCourseData(prev => ({
                    ...prev,
                    finalAssessment: prev.finalAssessment ? {
                      ...prev.finalAssessment,
                      title: e.target.value
                    } : undefined
                  }))}
                  placeholder={language === 'rw' ? 'Ikizamini cya nyuma' : 'Final Assessment'}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 transition-all duration-200 bg-gray-50 focus:bg-white"
                  required
                />
              </div>

              {/* Assessment Description */}
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-3">
                  {language === 'rw' ? 'Ibisobanuro' : 'Description'} *
                </label>
                <textarea
                  value={courseData.finalAssessment.description}
                  onChange={(e) => setCourseData(prev => ({
                    ...prev,
                    finalAssessment: prev.finalAssessment ? {
                      ...prev.finalAssessment,
                      description: e.target.value
                    } : undefined
                  }))}
                  placeholder={language === 'rw' 
                    ? 'Sobanura ikizamini cya nyuma'
                    : 'Describe the final assessment'
                  }
                  rows={4}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 transition-all duration-200 bg-gray-50 focus:bg-white resize-none"
                  required
                />
              </div>

              {/* Quiz Creator */}
              {/* Final Assessment Quiz Section - Full Width */}
              <div className="bg-gradient-to-r from-gray-50 to-slate-50 rounded-2xl p-8">
                <div className="flex items-center mb-6">
                  <div className="p-3 bg-gray-100 rounded-xl">
                    <ClipboardList className="h-6 w-6 text-gray-600" />
                  </div>
                  <div className="ml-4">
                    <h4 className="text-xl font-bold text-gray-900">
                      {language === 'rw' ? 'Ibibazo by\'Ikizamini' : 'Assessment Questions'} *
                    </h4>
                    <p className="text-gray-600">
                      {language === 'rw' 
                        ? 'Kora ikizamini cya nyuma gisuzuma byose byigishijwe mu isomo'
                        : 'Create comprehensive questions to assess overall course learning'
                      }
                    </p>
                  </div>
                </div>
                
                <div className="bg-white rounded-xl p-6 shadow-sm">
                  <JsonQuizCreator
                    courseId={courseId || 'new'}
                    sectionId="final_assessment"
                    onQuizCreated={(quizData) => setCourseData(prev => ({
                      ...prev,
                      finalAssessment: {
                        id: quizData.id,
                        title: quizData.title || '',
                        description: quizData.description || '',
                        questions: quizData.questions,
                        settings: {
                          maxAttempts: 3,
                          passingScore: 70,
                          showCorrectAnswers: false,
                          timeLimit: 0
                        }
                      }
                    }))}
                    initialQuiz={courseData.finalAssessment ? {
                      id: courseData.finalAssessment.id,
                      courseId: courseId || 'new',
                      sectionId: 'final_assessment',
                      title: courseData.finalAssessment.title,
                      description: courseData.finalAssessment.description,
                      instructions: 'Complete this comprehensive assessment to finish the course.',
                      questions: courseData.finalAssessment.questions,
                      settings: {
                        maxAttempts: 3,
                        passingScore: 70,
                        showCorrectAnswers: false,
                        showScoreImmediately: true,
                        randomizeQuestions: false,
                        randomizeOptions: false,
                        allowReview: true,
                        requireSequential: false
                      },
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                      version: 1,
                      difficulty: 'intermediate',
                      estimatedDuration: 30
                    } : undefined}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>


    </div>
  );

  // Step 4: Review & Submit
  const renderStep4 = () => (
    <div className="space-y-8">
      <Card className="border-0 shadow-lg bg-white">
        <div className="p-8">
          <div className="flex items-center mb-8">
            <div className="p-3 bg-gray-100 rounded-xl">
              <Check className="h-6 w-6 text-gray-600" />
            </div>
            <div className="ml-4">
              <h2 className="text-2xl font-bold text-gray-900">
                {language === 'rw' ? 'Gusuzuma no Kohereza' : 'Review & Submit'}
              </h2>
              <p className="text-gray-600">
                {language === 'rw' 
                  ? 'Suzuma isomo ryawe hanyuma ushyikirize'
                  : 'Review your course and submit for approval'
                }
              </p>
            </div>
          </div>

          {/* Course Overview */}
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Course Details */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl p-6">
                <h3 className="text-lg font-bold text-gray-700 mb-4">
                  {language === 'rw' ? 'Amakuru y\'Isomo' : 'Course Information'}
                </h3>
                <div className="space-y-3">
                  <div>
                    <span className="text-sm font-semibold text-gray-600">
                      {language === 'rw' ? 'Izina:' : 'Title:'}
                    </span>
                    <p className="text-gray-700">{courseData.title}</p>
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-gray-600">
                      {language === 'rw' ? 'Ibisobanuro:' : 'Description:'}
                    </span>
                    <p className="text-gray-700">{courseData.description}</p>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm font-semibold text-gray-600">
                        {language === 'rw' ? 'Icyiciro:' : 'Category:'}
                      </span>
                      <p className="text-gray-700">
                        {CATEGORIES.find(c => c.value === courseData.category)?.[language === 'rw' ? 'labelRw' : 'label']}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-gray-600">
                        {language === 'rw' ? 'Urwego:' : 'Level:'}
                      </span>
                      <p className="text-gray-700 capitalize">{courseData.level}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modules Summary */}
              <div className="bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl p-6">
                <h3 className="text-lg font-bold text-gray-700 mb-4">
                  {language === 'rw' ? 'Ibice by\'Isomo' : 'Course Modules'} ({courseData.modules.length})
                </h3>
                <div className="space-y-3">
                  {courseData.modules.map((module, index) => (
                    <div key={module.id} className="flex items-center p-3 bg-white/60 rounded-lg">
                      <div className="flex items-center justify-center w-8 h-8 bg-gray-200 text-gray-700 rounded-full text-sm font-bold mr-3">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-700">{module.title}</p>
                        <p className="text-sm text-gray-600 flex items-center">
                          <Clock className="h-3 w-3 mr-1" />
                          {module.estimatedDuration} {language === 'rw' ? 'minota' : 'mins'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">
                          {module.quiz.questions.length} {language === 'rw' ? 'ibibazo' : 'questions'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Assessment Summary */}
              {courseData.finalAssessment && (
                <div className="bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-gray-700 mb-4">
                    {language === 'rw' ? 'Ikizamini cya Nyuma' : 'Final Assessment'}
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm font-semibold text-gray-600">
                        {language === 'rw' ? 'Izina:' : 'Title:'}
                      </span>
                      <p className="text-gray-700">{courseData.finalAssessment.title}</p>
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-gray-600">
                        {language === 'rw' ? 'Umubare w\'ibibazo:' : 'Number of Questions:'}
                      </span>
                      <p className="text-gray-700">{courseData.finalAssessment.questions.length}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Submission Actions */}
            <div className="space-y-6">
              {/* Course Thumbnail Preview */}
              {courseData.thumbnail && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <h4 className="font-semibold text-gray-900 mb-3">
                    {language === 'rw' ? 'Ishusho y\'Isomo' : 'Course Thumbnail'}
                  </h4>
                  <div className="relative w-full h-32 bg-gray-200 rounded-lg overflow-hidden">
                    <img
                      src={courseData.thumbnail}
                      alt="Course thumbnail preview"
                      className="w-full h-full object-cover"
                      style={{
                        objectFit: 'cover',
                        objectPosition: 'center'
                      }}
                      onError={(e) => {
                        console.warn('Thumbnail failed to load:', courseData.thumbnail);
                        e.currentTarget.style.display = 'none';
                      }}
                      onLoad={() => {
                        console.log('Thumbnail loaded successfully:', courseData.thumbnail);
                      }}
                    />
                    {/* Fallback placeholder */}
                    <div className="absolute inset-0 bg-gray-100 flex items-center justify-center text-gray-500 text-sm">
                      {language === 'rw' ? 'Ishusho y\'isomo' : 'Course thumbnail'}
                    </div>
                  </div>
                </div>
              )}

              {/* Course Stats */}
              <div className="bg-gradient-to-br from-gray-50 to-slate-100 rounded-xl p-6">
                <h4 className="font-semibold text-gray-700 mb-4">
                  {language === 'rw' ? 'Incamake' : 'Course Summary'}
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">
                      {language === 'rw' ? 'Ibice:' : 'Modules:'}
                    </span>
                    <span className="font-bold text-gray-700">{courseData.modules.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">
                      {language === 'rw' ? 'Igihe rusange:' : 'Total Duration:'}
                    </span>
                    <span className="font-bold text-gray-700">
                      {courseData.modules.reduce((total, module) => total + module.estimatedDuration, 0)} {language === 'rw' ? 'min' : 'mins'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">
                      {language === 'rw' ? 'Ibizamini:' : 'Quizzes:'}
                    </span>
                    <span className="font-bold text-gray-700">
                      {courseData.modules.length + (courseData.finalAssessment ? 1 : 0)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Submit Actions */}
              <div className="space-y-4">
                <Button
                  onClick={saveDraft}
                  disabled={saving}
                  variant="outline"
                  className="w-full border-2 border-gray-300 hover:border-gray-400"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? (language === 'rw' ? 'Urabika...' : 'Saving...') : 
                    (language === 'rw' ? 'Bika Nk\'Urutonde' : 'Save as Draft')}
                </Button>

                <Button
                  onClick={submitForApproval}
                  disabled={saving || !validateStep1() || !validateStep2() || !validateStep3()}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {saving ? (language === 'rw' ? 'Urohereza...' : 'Submitting...') : 
                    (language === 'rw' ? 'Ohereza Umuyobozi Gusuzuma' : 'Submit to Admin for Approval')}
                </Button>
              </div>

              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>{language === 'rw' ? 'Icyitonderwa:' : 'Note:'}</strong>
                  {language === 'rw' 
                    ? ' Nyuma yo kohereza, isomo ryawe rizagaragara mu masomo yawe rikaba \'Bitegereje\' kugeza umuyobozi aryemeje.'
                    : ' After submission, your course will appear in your courses page with \'Pending\' status until admin approves it.'
                  }
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50/30 to-slate-100/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-700 to-gray-800 bg-clip-text text-transparent">
                {isEditing 
                  ? (language === 'rw' ? 'Hindura Isomo' : 'Edit Course')
                  : (language === 'rw' ? 'Kora Isomo Rishya' : 'Create New Course')
                }
              </h1>
              <p className="text-lg text-gray-600 mt-2">
                {language === 'rw' 
                  ? 'Kora isomo ryiza rirebana n\'ibyizerezo by\'abanyeshuri'
                  : 'Create an engaging course that meets learners\' expectations'
                }
              </p>
            </div>

          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-8 p-4 bg-red-50 border-2 border-red-200 rounded-xl">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
              <span className="text-red-700 font-medium">{error}</span>
            </div>
          </div>
        )}

        {/* Enhanced Step Progress */}
        <div className="mb-12">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="flex items-center justify-between">
              {STEPS.map((step, index) => {
                const Icon = step.icon;
                const isActive = currentStep === step.id;
                const isCompleted = currentStep > step.id;
                const isClickable = currentStep >= step.id || 
                  (step.id === 2 && validateStep1()) ||
                  (step.id === 3 && validateStep1() && validateStep2()) ||
                  (step.id === 4 && validateStep1() && validateStep2() && validateStep3());

                return (
                  <React.Fragment key={step.id}>
                    <div
                      className={`flex items-center ${isClickable ? 'cursor-pointer' : 'cursor-not-allowed'} group`}
                      onClick={() => isClickable && setCurrentStep(step.id)}
                    >
                      <div className="flex flex-col items-center">
                        <div className={`
                          flex items-center justify-center w-16 h-16 rounded-2xl border-3 transition-all duration-300
                          ${isCompleted 
                            ? 'bg-green-500 border-green-500 text-white shadow-lg scale-105' 
                            : isActive 
                              ? 'bg-gray-600 border-gray-600 text-white shadow-lg scale-105'
                              : isClickable
                                ? 'border-gray-300 text-gray-500 hover:border-blue-500 hover:text-blue-500 hover:scale-105'
                                : 'border-gray-200 text-gray-400'
                          }
                        `}>
                          {isCompleted ? (
                            <Check className="h-7 w-7" />
                          ) : (
                            <Icon className="h-7 w-7" />
                          )}
                        </div>
                        <div className="mt-4 text-center min-w-0">
                          <p className={`text-sm font-bold transition-colors ${
                            isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-600'
                          }`}>
                            {language === 'rw' ? step.titleRw : step.title}
                          </p>
                          <p className="text-xs text-gray-500 mt-1 hidden sm:block">
                            {language === 'rw' ? step.descriptionRw : step.description}
                          </p>
                        </div>
                      </div>
                    </div>
                    {index < STEPS.length - 1 && (
                      <div className={`hidden lg:block flex-1 h-1 mx-8 rounded-full transition-colors ${
                        currentStep > step.id ? 'bg-green-500' : 'bg-gray-200'
                      }`} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>

        {/* Step Content */}
        <div className="mb-12">
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
          {currentStep === 4 && renderStep4()}
        </div>

        {/* Enhanced Navigation */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
              disabled={currentStep === 1}
              className="border-2 border-gray-300 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {language === 'rw' ? 'Ibanza' : 'Previous'}
            </Button>

            <div className="flex items-center space-x-2">
              {STEPS.map((step) => (
                <div
                  key={step.id}
                  className={`w-3 h-3 rounded-full transition-colors ${
                    step.id === currentStep ? 'bg-gray-600' :
                    step.id < currentStep ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>

            {currentStep < 4 ? (
              <Button
                onClick={() => setCurrentStep(Math.min(4, currentStep + 1))}
                disabled={!canProceed()}
                className="bg-gray-600 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {language === 'rw' ? 'Ibikurikira' : 'Next'}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <div className="w-20"></div> // Spacer to maintain layout
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CourseCreation; 