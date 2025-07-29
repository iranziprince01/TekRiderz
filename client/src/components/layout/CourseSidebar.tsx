import React from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
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
import { CoursePermissions } from '../../utils/coursePermissions';
import { Button } from '../ui/Button';


interface CourseSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  courseTitle?: string;
  courseProgress?: number;
  permissions?: CoursePermissions;
  isOffline?: boolean;
}

const CourseSidebar: React.FC<CourseSidebarProps> = ({ 
  isOpen = false, 
  onClose,
  courseTitle = "Course Title",
  permissions,
  isOffline = false
}) => {
  const { language } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

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
    if (permissions?.canTakeQuizzes || permissions?.canManageContent || permissions?.canView) {
      nav.push({
        name: language === 'rw' ? 'Ibizamini n\'Amanota' : 'Assessments & Grades',
        href: `/course/${id}/assessments`,
        icon: Award,
      });
    }



    return nav;
  };

  const navigation = getNavigation();

  const isActive = (href: string) => {
    return location.pathname === href;
  };

  const handleBackToDashboard = () => {
    navigate('/dashboard');
  };

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
        bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl border-r border-gray-200/50 dark:border-gray-700/50 
        shadow-xl transform transition-all duration-300 ease-out
        lg:translate-x-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex flex-col h-full">
          {/* Course Header */}
          <div className="p-4 border-b border-gray-200/50 dark:border-gray-700/50">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackToDashboard}
                className="hover:bg-gray-100/50 dark:hover:bg-gray-700/50 flex-shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                  {courseTitle}
                </h2>
                {isOffline && (
                  <div className="mt-1">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      📱 {language === 'rw' ? 'Offline' : 'Offline'}
                    </span>
                  </div>
                )}
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
                          ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 shadow-lg shadow-blue-500/20'
                          : 'text-gray-700/80 dark:text-gray-300/80 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100/50 dark:hover:bg-gray-700/50'
                        }
                        hover:scale-[1.02] hover:shadow-md
                        transform-gpu text-left no-underline
                      `}
                    >
                      <IconComponent className="w-4 h-4 mr-3 flex-shrink-0" />
                      <span className="flex-1 font-medium">{item.name}</span>
                      {isActive(item.href) && (
                        <div className="absolute right-2 w-1 h-6 bg-blue-500 rounded-full" />
                      )}
                      <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-blue-500/10 to-purple-500/10" />
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
        </div>
      </div>
    </>
  );
};

export default CourseSidebar; 