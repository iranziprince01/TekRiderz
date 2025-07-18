import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Home, 
  BookOpen, 
  Upload, 
  User,
  LogOut,
  Users,
  BarChart3,
  Shield,
  Activity,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';

interface MinimizedSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const MinimizedSidebar: React.FC<MinimizedSidebarProps> = ({ isOpen = false, onClose }) => {
  const { user, logout } = useAuth();
  const { language } = useLanguage();
  const location = useLocation();

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
          name: language === 'rw' ? 'Amasomo' : 'Courses', 
          href: '/dashboard/courses', 
          icon: BookOpen,
          gradient: 'from-orange-500 to-red-500'
        },
        { 
          name: language === 'rw' ? 'Umwirondoro' : 'Profile', 
          href: '/dashboard/profile', 
          icon: User,
          gradient: 'from-purple-500 to-pink-500'
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
          name: language === 'rw' ? 'Umwirondoro' : 'Profile', 
          href: '/dashboard/profile', 
          icon: User,
          gradient: 'from-purple-500 to-pink-500'
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
        name: language === 'rw' ? 'Umwirondoro' : 'Profile', 
        href: '/dashboard/profile', 
        icon: User,
        gradient: 'from-purple-500 to-pink-500'
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
      <div className="fixed top-16 left-0 z-50 w-16 h-[calc(100vh-4rem)] bg-card/95 backdrop-blur-xl border-r border-border/50 shadow-lg">
        <div className="flex flex-col h-full">
          {/* User Role Icon */}
          <div className="p-2 border-b border-border/50">
            <div className={`
              w-10 h-10 rounded-xl bg-gradient-to-r ${roleConfig.gradient} 
              flex items-center justify-center shadow-lg
            `}>
              <roleConfig.icon className="h-5 w-5 text-white" />
            </div>
          </div>

          {/* Navigation Icons */}
          <div className="flex-1 overflow-y-auto py-4">
            <nav className="px-2 space-y-3">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={handleLinkClick}
                  title={item.name}
                  className={`
                    group flex items-center justify-center w-10 h-10 rounded-xl 
                    transition-all duration-300 ease-out relative
                    ${isActive(item.href)
                      ? 'bg-primary-500/10 shadow-lg shadow-primary-500/20'
                      : 'hover:bg-accent/50'
                    }
                    hover:scale-110 transform-gpu
                  `}
                >
                  {/* Icon container with gradient background */}
                  <div className={`
                    flex items-center justify-center w-8 h-8 rounded-lg
                    ${isActive(item.href) 
                      ? `bg-gradient-to-r ${item.gradient} shadow-md`
                      : 'bg-accent/30 group-hover:bg-accent/50'
                    }
                    transition-all duration-300
                  `}>
                    <item.icon
                      className={`
                        h-4 w-4 transition-all duration-300
                        ${isActive(item.href) 
                          ? 'text-white' 
                          : 'text-foreground/60 group-hover:text-foreground'
                        }
                      `}
                    />
                  </div>
                  
                  {/* Active indicator */}
                  {isActive(item.href) && (
                    <div className="absolute right-0 w-1 h-6 bg-primary-500 rounded-l-full" />
                  )}
                </Link>
              ))}
            </nav>
          </div>

          {/* Logout button - Icon only */}
          <div className="flex-shrink-0 border-t border-border/50 p-2">
            <button
              onClick={() => {
                logout();
                handleLinkClick();
              }}
              title="Logout"
              className="group flex items-center justify-center w-10 h-10 rounded-xl hover:bg-destructive/10 transition-all duration-300 hover:scale-110"
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-destructive/20 group-hover:bg-destructive/30 transition-all duration-300">
                <LogOut className="h-4 w-4 text-destructive" />
              </div>
            </button>
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

export default MinimizedSidebar; 