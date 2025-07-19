import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { useLanguage } from '../../contexts/LanguageContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import Avatar from '../ui/Avatar';
import { 
  BookOpen, 
  Clock, 
  Users, 
  Star,
  Play,
  Plus,
  CheckCircle,
  User,
  Award,
  TrendingUp
} from 'lucide-react';
import { apiClient, getFileUrl } from '../../utils/api';

interface EnhancedCourseCardProps {
  course: any;
  showProgress?: boolean;
  onEnrollmentChange?: () => void;
  onDataRefresh?: () => void;
}

const EnhancedCourseCard: React.FC<EnhancedCourseCardProps> = ({ 
  course, 
  showProgress = false,
  onEnrollmentChange,
  onDataRefresh
}) => {
  const { user } = useAuth();
  const { isOnline } = useNetworkStatus();
  const { t } = useLanguage();
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrollmentStatus, setEnrollmentStatus] = useState<'none' | 'enrolled' | 'pending'>('none');
  const [enrollmentMessage, setEnrollmentMessage] = useState<string>('');

  // Check if user is already enrolled
  const isEnrolled = course.enrollment || course.isEnrolled;
  const isInProgress = course.progress?.percentage > 0 && course.progress?.percentage < 100;
  const isCompleted = course.progress?.percentage >= 100;

  // Format duration helper
  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  };

  // Handle course enrollment with improved error handling
  const handleEnroll = async () => {
    if (!user || isEnrolling) return;

    setIsEnrolling(true);
    setEnrollmentMessage('');
    
    try {
      if (isOnline) {
        // Online enrollment with proper error handling
        const response = await apiClient.enrollInCourse(course.id || course._id);
        
        if (response.success) {
          setEnrollmentStatus('enrolled');
          setEnrollmentMessage(t('Successfully enrolled! Redirecting to course...'));
          
          // Trigger data refresh to update the parent component
          onEnrollmentChange?.();
          onDataRefresh?.();
          
          // Small delay before navigation to show success message
          setTimeout(() => {
            window.location.href = `/course/${course.id || course._id}`;
          }, 1000);
          
        } else {
          throw new Error(response.error || t('Enrollment failed. Please try again.'));
        }
      } else {
        // Offline mode - queue enrollment for later
        setEnrollmentStatus('pending');
        setEnrollmentMessage(t('Enrollment will be processed when you\'re back online'));
        onEnrollmentChange?.();
      }
    } catch (error: any) {
      console.error('Failed to enroll in course:', error);
      setEnrollmentMessage(error.message || t('Failed to enroll. Please check your connection and try again.'));
    } finally {
      setIsEnrolling(false);
    }
  };

  // Get enrollment button based on current state
  const getEnrollmentButton = () => {
    if (isEnrolled || enrollmentStatus === 'enrolled') {
      return (
        <Link to={`/course/${course.id || course._id}`}>
          <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white transition-colors duration-200">
            {isCompleted ? (
              <>
                <Award className="w-4 h-4 mr-2" />
                {t('Review Course')}
              </>
            ) : isInProgress ? (
              <>
                <Play className="w-4 h-4 mr-2" />
                {t('Continue Learning')}
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                {t('Go To Course')}
              </>
            )}
          </Button>
        </Link>
      );
    }

    if (enrollmentStatus === 'pending') {
      return (
        <Button 
          disabled 
          className="w-full bg-orange-100 text-orange-700 border border-orange-200 cursor-not-allowed"
        >
          <Clock className="w-4 h-4 mr-2" />
          {t('Enrollment Pending')}
        </Button>
      );
    }

    return (
      <Button 
        onClick={handleEnroll}
        disabled={isEnrolling}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white transition-colors duration-200 font-medium"
      >
        {isEnrolling ? (
          <>
            <LoadingSpinner size="sm" className="mr-2" />
            {t('Enrolling...')}
          </>
        ) : (
          <>
            <Plus className="w-4 h-4 mr-2" />
            {t('Enroll Now')}
          </>
        )}
      </Button>
    );
  };

  // Get course level badge color
  const getLevelBadgeClass = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'beginner':
        return 'bg-green-100 text-green-800 border border-green-200';
      case 'intermediate':
        return 'bg-blue-100 text-blue-800 border border-blue-200';
      case 'advanced':
        return 'bg-purple-100 text-purple-800 border border-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 border border-gray-200';
    }
  };

  return (
    <Card className="overflow-hidden border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300 bg-white">
      {/* Course Thumbnail */}
      <div className="relative h-48 bg-gradient-to-br from-blue-50 to-indigo-50">
        {course.thumbnail ? (
          <img
            src={getFileUrl(course.thumbnail, 'thumbnail')}
            alt={course.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <BookOpen className="w-16 h-16 text-blue-400" />
          </div>
        )}
        
        {/* Overlays */}
        <div className="absolute top-3 left-3">
          {course.level && (
            <Badge className={`${getLevelBadgeClass(course.level)} text-xs font-medium px-2 py-1`}>
              {t(course.level)}
            </Badge>
          )}
        </div>
        
        {course.rating && (
          <div className="absolute top-3 right-3 bg-white bg-opacity-90 rounded-full px-2 py-1 flex items-center gap-1">
            <Star className="w-3 h-3 text-yellow-500 fill-current" />
            <span className="text-xs font-medium text-gray-900">{course.rating}</span>
          </div>
        )}
        
        {/* Progress indicator for enrolled courses */}
        {showProgress && course.progress && (
          <div className="absolute bottom-0 left-0 right-0 bg-white bg-opacity-90 p-2">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-gray-600">{t('Progress')}</span>
              <span className="text-xs font-medium text-blue-600">{course.progress.percentage}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                style={{ width: `${course.progress.percentage}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Course Content */}
      <div className="p-6">
        {/* Category and Status Badges */}
        <div className="flex items-center gap-2 mb-3">
          {course.category && (
            <Badge className="bg-gray-100 text-gray-700 text-xs px-2 py-1">
              {t(course.category)}
            </Badge>
          )}
          {showProgress && (
            <>
              {isCompleted && (
                <Badge className="bg-green-100 text-green-800 text-xs px-2 py-1">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  {t('Completed')}
                </Badge>
              )}
              {isInProgress && (
                <Badge className="bg-blue-100 text-blue-800 text-xs px-2 py-1">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  {t('In Progress')}
                </Badge>
              )}
            </>
          )}
        </div>

        {/* Course Title */}
        <h3 className="font-bold text-lg text-gray-900 mb-2 line-clamp-2 leading-tight">
          {course.title}
        </h3>

        {/* Course Description */}
        <p className="text-gray-600 text-sm mb-4 line-clamp-3 leading-relaxed">
          {course.description}
        </p>

        {/* Instructor */}
        {course.instructorName && (
          <div className="flex items-center gap-2 mb-4">
            <Avatar name={course.instructorName} />
            <span className="text-sm text-gray-600">
              {t('by')} <span className="font-medium">{course.instructorName}</span>
            </span>
          </div>
        )}

        {/* Course Info */}
        <div className="flex items-center justify-between mb-4 text-sm text-gray-500">
          <div className="flex items-center gap-4">
            {course.duration && (
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>{formatDuration(course.duration)}</span>
              </div>
            )}
            {course.enrolledCount !== undefined && (
              <div className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                <span>{course.enrolledCount} {t('students')}</span>
              </div>
            )}
          </div>
          
          {course.price !== undefined && (
            <div className="font-bold text-lg text-gray-900">
              {course.price === 0 ? t('Free') : `$${course.price}`}
            </div>
          )}
        </div>

        {/* Enrollment Message */}
        {enrollmentMessage && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${
            enrollmentStatus === 'enrolled' 
              ? 'bg-green-50 text-green-800 border border-green-200' 
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {enrollmentMessage}
          </div>
        )}

        {/* Action Button */}
        {getEnrollmentButton()}
      </div>
    </Card>
  );
};

export default EnhancedCourseCard; 