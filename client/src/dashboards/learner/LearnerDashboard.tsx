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
  CheckCircle
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
    certificates,
    isLoading,
    error
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
    const totalCertificates = certificates?.length || 0;

    return {
      totalEnrolled,
      completed,
      inProgress,
      totalCertificates,
      averageProgress: stats?.averageProgress || 0,
      timeSpent: stats?.timeSpent || 0,
      streak: stats?.streak?.currentStreak || 0
    };
  }, [enrolledCourses, certificates, stats]);

  // Filter available courses for enrollment
  const availableCourses = useMemo(() => {
    if (!courses) return [];
    
    const enrolledCourseIds = new Set(
      enrolledCourses?.map((course: any) => course.id || course._id) || []
    );
    
    return courses
      .filter((course: any) => !enrolledCourseIds.has(course.id || course._id))
      .filter((course: any) => course.status === 'published')
      .filter((course: any) => {
        if (!searchTerm) return true;
        return course.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
               course.description?.toLowerCase().includes(searchTerm.toLowerCase());
      })
      .filter((course: any) => {
        if (categoryFilter === 'all') return true;
        return course.category === categoryFilter;
      });
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
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              {t('Welcome back')}, {user?.name || 'Learner'}! 👋
            </h1>
            <p className="text-blue-100">
              {t('Continue your learning journey and achieve your goals')}
            </p>
          </div>
          <div className="hidden md:block">
            <BookOpen className="w-16 h-16 text-blue-200" />
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="bg-blue-100 p-3 rounded-lg">
              <BookOpen className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{dashboardStats.totalEnrolled}</div>
              <div className="text-gray-600 text-sm">{t('Enrolled Courses')}</div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="bg-green-100 p-3 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{dashboardStats.completed}</div>
              <div className="text-gray-600 text-sm">{t('Completed')}</div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="bg-yellow-100 p-3 rounded-lg">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{dashboardStats.inProgress}</div>
              <div className="text-gray-600 text-sm">{t('In Progress')}</div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="bg-purple-100 p-3 rounded-lg">
              <Award className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{dashboardStats.totalCertificates}</div>
              <div className="text-gray-600 text-sm">{t('Certificates')}</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              type="text"
              placeholder={t('Search courses...')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        
        <div className="sm:w-48">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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

      {/* Available Courses */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">{t('Available Courses')}</h2>
          <Badge variant="default">
            {availableCourses.length} {t('courses')}
          </Badge>
        </div>

        {availableCourses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {availableCourses.map((course: any) => (
              <EnhancedCourseCard
                key={course.id || course._id}
                course={course}
              />
            ))}
          </div>
        ) : (
          <Card className="p-8 text-center">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {t('No courses found')}
            </h3>
            <p className="text-gray-600 mb-4">
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