import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { getGamificationData } from '../../utils/api';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { 
  Trophy, 
  Star, 
  Award, 
  Target, 
  Zap, 
  Flame,
  TrendingUp
} from 'lucide-react';

interface Badge {
  id: string;
  type: string;
  name: string;
  description: string;
  icon: string;
  points: number;
  unlockedAt?: string;
}

interface GamificationData {
  totalPoints: number;
  level: number;
  levelProgress: number;
  badges: Badge[];
  achievements: {
    modulesCompleted: number;
    quizzesPassed: number;
    perfectScores: number;
    consecutiveDays: number;
    totalTimeSpent: number;
  };
  streakDays: number;
  longestStreak: number;
}

interface GamificationDisplayProps {
  courseId: string;
  className?: string;
}

export const GamificationDisplay: React.FC<GamificationDisplayProps> = ({ 
  courseId, 
  className = '' 
}) => {
  const { language, t } = useLanguage();
  const { theme } = useTheme();
  const [gamificationData, setGamificationData] = useState<GamificationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchGamificationData = async () => {
      try {
        setLoading(true);
        const response = await getGamificationData(courseId);
        
        if (response.success && response.data) {
          setGamificationData(response.data);
        } else {
          setError(response.error || 'Failed to load gamification data');
        }
      } catch (err) {
        console.error('Error fetching gamification data:', err);
        setError('Failed to load gamification data');
      } finally {
        setLoading(false);
      }
    };

    fetchGamificationData();
  }, [courseId]);

  if (loading) {
    return (
      <Card className={`p-4 ${className}`}>
        <div className="flex items-center justify-center">
          <LoadingSpinner size="sm" />
          <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
            {t('gamification.loading')}
          </span>
        </div>
      </Card>
    );
  }

  if (error || !gamificationData) {
    return null; // Don't show anything if there's an error
  }

  const { totalPoints, level, levelProgress, badges, achievements, streakDays } = gamificationData;

  return (
    <Card className={`p-4 ${className}`}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('gamification.achievements')}
          </h3>
          <div className="flex items-center space-x-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {totalPoints} {t('gamification.points')}
            </span>
          </div>
        </div>

        {/* Level Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">
              {t('gamification.level')} {level}
            </span>
            <span className="text-gray-600 dark:text-gray-400">
              {levelProgress}/100
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${levelProgress}%` }}
            />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center space-x-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <Target className="w-4 h-4 text-blue-500" />
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {achievements.modulesCompleted}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                {t('gamification.modules')}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <Award className="w-4 h-4 text-green-500" />
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {achievements.quizzesPassed}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                {t('gamification.quizzes')}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <Star className="w-4 h-4 text-yellow-500" />
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {achievements.perfectScores}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                {t('gamification.perfect')}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
            <Flame className="w-4 h-4 text-orange-500" />
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {streakDays}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                {t('gamification.days')}
              </div>
            </div>
          </div>
        </div>

        {/* Badges */}
        {badges.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white">
              {t('gamification.badges')}
            </h4>
            <div className="flex flex-wrap gap-2">
              {badges.map((badge) => (
                <div
                  key={badge.id}
                  className="flex items-center space-x-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                  title={badge.description}
                >
                  <span className="text-lg">{badge.icon}</span>
                  <div className="text-xs">
                    <div className="font-medium text-gray-900 dark:text-white">
                      {badge.name}
                    </div>
                    <div className="text-gray-600 dark:text-gray-400">
                      +{badge.points} {t('gamification.pts')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Encouragement */}
        {badges.length === 0 && (
          <div className="text-center py-4">
            <TrendingUp className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('gamification.completeModules')}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}; 