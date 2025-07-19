import React, { useState, useMemo } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { 
  BookOpen, 
  Award, 
  Clock, 
  TrendingUp, 
  Search, 
  CheckCircle,
  User
} from 'lucide-react';
import { useComprehensiveDashboardData } from '../../hooks/useComprehensiveDashboardData';
import EnhancedCourseCard from '../../components/course/EnhancedCourseCard';

const LearnerDashboard: React.FC = () => {
  const { t } = useLanguage();
  const {
    user,
    stats,
    courses,
    enrolledCourses,
    isLoading,
    error,
    refreshData
  } = useComprehensiveDashboardData();

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Calculate statistics from loaded data
  const dashboardStats = useMemo(() => {
    const totalEnrolled = enrolledCourses?.length || 0;
    const completed = enrolledCourses?.filter((course: any) => 
      course.enrollment?.status === 'completed' || 
      course.progress?.completedLessons === course.totalLessons
    ).length || 0;
    const inProgress = totalEnrolled - completed;

    return {
      totalEnrolled,
      completed,
      inProgress,
      averageProgress: stats?.averageProgress || 0,
      timeSpent: stats?.timeSpent || 0,
      streak: stats?.streak?.currentStreak || 0
    };
  }, [enrolledCourses, stats]);

  // Filter available courses for enrollment
  const availableCourses = useMemo(() => {
    if (!courses || !Array.isArray(courses)) {
      return [];
    }
    
    const enrolledCourseIds = new Set(
      enrolledCourses?.map((course: any) => course.id || course._id) || []
    );
    
    const filtered = courses
      .filter((course: any) => {
        const isNotEnrolled = !enrolledCourseIds.has(course.id || course._id);
        const isPublished = course.status === 'published';
        const matchesSearch = !searchTerm || 
          course.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          course.description?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = categoryFilter === 'all' || course.category === categoryFilter;
        
        return isNotEnrolled && isPublished && matchesSearch && matchesCategory;
      });

    
    return filtered;
  }, [courses, enrolledCourses, searchTerm, categoryFilter]);

  // Get unique categories for filtering
  const categories = useMemo(() => {
    if (!courses) return [];
    const uniqueCategories = [...new Set(courses.map((course: any) => course.category))];
    return uniqueCategories.filter(Boolean);
  }, [courses]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <LoadingSpinner className="mx-auto mb-4" />
          <p className="text-gray-600">
            {t('Loading your learning dashboard...')}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="p-8 text-center">
          <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {t('Unable to load dashboard')}
          </h3>
          <p className="text-gray-600">
            {error}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Header - Clean and Simple */}
      <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-blue-50 p-3 rounded-full">
            <User className="w-8 h-8 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-1">
              {t('Welcome back')}, {user?.name || 'Learner'}
            </h1>
            <p className="text-gray-600">
              {t('Continue your learning journey and achieve your goals')}
            </p>
          </div>
        </div>
      </div>

      {/* Statistics Cards - Clean Design */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-semibold text-gray-900">{dashboardStats.totalEnrolled}</div>
              <div className="text-gray-600 text-sm mt-1">{t('Enrolled Courses')}</div>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg">
              <BookOpen className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-semibold text-gray-900">{dashboardStats.completed}</div>
              <div className="text-gray-600 text-sm mt-1">{t('Completed')}</div>
            </div>
            <div className="bg-green-50 p-3 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-semibold text-gray-900">{dashboardStats.inProgress}</div>
              <div className="text-gray-600 text-sm mt-1">{t('In Progress')}</div>
            </div>
            <div className="bg-orange-50 p-3 rounded-lg">
              <Clock className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Search and Filter - Simplified */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                type="text"
                placeholder={t('Search courses...')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-11 h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>
          
          <div className="sm:w-56">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full h-12 px-4 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
              <option value="all">{t('All Categories')}</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {t(category)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Available Courses - Clean Layout */}
      <div>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">{t('Available Courses')}</h2>
          <Badge variant="default" className="bg-gray-100 text-gray-700">
            {availableCourses.length} {t('courses')}
          </Badge>
        </div>

        {availableCourses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {availableCourses.map((course: any) => (
              <EnhancedCourseCard
                key={course.id || course._id}
                course={course}
                onDataRefresh={refreshData}
              />
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center border border-gray-200 shadow-sm">
            <div className="bg-gray-50 p-4 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
              <BookOpen className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {t('No courses found')}
            </h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              {searchTerm || categoryFilter !== 'all' 
                ? t('Try adjusting your search or filter criteria')
                : t('No courses are available at the moment')
              }
            </p>
            {(searchTerm || categoryFilter !== 'all') && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm('');
                  setCategoryFilter('all');
                }}
                className="border-gray-200 text-gray-700 hover:bg-gray-50"
              >
                {t('Clear Filters')}
              </Button>
            )}
          </Card>
        )}
      </div>
    </div>
  );
};

export default LearnerDashboard; 