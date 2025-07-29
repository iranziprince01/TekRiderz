import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useStableThemeLanguage } from '../../hooks/useStableThemeLanguage';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { 
  BookOpen, 
  Search, 
  CheckCircle,
  Clock,
  Users,
  Star,
  Filter
} from 'lucide-react';
import { apiClient } from '../../utils/api';
import EnhancedCourseCard from '../../components/course/EnhancedCourseCard';
import { 
  cacheCourse, 
  getCachedCourses, 
  getEnrolledCoursesOffline, 
  cacheLearnerData,
  getLearnerOfflineStatus,
  forceCacheAllEnrolledCourses
} from '../../offline/cacheService';
import { performOneTimeSync } from '../../offline/syncManager';
import { useAuth } from '../../contexts/AuthContext';


const LearnerDashboard: React.FC = () => {
  const { t } = useLanguage();
  // Initialize stable theme and language
  useStableThemeLanguage();
  const { user: authUser, isOfflineMode } = useAuth(); // Get user from AuthContext
  const [courses, setCourses] = useState<any[]>([]);
  const [enrolledCourses, setEnrolledCourses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');
  const [isOffline, setIsOffline] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false); // Prevent multiple simultaneous requests
  const [isSyncing, setIsSyncing] = useState(false); // Track sync status

  // Load dashboard data
  const loadDashboardData = useCallback(async (forceRefresh = false) => {
    // Prevent multiple simultaneous requests, unless it's a forced refresh for enrollment updates
    if (isLoadingData && !forceRefresh) {
      console.log('🔄 Dashboard data loading already in progress, skipping...');
      return;
    }
    
    try {
      setIsLoadingData(true);
      setIsLoading(true);
      setError(null);

      // Check if we're in offline mode and user is a learner
      if ((isOfflineMode || !navigator.onLine) && authUser?.role === 'learner') {
        console.log('🔄 Loading cached courses for dashboard (offline mode)');
        setIsOffline(true);
        
        try {
          // First, check if we have any cached courses at all
          const allCachedCourses = await getCachedCourses();
          console.log('📚 Total cached courses found:', allCachedCourses.length);
          
          if (allCachedCourses.length === 0) {
            setError('No courses available offline. Please access courses while online to enable offline viewing.');
            return;
          }
          
          // Use the new learner-specific offline function
          const enrolledCourses = await getEnrolledCoursesOffline();
          console.log('📚 Loaded enrolled courses for offline dashboard:', enrolledCourses.length);
          
          if (enrolledCourses.length > 0) {
            setEnrolledCourses(enrolledCourses);
            setCourses([]); // No available courses in offline mode
            setError(null);
            
            // Show offline status
            const offlineStatus = await getLearnerOfflineStatus();
            console.log('📱 Learner offline status:', offlineStatus);
            
            // Mark that we have cached courses
            localStorage.setItem('hasCachedCourses', 'true');
          } else {
            // If no enrolled courses but we have cached courses, show them as available
            const availableCourses = allCachedCourses.filter(course => 
              course.status === 'published' || course.status === 'approved'
            );
            
            if (availableCourses.length > 0) {
              setCourses(availableCourses);
              setEnrolledCourses([]);
              setError(null);
              console.log('📚 Showing available cached courses in offline mode:', availableCourses.length);
            } else {
              setError('No enrolled courses available offline. Please enroll in courses when online.');
            }
          }
        } catch (cacheError) {
          console.error('Failed to load cached courses for dashboard:', cacheError);
          setError('Failed to load cached courses. Please try refreshing the page.');
        }
        
        return;
      }

      // Online mode - fetch from API
      setIsOffline(false);
      console.log('🌐 Loading dashboard data from API (online mode)');
      
      const [coursesResponse, enrolledResponse] = await Promise.all([
        apiClient.getPublishedCourses({ limit: 100 }), // Increase limit to get all courses
        apiClient.getEnrolledCourses()
      ]);

      if (coursesResponse.success) {
        const courses = coursesResponse.data.courses || [];

        setCourses(courses);
        
        // Cache all courses for offline access (learners only)
        if (authUser?.role === 'learner') {
          try {
            console.log('💾 Caching courses for offline access...');
            const coursesForCache = courses.map((course: any) => ({
              ...course,
              offlineAccessible: true,
              lastCached: new Date().toISOString()
            }));
            await Promise.all(coursesForCache.map((course: any) => cacheCourse(course)));
            console.log(`✅ Cached ${courses.length} courses successfully`);
          } catch (cacheError) {
            console.warn('Failed to cache some courses:', cacheError);
          }
        } else {
          console.log('🔄 Skipping course cache - user is not a learner');
        }
      }

      if (enrolledResponse.success) {
        const enrolledCourses = enrolledResponse.data.courses || [];
        setEnrolledCourses(enrolledCourses);
        
        // Merge enrollment data with courses for Dashboard display
        if (coursesResponse.success) {
          const courses = coursesResponse.data.courses || [];
          const coursesWithEnrollment = courses.map((course: any) => {
            // Find matching enrolled course
            const enrolledCourse = enrolledCourses.find((enrolled: any) => 
              (enrolled.id || enrolled._id) === (course.id || course._id)
            );
            
            if (enrolledCourse) {
              console.log('🔄 Found enrolled course for Dashboard:', {
                courseId: course.id || course._id,
                courseTitle: course.title,
                enrollmentStatus: enrolledCourse.enrollment?.status,
                progress: enrolledCourse.progress?.overallProgress
              });
              
              return {
                ...course,
                isEnrolled: true,
                enrollment: enrolledCourse.enrollment,
                progress: enrolledCourse.progress
              };
            }
            
            return course;
          });
          
          setCourses(coursesWithEnrollment);
          console.log('🔄 Merged enrollment data with courses for Dashboard display');
        }
        
        // Cache enrolled courses for offline access (learners only)
        if (authUser?.role === 'learner') {
          try {
            console.log('💾 Caching enrolled courses for offline access...');
            // Mark courses as enrolled before caching with null checks
            const enrolledCoursesForCache = enrolledCourses
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
              offlineAccessible: true,
              lastCached: new Date().toISOString()
            }));

            // Use stable enrolled courses cache
            await cacheLearnerData(authUser, enrolledCoursesForCache);
            console.log(`✅ Cached ${enrolledCourses.length} enrolled courses in stable cache`);

            // Also cache individual courses for backward compatibility
            await Promise.all(enrolledCoursesForCache.map((course: any) => cacheCourse(course)));
            console.log(`✅ Cached ${enrolledCourses.length} individual courses for compatibility`);

          } catch (cacheError: any) {
            console.warn('⚠️ Failed to pre-cache enrolled courses:', {
              error: cacheError?.message || cacheError,
              coursesCount: enrolledCourses?.length || 0,
              validCoursesCount: enrolledCourses?.filter((c: any) => c && (c.id || c._id))?.length || 0
            });
          }
        }
      }

      // Handle errors
      if (!coursesResponse.success) {
        console.error('Failed to fetch courses:', coursesResponse.error);
        setError(coursesResponse.error || 'Failed to load courses');
      }

      if (!enrolledResponse.success) {
        console.error('Failed to fetch enrolled courses:', enrolledResponse.error);
        // Don't set error for enrolled courses failure as it's not critical
      }

    } catch (error: any) {
      console.error('Error loading dashboard data:', error);
      setError(error.message || 'Failed to load dashboard data');
    } finally {
      setIsLoading(false);
      setIsLoadingData(false);
    }
  }, [authUser, isOfflineMode]);

  // Specific function for enrollment updates that forces refresh
  const handleEnrollmentUpdate = useCallback(async (courseId: string) => {
    console.log('🔄 Enrollment update detected for course:', courseId);
    
    // Force refresh enrollment data
    try {
      setIsLoadingData(true);
      
      // Fetch fresh enrollment data
      const enrolledResponse = await apiClient.getEnrolledCourses();
      
      if (enrolledResponse.success) {
        const enrolledCourses = enrolledResponse.data.courses || [];
        setEnrolledCourses(enrolledCourses);
        
        // Update the courses state with fresh enrollment data
        setCourses(prevCourses => {
          return prevCourses.map((course: any) => {
            const enrolledCourse = enrolledCourses.find((enrolled: any) => 
              (enrolled.id || enrolled._id) === (course.id || course._id)
            );
            
            if (enrolledCourse) {
              console.log('🔄 Updated enrollment data for course:', {
                courseId: course.id || course._id,
                courseTitle: course.title,
                enrollmentStatus: enrolledCourse.enrollment?.status,
                progress: enrolledCourse.progress?.overallProgress
              });
              
              return {
                ...course,
                isEnrolled: true,
                enrollment: enrolledCourse.enrollment,
                progress: enrolledCourse.progress
              };
            }
            
            return course;
          });
        });
        
        console.log('🔄 Enrollment data refreshed successfully');
      }
    } catch (error) {
      console.error('Failed to refresh enrollment data:', error);
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  // Handle enrollment change - update local state immediately
  const handleEnrollmentChange = useCallback((updatedCourse?: any) => {
    if (updatedCourse) {
      // Update the enrolled courses list immediately
      setEnrolledCourses(prev => {
        const existing = prev.find(c => (c.id || c._id) === (updatedCourse.id || updatedCourse._id));
        if (existing) {
          return prev.map(c => (c.id || c._id) === (updatedCourse.id || updatedCourse._id) ? updatedCourse : c);
        } else {
          return [...prev, updatedCourse];
        }
      });
      
      // Update the available courses list to reflect enrollment
      setCourses(prev => 
        prev.map(c => (c.id || c._id) === (updatedCourse.id || updatedCourse._id) ? updatedCourse : c)
      );
    }
  }, []);

  // Manual sync function
  const handleManualSync = async () => {
    if (isSyncing || !navigator.onLine) {
      return;
    }

    try {
      setIsSyncing(true);
      console.log('🔄 Manual sync initiated...');
      await performOneTimeSync();
      console.log('✅ Manual sync completed');
      
      // Reload dashboard data after sync
      await loadDashboardData();
    } catch (error) {
      console.error('❌ Manual sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  // Load data on mount with debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadDashboardData();
    }, 500); // Increased delay to prevent rapid successive calls
    
    return () => clearTimeout(timeoutId);
  }, []); // Empty dependency array - only run once on mount

  // Proactive caching: Cache all enrolled courses when user is online
  useEffect(() => {
    const cacheAllEnrolledCourses = async () => {
      if (authUser?.role === 'learner' && navigator.onLine && !isOfflineMode) {
        try {
          console.log('🔄 Proactive caching: Caching all enrolled courses for offline access...');
          const result = await forceCacheAllEnrolledCourses(authUser);
          if (result.success) {
            console.log('✅ Proactive caching completed:', result.message);
          } else {
            console.warn('⚠️ Proactive caching failed:', result.message);
          }
        } catch (error) {
          console.warn('⚠️ Proactive caching error:', error);
        }
      }
    };

    // Cache courses after a short delay to avoid blocking the UI
    const timeoutId = setTimeout(cacheAllEnrolledCourses, 3000);
    
    return () => clearTimeout(timeoutId);
  }, [authUser, isOfflineMode]);

  // Listen for global enrollment events
  useEffect(() => {
    const handleEnrollmentEvent = (event: CustomEvent) => {
      const courseId = event.detail?.courseId;
      if (courseId) {
        handleEnrollmentUpdate(courseId);
      } else {
        // Fallback to full refresh if no courseId provided
        loadDashboardData(true);
      }
    };

    // Listen for enrollment events from other components
    window.addEventListener('courseEnrollmentUpdated', handleEnrollmentEvent as EventListener);
    
    // Listen for course progress updates
    window.addEventListener('courseProgressUpdated', handleEnrollmentEvent as EventListener);

    return () => {
      window.removeEventListener('courseEnrollmentUpdated', handleEnrollmentEvent as EventListener);
      window.removeEventListener('courseProgressUpdated', handleEnrollmentEvent as EventListener);
    };
  }, [handleEnrollmentUpdate, loadDashboardData]); // Include dependencies

  // Calculate simple dashboard statistics
  const dashboardStats = useMemo(() => {
    const totalAvailable = courses?.length || 0;
    const totalEnrolled = courses?.filter((course: any) => course.isEnrolled || course.enrollment).length || 0;
    const completed = courses?.filter((course: any) => 
      (course.isEnrolled || course.enrollment) && 
      (course.enrollment?.status === 'completed' || 
       course.progress?.percentage >= 100 ||
       course.progress?.overallProgress >= 100)
    ).length || 0;

    return {
      totalAvailable,
      totalEnrolled,
      completed
    };
  }, [courses]);

  // Filter available courses (all published/approved courses with enrollment status)
  const availableCourses = useMemo(() => {
    if (!courses || !Array.isArray(courses)) {
      return [];
    }

    return courses
      .filter((course: any) => {
        const isAvailable = course.status === 'published' || course.status === 'approved';
        const matchesSearch = !searchTerm || 
          course.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          course.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          course.instructorName?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = categoryFilter === 'all' || course.category === categoryFilter;
        const matchesLevel = levelFilter === 'all' || course.level === levelFilter;
        return isAvailable && matchesSearch && matchesCategory && matchesLevel;
      })
      .map((course: any) => {
        // The backend already provides enrollment status in the course object
        // Use the enrollment data directly from the course object
        const isEnrolled = course.isEnrolled || course.enrollment;
        const enrollment = course.enrollment || null;
        const progress = course.progress || enrollment?.progress || 0;
        
        // Debug: Log specific course enrollment check
        if (course.title === 'Intro to AI') {
          console.log('🔍 Intro to AI enrollment check:', {
            courseId: course.id || course._id,
            isEnrolled,
            enrollment,
            progress,
            courseIsEnrolled: course.isEnrolled,
            courseEnrollment: course.enrollment
          });
        }
        
        const processedCourse = {
          ...course,
          isEnrolled,
          enrollment,
          progress
        };
        
        return processedCourse;
      })
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());


  }, [courses, searchTerm, categoryFilter, levelFilter]);

  // Get unique categories and levels for filtering
  const { categories, levels } = useMemo(() => {
    if (!courses) return { categories: [], levels: [] };
    
    const uniqueCategories = [...new Set(courses.map((course: any) => course.category))].filter(Boolean);
    const uniqueLevels = [...new Set(courses.map((course: any) => course.level))].filter(Boolean);
    
    return { categories: uniqueCategories, levels: uniqueLevels };
  }, [courses]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="text-center">
          <LoadingSpinner size="lg" className="text-blue-600 dark:text-blue-400" />
          <p className="text-gray-600 dark:text-gray-400 mt-4 text-lg">
            {t('learner.loadingDashboard')}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="p-8 text-center max-w-md border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <BookOpen className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {t('learner.unableToLoad')}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {error}
          </p>
          <Button 
            onClick={() => loadDashboardData()}
            className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white"
          >
            {t('learner.tryAgain')}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900 border border-blue-200 dark:border-gray-700 rounded-2xl p-8">
        <div className="max-w-4xl">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {t('learner.welcomeBack')}, {authUser?.name || t('auth.learner')}!
          </h1>
          <div className="flex items-center justify-between">
            <p className="text-gray-700 dark:text-gray-300 text-lg">
              {t('learner.continueJourney')}
            </p>
            <div className="flex items-center gap-4">

              {navigator.onLine && (
                <Button
                  onClick={handleManualSync}
                  disabled={isSyncing}
                  size="sm"
                  variant="outline"
                  className="flex items-center gap-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  {isSyncing ? (
                    <>
                      <LoadingSpinner size="sm" />
                      {t('learner.syncing')}
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      {t('learner.sync')}
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
          
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-blue-100 dark:border-blue-900">
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded-lg">
                  <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{dashboardStats.totalAvailable}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">{t('learner.availableCourses')}</div>
                </div>
              </div>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-green-100 dark:border-green-900">
              <div className="flex items-center gap-3">
                <div className="bg-green-100 dark:bg-green-900 p-2 rounded-lg">
                  <Users className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{dashboardStats.totalEnrolled}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">{t('learner.enrolledCourses')}</div>
                </div>
              </div>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-purple-100 dark:border-purple-900">
              <div className="flex items-center gap-3">
                <div className="bg-purple-100 dark:bg-purple-900 p-2 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{dashboardStats.completed}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">{t('learner.completed')}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <Card className="p-6 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
              <Input
                type="text"
                placeholder={t('learner.searchCourses')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-11 h-12 border-gray-300 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>
          </div>
          
          {/* Category Filter */}
          <div className="md:w-48">
            <div className="relative">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full h-12 px-4 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white appearance-none [&::-ms-expand]:hidden"
              >
                <option value="all">{t('learner.allCategories')}</option>
                {categories.map((category: string) => (
                  <option key={category} value={category}>
                    {t(category)}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none">
                <svg className="h-4 w-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
          
          {/* Level Filter */}
          <div className="md:w-48">
            <div className="relative">
              <select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
                className="w-full h-12 px-4 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white appearance-none [&::-ms-expand]:hidden"
              >
                <option value="all">{t('learner.allLevels')}</option>
                {levels.map((level: string) => (
                  <option key={level} value={level}>
                    {t(level)}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none">
                <svg className="h-4 w-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* All Courses Section */}
      <div>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t('learner.allCourses')}</h2>
          <Badge variant="default" className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-3 py-1 text-sm">
            {availableCourses.length} {t('learner.courses')}
          </Badge>
        </div>

        {availableCourses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {availableCourses.map((course: any) => (
              <EnhancedCourseCard
                key={course.id || course._id}
                course={course}
                onEnrollmentChange={handleEnrollmentChange}
                onDataRefresh={loadDashboardData}
              />
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
            <div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-full w-24 h-24 mx-auto mb-6 flex items-center justify-center">
              <Search className="w-12 h-12 text-gray-400 dark:text-gray-500" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              {t('learner.noCoursesFound')}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
              {searchTerm || categoryFilter !== 'all' || levelFilter !== 'all' 
                ? t('learner.tryAdjustingSearch') 
                : t('learner.noCoursesAvailable')}
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setSearchTerm('');
                setCategoryFilter('all');
                setLevelFilter('all');
              }}
              className="border-blue-200 dark:border-blue-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
            >
              {t('learner.clearSearch')}
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
};

export default LearnerDashboard; 