import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Home, 
  BookOpen, 
  Upload, 
  User,
  LogOut,
  X,
  Users,
  Shield,
  Award,
  BarChart3,
  FileText,
  Wifi,
  WifiOff
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Button } from '../ui/Button';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen = false, onClose }) => {
  const { user, logout, isOfflineMode } = useAuth();
  const { t, language } = useLanguage();
  const location = useLocation();
  const [isOffline, setIsOffline] = React.useState(false);

  // Detect offline mode
  React.useEffect(() => {
    const checkOfflineMode = () => {
      const offline = isOfflineMode || !navigator.onLine;
      setIsOffline(offline);
    };

    checkOfflineMode();
    window.addEventListener('online', checkOfflineMode);
    window.addEventListener('offline', checkOfflineMode);

    return () => {
      window.removeEventListener('online', checkOfflineMode);
      window.removeEventListener('offline', checkOfflineMode);
    };
  }, [isOfflineMode]);

  // Navigation based on user role
  const getNavigation = () => {
    if (user?.role === 'admin') {
      return [
        { 
          name: t('nav.dashboard'), 
          href: '/dashboard', 
          icon: Home
        },
        { 
          name: t('admin.users.title'), 
          href: '/dashboard/users', 
          icon: Users
        },
        { 
          name: t('nav.coursesModeration'), 
          href: '/dashboard/courses', 
          icon: BookOpen
        },
        { 
          name: t('nav.analytics'), 
          href: '/dashboard/analytics', 
          icon: BarChart3
        },
        { 
          name: t('nav.profile'), 
          href: '/dashboard/profile', 
          icon: User
        }
      ];
    }
    
    if (user?.role === 'tutor') {
      return [
        { 
          name: t('nav.dashboard'), 
          href: '/dashboard', 
          icon: Home
        },
        { 
          name: t('nav.createCourse'), 
          href: '/dashboard/courses/new', 
          icon: Upload
        },
        { 
          name: t('nav.analytics'), 
          href: '/dashboard/analytics', 
          icon: BarChart3
        },
        { 
          name: t('nav.profile'), 
          href: '/dashboard/profile', 
          icon: User
        }
      ];
    }

    // Learner navigation
    return [
      { 
        name: t('nav.dashboard'), 
        href: '/dashboard', 
        icon: Home
      },
      { 
        name: t('nav.myCourses'), 
        href: '/dashboard/courses', 
        icon: BookOpen
      },
      { 
        name: t('nav.certificates'), 
        href: '/certificates', 
        icon: Award
      },
      { 
        name: t('nav.profile'), 
        href: '/dashboard/profile', 
        icon: User
      }
    ];
  };

  const navigation = getNavigation();

  const isActive = (href: string) => location.pathname === href;

  const handleLinkClick = () => {
    if (onClose) {
      onClose();
    }
  };

  const getRoleConfig = () => {
    switch (user?.role) {
      case 'admin':
        return {
          icon: Shield,
          label: t('admin.users.admin'),
          bgColor: 'bg-red-50 dark:bg-red-900/10',
          textColor: 'text-red-700 dark:text-red-300'
        };
      case 'tutor':
        return {
          icon: BookOpen,
          label: t('admin.users.tutor'),
          bgColor: 'bg-blue-50 dark:bg-blue-900/10',
          textColor: 'text-blue-700 dark:text-blue-300'
        };
      default:
        return {
          icon: User,
          label: t('auth.learner'),
          bgColor: 'bg-green-50 dark:bg-green-900/10',
          textColor: 'text-green-700 dark:text-green-300'
        };
    }
  };

  const roleConfig = getRoleConfig();

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed top-16 left-0 z-50 w-64 h-[calc(100vh-4rem)] 
        bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700
        transform transition-transform duration-200 ease-out
        lg:translate-x-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex flex-col h-full">
          {/* Mobile header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 lg:hidden">
            <span className="text-lg font-semibold text-gray-900 dark:text-white">Menu</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* User Role Badge */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className={`
              inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium
              ${roleConfig.bgColor} ${roleConfig.textColor}
            `}>
              <div className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 mr-3">
                <roleConfig.icon className="h-4 w-4" />
              </div>
              <span>{roleConfig.label}</span>
            </div>
            
            {/* Offline Status Indicator */}
            {isOffline && (
              <div className="mt-2 flex items-center space-x-2 text-xs text-yellow-600 dark:text-yellow-400">
                <WifiOff className="w-3 h-3" />
                <span>Offline Mode</span>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex-1 overflow-y-auto pt-4 pb-4">
            <nav className="px-3 space-y-1">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={handleLinkClick}
                  className={`
                    group flex items-center px-3 py-2 text-sm font-medium rounded-lg 
                    transition-colors duration-150
                    ${isActive(item.href)
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                      : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
                    }
                    ${isOffline && item.href !== '/dashboard/profile' ? 'opacity-60' : ''}
                  `}
                  title={isOffline && item.href !== '/dashboard/profile' ? 'Limited functionality in offline mode' : ''}
                >
                  <item.icon className="w-5 h-5 mr-3" />
                  <span className="flex-1">{item.name}</span>
                  {isOffline && item.href !== '/dashboard/profile' && (
                    <WifiOff className="w-3 h-3 text-yellow-500" />
                  )}
                </Link>
              ))}
            </nav>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              onClick={logout}
              variant="ghost"
              className="w-full justify-start text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <LogOut className="w-5 h-5 mr-3" />
              {t('nav.logout')}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;