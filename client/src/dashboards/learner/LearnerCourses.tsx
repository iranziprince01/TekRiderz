import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useStableThemeLanguage } from '../../hooks/useStableThemeLanguage';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import Avatar from '../../components/ui/Avatar';
import { 
  BookOpen, 
  Play, 
  Clock, 
  CheckCircle, 
  Search,
  Award,
  TrendingUp,
  User,
  Calendar,
  Target,
  RefreshCw,
  RotateCcw
} from 'lucide-react';
import { apiClient, getFileUrl, cleanInstructorName } from '../../utils/api';
import { 
  cacheCourse, 
  getCachedCourses, 
  getEnrolledCoursesOffline,
  getCourseOffline,
  cacheLearnerData 
} from '../../offline/cacheService';
import { useAuth } from '../../contexts/AuthContext';

const LearnerCourses: React.FC = () => {
  const { t } = useLanguage();
  // Initialize stable theme and language
  useStableThemeLanguage();
  const { isOfflineMode } = useAuth();
  const [user, setUser] = useState<any>(null);
  const [enrolledCourses, setEnrolledCourses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  // Load user and enrolled courses
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Check if we're in offline mode and user is a learner
      if ((isOfflineMode || !navigator.onLine) && user?.role === 'learner') {
        console.log('🔄 Loading cached courses (offline mode)');
        setIsOffline(true);
        
        try {
          // Use the new learner-specific offline function
          const enrolledCourses = await getEnrolledCoursesOffline();
          console.log('📚 Loaded enrolled courses for offline access:', enrolledCourses.length);
          
          if (enrolledCourses.length > 0) {
            setEnrolledCourses(enrolledCourses);
            setError(null);
          } else {
            setError('No enrolled courses available offline. Please enroll in courses when online.');
          }
        } catch (cacheError) {
          console.error('Failed to load cached courses:', cacheError);
          setError('Failed to load cached courses');
        }
        
        return;
      }

      // Online mode - fetch from API
      setIsOffline(false);
      console.log('🌐 Loading courses from API (online mode)');
      
      const [userResponse, coursesResponse] = await Promise.all([
        apiClient.getCurrentUser(),
        apiClient.getEnrolledCourses({ sync: 'true' }) // Request progress sync
      ]);

      if (userResponse.success) {
        setUser(userResponse.data);
      }

      if (coursesResponse.success) {
        const courses = coursesResponse.data.courses || [];
        console.log('Loaded enrolled courses with synced progress:', courses);
        setEnrolledCourses(courses);
        
        // Cache courses for offline access (learners only)
        if (user?.role === 'learner') {
          try {
            console.log('💾 Caching enrolled courses for offline access...');
            // Mark courses as enrolled before caching
            const enrolledCoursesForCache = courses.map((course: any) => ({
              ...course,
              isEnrolled: true,
              enrollment: course.enrollment || {
                id: `enrollment_${course._id || course.id}`,
                enrolledAt: new Date().toISOString(),
                progress: course.progress?.overallProgress || 0,
                status: 'active'
              },
              offlineAccessible: true,
              lastCached: new Date().toISOString()
            }));
            
            await Promise.all(enrolledCoursesForCache.map((course: any) => cacheCourse(course)));
            console.log(`✅ Cached ${courses.length} enrolled courses successfully`);
            
            // Cache complete learner data for offline access
            if (user) {
              await cacheLearnerData(user, enrolledCoursesForCache);
            }
          } catch (cacheError) {
            console.warn('Failed to cache some courses:', cacheError);
            // Don't block the UI if caching fails
          }
        } else {
          console.log('🔄 Skipping course cache - user is not a learner');
        }
      } else {
        console.error('Failed to load courses:', coursesResponse.error);
        setError(coursesResponse.error || 'Failed to load courses');
      }
    } catch (err: any) {
      console.error('Error loading data:', err);
      
      // If online request fails, try to load cached courses (learners only)
      if (!isOfflineMode && navigator.onLine && user?.role === 'learner') {
        console.log('🔄 Online request failed, trying cached courses...');
        try {
          const enrolledCourses = await getEnrolledCoursesOffline();
          if (enrolledCourses.length > 0) {
            console.log('📚 Fallback to cached enrolled courses:', enrolledCourses.length);
            setEnrolledCourses(enrolledCourses);
            setIsOffline(true);
            setError(null);
            return;
          }
        } catch (cacheError) {
          console.error('Failed to load cached courses as fallback:', cacheError);
        }
      }
      
      setError(err.message || 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, [isOfflineMode]);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    
    // Don't refresh if offline
    if (isOffline || isOfflineMode) {
      console.log('🔄 Refresh disabled - offline mode');
      return;
    }
    
    try {
      setIsRefreshing(true);
      console.log('🔄 Manual refresh with progress sync...');
      
      const coursesResponse = await apiClient.getEnrolledCourses({ sync: 'true' });
      
      if (coursesResponse.success) {
        const courses = coursesResponse.data.courses || [];
        console.log('🔄 Refreshed courses with synced progress:', courses);
        setEnrolledCourses(courses);
        
        // Cache the refreshed courses (learners only)
        if (user?.role === 'learner') {
          try {
            // Mark courses as enrolled before caching
            const enrolledCoursesForCache = courses.map((course: any) => ({
              ...course,
              isEnrolled: true,
              enrollment: course.enrollment || {
                id: `enrollment_${course._id || course.id}`,
                enrolledAt: new Date().toISOString(),
                progress: course.progress?.overallProgress || 0,
                status: 'active'
              },
              offlineAccessible: true
            }));
            
            await Promise.all(enrolledCoursesForCache.map((course: any) => cacheCourse(course)));
            console.log(`✅ Cached ${courses.length} refreshed enrolled courses`);
          } catch (cacheError) {
            console.warn('Failed to cache refreshed courses:', cacheError);
          }
        } else {
          console.log('🔄 Skipping course cache refresh - user is not a learner');
        }
      } else {
        console.error('Failed to refresh courses:', coursesResponse.error);
      }
    } catch (error) {
      console.error('Failed to refresh:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, isOffline, isOfflineMode]);

  // Refresh progress data when user returns to the page - only when online
  useEffect(() => {
    if (isOffline || isOfflineMode) {
      console.log('🔄 Visibility refresh disabled - offline mode');
      return;
    }
    
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('🔄 Page became visible, refreshing progress data');
        loadData();
      }
    };

    const handleFocus = () => {
      console.log('🔄 Window focused, refreshing progress data');
      loadData();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [loadData, isOffline, isOfflineMode]);

  // Periodic progress refresh (every 30 seconds) - only when online
  useEffect(() => {
    if (isOffline || isOfflineMode) {
      console.log('🔄 Periodic refresh disabled - offline mode');
      return;
    }
    
    const interval = setInterval(() => {
      console.log('🔄 Periodic progress refresh...');
      handleRefresh();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [handleRefresh, isOffline, isOfflineMode]);

  // Listen for global enrollment events - only when online
  useEffect(() => {
    if (isOffline || isOfflineMode) {
      console.log('🔄 Global enrollment events disabled - offline mode');
      return;
    }
    
    const handleEnrollmentEvent = () => {
      console.log('Global enrollment event detected, refreshing My Courses data');
      loadData();
    };

    // Listen for enrollment events from other components
    window.addEventListener('courseEnrollmentUpdated', handleEnrollmentEvent);
    
    // Listen for course progress updates
    window.addEventListener('courseProgressUpdated', handleEnrollmentEvent);

    return () => {
      window.removeEventListener('courseEnrollmentUpdated', handleEnrollmentEvent);
      window.removeEventListener('courseProgressUpdated', handleEnrollmentEvent);
    };
  }, [loadData, isOffline, isOfflineMode]);

  // Process enrolled courses with proper progress calculation
  const processedCourses = useMemo(() => {
    return enrolledCourses.map(course => {
      // Get progress from multiple possible sources with priority order
      const progressData = course.progress;
      const enrollmentProgress = course.enrollment?.progress || 0;
      
      // Use the most accurate progress source
      let finalProgress = 0;
      let completedLessons = 0;
      let totalLessons = 0;
      
      if (progressData) {
        // Use detailed progress data from CouchDB
        finalProgress = progressData.overallProgress || progressData.percentage || 0;
        completedLessons = progressData.completedLessons || 0;
        totalLessons = progressData.totalLessons || course.totalModules || course.totalLessons || 0;
      } else {
        // Fallback to enrollment progress
        finalProgress = enrollmentProgress;
        completedLessons = 0;
        totalLessons = course.totalModules || course.totalLessons || 0;
      }
      
      // Ensure progress is a valid number between 0-100
      finalProgress = Math.min(100, Math.max(0, finalProgress));
      
      // Calculate progress percentage if we have lesson data
      if (totalLessons > 0 && completedLessons > 0) {
        const calculatedProgress = Math.round((completedLessons / totalLessons) * 100);
        // Use the higher of calculated or stored progress
        finalProgress = Math.max(finalProgress, calculatedProgress);
      }
      
      console.log(`📊 Course "${course.title}" progress:`, {
        courseId: course.id || course._id,
        finalProgress,
        completedLessons,
        totalLessons,
        hasProgressData: !!progressData,
        enrollmentProgress,
        overallProgress: progressData?.overallProgress,
        percentage: progressData?.percentage
      });
      
      return {
        ...course,
        progress: finalProgress,
        completedModules: completedLessons,
        totalModules: totalLessons,
        thumbnail: getFileUrl(course.thumbnail, 'thumbnail'),
        instructorAvatar: getFileUrl(course.instructorId, 'avatar')
      };
    });
  }, [enrolledCourses]);

  // Filter courses based on search and status
  const filteredCourses = useMemo(() => {
    let filtered = processedCourses;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(course =>
        course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.instructorName?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(course => {
        const progress = course.progress || 0;
        switch (statusFilter) {
          case 'in-progress':
            return progress > 0 && progress < 100;
          case 'completed':
            return progress >= 100;
          case 'not-started':
            return progress === 0;
          default:
            return true;
        }
      });
    }

    return filtered;
  }, [processedCourses, searchTerm, statusFilter]);

  // Calculate statistics
  const statistics = useMemo(() => {
    const total = processedCourses.length;
    const inProgress = processedCourses.filter(c => (c.progress || 0) > 0 && (c.progress || 0) < 100).length;
    const completed = processedCourses.filter(c => (c.progress || 0) >= 100).length;
    const notStarted = processedCourses.filter(c => (c.progress || 0) === 0).length;
    const averageProgress = total > 0 
      ? processedCourses.reduce((sum, course) => sum + (course.progress || 0), 0) / total 
      : 0;

    return { total, inProgress, completed, notStarted, averageProgress };
  }, [processedCourses]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 mb-4">{error}</p>
        <Button onClick={loadData} variant="outline">
          {t('Try Again')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('My Courses')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {t('Continue your learning journey')}
            {isOffline && (
              <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                📱 {t('Offline Mode')}
              </span>
            )}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {isOffline && (
            <div className="text-sm text-yellow-600 bg-yellow-50 px-3 py-1 rounded-md border border-yellow-200">
              📱 {t('Limited functionality - offline mode')}
            </div>
          )}
          <Button
            onClick={handleRefresh}
            disabled={isRefreshing || isOffline}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            {t('Refresh')}
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <BookOpen className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {t('Total Courses')}
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {statistics.total}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
              <TrendingUp className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {t('In Progress')}
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {statistics.inProgress}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {t('Completed')}
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {statistics.completed}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
              <Target className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {t('Avg Progress')}
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {Math.round(statistics.averageProgress)}%
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            type="text"
            placeholder={t('Search courses...')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
        </div>
        
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full h-12 px-4 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white appearance-none [&::-ms-expand]:hidden"
          >
            <option value="all">{t('All Courses')}</option>
            <option value="in-progress">{t('In Progress')}</option>
            <option value="completed">{t('Completed')}</option>
            <option value="not-started">{t('Not Started')}</option>
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none">
            <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Courses Grid */}
      {filteredCourses.length === 0 ? (
        <Card className="p-8 text-center">
          <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {searchTerm || statusFilter !== 'all' 
              ? t('No courses match your filters')
              : t('No courses enrolled yet')
            }
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {searchTerm || statusFilter !== 'all'
              ? t('Try adjusting your search or filters')
              : t('Browse available courses to get started')
            }
          </p>
          {!searchTerm && statusFilter === 'all' && (
            <Link to="/dashboard">
              <Button>
                {t('Browse Courses')}
              </Button>
            </Link>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCourses.map((course) => (
            <Card key={course._id} className="overflow-hidden hover:shadow-lg transition-shadow">
              {/* Course Thumbnail */}
              <div className="relative h-48 bg-gray-200 dark:bg-gray-700">
                {course.thumbnail ? (
                  <img
                    src={course.thumbnail}
                    alt={course.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <BookOpen className="h-12 w-12 text-gray-400" />
                  </div>
                )}
                
                {/* Progress Badge */}
                <div className="absolute top-3 right-3">
                  <Badge variant={course.progress >= 100 ? 'success' : 'default'}>
                    {course.progress >= 100 ? t('Completed') : `${Math.round(course.progress)}%`}
                  </Badge>
                </div>
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
                    src={course.instructorAvatar}
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
                    <span>{course.totalDuration ? `${Math.round(course.totalDuration / 60)}m` : t('N/A')}</span>
                  </div>
                  <div className="flex items-center">
                    <BookOpen className="h-4 w-4 mr-1" />
                    <span>{course.totalModules} {t('modules')}</span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600 dark:text-gray-400">
                      {t('Progress')}
                    </span>
                    <span className="text-gray-900 dark:text-white font-medium">
                      {Math.round(course.progress)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${course.progress}%` }}
                    />
                  </div>
                </div>

                {/* Action Button */}
                <Link to={`/course/${course._id}`} className="block">
                  <Button className="w-full bg-blue-500 hover:bg-blue-600 text-white transition-colors duration-200">
                    {course.progress >= 100 ? (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        {t('Review Course')}
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        {t('Continue Learning')}
                      </>
                    )}
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default LearnerCourses; 