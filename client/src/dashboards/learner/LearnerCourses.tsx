import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Play, Clock, CheckCircle, Star, Search, Eye, TrendingUp } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { apiClient } from '../../utils/api';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Alert } from '../../components/ui/Alert';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ProgressBar } from '../../components/common/ProgressBar';

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
  duration: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  thumbnail?: string;
  description: string;
  progress?: number;
  isEnrolled?: boolean;
  enrollmentId?: string;
  completedLessons?: number;
  totalLessons?: number;
}

interface CourseStats {
  totalEnrolled: number;
  totalCompleted: number;
  totalHours: number;
  avgRating: number;
}

const LearnerCourses: React.FC = () => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState<'in-progress' | 'completed'>('in-progress');
  const [enrolledCourses, setEnrolledCourses] = useState<Course[]>([]);
  const [stats, setStats] = useState<CourseStats>({
    totalEnrolled: 0,
    totalCompleted: 0,
    totalHours: 0,
    avgRating: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Load enrolled courses
  const loadEnrolledCourses = async () => {
    try {
      const response = await apiClient.getEnrolledCourses({ limit: 100 });
      
      if (response.success && response.data) {
        const coursesData = response.data.courses.map((course: any) => ({
          ...course,
          id: course._id || course.id,
          instructor: course.instructorName || course.instructor,
          rating: course.rating || { average: 0, count: 0 },
          duration: course.totalDuration ? `${Math.round(course.totalDuration / 3600)} hours` : '0 hours',
          progress: course.enrollment?.progress || 0,
          isEnrolled: true,
          enrollmentId: course.enrollment?.id,
          completedLessons: course.progress?.completedLessons || 0,
          totalLessons: course.totalLessons || 0,
        }));
        
        setEnrolledCourses(coursesData);
        
        // Calculate stats
        const totalHours = coursesData.reduce((sum: number, course: Course) => {
          const hours = parseInt(course.duration) || 0;
          return sum + (hours * (course.progress || 0) / 100);
        }, 0);
        
        const avgRating = coursesData.length > 0 ? 
          coursesData.reduce((sum: number, course: Course) => sum + course.rating.average, 0) / coursesData.length : 0;
        
        setStats({
          totalEnrolled: coursesData.length,
          totalCompleted: coursesData.filter((c: Course) => (c.progress || 0) >= 100).length,
          totalHours: Math.round(totalHours),
          avgRating: Math.round(avgRating * 10) / 10
        });
      } else {
        setError(response.error || 'Failed to load enrolled courses');
      }
    } catch (err: any) {
      console.error('Failed to load enrolled courses:', err);
      setError(err.message || 'Failed to load enrolled courses');
    }
  };

  // Initialize data
  useEffect(() => {
    if (user) {
      loadEnrolledCourses().finally(() => setLoading(false));
    }
  }, [user]);

  // Filter courses based on tab and search
  const getFilteredCourses = () => {
    let filtered = enrolledCourses;

    // Filter by tab
    if (activeTab === 'completed') {
      filtered = filtered.filter(course => (course.progress || 0) >= 100);
    } else if (activeTab === 'in-progress') {
      filtered = filtered.filter(course => (course.progress || 0) < 100);
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(course => 
        course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.instructor.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.category.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by category
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(course => 
        course.category.toLowerCase() === categoryFilter.toLowerCase()
      );
    }

    return filtered;
  };

  const getLevelBadge = (level: string) => {
    const levelColors = {
      beginner: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      intermediate: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300', 
      advanced: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
    };

    return (
      <Badge className={levelColors[level as keyof typeof levelColors] || levelColors.beginner}>
        {level}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {language === 'rw' ? 'Amasomo Yanjye' : 'My Courses'}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {language === 'rw' 
              ? 'Komeza urugendo rwawe rwo kwiga'
              : 'Continue your learning journey'
            }
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <Button onClick={() => navigate('/dashboard')}>
            <BookOpen className="w-4 h-4 mr-2" />
            {language === 'rw' ? 'Shakisha Amasomo' : 'Browse Courses'}
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="error">
          {error}
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                {language === 'rw' ? 'Amasomo Yandikishije' : 'Enrolled Courses'}
              </p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {stats.totalEnrolled}
              </p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <BookOpen className="w-7 h-7 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                {language === 'rw' ? 'Byarangiye' : 'Completed'}
              </p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {stats.totalCompleted}
              </p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
              <CheckCircle className="w-7 h-7 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                {language === 'rw' ? 'Amasaha Yize' : 'Hours Learned'}
              </p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {stats.totalHours}
              </p>
            </div>
            <div className="p-3 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
              <Clock className="w-7 h-7 text-yellow-600 dark:text-yellow-400" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                {language === 'rw' ? 'Ikigereranyo cy\'Amanota' : 'Avg Rating'}
              </p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {stats.avgRating}
              </p>
            </div>
            <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg">
              <Star className="w-7 h-7 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </Card>
      </div>

      {/* Course Progress Tabs */}
      <Card>
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex space-x-8 px-6">
            <button 
              onClick={() => setActiveTab('in-progress')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'in-progress' 
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400' 
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {language === 'rw' ? 'Byakomeje' : 'In Progress'} ({enrolledCourses.filter((c: Course) => (c.progress || 0) < 100).length})
            </button>
            <button 
              onClick={() => setActiveTab('completed')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'completed' 
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400' 
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {language === 'rw' ? 'Byarangiye' : 'Completed'} ({enrolledCourses.filter((c: Course) => (c.progress || 0) >= 100).length})
            </button>
          </nav>
        </div>

        {/* Search and Filter */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder={language === 'rw' ? 'Shakisha amasomo yawe...' : 'Search your courses...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <select 
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">{language === 'rw' ? 'Ibyiciro Byose' : 'All Categories'}</option>
              <option value="programming">Programming</option>
              <option value="design">Design</option>
              <option value="business-tech">Business Tech</option>
              <option value="general-it">General IT</option>
            </select>
          </div>
        </div>

        {/* Courses List */}
        <div className="p-6">
          {getFilteredCourses().length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                {activeTab === 'completed' 
                  ? (language === 'rw' ? 'Nta masomo byarangiye' : 'No completed courses')
                  : (language === 'rw' ? 'Nta masomo yakomeje' : 'No courses in progress')
                }
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                {activeTab === 'completed'
                  ? (language === 'rw' 
                      ? 'Rangiza amwe mu masomo yawe kugira ngo ugere hano.'
                      : 'Complete some of your courses to see them here.'
                    )
                  : (language === 'rw' 
                      ? 'Shakisha kandi wiyandikishe mu masomo mashya.'
                      : 'Browse and enroll in new courses to get started.'
                    )
                }
              </p>
              {activeTab === 'in-progress' && (
                <Button onClick={() => navigate('/dashboard')}>
                  <BookOpen className="w-4 h-4 mr-2" />
                  {language === 'rw' ? 'Shakisha Amasomo' : 'Browse Courses'}
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {getFilteredCourses().map((course) => (
                <Card key={course.id} className="p-6 hover:shadow-lg transition-shadow">
                  <div className="flex items-start space-x-4">
                    {course.thumbnail ? (
                      <img 
                        src={course.thumbnail} 
                        alt={course.title}
                        className="w-24 h-24 object-cover rounded-lg"
                      />
                    ) : (
                      <div className="w-24 h-24 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                        <BookOpen className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-white mb-1">
                            {course.title}
                            {(course.progress || 0) >= 100 && (
                              <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                                {language === 'rw' ? '🏆 Byarangiye' : '🏆 Completed'}
                              </span>
                            )}
                          </h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {course.instructor}
                          </p>
                        </div>
                        {getLevelBadge(course.level)}
                      </div>
                      
                      <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400 mb-3">
                        <div className="flex items-center">
                          <Star className="w-4 h-4 text-yellow-400 fill-current mr-1" />
                          {course.rating.average.toFixed(1)}
                        </div>
                        <span>{course.duration}</span>
                        <span>{course.category}</span>
                      </div>

                      <div className="mb-4">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600 dark:text-gray-400">
                            {language === 'rw' ? 'Iterambere' : 'Progress'}
                          </span>
                          <span className="text-gray-900 dark:text-white font-medium">
                            {Math.round(course.progress || 0)}%
                          </span>
                        </div>
                        <ProgressBar value={course.progress || 0} className="h-2" />
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {course.completedLessons}/{course.totalLessons} {language === 'rw' ? 'amasomo' : 'lessons'}
                        </span>
                        <div className="flex space-x-2">
                          <Button size="sm" variant="outline" onClick={() => navigate(`/course/${course.id}`)}>
                            <Eye className="w-4 h-4 mr-2" />
                            {language === 'rw' ? 'Kureba' : 'View'}
                          </Button>
                          <Button size="sm" onClick={() => navigate(`/course/${course.id}`)}>
                            <Play className="w-4 h-4 mr-2" />
                            {(course.progress || 0) >= 100 
                              ? (language === 'rw' ? 'Subiramo' : 'Review')
                              : (language === 'rw' ? 'Komeza' : 'Continue')
                            }
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default LearnerCourses; 