import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
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
  WifiOff,
  RotateCcw
} from 'lucide-react';
import { useComprehensiveDashboardData } from '../../hooks/useComprehensiveDashboardData';
import { apiClient, getFileUrl } from '../../utils/api';

const LearnerCourses: React.FC = () => {
  const { t } = useLanguage();
  const { isOnline } = useNetworkStatus();
  const {
    user,
    enrolledCourses,
    isLoading,
    error,
    refreshData
  } = useComprehensiveDashboardData();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error' | 'success'>('idle');

  // Auto-refresh progress data when component mounts and periodically
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      if (isOnline && !isLoading) {
        handleProgressRefresh();
      }
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(refreshInterval);
  }, [isOnline, isLoading]);

  // Listen for storage events to refresh when returning from course pages
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'courseProgressUpdated') {
        handleProgressRefresh();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Also listen for focus events (when user returns to tab)
    const handleFocus = () => {
      if (isOnline) {
        handleProgressRefresh();
      }
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [isOnline]);

  // Enhanced progress refresh with sync status
  const handleProgressRefresh = useCallback(async () => {
    if (isRefreshing || !isOnline) return;

    try {
      setIsRefreshing(true);
      setSyncStatus('syncing');
      
      await refreshData();
      
      setSyncStatus('success');
      setLastSyncTime(new Date());
      
      // Clear success status after 2 seconds
      setTimeout(() => setSyncStatus('idle'), 2000);
      
    } catch (error) {
      console.error('Failed to refresh progress:', error);
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 3000);
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, isOnline, refreshData]);

  // Sync individual course progress
  const syncCourseProgress = useCallback(async (courseId: string) => {
    if (!isOnline) return null;

    try {
      const response = await apiClient.getUserCourseProgress(courseId);
      if (response.success) {
        return response.data.progress;
      }
      return null;
    } catch (error) {
      console.error('Failed to sync course progress:', error);
      return null;
    }
  }, [isOnline]);

  // Process enrolled courses with enhanced progress data and real-time sync
  const processedCourses = useMemo(() => {
    if (!enrolledCourses) return [];
    
    return enrolledCourses.map((course: any) => {
      // Get progress from multiple sources for accuracy
      const enrollmentProgress = course.enrollment?.progress || 0;
      const courseProgress = course.progress || {};
      const directProgress = course.progressPercentage || 0;
      
      // Use the highest progress value from available sources
      const progressPercentage = Math.max(
        enrollmentProgress,
        directProgress,
        courseProgress.percentage || 0
      );
      
      // Calculate lesson-based progress if available
      const totalLessons = course.totalLessons || 
        course.sections?.reduce((total: number, section: any) => 
        total + (section.lessons?.length || 0), 0) || 0;
      
      const completedLessons = courseProgress?.completedLessons?.length || 
        Math.floor((progressPercentage / 100) * totalLessons);
      
      // Determine status based on progress
      let status = 'not_started';
      if (progressPercentage >= 100) {
        status = 'completed';
      } else if (progressPercentage > 0) {
        status = 'in_progress';
      }
      
      // Enhanced time tracking
      const timeSpentMinutes = courseProgress?.timeSpent || 
        course.enrollment?.timeSpent || 0;
      const timeSpentFormatted = timeSpentMinutes > 60 
        ? `${Math.floor(timeSpentMinutes / 60)}h ${timeSpentMinutes % 60}m`
        : `${timeSpentMinutes}m`;
      
      return {
        ...course,
        progress: {
          percentage: Math.round(progressPercentage),
          completedLessons,
          totalLessons,
          timeSpent: timeSpentMinutes,
          timeSpentFormatted,
          lastWatched: courseProgress?.lastWatched || course.enrollment?.lastAccessedAt,
          currentLesson: courseProgress?.currentLesson,
          lastSynced: courseProgress?.lastSynced || course.enrollment?.updatedAt
        },
        status,
        enrollmentDate: course.enrollment?.enrolledAt || course.enrolledAt,
        enrollmentId: course.enrollment?.id || course.enrollmentId
      };
    });
  }, [enrolledCourses]);

  // Update course progress in CouchDB
  const updateCourseProgress = useCallback(async (courseId: string, progress: number) => {
    if (!isOnline) return;

    try {
      await apiClient.updateCourseProgress(courseId, { progress });
      localStorage.setItem('courseProgressUpdated', Date.now().toString());
    } catch (error) {
      console.error('Failed to update course progress:', error);
    }
  }, [isOnline]);

  // Offline progress persistence
  const saveProgressOffline = useCallback((courseId: string, progressData: any) => {
    try {
      const offlineProgress = JSON.parse(localStorage.getItem('offlineProgress') || '{}');
      offlineProgress[courseId] = {
        ...progressData,
        timestamp: Date.now(),
        needsSync: true
      };
      localStorage.setItem('offlineProgress', JSON.stringify(offlineProgress));
    } catch (error) {
      console.error('Failed to save progress offline:', error);
    }
  }, []);

  // Sync offline progress when back online
  useEffect(() => {
    const syncOfflineProgress = async () => {
      if (!isOnline) return;

      try {
        const offlineProgress = JSON.parse(localStorage.getItem('offlineProgress') || '{}');
        const coursesToSync = Object.keys(offlineProgress).filter(
          courseId => offlineProgress[courseId].needsSync
        );

        if (coursesToSync.length === 0) return;

        setSyncStatus('syncing');
        
        for (const courseId of coursesToSync) {
          try {
            await apiClient.updateCourseProgress(courseId, offlineProgress[courseId]);
            offlineProgress[courseId].needsSync = false;
          } catch (error) {
            console.warn(`Failed to sync progress for course ${courseId}:`, error);
          }
        }

        localStorage.setItem('offlineProgress', JSON.stringify(offlineProgress));
        setSyncStatus('success');
        setTimeout(() => setSyncStatus('idle'), 2000);
        
        // Refresh data to show updated progress
        await refreshData();
        
      } catch (error) {
        console.error('Failed to sync offline progress:', error);
        setSyncStatus('error');
        setTimeout(() => setSyncStatus('idle'), 3000);
      }
    };

    if (isOnline) {
      syncOfflineProgress();
    }
  }, [isOnline, refreshData]);

  // Filter courses based on search and status
  const filteredCourses = useMemo(() => {
    return processedCourses.filter((course: any) => {
      const matchesSearch = !searchTerm || 
        course.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.instructorName?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || course.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [processedCourses, searchTerm, statusFilter]);

  // Enhanced summary statistics
  const summaryStats = useMemo(() => {
    const totalCourses = processedCourses.length;
    const completedCourses = processedCourses.filter((course: any) => course.status === 'completed').length;
    const inProgressCourses = processedCourses.filter((course: any) => course.status === 'in_progress').length;
    const totalTimeSpent = processedCourses.reduce((total, course) => total + (course.progress?.timeSpent || 0), 0);
    
    return {
      totalCourses,
      completedCourses,
      inProgressCourses,
      totalTimeSpent
    };
  }, [processedCourses]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="text-center">
          <LoadingSpinner size="lg" className="text-blue-600" />
          <p className="text-gray-600 mt-4 text-lg">
            {t('Loading your courses...')}
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
            {t('Unable to load your courses')}
          </h3>
          <p className="text-gray-600 mb-6">
            {error}
          </p>
          <Button 
            onClick={refreshData}
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
      {/* Header Section - Clean and Motivational */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-8">
        <div className="max-w-4xl">
          <div className="flex items-center justify-between mb-4">
      <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {t('My Learning Journey')}
        </h1>
              <p className="text-gray-700 text-lg">
                {summaryStats.totalCourses > 0 
                  ? t('Track your progress and continue learning at your own pace')
                  : t('Start your learning journey by enrolling in courses')
                }
        </p>
      </div>

            {/* Sync Status and Controls */}
            <div className="flex items-center gap-3">
              {!isOnline && (
                <div className="flex items-center gap-2 text-orange-600 bg-orange-50 px-3 py-2 rounded-lg border border-orange-200">
                  <WifiOff className="w-4 h-4" />
                  <span className="text-sm font-medium">{t('Offline')}</span>
                </div>
              )}
              
              {syncStatus === 'syncing' && (
                <div className="flex items-center gap-2 text-blue-600 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200">
                  <RotateCcw className="w-4 h-4 animate-spin" />
                  <span className="text-sm font-medium">{t('Syncing...')}</span>
                </div>
              )}
              
              {syncStatus === 'success' && (
                <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-2 rounded-lg border border-green-200">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">{t('Synced')}</span>
                </div>
              )}
              
              {syncStatus === 'error' && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-200">
                  <RefreshCw className="w-4 h-4" />
                  <span className="text-sm font-medium">{t('Sync Failed')}</span>
            </div>
              )}
              
              <Button
                onClick={handleProgressRefresh}
                disabled={isRefreshing || !isOnline}
                variant="outline"
                size="sm"
                className="border-blue-200 text-blue-600 hover:bg-blue-50"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                {t('Refresh')}
              </Button>
            </div>
          </div>
          
          {/* Last Sync Time */}
          {lastSyncTime && (
            <div className="text-sm text-gray-500 mb-6">
              {t('Last synced')}: {lastSyncTime.toLocaleTimeString()}
            </div>
          )}
          
          {/* Learning Statistics - Enhanced */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-blue-100">
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <BookOpen className="w-5 h-5 text-blue-600" />
                </div>
            <div>
                  <div className="text-2xl font-bold text-gray-900">{summaryStats.totalCourses}</div>
                  <div className="text-sm text-gray-600">{t('Enrolled Courses')}</div>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl p-4 shadow-sm border border-green-100">
              <div className="flex items-center gap-3">
                <div className="bg-green-100 p-2 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">{summaryStats.completedCourses}</div>
                  <div className="text-sm text-gray-600">{t('Completed')}</div>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl p-4 shadow-sm border border-orange-100">
              <div className="flex items-center gap-3">
                <div className="bg-orange-100 p-2 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-orange-600" />
          </div>
            <div>
                  <div className="text-2xl font-bold text-gray-900">{summaryStats.inProgressCourses}</div>
                  <div className="text-sm text-gray-600">{t('In Progress')}</div>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl p-4 shadow-sm border border-purple-100">
              <div className="flex items-center gap-3">
                <div className="bg-purple-100 p-2 rounded-lg">
                  <Clock className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">
                    {summaryStats.totalTimeSpent > 60 
                      ? `${Math.floor(summaryStats.totalTimeSpent / 60)}h`
                      : `${summaryStats.totalTimeSpent}m`
                    }
                  </div>
                  <div className="text-sm text-gray-600">{t('Time Spent')}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter Section */}
      {summaryStats.totalCourses > 0 && (
        <Card className="p-6 border-gray-200 shadow-sm">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <Input
            type="text"
            placeholder={t('Search your courses...')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-11 h-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-lg"
          />
        </div>
      </div>

            {/* Status Filter */}
            <div className="md:w-56">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full h-12 px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
              >
                <option value="all">{t('All Courses')}</option>
                <option value="in_progress">{t('In Progress')}</option>
                <option value="completed">{t('Completed')}</option>
                <option value="not_started">{t('Not Started')}</option>
              </select>
            </div>
          </div>
        </Card>
      )}

      {/* Courses Section */}
      <div>
        {summaryStats.totalCourses > 0 && (
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">{t('Your Courses')}</h2>
            <Badge variant="default" className="bg-gray-100 text-gray-700 px-3 py-1 text-sm">
              {filteredCourses.length} {t('of')} {summaryStats.totalCourses} {t('courses')}
          </Badge>
        </div>
        )}

        {filteredCourses.length > 0 ? (
          <div className="space-y-6">
            {filteredCourses.map((course: any) => (
              <Card key={course.id || course._id} className="border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
                <div className="p-6">
                <div className="flex flex-col lg:flex-row gap-6">
                  {/* Course Thumbnail */}
                    <div className="lg:w-48 lg:h-32 w-full h-48 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0">
                    {course.thumbnail ? (
                      <img 
                        src={getFileUrl(course.thumbnail, 'thumbnail')} 
                        alt={course.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <BookOpen className="w-8 h-8 text-gray-400" />
                      </div>
                    )}
                  </div>

                  {/* Course Details */}
                  <div className="flex-1 min-w-0">
                      <div className="flex flex-col gap-4">
                        {/* Header */}
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          {course.category && (
                                <Badge variant="default" className="text-xs bg-gray-100 text-gray-700">
                              {t(course.category)}
                            </Badge>
                          )}
                          {course.status === 'completed' && (
                                <Badge variant="success" className="text-xs bg-green-100 text-green-800">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                              {t('Completed')}
                            </Badge>
                          )}
                          {course.status === 'in_progress' && (
                                <Badge variant="info" className="text-xs bg-blue-100 text-blue-800">
                                  <TrendingUp className="w-3 h-3 mr-1" />
                              {t('In Progress')}
                            </Badge>
                          )}
                              {course.status === 'not_started' && (
                                <Badge variant="default" className="text-xs bg-gray-100 text-gray-600">
                                  <Target className="w-3 h-3 mr-1" />
                              {t('Not Started')}
                            </Badge>
                          )}
                        </div>
                        
                            <h3 className="font-bold text-xl text-gray-900 mb-2 line-clamp-2">
                          {course.title}
                        </h3>
                        
                        <p className="text-gray-600 text-sm mb-3 line-clamp-2 leading-relaxed">
                          {course.description}
                        </p>
                        
                            {/* Instructor */}
                        {course.instructorName && (
                          <div className="flex items-center gap-2 mb-4">
                                <Avatar name={course.instructorName} />
                            <span className="text-sm text-gray-600">
                              {t('by')} {course.instructorName}
                            </span>
                          </div>
                        )}
                      </div>

                          {/* Progress Circle and Action */}
                      <div className="flex flex-col sm:items-end gap-3">
                            <div className="text-center sm:text-right">
                              <div className="text-3xl font-bold text-blue-600 mb-1">
                            {course.progress.percentage}%
                          </div>
                          <div className="text-xs text-gray-500">
                            {course.progress.completedLessons}/{course.progress.totalLessons} {t('lessons')}
                          </div>
                              {course.progress.timeSpent > 0 && (
                                <div className="text-xs text-gray-500 mt-1">
                                  {course.progress.timeSpentFormatted} {t('spent')}
                                </div>
                              )}
                              
                              {/* Progress Sync Indicator */}
                              {course.progress.lastSynced && (
                                <div className="text-xs text-green-600 mt-1 flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3" />
                                  {t('Progress saved')}
                                </div>
                              )}
                        </div>
                        
                        <Link to={`/course/${course.id || course._id}`}>
                              <Button 
                                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2"
                                onClick={() => {
                                  // Trigger progress sync when navigating to course
                                  syncCourseProgress(course.id || course._id);
                                  // Set flag for progress update detection
                                  localStorage.setItem('lastCourseAccessed', course.id || course._id);
                                }}
                              >
                            {course.status === 'completed' ? (
                              <>
                                <Award className="w-4 h-4 mr-2" />
                                {t('Review')}
                              </>
                                ) : course.status === 'in_progress' ? (
                              <>
                                <Play className="w-4 h-4 mr-2" />
                                {t('Continue')}
                              </>
                                ) : (
                                  <>
                                    <Play className="w-4 h-4 mr-2" />
                                    {t('Start Learning')}
                              </>
                            )}
                          </Button>
                        </Link>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-2">
                          <div className="w-full bg-gray-200 rounded-full h-3">
                        <div 
                              className={`h-3 rounded-full transition-all duration-500 ${
                            course.status === 'completed' ? 'bg-green-500' : 'bg-blue-500'
                          }`}
                          style={{ width: `${course.progress.percentage}%` }}
                        />
                      </div>
                          
                          {/* Additional Progress Info */}
                          <div className="flex justify-between items-center text-xs text-gray-500">
                            <span>
                              {course.progress.percentage === 0 
                                ? t('Ready to start')
                                : course.status === 'completed'
                                ? t('Course completed!')
                                : t('Keep going!')
                              }
                            </span>
                            <div className="flex items-center gap-2">
                              {course.enrollmentDate && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {t('Enrolled')} {new Date(course.enrollmentDate).toLocaleDateString()}
                                </span>
                              )}
                              {course.progress.lastSynced && (
                                <span className="flex items-center gap-1 text-green-600" title={t('Progress synced with database')}>
                                  <CheckCircle className="w-3 h-3" />
                                  {t('Synced')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : summaryStats.totalCourses === 0 ? (
          // No enrolled courses
          <Card className="p-12 text-center border-gray-200 shadow-sm">
            <div className="bg-blue-50 p-6 rounded-full w-24 h-24 mx-auto mb-6 flex items-center justify-center">
              <BookOpen className="w-12 h-12 text-blue-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">
              {t('Start Your Learning Journey')}
            </h3>
            <p className="text-gray-600 mb-8 max-w-md mx-auto leading-relaxed">
              {t('You haven\'t enrolled in any courses yet. Explore our course catalog and start learning today!')}
            </p>
            <Link to="/dashboard">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3">
                <BookOpen className="w-5 h-5 mr-2" />
                {t('Browse Courses')}
              </Button>
            </Link>
          </Card>
        ) : (
          // No courses match filter
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
                setStatusFilter('all');
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

export default LearnerCourses; 