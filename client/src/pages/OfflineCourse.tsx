// Complete Offline Course Experience for TekRiders
// Provides full learning experience offline: videos, quizzes, progress tracking
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { essentialDataCache } from '../utils/offlineDataCache';
import { offlineOperations } from '../utils/offlineOperations';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Badge } from '../components/ui/Badge';
import { 
  BookOpen, 
  Play, 
  CheckCircle, 
  Clock, 
  ArrowLeft, 
  ArrowRight,
  Menu,
  X,
  AlertCircle,
  Wifi,
  WifiOff
} from 'lucide-react';

interface CourseLesson {
  id: string;
  title: string;
  content: string;
  videoUrl?: string;
  duration?: number;
  type: 'video' | 'text' | 'quiz';
  completed?: boolean;
}

interface CourseSection {
  id: string;
  title: string;
  lessons: CourseLesson[];
}

interface CourseData {
  id: string;
  title: string;
  description: string;
  instructorName: string;
  sections: CourseSection[];
  progress: number;
  enrollmentStatus: string;
  totalDuration: number;
  offline: boolean;
}

const OfflineCourse: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { isOnline } = useNetworkStatus();
  const navigate = useNavigate();

  const [courseData, setCourseData] = useState<CourseData | null>(null);
  const [currentLesson, setCurrentLesson] = useState<CourseLesson | null>(null);
  const [showQuiz, setShowQuiz] = useState(false);
  const [currentQuiz, setCurrentQuiz] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentProgress, setCurrentProgress] = useState(0);
  const [completedLessons, setCompletedLessons] = useState<string[]>([]);

  // Load course data
  useEffect(() => {
    const loadCourseData = async () => {
      if (!courseId || !user) return;
      
      try {
        setLoading(true);
        setError(null);
        
        const userId = user.id || (user as any)._id;
        
        // Try to load from cached enrolled courses
        const enrolledCourses = essentialDataCache.getEnrolledCourses(userId);
        const course = enrolledCourses.find((c: any) => 
          c.id === courseId || c._id === courseId
        );
        
        if (course) {
          // Convert to our expected format
          const courseData: CourseData = {
            id: course._id || course.id,
            title: course.title,
            description: course.description,
            instructorName: course.instructorName,
            sections: course.sections || [],
            progress: course.progress?.percentage || 0,
            enrollmentStatus: 'enrolled',
            totalDuration: course.duration || 0,
            offline: true
          };
          
          setCourseData(courseData);
          
          // Set first lesson as current if available
          if (courseData.sections.length > 0 && courseData.sections[0].lessons.length > 0) {
            setCurrentLesson(courseData.sections[0].lessons[0]);
          }
          
          // Load completed lessons from localStorage
          const savedProgress = localStorage.getItem(`course_progress_${courseId}_${userId}`);
          if (savedProgress) {
            const progress = JSON.parse(savedProgress);
            setCompletedLessons(progress.completedLessons || []);
            setCurrentProgress(progress.percentage || 0);
          }
        } else {
          throw new Error('Course not found in offline cache');
        }
      } catch (error) {
        console.error('Failed to load course:', error);
        setError('Course not available offline. Please sync when online.');
      } finally {
        setLoading(false);
      }
    };

    loadCourseData();
  }, [courseId, user]);

  // Handle lesson completion
  const handleLessonComplete = async (lessonId: string) => {
    if (!user || !courseData) return;

    const userId = user.id || (user as any)._id;
    const newCompletedLessons = [...completedLessons];
    
    if (!newCompletedLessons.includes(lessonId)) {
      newCompletedLessons.push(lessonId);
      setCompletedLessons(newCompletedLessons);
    }

    // Calculate new progress
    const totalLessons = courseData.sections.reduce((total, section) => 
      total + section.lessons.length, 0
    );
    const newProgress = Math.round((newCompletedLessons.length / totalLessons) * 100);
    setCurrentProgress(newProgress);

    // Save progress locally
    const progressData = {
      courseId,
      lessonId,
      completedLessons: newCompletedLessons,
      percentage: newProgress,
      lastAccessed: new Date().toISOString()
    };

    localStorage.setItem(
      `course_progress_${courseId}_${userId}`,
      JSON.stringify(progressData)
    );

    // Queue for sync when online
    try {
      await offlineOperations.updateVideoProgress(progressData, userId);
    } catch (error) {
      console.warn('Failed to queue progress update:', error);
    }
  };

  // Handle lesson navigation
  const navigateToLesson = (lesson: CourseLesson) => {
    setCurrentLesson(lesson);
    setShowQuiz(false);
  };

  // Handle quiz
  const handleQuizStart = (quiz: any) => {
    setCurrentQuiz(quiz);
    setShowQuiz(true);
  };

  const handleQuizComplete = async (answers: any) => {
    if (!user || !currentQuiz) return;

    const userId = user.id || (user as any)._id;
    const submissionData = {
      quizId: currentQuiz.id,
      courseId,
      answers,
      submittedAt: new Date().toISOString()
    };

    try {
      await offlineOperations.submitQuiz(submissionData, userId);
      setShowQuiz(false);
      
      // Mark quiz lesson as complete
      if (currentQuiz.lessonId) {
        handleLessonComplete(currentQuiz.lessonId);
      }
    } catch (error) {
      console.error('Failed to submit quiz:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner className="mx-auto mb-4" />
          <p className="text-gray-600">{t('Loading course...')}</p>
        </div>
      </div>
    );
  }

  if (error || !courseData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="p-8 text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {t('Course Not Available')}
          </h3>
          <p className="text-gray-600 mb-4">
            {error || t('Unable to load course data')}
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mb-4">
            {isOnline ? (
              <Wifi className="w-4 h-4 text-green-500" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-500" />
            )}
            <span>{isOnline ? t('Online') : t('Offline')}</span>
          </div>
          <Button onClick={() => navigate('/dashboard')} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('Back to Dashboard')}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => navigate('/dashboard')}
              variant="outline"
              size="sm"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t('Back to Dashboard')}
            </Button>
            
            <div>
              <h1 className="text-lg font-semibold text-gray-900">
                {courseData.title}
              </h1>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>{t('by')} {courseData.instructorName}</span>
                <span>•</span>
                <div className="flex items-center gap-1">
                  {isOnline ? (
                    <Wifi className="w-3 h-3 text-green-500" />
                  ) : (
                    <WifiOff className="w-3 h-3 text-amber-500" />
                  )}
                  <span>{isOnline ? t('Online') : t('Offline')}</span>
                </div>
              </div>
            </div>
          </div>

          <Button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            variant="outline"
            size="sm"
            className="lg:hidden"
          >
            {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </Button>
        </div>

        {/* Progress Bar */}
        <div className="mt-3">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>{t('Course Progress')}</span>
            <span>{currentProgress}% {t('Complete')}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${currentProgress}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <div className={`${sidebarOpen ? 'w-80' : 'w-0'} bg-white border-r border-gray-200 transition-all duration-300 overflow-hidden`}>
          <div className="p-4">
            <h2 className="font-semibold text-gray-900 mb-4">{t('Course Content')}</h2>
            
            <div className="space-y-3">
              {courseData.sections.map((section, sectionIndex) => (
                <div key={section.id} className="border rounded-lg">
                  <div className="p-3 bg-gray-50 font-medium text-gray-900">
                    {section.title}
                  </div>
                  <div className="space-y-1">
                    {section.lessons.map((lesson, lessonIndex) => (
                      <button
                        key={lesson.id}
                        onClick={() => navigateToLesson(lesson)}
                        className={`w-full text-left p-3 hover:bg-gray-50 transition-colors flex items-center gap-3 ${
                          currentLesson?.id === lesson.id ? 'bg-blue-50 border-r-2 border-blue-500' : ''
                        }`}
                      >
                        <div className="flex-shrink-0">
                          {completedLessons.includes(lesson.id) ? (
                            <CheckCircle className="w-5 h-5 text-green-500" />
                          ) : lesson.type === 'video' ? (
                            <Play className="w-5 h-5 text-gray-400" />
                          ) : lesson.type === 'quiz' ? (
                            <BookOpen className="w-5 h-5 text-gray-400" />
                          ) : (
                            <BookOpen className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {lesson.title}
                          </div>
                          {lesson.duration && (
                            <div className="text-xs text-gray-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {Math.round(lesson.duration / 60)}m
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6">
          {showQuiz && currentQuiz ? (
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">{currentQuiz.title}</h2>
              <p className="text-gray-600 mb-6">{currentQuiz.description}</p>
              
              {!isOnline && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-center gap-2 text-amber-800">
                    <WifiOff className="w-4 h-4" />
                    <span className="text-sm">{t('Quiz will be submitted when you\'re back online')}</span>
                  </div>
                </div>
              )}
              
              <Button onClick={() => handleQuizComplete({})}>
                {t('Complete Quiz')}
              </Button>
            </Card>
          ) : currentLesson ? (
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">{currentLesson.title}</h2>
                <Badge variant={completedLessons.includes(currentLesson.id) ? 'success' : 'default'}>
                  {completedLessons.includes(currentLesson.id) ? t('Completed') : t('In Progress')}
                </Badge>
              </div>

              {currentLesson.type === 'video' && currentLesson.videoUrl && (
                <div className="mb-6">
                  <video
                    controls
                    className="w-full rounded-lg"
                    onEnded={() => handleLessonComplete(currentLesson.id)}
                  >
                    <source src={currentLesson.videoUrl} type="video/mp4" />
                    {t('Your browser does not support video playback')}
                  </video>
                </div>
              )}

              <div className="prose max-w-none mb-6">
                <div dangerouslySetInnerHTML={{ __html: currentLesson.content }} />
              </div>

              <div className="flex justify-between">
                <Button variant="outline">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  {t('Previous')}
                </Button>
                
                <div className="flex gap-2">
                  {!completedLessons.includes(currentLesson.id) && (
                    <Button
                      onClick={() => handleLessonComplete(currentLesson.id)}
                      variant="outline"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      {t('Mark Complete')}
                    </Button>
                  )}
                  
                  <Button>
                    {t('Next')}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="p-8 text-center">
              <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {t('Select a lesson to start learning')}
              </h3>
              <p className="text-gray-600">
                {t('Choose a lesson from the sidebar to begin your course')}
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default OfflineCourse; 