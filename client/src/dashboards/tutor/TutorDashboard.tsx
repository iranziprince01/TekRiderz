import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Alert } from '../../components/ui/Alert';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { apiClient, getFileUrl } from '../../utils/api';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { useCourseStore } from '../../stores/courseStore';
import { handleApiError, handleCatchError, getErrorMessage } from '../../utils/errorHandler';
import { 
  BookOpen, 
  Plus, 
  Eye, 
  Edit, 
  Trash2,
  Users,
  Star,
  Clock,
  TrendingUp,
  CheckCircle,
  XCircle,
  AlertCircle,
  Target,
  Award,
  BarChart3,
  Upload,
  Settings,
  MessageCircle,
  Calendar,
  Activity,
  FileText,
  Send,
  RefreshCw,
  Search,
  ArrowRight
} from 'lucide-react';

interface Course {
  id: string;
  _id?: string;
  title: string;
  description: string;
  status: 'draft' | 'submitted' | 'pending' | 'approved' | 'rejected' | 'published';
  students: number;
  enrollmentCount?: number;
  rating: {
    average: number;
    count: number;
  };
  reviews: number;
  createdAt: string;
  updatedAt: string;
  thumbnail?: string;
  category: string;
  level: string;

  submissionNote?: string;
  instructorId: string;
  instructorName: string;
}

interface TutorStats {
  totalCourses: number;
  publishedCourses: number;
  totalStudents: number;
  avgRating: number;
  pendingCourses: number;
  totalEnrollments: number;
  completedCourses: number;
}

const TutorDashboard: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { myCourses, setMyCourses } = useCourseStore();
  
  const [recentCourses, setRecentCourses] = useState<Course[]>([]);
  const [stats, setStats] = useState<TutorStats>({
    totalCourses: 0,
    publishedCourses: 0,
    totalStudents: 0,
    avgRating: 0,
    pendingCourses: 0,
    totalEnrollments: 0,
    completedCourses: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  // Quick course creation form state
  const [quickCourse, setQuickCourse] = useState({
    title: '',
    description: '',
    category: 'programming',
    level: 'beginner' as 'beginner' | 'intermediate' | 'advanced'
  });

  // Auto-refresh tutor dashboard data
  const autoRefresh = useAutoRefresh({
    interval: 120000, // 2 minutes
    enabled: !loading,
    onRefresh: async () => {
      await loadMyCourses();
    }
  });

  // Load tutor's own courses for dashboard
  const loadMyCourses = async (showRefreshMessage = false) => {
    try {
      if (showRefreshMessage) setRefreshing(true);
      
      const data = await apiClient.getInstructorCourses({ limit: 100 });

      if (data.success && 'data' in data && data.data) {
        const coursesData = data.data.courses.map((course: any) => ({
          ...course,
          id: course._id || course.id,
          students: course.enrollmentCount || 0,
          rating: course.rating || { average: 0, count: 0 },
          reviews: course.rating?.count || 0,
        }));
        
        // Safely update store without causing storage errors
        try {
          setMyCourses(coursesData);
        } catch (storeError: any) {
          console.warn('Failed to update course store, continuing with local state:', storeError);
        }
        
        // Set recent courses (last 6 courses)
        const sortedCourses = [...coursesData].sort((a, b) => 
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
        setRecentCourses(sortedCourses.slice(0, 6));

        // Calculate stats based on tutor's own courses
        const calculatedStats: TutorStats = {
          totalCourses: coursesData.length,
          publishedCourses: coursesData.filter((c: Course) => c.status === 'approved' || c.status === 'published').length,
          totalStudents: coursesData.reduce((sum: number, course: Course) => sum + course.students, 0),
          avgRating: coursesData.length > 0 ? 
            coursesData.reduce((sum: number, course: Course) => sum + (course.rating.average || 0), 0) / coursesData.length : 0,
          pendingCourses: coursesData.filter((c: Course) => c.status === 'pending' || c.status === 'submitted').length,
          totalEnrollments: coursesData.reduce((sum: number, course: Course) => sum + course.students, 0),
          completedCourses: coursesData.filter((c: Course) => c.status === 'approved' || c.status === 'published').length,
        };
        setStats(calculatedStats);

        if (showRefreshMessage) {
          setSuccess('Dashboard data refreshed successfully!');
          setTimeout(() => setSuccess(''), 3000);
        }
      }
    } catch (err: any) {
      console.error('Failed to load courses:', err);
      
      // Better error handling to avoid generic error messages
      if (err?.message?.includes('quota') || err?.name === 'QuotaExceededError') {
        setError('Storage full. Please refresh the page to continue.');
        // Auto-refresh in 3 seconds
        setTimeout(() => window.location.reload(), 3000);
      } else if (err?.status === 401 || err?.message?.includes('unauthorized')) {
        setError('Session expired. Please log in again.');
        setTimeout(() => window.location.href = '/login', 2000);
      } else {
        // Don't show storage errors as course loading errors
        const errorMessage = handleCatchError(err, 'Failed to load courses');
        if (!errorMessage.includes('[object Object]') && !errorMessage.includes('Setting the value')) {
          setError(errorMessage);
        } else {
          console.warn('Skipping confusing error message:', errorMessage);
          // Set empty state instead of showing error
          setMyCourses([]);
          setRecentCourses([]);
          setStats({
            totalCourses: 0,
            publishedCourses: 0,
            totalStudents: 0,
            avgRating: 0,
            pendingCourses: 0,
            totalEnrollments: 0,
            completedCourses: 0,
          });
        }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Quick course creation function
  const createQuickCourse = async () => {
    if (!quickCourse.title.trim() || !quickCourse.description.trim()) {
      setError('Please fill in course title and description');
      return;
    }

    setCreateLoading(true);
    setError('');

    try {
      const courseData = {
        title: quickCourse.title.trim(),
        description: quickCourse.description.trim(),
        shortDescription: quickCourse.description.trim().substring(0, 150),
        category: quickCourse.category,
        level: quickCourse.level,
        language: 'en',
        status: 'draft',
        instructorId: user?.id,
        instructorName: user?.name || user?.email || 'Unknown Instructor',
        type: 'course',
        tags: [],
        requirements: [],
        learningObjectives: [],
        sections: [],
        totalDuration: 0,
        totalLessons: 0,
        price: 0,
        currency: 'USD',
        enrollmentCount: 0,
        thumbnail: '',
        targetAudience: ''
      };

      const response = await apiClient.createCourse(courseData);

      if (response.success) {
        setSuccess('Course created successfully! You can now add content.');
        setShowCreateForm(false);
        setQuickCourse({ title: '', description: '', category: 'programming', level: 'beginner' });
        
        // Refresh courses list
        await loadMyCourses();
        
        // Navigate to the created course for editing
        const courseId = response.data?._id || response.data?.id;
        if (courseId) {
          navigate(`/course/${courseId}`, { 
            state: { 
              message: 'Course created! You can now add modules and content.',
              type: 'success'
            }
          });
        }
      } else {
        setError(response.error || 'Failed to create course');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create course');
    } finally {
      setCreateLoading(false);
    }
  };

  // Initialize data loading
  useEffect(() => {
    if (user) {
      loadMyCourses();
    }
  }, [user]);

  // Navigate to course page
  const openCoursePage = (courseId: string) => {
    navigate(`/course/${courseId}`);
  };

  // Get thumbnail URL
  const getThumbnailUrl = (course: Course): string => {
    return getFileUrl(course.thumbnail, 'thumbnail');
  };

  // Course card component for recent courses
  const RecentCourseCard = ({ course }: { course: Course }) => {
    const thumbnailUrl = getThumbnailUrl(course);
    const [imageError, setImageError] = useState(false);
    
    return (
      <button 
        onClick={() => openCoursePage(course._id || course.id)} 
        className="w-full text-left group"
      >
        <Card className="relative overflow-hidden bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-xl hover:scale-105 transition-all duration-300 rounded-xl cursor-pointer">
          {/* Course thumbnail/header */}
          <div className="relative h-40 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/20 overflow-hidden">
            {!imageError ? (
              <img 
                src={thumbnailUrl} 
                alt={course.title}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                style={{
                  objectFit: 'cover',
                  objectPosition: 'center'
                }}
                onError={(e) => {
                  console.warn('Thumbnail failed to load:', thumbnailUrl, 'for course:', course.title);
                  setImageError(true);
                }}
                onLoad={() => {
                  console.log('Thumbnail loaded successfully:', thumbnailUrl);
                  setImageError(false);
                }}
                loading="lazy"
                crossOrigin="anonymous"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 bg-gray-100 dark:bg-gray-700">
                <div className="p-3 bg-white dark:bg-gray-600 rounded-lg mb-2">
                  <BookOpen className="h-8 w-8 text-blue-600" />
                </div>
                <span className="text-sm font-medium">Course Thumbnail</span>
                <span className="text-xs text-gray-400 mt-1">Click to view course</span>
              </div>
            )}

            {/* Status badge */}
            <div className="absolute top-3 left-3">
              <Badge variant={course.status === 'published' || course.status === 'approved' ? 'success' : 
                             course.status === 'submitted' || course.status === 'pending' ? 'warning' : 'default'} 
                     className="text-xs font-medium shadow-lg">
                {course.status === 'pending' ? 'Pending' : 
                 course.status === 'submitted' ? 'Under Review' : course.status}
              </Badge>
            </div>

            {/* Overlay on hover */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all duration-300" />
          </div>

          {/* Card content */}
          <div className="p-5">
            <h3 className="font-bold text-base text-gray-900 dark:text-white mb-3 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-tight">
              {course.title}
            </h3>

            {/* Stats row */}
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                  <Users size={14} className="text-blue-600" />
                  <span className="font-medium">{course.students || 0}</span>
                  <span className="text-xs">students</span>
                </div>
                <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                  <Star size={14} className="text-blue-600 fill-blue-600" />
                  <span className="font-medium">{course.rating?.average?.toFixed(1) || '0.0'}</span>
                </div>
              </div>
              <div className="text-gray-500 dark:text-gray-400 text-xs">
                {new Date(course.createdAt).toLocaleDateString()}
              </div>
            </div>
          </div>
        </Card>
      </button>
    );
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error and Success Messages */}
      {error && (
        <Alert variant="error">
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-2 text-red-800 hover:text-red-900">×</button>
        </Alert>
      )}

      {success && (
        <Alert variant="success">
          <span>{success}</span>
          <button onClick={() => setSuccess('')} className="ml-2 text-green-800 hover:text-green-900">×</button>
        </Alert>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('tutor.dashboard.title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {t('tutor.dashboard.welcome')}, {user?.name}. {t('tutor.dashboard.subtitle')}.
          </p>
        </div>
        <div className="flex items-center gap-3">
        <Button 
            variant={showCreateForm ? "outline" : "primary"}
            onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>{t('tutor.dashboard.createCourse')}</span>
        </Button>
          <Button
            variant="outline"
            onClick={() => navigate('/dashboard/courses')}
            className="flex items-center space-x-2"
          >
            <BookOpen className="w-4 h-4" />
            <span>{t('tutor.dashboard.allCourses')}</span>
          </Button>
        </div>
      </div>

      {/* Quick Create Form */}
      {showCreateForm && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            {t('tutor.dashboard.createCourse')}
          </h2>
          <form onSubmit={(e) => { e.preventDefault(); createQuickCourse(); }} className="space-y-4">
            <div>
              <label htmlFor="quickCourseTitle" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('tutor.dashboard.courseTitle')}
              </label>
              <input
                type="text"
                id="quickCourseTitle"
                value={quickCourse.title}
                onChange={(e) => setQuickCourse({ ...quickCourse, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder={t('tutor.dashboard.titlePlaceholder')}
                required
              />
            </div>
            <div>
              <label htmlFor="quickCourseDescription" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('tutor.dashboard.courseDescription')}
              </label>
              <textarea
                id="quickCourseDescription"
                value={quickCourse.description}
                onChange={(e) => setQuickCourse({ ...quickCourse, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder={t('tutor.dashboard.descriptionPlaceholder')}
                rows={4}
                required
              />
            </div>
            <div>
              <label htmlFor="quickCourseCategory" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('tutor.dashboard.category')}
              </label>
              <select
                id="quickCourseCategory"
                value={quickCourse.category}
                onChange={(e) => setQuickCourse({ ...quickCourse, category: e.target.value as 'programming' | 'design' | 'business-tech' | 'general-it' })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="programming">{t('courses.programming')}</option>
                <option value="design">{t('courses.design')}</option>
                <option value="business-tech">{t('courses.businessTech')}</option>
                <option value="general-it">{t('courses.generalIT')}</option>
              </select>
            </div>
            <div>
              <label htmlFor="quickCourseLevel" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('tutor.dashboard.level')}
              </label>
              <select
                id="quickCourseLevel"
                value={quickCourse.level}
                onChange={(e) => setQuickCourse({ ...quickCourse, level: e.target.value as 'beginner' | 'intermediate' | 'advanced' })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="beginner">{t('courses.beginner')}</option>
                <option value="intermediate">{t('courses.intermediate')}</option>
                <option value="advanced">{t('courses.advanced')}</option>
              </select>
            </div>
            <Button type="submit" className="w-full" disabled={createLoading}>
              {createLoading ? (
                <LoadingSpinner size="sm" />
              ) : (
                <span>{t('tutor.dashboard.createCourse')}</span>
              )}
            </Button>
          </form>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <button 
          onClick={() => navigate('/dashboard/courses')}
          className="text-left group"
        >
          <Card className="p-4 hover:shadow-lg transition-all duration-200 cursor-pointer border hover:border-blue-300 dark:hover:border-blue-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {t('tutor.dashboard.totalCourses')}
                </p>
                <p className="text-xl font-bold text-gray-900 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">
                  {stats.totalCourses}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {stats.publishedCourses} {t('tutor.dashboard.published')}
                </p>
              </div>
              <div className="bg-blue-100 dark:bg-blue-900/20 p-2 rounded-lg group-hover:bg-blue-200 dark:group-hover:bg-blue-800/30 transition-all">
                <BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </Card>
        </button>

        <button 
          onClick={() => navigate('/dashboard/courses')}
          className="text-left group"
        >
          <Card className="p-4 hover:shadow-lg transition-all duration-200 cursor-pointer border hover:border-blue-300 dark:hover:border-blue-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {t('tutor.dashboard.totalStudents')}
                </p>
                <p className="text-xl font-bold text-gray-900 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">
                  {stats.totalStudents}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t('tutor.dashboard.acrossAllCourses')}
                </p>
              </div>
              <div className="bg-blue-100 dark:bg-blue-900/20 p-2 rounded-lg group-hover:bg-blue-200 dark:group-hover:bg-blue-800/30 transition-all">
                <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </Card>
        </button>

        <button 
          onClick={() => navigate('/dashboard/courses')}
          className="text-left group"
        >
          <Card className="p-4 hover:shadow-lg transition-all duration-200 cursor-pointer border hover:border-blue-300 dark:hover:border-blue-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {t('tutor.dashboard.avgRating')}
                </p>
                <p className="text-xl font-bold text-gray-900 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">
                  {stats.avgRating.toFixed(1)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t('tutor.dashboard.outOf')}
                </p>
              </div>
              <div className="bg-blue-100 dark:bg-blue-900/20 p-2 rounded-lg group-hover:bg-blue-200 dark:group-hover:bg-blue-800/30 transition-all">
                <Star className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </Card>
        </button>

        <button 
          onClick={() => navigate('/dashboard/courses')}
          className="text-left group"
        >
          <Card className="p-4 hover:shadow-lg transition-all duration-200 cursor-pointer border hover:border-blue-300 dark:hover:border-blue-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {t('tutor.dashboard.pendingReview')}
                </p>
                <p className="text-xl font-bold text-gray-900 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">
                  {stats.pendingCourses}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t('tutor.dashboard.awaitingApproval')}
                </p>
              </div>
              <div className="bg-blue-100 dark:bg-blue-900/20 p-2 rounded-lg group-hover:bg-blue-200 dark:group-hover:bg-blue-800/30 transition-all">
                <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </Card>
        </button>

        <button 
          onClick={() => navigate('/dashboard/analytics')}
          className="text-left group"
        >
          <Card className="p-4 hover:shadow-lg transition-all duration-200 cursor-pointer border hover:border-purple-300 dark:hover:border-purple-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                  Course Analytics
                </p>
                <p className="text-xl font-bold text-gray-900 dark:text-white group-hover:text-purple-700 dark:group-hover:text-purple-300 transition-colors">
                  View
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Detailed insights
                </p>
              </div>
              <div className="bg-purple-100 dark:bg-purple-900/20 p-2 rounded-lg group-hover:bg-purple-200 dark:group-hover:bg-purple-800/30 transition-all">
                <BarChart3 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </Card>
        </button>
      </div>

      {/* Recent Courses Section */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {t('tutor.dashboard.recentCourses')}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {t('tutor.dashboard.recentCoursesDesc')}
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate('/dashboard/courses')} className="flex items-center space-x-2">
            <span>{t('common.viewAll')}</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>

        {recentCourses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentCourses.map((course) => (
              <RecentCourseCard key={course.id} course={course} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {t('tutor.dashboard.noCourses')}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {t('tutor.dashboard.noCoursesDesc')}
            </p>
            <Button 
              variant="primary" 
              onClick={() => navigate('/dashboard/courses/new')}
              className="flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>{t('tutor.dashboard.createFirstCourse')}</span>
            </Button>
          </div>
        )}
      </Card>


    </div>
  );
};

export default TutorDashboard; 