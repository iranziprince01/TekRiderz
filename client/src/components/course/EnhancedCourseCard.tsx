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
  
  // Check if course is completed (100% progress)
  const isFullyCompleted = isCompleted || progressPercentage >= 100;

  // Debug: Log enrollment data for specific course
  useEffect(() => {
    if (course.title === 'Intro to AI') {
      console.log('🔍 EnhancedCourseCard enrollment data:', {
        courseId: course.id || course._id,
        courseTitle: course.title,
        courseEnrollment: course.enrollment,
        courseIsEnrolled: course.isEnrolled,
        enrollmentStatus,
        isEnrolled,
        progressPercentage,
        isFullyCompleted
      });
    }
  }, [course.enrollment, course.isEnrolled, enrollmentStatus, isEnrolled, progressPercentage, isFullyCompleted]);

  // Format duration helper
  const formatDuration = (minutes: number) => {
    // Handle NaN, undefined, or invalid values
    if (!minutes || isNaN(minutes) || minutes < 0) {
      return 'N/A';
    }
    
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
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
        setEnrollmentMessage(t('learner.successfullyEnrolled'));
        
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
        throw new Error(response.error || t('learner.enrollmentFailed'));
      }
    } catch (error: any) {
      console.error('💥 Failed to enroll in course:', error);
      setEnrollmentMessage(error.message || t('learner.failedToEnroll'));
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
            {isFullyCompleted ? (
              <>
                <Award className="w-4 h-4 mr-2" />
                {t('learner.reviewCourse')}
              </>
            ) : isInProgress ? (
              <>
                <Play className="w-4 h-4 mr-2" />
                {t('learner.continueLearning')}
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                {t('learner.goToCourse')}
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
          {t('learner.enrollmentPending')}
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
            {t('learner.enrolling')}
          </>
        ) : (
          <>
            <Plus className="w-4 h-4 mr-2" />
            {t('learner.enrollNow')}
          </>
        )}
      </Button>
    );
  };

  // Get course level badge color
  const getLevelBadgeClass = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'beginner':
        return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-700';
      case 'intermediate':
        return 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-700';
      case 'advanced':
        return 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 border border-purple-200 dark:border-purple-700';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-600';
    }
  };

  return (
    <Card className="overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-lg transition-all duration-300 bg-white dark:bg-gray-800">
      {/* Course Thumbnail */}
      <div className="relative h-48 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-800 overflow-hidden">
        {course.thumbnail ? (
          <img
            src={getFileUrl(course.thumbnail, 'thumbnail')}
            alt={course.title}
            className="w-full h-full object-cover object-center"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              // Show fallback when image fails to load
              const parent = target.parentElement;
              if (parent) {
                parent.innerHTML = `
                  <div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-800">
                    <div class="text-center">
                      <svg class="w-12 h-12 text-blue-400 dark:text-blue-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
                      </svg>
                      <p class="text-xs text-gray-500 dark:text-gray-400">Course</p>
                    </div>
                  </div>
                `;
              }
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-800">
            <div className="text-center">
              <BookOpen className="w-12 h-12 text-blue-400 dark:text-blue-500 mx-auto mb-2" />
              <p className="text-xs text-gray-500 dark:text-gray-400">Course</p>
            </div>
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
          <div className="absolute top-3 right-3 bg-white dark:bg-gray-800 bg-opacity-90 dark:bg-opacity-90 rounded-full px-2 py-1 flex items-center gap-1">
            <Star className="w-3 h-3 text-yellow-500 fill-current" />
            <span className="text-xs font-medium text-gray-900 dark:text-white">{course.rating}</span>
          </div>
        )}
        
        {/* Progress indicator for enrolled courses */}
        {showProgress && isEnrolled && (
          <div className="absolute bottom-3 left-3 right-3">
            <div className="bg-white dark:bg-gray-800 bg-opacity-90 dark:bg-opacity-90 rounded-lg p-2">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-600 dark:text-gray-400">{t('learner.progress')}</span>
                <span className="font-medium text-gray-900 dark:text-white">{Math.round(progressPercentage)}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                <div
                  className="bg-blue-600 dark:bg-blue-500 h-1.5 rounded-full transition-all duration-300"
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
              {t('learner.instructor')}
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
            <span>{course.enrollmentCount || course.students || 0} {t('learner.students')}</span>
          </div>
          <div className="flex items-center">
            <BookOpen className="h-4 w-4 mr-1" />
            <span>{course.totalModules || course.sections?.length || 0} {t('learner.modules')}</span>
          </div>
        </div>

        {/* Enrollment Message */}
        {enrollmentMessage && (
          <div className={`mb-3 p-2 rounded text-sm ${
            enrollmentStatus === 'enrolled' 
              ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200 border border-green-200 dark:border-green-700' 
              : 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 border border-red-200 dark:border-red-700'
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