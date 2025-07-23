import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { 
  Users, 
  BookOpen, 
  GraduationCap, 
  TrendingUp, 
  BarChart3, 
  Activity,
  Calendar,
  Clock,
  Star,
  Target,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { getAdminAnalytics } from '../../utils/api';

interface AnalyticsData {
  overview: {
    totalUsers: number;
    totalCourses: number;
    totalEnrollments: number;
    activeUsers: number;
    completionRate: number;
    averageRating: number;
  };
  userStats: {
    total: number;
    active: number;
    inactive: number;
    suspended: number;
    admins: number;
    tutors: number;
    learners: number;
  };
  courseStats: {
    total: number;
    published: number;
    draft: number;
    submitted: number;
    approved: number;
    rejected: number;
    pendingApproval: number;
  };
  topCourses: Array<{
    id: string;
    title: string;
    instructor: string;
    enrollments: number;
    completions: number;
    rating: number;
    completionRate: number;
  }>;
  enrollmentTrends: Array<{
    date: string;
    enrollments: number;
    completions: number;
  }>;
  userGrowth: Array<{
    date: string;
    newUsers: number;
    activeUsers: number;
  }>;
  recentActivity: Array<{
    type: string;
    title: string;
    count: number;
    change: number;
    period: string;
  }>;
}

const AdminAnalytics: React.FC = () => {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState('30');

  useEffect(() => {
    fetchAnalytics();
  }, [period]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getAdminAnalytics(period);
      
      if (response.success && response.data?.analytics) {
        setAnalytics(response.data.analytics);
      } else {
        setError(response.message || 'Failed to fetch analytics data');
      }
    } catch (err) {
      setError('Failed to fetch analytics data');
      console.error('Analytics fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error Loading Analytics</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={fetchAnalytics} variant="outline">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-600 mb-4">No Analytics Data</h2>
          <p className="text-gray-500">Analytics data is not available.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-600 mt-2">Platform performance and insights</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={period === '7' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setPeriod('7')}
          >
            7 Days
          </Button>
          <Button
            variant={period === '30' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setPeriod('30')}
          >
            30 Days
          </Button>
          <Button
            variant={period === '90' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setPeriod('90')}
          >
            90 Days
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="text-sm font-medium">Total Users</h3>
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold">{analytics.overview.totalUsers.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {analytics.userStats.active} active users
            </p>
          </div>
        </Card>

        <Card>
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="text-sm font-medium">Total Courses</h3>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold">{analytics.overview.totalCourses.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {analytics.courseStats.published} published
            </p>
          </div>
        </Card>

        <Card>
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="text-sm font-medium">Total Enrollments</h3>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold">{analytics.overview.totalEnrollments.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {analytics.overview.completionRate}% completion rate
            </p>
          </div>
        </Card>

        <Card>
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="text-sm font-medium">Active Users</h3>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold">{analytics.overview.activeUsers.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Last 7 days
            </p>
          </div>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5" />
            <h3 className="text-lg font-semibold">Recent Activity</h3>
          </div>
          <div className="space-y-4">
            {analytics.recentActivity.map((activity, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-full">
                    {activity.type === 'users' && <Users className="h-4 w-4 text-blue-600" />}
                    {activity.type === 'courses' && <BookOpen className="h-4 w-4 text-blue-600" />}
                    {activity.type === 'enrollments' && <GraduationCap className="h-4 w-4 text-blue-600" />}
                    {activity.type === 'completions' && <Target className="h-4 w-4 text-blue-600" />}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{activity.title}</p>
                    <p className="text-xs text-gray-500">{activity.period}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg">{activity.count.toLocaleString()}</p>
                  <div className="flex items-center gap-1 text-xs">
                    {activity.change > 0 ? (
                      <ArrowUpRight className="h-3 w-3 text-green-600" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3 text-red-600" />
                    )}
                    <span className={activity.change > 0 ? 'text-green-600' : 'text-red-600'}>
                      {Math.abs(activity.change)}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* User Distribution */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-5 w-5" />
            <h3 className="text-lg font-semibold">User Distribution</h3>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm">Learners</span>
              <Badge variant="info">{analytics.userStats.learners}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Tutors</span>
              <Badge variant="info">{analytics.userStats.tutors}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Admins</span>
              <Badge variant="info">{analytics.userStats.admins}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Active Users</span>
              <Badge variant="success">{analytics.userStats.active}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Inactive Users</span>
              <Badge variant="warning">{analytics.userStats.inactive}</Badge>
            </div>
          </div>
        </Card>
      </div>

      {/* Top Performing Courses */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Star className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Top Performing Courses</h3>
        </div>
        <div className="space-y-4">
          {analytics.topCourses.slice(0, 5).map((course, index) => (
            <div key={course.id} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-sm font-bold text-blue-600">{index + 1}</span>
                </div>
                <div>
                  <h4 className="font-medium">{course.title}</h4>
                  <p className="text-sm text-gray-500">by {course.instructor}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-sm font-medium">{course.enrollments} enrollments</p>
                    <p className="text-xs text-gray-500">{course.completionRate.toFixed(1)}% completion</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 text-yellow-500 fill-current" />
                    <span className="text-sm font-medium">{course.rating.toFixed(1)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Enrollment Trends Chart */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Enrollment Trends</h3>
        </div>
        <div className="h-64 flex items-end justify-between gap-2">
          {analytics.enrollmentTrends.slice(-7).map((trend, index) => (
            <div key={index} className="flex-1 flex flex-col items-center">
              <div className="w-full bg-blue-100 rounded-t" style={{ 
                height: `${Math.max((trend.enrollments / Math.max(...analytics.enrollmentTrends.map(t => t.enrollments))) * 200, 4)}px` 
              }}></div>
              <div className="text-xs text-gray-500 mt-2">
                {new Date(trend.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </div>
              <div className="text-xs font-medium">{trend.enrollments}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default AdminAnalytics; 