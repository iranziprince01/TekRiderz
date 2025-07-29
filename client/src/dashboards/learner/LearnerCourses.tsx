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
  cacheLearnerData,
  cacheEnrolledCourses,
  updateEnrolledCoursesCache,
  cleanupNonEnrolledCourses,
  refreshEnrolledCoursesCache,
  cleanupDemoContent,
  autoCacheCourseOnAccess
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
    setIsLoading(true);
    setError(null);

    // Clean up non-enrolled courses and demo content from cache (learners only)
    if (user?.role === 'learner') {
      try {
        const cleanupResult = await cleanupNonEnrolledCourses();
        console.log(`🧹 Cache cleanup: ${cleanupResult.cleaned} non-enrolled courses removed, ${cleanupResult.remaining} enrolled courses remaining`);
        
        // Also clean up any demo content
        const demoCleanupResult = await cleanupDemoContent();
        console.log(`🧹 Demo cleanup: ${demoCleanupResult.message}`);
      } catch (cleanupError) {
        console.warn('Failed to cleanup cache:', cleanupError);
      }
    }

    try {
      // Fetch enrolled courses from API
      const response = await apiClient.getEnrolledCourses();
      
      console.log('🔍 API Response:', {
        success: response.success,
        hasData: !!response.data,
        dataType: typeof response.data,
        dataKeys: response.data ? Object.keys(response.data) : 'no data'
      });
      
      if (response.success && response.data) {
        // The backend returns { data: { courses: [...], pagination: {...} } }
        const courses = response.data.courses || response.data;
        console.log(`📚 Fetched ${Array.isArray(courses) ? courses.length : 'undefined'} enrolled courses from API`);
        console.log('🔍 Courses data structure:', {
          isArray: Array.isArray(courses),
          type: typeof courses,
          value: courses
        });
        
        // Ensure courses is an array before filtering
        if (!Array.isArray(courses)) {
          console.error('❌ Courses data is not an array:', courses);
          setEnrolledCourses([]);
          setError('Invalid course data received from server');
          return;
        }
        
        // Filter to only enrolled courses
        const enrolledCourses = courses.filter((course: any) => 
          course.isEnrolled === true || 
          course.enrollment || 
          course.status === 'enrolled' ||
          course.status === 'active'
        );
        
        console.log(`📚 Filtered to ${enrolledCourses.length} verified enrolled courses`);
        
        if (enrolledCourses.length > 0) {
          setEnrolledCourses(enrolledCourses);
          setError(null);
          
          // Pre-cache all enrolled courses for offline access (with delay to avoid rate limits)
          setTimeout(() => {
            preCacheEnrolledCourses(enrolledCourses);
          }, 1000);
        } else {
          setEnrolledCourses([]);
          setError('You are not enrolled in any courses yet. Browse available courses to get started!');
          console.log('ℹ️ No enrolled courses found - user needs to enroll in courses first');
        }
      } else {
        setEnrolledCourses([]);
        setError('Failed to load enrolled courses');
      }
    } catch (error: any) {
      console.error('Error loading enrolled courses:', error);
      
      // Check if it's a rate limit error
      if (error.message?.includes('rate limit') || error.status === 429) {
        setError('Rate limit exceeded. Please wait a moment and try again.');
        // Fallback to offline cache immediately for rate limit errors
        try {
          console.log('🔄 Rate limit hit, falling back to offline cache...');
          const enrolledCourses = await getEnrolledCoursesOffline();
          
          if (enrolledCourses.length > 0) {
            const verifiedEnrolledCourses = enrolledCourses.filter(course =>
              course.isEnrolled === true ||
              course.enrollment ||
              course.status === 'enrolled' ||
              course.status === 'active'
            );
            
            if (verifiedEnrolledCourses.length > 0) {
              setEnrolledCourses(verifiedEnrolledCourses);
              setError(null);
              return;
            }
          }
        } catch (offlineError) {
          console.error('Error loading offline courses:', offlineError);
        }
      }
      
      // Fallback to offline cache
      try {
        console.log('🔄 Falling back to offline cache...');
        const enrolledCourses = await getEnrolledCoursesOffline();
        
        if (enrolledCourses.length > 0) {
          // Additional filtering to ensure only enrolled courses are displayed
          const verifiedEnrolledCourses = enrolledCourses.filter(course =>
            course.isEnrolled === true ||
            course.enrollment ||
            course.status === 'enrolled' ||
            course.status === 'active'
          );
          
          console.log(`📚 Filtered to ${verifiedEnrolledCourses.length} verified enrolled courses`);
          
          if (verifiedEnrolledCourses.length > 0) {
            setEnrolledCourses(verifiedEnrolledCourses);
            setError(null);
          } else {
            setEnrolledCourses([]);
            setError('No enrolled courses found in offline cache');
          }
        } else {
          setEnrolledCourses([]);
          setError('No enrolled courses found in offline cache');
        }
      } catch (offlineError) {
        console.error('Error loading offline courses:', offlineError);
        setEnrolledCourses([]);
        setError('Failed to load courses from offline cache');
      }
    } finally {
      setIsLoading(false);
    }
  }, [user?.role, user?.id]);

  // Pre-cache all enrolled courses for offline access
  const preCacheEnrolledCourses = useCallback(async (courses: any[]) => {
    try {
      console.log('🔄 Pre-caching enrolled courses for offline access...');
      
      // Prepare courses for caching with null checks
      const validCourses = courses.filter((course: any) => course && (course.id || course._id));
      const invalidCourses = courses.filter((course: any) => !course || (!course.id && !course._id));
      
      if (invalidCourses.length > 0) {
        console.warn(`⚠️ Found ${invalidCourses.length} invalid courses (null/undefined or missing ID):`, invalidCourses);
      }
      
      const coursesForCache = validCourses.map((course: any) => ({
          ...course,
          _id: course.id || course._id,
          id: course.id || course._id,
          isEnrolled: true,
          enrollment: course.enrollment || {
            id: `enrollment_${course.id || course._id}`,
            enrolledAt: new Date().toISOString(),
            progress: course.progress?.overallProgress || 0,
            status: 'active'
          },
          offlineAccessible: true,
          lastCached: new Date().toISOString()
        }));

      // Use stable enrolled courses cache
      await cacheEnrolledCourses(user.id, coursesForCache);
      console.log(`✅ Cached ${courses.length} enrolled courses in stable cache`);

      // Also cache individual courses for backward compatibility
      await Promise.all(coursesForCache.map((course: any) => cacheCourse(course)));
      console.log(`✅ Cached ${courses.length} individual courses for compatibility`);

      // Refresh the enrolled courses cache to ensure it's clean
      const refreshResult = await refreshEnrolledCoursesCache(user.id);
      console.log(`🔄 Cache refresh result: ${refreshResult.message}`);

    } catch (cacheError: any) {
      console.warn('⚠️ Failed to pre-cache enrolled courses:', {
        error: cacheError?.message || cacheError,
        coursesCount: courses?.length || 0,
        validCoursesCount: courses?.filter((c: any) => c && (c.id || c._id))?.length || 0
      });
    }
  }, [user?.id]);

  // Load data on mount
  useEffect(() => {
    // Only load data if user is available
    if (user) {
      loadData();
    }
  }, [loadData, user]);

  // Force refresh when component becomes visible (user navigates back)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && user && !isOffline && !isOfflineMode) {
        console.log('🔄 Page became visible, refreshing enrolled courses data');
        loadData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadData, user, isOffline, isOfflineMode]);

  // Load user data on mount
  useEffect(() => {
    const loadUser = async () => {
      try {
        const userResponse = await apiClient.getCurrentUser();
        if (userResponse.success) {
          setUser(userResponse.data);
        }
      } catch (error) {
        console.error('Failed to load user data:', error);
      }
    };
    
    loadUser();
  }, []);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    
    // Don't refresh if offline
    if (isOffline || isOfflineMode) {
      console.log('🔄 Refresh disabled - offline mode');
      return;
    }
    
    // Add rate limiting - prevent refreshing too frequently
    const now = Date.now();
    const lastRefresh = (handleRefresh as any).lastRefresh || 0;
    const minInterval = 5000; // 5 seconds minimum between refreshes
    
    if (now - lastRefresh < minInterval) {
      console.log('🔄 Refresh rate limited - too soon since last refresh');
      return;
    }
    
    try {
      setIsRefreshing(true);
      (handleRefresh as any).lastRefresh = now;
      console.log('🔄 Manual refresh with progress sync...');
      
      const coursesResponse = await apiClient.getEnrolledCourses({ sync: 'true' });
      
      if (coursesResponse.success) {
        const courses = coursesResponse.data.courses || [];
        console.log('🔄 Refreshed courses with synced progress:', courses);
        setEnrolledCourses(courses);
        
        // Cache the refreshed courses (learners only)
        if (user?.role === 'learner') {
          try {
            // Mark courses as enrolled before caching with null checks
            const enrolledCoursesForCache = courses
              .filter((course: any) => course && (course._id || course.id)) // Filter out null/undefined courses
              .map((course: any) => ({
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
            
            // Use stable enrolled courses cache
            await cacheEnrolledCourses(user.id, enrolledCoursesForCache);
            console.log(`✅ Cached ${courses.length} refreshed enrolled courses in stable cache`);
            
            // Also cache individual courses for backward compatibility
            await Promise.all(enrolledCoursesForCache.map((course: any) => cacheCourse(course)));
            console.log(`✅ Cached ${courses.length} individual courses for compatibility`);
            
            // Refresh the enrolled courses cache to ensure it's clean
            const refreshResult = await refreshEnrolledCoursesCache(user.id);
            console.log(`🔄 Cache refresh result: ${refreshResult.message}`);
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
  }, [isRefreshing, isOffline, isOfflineMode, user?.role, user?.id]);

  // Refresh progress data when user returns to the page - only when online
  useEffect(() => {
    if (isOffline || isOfflineMode) {
      console.log('🔄 Visibility refresh disabled - offline mode');
      return;
    }
    
    let visibilityTimeout: NodeJS.Timeout;
    let focusTimeout: NodeJS.Timeout;
    
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Debounce visibility change events
        clearTimeout(visibilityTimeout);
        visibilityTimeout = setTimeout(() => {
          console.log('🔄 Page became visible, refreshing progress data');
          loadData();
        }, 1000); // 1 second debounce
      }
    };

    const handleFocus = () => {
      // Debounce focus events
      clearTimeout(focusTimeout);
      focusTimeout = setTimeout(() => {
        console.log('🔄 Window focused, refreshing progress data');
        loadData();
      }, 1000); // 1 second debounce
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      clearTimeout(visibilityTimeout);
      clearTimeout(focusTimeout);
    };
  }, [loadData, isOffline, isOfflineMode]);

  // Periodic progress refresh (every 60 seconds) - only when online
  useEffect(() => {
    if (isOffline || isOfflineMode) {
      console.log('🔄 Periodic refresh disabled - offline mode');
      return;
    }
    
    const interval = setInterval(() => {
      console.log('🔄 Periodic progress refresh...');
      handleRefresh();
    }, 60000); // 60 seconds (increased from 30 seconds)

    return () => clearInterval(interval);
  }, [handleRefresh, isOffline, isOfflineMode]);

  // Listen for global enrollment events - only when online
  useEffect(() => {
    if (isOffline || isOfflineMode) {
      console.log('🔄 Global enrollment events disabled - offline mode');
      return;
    }
    
    let enrollmentTimeout: NodeJS.Timeout;
    
    const handleEnrollmentEvent = () => {
      // Debounce enrollment events
      clearTimeout(enrollmentTimeout);
      enrollmentTimeout = setTimeout(() => {
        console.log('Global enrollment event detected, refreshing My Courses data');
        loadData();
      }, 2000); // 2 second debounce
    };

    const handleProgressUpdate = (event: CustomEvent) => {
      console.log('Course progress update detected:', event.detail);
      // Force immediate refresh for progress updates
      clearTimeout(enrollmentTimeout);
      enrollmentTimeout = setTimeout(() => {
        console.log('Progress update detected, refreshing My Courses data immediately');
        loadData();
      }, 500); // Shorter debounce for progress updates
    };

    // Listen for enrollment events from other components
    window.addEventListener('courseEnrollmentUpdated', handleEnrollmentEvent);
    
    // Listen for course progress updates with immediate refresh
    window.addEventListener('courseProgressUpdated', handleProgressUpdate as EventListener);

    return () => {
      window.removeEventListener('courseEnrollmentUpdated', handleEnrollmentEvent);
      window.removeEventListener('courseProgressUpdated', handleProgressUpdate as EventListener);
      clearTimeout(enrollmentTimeout);
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

  // Show loading while user is being loaded
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <LoadingSpinner size="lg" />
        <span className="ml-3 text-gray-600">Loading user data...</span>
      </div>
    );
  }

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
        <div className="max-w-md mx-auto">
          <div className="mb-6">
            <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {error.includes('not enrolled') ? 'No Courses Yet' : 'Something went wrong'}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {error}
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {error.includes('not enrolled') ? (
              <Link to="/dashboard">
                <Button className="w-full sm:w-auto">
                  <BookOpen className="w-4 h-4 mr-2" />
                  Browse Available Courses
                </Button>
              </Link>
            ) : (
              <Button onClick={loadData} variant="outline" className="w-full sm:w-auto">
                <RefreshCw className="w-4 h-4 mr-2" />
                {t('learner.tryAgain')}
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('learner.myCourses')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {t('learner.trackProgress')}
            {isOffline && (
              <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                📱 {t('learner.offline')}
              </span>
            )}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {isOffline && (
            <div className="text-sm text-yellow-600 bg-yellow-50 px-3 py-1 rounded-md border border-yellow-200">
              📱 {t('learner.limited')}
            </div>
          )}
          <Button
            onClick={handleRefresh}
            disabled={isRefreshing || isOffline}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            {t('learner.sync')}
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
                {t('learner.totalCourses')}
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
                {t('learner.inProgress')}
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
                {t('learner.completed')}
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
                {t('learner.progress')}
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
            placeholder={t('learner.searchYourCourses')}
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
            <option value="all">{t('learner.allCategories')}</option>
            <option value="in-progress">{t('learner.inProgress')}</option>
            <option value="completed">{t('learner.completed')}</option>
            <option value="not-started">{t('learner.notStarted')}</option>
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
              ? t('learner.noCoursesMatchSearch')
              : t('learner.noEnrolledCourses')
            }
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {searchTerm || statusFilter !== 'all'
              ? t('learner.tryAdjustingSearch')
              : t('learner.startLearningJourney')
            }
          </p>
          {!searchTerm && statusFilter === 'all' && (
            <Link to="/dashboard">
              <Button>
                {t('learner.browseCourses')}
              </Button>
            </Link>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCourses.map((course) => (
            <Card key={course._id} className="overflow-hidden hover:shadow-lg transition-shadow">
              {/* Course Thumbnail */}
              <div className="relative h-48 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-800 overflow-hidden">
                {course.thumbnail ? (
                  <img
                    src={course.thumbnail}
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
                
                {/* Progress Badge */}
                <div className="absolute top-3 right-3">
                  <Badge variant={course.progress >= 100 ? 'success' : 'default'}>
                    {course.progress >= 100 ? t('learner.completed') : `${Math.round(course.progress)}%`}
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
                      {t('learner.instructor')}
                    </p>
                  </div>
                </div>

                {/* Course Stats */}
                <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-4">
                  <div className="flex items-center">
                    <Clock className="h-4 w-4 mr-1" />
                    <span>{course.totalDuration ? `${Math.round(course.totalDuration / 60)}m` : t('common.na')}</span>
                  </div>
                  <div className="flex items-center">
                    <BookOpen className="h-4 w-4 mr-1" />
                    <span>{course.totalModules} {t('learner.modules')}</span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600 dark:text-gray-400">
                      {t('learner.progress')}
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
                        {t('learner.reviewCourse')}
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        {t('learner.continueLearning')}
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