import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { 
  Users, 
  BookOpen, 
  TrendingUp, 
  Activity,
  UserCheck,
  GraduationCap,
  Eye,
  Calendar,
  Clock,
  Star,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { apiClient } from '../../utils/api';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';

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
    }>;
    pendingCourses: Array<{
      id: string;
      title: string;
      instructorName: string;
      submittedAt: string;
      status: string;
    }>;
  };
}

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Auto-refresh dashboard data every 5 minutes
  const autoRefresh = useAutoRefresh({
    interval: 300000,
    enabled: !loading && !error,
    onRefresh: async () => {
      await loadDashboardStats(false);
    }
  });

  useEffect(() => {
    loadDashboardStats();
  }, []);

  const loadDashboardStats = async (showLoader = true) => {
    try {
      if (showLoader) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError('');
      
      const response = await apiClient.getAdminDashboard();
      
      if (response.success && response.data) {
        setStats(response.data);
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
    switch (status) {
      case 'completed':
      case 'approved':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'pending':
      case 'submitted':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'rejected':
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-gray-500" />;
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
          <RefreshCw className="w-4 h-4" />
          Retry
        </Button>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-6">
        <Alert variant="warning">
          No dashboard data available
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
            Admin Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Overview of platform statistics and recent activities
          </p>
        </div>
        <div className="flex items-center gap-4">
          {refreshing && (
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Refreshing...
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadDashboardStats(false)}
            disabled={refreshing}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Quick Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Users
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.overview.totalUsers}
              </p>
            </div>
            <div className="bg-blue-100 dark:bg-blue-900/20 p-3 rounded-full">
              <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Courses
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.overview.totalCourses}
              </p>
            </div>
            <div className="bg-green-100 dark:bg-green-900/20 p-3 rounded-full">
              <BookOpen className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Active Users
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.overview.activeUsers}
              </p>
            </div>
            <div className="bg-purple-100 dark:bg-purple-900/20 p-3 rounded-full">
              <UserCheck className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Enrollments
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.overview.totalEnrollments}
              </p>
            </div>
            <div className="bg-orange-100 dark:bg-orange-900/20 p-3 rounded-full">
              <GraduationCap className="h-6 w-6 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
        </Card>
      </div>

      {/* Management Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Users Management Card */}
        <div 
          className="cursor-pointer transition-all duration-300 hover:shadow-lg"
          onClick={() => navigate('/dashboard/users')}
        >
          <Card className="p-6 hover:border-blue-300 dark:hover:border-blue-600">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 dark:bg-blue-900/20 p-3 rounded-full">
                <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  User Management
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Manage user accounts and permissions
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm">
              <Eye className="w-4 h-4 mr-2" />
              View All
            </Button>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">Admins:</span>
              <span className="font-semibold text-red-600 dark:text-red-400">
                {stats.users.admins}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">Tutors:</span>
              <span className="font-semibold text-purple-600 dark:text-purple-400">
                {stats.users.tutors}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">Learners:</span>
              <span className="font-semibold text-green-600 dark:text-green-400">
                {stats.users.learners}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">Inactive:</span>
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
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="bg-green-100 dark:bg-green-900/20 p-3 rounded-full">
                <BookOpen className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Course Management
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Review and manage course content
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm">
              <Eye className="w-4 h-4 mr-2" />
              View All
            </Button>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">Published:</span>
              <span className="font-semibold text-green-600 dark:text-green-400">
                {stats.courses.published}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">Pending:</span>
              <span className="font-semibold text-yellow-600 dark:text-yellow-400">
                {stats.courses.pendingApproval}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">Draft:</span>
              <span className="font-semibold text-gray-600 dark:text-gray-400">
                {stats.courses.draft}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">Rejected:</span>
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
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Recent Activities
            </h3>
            <Button variant="ghost" size="sm">
              <Eye className="w-4 h-4 mr-2" />
              View All
            </Button>
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
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {formatDate(activity.timestamp)}
                    </p>
                  </div>
                  <Badge variant="default" className="flex-shrink-0">
                    {activity.type}
                  </Badge>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">
                  No recent activities
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Pending Course Approvals */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Pending Course Approvals
            </h3>
            <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/courses?status=submitted')}>
              <Eye className="w-4 h-4 mr-2" />
              View All
            </Button>
          </div>
          
          <div className="space-y-4">
            {stats.recent.pendingCourses.length > 0 ? (
              stats.recent.pendingCourses.map((course) => (
                <div key={course.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex-shrink-0">
                    <Clock className="w-4 h-4 text-yellow-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {course.title}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      by {course.instructorName} • {formatDate(course.submittedAt)}
                    </p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => navigate(`/course/${course.id}`)}
                  >
                    Review
                  </Button>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">
                  No pending course approvals
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