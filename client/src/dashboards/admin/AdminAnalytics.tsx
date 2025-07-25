import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useLanguage } from '../../contexts/LanguageContext';
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
  const { language, t } = useLanguage();

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
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 dark:border-blue-400"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">{t('errorLoadingAnalytics')}</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <Button onClick={fetchAnalytics} variant="outline">
            {t('retry')}
          </Button>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-600 dark:text-gray-400 mb-4">{t('noAnalyticsData')}</h2>
          <p className="text-gray-500 dark:text-gray-400">{t('analyticsDataNotAvailable')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('analytics.dashboard')}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">{t('analytics.platformPerformance')}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={period === '7' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setPeriod('7')}
          >
            {t('analytics.sevenDays')}
          </Button>
          <Button
            variant={period === '30' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setPeriod('30')}
          >
            {t('analytics.thirtyDays')}
          </Button>
          <Button
            variant={period === '90' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setPeriod('90')}
          >
            {t('analytics.ninetyDays')}
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">{t('analytics.totalUsers')}</h3>
            <Users className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{analytics.overview.totalUsers.toLocaleString()}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {analytics.userStats.active} {t('analytics.activeUsers')}
            </p>
          </div>
        </Card>

        <Card>
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">{t('analytics.totalCourses')}</h3>
            <BookOpen className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{analytics.overview.totalCourses.toLocaleString()}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {analytics.courseStats.published} {t('analytics.published')}
            </p>
          </div>
        </Card>

        <Card>
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">{t('analytics.totalEnrollments')}</h3>
            <GraduationCap className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{analytics.overview.totalEnrollments.toLocaleString()}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {analytics.overview.completionRate}% {t('analytics.completionRate')}
            </p>
          </div>
        </Card>

        <Card>
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">{t('analytics.activeUsers')}</h3>
            <Activity className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{analytics.overview.activeUsers.toLocaleString()}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t('analytics.lastSevenDays')}
            </p>
          </div>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('analytics.recentActivity')}</h3>
          </div>
          <div className="space-y-4">
            {analytics.recentActivity.map((activity, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                    {activity.type === 'newUsers' && <Users className="h-5 w-5 text-blue-500" />}
                    {activity.type === 'newCourses' && <BookOpen className="h-5 w-5 text-blue-500" />}
                    {activity.type === 'newEnrollments' && <GraduationCap className="h-5 w-5 text-blue-500" />}
                    {activity.type === 'courseCompletions' && <Target className="h-5 w-5 text-blue-500" />}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{t(`analytics.${activity.type}`)}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t('analytics.lastThirtyDays')}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-gray-900 dark:text-white">{activity.count}</div>
                  <div className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                    <ArrowUpRight className="w-3 h-3" />
                    {activity.change}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* User Distribution */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('analytics.userDistribution')}</h3>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-900 dark:text-white">{t('analytics.learners')}</span>
              <Badge variant="info">{analytics.userStats.learners}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-900 dark:text-white">{t('analytics.tutors')}</span>
              <Badge variant="info">{analytics.userStats.tutors}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-900 dark:text-white">{t('analytics.admins')}</span>
              <Badge variant="info">{analytics.userStats.admins}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-900 dark:text-white">{t('analytics.activeUsers')}</span>
              <Badge variant="success">{analytics.userStats.active}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-900 dark:text-white">{t('analytics.inactiveUsers')}</span>
              <Badge variant="warning">{analytics.userStats.inactive}</Badge>
            </div>
          </div>
        </Card>
      </div>

      {/* Top Performing Courses */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Star className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('analytics.topPerformingCourses')}</h3>
        </div>
        <div className="space-y-4">
          {analytics.topCourses.slice(0, 5).map((course, index) => (
            <div key={course.id} className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                  <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{index + 1}</span>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">{course.title}</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('analytics.by')} {course.instructor}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{course.enrollments} {t('analytics.enrollments')}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{course.completionRate.toFixed(1)}% {t('analytics.completion')}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 text-yellow-500 fill-current" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{course.rating.toFixed(1)}</span>
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
          <BarChart3 className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('analytics.enrollmentTrends')}</h3>
        </div>
        <div className="h-64 flex items-end justify-between gap-2">
          {analytics.enrollmentTrends.slice(-7).map((trend, index) => (
            <div key={index} className="flex-1 flex flex-col items-center">
              <div className="w-full bg-blue-100 dark:bg-blue-900/50 rounded-t" style={{ 
                height: `${Math.max((trend.enrollments / Math.max(...analytics.enrollmentTrends.map(t => t.enrollments))) * 200, 4)}px` 
              }}></div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                {new Date(trend.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </div>
              <div className="text-xs font-medium text-gray-900 dark:text-white">{trend.enrollments}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default AdminAnalytics; 