import { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import Header from './Header';
import MinimizedSidebar from './MinimizedSidebar';
import { 
  BookOpen, 
  PlayCircle, 
  FileText, 
  BarChart3,
  ArrowLeft,
  Award,
  Clock,
  Users,
  Star,
  ChevronLeft
} from 'lucide-react';
import { Button } from '../ui/Button';

interface CourseCanvasLayoutProps {
  children: React.ReactNode;
  courseTitle?: string;
  courseProgress?: number;
  courseData?: {
    instructor: string;
    duration: string;
    students: number;
    rating: number;
  };
}

const CourseCanvasLayout: React.FC<CourseCanvasLayoutProps> = ({ 
  children, 
  courseTitle = "Course Title",
  courseProgress = 0,
  courseData
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCourseSidebarOpen, setIsCourseSidebarOpen] = useState(false);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const toggleCourseSidebar = () => {
    setIsCourseSidebarOpen(!isCourseSidebarOpen);
  };

  // Course navigation items with Kinyarwanda support
  const courseNavigation = [
    { 
      name: 'Home', 
      nameRw: 'Ahabanza',
      href: `/course/${id}`, 
      icon: BookOpen,
      gradient: 'from-blue-500 to-purple-500',
      description: 'Course overview and details'
    },
    { 
      name: 'Modules', 
      nameRw: 'Ibice',
      href: `/course/${id}/modules`, 
      icon: PlayCircle,
      gradient: 'from-green-500 to-emerald-500',
      description: 'Course lessons and content'
    },
    { 
      name: 'Quizzes', 
      nameRw: 'Ibizamini',
      href: `/course/${id}/quizzes`, 
      icon: FileText,
      gradient: 'from-orange-500 to-red-500',
      description: 'Tests and assessments'
    },
    { 
      name: 'Grades', 
      nameRw: 'Amanota',
      href: `/course/${id}/grades`, 
      icon: BarChart3,
      gradient: 'from-purple-500 to-pink-500',
      description: 'Your scores and progress'
    }
  ];

  const isActive = (href: string) => {
    return location.pathname === href || 
           (location.pathname === `/course/${id}` && href === `/course/${id}`);
  };

  const handleBackToDashboard = () => {
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header 
        onMobileMenuToggle={toggleMobileMenu}
        isMobileMenuOpen={isMobileMenuOpen}
      />
      
      {/* Minimized Dashboard Sidebar - Icons only */}
      <MinimizedSidebar 
        isOpen={isMobileMenuOpen}
        onClose={closeMobileMenu}
      />

      {/* Mobile overlay for course sidebar */}
      {isCourseSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsCourseSidebarOpen(false)}
        />
      )}

      {/* Course Sidebar - Full navigation */}
      <div className={`
        fixed top-16 left-16 z-40 w-72 h-[calc(100vh-4rem)] 
        bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700
        shadow-xl transform transition-all duration-300 ease-out
        lg:translate-x-0
        ${isCourseSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex flex-col h-full">
          {/* Course Header */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
            <div className="flex items-center gap-3 mb-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackToDashboard}
                className="text-white hover:bg-white/10 flex-shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold truncate">
                  {courseTitle}
                </h2>
                <p className="text-blue-100 text-sm">
                  TekRiders - Ubumenyi bw'Abanyarwanda
                </p>
              </div>
            </div>
            
            {/* Course Quick Info */}
            {courseData && (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <span>{courseData.students} students</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>{courseData.duration}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-yellow-400" />
                  <span>{courseData.rating}/5</span>
                </div>
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4" />
                  <span>Certificate</span>
                </div>
              </div>
            )}
            
            {/* Progress Bar */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm mb-2">
                <span>Inyongera (Progress)</span>
                <span>{courseProgress}%</span>
              </div>
              <div className="w-full bg-white/20 rounded-full h-2">
                <div 
                  className="bg-yellow-400 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${courseProgress}%` }}
                />
              </div>
            </div>
          </div>

          {/* Course Navigation */}
          <div className="flex-1 overflow-y-auto pt-6">
            <nav className="px-4 space-y-2">
              <div className="px-3 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Ibice by'Isomo (Course Sections)
              </div>
              {courseNavigation.map((item) => (
                <button
                  key={item.name}
                  onClick={() => navigate(item.href)}
                  className={`
                    group flex items-center w-full px-4 py-3 text-sm font-medium rounded-xl 
                    transition-all duration-300 ease-out relative overflow-hidden
                    ${isActive(item.href)
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 shadow-lg border border-blue-200 dark:border-blue-800'
                      : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }
                    hover:scale-[1.02] hover:shadow-md
                    transform-gpu text-left
                  `}
                >
                  {/* Icon container with gradient background */}
                  <div className={`
                    flex items-center justify-center w-10 h-10 rounded-lg mr-4
                    ${isActive(item.href) 
                      ? `bg-gradient-to-r ${item.gradient} shadow-lg`
                      : 'bg-gray-100 dark:bg-gray-700 group-hover:bg-gray-200 dark:group-hover:bg-gray-600'
                    }
                    transition-all duration-300
                  `}>
                    <item.icon
                      className={`
                        h-5 w-5 transition-all duration-300
                        ${isActive(item.href) 
                          ? 'text-white' 
                          : 'text-gray-600 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300'
                        }
                      `}
                    />
                  </div>
                  
                  {/* Label and description */}
                  <div className="flex-1">
                    <div className="font-semibold flex items-center gap-2">
                      <span>{item.name}</span>
                      <span className="text-xs text-gray-500">({item.nameRw})</span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{item.description}</div>
                  </div>
                  
                  {/* Active indicator */}
                  {isActive(item.href) && (
                    <div className="absolute right-2 w-1 h-8 bg-blue-500 rounded-full" />
                  )}
                </button>
              ))}
            </nav>
          </div>

          {/* Rwanda Pride Section */}
          <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 p-4 bg-green-50 dark:bg-green-900/10">
            <div className="text-center space-y-2">
              <div className="text-sm font-semibold text-green-700 dark:text-green-400">
                🇷🇼 Ubumenyi bw'Ubwiyunge
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                Learning platform for Rwandan youth
              </div>
              <div className="text-xs text-green-600 dark:text-green-400 font-medium">
                Dufite ubwoba bwe, dufite ubuntu!
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile menu button for course sidebar */}
      <button
        onClick={toggleCourseSidebar}
        className="lg:hidden fixed top-20 left-4 z-50 p-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700"
      >
        <ChevronLeft className={`h-5 w-5 transition-transform duration-200 ${isCourseSidebarOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Main content area - offset for both sidebars */}
      <div className="lg:ml-80 ml-0">
        <main className="pt-16 min-h-screen">
          <div className="h-[calc(100vh-4rem)] overflow-y-auto">
            <div className="px-4 sm:px-6 lg:px-8 py-6">
              <div className="max-w-6xl mx-auto">
                {children}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default CourseCanvasLayout; 