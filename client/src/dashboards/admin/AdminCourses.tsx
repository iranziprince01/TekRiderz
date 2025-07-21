import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Badge } from '../../components/ui/Badge';
import { 
  Eye, 
  CheckCircle, 
  XCircle, 
  Trash2, 
  X
} from 'lucide-react';
import { apiClient, cleanInstructorName } from '../../utils/api';

interface CourseData {
  id: string;
  _id?: string;
  title: string;
  description: string;
  category: string;
  level: string;
  status: string;
  instructorId: string;
  instructorName: string;
  instructorEmail?: string;

  enrollments: number;
  enrollmentCount?: number;
  rating: number;
  totalRatings: number;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  approvedAt?: string;
  publishedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  qualityScore?: number;
  thumbnail?: string;
  duration?: number;
  totalDuration?: number;
  sections?: any[];
  totalLessons?: number;
  language?: string;
  isActive: boolean;
  workflowHistory?: any[];
  validationResult?: any;
  approvalFeedback?: any;
}

interface CourseStats {
  total: number;
  draft: number;
  submitted: number;
  approved: number;
  published: number;
  rejected: number;
  archived: number;
  pendingApproval: number;
}

interface ToastNotification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
}

const AdminCourses: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [courses, setCourses] = useState<CourseData[]>([]);
  const [loading, setLoading] = useState(false); // Changed from true to false
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [levelFilter, setLevelFilter] = useState<string>('');
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<CourseData | null>(null);
  const [approvalFeedback, setApprovalFeedback] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState<string>('');
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [hoveredButton, setHoveredButton] = useState<string>('');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    total: 0,
    pages: 0
  });
  const [stats, setStats] = useState<CourseStats>({
    total: 0,
    draft: 0,
    submitted: 0,
    approved: 0,
    published: 0,
    rejected: 0,
    archived: 0,
    pendingApproval: 0
  });

  // Cache management
  const CACHE_KEY = 'admin-courses-data';
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

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
      console.warn('Failed to parse cached courses data:', error);
    }
    return null;
  };

  const setCachedData = (courseData: CourseData[], paginationData: any, statsData: CourseStats) => {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({
        data: { courses: courseData, pagination: paginationData, stats: statsData },
        timestamp: Date.now()
      }));
    } catch (error) {
      console.warn('Failed to cache courses data:', error);
    }
  };

  useEffect(() => {
    // Try to load from cache first
    const cachedData = getCachedData();
    if (cachedData) {
      setCourses(cachedData.courses || []);
      setPagination(cachedData.pagination || { page: 1, limit: 12, total: 0, pages: 0 });
      setStats(cachedData.stats || {
        total: 0, draft: 0, submitted: 0, approved: 0,
        published: 0, rejected: 0, archived: 0, pendingApproval: 0
      });
      // Refresh in background without showing loader
      loadCourses(1, false);
    } else {
      // Only show loading if no cached data
      loadCourses();
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPagination(prev => ({ ...prev, page: 1 }));
      loadCourses(1);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm, statusFilter, categoryFilter, levelFilter]);

  const addToast = (toast: Omit<ToastNotification, 'id'>) => {
    const id = Date.now().toString();
    const newToast = { ...toast, id };
    setToasts(prev => [...prev, newToast]);
    
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, toast.duration || 4000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const loadCourses = async (page = 1, showLoader = true) => {
    try {
      if (showLoader && courses.length === 0) { // Only show loader if no existing data
        setLoading(true);
      }

      const params: any = { page, limit: pagination.limit };
      if (searchTerm.trim()) params.search = searchTerm.trim();
      if (statusFilter) params.status = statusFilter;
      if (categoryFilter) params.category = categoryFilter;
      if (levelFilter) params.level = levelFilter;

      const response = await apiClient.getAdminCourses(params);

      if (response.success && response.data) {
        const { courses: courseData, pagination: paginationData } = response.data;
        
        setCourses(courseData || []);
        setPagination({
          page: paginationData.currentPage || paginationData.page || 1,
          limit: paginationData.itemsPerPage || paginationData.limit || 12,
          total: paginationData.totalItems || paginationData.total || 0,
          pages: paginationData.totalPages || paginationData.pages || 0
        });
        
        // Calculate stats
        const safeCourseData = Array.isArray(courseData) ? courseData : [];
        const statsData: CourseStats = {
          total: paginationData.totalItems || paginationData.total || 0,
          draft: safeCourseData.filter((c: CourseData) => c.status === 'draft').length,
          submitted: safeCourseData.filter((c: CourseData) => c.status === 'submitted' || c.status === 'pending').length,
          approved: safeCourseData.filter((c: CourseData) => c.status === 'approved').length,
          published: safeCourseData.filter((c: CourseData) => c.status === 'published').length,
          rejected: safeCourseData.filter((c: CourseData) => c.status === 'rejected').length,
          archived: safeCourseData.filter((c: CourseData) => c.status === 'archived').length,
                      pendingApproval: safeCourseData.filter((c: CourseData) => c.status === 'submitted' || c.status === 'pending').length
        };
        setStats(statsData);

        // Cache the data
        setCachedData(courseData || [], paginationData, statsData);
      }
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to load courses'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCourseAction = async (courseId: string, action: 'approve' | 'reject' | 'delete') => {
    const course = courses.find(c => c.id === courseId);
    if (!course) {
      addToast({
        type: 'error',
        title: 'Error',
        message: 'Course not found'
      });
      return;
    }

    // Validate action based on course status
    if (action === 'approve' && course.status !== 'submitted' && course.status !== 'pending') {
      addToast({
        type: 'error',
        title: 'Error',
        message: 'Course must be in pending status to approve'
      });
      return;
    }

    try {
      setActionLoading(`${action}-${courseId}`);
      let response;

      // Use the correct course ID - try both course.id and course._id
      const actualCourseId = courseId || course._id || course.id;

      switch (action) {
        case 'approve':
          // Structure feedback properly according to backend validation
          const feedbackData = {
            feedback: approvalFeedback.trim() 
              ? {
                  strengths: [],
                  improvements: [],
                  requirements: [],
                  comments: approvalFeedback.trim()
                }
              : {
                  strengths: ['Well-structured content'],
                  improvements: [],
                  requirements: []
                }
          };
          response = await apiClient.approveCourse(actualCourseId, feedbackData);
          break;
        case 'reject':
          if (!rejectionReason.trim()) {
            addToast({
              type: 'error',
              title: 'Error',
              message: 'Please provide rejection reason'
            });
            setActionLoading('');
            return;
          }
          response = await apiClient.rejectCourse(actualCourseId, rejectionReason);
          break;
        case 'delete':
          if (!window.confirm(`Are you sure you want to delete "${course.title}"? This action cannot be undone.`)) {
            setActionLoading('');
            return;
          }
          response = await apiClient.deleteAdminCourse(actualCourseId);
          
          // If deletion failed due to enrollments, offer force delete
          if (!response.success && response.error?.includes('enrollments')) {
            const forceDelete = window.confirm(
              `${response.error}\n\nDo you want to FORCE DELETE this course and all associated data? This action cannot be undone.`
            );
            
            if (forceDelete) {
              response = await apiClient.deleteAdminCourse(actualCourseId, true);
            } else {
              setActionLoading('');
              return;
            }
          }
          break;
      }

      if (response.success) {
        const messages = {
          approve: 'Course approved & published',
          reject: 'Course rejected',
          delete: 'Course deleted'
        };
        addToast({
          type: 'success',
          title: 'Success',
          message: messages[action as keyof typeof messages] || `Course ${action}d`
        });
        
        setShowApprovalModal(false);
        setShowRejectModal(false);
        setApprovalFeedback('');
        setRejectionReason('');
        setSelectedCourse(null);
        
        // Reload courses to show updated status
        loadCourses(pagination.page);
      } else {
        const errorMessages = {
          approve: 'Failed to approve course',
          reject: 'Failed to reject course', 
          delete: 'Failed to delete course'
        };
        addToast({
          type: 'error',
          title: 'Error',
          message: errorMessages[action as keyof typeof errorMessages] || `Action failed`
        });
      }
    } catch (err: any) {
      const errorMessages = {
        approve: 'Failed to approve course',
        reject: 'Failed to reject course',
        delete: 'Failed to delete course'
      };
      addToast({
        type: 'error',
        title: 'Error',
        message: errorMessages[action as keyof typeof errorMessages] || `Action failed`
      });
    } finally {
      setActionLoading('');
    }
  };

  const openCoursePage = (courseId: string) => {
    navigate(`/course/${courseId}`);
  };

  const getStatusBadge = (status: string) => {
    const configs = {
      draft: { variant: 'default' as const, label: t('admin.courses.status.draft') },
      submitted: { variant: 'default' as const, label: t('admin.courses.status.submitted') },
      pending: { variant: 'default' as const, label: t('admin.courses.status.pending') },
      approved: { variant: 'default' as const, label: t('admin.courses.status.approved') },
      published: { variant: 'default' as const, label: t('admin.courses.status.published') },
      rejected: { variant: 'default' as const, label: t('admin.courses.status.rejected') },
      archived: { variant: 'default' as const, label: t('admin.courses.status.archived') }
    };

    const config = configs[status as keyof typeof configs] || configs.draft;

    return (
      <Badge variant={config.variant} className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
        {config.label}
      </Badge>
    );
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
      {/* Improved Toast Notifications */}
      <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="flex items-center px-4 py-3 rounded-lg shadow-lg border-l-4 transition-all duration-300 ease-in-out transform translate-y-0 opacity-100 max-w-md w-auto min-w-80 bg-blue-50 dark:bg-blue-900/20 border-blue-400 text-blue-800 dark:text-blue-200"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {toast.message}
              </p>
            </div>

            <button
              onClick={() => removeToast(toast.id)}
              className="ml-3 flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t('admin.courses.title')}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          {t('admin.courses.subtitle')}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => {
            setStatusFilter('');
            setCategoryFilter('');
            setLevelFilter('');
            setSearchTerm('');
          }}
        >
          <Card className="p-4 h-24 flex items-center justify-center">
            <div className="text-center w-full">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1 h-4">{t('admin.courses.stats.total')}</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
            </div>
          </Card>
        </div>
        

        
        <div 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => { setStatusFilter('pending'); setCategoryFilter(''); setLevelFilter(''); setSearchTerm(''); }}
        >
          <Card className="p-4 h-24 flex items-center justify-center">
            <div className="text-center w-full">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1 h-4">{t('admin.courses.status.pending')}</p>
              <p className="text-xl font-bold text-blue-500">{stats.submitted}</p>
            </div>
          </Card>
        </div>
        
        <div 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => { setStatusFilter('approved'); setCategoryFilter(''); setLevelFilter(''); setSearchTerm(''); }}
        >
          <Card className="p-4 h-24 flex items-center justify-center">
            <div className="text-center w-full">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1 h-4">{t('admin.courses.status.approved')}</p>
              <p className="text-xl font-bold text-blue-400">{stats.approved}</p>
            </div>
          </Card>
        </div>
        
        <div 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => { setStatusFilter('published'); setCategoryFilter(''); setLevelFilter(''); setSearchTerm(''); }}
        >
          <Card className="p-4 h-24 flex items-center justify-center">
            <div className="text-center w-full">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1 h-4">{t('admin.courses.status.published')}</p>
              <p className="text-xl font-bold text-blue-600">{stats.published}</p>
            </div>
          </Card>
        </div>
        
        <div 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => { setStatusFilter('rejected'); setCategoryFilter(''); setLevelFilter(''); setSearchTerm(''); }}
        >
          <Card className="p-4 h-24 flex items-center justify-center">
            <div className="text-center w-full">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1 h-4">{t('admin.courses.status.rejected')}</p>
              <p className="text-xl font-bold text-blue-300">{stats.rejected}</p>
            </div>
          </Card>
        </div>
        
        <div 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => { setStatusFilter('archived'); setCategoryFilter(''); setLevelFilter(''); setSearchTerm(''); }}
        >
          <Card className="p-4 h-24 flex items-center justify-center">
            <div className="text-center w-full">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1 h-4">{t('admin.courses.status.archived')}</p>
              <p className="text-xl font-bold text-gray-600">{stats.archived}</p>
            </div>
          </Card>
        </div>


      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            type="text"
            placeholder={t('admin.courses.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
        </div>
        
        <div className="flex gap-4">
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full h-12 px-4 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white min-w-32 appearance-none [&::-ms-expand]:hidden"
            >
              <option value="">{t('admin.courses.allStatus')}</option>
              <option value="draft">{t('admin.courses.status.draft')}</option>
              <option value="pending">{t('admin.courses.status.pending')}</option>
              <option value="submitted">{t('admin.courses.status.submitted')}</option>
              <option value="approved">{t('admin.courses.status.approved')}</option>
              <option value="published">{t('admin.courses.status.published')}</option>
              <option value="rejected">{t('admin.courses.status.rejected')}</option>
              <option value="archived">{t('admin.courses.status.archived')}</option>
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none">
              <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          <div className="relative">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full h-12 px-4 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white min-w-36 appearance-none [&::-ms-expand]:hidden"
            >
              <option value="">{t('admin.courses.allCategories')}</option>
              <option value="programming">{t('courses.programming')}</option>
              <option value="design">{t('courses.design')}</option>
              <option value="business-tech">{t('courses.businessTech')}</option>
              <option value="general-it">{t('courses.generalIT')}</option>
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none">
              <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          <div className="relative">
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="w-full h-12 px-4 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white min-w-28 appearance-none [&::-ms-expand]:hidden"
            >
              <option value="">{t('admin.courses.allLevels')}</option>
              <option value="beginner">{t('courses.beginner')}</option>
              <option value="intermediate">{t('courses.intermediate')}</option>
              <option value="advanced">{t('courses.advanced')}</option>
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none">
              <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Simple Course Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {courses.map((course) => (
          <Card key={course.id} className="p-4 hover:shadow-lg transition-shadow">
            <div className="space-y-4">
              {/* Course Title */}
              <div>
                <h3 
                  className="font-semibold text-lg text-gray-900 dark:text-white line-clamp-2 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  onClick={() => openCoursePage(course._id || course.id)}
                >
                  {course.title}
                </h3>
              </div>

              {/* Tutor/Owner */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.courses.tutor')}</p>
                  <p className="font-medium text-gray-900 dark:text-white">{cleanInstructorName(course.instructorName)}</p>
                </div>
                <div>
                  {getStatusBadge(course.status)}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2">
                {(course.status === 'pending' || course.status === 'submitted') && (
                  <>
                    <div className="relative">
                      <button
                        onClick={() => {
                          setSelectedCourse(course);
                          setShowApprovalModal(true);
                        }}
                        disabled={actionLoading.includes(course.id)}
                        className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors disabled:opacity-50"
                        onMouseEnter={() => setHoveredButton(`approve-${course.id}`)}
                        onMouseLeave={() => setHoveredButton('')}
                      >
                        {actionLoading === `approve-${course.id}` ? (
                          <LoadingSpinner size="sm" />
                        ) : (
                          <CheckCircle className="w-4 h-4" />
                        )}
                      </button>
                      {hoveredButton === `approve-${course.id}` && (
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs rounded whitespace-nowrap z-10">
                          {t('admin.courses.approveCourse')}
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-gray-900 dark:border-t-gray-100"></div>
                        </div>
                      )}
                    </div>
                    
                    <div className="relative">
                      <button
                        onClick={() => {
                          setSelectedCourse(course);
                          setShowRejectModal(true);
                        }}
                        disabled={actionLoading.includes(course.id)}
                        className="p-2 text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors disabled:opacity-50"
                        onMouseEnter={() => setHoveredButton(`reject-${course.id}`)}
                        onMouseLeave={() => setHoveredButton('')}
                      >
                        {actionLoading === `reject-${course.id}` ? (
                          <LoadingSpinner size="sm" />
                        ) : (
                          <XCircle className="w-4 h-4" />
                        )}
                      </button>
                      {hoveredButton === `reject-${course.id}` && (
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs rounded whitespace-nowrap z-10">
                          {t('admin.courses.rejectCourse')}
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-gray-900 dark:border-t-gray-100"></div>
                        </div>
                      )}
                    </div>
                  </>
                )}
                
                {(course.status !== 'pending' && course.status !== 'submitted') && (
                  <div className="relative">
                    <button
                      onClick={() => openCoursePage(course._id || course.id)}
                      className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                      onMouseEnter={() => setHoveredButton(`view-${course.id}`)}
                      onMouseLeave={() => setHoveredButton('')}
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {hoveredButton === `view-${course.id}` && (
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs rounded whitespace-nowrap z-10">
                        {t('admin.courses.viewCourse')}
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-gray-900 dark:border-t-gray-100"></div>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="relative">
                  <button
                    onClick={() => handleCourseAction(course.id, 'delete')}
                    disabled={actionLoading.includes(course.id)}
                    className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                    onMouseEnter={() => setHoveredButton(`delete-${course.id}`)}
                    onMouseLeave={() => setHoveredButton('')}
                  >
                    {actionLoading === `delete-${course.id}` ? (
                      <LoadingSpinner size="sm" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                  {hoveredButton === `delete-${course.id}` && (
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs rounded whitespace-nowrap z-10">
                      {t('admin.courses.deleteCourse')}
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-gray-900 dark:border-t-gray-100"></div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-6">
            <Button
              variant="outline"
              size="sm"
            onClick={() => loadCourses(pagination.page - 1)}
            disabled={pagination.page === 1}
            >
              {t('admin.courses.pagination.previous')}
            </Button>
            
          <span className="text-sm text-gray-600 dark:text-gray-400">
              {t('admin.courses.pagination.page')} {pagination.page} {t('admin.courses.pagination.of')} {pagination.pages}
            </span>
            
            <Button
              variant="outline"
              size="sm"
            onClick={() => loadCourses(pagination.page + 1)}
              disabled={pagination.page >= pagination.pages}
            >
              {t('admin.courses.pagination.next')}
            </Button>
        </div>
      )}

      {/* Approval Modal */}
      {showApprovalModal && selectedCourse && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {t('admin.courses.approveModal.title')}
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowApprovalModal(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
            </div>
            
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {t('admin.courses.approveModal.message')} "{selectedCourse.title}"?
              </p>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('admin.courses.approveModal.feedback')}
                </label>
                <textarea
                  value={approvalFeedback}
                  onChange={(e) => setApprovalFeedback(e.target.value)}
                  rows={3}
                  placeholder={t('admin.courses.approveModal.feedbackPlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>
              
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowApprovalModal(false)}
                >
                  {t('admin.courses.approveModal.cancel')}
                </Button>
                <Button
                  onClick={() => handleCourseAction(selectedCourse.id, 'approve')}
                  disabled={actionLoading.includes(selectedCourse.id)}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {actionLoading.includes(selectedCourse.id) ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    t('admin.courses.approveModal.approve')
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {showRejectModal && selectedCourse && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {t('admin.courses.rejectModal.title')}
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowRejectModal(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
            </div>
            
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {t('admin.courses.rejectModal.message')} "{selectedCourse.title}"?
              </p>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('admin.courses.rejectModal.reason')} *
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={3}
                  placeholder={t('admin.courses.rejectModal.reasonPlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>
              
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowRejectModal(false)}
                >
                  {t('admin.courses.approveModal.cancel')}
                </Button>
                <Button
                  onClick={() => handleCourseAction(selectedCourse.id, 'reject')}
                  disabled={actionLoading.includes(selectedCourse.id) || !rejectionReason.trim()}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {actionLoading.includes(selectedCourse.id) ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    t('admin.courses.rejectModal.reject')
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCourses; 