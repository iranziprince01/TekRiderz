import React, { useState, useEffect, useRef } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { ProgressBar } from '../common/ProgressBar';
import { AdvancedVideoPlayer } from '../video/AdvancedVideoPlayer';
import { AutoGradedQuiz } from '../quiz/AutoGradedQuiz';
import { AdaptiveLearningEngine } from '../learning/AdaptiveLearningEngine';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useOffline } from '../../hooks/useOffline';
import { apiClient } from '../../utils/api';
import {
  Play,
  Pause,
  BookOpen,
  Award,
  Clock,
  CheckCircle,
  Lock,
  Download,
  Wifi,
  WifiOff,
  Eye,
  Star,
  MessageSquare,
  Share2,
  Bookmark,
  RotateCcw,
  SkipForward,
  Volume2,
  Settings,
  Menu,
  X,
  ChevronRight,
  ChevronLeft,
  Target,
  Brain,
  Lightbulb,
  Trophy,
  Users,
  TrendingUp,
  FileText,
  AlertCircle,
  RefreshCw
} from 'lucide-react';

interface CourseModule {
  id: string;
  title: string;
  description: string;
  type: 'video' | 'reading' | 'quiz' | 'assignment' | 'discussion';
  duration: number; // in minutes
  isCompleted: boolean;
  isLocked: boolean;
  order: number;
  content: {
    videoUrl?: string;
    text?: string;
    quiz?: any;
    resources?: CourseResource[];
  };
  learningObjectives: string[];
  prerequisites: string[];
}

interface CourseResource {
  id: string;
  title: string;
  type: 'pdf' | 'doc' | 'link' | 'code' | 'image';
  url: string;
  size?: number;
  isDownloadable: boolean;
}

interface LearningNote {
  id: string;
  moduleId: string;
  timestamp: number; // for video notes
  content: string;
  type: 'note' | 'highlight' | 'question';
  createdAt: Date;
}

interface DiscussionThread {
  id: string;
  moduleId: string;
  title: string;
  content: string;
  author: string;
  createdAt: Date;
  replies: number;
  likes: number;
  isResolved: boolean;
}

interface ComprehensiveCourseExperienceProps {
  courseId: string;
  onProgress?: (progress: number) => void;
  onComplete?: () => void;
  className?: string;
}

export const ComprehensiveCourseExperience: React.FC<ComprehensiveCourseExperienceProps> = ({
  courseId,
  onProgress,
  onComplete,
  className = ''
}) => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { isOnline, cacheCourse, getCachedCourse } = useOffline();

  const [course, setCourse] = useState<any>(null);
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [currentModuleIndex, setCurrentModuleIndex] = useState(0);
  const [activeView, setActiveView] = useState<'content' | 'resources' | 'discussion' | 'notes'>('content');
  const [showSidebar, setShowSidebar] = useState(true);
  const [notes, setNotes] = useState<LearningNote[]>([]);
  const [discussions, setDiscussions] = useState<DiscussionThread[]>([]);
  const [bookmarkedItems, setBookmarkedItems] = useState<Set<string>>(new Set());
  const [completedModules, setCompletedModules] = useState<Set<string>>(new Set());
  const [currentProgress, setCurrentProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdaptiveLearning, setShowAdaptiveLearning] = useState(false);
  const [videoProgress, setVideoProgress] = useState<Record<string, number>>({});
  const [quizResults, setQuizResults] = useState<Record<string, any>>({});
  const [studySession, setStudySession] = useState<any>(null);

  const currentModule = modules[currentModuleIndex];

  // Load course data
  useEffect(() => {
    loadCourseData();
  }, [courseId]);

  // Auto-save progress
  useEffect(() => {
    const interval = setInterval(() => {
      if (currentModule && studySession) {
        saveProgress();
      }
    }, 30000); // Save every 30 seconds

    return () => clearInterval(interval);
  }, [currentModule, studySession]);

  const loadCourseData = async () => {
    try {
      setLoading(true);
      setError('');

      let courseData;
      if (isOnline) {
        const response = await apiClient.getCourse(courseId);
        if (response.success) {
          courseData = response.data;
          // Cache for offline use
          await cacheCourse(courseData);
        }
      } else {
        // Load from cache
        courseData = await getCachedCourse(courseId);
      }

      if (courseData) {
        setCourse(courseData);
        setModules(courseData.modules || []);
        
        // Load user progress
        const progressResponse = await apiClient.getCourseProgress(courseId);
        if (progressResponse.success) {
          const progress = progressResponse.data;
          setCompletedModules(new Set(progress.completedModules));
          setCurrentProgress(progress.overallProgress);
          setVideoProgress(progress.videoProgress || {});
          setQuizResults(progress.quizResults || {});
        }

        // Load notes and discussions
        loadNotes();
        loadDiscussions();
      } else {
        setError('Course not available offline');
      }
    } catch (err: any) {
      setError('Failed to load course data');
      console.error('Course loading error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadNotes = async () => {
    try {
      const response = await apiClient.getCourseNotes(courseId);
      if (response.success) {
        setNotes(response.data || []);
      }
    } catch (error) {
      console.error('Failed to load notes:', error);
    }
  };

  const loadDiscussions = async () => {
    try {
      const response = await apiClient.getCourseDiscussions(courseId);
      if (response.success) {
        setDiscussions(response.data || []);
      }
    } catch (error) {
      console.error('Failed to load discussions:', error);
    }
  };

  const saveProgress = async () => {
    try {
      const progressData = {
        courseId,
        currentModuleIndex,
        completedModules: Array.from(completedModules),
        overallProgress: currentProgress,
        videoProgress,
        quizResults,
        lastAccessed: new Date().toISOString()
      };

      if (isOnline) {
        await apiClient.saveCourseProgress(progressData);
      } else {
        // Store offline for later sync
        localStorage.setItem(`course_progress_${courseId}`, JSON.stringify(progressData));
      }
    } catch (error) {
      console.error('Failed to save progress:', error);
    }
  };

  const markModuleComplete = async (moduleId: string) => {
    const newCompleted = new Set(completedModules);
    newCompleted.add(moduleId);
    setCompletedModules(newCompleted);

    // Calculate new progress
    const newProgress = (newCompleted.size / modules.length) * 100;
    setCurrentProgress(newProgress);
    onProgress?.(newProgress);

    // Check if course is complete
    if (newCompleted.size === modules.length) {
      onComplete?.();
    }

    await saveProgress();
  };

  const handleVideoProgress = (moduleId: string, progress: number, currentTime: number) => {
    setVideoProgress(prev => ({
      ...prev,
      [moduleId]: currentTime
    }));

    // Mark as complete if watched 90% or more
    if (progress >= 90 && !completedModules.has(moduleId)) {
      markModuleComplete(moduleId);
    }
  };

  const handleQuizComplete = (moduleId: string, result: any) => {
    setQuizResults(prev => ({
      ...prev,
      [moduleId]: result
    }));

    // Mark as complete if passed
    if (result.passed && !completedModules.has(moduleId)) {
      markModuleComplete(moduleId);
    }
  };

  const navigateToModule = (index: number) => {
    if (index >= 0 && index < modules.length) {
      setCurrentModuleIndex(index);
      saveProgress();
    }
  };

  const addNote = async (content: string, timestamp?: number) => {
    const newNote: LearningNote = {
      id: `note-${Date.now()}`,
      moduleId: currentModule.id,
      timestamp: timestamp || 0,
      content,
      type: 'note',
      createdAt: new Date()
    };

    setNotes(prev => [...prev, newNote]);

    try {
      if (isOnline) {
        await apiClient.addCourseNote(newNote);
      } else {
        // Store offline
        const offlineNotes = JSON.parse(localStorage.getItem(`course_notes_${courseId}`) || '[]');
        offlineNotes.push(newNote);
        localStorage.setItem(`course_notes_${courseId}`, JSON.stringify(offlineNotes));
      }
    } catch (error) {
      console.error('Failed to save note:', error);
    }
  };

  const toggleBookmark = (moduleId: string) => {
    const newBookmarks = new Set(bookmarkedItems);
    if (newBookmarks.has(moduleId)) {
      newBookmarks.delete(moduleId);
    } else {
      newBookmarks.add(moduleId);
    }
    setBookmarkedItems(newBookmarks);
  };

  const downloadResource = async (resource: CourseResource) => {
    try {
      const response = await fetch(resource.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = resource.title;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to download resource:', error);
    }
  };

  const renderModuleContent = () => {
    if (!currentModule) return null;

    switch (currentModule.type) {
      case 'video':
        return (
          <div className="space-y-4">
            <AdvancedVideoPlayer
              src={currentModule.content.videoUrl || ''}
              title={currentModule.title}
              onProgress={(progress, time) => handleVideoProgress(currentModule.id, progress, time)}
              startTime={videoProgress[currentModule.id] || 0}
              enableAnalytics={true}
              enablePictureInPicture={true}
              enableKeyboardShortcuts={true}
            />
            
            {currentModule.learningObjectives.length > 0 && (
              <Card className="p-4">
                <h3 className="font-semibold mb-2 flex items-center">
                  <Target className="w-5 h-5 mr-2 text-green-600" />
                  Learning Objectives
                </h3>
                <ul className="space-y-1">
                  {currentModule.learningObjectives.map((objective, index) => (
                    <li key={index} className="flex items-start">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
                      <span className="text-sm">{objective}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        );

      case 'reading':
        return (
          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-4">{currentModule.title}</h2>
            <div 
              className="prose max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: currentModule.content.text || '' }}
            />
          </Card>
        );

      case 'quiz':
        return (
          <AutoGradedQuiz
            config={currentModule.content.quiz}
            onComplete={(result) => handleQuizComplete(currentModule.id, result)}
          />
        );

      default:
        return (
          <Card className="p-6 text-center">
            <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Content Coming Soon</h3>
            <p className="text-gray-600">This module type is not yet supported.</p>
          </Card>
        );
    }
  };

  const renderSidebar = () => (
    <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 h-full overflow-y-auto">
      {/* Course Progress */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold">Course Progress</h3>
          <span className="text-sm text-gray-600">{Math.round(currentProgress)}%</span>
        </div>
        <ProgressBar progress={currentProgress} className="mb-2" />
        <p className="text-xs text-gray-500">
          {completedModules.size} of {modules.length} modules completed
        </p>
      </div>

      {/* Module List */}
      <div className="p-4">
        <h4 className="font-medium mb-3">Modules</h4>
        <div className="space-y-2">
          {modules.map((module, index) => (
            <div
              key={module.id}
              className={`p-3 rounded-lg cursor-pointer transition-colors ${
                index === currentModuleIndex
                  ? 'bg-blue-100 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700'
              } ${module.isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={() => !module.isLocked && navigateToModule(index)}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  {module.isLocked ? (
                    <Lock className="w-4 h-4 text-gray-400" />
                  ) : completedModules.has(module.id) ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <div className="w-4 h-4 border-2 border-gray-300 rounded-full" />
                  )}
                  
                  {module.type === 'video' && <Play className="w-4 h-4 text-gray-500" />}
                  {module.type === 'reading' && <BookOpen className="w-4 h-4 text-gray-500" />}
                  {module.type === 'quiz' && <Award className="w-4 h-4 text-gray-500" />}
                </div>
                
                <div className="flex items-center space-x-1">
                  {bookmarkedItems.has(module.id) && (
                    <Bookmark className="w-4 h-4 text-yellow-500 fill-current" />
                  )}
                  <span className="text-xs text-gray-500">{module.duration}min</span>
                </div>
              </div>
              
              <h5 className="font-medium text-sm mb-1">{module.title}</h5>
              <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                {module.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderResourcesPanel = () => (
    <div className="p-4">
      <h3 className="font-semibold mb-4">Module Resources</h3>
      {currentModule.content.resources?.length ? (
        <div className="space-y-3">
          {currentModule.content.resources.map((resource) => (
            <div key={resource.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded">
                  <FileText className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-sm">{resource.title}</p>
                  <p className="text-xs text-gray-500">
                    {resource.type.toUpperCase()} {resource.size && `• ${(resource.size / 1024).toFixed(1)}KB`}
                  </p>
                </div>
              </div>
              
              {resource.isDownloadable && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => downloadResource(resource)}
                >
                  <Download className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-500 text-center py-8">No resources available for this module.</p>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p>Loading course content...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-8 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">Unable to Load Course</h3>
        <p className="text-gray-600 mb-4">{error}</p>
        <Button onClick={loadCourseData}>
          <RotateCcw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </Card>
    );
  }

  return (
    <div className={`flex h-screen bg-gray-50 dark:bg-gray-900 ${className}`}>
      {/* Sidebar */}
      {showSidebar && renderSidebar()}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSidebar(!showSidebar)}
              >
                <Menu className="w-4 h-4" />
              </Button>
              
              <div>
                <h1 className="text-xl font-semibold">{course?.title}</h1>
                {currentModule && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Module {currentModuleIndex + 1}: {currentModule.title}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {!isOnline && (
                <Badge variant="warning" className="flex items-center">
                  <WifiOff className="w-3 h-3 mr-1" />
                  Offline
                </Badge>
              )}
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAdaptiveLearning(!showAdaptiveLearning)}
              >
                <Brain className="w-4 h-4" />
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleBookmark(currentModule?.id || '')}
              >
                <Bookmark className={`w-4 h-4 ${
                  bookmarkedItems.has(currentModule?.id || '') 
                    ? 'text-yellow-500 fill-current' 
                    : ''
                }`} />
              </Button>
              
              <Button variant="ghost" size="sm">
                <Share2 className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex space-x-4 mt-4">
            {['content', 'resources', 'discussion', 'notes'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveView(tab as any)}
                className={`px-3 py-1 text-sm font-medium rounded-lg transition-colors ${
                  activeView === tab
                    ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto">
          {showAdaptiveLearning && (
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <AdaptiveLearningEngine
                courseId={courseId}
                moduleId={currentModule?.id}
                onRecommendation={(rec) => console.log('Recommendation:', rec)}
              />
            </div>
          )}

          <div className="p-6">
            {activeView === 'content' && renderModuleContent()}
            {activeView === 'resources' && renderResourcesPanel()}
            {activeView === 'discussion' && (
              <div className="text-center py-8 text-gray-500">
                Discussion feature coming soon...
              </div>
            )}
            {activeView === 'notes' && (
              <div className="text-center py-8 text-gray-500">
                Notes feature coming soon...
              </div>
            )}
          </div>
        </div>

        {/* Navigation Footer */}
        <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => navigateToModule(currentModuleIndex - 1)}
              disabled={currentModuleIndex === 0}
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Previous
            </Button>

            <div className="text-sm text-gray-600 dark:text-gray-400">
              {currentModuleIndex + 1} of {modules.length}
            </div>

            <Button
              onClick={() => navigateToModule(currentModuleIndex + 1)}
              disabled={currentModuleIndex >= modules.length - 1}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}; 