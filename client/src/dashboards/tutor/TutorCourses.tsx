import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useCourseStore } from '../../stores/courseStore';
import { apiClient, getFileUrl } from '../../utils/api';
import { handleApiError, handleCatchError, getErrorMessage } from '../../utils/errorHandler';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { 
  BookOpen, 
  Plus, 
  Search, 
  MoreVertical, 
  Edit, 
  Eye, 
  Users, 
  CheckCircle, 
  XCircle, 
  Clock,
  Star,
  TrendingUp,
  Filter,
  RefreshCw,
  Trash2,
  Send,
  X
} from 'lucide-react';

interface Course {
  id: string;
  _id?: string;
  title: string;
  description: string;
  category: string;
  level: 'beginner' | 'intermediate' | 'advanced';
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
  instructorId: string;
  instructorName: string;
}

interface CourseStats {
  total: number;
  approved: number;
  pending: number;
  draft: number;
  rejected: number;
  enrollments: number;
}

const TutorCourses: React.FC = () => {
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const { myCourses, setMyCourses } = useCourseStore();
  
  const [courses, setCourses] = useState<Course[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isSubmitting, setIsSubmitting] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  
  const [stats, setStats] = useState<CourseStats>({
    total: 0,
    approved: 0,
    pending: 0,
    draft: 0,
    rejected: 0,
    enrollments: 0,
  });

  // Use the same getFileUrl utility used on the course page for consistent URL handling
  const getThumbnailUrl = (course: Course): string => {
    return getFileUrl(course.thumbnail, 'thumbnail');
  };

  // Thumbnail component with fallback handling
  const ThumbnailWithFallback = ({ course, getThumbnailUrl, getStatusBadge }: { 
    course: Course; 
    getThumbnailUrl: (course: Course) => string; 
    getStatusBadge: (status: string) => React.ReactNode 
  }) => {
    const [imageError, setImageError] = useState(false);
    const thumbnailUrl = getThumbnailUrl(course);

    return (
      <div className="relative h-32 bg-gray-100 dark:bg-gray-700 flex-shrink-0">
        {!imageError ? (
          <img 
            className="w-full h-full object-cover"
            src={thumbnailUrl}
            alt={course.title}
            style={{
              objectFit: 'cover',
              objectPosition: 'center'
            }}
            loading="eager"
            crossOrigin="anonymous"
            onError={(e) => {
              console.warn('Course thumbnail failed to load:', thumbnailUrl, 'for course:', course.title);
              setImageError(true);
            }}
            onLoad={() => {
              console.log('Course thumbnail loaded successfully:', thumbnailUrl);
            }}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800">
            <div className="p-2 bg-white dark:bg-gray-600 rounded-lg mb-1">
              <BookOpen className="h-6 w-6 text-blue-600" />
            </div>
            <span className="text-xs font-medium text-center px-2">Course Image</span>
          </div>
        )}
        {/* Status Badge Overlay */}
        <div className="absolute top-2 left-2">
          {getStatusBadge(course.status)}
        </div>
      </div>
    );
  };

  // Modal thumbnail component with fallback handling
  const ModalThumbnail = ({ course, getThumbnailUrl }: { 
    course: Course; 
    getThumbnailUrl: (course: Course) => string; 
  }) => {
    const [imageError, setImageError] = useState(false);
    const thumbnailUrl = getThumbnailUrl(course);

    return (
      <div className="w-32 h-32 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden shadow-sm">
        {!imageError ? (
          <img 
            src={thumbnailUrl}
            alt={course.title}
            className="w-full h-full object-cover"
            style={{
              objectFit: 'cover',
              objectPosition: 'center'
            }}
            loading="eager"
            crossOrigin="anonymous"
            onError={(e) => {
              console.warn('Modal thumbnail failed to load:', thumbnailUrl, 'for course:', course.title);
              setImageError(true);
            }}
            onLoad={() => {
              console.log('Modal thumbnail loaded successfully:', thumbnailUrl);
            }}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800">
            <div className="p-2 bg-white dark:bg-gray-600 rounded-lg mb-1">
              <BookOpen className="h-6 w-6 text-blue-600" />
            </div>
            <span className="text-xs font-medium text-center">Thumbnail</span>
          </div>
        )}
      </div>
    );
  };

  // Enhanced load tutor's courses with better data processing
  const loadCourses = async (showRefreshMessage = false) => {
    try {
      if (showRefreshMessage) setRefreshing(true);
      else setLoading(true);
      setError('');
      
      console.log('Loading instructor courses...', { userId: user?.id, role: user?.role });
      
      const params = { 
        limit: 100,
        page: 1,
        // Include all statuses for tutor's own courses
      };
      
      console.log('Fetching instructor courses with params:', params);
      const response = await apiClient.getInstructorCourses(params);
      console.log('Instructor courses response:', response);

      if (response.success && 'data' in response && response.data) {
        const coursesData = response.data.courses || [];
        console.log('Raw courses data:', coursesData.length, 'courses received');
        
        // Enhanced data processing with proper field mapping
        const processedCourses = coursesData.map((course: any) => ({
          ...course,
          id: course._id || course.id,
          students: course.enrollmentCount || course.students || 0,
          rating: {
            average: course.rating?.average || course.rating || 0,
            count: course.rating?.count || course.reviews || 0
          },
          reviews: course.rating?.count || course.reviews || 0,
          status: course.status || 'draft',
          level: course.level || 'beginner',
          category: course.category || 'general',
          title: course.title || 'Untitled Course',
          description: course.description || '',
          createdAt: course.createdAt || new Date().toISOString(),
          updatedAt: course.updatedAt || new Date().toISOString(),
          instructorId: course.instructorId || user?.id,
          instructorName: course.instructorName || user?.name,
          thumbnail: course.thumbnail || null, // Keep null instead of empty string
        }));
        
        console.log('Processed courses:', processedCourses.length, 'courses');
        setCourses(processedCourses);
        
        // Safely update store without causing storage errors
        try {
          setMyCourses(processedCourses);
        } catch (storeError: any) {
          console.warn('Failed to update course store, continuing with local state:', storeError);
        }

        // Calculate comprehensive stats
        const safeProcessedCourses = Array.isArray(processedCourses) ? processedCourses : [];
        const calculatedStats: CourseStats = {
          total: safeProcessedCourses.length,
          approved: safeProcessedCourses.filter((c: Course) => c.status === 'approved' || c.status === 'published').length,
          pending: safeProcessedCourses.filter((c: Course) => c.status === 'pending' || c.status === 'submitted').length,
          draft: safeProcessedCourses.filter((c: Course) => c.status === 'draft').length,
          rejected: safeProcessedCourses.filter((c: Course) => c.status === 'rejected').length,
          enrollments: safeProcessedCourses.reduce((sum: number, course: Course) => sum + course.students, 0),
        };
        
        console.log('Calculated stats:', calculatedStats);
        setStats(calculatedStats);

        if (showRefreshMessage) {
          setSuccess('Courses refreshed successfully!');
          setTimeout(() => setSuccess(''), 3000);
        }
      } else {
        console.error('API response was not successful:', response);
        
        // Enhanced error handling to prevent [object Object] display
        const errorMessage = getErrorMessage(response.error || response.message || response);
        
        // Handle authentication errors specifically
        if (errorMessage.includes('Authentication') || errorMessage.includes('token') || errorMessage.includes('unauthorized')) {
          setError('Your session has expired. Please log in again.');
          setTimeout(() => {
            window.location.href = '/login';
          }, 3000);
        } else if (errorMessage.includes('403') || errorMessage.includes('Insufficient permissions')) {
          setError('You do not have permission to access this page. Please contact support.');
        } else {
          // Set empty state instead of error for empty results
          setCourses([]);
          setMyCourses([]);
          setStats({
            total: 0,
            approved: 0,
            pending: 0,
            draft: 0,
            rejected: 0,
            enrollments: 0,
          });
          
          if (!showRefreshMessage) {
            // Don't show error for empty results, just show empty state
            console.log('No courses found, showing empty state');
          }
        }
      }
    } catch (err: any) {
      console.error('Failed to load courses - detailed error:', {
        message: err.message,
        status: err.status,
        response: err.response,
        stack: err.stack
      });
      
      // Enhanced error handling to prevent [object Object] display
      const errorMessage = getErrorMessage(err);
      
      // Provide more specific error messages
      if (errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('Failed to fetch')) {
        setError('Network error: Unable to connect to server. Please check your internet connection.');
      } else if (errorMessage.includes('401') || errorMessage.includes('unauthorized')) {
        setError('Authentication error: Please log in again.');
        setTimeout(() => {
          window.location.href = '/login';
        }, 3000);
      } else if (errorMessage.includes('403') || errorMessage.includes('forbidden')) {
        setError('Permission error: You do not have access to view courses.');
      } else {
        // Set empty state for unknown errors
        setCourses([]);
        setMyCourses([]);
        setStats({
          total: 0,
          approved: 0,
          pending: 0,
          draft: 0,
          rejected: 0,
          enrollments: 0,
        });
        
        if (!showRefreshMessage) {
          console.log('Error loading courses, showing empty state');
        }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Connection status monitoring
  useEffect(() => {
    const handleConnectionStatus = () => {
      setIsConnected(navigator.onLine);
    };

    // Check connection status
    window.addEventListener('online', handleConnectionStatus);
    window.addEventListener('offline', handleConnectionStatus);
    handleConnectionStatus();

    return () => {
      window.removeEventListener('online', handleConnectionStatus);
      window.removeEventListener('offline', handleConnectionStatus);
    };
  }, []);

  // Initialize data loading
  useEffect(() => {
    if (user) {
      loadCourses();
    }
  }, [user]);

  // Handle success message from course creation navigation
  useEffect(() => {
    if (location.state?.message && location.state?.type === 'success') {
      setSuccess(location.state.message);
      // Clear the message after showing it
      setTimeout(() => setSuccess(''), 5000);
      
      // Clear navigation state to prevent showing message again
      navigate(location.pathname, { replace: true });
    }
  }, [location.state, navigate]);

  // Auto-refresh data every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (user && !loading) {
        loadCourses();
      }
    }, 60000); // 60 seconds

    return () => clearInterval(interval);
  }, [user, loading]);

  // Filter courses based on search and filters
  useEffect(() => {
    let filtered = courses;

    // Search filter
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(course => 
        course.title.toLowerCase().includes(search) ||
        course.category.toLowerCase().includes(search)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(course => {
        if (statusFilter === 'published') return course.status === 'approved' || course.status === 'published';
        return course.status === statusFilter;
      });
    }

    // Category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(course => course.category === categoryFilter);
    }

    setFilteredCourses(filtered);
  }, [courses, searchTerm, statusFilter, categoryFilter]);

  // Navigate to course page
  const openCoursePage = (courseId: string) => {
    navigate(`/course/${courseId}`);
  };

  // Enhanced course actions with modals
  const handleCourseAction = async (courseId: string, action: 'edit' | 'view' | 'delete' | 'submit' | 'details') => {
    const course = courses.find(c => c.id === courseId);
    if (!course) return;

    setSelectedCourse(course);

    if (action === 'edit') {
      navigate(`/dashboard/courses/edit/${courseId}`);
    } else if (action === 'view') {
      navigate(`/course/${courseId}`);
    } else if (action === 'details') {
      setShowDetailsModal(true);
    } else if (action === 'delete') {
      setShowDeleteModal(true);
    } else if (action === 'submit') {
      if (course.status !== 'draft') {
        setError('Only draft courses can be submitted for review');
        return;
      }

      try {
        setIsSubmitting(courseId);
        const data = await apiClient.submitCourse(courseId);

        if (data.success) {
          setSuccess('Course submitted for review successfully');
          setTimeout(() => setSuccess(''), 5000);
          loadCourses(false);
        } else {
          setError(getErrorMessage(data.error || data.message || data) || 'Failed to submit course');
        }
      } catch (error: any) {
        console.error('Failed to submit course:', error);
        setError(getErrorMessage(error) || 'Failed to submit course');
      } finally {
        setIsSubmitting(null);
      }
    }
  };

  // Confirm delete course
  const confirmDeleteCourse = async () => {
    if (!selectedCourse) return;

    try {
      setIsSubmitting(selectedCourse.id);
      const data = await apiClient.deleteCourse(selectedCourse.id);

      if (data.success) {
        setSuccess('Course deleted successfully');
        setTimeout(() => setSuccess(''), 5000);
        setShowDeleteModal(false);
        setSelectedCourse(null);
        loadCourses(false);
      } else {
        setError(getErrorMessage(data.error || data.message || data) || 'Failed to delete course');
      }
    } catch (error: any) {
      console.error('Failed to delete course:', error);
      setError(getErrorMessage(error) || 'Failed to delete course');
    } finally {
      setIsSubmitting(null);
    }
  };

  // Quick edit course
  const quickEditCourse = async (courseId: string, updates: Partial<Course>) => {
    try {
      setIsSubmitting(courseId);
      const data = await apiClient.updateCourse(courseId, updates);

      if (data.success) {
        setSuccess('Course updated successfully');
        setTimeout(() => setSuccess(''), 5000);
        loadCourses(false);
      } else {
        setError(getErrorMessage(data.error || data.message || data) || 'Failed to update course');
      }
    } catch (error: any) {
      console.error('Failed to update course:', error);
      setError(getErrorMessage(error) || 'Failed to update course');
    } finally {
      setIsSubmitting(null);
    }
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    const variants = {
      draft: 'info',
      submitted: 'warning',
      pending: 'warning',
      approved: 'success',
      published: 'success',
      rejected: 'error',
    };
    
    const labels = {
      draft: t('status.draft'),
      submitted: t('status.submitted'),
      pending: t('status.pending'),
      approved: t('status.approved'),
      published: t('status.published'),
      rejected: t('status.rejected'),
    };

    return (
      <Badge variant={variants[status as keyof typeof variants] as any}>
        {labels[status as keyof typeof labels] || status}
      </Badge>
    );
  };

  // Get level badge color
  const getLevelBadge = (level: string) => {
    const colors = {
      beginner: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
      intermediate: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
      advanced: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
    };

    const labels = {
      beginner: t('level.beginner'),
      intermediate: t('level.intermediate'),
      advanced: t('level.advanced'),
    };

    return (
      <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full ${colors[level as keyof typeof colors]}`}>
        {labels[level as keyof typeof labels] || level}
      </span>
    );
  };



  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(language === 'rw' ? 'rw-RW' : 'en-US', {
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

  // Empty state component
  const EmptyCoursesState = () => (
    <div className="text-center py-12">
      <div className="mx-auto max-w-md">
        <BookOpen className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
                          {t('tutor.courses.noCourses')}
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t('tutor.courses.noCoursesDesc')}
        </p>
        <div className="mt-6">
          <Button 
            onClick={() => navigate('/dashboard/courses/new')}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            {t('tutor.dashboard.createCourse')}
          </Button>
        </div>
      </div>
    </div>
  );

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
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('tutor.courses.title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {t('tutor.courses.subtitle')}
          </p>
          {/* Connection Status */}
          <div className="flex items-center mt-2">
            {isConnected ? (
              <div className="flex items-center text-green-600 dark:text-green-400">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                <span className="text-sm">{t('tutor.courses.connected')}</span>
              </div>
            ) : (
              <div className="flex items-center text-red-600 dark:text-red-400">
                <div className="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
                <span className="text-sm">{t('tutor.courses.offline')}</span>
              </div>
            )}
          </div>
          </div>
        <Button 
          onClick={() => navigate('/dashboard/courses/new')}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          {t('tutor.dashboard.createCourse')}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="p-5 hover:shadow-lg transition-shadow border-2 hover:border-blue-300 dark:hover:border-blue-600">
          <div className="text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              {t('tutor.courses.totalCourses')}
            </p>
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{stats.total}</p>
          </div>
        </Card>
        
        <Card className="p-5 hover:shadow-lg transition-shadow border-2 hover:border-blue-300 dark:hover:border-blue-600">
          <div className="text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              {t('tutor.courses.approvedCourses')}
            </p>
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{stats.approved}</p>
          </div>
        </Card>
        
        <Card className="p-5 hover:shadow-lg transition-shadow border-2 hover:border-blue-300 dark:hover:border-blue-600">
          <div className="text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              {t('tutor.courses.pendingCourses')}
            </p>
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{stats.pending}</p>
          </div>
        </Card>
        
        <Card className="p-5 hover:shadow-lg transition-shadow border-2 hover:border-blue-300 dark:hover:border-blue-600">
          <div className="text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              {t('tutor.courses.draftCourses')}
            </p>
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{stats.draft}</p>
          </div>
        </Card>
        
        <Card className="p-5 hover:shadow-lg transition-shadow border-2 hover:border-blue-300 dark:hover:border-blue-600">
          <div className="text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              {t('tutor.courses.rejectedCourses')}
            </p>
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{stats.rejected}</p>
          </div>
        </Card>
        
        <Card className="p-5 hover:shadow-lg transition-shadow border-2 hover:border-blue-300 dark:hover:border-blue-600">
          <div className="text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              {t('tutor.courses.enrollments')}
            </p>
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{stats.enrollments}</p>
          </div>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder={t('tutor.courses.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-6">
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-6 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white min-w-[140px]"
            >
              <option value="all">{t('tutor.courses.allStatus')}</option>
              <option value="draft">{t('status.draft')}</option>
              <option value="pending">{t('status.pending')}</option>
              <option value="submitted">{t('status.submitted')}</option>
              <option value="published">{t('status.published')}</option>
              <option value="rejected">{t('status.rejected')}</option>
            </select>
            <select 
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-6 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white min-w-[140px]"
            >
              <option value="all">{t('tutor.courses.allCategories')}</option>
              <option value="programming">Programming</option>
              <option value="design">Design</option>
              <option value="business-tech">Business Tech</option>
              <option value="general-it">General IT</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Courses Grid */}
      {filteredCourses.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="mx-auto h-24 w-24 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-6">
            <BookOpen className="h-12 w-12 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
            {searchTerm || statusFilter !== 'all' || categoryFilter !== 'all' 
              ? t('tutor.courses.noCoursesFound')
              : t('tutor.courses.noCourses')
            }
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
            {searchTerm || statusFilter !== 'all' || categoryFilter !== 'all' 
              ? t('tutor.courses.noCoursesFoundDesc')
              : t('tutor.courses.noCoursesDesc')
            }
          </p>
          
          {!searchTerm && statusFilter === 'all' && categoryFilter === 'all' && (
            <div className="space-y-4">
              <Button 
                onClick={() => navigate('/dashboard/courses/new')}
                className="bg-blue-600 hover:bg-blue-700"
                size="lg"
              >
                <Plus className="w-5 h-5 mr-2" />
                {t('tutor.courses.createFirstCourse')}
              </Button>
              
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg text-sm max-w-lg mx-auto">
                <h4 className="font-medium text-blue-900 dark:text-blue-300 mb-2">
                  {t('tutor.courses.gettingStarted')}
                </h4>
                <ul className="text-blue-800 dark:text-blue-200 space-y-1 text-left">
                  <li>• {t('tutor.courses.step1')}</li>
                  <li>• {t('tutor.courses.step2')}</li>
                  <li>• {t('tutor.courses.step3')}</li>
                  <li>• {t('tutor.courses.step4')}</li>
                </ul>
              </div>
            </div>
          )}
          
          {(searchTerm || statusFilter !== 'all' || categoryFilter !== 'all') && (
            <Button
              variant="outline"
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setCategoryFilter('all');
              }}
            >
              <X className="w-4 h-4 mr-2" />
              {t('tutor.courses.clearFilters')}
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredCourses.map((course) => (
            <div key={course.id} onClick={() => openCoursePage(course._id || course.id)} className="cursor-pointer">
              <Card className="bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden border border-gray-200 dark:border-gray-700 flex flex-col h-full">
                {/* Course Thumbnail */}
                <ThumbnailWithFallback 
                  course={course}
                  getThumbnailUrl={getThumbnailUrl}
                  getStatusBadge={getStatusBadge}
                />

                {/* Course Content */}
                <div className="p-3 flex flex-col flex-grow">
                  {/* Header Section */}
                  <div className="mb-2">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1 line-clamp-2 leading-tight">
                      {course.title}
                    </h3>
                    
                    <p className="text-blue-600 dark:text-blue-400 font-medium text-xs">
                      {course.instructorName || 'Prince Iranzi'}
                    </p>
                  </div>
                  
                  {/* Course Info */}
                  <div className="mb-2 flex-grow">
                    <p className="text-gray-600 dark:text-gray-400 text-xs line-clamp-2 mb-2">
                      {course.description || 'Comprehensive course designed to help you master new skills and advance your knowledge.'}
                    </p>
                    
                    {/* Category */}
                    <span className="inline-block text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                      {course.category}
                    </span>
                  </div>
                  
                  {/* Stats Section */}
                  <div className="mb-3 pb-2 border-b border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between text-sm">
                      {/* Rating */}
                      <div className="flex items-center">
                        <div className="flex items-center mr-2">
                          {[1, 2, 3, 4, 5].map((star) => {
                            const ratingValue = typeof course.rating?.average === 'number' ? course.rating.average : 0;
                            return (
                              <Star 
                                key={star}
                                className={`h-3 w-3 ${
                                  star <= Math.floor(ratingValue)
                                    ? 'text-blue-400 fill-current'
                                    : 'text-gray-300 dark:text-gray-600'
                                }`}
                              />
                            );
                          })}
                        </div>
                        <span className="text-xs font-medium text-gray-900 dark:text-white">
                          {typeof course.rating?.average === 'number' ? course.rating.average.toFixed(1) : '0.0'}
                        </span>
                      </div>
                      
                      {/* Students */}
                      <div className="flex items-center text-gray-600 dark:text-gray-400">
                        <Users className="h-3 w-3 mr-1" />
                        <span className="text-xs">{course.students}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Footer Section */}
                  <div className="flex items-center justify-between mt-auto">
                    {/* Price */}
                    <div>
                      <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                        {t('tutor.courses.free')}
                      </span>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDate(course.createdAt)}
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCourseAction(course.id, 'view')}
                        className="text-xs px-3 py-1.5 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 dark:hover:bg-blue-900/20"
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        {t('tutor.courses.view')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCourseAction(course.id, 'edit')}
                        className="text-xs px-3 py-1.5 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 dark:hover:bg-blue-900/20"
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        {t('tutor.courses.edit')}
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          ))}
        </div>
      )}


      {/* Enhanced Course Details Modal */}
      {showDetailsModal && selectedCourse && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {t('tutor.courses.courseDetails')}
                </h2>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              <div className="space-y-6">
                {/* Course Header */}
                <div className="flex flex-col md:flex-row md:items-start space-y-4 md:space-y-0 md:space-x-6">
                  <div className="flex-shrink-0">
                    <ModalThumbnail course={selectedCourse} getThumbnailUrl={getThumbnailUrl} />
                  </div>
                  
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                      {selectedCourse.title}
                    </h3>
                    <p className="text-lg text-gray-600 dark:text-gray-400 capitalize mb-4">
                      {selectedCourse.category}
                    </p>
                    <div className="flex flex-wrap gap-3">
                      {getStatusBadge(selectedCourse.status)}
                      {getLevelBadge(selectedCourse.level)}
                    </div>
                  </div>
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
                    <Users className="h-8 w-8 text-gray-600 dark:text-gray-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{selectedCourse.students}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {t('tutor.courses.students')}
                    </p>
                  </div>
                  
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
                    <Star className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {selectedCourse.rating.average > 0 ? selectedCourse.rating.average.toFixed(1) : '--'}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {t('tutor.courses.rating')}
                    </p>
                  </div>
                  
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
                    <TrendingUp className="h-8 w-8 text-gray-600 dark:text-gray-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{selectedCourse.reviews}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {t('tutor.courses.reviews')}
                    </p>
                  </div>
                  
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
                    <Clock className="h-8 w-8 text-gray-600 dark:text-gray-400 mx-auto mb-2" />
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                                          {selectedCourse.status === 'published' ? t('tutor.courses.liveCourse') :
                    selectedCourse.status === 'submitted' ? t('tutor.courses.pendingStatus') :
                    t('tutor.courses.draftStatus')}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {t('tutor.courses.status')}
                    </p>
                  </div>
                </div>

                {/* Course Description */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                    {t('tutor.courses.description')}
                  </h4>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                      {selectedCourse.description || t('tutor.courses.noDescription')}
                    </p>
                  </div>
                </div>

                {/* Course Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                      {t('tutor.courses.generalInfo')}
                    </h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                        <span className="text-gray-600 dark:text-gray-400">
                          {t('tutor.dashboard.category')}
                        </span>
                        <span className="font-medium text-gray-900 dark:text-white capitalize">
                          {selectedCourse.category}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                        <span className="text-gray-600 dark:text-gray-400">
                          {t('tutor.dashboard.level')}
                        </span>
                        <span className="font-medium text-gray-900 dark:text-white capitalize">
                          {selectedCourse.level}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                        <span className="text-gray-600 dark:text-gray-400">
                          {t('tutor.courses.instructor')}
                        </span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {selectedCourse.instructorName}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                      {t('tutor.courses.timeline')}
                    </h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                        <span className="text-gray-600 dark:text-gray-400">
                          {t('tutor.courses.created')}
                        </span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {formatDate(selectedCourse.createdAt)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                        <span className="text-gray-600 dark:text-gray-400">
                          {t('tutor.courses.lastUpdated')}
                        </span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {formatDate(selectedCourse.updatedAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action suggestions based on status */}
                {selectedCourse.status === 'draft' && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">
                      {t('tutor.courses.nextSteps')}
                    </h4>
                    <ul className="text-blue-800 dark:text-blue-200 text-sm space-y-1">
                      <li>• {t('tutor.courses.step1Complete')}</li>
                      <li>• {t('tutor.courses.step2AddThumbnail')}</li>
                      <li>• {t('tutor.courses.step3Submit')}</li>
                    </ul>
                  </div>
                )}

                {selectedCourse.status === 'rejected' && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                    <h4 className="font-semibold text-red-900 dark:text-red-300 mb-2">
                      {t('tutor.courses.courseRejected')}
                    </h4>
                    <p className="text-red-800 dark:text-red-200 text-sm">
                      {t('tutor.courses.rejectedMessage')}
                    </p>
                  </div>
                )}

                {selectedCourse.status === 'approved' && (
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                    <h4 className="font-semibold text-green-900 dark:text-green-300 mb-2">
                      {t('tutor.courses.courseApproved')}
                    </h4>
                    <p className="text-green-800 dark:text-green-200 text-sm">
                      {t('tutor.courses.approvedMessage')}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <div className="flex flex-wrap gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setShowDetailsModal(false)}
                >
                  {t('tutor.courses.close')}
                </Button>
                
                {selectedCourse.status === 'approved' && (
                  <Button
                    onClick={() => {
                      setShowDetailsModal(false);
                      handleCourseAction(selectedCourse.id, 'view');
                    }}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    {t('tutor.courses.viewLiveCourse')}
                  </Button>
                )}
                
                <Button
                  onClick={() => {
                    setShowDetailsModal(false);
                    handleCourseAction(selectedCourse.id, 'edit');
                  }}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  {t('tutor.courses.editCourse')}
                </Button>
                
                {selectedCourse.status === 'draft' && (
                  <Button
                    onClick={() => {
                      setShowDetailsModal(false);
                      handleCourseAction(selectedCourse.id, 'submit');
                    }}
                    className="bg-blue-600 hover:bg-blue-700"
                    disabled={isSubmitting === selectedCourse.id}
                  >
                    {isSubmitting === selectedCourse.id ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 mr-2" />
                    )}
                    {t('tutor.courses.submitForReview')}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedCourse && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  {t('tutor.courses.deleteCourse')}
                </h3>
              </div>
            </div>
            
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              {t('tutor.courses.deleteMessage')} "{selectedCourse.title}"? {t('tutor.courses.deleteCannotUndo')}
            </p>

            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => setShowDeleteModal(false)}
                disabled={isSubmitting === selectedCourse.id}
              >
                {t('tutor.courses.cancel')}
              </Button>
              <Button
                onClick={confirmDeleteCourse}
                disabled={isSubmitting === selectedCourse.id}
                className="bg-red-600 hover:bg-red-700"
              >
                {isSubmitting === selectedCourse.id ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                {t('tutor.courses.delete')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TutorCourses; 