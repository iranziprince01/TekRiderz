import React, { useState, useEffect } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { 
  ArrowLeft,
  BookOpen,
  PlayCircle,
  Award,
  BarChart3,
  TrendingUp,
  Settings
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { CoursePermissions } from '../../utils/coursePermissions';
import { Button } from '../ui/Button';
import { getCourseProgress, getCourse } from '../../utils/api';

interface CourseSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  courseTitle?: string;
  courseProgress?: number;
  permissions?: CoursePermissions;
}

const CourseSidebar: React.FC<CourseSidebarProps> = ({ 
  isOpen = false, 
  onClose,
  courseTitle = "Course Title",
  courseProgress = 0,
  permissions
}) => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();

  // Real-time data state
  const [realTimeStats, setRealTimeStats] = useState({
    progress: courseProgress,
    moduleCount: 0,
    userGrade: 0,
    loading: true
  });

  // Fetch real-time course data and user progress
  useEffect(() => {
    const fetchRealTimeData = async () => {
      if (!id || !user) return;

      try {
        setRealTimeStats(prev => ({ ...prev, loading: true }));

        // Fetch course data and user progress in parallel
        const [courseResponse, progressResponse] = await Promise.all([
          getCourse(id),
          getCourseProgress(id).catch(() => ({ success: false })) // Don't fail if progress doesn't exist
        ]);

        let moduleCount = 0;
        let calculatedProgress = 0;
        let userGrade = 0;

        // Get module count from course data
        if (courseResponse.success && courseResponse.data?.course) {
          const course = courseResponse.data.course;
          moduleCount = course.sections?.length || 0;
        }

        // Calculate progress and grades from user progress data
        if (progressResponse.success && progressResponse.data?.progress) {
          const progress = progressResponse.data.progress;
          
          // Calculate overall progress percentage
          if (progress.completedLessons && progress.totalLessons > 0) {
            calculatedProgress = Math.round((progress.completedLessons.length / progress.totalLessons) * 100);
          }

          // Calculate average grade from quiz scores
          if (progress.quizScores && Object.keys(progress.quizScores).length > 0) {
            const quizScores = Object.values(progress.quizScores) as any[];
            const validScores = quizScores.filter(score => score?.bestPercentage !== undefined);
            
            if (validScores.length > 0) {
              const totalPercentage = validScores.reduce((sum, score) => sum + (score.bestPercentage || 0), 0);
              userGrade = Math.round(totalPercentage / validScores.length);
            }
          }
        }

        setRealTimeStats({
          progress: calculatedProgress,
          moduleCount,
          userGrade,
          loading: false
        });

      } catch (error) {
        console.error('Error fetching real-time course data:', error);
        setRealTimeStats(prev => ({ ...prev, loading: false }));
      }
    };

    fetchRealTimeData();
  }, [id, user]);

  // Generate navigation items based on permissions
  const getNavigation = () => {
    const nav = [];
    
    // Home/Overview - always available if user can view
    if (permissions?.canView) {
      nav.push({
        name: language === 'rw' ? 'Ahabanza' : 'Home',
        href: `/course/${id}`,
        icon: BookOpen,
      });
    }

    // Modules - available for content viewing or management
    if (permissions?.canWatchVideos || permissions?.canManageContent) {
      nav.push({
        name: language === 'rw' ? 'Ibice' : 'Modules',
        href: `/course/${id}/modules`,
        icon: PlayCircle,
      });
    }

    // Assessments - available for taking quizzes or content management  
    // Always show for enrolled users, course owners, and admins
    if (permissions?.canTakeQuizzes || permissions?.canManageContent || permissions?.canView) {
      nav.push({
        name: language === 'rw' ? 'Ipimwa' : 'Assessments',
        href: `/course/${id}/assessments`,
        icon: Award,
      });
    }

    // Grades - available for learners to view their grades or instructors/admins for analytics
    if (permissions?.canViewGrades || permissions?.canViewAnalytics) {
      nav.push({
        name: language === 'rw' ? 'Amanota' : 'Grades',
        href: `/course/${id}/grades`,
        icon: BarChart3,
      });
    }

    // Analytics - only for instructors and admins
    if (permissions?.canViewAnalytics) {
      nav.push({
        name: language === 'rw' ? 'Isesengura' : 'Analytics',
        href: `/course/${id}/analytics`,
        icon: TrendingUp,
      });
    }

    // Management - only for course owners and admins who can edit
    if (permissions?.canEdit || permissions?.canManageContent) {
      nav.push({
        name: language === 'rw' ? 'Icunga' : 'Management',
        href: `/course/${id}/management`,
        icon: Settings,
      });
    }

    return nav;
  };

  const navigation = getNavigation();

  const isActive = (href: string) => {
    return location.pathname === href;
  };



  const handleBackToDashboard = () => {
    window.history.back();
  };

  // Refresh stats when course content is updated
  const refreshStats = async () => {
    if (!id || !user) return;

    try {
      const progressResponse = await getCourseProgress(id);
      
      if (progressResponse.success && progressResponse.data?.progress) {
        const progress = progressResponse.data.progress;
        
        let calculatedProgress = 0;
        let userGrade = 0;

        // Calculate overall progress percentage
        if (progress.completedLessons && progress.totalLessons > 0) {
          calculatedProgress = Math.round((progress.completedLessons.length / progress.totalLessons) * 100);
        }

        // Calculate average grade from quiz scores
        if (progress.quizScores && Object.keys(progress.quizScores).length > 0) {
          const quizScores = Object.values(progress.quizScores) as any[];
          const validScores = quizScores.filter(score => score?.bestPercentage !== undefined);
          
          if (validScores.length > 0) {
            const totalPercentage = validScores.reduce((sum, score) => sum + (score.bestPercentage || 0), 0);
            userGrade = Math.round(totalPercentage / validScores.length);
          }
        }

        setRealTimeStats(prev => ({
          ...prev,
          progress: calculatedProgress,
          userGrade
        }));
      }
    } catch (error) {
      console.error('Error refreshing course stats:', error);
    }
  };

  // Listen for course progress updates to refresh stats
  useEffect(() => {
    const handleProgressUpdate = () => {
      refreshStats();
    };

    // Listen for custom events that indicate progress updates
    window.addEventListener('courseProgressUpdated', handleProgressUpdate);
    window.addEventListener('quizCompleted', handleProgressUpdate);
    window.addEventListener('lessonCompleted', handleProgressUpdate);

    return () => {
      window.removeEventListener('courseProgressUpdated', handleProgressUpdate);
      window.removeEventListener('quizCompleted', handleProgressUpdate);
      window.removeEventListener('lessonCompleted', handleProgressUpdate);
    };
  }, [id, user]);

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Course Sidebar - Fixed position with full height */}
      <div className={`
        fixed top-16 left-16 z-40 w-64 h-[calc(100vh-4rem)] 
        bg-card/95 backdrop-blur-xl border-r border-border/50 
        shadow-xl transform transition-all duration-300 ease-out
        lg:translate-x-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex flex-col h-full">
          {/* Course Header */}
          <div className="p-4 border-b border-border/50">
            <div className="flex items-center gap-3 mb-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackToDashboard}
                className="hover:bg-accent/50 flex-shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-semibold text-foreground truncate">
                  {courseTitle}
                </h2>
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-foreground/60">
                <span>Progress</span>
                <span>
                  {realTimeStats.loading ? (
                    <div className="w-8 h-3 bg-gray-200 dark:bg-gray-700 animate-pulse rounded"></div>
                  ) : (
                    `${realTimeStats.progress}%`
                  )}
                </span>
              </div>
              <div className="w-full bg-accent/30 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${realTimeStats.loading ? 0 : realTimeStats.progress}%` }}
                />
              </div>
            </div>
          </div>

          {/* Course Navigation */}
          <div className="flex-1 overflow-y-auto pt-4 pb-4">
            {navigation.length > 0 ? (
              <nav className="px-3 space-y-2">
                {navigation.map((item) => {
                  const IconComponent = item.icon;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      onClick={() => onClose && onClose()}
                      className={`
                        group flex items-center w-full px-4 py-3 text-sm font-medium rounded-xl 
                        transition-all duration-300 ease-out relative overflow-hidden
                        ${isActive(item.href)
                          ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400 shadow-lg shadow-primary-500/20'
                          : 'text-foreground/80 hover:text-foreground hover:bg-accent/50'
                        }
                        hover:scale-[1.02] hover:shadow-md
                        transform-gpu text-left no-underline
                      `}
                    >
                      {/* Icon */}
                      <IconComponent className="w-4 h-4 mr-3 flex-shrink-0" />
                      
                      {/* Label */}
                      <span className="flex-1 font-medium">{item.name}</span>
                      
                      {/* Active indicator */}
                      {isActive(item.href) && (
                        <div className="absolute right-2 w-1 h-6 bg-primary-500 rounded-full" />
                      )}
                      
                      {/* Hover glow effect */}
                      <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-primary-500/10 to-secondary-500/10" />
                    </Link>
                  );
                })}
              </nav>
            ) : (
              <div className="px-6 py-8 text-center">
                <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-3">
                  <BookOpen className="w-6 h-6 text-gray-400" />
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {language === 'rw' ? 'Nta bigeze biboneka' : 'No sections available'}
                </p>
              </div>
            )}
          </div>

          {/* Course Stats - Fixed at bottom */}
          <div className="flex-shrink-0 border-t border-border/50 p-4">
            <div className="space-y-3">
              <div className="text-xs font-medium text-foreground/60 uppercase tracking-wide">
                Quick Stats
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center">
                  <div className="text-lg font-bold text-primary-600 dark:text-primary-400">
                    {realTimeStats.loading ? (
                      <div className="w-6 h-6 bg-gray-200 dark:bg-gray-700 animate-pulse rounded mx-auto"></div>
                    ) : (
                      realTimeStats.moduleCount
                    )}
                  </div>
                  <div className="text-xs text-foreground/60">Modules</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-green-600 dark:text-green-400">
                    {realTimeStats.loading ? (
                      <div className="w-8 h-6 bg-gray-200 dark:bg-gray-700 animate-pulse rounded mx-auto"></div>
                    ) : (
                      `${realTimeStats.userGrade}%`
                    )}
                  </div>
                  <div className="text-xs text-foreground/60">Grade</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Subtle background pattern */}
        <div className="absolute inset-0 pointer-events-none opacity-5">
          <div className="absolute inset-0 bg-gradient-to-br from-primary-500/10 via-transparent to-secondary-500/10" />
        </div>
      </div>
    </>
  );
};

export default CourseSidebar; 