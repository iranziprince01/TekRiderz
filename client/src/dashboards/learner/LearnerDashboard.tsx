import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
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
  getLearnerOfflineStatus
} from '../../offline/cacheService';
import { performOneTimeSync } from '../../offline/syncManager';
import { useAuth } from '../../contexts/AuthContext';
import OfflineStatus from '../../components/common/OfflineStatus';

const LearnerDashboard: React.FC = () => {
  const { t } = useLanguage();
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
  const loadDashboardData = useCallback(async () => {
    // Prevent multiple simultaneous requests
    if (isLoadingData) {
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
          } else {
            setError('No enrolled courses available offline. Please enroll in courses when online.');
          }
        } catch (cacheError) {
          console.error('Failed to load cached courses for dashboard:', cacheError);
          setError('Failed to load cached courses');
        }
        
        return;
      }

      // Online mode - fetch from API
      setIsOffline(false);
      console.log('🌐 Loading dashboard data from API (online mode)');
      
      const [coursesResponse, enrolledResponse] = await Promise.all([
        apiClient.getPublishedCourses(),
        apiClient.getEnrolledCourses()
      ]);

      if (coursesResponse.success) {
        const courses = coursesResponse.data.courses || [];
        setCourses(courses);
        
        // Cache all courses for offline access (learners only)
        if (authUser?.role === 'learner') {
          try {
            console.log('💾 Caching courses for offline access...');
            await Promise.all(courses.map((course: any) => cacheCourse(course)));
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
        
        // Cache enrolled courses for offline access (learners only)
        if (authUser?.role === 'learner') {
          try {
            console.log('💾 Caching enrolled courses for offline access...');
            await Promise.all(enrolledCourses.map((course: any) => cacheCourse(course)));
            console.log(`✅ Cached ${enrolledCourses.length} enrolled courses successfully`);
            
            // Cache complete learner data for offline access
            if (authUser) {
              await cacheLearnerData(authUser, enrolledCourses);
              console.log('💾 Learner data cached for offline access');
            }
          } catch (cacheError) {
            console.warn('Failed to cache some enrolled courses:', cacheError);
          }
        } else {
          console.log('🔄 Skipping enrolled course cache - user is not a learner');
        }
      }
    } catch (err: any) {
      console.error('Error loading dashboard data:', err);
      
      // If online request fails, try to load cached courses (learners only)
      if (!isOfflineMode && navigator.onLine && authUser?.role === 'learner') {
        console.log('🔄 Online request failed, trying cached courses...');
        try {
          const enrolledCourses = await getEnrolledCoursesOffline();
          if (enrolledCourses.length > 0) {
            console.log('📚 Fallback to cached enrolled courses:', enrolledCourses.length);
            setEnrolledCourses(enrolledCourses);
            setCourses([]);
            setIsOffline(true);
            setError(null);
            return;
          }
        } catch (cacheError) {
          console.error('Failed to load cached courses as fallback:', cacheError);
        }
      }
      
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setIsLoading(false);
      setIsLoadingData(false);
    }
  }, [isOfflineMode]); // Removed isLoadingData to prevent dependency loop

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

  // Listen for global enrollment events
  useEffect(() => {
    const handleEnrollmentEvent = () => {
      loadDashboardData();
    };

    // Listen for enrollment events from other components
    window.addEventListener('courseEnrollmentUpdated', handleEnrollmentEvent);
    
    // Listen for course progress updates
    window.addEventListener('courseProgressUpdated', handleEnrollmentEvent);

    return () => {
      window.removeEventListener('courseEnrollmentUpdated', handleEnrollmentEvent);
      window.removeEventListener('courseProgressUpdated', handleEnrollmentEvent);
    };
  }, []); // Empty dependency array - listeners should only be set up once

  // Calculate simple dashboard statistics
  const dashboardStats = useMemo(() => {
    const totalAvailable = courses?.length || 0;
    const totalEnrolled = enrolledCourses?.length || 0;
    const completed = enrolledCourses?.filter((course: any) => 
      course.enrollment?.status === 'completed' || 
      course.progress?.percentage >= 100
    ).length || 0;

    return {
      totalAvailable,
      totalEnrolled,
      completed
    };
  }, [courses, enrolledCourses]);

  // Filter available courses (all approved courses, showing both enrolled and non-enrolled)
  const availableCourses = useMemo(() => {
    if (!courses || !Array.isArray(courses)) {
      return [];
    }
    
    const enrolledCourseIds = new Set(
      enrolledCourses?.map((course: any) => course.id || course._id) || []
    );
    
    return courses
      .filter((course: any) => {
        const isPublished = course.status === 'published';
        const matchesSearch = !searchTerm || 
          course.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          course.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          course.instructorName?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = categoryFilter === 'all' || course.category === categoryFilter;
        const matchesLevel = levelFilter === 'all' || course.level === levelFilter;
        
        return isPublished && matchesSearch && matchesCategory && matchesLevel;
      })
      .map((course: any) => {
        // Add enrollment info to each course
        const isEnrolled = enrolledCourseIds.has(course.id || course._id);
        const enrolledCourse = enrolledCourses?.find((ec: any) => (ec.id || ec._id) === (course.id || course._id));
        
        const processedCourse = {
          ...course,
          isEnrolled,
          enrollment: enrolledCourse?.enrollment || null,
          progress: enrolledCourse?.progress || null
        };
        
        return processedCourse;
      })
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [courses, enrolledCourses, searchTerm, categoryFilter, levelFilter]);

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
          <LoadingSpinner size="lg" className="text-blue-600" />
          <p className="text-gray-600 mt-4 text-lg">
            {t('Loading your dashboard...')}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="p-8 text-center max-w-md border-gray-200">
          <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {t('Unable to load dashboard')}
          </h3>
          <p className="text-gray-600 mb-6">
            {error}
          </p>
          <Button 
            onClick={loadDashboardData}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {t('Try Again')}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-8">
        <div className="max-w-4xl">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
                            {t('Welcome back')}, {authUser?.name || t('Learner')}!
          </h1>
                      <div className="flex items-center justify-between">
              <p className="text-gray-700 text-lg">
                {t('Continue your learning journey with our latest courses')}
              </p>
              <div className="flex items-center gap-4">
                <OfflineStatus />
                {navigator.onLine && (
                  <Button
                    onClick={handleManualSync}
                    disabled={isSyncing}
                    size="sm"
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    {isSyncing ? (
                      <>
                        <LoadingSpinner size="sm" />
                        {t('Syncing...')}
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        {t('Sync')}
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-blue-100">
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <BookOpen className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">{dashboardStats.totalAvailable}</div>
                  <div className="text-sm text-gray-600">{t('Available Courses')}</div>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl p-4 shadow-sm border border-green-100">
              <div className="flex items-center gap-3">
                <div className="bg-green-100 p-2 rounded-lg">
                  <Users className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">{dashboardStats.totalEnrolled}</div>
                  <div className="text-sm text-gray-600">{t('Enrolled Courses')}</div>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl p-4 shadow-sm border border-purple-100">
              <div className="flex items-center gap-3">
                <div className="bg-purple-100 p-2 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">{dashboardStats.completed}</div>
                  <div className="text-sm text-gray-600">{t('Completed')}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <Card className="p-6 border-gray-200 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                type="text"
                placeholder={t('Search courses...')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-11 h-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-lg"
              />
            </div>
          </div>
          
          {/* Category Filter */}
          <div className="md:w-48">
            <div className="relative">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full h-12 px-4 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 appearance-none [&::-ms-expand]:hidden"
              >
                <option value="all">{t('All Categories')}</option>
                {categories.map((category: string) => (
                  <option key={category} value={category}>
                    {t(category)}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none">
                <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                className="w-full h-12 px-4 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 appearance-none [&::-ms-expand]:hidden"
              >
                <option value="all">{t('All Levels')}</option>
                {levels.map((level: string) => (
                  <option key={level} value={level}>
                    {t(level)}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none">
                <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Courses Section */}
      <div>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">{t('Available Courses')}</h2>
          <Badge variant="default" className="bg-gray-100 text-gray-700 px-3 py-1 text-sm">
            {availableCourses.length} {t('courses')}
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
          <Card className="p-12 text-center border-gray-200 shadow-sm">
            <div className="bg-gray-50 p-6 rounded-full w-24 h-24 mx-auto mb-6 flex items-center justify-center">
              <Search className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">
              {t('No courses match your search')}
            </h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              {t('Try adjusting your search terms or filters')}
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setSearchTerm('');
                setCategoryFilter('all');
                setLevelFilter('all');
              }}
              className="border-blue-200 text-blue-600 hover:bg-blue-50"
            >
              {t('Clear Search')}
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
};

export default LearnerDashboard; 