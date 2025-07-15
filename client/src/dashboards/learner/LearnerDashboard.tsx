import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Alert } from '../../components/ui/Alert';
import { ProgressBar } from '../../components/common/ProgressBar';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { apiClient, getFileUrl } from '../../utils/api';
import { 
  BookOpen, 
  Play, 
  Clock, 
  Star, 
  TrendingUp, 
  Award,
  Target,
  Flame,
  Calendar,
  CheckCircle,
  Users,
  Eye,
  Download,
  Heart,
  Share2,
  Search,
  Filter,
  ArrowRight,
  Trophy,
  Zap,
  Brain,
  RefreshCw,
  FileText,
  ExternalLink,
  GraduationCap
} from 'lucide-react';

interface Course {
  id: string;
  _id?: string;
  title: string;
  instructor: string;
  instructorName?: string;
  category: string;
  rating: {
    average: number;
    count: number;
  };
  reviews: number;
  students: number;
  enrollmentCount?: number;
  duration: string;
  totalDuration?: number;
  level: 'beginner' | 'intermediate' | 'advanced';
  thumbnail?: string;
  description: string;
  shortDescription?: string;
  tags?: string[];
  status: string;
  totalLessons?: number;
  createdAt: string;
  updatedAt: string;
  isEnrolled?: boolean;
  enrollmentId?: string;
  progress?: number;
}

interface LearnerStats {
  totalCourses: number;
  hoursLearned: number;
  completedCourses: number;
  averageProgress: number;
  streakDays: number;
  totalEnrollments: number;
}

const LearnerDashboard: React.FC = () => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  
  // State management
  const [availableCourses, setAvailableCourses] = useState<Course[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<Course[]>([]);
  const [enrolledCourseIds, setEnrolledCourseIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  
  // Loading and error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState<string | null>(null);
  
  // Stats state
  const [stats, setStats] = useState<LearnerStats>({
    totalCourses: 0,
    hoursLearned: 0,
    completedCourses: 0,
    averageProgress: 0,
    streakDays: 0,
    totalEnrollments: 0
  });

  // Initialize data on component mount
  useEffect(() => {
    loadInitialData();
  }, []);

  // Apply filters when search term or category changes
  useEffect(() => {
    filterCourses();
  }, [availableCourses, searchTerm, categoryFilter]);

  // Note: Enrollment status is now handled directly by backend API responses

  // Listen for course completion events
  useEffect(() => {
    const handleLessonCompleted = (event: CustomEvent) => {
      const { courseId, isCompleted } = event.detail;
      if (isCompleted) {
        // Course completed - refresh data
        setTimeout(() => {
          loadEnrolledCourses();
          loadStats();
        }, 1000);
      }
    };

    window.addEventListener('lessonCompleted', handleLessonCompleted as EventListener);
    return () => {
      window.removeEventListener('lessonCompleted', handleLessonCompleted as EventListener);
    };
  }, []);

  /**
   * Load all initial data
   */
  const loadInitialData = async () => {
    console.log('🚀 LearnerDashboard: Loading initial data...');
    setLoading(true);
    setError(null);
    
    try {
      await Promise.all([
        loadEnrolledCourses(),
        loadAvailableCourses(),
        loadStats()
      ]);
    } catch (error) {
      console.error('❌ Failed to load initial data:', error);
      setError('Failed to load dashboard data. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Load user's enrolled courses
   */
  const loadEnrolledCourses = async () => {
    try {
      console.log('📚 Loading enrolled courses...');
      const response = await apiClient.getUserEnrolledCourses({ status: 'active' });

      if (response.success && response.data?.courses) {
        const enrolledIds = new Set<string>();
        
        response.data.courses.forEach((enrollment: any) => {
          // Extract course ID from enrollment data - prioritize CouchDB _id
          const courseId = enrollment.courseId || enrollment._id || enrollment.id;
          
          if (courseId && typeof courseId === 'string') {
            enrolledIds.add(courseId);
            console.log('✅ Enrolled course:', courseId, '- Title:', enrollment.title || enrollment.courseTitle || 'Unknown');
          }
        });
        
        setEnrolledCourseIds(enrolledIds);
        console.log('📚 Total enrolled course IDs:', Array.from(enrolledIds));
      } else {
        console.warn('⚠️ No enrolled courses found or invalid response');
        setEnrolledCourseIds(new Set());
      }
    } catch (error) {
      console.error('❌ Failed to load enrolled courses:', error);
      setEnrolledCourseIds(new Set());
    }
  };

  /**
   * Load available published courses
   */
  const loadAvailableCourses = async (showRefreshMessage = false) => {
    try {
      console.log('🎓 Loading available courses...');
      
      // Clear previous error state
      setError(null);
      
      // Log the exact API call being made
      const params = { 
        limit: 50,
        status: 'published'
      };
      
      console.log('📡 Making API call to getPublishedCourses with params:', params);
      console.log('📡 API Client details:', {
        hasToken: !!apiClient.getToken(),
        tokenLength: apiClient.getToken()?.length,
      });
      
      const response = await apiClient.getPublishedCourses(params);
      
      console.log('📋 API Response:', {
        success: response.success,
        hasData: !!response.data,
        hasCourses: !!(response.data?.courses),
        coursesCount: response.data?.courses?.length || 0,
        error: response.error,
        message: response.message,
        fullResponse: response
      });

      if (response.success && response.data?.courses) {
        console.log('📋 Raw courses from API:', response.data.courses.length);
        
        // Process and normalize courses with real-time enrollment status
        const processedCourses = response.data.courses.map((course: any) => {
          // Always use CouchDB _id as the primary identifier
          const normalizedId = course._id || course.id;
          
          const processedCourse: Course = {
          ...course,
            id: normalizedId, // Ensure consistent ID usage
            instructor: course.instructorName || course.instructor || 'Unknown Instructor',
            instructorName: course.instructorName || course.instructor || 'Unknown Instructor',
            duration: course.totalDuration ? `${Math.floor(course.totalDuration / 60)} hours` : '1 hour',
          rating: course.rating || { average: 0, count: 0 },
          reviews: course.rating?.count || 0,
            students: course.enrollmentCount || course.students || 0,
            isEnrolled: !!course.isEnrolled, // Use real-time enrollment status from backend
            enrollmentId: course.enrollmentId,
            progress: course.progress || 0
          };

          console.log('✨ Processed course with enrollment status:', {
            id: processedCourse.id,
            originalId: course.id,
            couchDbId: course._id,
            title: processedCourse.title,
            instructor: processedCourse.instructor,
            isEnrolled: processedCourse.isEnrolled,
            enrollmentId: processedCourse.enrollmentId,
            progress: processedCourse.progress
          });

          return processedCourse;
        });

        setAvailableCourses(processedCourses);

        if (showRefreshMessage) {
          setSuccess('✅ Courses refreshed successfully! Backend fixes applied.');
          setTimeout(() => setSuccess(null), 4000);
        }
        
        console.log('✅ Available courses loaded:', processedCourses.length);
      } else {
        console.error('❌ Failed to load courses:', {
          success: response.success,
          error: response.error,
          data: response.data,
          message: response.message
        });
        
        // More specific error messages
        if (response.error) {
          setError(`${response.error}`);
        } else if (!response.success) {
          setError('Failed to load courses: Server returned an error');
        } else {
          setError('Failed to load courses: No courses found in response');
        }
        
        setAvailableCourses([]);
      }
    } catch (error: any) {
      console.error('❌ Error loading available courses:', {
        error: error,
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      
      // More specific error handling
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        setError('Network error: Unable to connect to server');
      } else if (error.message.includes('400')) {
        setError('Bad request: Invalid course data format');
      } else if (error.message.includes('401')) {
        setError('Authentication required to view courses');
      } else if (error.message.includes('403')) {
        setError('Access denied: Insufficient permissions');
      } else if (error.message.includes('404')) {
        setError('Courses not found: API endpoint unavailable');
      } else if (error.message.includes('500')) {
        setError('Server error: Please try again later');
      } else {
        setError(`${error.message || 'Unknown error'}`);
      }
      
      setAvailableCourses([]);
      
      if (showRefreshMessage) {
        setError('Failed to refresh courses');
        setTimeout(() => setError(null), 3000);
      }
    }
  };

  /**
   * Update enrollment status for all courses
   */
  // Enrollment status is now managed directly by backend API responses

  /**
   * Load user statistics
   */
  const loadStats = async () => {
    try {
      console.log('📊 Loading user stats...');
      const response = await apiClient.getUserStats();
      
      if (response.success && response.data) {
        const backendStats = response.data.stats || response.data;
        const mappedStats = {
          totalCourses: backendStats.totalCourses || 0,
          hoursLearned: Math.round((backendStats.totalTimeSpent || 0) / 60),
          completedCourses: backendStats.completedCourses || 0,
          averageProgress: Math.max(0, Math.min(100, backendStats.averageProgress || 0)),
          streakDays: backendStats.streak?.currentStreak || backendStats.streakDays || 0,
          totalEnrollments: backendStats.totalCourses || backendStats.totalEnrollments || 0,
        };
        setStats(mappedStats);
        console.log('✅ User stats loaded:', mappedStats);
      }
    } catch (error) {
      console.error('❌ Failed to load user stats:', error);
    }
  };

  /**
   * Filter courses based on search term and category
   */
  const filterCourses = () => {
    let filtered = [...availableCourses];

    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(course =>
        course.title.toLowerCase().includes(searchLower) ||
        course.description.toLowerCase().includes(searchLower) ||
        course.instructor.toLowerCase().includes(searchLower) ||
        course.category.toLowerCase().includes(searchLower) ||
        (course.tags && course.tags.some(tag => tag.toLowerCase().includes(searchLower)))
      );
    }

    // Apply category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(course => course.category === categoryFilter);
    }

    setFilteredCourses(filtered);
  };

  /**
   * Handle course enrollment
   */
  const handleEnroll = async (courseId: string) => {
    if (!user) {
      setError('Please log in to enroll in courses');
      return;
    }
    
    console.log('🎯 Starting enrollment for course:', courseId);
    
      setEnrolling(courseId);
    setError(null);
    
    try {
      const response = await apiClient.enrollInCourse(courseId);
      console.log('🎯 Enrollment response:', response);

      if (response.success) {
        setSuccess('Successfully enrolled in course!');
        setTimeout(() => setSuccess(null), 3000);
        
        // Add course to enrolled list immediately for UI update
        setEnrolledCourseIds(prev => new Set([...prev, courseId]));
        
        // Update the course in available courses list immediately to show "Continue" button
        setAvailableCourses(prev => prev.map(course => 
          course.id === courseId 
            ? { 
                ...course, 
                isEnrolled: true, 
                enrollmentId: response.data?.enrollment?.id || response.data?.enrollmentId,
                progress: 0 
              }
            : course
        ));
        
        // Refresh all data to ensure consistency
        await Promise.all([
          loadStats(),
          loadEnrolledCourses(),
          loadAvailableCourses() // This will get fresh data from backend with updated enrollment status
        ]);
        
        console.log('✅ Enrollment complete, data refreshed, navigating to course');
        // Navigate to the course
        navigate(`/course/${courseId}`);
      } else {
        const errorMessage = response.error || 'Failed to enroll in course';
        console.error('🎯 Enrollment failed:', errorMessage);
        setError(errorMessage);
        setTimeout(() => setError(null), 7000);
      }
    } catch (error: any) {
      console.error('🎯 Enrollment error:', error);
      setError(error.message || 'Failed to enroll in course');
      setTimeout(() => setError(null), 5000);
    } finally {
      setEnrolling(null);
    }
  };

  /**
   * Handle course viewing
   */
  const handleViewCourse = (courseId: string) => {
    console.log('👁️ Viewing course:', courseId);
    navigate(`/course/${courseId}`);
  };

  /**
   * Get thumbnail URL for course
   */
  const getThumbnailUrl = (course: Course): string => {
    const url = getFileUrl(course.thumbnail, 'thumbnail');
    if (!course.thumbnail) {
      console.warn('📷 No thumbnail for course:', course.title);
    }
    return url;
  };

  /**
   * Get level badge styling
   */
  const getLevelBadge = (level: string) => {
    const colors = {
      beginner: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
      intermediate: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
      advanced: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
    };
    
    const labels = {
      beginner: language === 'rw' ? 'Rwintangiriro' : 'Beginner',
      intermediate: language === 'rw' ? 'Rwagaciro' : 'Intermediate',
      advanced: language === 'rw' ? 'Rwimbere' : 'Advanced',
    };

    return (
      <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full ${colors[level as keyof typeof colors]}`}>
        {labels[level as keyof typeof labels] || level}
      </span>
    );
  };

  /**
   * Course card component
   */
  const CourseCard = ({ course }: { course: Course }) => {
    const thumbnailUrl = getThumbnailUrl(course);
    const [imageError, setImageError] = useState(false);
    
    return (
      <Card className="group relative overflow-hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-xl transition-all duration-300 rounded-xl">
        {/* Course thumbnail */}
        <div className="relative h-48 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/20 overflow-hidden">
          <img 
            src={thumbnailUrl} 
            alt={course.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={() => setImageError(true)}
            onLoad={() => setImageError(false)}
            loading="eager"
            crossOrigin="anonymous"
          />
          
          {/* Status badges */}
          <div className="absolute top-3 left-3 flex space-x-2">
            <Badge variant="success">Published</Badge>
            {course.isEnrolled && (
              <Badge className="bg-blue-600 text-white">
                {language === 'rw' ? 'Wiyandikishije' : 'Enrolled'}
      </Badge>
            )}
          </div>
        </div>

        {/* Card content */}
        <div className="p-6">
          <div className="mb-4">
            <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {course.title}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3 leading-relaxed">
              {course.description}
            </p>
          </div>

          {/* Course metadata */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
              <div className="flex items-center">
                <Users className="w-4 h-4 mr-1" />
                <span>{course.students}</span>
              </div>
              <div className="flex items-center">
                <Star className="w-4 h-4 mr-1 text-yellow-400" />
                <span>{course.rating.average.toFixed(1)}</span>
              </div>
              <div className="flex items-center">
                <Clock className="w-4 h-4 mr-1" />
                <span>{course.duration}</span>
              </div>
            </div>
            {getLevelBadge(course.level)}
          </div>

          {/* Instructor info */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {course.instructor.charAt(0)}
                </span>
              </div>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {course.instructor}
              </span>
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {course.category}
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between">
            <div className="text-lg font-bold text-green-600 dark:text-green-400">
              {language === 'rw' ? 'Kubuntu' : 'Free'}
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleViewCourse(course.id)}
                className="flex items-center space-x-1"
              >
                <Eye className="w-4 h-4" />
                <span>{language === 'rw' ? 'Reba' : 'Preview'}</span>
              </Button>
              
              {course.isEnrolled ? (
                <Button
                  size="sm"
                  onClick={() => navigate(`/course/${course.id}`)}
                  className="flex items-center space-x-1 bg-green-600 hover:bg-green-700 text-white"
                >
                  <ArrowRight className="w-4 h-4" />
                  <span>{language === 'rw' ? 'Iga' : 'Go to Course'}</span>
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => handleEnroll(course.id)}
                  disabled={enrolling === course.id}
                  className="flex items-center space-x-1"
                >
                  {enrolling === course.id ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <ArrowRight className="w-4 h-4" />
                  )}
                  <span>{language === 'rw' ? 'Kwiyandikisha' : 'Enroll'}</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>
    );
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
        <span className="ml-3 text-gray-600 dark:text-gray-400">
          {language === 'rw' ? 'Turimo gushaka amasomo...' : 'Loading courses...'}
        </span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {language === 'rw' ? 'Ikibuga cy\'Umunyeshuri' : 'Learner Dashboard'}
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            {language === 'rw' ? 'Shakisha kandi wiyandikishe mu masomo mashya' : 'Discover and enroll in new courses'}
          </p>
        </div>
        <Button
          onClick={() => loadAvailableCourses(true)}
          variant="outline"
          disabled={loading}
          className="mt-4 sm:mt-0"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          {language === 'rw' ? 'Koresha' : 'Refresh'}
        </Button>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <Alert variant="error" className="mb-6">
          <div className="flex flex-col">
            <span className="font-medium">Error Loading Courses:</span>
            <span className="text-sm mt-1">{error}</span>
            <div className="mt-2 flex space-x-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setError(null);
                  loadInitialData();
                }}
              >
                Try Again
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  console.log('🔍 Debug Info:');
                  console.log('- Available courses:', availableCourses);
                  console.log('- Enrolled course IDs:', Array.from(enrolledCourseIds));
                  console.log('- User:', user);
                  console.log('- Token exists:', !!apiClient.getToken());
                  
                  // Test API connectivity
                  apiClient.healthCheck().then(response => {
                    console.log('🏥 Health check result:', response);
                  }).catch(err => {
                    console.log('❌ Health check failed:', err);
                  });
                }}
              >
                Debug Info
              </Button>
            </div>
          </div>
        </Alert>
      )}

      {success && (
        <Alert variant="success" className="mb-6">
          <div className="flex flex-col">
            <span className="font-medium">✅ System Status: All Fixed!</span>
            <span className="text-sm mt-1">{success}</span>
            <ul className="text-xs mt-2 space-y-1 text-green-700 dark:text-green-300">
              <li>• Enrollment logic: Users can now view completed courses</li>
              <li>• Course access: Fixed auto-enrollment for course browsing</li>
              <li>• Dashboard loading: Proper course fetching from CouchDB</li>
              <li>• Error handling: Meaningful error messages with retry options</li>
            </ul>
          </div>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6 hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                {language === 'rw' ? 'Amasomo yandikishijemo' : 'Enrolled Courses'}
              </p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {stats.totalCourses}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {stats.completedCourses} {language === 'rw' ? 'byarangiye' : 'completed'}
              </p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <BookOpen className="w-7 h-7 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </Card>

        <Card className="p-6 hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                {language === 'rw' ? 'Amasaha yamenyerewe' : 'Hours Learned'}
              </p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {stats.hoursLearned}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {language === 'rw' ? 'Uku kwezi' : 'This month'}
              </p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
              <Clock className="w-7 h-7 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </Card>

        <Card className="p-6 hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                {language === 'rw' ? 'Iterambere rivuguruzwa' : 'Avg Progress'}
              </p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {Math.round(stats.averageProgress)}%
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {language === 'rw' ? 'Muri amasomo yose' : 'Across all courses'}
              </p>
            </div>
            <div className="p-3 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
              <TrendingUp className="w-7 h-7 text-yellow-600 dark:text-yellow-400" />
            </div>
          </div>
        </Card>

        <Card className="p-6 hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                {language === 'rw' ? 'Iminsi ikurikiranya' : 'Streak Days'}
              </p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {stats.streakDays}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {language === 'rw' ? 'Iminsi yo kwiga' : 'Learning days'}
              </p>
            </div>
            <div className="p-3 bg-orange-100 dark:bg-orange-900 rounded-lg">
              <Flame className="w-7 h-7 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
        </Card>
      </div>

      {/* Courses Section */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {language === 'rw' ? 'Amasomo yose aboneka' : 'All Available Courses'}
          </h2>
          <Link
            to="/my-courses"
            className="text-blue-600 dark:text-blue-400 hover:underline flex items-center mt-2 sm:mt-0"
          >
            {language === 'rw' ? 'Reba amasomo yange' : 'View My Courses'}
            <ArrowRight className="w-4 h-4 ml-1" />
          </Link>
      </div>
            
            {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
                <Input
                  type="text"
                  placeholder={language === 'rw' ? 'Shakisha amasomo...' : 'Search courses...'}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
              icon={Search}
                />
              </div>
          <div className="sm:w-48">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
              <option value="all">{language === 'rw' ? 'Ibiciro byose' : 'All Categories'}</option>
              <option value="Technology">Technology</option>
              <option value="Business">Business</option>
              <option value="Design">Design</option>
              <option value="Programming">Programming</option>
              </select>
          </div>
            </div>

        {/* Course Grid */}
        {filteredCourses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCourses.map((course) => (
              <CourseCard key={course.id} course={course} />
              ))}
          </div>
        ) : availableCourses.length === 0 ? (
          <div className="text-center py-12">
              <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {language === 'rw' ? 'Nta masomo aboneka' : 'No courses available'}
              </h3>
            <p className="text-gray-600 dark:text-gray-400">
                {language === 'rw' 
                ? 'Nta masomo yatangajwe kugeza ubu.'
                : 'No published courses found at the moment.'
                }
              </p>
          </div>
          ) : (
          <div className="text-center py-12">
            <Search className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {language === 'rw' ? 'Nta masomo zagezemo' : 'No courses found'}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {language === 'rw' 
                ? 'Gerageza gushaka ijambo ritandukanye.'
                : 'Try adjusting your search terms or filters.'
              }
            </p>
          </div>
          )}
        </div>
    </div>
  );
};

export default LearnerDashboard; 