import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { apiClient, cleanInstructorName } from '../../utils/api';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { 
  Users, 
  BookOpen, 
  CheckCircle, 
  GraduationCap, 
  RefreshCw, 
  X, 
  Clock, 
  Circle, 
  Activity,
  CheckCircle2
} from 'lucide-react';

interface DashboardStats {
  overview: {
    totalUsers: number;
    totalCourses: number;
    totalEnrollments: number;
    activeUsers: number;
  };
  users: {
    total: number;
    active: number;
    inactive: number;
    suspended: number;
    admins: number;
    tutors: number;
    learners: number;
  };
  courses: {
    total: number;
    published: number;
    draft: number;
    submitted: number;
    approved: number;
    rejected: number;
    pendingApproval: number;
  };
  recent: {
    activities: Array<{
      id: string;
      type: string;
      description: string;
      user: string;
      timestamp: string;
      status: string;
      courseName?: string;
      userName?: string;
      adminAction?: boolean;
    }>;
    pendingCourses: Array<{
      id: string;
      _id?: string;
      title: string;
      instructorName: string;
      submittedAt: string;
      status: string;
    }>;
  };
}

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(false); // Changed from true to false
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Cache key for admin dashboard data
  const CACHE_KEY = 'admin-dashboard-stats';
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  // Check for cached data
  const getCachedData = () => {
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        const isExpired = Date.now() - timestamp > CACHE_DURATION;
        if (!isExpired) {
          return data;
        }
      }
    } catch (error) {
      console.warn('Failed to parse cached dashboard data:', error);
    }
    return null;
  };

  // Store data in cache
  const setCachedData = (data: DashboardStats) => {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.warn('Failed to cache dashboard data:', error);
    }
  };

  // Auto-refresh dashboard data every 5 minutes
  const autoRefresh = useAutoRefresh({
    interval: 300000,
    enabled: !loading && !error,
    onRefresh: async () => {
      await loadDashboardStats(false);
    }
  });

  useEffect(() => {
    // Try to load from cache first
    const cachedStats = getCachedData();
    if (cachedStats) {
      setStats(cachedStats);
      // Optionally refresh in background without showing loader
      loadDashboardStats(false);
    } else {
      // Only show loading if no cached data
    loadDashboardStats();
    }
  }, []);

  const loadDashboardStats = async (showLoader = true) => {
    try {
      if (showLoader && !stats) { // Only show loader if no existing data
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError('');
      
      const response = await apiClient.getAdminDashboard();
      
      if (response.success && response.data) {
        setStats(response.data);
        setCachedData(response.data); // Cache the new data
      } else {
        setError(response.error || 'Failed to load dashboard statistics');
      }
    } catch (err: any) {
      console.error('Failed to load admin dashboard stats:', err);
      setError(err.message || 'Failed to load dashboard statistics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusIcon = (status: string) => {
    const iconProps = { size: 16, className: "flex-shrink-0" };
    
    switch (status) {
      case 'completed':
      case 'approved':
        return <CheckCircle {...iconProps} className="text-green-500" />;
      case 'pending':
      case 'submitted':
        return <Clock {...iconProps} className="text-yellow-500" />;
      case 'rejected':
      case 'failed':
        return <X {...iconProps} className="text-red-500" />;
      default:
        return <Circle {...iconProps} className="text-gray-400" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert variant="error" className="mb-4">
          {error}
        </Alert>
        <Button onClick={() => loadDashboardStats()} className="flex items-center gap-2">
          <RefreshCw size={16} />
          {t('common.retry')}
        </Button>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-6">
        <Alert variant="warning">
          {t('admin.dashboard.noData')}
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('admin.dashboard.title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {t('admin.dashboard.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {refreshing && (
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <RefreshCw size={14} className="animate-spin" />
              {t('admin.dashboard.refreshing')}
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadDashboardStats(false)}
            disabled={refreshing}
          >
            <RefreshCw size={14} />
            {t('admin.dashboard.refresh')}
          </Button>
        </div>
      </div>

      {/* Quick Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div 
          className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105"
          onClick={() => navigate('/dashboard/users')}
        >
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {t('admin.dashboard.totalUsers')}
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.overview.totalUsers}
              </p>
            </div>
            <div className="bg-blue-100 dark:bg-blue-900/20 p-3 rounded-full">
                <Users className="text-blue-600 dark:text-blue-400" size={24} />
              </div>
            </div>
          </Card>
          </div>

        <div 
          className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105"
          onClick={() => navigate('/dashboard/courses')}
        >
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {t('admin.dashboard.totalCourses')}
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.overview.totalCourses}
              </p>
            </div>
              <div className="bg-blue-200 dark:bg-blue-800/30 p-3 rounded-full">
                <BookOpen className="text-blue-500 dark:text-blue-300" size={24} />
              </div>
            </div>
          </Card>
          </div>

        <div 
          className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105"
          onClick={() => navigate('/dashboard/users')}
        >
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {t('admin.dashboard.activeUsers')}
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.overview.activeUsers}
              </p>
            </div>
              <div className="bg-blue-300 dark:bg-blue-700/40 p-3 rounded-full">
                <CheckCircle className="text-blue-400 dark:text-blue-200" size={24} />
              </div>
            </div>
          </Card>
          </div>

        <div 
          className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105"
          onClick={() => navigate('/dashboard/courses')}
        >
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {t('admin.dashboard.totalEnrollments')}
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.overview.totalEnrollments}
              </p>
            </div>
              <div className="bg-blue-400 dark:bg-blue-600/50 p-3 rounded-full">
                <GraduationCap className="text-blue-300 dark:text-blue-100" size={24} />
              </div>
            </div>
          </Card>
          </div>
      </div>

      {/* Management Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Users Management Card */}
        <div 
          className="cursor-pointer transition-all duration-300 hover:shadow-lg"
          onClick={() => navigate('/dashboard/users')}
        >
          <Card className="p-6 hover:border-blue-300 dark:hover:border-blue-600">
          <div className="mb-4">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 dark:bg-blue-900/20 p-3 rounded-full">
                <Users className="text-blue-600 dark:text-blue-400" size={24} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {t('admin.dashboard.userManagement')}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('admin.dashboard.userManagementDesc')}
                </p>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">{t('admin.dashboard.admins')}:</span>
              <span className="font-semibold text-red-600 dark:text-red-400">
                {stats.users.admins}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">{t('admin.dashboard.tutors')}:</span>
              <span className="font-semibold text-purple-600 dark:text-purple-400">
                {stats.users.tutors}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">{t('admin.dashboard.learners')}:</span>
              <span className="font-semibold text-green-600 dark:text-green-400">
                {stats.users.learners}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">{t('admin.dashboard.inactive')}:</span>
              <span className="font-semibold text-gray-600 dark:text-gray-400">
                {stats.users.inactive + stats.users.suspended}
              </span>
                         </div>
           </div>
           </Card>
         </div>

         {/* Courses Management Card */}
         <div 
           className="cursor-pointer transition-all duration-300 hover:shadow-lg"
           onClick={() => navigate('/dashboard/courses')}
         >
           <Card className="p-6 hover:border-green-300 dark:hover:border-green-600">
          <div className="mb-4">
            <div className="flex items-center gap-3">
              <div className="bg-green-100 dark:bg-green-900/20 p-3 rounded-full">
                <BookOpen className="text-green-600 dark:text-green-400" size={24} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {t('admin.dashboard.courseManagement')}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('admin.dashboard.courseManagementDesc')}
                </p>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">{t('admin.dashboard.published')}:</span>
              <span className="font-semibold text-green-600 dark:text-green-400">
                {stats.courses.published}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">{t('admin.dashboard.pending')}:</span>
              <span className="font-semibold text-yellow-600 dark:text-yellow-400">
                {stats.courses.pendingApproval}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">{t('admin.dashboard.draft')}:</span>
              <span className="font-semibold text-gray-600 dark:text-gray-400">
                {stats.courses.draft}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">{t('admin.dashboard.rejected')}:</span>
              <span className="font-semibold text-red-600 dark:text-red-400">
                {stats.courses.rejected}
              </span>
            </div>
          </div>
          </Card>
        </div>
      </div>

      {/* Recent Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activities */}
        <Card className="p-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('admin.dashboard.recentActivities')}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {t('admin.dashboard.recentActivitiesDesc')}
            </p>
          </div>
          
          <div className="space-y-4">
            {stats.recent.activities.length > 0 ? (
              stats.recent.activities.map((activity) => (
                <div key={activity.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex-shrink-0">
                    {getStatusIcon(activity.status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {activity.description}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                      <span>{activity.userName || activity.user}</span>
                      {activity.adminAction && (
                        <span className="px-1.5 py-0.5 bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 rounded text-xs font-medium">
                          Admin
                        </span>
                      )}
                      {activity.courseName && (
                        <>
                          <span>•</span>
                          <span className="truncate">{activity.courseName}</span>
                        </>
                      )}
                      <span>•</span>
                      <span>{formatDate(activity.timestamp)}</span>
                    </div>
                  </div>
                  <Badge 
                    variant={
                      activity.type === 'registration' ? 'info' :
                      activity.type === 'submission' ? 'warning' :
                      activity.type === 'approval' ? 'success' :
                      activity.type === 'enrollment' ? 'info' :
                      activity.type === 'completion' ? 'success' :
                      activity.type === 'user_management' ? 'warning' :
                      'default'
                    } 
                    className={
                      activity.type === 'registration' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' :
                      activity.type === 'submission' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' :
                      activity.type === 'approval' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                      activity.type === 'enrollment' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' :
                      activity.type === 'completion' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300' :
                      activity.type === 'user_management' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' :
                      ''
                    }
                  >
                    {activity.type}
                  </Badge>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <Activity className="mx-auto text-gray-400 mb-2" size={48} />
                <p className="text-gray-600 dark:text-gray-400">
                  {t('admin.dashboard.noRecentActivities')}
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Pending Course Approvals */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('admin.dashboard.pendingCourseApprovals')}
            </h3>
            <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/courses?status=submitted')}>
              {t('admin.dashboard.viewAll')}
            </Button>
          </div>
          
          <div className="space-y-4">
            {stats.recent.pendingCourses.length > 0 ? (
              stats.recent.pendingCourses.map((course) => (
                <div key={course.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex-shrink-0">
                    <Clock className="text-yellow-500" size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {course.title}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {t('common.by')} {cleanInstructorName(course.instructorName)} • {formatDate(course.submittedAt)}
                    </p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => navigate(`/course/${course._id || course.id}`)}
                  >
                    {t('admin.dashboard.review')}
                  </Button>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <CheckCircle2 className="mx-auto text-green-400 mb-2" size={48} />
                <p className="text-gray-600 dark:text-gray-400">
                  {t('admin.dashboard.noPendingApprovals')}
                </p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard; 