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
  X,
  BookOpen,
  Search,
  RefreshCw,
  Clock,
  Star,
  Users,
  Calendar
} from 'lucide-react';
import { apiClient, cleanInstructorName, getFileUrl } from '../../utils/api';

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
  const [loading, setLoading] = useState(false);
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
      const cacheData = {
        courses: courseData,
        pagination: paginationData,
        stats: statsData,
        timestamp: Date.now()
      };
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to cache courses data:', error);
    }
  };

  const addToast = (toast: Omit<ToastNotification, 'id'>) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { ...toast, id }]);
    setTimeout(() => removeToast(id), toast.duration || 5000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const loadCourses = async (page = 1, showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      
      // Check cache first
      const cached = getCachedData();
      if (cached && page === 1) {
        setCourses(cached.courses);
        setPagination(cached.pagination);
        setStats(cached.stats);
        return;
      }

      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
        ...(statusFilter && { status: statusFilter }),
        ...(categoryFilter && { category: categoryFilter }),
        ...(levelFilter && { level: levelFilter }),
        ...(searchTerm && { search: searchTerm })
      });

      const response = await apiClient.getAdminCourses(params);
      
      if (response.success) {
        const courseData = response.data.courses || [];
        const paginationData = response.data.pagination || {};
        const statsData = response.data.stats || {};

        // Calculate stats from course data if not provided by backend
        const calculatedStats = {
          total: statsData.total || courseData.length,
          draft: statsData.draft || courseData.filter((c: CourseData) => c.status === 'draft').length,
          submitted: statsData.submitted || courseData.filter((c: CourseData) => c.status === 'submitted').length,
          approved: statsData.approved || courseData.filter((c: CourseData) => c.status === 'approved').length,
          published: statsData.published || courseData.filter((c: CourseData) => c.status === 'published').length,
          rejected: statsData.rejected || courseData.filter((c: CourseData) => c.status === 'rejected').length,
          archived: statsData.archived || courseData.filter((c: CourseData) => c.status === 'archived').length,
          pendingApproval: statsData.pendingApproval || courseData.filter((c: CourseData) => c.status === 'pending' || c.status === 'submitted').length,
        };

        setCourses(courseData);
        setPagination(paginationData);
        setStats(calculatedStats);

        // Cache the data
        setCachedData(courseData || [], paginationData, calculatedStats);
      } else {
        addToast({ type: 'error', title: 'Error', message: response.error || 'Failed to load courses' });
      }
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message || 'Failed to load courses' });
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
              handleCourseAction(courseId, 'delete');
              return;
            }
          }
          break;
      }

      if (response.success) {
        addToast({
          type: 'success',
          title: 'Success',
          message: `Course ${action}d successfully!`
        });
        
        // Reset modals
        setShowApprovalModal(false);
        setShowRejectModal(false);
        setSelectedCourse(null);
        setApprovalFeedback('');
        setRejectionReason('');
        
        loadCourses(pagination.page);
      } else {
        addToast({
          type: 'error',
          title: 'Error',
          message: response.error || `Failed to ${action} course`
        });
      }
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message || `Failed to ${action} course` });
    } finally {
      setActionLoading('');
    }
  };

  const openCoursePage = (courseId: string) => {
    navigate(`/course/${courseId}`);
  };

  const getStatusBadge = (status: string) => {
    const statusConfigs = {
      published: { 
        label: 'Published', 
        className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      },
      approved: { 
        label: 'Approved', 
        className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      },
      pending: { 
        label: 'Pending', 
        className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      },
      submitted: { 
        label: 'Submitted', 
        className: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
      },
      rejected: { 
        label: 'Rejected', 
        className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      },
      draft: { 
        label: 'Draft', 
        className: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
      },
      archived: { 
        label: 'Archived', 
        className: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
      }
    };
    
    const config = statusConfigs[status as keyof typeof statusConfigs] || statusConfigs.draft;
    
    return (
      <Badge variant="default" className={config.className}>
        {config.label}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    
    // Check if date is valid and not in the future
    if (isNaN(date.getTime()) || date > new Date()) {
      // If date is invalid or in the future, return a fallback
      return 'N/A';
    }
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  useEffect(() => {
    loadCourses();
  }, [statusFilter, categoryFilter, levelFilter, searchTerm]);

  const filteredCourses = courses.filter(course => {
    const matchesSearch = !searchTerm || 
      course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      course.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cleanInstructorName(course.instructorName).toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !statusFilter || course.status === statusFilter;
    const matchesCategory = !categoryFilter || course.category === categoryFilter;
    const matchesLevel = !levelFilter || course.level === levelFilter;
    return matchesSearch && matchesStatus && matchesCategory && matchesLevel;
  });

  return (
    <div className="space-y-6">
      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`p-4 rounded-lg shadow-lg max-w-sm transform transition-all duration-300 ${
              toast.type === 'success' ? 'bg-green-500 text-white' :
              toast.type === 'error' ? 'bg-red-500 text-white' :
              toast.type === 'warning' ? 'bg-yellow-500 text-white' :
              'bg-blue-500 text-white'
            }`}
          >
            <div className="font-semibold">{toast.title}</div>
            <div className="text-sm opacity-90">{toast.message}</div>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('admin.courses.title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {t('admin.courses.description')}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            onClick={() => loadCourses(pagination.page, true)}
            variant="outline"
            className="flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            {t('admin.courses.refresh')}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('admin.courses.totalCourses')}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
            </div>
            <BookOpen className="w-8 h-8 text-blue-500" />
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('admin.courses.published')}</p>
              <p className="text-2xl font-bold text-green-600">{stats.published}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('admin.courses.pending')}</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.pendingApproval}</p>
            </div>
            <Clock className="w-8 h-8 text-yellow-500" />
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('admin.courses.draft')}</p>
              <p className="text-2xl font-bold text-gray-600">{stats.draft}</p>
            </div>
            <BookOpen className="w-8 h-8 text-gray-500" />
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('admin.courses.search')}
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="text"
                placeholder={t('admin.courses.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <div className="flex gap-6">
            <div className="w-48">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('admin.courses.status')}
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="">{t('admin.courses.allStatuses')}</option>
                <option value="published">{t('admin.courses.published')}</option>
                <option value="approved">{t('admin.courses.approved')}</option>
                <option value="pending">{t('admin.courses.pending')}</option>
                <option value="submitted">{t('admin.courses.submitted')}</option>
                <option value="rejected">{t('admin.courses.rejected')}</option>
                <option value="draft">{t('admin.courses.draft')}</option>
              </select>
            </div>
            
            <div className="w-48">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('admin.courses.category')}
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="">{t('admin.courses.allCategories')}</option>
                <option value="technology">Technology</option>
                <option value="business">Business</option>
                <option value="design">Design</option>
                <option value="marketing">Marketing</option>
                <option value="lifestyle">Lifestyle</option>
              </select>
            </div>
            
            <div className="w-48">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('admin.courses.level')}
              </label>
              <select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="">{t('admin.courses.allLevels')}</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
          </div>
        </div>
      </Card>

      {/* Courses Table */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('admin.courses.course')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('admin.courses.instructor')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('admin.courses.status')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('admin.courses.enrollments')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('admin.courses.rating')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('admin.courses.created')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('admin.courses.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredCourses.map((course) => (
                  <tr key={course.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {course.thumbnail ? (
                          <img
                            src={getFileUrl(course.thumbnail, 'thumbnail')}
                            alt={course.title}
                            className="w-12 h-12 rounded-lg object-cover"
                            onError={(e) => {
                              // Fallback to icon if image fails to load
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              target.nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                        ) : null}
                        <div className={`w-12 h-12 bg-gradient-to-br from-green-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-semibold text-sm ${course.thumbnail ? 'hidden' : ''}`}>
                          <BookOpen className="w-6 h-6" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-white max-w-xs truncate">
                            {course.title}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                            {course.description}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gray-500 dark:text-gray-400">{course.category}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">•</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">{course.level}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {cleanInstructorName(course.instructorName)}
                      </div>
                      {course.instructorEmail && (
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {course.instructorEmail}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(course.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-900 dark:text-white">
                          {course.enrollments || course.enrollmentCount || 0}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-400" />
                        <span className="text-sm text-gray-900 dark:text-white">
                          {course.rating?.toFixed(1) || '0.0'}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          ({course.totalRatings || 0})
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(course.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
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
                        
                        {(course.status === 'submitted' || course.status === 'pending') && (
                          <div className="relative">
                            <button
                              onClick={() => {
                                setSelectedCourse(course);
                                setShowApprovalModal(true);
                              }}
                              disabled={actionLoading === `approve-${course.id}`}
                              className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors disabled:opacity-50"
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
                                {t('admin.courses.approve')}
                                <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-gray-900 dark:border-t-gray-100"></div>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {(course.status === 'submitted' || course.status === 'pending') && (
                          <div className="relative">
                            <button
                              onClick={() => {
                                setSelectedCourse(course);
                                setShowRejectModal(true);
                              }}
                              disabled={actionLoading === `reject-${course.id}`}
                              className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
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
                                {t('admin.courses.reject')}
                                <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-gray-900 dark:border-t-gray-100"></div>
                              </div>
                            )}
                          </div>
                        )}
                        
                        <div className="relative">
                          <button
                            onClick={() => handleCourseAction(course.id, 'delete')}
                            disabled={actionLoading === `delete-${course.id}`}
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
                              {t('admin.courses.delete')}
                              <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-gray-900 dark:border-t-gray-100"></div>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

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
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                {t('admin.courses.approveCourse')}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {t('admin.courses.approveCourseDesc')} "{selectedCourse.title}"?
              </p>
              <textarea
                value={approvalFeedback}
                onChange={(e) => setApprovalFeedback(e.target.value)}
                placeholder={t('admin.courses.approvalFeedbackPlaceholder')}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white mb-4"
                rows={3}
              />
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowApprovalModal(false);
                    setSelectedCourse(null);
                    setApprovalFeedback('');
                  }}
                >
                  {t('admin.courses.cancel')}
                </Button>
                <Button
                  onClick={() => handleCourseAction(selectedCourse.id, 'approve')}
                  disabled={actionLoading === `approve-${selectedCourse.id}`}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {actionLoading === `approve-${selectedCourse.id}` ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    t('admin.courses.approve')
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
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                {t('admin.courses.rejectCourse')}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {t('admin.courses.rejectCourseDesc')} "{selectedCourse.title}"?
              </p>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder={t('admin.courses.rejectionReasonPlaceholder')}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white mb-4"
                rows={3}
                required
              />
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowRejectModal(false);
                    setSelectedCourse(null);
                    setRejectionReason('');
                  }}
                >
                  {t('admin.courses.cancel')}
                </Button>
                <Button
                  onClick={() => handleCourseAction(selectedCourse.id, 'reject')}
                  disabled={actionLoading === `reject-${selectedCourse.id}` || !rejectionReason.trim()}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {actionLoading === `reject-${selectedCourse.id}` ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    t('admin.courses.reject')
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