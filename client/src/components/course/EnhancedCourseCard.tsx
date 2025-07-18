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
  CheckCircle
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

  // Handle course enrollment (works offline)
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
          
          // Auto-navigate to course page after successful enrollment
          setTimeout(() => {
            window.location.href = `/course/${course.id || course._id}`;
          }, 1000);
        } else {
          throw new Error(response.error || 'Enrollment failed');
        }
      } else {
        // Offline enrollment - queue for sync
        // This part is removed as per the edit hint to simplify offline operations.
        // If offline enrollment is needed, it should be re-added and handled here.
        console.warn('Offline enrollment not implemented yet.');
        setEnrollmentStatus('pending'); // Indicate pending for offline
        onEnrollmentChange?.();
      }
    } catch (error) {
      console.error('Failed to enroll in course:', error);
      // Show user-friendly error (you might want to add a toast notification here)
    } finally {
      setIsEnrolling(false);
    }
  };

  // Get enrollment button text and status
  const getEnrollmentButton = () => {
    if (isEnrolled || enrollmentStatus === 'enrolled') {
      return (
        <Link to={`/course/${course.id || course._id}`}>
          <Button className="w-full flex items-center gap-2">
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
        <Button disabled className="w-full flex items-center gap-2">
          <Clock className="w-4 h-4" />
          {t('Enrollment Pending')}
        </Button>
      );
    }

    return (
      <Button 
        onClick={handleEnroll}
        disabled={isEnrolling}
        className="w-full flex items-center gap-2"
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
    <Card className="overflow-hidden hover:shadow-lg transition-shadow duration-300">
      {/* Course Thumbnail */}
      <div className="relative h-48 bg-gradient-to-br from-gray-100 to-gray-200">
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
        
        {/* Course Status Badge */}
        <div className="absolute top-3 left-3">
          {course.featured && (
            <Badge variant="default" className="text-xs">
              {t('Featured')}
            </Badge>
          )}
        </div>

                 {/* Course Level Badge */}
         <div className="absolute top-3 right-3">
           {course.level && (
             <Badge variant="info" className="text-xs">
               {t(course.level)}
             </Badge>
           )}
         </div>

        {/* Progress Overlay for enrolled courses */}
        {showProgress && course.progress && (
          <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white p-2">
            <div className="flex items-center justify-between text-sm">
              <span>{course.progress.percentage}% {t('Complete')}</span>
              <span>{course.progress.completedLessons}/{course.progress.totalLessons} {t('Lessons')}</span>
            </div>
            <div className="w-full bg-gray-600 rounded-full h-1 mt-1">
              <div 
                className="bg-green-400 h-1 rounded-full transition-all duration-300"
                style={{ width: `${course.progress.percentage}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Course Content */}
      <div className="p-6">
                 {/* Course Category */}
         {course.category && (
           <div className="flex items-center gap-2 mb-2">
             <Badge variant="info" className="text-xs">
               {t(course.category)}
             </Badge>
             {course.difficulty && (
               <Badge variant="warning" className="text-xs">
                 {t(course.difficulty)}
               </Badge>
             )}
           </div>
         )}

        {/* Course Title */}
        <h3 className="font-bold text-lg text-gray-900 mb-2 line-clamp-2">
          {course.title}
        </h3>

        {/* Course Description */}
        <p className="text-gray-600 text-sm mb-4 line-clamp-3">
          {course.description}
        </p>

        {/* Course Metadata */}
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
              <span>{course.studentsCount} {t('students')}</span>
            </div>
          )}
          
          {course.rating && (
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              <span>{course.rating}</span>
            </div>
          )}
        </div>

        {/* Instructor */}
        {course.instructorName && (
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
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

        {/* All courses are free - no pricing display needed */}

        {/* Enrollment Button */}
        <div className="space-y-2">
          {getEnrollmentButton()}
          
          {/* Offline indicator for enrollment */}
          {!isOnline && !isEnrolled && (
            <p className="text-xs text-center text-amber-600">
              {t('Enrollment will sync when you\'re back online')}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
};

export default EnhancedCourseCard; 