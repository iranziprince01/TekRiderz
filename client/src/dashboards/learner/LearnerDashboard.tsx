import React, { useState, useMemo } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { 
  BookOpen, 
  Search, 
  CheckCircle,
  Clock,
  Users,
  Star,
  Filter
} from 'lucide-react';
import { useComprehensiveDashboardData } from '../../hooks/useComprehensiveDashboardData';
import EnhancedCourseCard from '../../components/course/EnhancedCourseCard';

const LearnerDashboard: React.FC = () => {
  const { t } = useLanguage();
  const {
    user,
    courses,
    enrolledCourses,
    isLoading,
    error,
    refreshData
  } = useComprehensiveDashboardData();

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');

  // Calculate simple dashboard statistics
  const dashboardStats = useMemo(() => {
    const totalAvailable = courses?.length || 0;
    const totalEnrolled = enrolledCourses?.length || 0;
    const completed = enrolledCourses?.filter((course: any) => 
      course.enrollment?.status === 'completed' || 
      course.progress?.percentage >= 100
    ).length || 0;

    return {
      totalAvailable,
      totalEnrolled,
      completed
    };
  }, [courses, enrolledCourses]);

  // Filter available courses (all approved courses, showing both enrolled and non-enrolled)
  const availableCourses = useMemo(() => {
    if (!courses || !Array.isArray(courses)) {
      return [];
    }
    
    const enrolledCourseIds = new Set(
      enrolledCourses?.map((course: any) => course.id || course._id) || []
    );
    
    return courses
      .filter((course: any) => {
        const isPublished = course.status === 'published';
        const matchesSearch = !searchTerm || 
          course.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          course.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          course.instructorName?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = categoryFilter === 'all' || course.category === categoryFilter;
        const matchesLevel = levelFilter === 'all' || course.level === levelFilter;
        
        return isPublished && matchesSearch && matchesCategory && matchesLevel;
      })
      .map((course: any) => {
        // Add enrollment info to each course
        const isEnrolled = enrolledCourseIds.has(course.id || course._id);
        const enrolledCourse = enrolledCourses?.find((ec: any) => (ec.id || ec._id) === (course.id || course._id));
        
        return {
          ...course,
          isEnrolled,
          enrollment: enrolledCourse?.enrollment || null,
          progress: enrolledCourse?.progress || null
        };
      })
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [courses, enrolledCourses, searchTerm, categoryFilter, levelFilter]);

  // Get unique categories and levels for filtering
  const { categories, levels } = useMemo(() => {
    if (!courses) return { categories: [], levels: [] };
    
    const uniqueCategories = [...new Set(courses.map((course: any) => course.category))].filter(Boolean);
    const uniqueLevels = [...new Set(courses.map((course: any) => course.level))].filter(Boolean);
    
    return { categories: uniqueCategories, levels: uniqueLevels };
  }, [courses]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="text-center">
          <LoadingSpinner size="lg" className="text-blue-600" />
          <p className="text-gray-600 mt-4 text-lg">
            {t('Loading available courses...')}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="p-8 text-center max-w-md border-gray-200">
          <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {t('Unable to load courses')}
          </h3>
          <p className="text-gray-600 mb-6">
            {error}
          </p>
          <Button 
            onClick={refreshData}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {t('Try Again')}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Header - Clean and Professional */}
      <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-2xl p-8">
        <div className="max-w-4xl">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {t('Welcome back')}, {user?.name || 'Learner'}!
          </h1>
          <p className="text-gray-700 text-lg mb-6">
            {t('Explore all courses, continue your learning, and discover new skills')}
          </p>
          
          {/* Quick Stats - Simplified */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-blue-100">
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <BookOpen className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">{dashboardStats.totalAvailable}</div>
                  <div className="text-sm text-gray-600">{t('Available Courses')}</div>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl p-4 shadow-sm border border-green-100">
              <div className="flex items-center gap-3">
                <div className="bg-green-100 p-2 rounded-lg">
                  <Users className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">{dashboardStats.totalEnrolled}</div>
                  <div className="text-sm text-gray-600">{t('Enrolled Courses')}</div>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl p-4 shadow-sm border border-purple-100">
              <div className="flex items-center gap-3">
                <div className="bg-purple-100 p-2 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">{dashboardStats.completed}</div>
                  <div className="text-sm text-gray-600">{t('Completed')}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters - Clean Design */}
      <Card className="p-6 border-gray-200 shadow-sm">
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-gray-500" />
            <h3 className="text-lg font-semibold text-gray-900">{t('Find Courses')}</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search Input */}
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  type="text"
                  placeholder={t('Search courses, instructors, or topics...')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-11 h-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-lg"
                />
              </div>
            </div>
            
            {/* Category Filter */}
            <div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full h-12 px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
              >
                <option value="all">{t('All Categories')}</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {t(category)}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Level Filter */}
            <div>
              <select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
                className="w-full h-12 px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
              >
                <option value="all">{t('All Levels')}</option>
                {levels.map((level) => (
                  <option key={level} value={level}>
                    {t(level)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          {/* Active Filters Display */}
          {(searchTerm || categoryFilter !== 'all' || levelFilter !== 'all') && (
            <div className="flex flex-wrap gap-2 pt-2">
              {searchTerm && (
                <Badge variant="default" className="bg-blue-100 text-blue-800 px-3 py-1">
                  {t('Search')}: {searchTerm}
                </Badge>
              )}
              {categoryFilter !== 'all' && (
                <Badge variant="default" className="bg-green-100 text-green-800 px-3 py-1">
                  {t('Category')}: {t(categoryFilter)}
                </Badge>
              )}
              {levelFilter !== 'all' && (
                <Badge variant="default" className="bg-purple-100 text-purple-800 px-3 py-1">
                  {t('Level')}: {t(levelFilter)}
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchTerm('');
                  setCategoryFilter('all');
                  setLevelFilter('all');
                }}
                className="text-gray-500 hover:text-gray-700 px-2 py-1 h-auto"
              >
                {t('Clear all')}
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Available Courses Section */}
      <div>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">{t('All Courses')}</h2>
          <Badge variant="default" className="bg-gray-100 text-gray-700 px-3 py-1 text-sm">
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
          <Card className="p-12 text-center border-gray-200 shadow-sm">
            <div className="bg-gray-50 p-6 rounded-full w-24 h-24 mx-auto mb-6 flex items-center justify-center">
              <BookOpen className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">
              {searchTerm || categoryFilter !== 'all' || levelFilter !== 'all'
                ? t('No courses match your criteria')
                : t('No courses available yet')
              }
            </h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto leading-relaxed">
              {searchTerm || categoryFilter !== 'all' || levelFilter !== 'all'
                ? t('Try adjusting your search terms or filters to find courses')
                : t('Courses are being added regularly. Check back soon for new learning opportunities!')
              }
            </p>
            {(searchTerm || categoryFilter !== 'all' || levelFilter !== 'all') && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm('');
                  setCategoryFilter('all');
                  setLevelFilter('all');
                }}
                className="border-blue-200 text-blue-600 hover:bg-blue-50"
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