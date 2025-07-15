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
  Search
} from 'lucide-react';

interface Course {
  id: string;
  _id?: string;
  title: string;
  description: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'published';
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
  const { language } = useLanguage();
  const navigate = useNavigate();
  const { myCourses, setMyCourses } = useCourseStore();
  
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<Course[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAllCourses, setShowAllCourses] = useState(false);
  const [myCoursesList, setMyCoursesList] = useState<Course[]>([]);
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

  // Auto-refresh tutor dashboard data
  const autoRefresh = useAutoRefresh({
    interval: 120000, // 2 minutes
    enabled: !loading,
    onRefresh: async () => {
      await Promise.all([
        loadAllCourses(),
        loadMyCourses()
      ]);
    }
  });

  // Load all courses from all tutors for the dashboard view
  const loadAllCourses = async () => {
    try {
      const response = await apiClient.getCourses({ limit: 100, status: 'published' });
      
      if (response.success && response.data) {
        const coursesData = response.data.courses.map((course: any) => ({
          ...course,
          id: course._id || course.id,
          students: course.enrollmentCount || 0,
          rating: course.rating || { average: 0, count: 0 },
          reviews: course.rating?.count || 0,
        }));
        

        
        setAllCourses(coursesData);
        setFilteredCourses(coursesData);
      }
    } catch (err: any) {
      console.error('Failed to load all courses:', err);
    }
  };

  // Filter courses based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredCourses(allCourses);
    } else {
      // Reset showAllCourses when searching
      setShowAllCourses(false);
      const filtered = allCourses.filter(course =>
        course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.instructorName.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredCourses(filtered);
    }
  }, [searchTerm, allCourses]);

  // Get courses to display (9 initially, all when searching or when showAll is true)
  const getCoursesToDisplay = () => {
    if (searchTerm || showAllCourses) {
      return filteredCourses;
    }
    return filteredCourses.slice(0, 9);
  };

  const coursesToDisplay = getCoursesToDisplay();
  const hasMoreCourses = !searchTerm && !showAllCourses && filteredCourses.length > 9;

  // Load tutor's own courses for stats
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
        
        setMyCoursesList(coursesData);
        setMyCourses(coursesData);

        // Calculate stats based on tutor's own courses
        const calculatedStats: TutorStats = {
          totalCourses: coursesData.length,
          publishedCourses: coursesData.filter((c: Course) => c.status === 'approved' || c.status === 'published').length,
          totalStudents: coursesData.reduce((sum: number, course: Course) => sum + course.students, 0),
          avgRating: coursesData.length > 0 ? 
            coursesData.reduce((sum: number, course: Course) => sum + (course.rating.average || 0), 0) / coursesData.length : 0,
          pendingCourses: coursesData.filter((c: Course) => c.status === 'submitted').length,
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
      setError(handleCatchError(err, 'Failed to load courses'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Initialize data loading
  useEffect(() => {
    if (user) {
      loadMyCourses();
      loadAllCourses();
    }
  }, [user]);

  // Navigate to course page
  const openCoursePage = (courseId: string) => {
    navigate(`/course/${courseId}`);
  };

  // Get thumbnail URL
  // Use the same getFileUrl utility used on the course page for consistent URL handling
  const getThumbnailUrl = (course: Course): string => {
    return getFileUrl(course.thumbnail, 'thumbnail');
  };

  // Course card component
  const CourseCard = ({ course }: { course: Course }) => {
    const thumbnailUrl = getThumbnailUrl(course);
    const [imageError, setImageError] = useState(false);
    
    return (
      <div onClick={() => openCoursePage(course.id)} className="cursor-pointer">
        <Card className="group relative overflow-hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-xl transition-all duration-300 rounded-xl">
          {/* Course thumbnail/header */}
          <div className="relative h-48 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/20 overflow-hidden">
            <img 
              src={thumbnailUrl} 
              alt={course.title}
              className="w-full h-full object-cover"
              style={{
                objectFit: 'cover',
                objectPosition: 'center'
              }}
              onError={() => setImageError(true)}
              onLoad={() => setImageError(false)}
              loading="eager"
              crossOrigin="anonymous"
            />

            {/* Status badge */}
            <div className="absolute top-3 left-3">
              <Badge variant={course.status === 'published' ? 'success' : 'default'}>
                {course.status}
              </Badge>
            </div>
          </div>

          {/* Card content */}
          <div className="p-5">
            <div className="mb-4">
              <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2 line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {course.title}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 leading-relaxed">
                {course.description}
              </p>
            </div>

            {/* Course details */}
            <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
              <div className="flex flex-col">
                <span className="text-gray-500 dark:text-gray-400 text-xs font-medium mb-1">Instructor</span>
                <p className="font-semibold text-gray-900 dark:text-white truncate">{course.instructorName}</p>
              </div>
              <div className="flex flex-col">
                <span className="text-gray-500 dark:text-gray-400 text-xs font-medium mb-1">Category</span>
                <p className="font-semibold text-gray-900 dark:text-white truncate">{course.category}</p>
              </div>
              <div className="flex flex-col">
                <span className="text-gray-500 dark:text-gray-400 text-xs font-medium mb-1">Level</span>
                <p className="font-semibold text-gray-900 dark:text-white truncate">{course.level}</p>
              </div>
              <div className="flex flex-col">
                <span className="text-gray-500 dark:text-gray-400 text-xs font-medium mb-1">Status</span>
                <p className="font-bold text-green-600 dark:text-green-400">Free</p>
              </div>
            </div>

            {/* Stats row */}
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                  <Users size={14} />
                  <span className="font-medium">{course.students || 0}</span>
                </div>
                <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                  <Star size={14} className="text-yellow-500" />
                  <span className="font-medium">{course.rating?.average?.toFixed(1) || '0.0'}</span>
                </div>
              </div>
              <div className="text-gray-500 dark:text-gray-400 text-xs">
                <Calendar size={12} className="inline mr-1" />
                {new Date(course.createdAt).toLocaleDateString()}
              </div>
            </div>
          </div>
        </Card>
      </div>
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
            {language === 'rw' ? 'Ikibaho cy\'Umwarimu' : 'Tutor Dashboard'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {language === 'rw' 
              ? `Murakaza neza, ${user?.name}. Reba amasomo yose kandi ukayobora ayawe.`
              : `Welcome back, ${user?.name}. Browse all courses and manage your own.`
            }
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button 
            variant="primary" 
            onClick={() => navigate('/tutor/create-course')}
            className="flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>{language === 'rw' ? 'Kora Isomo' : 'Create Course'}</span>
          </Button>
          <Button 
            variant="outline" 
            onClick={() => {
              loadMyCourses(true);
              loadAllCourses();
            }}
            disabled={refreshing}
            className="flex items-center space-x-2"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{language === 'rw' ? 'Kuvugurura' : 'Refresh'}</span>
          </Button>
        </div>
      </div>

      {/* Stats Cards - Based on tutor's own courses */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                {language === 'rw' ? 'Amasomo Yanjye' : 'My Courses'}
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.totalCourses}
              </p>
            </div>
            <div className="bg-blue-100 dark:bg-blue-900/20 p-3 rounded-full">
              <BookOpen className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </Card>

        <Card className="p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                {language === 'rw' ? 'Abanyeshuri' : 'My Students'}
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.totalStudents}
              </p>
            </div>
            <div className="bg-green-100 dark:bg-green-900/20 p-3 rounded-full">
              <Users className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </Card>

        <Card className="p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                {language === 'rw' ? 'Amanota' : 'Average Rating'}
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.avgRating.toFixed(1)}
              </p>
            </div>
            <div className="bg-yellow-100 dark:bg-yellow-900/20 p-3 rounded-full">
              <Star className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
            </div>
          </div>
        </Card>

        <Card className="p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                {language === 'rw' ? 'Bitegereje' : 'Pending Review'}
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.pendingCourses}
              </p>
            </div>
            <div className="bg-orange-100 dark:bg-orange-900/20 p-3 rounded-full">
              <Clock className="h-6 w-6 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
        </Card>
      </div>

      {/* All Courses Section */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {language === 'rw' ? 'Amasomo Yose' : 'All Available Courses'}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {language === 'rw' 
                ? 'Reba amasomo yose yatangajwe na bose'
                : 'Browse all published courses from all instructors'
              }
            </p>
          </div>
          <Badge variant="default">
            {searchTerm 
              ? `${filteredCourses.length} ${language === 'rw' ? 'zagezemo' : 'found'}`
              : showAllCourses 
                ? `${filteredCourses.length} ${language === 'rw' ? 'amasomo yose' : 'all courses'}`
                : `${Math.min(9, filteredCourses.length)} ${language === 'rw' ? 'kuri' : 'of'} ${filteredCourses.length} ${language === 'rw' ? 'amasomo' : 'courses'}`
            }
          </Badge>
        </div>

        {/* Search Input */}
        <div className="flex items-center mb-6 bg-gray-100 dark:bg-gray-700 rounded-full px-4 py-2 focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-opacity-50">
          <Search className="w-5 h-5 text-gray-500 dark:text-gray-400 mr-2" />
          <input
            type="text"
            placeholder={language === 'rw' ? 'Shakisha amasomo...' : 'Search courses...'}
            className="bg-transparent outline-none flex-1 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="ml-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              ×
            </button>
          )}
        </div>

        {/* Courses Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {coursesToDisplay.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>

        {hasMoreCourses && (
          <div className="text-center py-6">
            <Button variant="outline" onClick={() => setShowAllCourses(true)} className="flex items-center space-x-2">
              <Eye className="w-4 h-4" />
              <span>{language === 'rw' ? 'Tanzwe amasomo' : 'View All Courses'}</span>
            </Button>
          </div>
        )}

        {filteredCourses.length === 0 && allCourses.length === 0 && (
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
        )}

        {searchTerm && filteredCourses.length === 0 && allCourses.length > 0 && (
          <div className="text-center py-12">
            <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {language === 'rw' ? 'Nta masomo zagezemo' : 'No courses found'}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {language === 'rw' 
                ? `Ntago hari amasomo agizemo "${searchTerm}". Gerageza ijambo rishya.`
                : `No courses match "${searchTerm}". Try a different search term.`
              }
            </p>
          </div>
        )}
      </Card>
    </div>
  );
};

export default TutorDashboard; 