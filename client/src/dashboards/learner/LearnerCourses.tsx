import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ProgressBar } from '../../components/common/ProgressBar';
import { 
  BookOpen, 
  Play, 
  Clock, 
  CheckCircle, 
  Search,
  Award,
  BarChart3,
  Target
} from 'lucide-react';
import { useComprehensiveDashboardData } from '../../hooks/useComprehensiveDashboardData';
import { getFileUrl } from '../../utils/api';

const LearnerCourses: React.FC = () => {
  const { t } = useLanguage();
  const {
    user,
    stats,
    enrolledCourses,
    progress,
    isLoading,
    error
  } = useComprehensiveDashboardData();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Process enrolled courses with progress data
  const processedCourses = useMemo(() => {
    if (!enrolledCourses) return [];
    
    return enrolledCourses.map((course: any) => {
      // Find matching progress data
      const courseProgress = progress?.find((p: any) => p.courseId === course.id || p.courseId === course._id);
      
      // Calculate completion percentage
      const totalLessons = course.totalLessons || course.sections?.reduce((total: number, section: any) => 
        total + (section.lessons?.length || 0), 0) || 0;
      const completedLessons = courseProgress?.completedLessons?.length || 0;
      const progressPercentage = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
      
      // Determine status
      let status = 'active';
      if (course.enrollment?.status) {
        status = course.enrollment.status;
      } else if (progressPercentage >= 100) {
        status = 'completed';
      } else if (progressPercentage > 0) {
        status = 'in_progress';
      }
      
      return {
        ...course,
        progress: {
          percentage: progressPercentage,
          completedLessons,
          totalLessons,
          timeSpent: courseProgress?.timeSpent || 0,
          lastWatched: courseProgress?.lastWatched,
          currentLesson: courseProgress?.currentLesson
        },
        status,
        enrollmentDate: course.enrollment?.enrolledAt || course.enrolledAt
      };
    });
  }, [enrolledCourses, progress]);

  // Filter courses based on search and filters
  const filteredCourses = useMemo(() => {
    return processedCourses.filter((course: any) => {
      const matchesSearch = !searchTerm || 
        course.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.instructorName?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || course.status === statusFilter;
      
      const matchesCategory = categoryFilter === 'all' || course.category === categoryFilter;
      
      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [processedCourses, searchTerm, statusFilter, categoryFilter]);

  // Get unique categories
  const categories = useMemo(() => {
    const uniqueCategories = [...new Set(processedCourses.map((course: any) => course.category))];
    return uniqueCategories.filter(Boolean);
  }, [processedCourses]);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const totalCourses = processedCourses.length;
    const completedCourses = processedCourses.filter((course: any) => course.status === 'completed').length;
    const inProgressCourses = processedCourses.filter((course: any) => course.status === 'in_progress').length;
    const totalTimeSpent = processedCourses.reduce((total: number, course: any) => total + (course.progress?.timeSpent || 0), 0);
    const averageProgress = totalCourses > 0 
      ? Math.round(processedCourses.reduce((total: number, course: any) => total + course.progress.percentage, 0) / totalCourses)
      : 0;
    
    return {
      totalCourses,
      completedCourses,
      inProgressCourses,
      totalTimeSpent: Math.round(totalTimeSpent / 60), // Convert to minutes
      averageProgress,
      completionRate: totalCourses > 0 ? Math.round((completedCourses / totalCourses) * 100) : 0
    };
  }, [processedCourses]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <LoadingSpinner className="mx-auto mb-4" />
          <p className="text-gray-600">
            {t('Loading your courses...')}
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
            {t('Unable to load courses')}
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
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          {t('My Courses')}
        </h1>
        <p className="text-gray-600 mt-1">
          {t('Track your learning progress and continue your studies')}
        </p>
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <BookOpen className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-xl font-bold">{summaryStats.totalCourses}</div>
              <div className="text-gray-600 text-sm">{t('Total Courses')}</div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="bg-green-100 p-2 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-xl font-bold">{summaryStats.completedCourses}</div>
              <div className="text-gray-600 text-sm">{t('Completed')}</div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="bg-yellow-100 p-2 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <div className="text-xl font-bold">{summaryStats.inProgressCourses}</div>
              <div className="text-gray-600 text-sm">{t('In Progress')}</div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="bg-purple-100 p-2 rounded-lg">
              <BarChart3 className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <div className="text-xl font-bold">{summaryStats.averageProgress}%</div>
              <div className="text-gray-600 text-sm">{t('Avg Progress')}</div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="bg-orange-100 p-2 rounded-lg">
              <Target className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <div className="text-xl font-bold">{summaryStats.completionRate}%</div>
              <div className="text-gray-600 text-sm">{t('Completion Rate')}</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              type="text"
              placeholder={t('Search courses, instructors...')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        
        <div className="sm:w-48">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">{t('All Status')}</option>
            <option value="active">{t('Active')}</option>
            <option value="in_progress">{t('In Progress')}</option>
            <option value="completed">{t('Completed')}</option>
          </select>
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

      {/* Courses List */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">{t('Your Enrolled Courses')}</h2>
          <Badge variant="default">
            {filteredCourses.length} {t('courses')}
          </Badge>
        </div>

        {filteredCourses.length > 0 ? (
          <div className="space-y-4">
            {filteredCourses.map((course: any) => (
              <Card key={course.id || course._id} className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex flex-col lg:flex-row gap-6">
                  {/* Course Thumbnail */}
                  <div className="lg:w-48 lg:h-32 w-full h-48 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                    {course.thumbnail ? (
                      <img 
                        src={getFileUrl(course.thumbnail, 'thumbnail')} 
                        alt={course.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <BookOpen className="w-8 h-8 text-gray-400" />
                      </div>
                    )}
                  </div>

                  {/* Course Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          {course.category && (
                            <Badge variant="default" className="text-xs">
                              {t(course.category)}
                            </Badge>
                          )}
                          <Badge 
                            variant={course.status === 'completed' ? 'success' : course.status === 'in_progress' ? 'warning' : 'default'}
                            className="text-xs"
                          >
                            {t(course.status)}
                          </Badge>
                        </div>
                        
                        <h3 className="font-semibold text-gray-900 text-lg mb-2 truncate">
                          {course.title}
                        </h3>
                        
                        <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                          {course.description}
                        </p>
                        
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {Math.round(course.progress.timeSpent / 60)}m {t('spent')}
                          </span>
                          {course.instructorName && (
                            <span>
                              {t('by')} {course.instructorName}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col sm:items-end gap-3">
                        <div className="text-right">
                          <div className="text-2xl font-bold text-blue-600">
                            {course.progress.percentage}%
                          </div>
                          <div className="text-xs text-gray-500">
                            {course.progress.completedLessons}/{course.progress.totalLessons} {t('lessons')}
                          </div>
                        </div>
                        
                        <Link to={`/course/${course.id || course._id}`}>
                          <Button className="flex items-center gap-2">
                            {course.status === 'completed' ? (
                              <>
                                <Award className="w-4 h-4" />
                                {t('Review')}
                              </>
                            ) : (
                              <>
                                <Play className="w-4 h-4" />
                                {t('Continue')}
                              </>
                            )}
                          </Button>
                        </Link>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-2">
                      <ProgressBar 
                        value={course.progress.percentage} 
                        className="h-2"
                        showLabel={false}
                      />
                      {course.progress.currentLesson && (
                        <p className="text-xs text-gray-500">
                          {t('Current lesson')}: {course.progress.currentLesson}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-8 text-center">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {processedCourses.length === 0 
                ? t('No enrolled courses')
                : t('No courses match your filters')
              }
            </h3>
            <p className="text-gray-600 mb-4">
              {processedCourses.length === 0 
                ? t('Start your learning journey by enrolling in courses')
                : t('Try adjusting your search or filter criteria')
              }
            </p>
            {processedCourses.length === 0 ? (
              <Link to="/dashboard">
                <Button>
                  {t('Browse Courses')}
                </Button>
              </Link>
            ) : (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
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

export default LearnerCourses; 