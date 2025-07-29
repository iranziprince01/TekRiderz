import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Home, 
  BookOpen, 
  Upload, 
  User,
  Users,
  Shield,
  Award,
  BarChart3,
  WifiOff
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';

interface MinimizedSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const MinimizedSidebar: React.FC<MinimizedSidebarProps> = ({ isOpen = false, onClose }) => {
  const { user, isOfflineMode } = useAuth();
  const { language } = useLanguage();
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
          name: language === 'rw' ? 'Ikibaho' : 'Dashboard', 
          href: '/dashboard', 
          icon: Home,
          gradient: 'from-blue-500 to-purple-500'
        },
        { 
          name: language === 'rw' ? 'Abakoresha' : 'Users', 
          href: '/dashboard/users', 
          icon: Users,
          gradient: 'from-green-500 to-emerald-500'
        },
        { 
          name: language === 'rw' ? 'Gukurikirana Amasomo' : 'Courses Moderation', 
          href: '/dashboard/courses', 
          icon: BookOpen,
          gradient: 'from-orange-500 to-red-500'
        },
        { 
          name: language === 'rw' ? 'Ibipimo' : 'Analytics', 
          href: '/dashboard/analytics', 
          icon: BarChart3,
          gradient: 'from-purple-500 to-indigo-500'
        },
        { 
          name: language === 'rw' ? 'Umwirondoro' : 'Profile', 
          href: '/dashboard/profile', 
          icon: User,
          gradient: 'from-pink-500 to-rose-500'
        }
      ];
    }
    
    if (user?.role === 'tutor') {
      return [
        { 
          name: language === 'rw' ? 'Ikibaho' : 'Dashboard', 
          href: '/dashboard', 
          icon: Home,
          gradient: 'from-blue-500 to-purple-500'
        },
        { 
          name: language === 'rw' ? 'Kora Isomo' : 'Create Course', 
          href: '/dashboard/courses/new', 
          icon: Upload,
          gradient: 'from-green-500 to-emerald-500'
        },
        { 
          name: language === 'rw' ? 'Ibipimo' : 'Analytics', 
          href: '/dashboard/analytics', 
          icon: BarChart3,
          gradient: 'from-purple-500 to-indigo-500'
        },
        { 
          name: language === 'rw' ? 'Umwirondoro' : 'Profile', 
          href: '/dashboard/profile', 
          icon: User,
          gradient: 'from-pink-500 to-rose-500'
        }
      ];
    }

    // Learner navigation
    return [
      { 
        name: language === 'rw' ? 'Ikibaho' : 'Dashboard', 
        href: '/dashboard', 
        icon: Home,
        gradient: 'from-blue-500 to-purple-500'
      },
      { 
        name: language === 'rw' ? 'Amasomo Yanjye' : 'My Courses', 
        href: '/dashboard/courses', 
        icon: BookOpen,
        gradient: 'from-orange-500 to-red-500'
      },
      { 
        name: language === 'rw' ? 'Icyemezo' : 'Certificates', 
        href: '/certificates', 
        icon: Award,
        gradient: 'from-yellow-500 to-orange-500'
      },
      { 
        name: language === 'rw' ? 'Umwirondoro' : 'Profile', 
        href: '/dashboard/profile', 
        icon: User,
        gradient: 'from-pink-500 to-rose-500'
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
          gradient: 'from-red-500 to-orange-500'
        };
      case 'tutor':
        return {
          icon: BookOpen,
          gradient: 'from-blue-500 to-indigo-500'
        };
      default:
        return {
          icon: User,
          gradient: 'from-green-500 to-emerald-500'
        };
    }
  };

  const roleConfig = getRoleConfig();

  return (
    <>
      {/* Minimized Sidebar - Fixed position with icon-only layout */}
      <div className="fixed top-16 left-0 z-50 w-16 h-[calc(100vh-4rem)] bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl border-r border-gray-200/50 dark:border-gray-700/50 shadow-lg">
        <div className="flex flex-col h-full">
          {/* User Role Icon */}
          <div className="p-2 border-b border-gray-200/50 dark:border-gray-700/50">
            <div className={`
              w-10 h-10 rounded-xl bg-gradient-to-r ${roleConfig.gradient} 
              flex items-center justify-center shadow-lg
            `}>
              <roleConfig.icon className="h-5 w-5 text-white" />
            </div>
            
            {/* Offline Status Indicator */}
            {isOffline && (
              <div className="mt-1 flex justify-center">
                <div className="w-2 h-2 bg-yellow-500 rounded-full" title="Offline Mode"></div>
              </div>
            )}
          </div>

          {/* Navigation Icons */}
          <div className="flex-1 overflow-y-auto py-4">
            <nav className="px-2 space-y-3">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={handleLinkClick}
                  title={`${item.name}${isOffline && item.href !== '/dashboard/profile' ? ' (Limited offline)' : ''}`}
                  className={`
                    group flex items-center justify-center w-10 h-10 rounded-xl 
                    transition-all duration-300 ease-out relative
                    ${isActive(item.href)
                      ? 'bg-blue-500/10 shadow-lg shadow-blue-500/20'
                      : 'hover:bg-gray-100/50 dark:hover:bg-gray-700/50'
                    }
                    hover:scale-110 transform-gpu
                    ${isOffline && item.href !== '/dashboard/profile' ? 'opacity-60' : ''}
                  `}
                >
                  {/* Icon container with gradient background */}
                  <div className={`
                    flex items-center justify-center w-8 h-8 rounded-lg
                    ${isActive(item.href) 
                      ? `bg-gradient-to-r ${item.gradient} shadow-md`
                      : 'bg-gray-100/30 dark:bg-gray-700/30 group-hover:bg-gray-200/50 dark:group-hover:bg-gray-600/50'
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
                  
                  {/* Offline indicator */}
                  {isOffline && item.href !== '/dashboard/profile' && (
                    <div className="absolute -top-1 -right-1">
                      <WifiOff className="w-3 h-3 text-yellow-500" />
                    </div>
                  )}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </div>
    </>
  );
};

export default MinimizedSidebar; 