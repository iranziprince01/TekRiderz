import React from 'react';
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
import { CoursePermissions } from '../../utils/coursePermissions';
import { Button } from '../ui/Button';

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
  permissions
}) => {
  const { language } = useLanguage();
  const location = useLocation();
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
    window.history.back();
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
        bg-card/95 backdrop-blur-xl border-r border-border/50 
        shadow-xl transform transition-all duration-300 ease-out
        lg:translate-x-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex flex-col h-full">
          {/* Course Header */}
          <div className="p-4 border-b border-border/50">
            <div className="flex items-center gap-3">
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
                      <IconComponent className="w-4 h-4 mr-3 flex-shrink-0" />
                      <span className="flex-1 font-medium">{item.name}</span>
                      {isActive(item.href) && (
                        <div className="absolute right-2 w-1 h-6 bg-primary-500 rounded-full" />
                      )}
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
        </div>
      </div>
    </>
  );
};

export default CourseSidebar; 