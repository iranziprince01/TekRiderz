import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
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
import { apiClient, getFileUrl, cleanInstructorName } from '../../utils/api';

interface EnhancedCourseCardProps {
  course: any;
  showProgress?: boolean;
  onEnrollmentChange?: (updatedCourse?: any) => void;
  onDataRefresh?: () => void;
}

const EnhancedCourseCard: React.FC<EnhancedCourseCardProps> = ({ 
  course, 
  showProgress = false,
  onEnrollmentChange,
  onDataRefresh
}) => {
  const { user } = useAuth();

  const { t } = useLanguage();
  const { theme } = useTheme();
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrollmentStatus, setEnrollmentStatus] = useState<'none' | 'enrolled' | 'pending'>('none');
  const [enrollmentMessage, setEnrollmentMessage] = useState<string>('');

  // Determine enrollment status with debugging - prioritize course data over local state
  const isEnrolled = course.enrollment || course.isEnrolled || enrollmentStatus === 'enrolled';
  
  // Update local enrollment status when course data changes
  useEffect(() => {
    if (course.enrollment || course.isEnrolled) {
      setEnrollmentStatus('enrolled');
    } else {
      setEnrollmentStatus('none');
    }
  }, [course.enrollment, course.isEnrolled]);

  // Listen for enrollment updates
  useEffect(() => {
    const handleEnrollmentUpdate = (event: CustomEvent) => {
      if (event.detail.courseId === (course.id || course._id)) {
        console.log('Course card: Enrollment update detected');
        setEnrollmentStatus('enrolled');
        setEnrollmentMessage('');
      }
    };

    window.addEventListener('courseEnrollmentUpdated', handleEnrollmentUpdate as EventListener);
    
    return () => {
      window.removeEventListener('courseEnrollmentUpdated', handleEnrollmentUpdate as EventListener);
    };
  }, [course.id, course._id]);
  
  const progressPercentage = course.progress?.overallProgress || 
                            course.progress?.percentage || 
                            course.enrollment?.progress || 0;
  const isInProgress = progressPercentage > 0 && progressPercentage < 100;
  const isCompleted = progressPercentage >= 100;

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
      // Online enrollment with proper error handling
      const response = await apiClient.enrollInCourse(course.id || course._id);
      
      if (response.success) {
        // Immediately update local state to show enrolled status
        setEnrollmentStatus('enrolled');
        setEnrollmentMessage(t('Successfully enrolled! Redirecting to course...'));
        
        // Update the course object to reflect enrollment
        const updatedCourse = {
          ...course,
          isEnrolled: true,
          enrollment: {
            id: response.data.enrollment?._id || response.data.enrollment?.id,
            enrolledAt: response.data.enrollment?.enrolledAt || new Date().toISOString(),
            progress: 0,
            status: 'active'
          }
        };
        
        // Trigger data refresh to update the parent component
        onEnrollmentChange?.(updatedCourse);
        onDataRefresh?.();
        
        // Dispatch global event to notify other components
        window.dispatchEvent(new CustomEvent('courseEnrollmentUpdated', {
          detail: { courseId: course.id || course._id, enrollment: response.data.enrollment }
        }));
        
        // Navigate to course page after a short delay to show success message
        setTimeout(() => {
          window.location.href = `/course/${course.id || course._id}`;
        }, 1500);
        
      } else {
        console.error('❌ Enrollment failed:', response.error);
        throw new Error(response.error || t('Enrollment failed. Please try again.'));
      }
    } catch (error: any) {
      console.error('💥 Failed to enroll in course:', error);
      setEnrollmentMessage(error.message || t('Failed to enroll. Please check your connection and try again.'));
    } finally {
      setIsEnrolling(false);
    }
  };

  // Handle course access with progress sync
  const handleCourseAccess = async () => {
    if (isEnrolled) {
      // Trigger progress sync before navigating
      try {
        await apiClient.syncCourseProgress(course.id || course._id);
        console.log('🔄 Progress synced before course access');
      } catch (error) {
        console.warn('Failed to sync progress before course access:', error);
      }
    }
  };

  // Get enrollment button based on current state
  const getEnrollmentButton = () => {
    if (isEnrolled) {
      return (
        <Link to={`/course/${course.id || course._id}`} onClick={handleCourseAccess}>
          <Button className="w-full bg-blue-500 hover:bg-blue-600 text-white transition-colors duration-200">
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
            <span className="text-xs font-medium text-gray-900 dark:text-white">{course.rating}</span>
          </div>
        )}
        
        {/* Progress indicator for enrolled courses */}
        {showProgress && isEnrolled && (
          <div className="absolute bottom-3 left-3 right-3">
            <div className="bg-white bg-opacity-90 rounded-lg p-2">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-600 dark:text-gray-400">{t('Progress')}</span>
                <span className="font-medium dark:text-white">{Math.round(progressPercentage)}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                <div
                  className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Course Content */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2">
          {course.title}
        </h3>
        
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
          {course.description}
        </p>

        {/* Instructor */}
        <div className="flex items-center mb-3">
          <Avatar
            src={getFileUrl(course.instructorId, 'avatar')}
            name={cleanInstructorName(course.instructorName)}
            size="sm"
          />
          <div className="ml-2">
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {cleanInstructorName(course.instructorName)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t('Instructor')}
            </p>
          </div>
        </div>

        {/* Course Stats */}
        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-4">
          <div className="flex items-center">
            <Clock className="h-4 w-4 mr-1" />
            <span>{course.totalDuration ? formatDuration(Math.round(course.totalDuration / 60)) : t('N/A')}</span>
          </div>
          <div className="flex items-center">
            <Users className="h-4 w-4 mr-1" />
            <span>{course.enrollmentCount || 0} {t('students')}</span>
          </div>
          <div className="flex items-center">
            <BookOpen className="h-4 w-4 mr-1" />
            <span>{course.totalModules || course.sections?.length || 0} {t('modules')}</span>
          </div>
        </div>

        {/* Enrollment Message */}
        {enrollmentMessage && (
          <div className={`mb-3 p-2 rounded text-sm ${
            enrollmentStatus === 'enrolled' 
              ? 'bg-green-100 text-green-700 border border-green-200' 
              : 'bg-red-100 text-red-700 border border-red-200'
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