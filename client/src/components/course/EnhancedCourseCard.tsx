import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { useLanguage } from '../../contexts/LanguageContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { 
  BookOpen, 
  Clock, 
  Users, 
  Star,
  Play,
  Plus,
  CheckCircle,
  ArrowRight
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

  // Check if user is already enrolled
  const isEnrolled = course.enrollment || course.isEnrolled;
  const isInProgress = course.progress?.percentage > 0 && course.progress?.percentage < 100;
  const isCompleted = course.progress?.percentage >= 100;

  // Handle course enrollment with direct navigation
  const handleEnroll = async () => {
    if (!user || isEnrolling) return;

    setIsEnrolling(true);
    
    try {
      const userId = user.id || (user as any)._id;
      
      if (isOnline) {
        // Online enrollment
        const response = await apiClient.enrollInCourse(course.id || course._id);
        if (response.success) {
          setEnrollmentStatus('enrolled');
          onEnrollmentChange?.();
          onDataRefresh?.();
          
          console.log('Enrollment successful:', response.data);
          
          // Immediate navigation to course page
          window.location.href = `/course/${course.id || course._id}`;
        } else {
          throw new Error(response.error || 'Enrollment failed');
        }
      } else {
        console.warn('Offline enrollment not implemented yet.');
        setEnrollmentStatus('pending');
        onEnrollmentChange?.();
      }
    } catch (error) {
      console.error('Failed to enroll in course:', error);
    } finally {
      setIsEnrolling(false);
    }
  };

  // Get enrollment button text and status
  const getEnrollmentButton = () => {
    if (isEnrolled || enrollmentStatus === 'enrolled') {
      return (
        <Link to={`/course/${course.id || course._id}`}>
          <Button className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white">
            {isCompleted ? (
              <>
                <CheckCircle className="w-4 h-4" />
                {t('Review Course')}
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                {t('Continue Learning')}
              </>
            )}
          </Button>
        </Link>
      );
    }

    if (enrollmentStatus === 'pending') {
      return (
        <Button disabled className="w-full flex items-center justify-center gap-2 bg-gray-100 text-gray-500">
          <Clock className="w-4 h-4" />
          {t('Enrollment Pending')}
        </Button>
      );
    }

    return (
      <Button 
        onClick={handleEnroll}
        disabled={isEnrolling}
        className="w-full flex items-center justify-center gap-2 border border-blue-200 text-blue-700 hover:bg-blue-50 bg-white"
        variant="outline"
      >
        {isEnrolling ? (
          <LoadingSpinner className="w-4 h-4" />
        ) : (
          <Plus className="w-4 h-4" />
        )}
        {isEnrolling ? t('Enrolling...') : t('Enroll Now')}
      </Button>
    );
  };

  return (
    <Card className="overflow-hidden border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 bg-white">
      {/* Course Thumbnail */}
      <div className="relative h-48 bg-gray-100">
        {course.thumbnail ? (
          <img
            src={getFileUrl(course.thumbnail, 'thumbnail')}
            alt={course.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <BookOpen className="w-12 h-12 text-gray-400" />
          </div>
        )}
        
        {/* Course Level Badge - Clean Design */}
        <div className="absolute top-3 right-3">
          {course.level && (
            <Badge variant="default" className="bg-white text-gray-700 text-xs shadow-sm">
              {t(course.level)}
            </Badge>
          )}
        </div>

        {/* Progress Overlay for enrolled courses */}
        {showProgress && course.progress && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent text-white p-3">
            <div className="flex items-center justify-between text-sm mb-1">
              <span>{course.progress.percentage}% {t('Complete')}</span>
              <span>{course.progress.completedLessons}/{course.progress.totalLessons} {t('Lessons')}</span>
            </div>
            <div className="w-full bg-gray-400/50 rounded-full h-1.5">
              <div 
                className="bg-green-400 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${course.progress.percentage}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Course Content */}
      <div className="p-6">
        {/* Course Category - Simplified */}
        {course.category && (
          <div className="mb-3">
            <Badge variant="default" className="bg-gray-100 text-gray-700 text-xs">
              {t(course.category)}
            </Badge>
          </div>
        )}

        {/* Course Title */}
        <h3 className="font-semibold text-lg text-gray-900 mb-2 line-clamp-2">
          {course.title}
        </h3>

        {/* Course Description */}
        <p className="text-gray-600 text-sm mb-4 line-clamp-3 leading-relaxed">
          {course.description}
        </p>

        {/* Course Metadata - Clean Layout */}
        <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
          {course.duration && (
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>{course.duration}</span>
            </div>
          )}
          
          {course.studentsCount && (
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              <span>{course.studentsCount}</span>
            </div>
          )}
          
          {course.rating && (
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              <span>{course.rating}</span>
            </div>
          )}
        </div>

        {/* Instructor - Clean Design */}
        {course.instructorName && (
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
            <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-medium">
              {course.instructorName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">{course.instructorName}</p>
              {course.instructorTitle && (
                <p className="text-xs text-gray-500">{course.instructorTitle}</p>
              )}
            </div>
          </div>
        )}

        {/* Enrollment Button */}
        <div className="space-y-3">
          {getEnrollmentButton()}
          
          {/* Course preview link for non-enrolled users */}
          {!isEnrolled && (
            <Link 
              to={`/course/${course.id || course._id}`}
              className="block text-center"
            >
              <Button 
                variant="ghost" 
                className="w-full text-gray-600 hover:text-blue-600 text-sm"
              >
                {t('View Details')}
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          )}
          
          {/* Offline indicator */}
          {!isOnline && !isEnrolled && (
            <p className="text-xs text-center text-amber-600 bg-amber-50 py-2 px-3 rounded">
              {t('Enrollment will sync when you\'re back online')}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
};

export default EnhancedCourseCard; 