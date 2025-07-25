import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { 
  BookOpen, 
  Users, 
  GraduationCap, 
  TrendingUp, 
  BarChart3, 
  Star,
  Clock,
  Target,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { getTutorAnalytics } from '../../utils/api';

interface AnalyticsData {
  overview: {
    totalCourses: number;
    publishedCourses: number;
    totalStudents: number;
    totalEnrollments: number;
    averageRating: number;
    completionRate: number;
  };
  coursePerformance: Array<{
    id: string;
    title: string;
    enrollments: number;
    completions: number;
    rating: number;
    completionRate: number;
    status: string;
  }>;
  enrollmentTrends: Array<{
    date: string;
    enrollments: number;
    completions: number;
  }>;
  studentEngagement: Array<{
    courseId: string;
    title: string;
    activeStudents: number;
    averageTimeSpent: number;
    averageProgress: number;
  }>;
  recentActivity: Array<{
    type: string;
    title: string;
    count: number;
    change: number;
    period: string;
  }>;
}

const TutorAnalytics: React.FC = () => {
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
      const response = await getTutorAnalytics(period);
      
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
          <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">Error Loading Analytics</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
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
          <h2 className="text-2xl font-bold text-gray-600 dark:text-gray-400 mb-4">No Analytics Data</h2>
          <p className="text-gray-500 dark:text-gray-400">Analytics data is not available.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Tutor Analytics</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Your course performance and student insights</p>
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
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Total Courses</h3>
            <BookOpen className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{analytics.overview.totalCourses.toLocaleString()}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {analytics.overview.publishedCourses} published
            </p>
          </div>
        </Card>

        <Card>
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Total Students</h3>
            <Users className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{analytics.overview.totalStudents.toLocaleString()}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Unique learners
            </p>
          </div>
        </Card>

        <Card>
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Total Enrollments</h3>
            <GraduationCap className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{analytics.overview.totalEnrollments.toLocaleString()}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {analytics.overview.completionRate}% completion rate
            </p>
          </div>
        </Card>

        <Card>
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Average Rating</h3>
            <Star className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{analytics.overview.averageRating.toFixed(1)}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Out of 5 stars
            </p>
          </div>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Activity</h3>
          </div>
          <div className="space-y-4">
            {analytics.recentActivity.map((activity, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                    {activity.type === 'courses' && <BookOpen className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
                    {activity.type === 'students' && <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
                    {activity.type === 'enrollments' && <GraduationCap className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
                    {activity.type === 'completions' && <Target className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
                  </div>
                  <div>
                    <p className="font-medium text-sm text-gray-900 dark:text-white">{activity.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{activity.period}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg text-gray-900 dark:text-white">{activity.count.toLocaleString()}</p>
                  <div className="flex items-center gap-1 text-xs">
                    {activity.change > 0 ? (
                      <ArrowUpRight className="h-3 w-3 text-green-600 dark:text-green-400" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3 text-red-600 dark:text-red-400" />
                    )}
                    <span className={activity.change > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                      {Math.abs(activity.change)}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Course Performance */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Course Performance</h3>
          </div>
          <div className="space-y-4">
            {analytics.coursePerformance.slice(0, 5).map((course) => (
              <div key={course.id} className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div>
                  <h4 className="font-medium text-sm text-gray-900 dark:text-white">{course.title}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={course.status === 'published' ? 'success' : 'warning'}>
                      {course.status}
                    </Badge>
                    <div className="flex items-center gap-1">
                      <Star className="h-3 w-3 text-yellow-500 fill-current" />
                      <span className="text-xs text-gray-900 dark:text-white">{course.rating.toFixed(1)}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{course.enrollments} enrollments</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{course.completionRate.toFixed(1)}% completion</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Student Engagement */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Student Engagement</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {analytics.studentEngagement.map((engagement) => (
            <div key={engagement.courseId} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
              <h4 className="font-medium text-sm mb-2 text-gray-900 dark:text-white">{engagement.title}</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600 dark:text-gray-400">Active Students:</span>
                  <span className="font-medium text-gray-900 dark:text-white">{engagement.activeStudents}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600 dark:text-gray-400">Avg Time Spent:</span>
                  <span className="font-medium text-gray-900 dark:text-white">{engagement.averageTimeSpent.toFixed(1)}h</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600 dark:text-gray-400">Avg Progress:</span>
                  <span className="font-medium text-gray-900 dark:text-white">{engagement.averageProgress.toFixed(1)}%</span>
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
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Enrollment Trends</h3>
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

export default TutorAnalytics; 