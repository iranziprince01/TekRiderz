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
  Award
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Button } from '../ui/Button';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen = false, onClose }) => {
  const { user, logout } = useAuth();
  const { t, language } = useLanguage();
  const location = useLocation();

  // Navigation based on user role
  const getNavigation = () => {
    if (user?.role === 'admin') {
      return [
        { 
          name: language === 'rw' ? 'Ikibaho' : 'Dashboard', 
          href: '/dashboard', 
          icon: Home
        },
        { 
          name: language === 'rw' ? 'Abakoresha' : 'Users', 
          href: '/dashboard/users', 
          icon: Users
        },
        { 
          name: language === 'rw' ? 'Amasomo' : 'Courses', 
          href: '/dashboard/courses', 
          icon: BookOpen
        },
        { 
          name: language === 'rw' ? 'Umwirondoro' : 'Profile', 
          href: '/dashboard/profile', 
          icon: User
        }
      ];
    }
    
    if (user?.role === 'tutor') {
      return [
        { 
          name: language === 'rw' ? 'Ikibaho' : 'Dashboard', 
          href: '/dashboard', 
          icon: Home
        },
        { 
          name: language === 'rw' ? 'Kora Isomo' : 'Create Course', 
          href: '/dashboard/courses/new', 
          icon: Upload
        },
        { 
          name: language === 'rw' ? 'Umwirondoro' : 'Profile', 
          href: '/dashboard/profile', 
          icon: User
        }
      ];
    }

    // Learner navigation
    return [
      { 
        name: language === 'rw' ? 'Ikibaho' : 'Dashboard', 
        href: '/dashboard', 
        icon: Home
      },
      { 
        name: language === 'rw' ? 'Amasomo Yanjye' : 'My Courses', 
        href: '/dashboard/courses', 
        icon: BookOpen
      },
      { 
        name: language === 'rw' ? 'Umwirondoro' : 'Profile', 
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
          label: language === 'rw' ? 'Umuyobozi' : 'Administrator',
          bgColor: 'bg-red-50 dark:bg-red-900/10',
          textColor: 'text-red-700 dark:text-red-300'
        };
      case 'tutor':
        return {
          icon: BookOpen,
          label: language === 'rw' ? 'Umwarimu' : 'Tutor',
          bgColor: 'bg-blue-50 dark:bg-blue-900/10',
          textColor: 'text-blue-700 dark:text-blue-300'
        };
      default:
        return {
          icon: User,
          label: language === 'rw' ? 'Umunyeshuri' : 'Learner',
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
              <X className="h-5 w-5" />
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
                  `}
                >
                  <div className={`
                    flex items-center justify-center w-6 h-6 mr-3
                    ${isActive(item.href) 
                      ? 'text-blue-600 dark:text-blue-400' 
                      : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300'
                    }
                  `}>
                    <item.icon className="h-4 w-4" />
                  </div>
                  <span className="flex-1">{item.name}</span>
                </Link>
              ))}
            </nav>
          </div>

          {/* Logout button */}
          <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 p-4">
            <Button
              variant="ghost"
              onClick={() => {
                logout();
                handleLinkClick();
              }}
              className="w-full justify-start text-gray-700 dark:text-gray-300 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/10"
            >
              <div className="flex items-center justify-center w-6 h-6 mr-3">
                <LogOut className="h-4 w-4" />
              </div>
              <span>{t('nav.logout')}</span>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;