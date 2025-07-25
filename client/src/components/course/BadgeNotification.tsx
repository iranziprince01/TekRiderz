import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { X, Trophy } from 'lucide-react';

interface Badge {
  id: string;
  type: string;
  name: string;
  description: string;
  icon: string;
  points: number;
  unlockedAt?: string;
}

interface BadgeNotificationProps {
  badge: Badge;
  onClose: () => void;
  isVisible: boolean;
}

export const BadgeNotification: React.FC<BadgeNotificationProps> = ({ 
  badge, 
  onClose, 
  isVisible 
}) => {
  const { t } = useLanguage();
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setIsAnimating(true);
      // Auto-hide after 5 seconds
      const timer = setTimeout(() => {
        onClose();
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  return (
    <div className={`
      fixed top-4 right-4 z-50 max-w-sm w-full
      transform transition-all duration-500 ease-out
      ${isAnimating ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
    `}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-start space-x-3">
          {/* Badge Icon */}
          <div className="flex-shrink-0">
            <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
              <span className="text-2xl">{badge.icon}</span>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-1">
              <Trophy className="w-4 h-4 text-yellow-500" />
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                {t('gamification.badges')} Unlocked!
              </h4>
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
              {badge.name}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
              {badge.description}
            </p>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                +{badge.points} {t('gamification.points')}
              </span>
            </div>
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="mt-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
          <div className="bg-gradient-to-r from-yellow-400 to-orange-500 h-1 rounded-full animate-pulse" />
        </div>
      </div>
    </div>
  );
}; 