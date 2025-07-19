import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Button } from '../ui/Button';
import Avatar from '../ui/Avatar';
import NetworkStatusIndicator from '../common/NetworkStatusIndicator';
import { 
  Moon, 
  Sun, 
  LogOut, 
  Globe,
  ChevronDown,
  Menu,
  X
} from 'lucide-react';

interface HeaderProps {
  showAuth?: boolean;
  onMobileMenuToggle?: () => void;
  isMobileMenuOpen?: boolean;
}

const Header: React.FC<HeaderProps> = ({ 
  showAuth = true, 
  onMobileMenuToggle,
  isMobileMenuOpen = false 
}) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);

  // Use robust image loader for avatar
  const avatar = user?.avatar ? { src: user.avatar, hasError: false } : null;

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleLanguageChange = (lang: 'en' | 'rw') => {
    setLanguage(lang);
    setShowLangMenu(false);
  };

  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Left side - Logo and Mobile Menu */}
          <div className="flex items-center">
            {/* Mobile menu button - only show when user is logged in */}
            {user && onMobileMenuToggle && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onMobileMenuToggle}
                className="lg:hidden mr-3"
                aria-label="Toggle mobile menu"
              >
                {isMobileMenuOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </Button>
            )}
            
            {/* Logo */}
            <Link 
              to={user ? "/dashboard" : "/"} 
              className="flex items-center space-x-3"
            >
              <div className="flex items-center">
                <span className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                  TekRiders
                </span>
              </div>
            </Link>
          </div>

          {/* Right side - Navigation Items */}
          <div className="flex items-center space-x-2">
            {/* Language selector */}
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowLangMenu(!showLangMenu)}
                aria-label="Select language"
              >
                <Globe className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">{language === 'en' ? 'EN' : 'RW'}</span>
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
              {showLangMenu && (
                <div className="absolute right-0 mt-2 w-32 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 z-50">
                  <button
                    onClick={() => handleLanguageChange('en')}
                    className="flex items-center w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    English
                  </button>
                  <button
                    onClick={() => handleLanguageChange('rw')}
                    className="flex items-center w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    Kinyarwanda
                  </button>
                </div>
              )}
            </div>

            {/* Theme toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              aria-label="Toggle theme"
            >
              {theme === 'light' ? (
                <Moon className="h-4 w-4" />
              ) : (
                <Sun className="h-4 w-4" />
              )}
            </Button>

            {/* Network Status Indicator (always visible when user is logged in) */}
            {user && <NetworkStatusIndicator />}

            {user ? (
              <>
                {/* Profile Menu */}
                <div className="relative ml-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowProfileMenu(!showProfileMenu)}
                    className="flex items-center space-x-2 pr-1"
                    aria-label="Profile menu"
                  >
                                         <Avatar 
                       src={avatar?.src} 
                       name={user.name} 
                       size="sm" 
                       showOnlineStatus={true}
                       isOnline={true}
                     />
                    <ChevronDown className="h-3 w-3 text-gray-500 dark:text-gray-400 hidden sm:block" />
                  </Button>
                  
                  {showProfileMenu && (
                    <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-2 z-50">
                      {/* Profile Info */}
                      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                        <div className="flex items-center space-x-3">
                                                     <Avatar 
                             src={avatar?.src} 
                             name={user.name} 
                             size="md" 
                             showOnlineStatus={true}
                             isOnline={true}
                           />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                            <div className="flex items-center mt-1">
                              <div className="h-2 w-2 bg-green-500 rounded-full mr-2" />
                              <span className="text-xs text-gray-500 dark:text-gray-400">Online</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Logout */}
                      <div className="border-t border-gray-200 dark:border-gray-700 pt-2">
                        <button
                          onClick={handleLogout}
                          className="flex items-center space-x-3 w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                        >
                          <LogOut className="h-4 w-4" />
                          <span>{t('nav.logout')}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              showAuth && (
                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/login')}
                  >
                    {t('nav.login') || 'Login'}
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => navigate('/signup')}
                  >
                    {t('nav.signup') || 'Get Started'}
                  </Button>
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* Mobile dropdown backdrop */}
      {(showProfileMenu || showLangMenu) && (
        <div 
          className="fixed inset-0 z-40 bg-black/20 lg:hidden"
          onClick={() => {
            setShowProfileMenu(false);
            setShowLangMenu(false);
          }}
        />
      )}
    </header>
  );
};

export default Header;