import React, { useState, useEffect } from 'react';
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
  Download,
  Eye,
  Wifi,
  WifiOff
} from 'lucide-react';
import { apiClient, getFileUrl } from '../../utils/api';
import { offlineOperations } from '../../utils/offlineOperations';
import { useCoursePreloading } from '../../hooks/useCoursePreloading';

interface EnhancedCourseCardProps {
  course: any;
  showProgress?: boolean;
  onEnrollmentChange?: () => void;
}

const EnhancedCourseCard: React.FC<EnhancedCourseCardProps> = ({ 
  course, 
  showProgress = false,
  onEnrollmentChange 
}) => {
  const { user } = useAuth();
  const { isOnline } = useNetworkStatus();
  const { t } = useLanguage();
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrollmentStatus, setEnrollmentStatus] = useState<'none' | 'enrolled' | 'pending'>('none');
  const [isOfflineAvailable, setIsOfflineAvailable] = useState(false);
  
  // Course preloading functionality
  const { 
    preloadStatus, 
    preloadCourse, 
    cancelPreload, 
    clearPreloadedCourse 
  } = useCoursePreloading();

  // Check if user is already enrolled
  const isEnrolled = course.enrollment || course.isEnrolled;

  // Check if course is available offline
  useEffect(() => {
    const checkOfflineAvailability = async () => {
      if (course.id && user?.id) {
        try {
          const offlineSettings = localStorage.getItem(`course_preloaded_${course.id}`);
          setIsOfflineAvailable(!!offlineSettings);
        } catch (error) {
          console.warn('Failed to check offline course availability:', error);
        }
      }
    };

    checkOfflineAvailability();
  }, [course.id, user?.id, preloadStatus]);

  // Handle course download for offline access
  const handleDownloadCourse = async () => {
    if (!course.id) return;
    
    try {
      await preloadCourse(course.id, {
        includeVideos: true,
        includeAssets: true
      });
      
      // Recheck offline availability after successful preload
      setIsOfflineAvailable(true);
    } catch (error) {
      console.error('Failed to download course:', error);
    }
  };

  // Handle removing offline course
  const handleRemoveOfflineCourse = async () => {
    if (!course.id) return;
    
    try {
      await clearPreloadedCourse(course.id);
      setIsOfflineAvailable(false);
    } catch (error) {
      console.error('Failed to remove offline course:', error);
    }
  };
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
        } else {
          throw new Error(response.error || 'Enrollment failed');
        }
      } else {
        // Offline enrollment - queue for sync
        await offlineOperations.enrollInCourse(course.id || course._id, userId);
        setEnrollmentStatus('pending');
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
        <div className="absolute top-3 left-3 flex flex-col gap-1">
          {course.featured && (
            <Badge variant="default" className="text-xs">
              {t('Featured')}
            </Badge>
          )}
          
          {/* Offline Availability Badge */}
          {isOfflineAvailable && (
            <Badge variant="success" className="text-xs flex items-center gap-1">
              <Download className="w-3 h-3" />
              {t('Offline Ready')}
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

        {/* Course Price */}
        {course.price !== undefined && (
          <div className="mb-4">
            {course.price === 0 ? (
              <Badge variant="success" className="text-sm">
                {t('Free')}
              </Badge>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-gray-900">
                  ${course.price}
                </span>
                {course.originalPrice && course.originalPrice > course.price && (
                  <span className="text-sm text-gray-500 line-through">
                    ${course.originalPrice}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Enrollment Button */}
        <div className="space-y-2">
          {getEnrollmentButton()}
          
          {/* Offline Access Buttons for Enrolled Users */}
          {isEnrolled && (
            <div className="flex gap-2">
              {/* Continue/Start Course Button */}
              <Link 
                to={`/course/${course.id}`}
                className="flex-1"
              >
                <Button variant="primary" size="sm" className="w-full">
                  <Play className="w-4 h-4 mr-1" />
                  {course.progress?.percentage > 0 ? t('Continue') : t('Start')}
                </Button>
              </Link>
              
              {/* Offline Course Access */}
              {isOfflineAvailable && (
                <Link to={`/offline-course/${course.id}`}>
                  <Button variant="outline" size="sm" className="flex items-center gap-1">
                    <Eye className="w-4 h-4" />
                    {!isOnline ? t('View') : t('Offline')}
                  </Button>
                </Link>
              )}
            </div>
          )}
          
          {/* Offline indicator for enrollment */}
          {!isOnline && !isEnrolled && (
            <p className="text-xs text-center text-amber-600">
              {t('Enrollment will sync when you\'re back online')}
            </p>
          )}
          
          {/* Course Download/Remove for Offline Access */}
          {isEnrolled && (
            <div className="border-t pt-2">
              {preloadStatus.isPreloading && preloadStatus.currentItem ? (
                <div className="flex items-center gap-2 text-sm text-blue-600">
                  <LoadingSpinner className="w-4 h-4" />
                  <div className="flex-1">
                    <div className="text-xs">{t('Downloading...')}</div>
                    <div className="text-xs text-gray-500 truncate">
                      {preloadStatus.currentItem}
                    </div>
                    {preloadStatus.progress > 0 && (
                      <div className="w-full bg-gray-200 rounded-full h-1 mt-1">
                        <div 
                          className="bg-blue-500 h-1 rounded-full transition-all duration-300"
                          style={{ width: `${preloadStatus.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <Button
                    onClick={cancelPreload}
                    variant="ghost"
                    size="sm"
                    className="text-xs px-2 py-1"
                  >
                    {t('Cancel')}
                  </Button>
                </div>
              ) : isOfflineAvailable ? (
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-green-600">
                    <Download className="w-4 h-4" />
                    <span>{t('Downloaded for offline')}</span>
                  </div>
                  <Button
                    onClick={handleRemoveOfflineCourse}
                    variant="ghost"
                    size="sm"
                    className="text-xs px-2 py-1 text-red-600 hover:text-red-700"
                  >
                    {t('Remove')}
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={handleDownloadCourse}
                  variant="outline"
                  size="sm"
                  className="w-full text-xs flex items-center gap-2"
                  disabled={!isOnline}
                >
                  <Download className="w-4 h-4" />
                  {t('Download for offline')}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

export default EnhancedCourseCard; 