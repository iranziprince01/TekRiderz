import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { 
  BookOpen, 
  Play, 
  Clock, 
  CheckCircle, 
  Search,
  Award
} from 'lucide-react';
import { useComprehensiveDashboardData } from '../../hooks/useComprehensiveDashboardData';
import { getFileUrl } from '../../utils/api';

const LearnerCourses: React.FC = () => {
  const { t } = useLanguage();
  const {
    enrolledCourses,
    isLoading,
    error
  } = useComprehensiveDashboardData();

  const [searchTerm, setSearchTerm] = useState('');

  // Process enrolled courses with progress data
  const processedCourses = useMemo(() => {
    if (!enrolledCourses) return [];
    
    return enrolledCourses.map((course: any) => {
      // Progress data should be embedded in the enrolled course object
      const courseProgress = course.progress || {};
      
      // Calculate completion percentage
      const totalLessons = course.totalLessons || course.sections?.reduce((total: number, section: any) => 
        total + (section.lessons?.length || 0), 0) || 0;
      const completedLessons = courseProgress?.completedLessons?.length || 0;
      const progressPercentage = course.progress || totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
      
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
  }, [enrolledCourses]);

  // Filter courses based on search only (simplified)
  const filteredCourses = useMemo(() => {
    return processedCourses.filter((course: any) => {
      const matchesSearch = !searchTerm || 
        course.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.instructorName?.toLowerCase().includes(searchTerm.toLowerCase());
      
      return matchesSearch;
    });
  }, [processedCourses, searchTerm]);

  // Simple summary statistics (only 3 most important)
  const summaryStats = useMemo(() => {
    const totalCourses = processedCourses.length;
    const completedCourses = processedCourses.filter((course: any) => course.status === 'completed').length;
    const inProgressCourses = processedCourses.filter((course: any) => course.status === 'in_progress').length;
    
    return {
      totalCourses,
      completedCourses,
      inProgressCourses
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
        <Card className="p-8 text-center border border-gray-200 shadow-sm">
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
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          {t('My Courses')}
        </h1>
        <p className="text-gray-600 mt-1">
          {t('Track your learning progress and continue your studies')}
        </p>
      </div>

      {/* Simplified Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-semibold text-gray-900">{summaryStats.totalCourses}</div>
              <div className="text-gray-600 text-sm mt-1">{t('Total Courses')}</div>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg">
              <BookOpen className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-semibold text-gray-900">{summaryStats.completedCourses}</div>
              <div className="text-gray-600 text-sm mt-1">{t('Completed')}</div>
            </div>
            <div className="bg-green-50 p-3 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-semibold text-gray-900">{summaryStats.inProgressCourses}</div>
              <div className="text-gray-600 text-sm mt-1">{t('In Progress')}</div>
            </div>
            <div className="bg-orange-50 p-3 rounded-lg">
              <Clock className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Simplified Search */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <Input
            type="text"
            placeholder={t('Search your courses...')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-11 h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Courses List */}
      <div>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">{t('Your Enrolled Courses')}</h2>
          <Badge variant="default" className="bg-gray-100 text-gray-700">
            {filteredCourses.length} {t('courses')}
          </Badge>
        </div>

        {filteredCourses.length > 0 ? (
          <div className="space-y-6">
            {filteredCourses.map((course: any) => (
              <Card key={course.id || course._id} className="p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex flex-col lg:flex-row gap-6">
                  {/* Course Thumbnail */}
                  <div className="lg:w-48 lg:h-32 w-full h-48 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
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
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          {course.category && (
                            <Badge variant="default" className="text-xs">
                              {t(course.category)}
                            </Badge>
                          )}
                          {/* Fixed Badge usage - using proper variants without conflicting classes */}
                          {course.status === 'completed' && (
                            <Badge variant="success" className="text-xs">
                              {t('Completed')}
                            </Badge>
                          )}
                          {course.status === 'in_progress' && (
                            <Badge variant="info" className="text-xs">
                              {t('In Progress')}
                            </Badge>
                          )}
                          {course.status === 'active' && (
                            <Badge variant="default" className="text-xs">
                              {t('Not Started')}
                            </Badge>
                          )}
                        </div>
                        
                        <h3 className="font-semibold text-lg text-gray-900 mb-2 line-clamp-2">
                          {course.title}
                        </h3>
                        
                        <p className="text-gray-600 text-sm mb-3 line-clamp-2 leading-relaxed">
                          {course.description}
                        </p>
                        
                        {course.instructorName && (
                          <div className="flex items-center gap-2 mb-4">
                            <div className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-medium">
                              {course.instructorName.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-sm text-gray-600">
                              {t('by')} {course.instructorName}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col sm:items-end gap-3">
                        <div className="text-right">
                          <div className="text-2xl font-semibold text-blue-600">
                            {course.progress.percentage}%
                          </div>
                          <div className="text-xs text-gray-500">
                            {course.progress.completedLessons}/{course.progress.totalLessons} {t('lessons')}
                          </div>
                        </div>
                        
                        <Link to={`/course/${course.id || course._id}`}>
                          <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                            {course.status === 'completed' ? (
                              <>
                                <Award className="w-4 h-4 mr-2" />
                                {t('Review')}
                              </>
                            ) : (
                              <>
                                <Play className="w-4 h-4 mr-2" />
                                {t('Continue')}
                              </>
                            )}
                          </Button>
                        </Link>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-2">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-300 ${
                            course.status === 'completed' ? 'bg-green-500' : 'bg-blue-500'
                          }`}
                          style={{ width: `${course.progress.percentage}%` }}
                        />
                      </div>
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
          <Card className="p-12 text-center border border-gray-200 shadow-sm">
            <div className="bg-gray-50 p-4 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
              <BookOpen className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {processedCourses.length === 0 
                ? t('No enrolled courses')
                : t('No courses match your search')
              }
            </h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              {processedCourses.length === 0 
                ? t('Start your learning journey by enrolling in courses')
                : t('Try a different search term')
              }
            </p>
            {processedCourses.length === 0 ? (
              <Link to="/dashboard">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                  {t('Browse Courses')}
                </Button>
              </Link>
            ) : (
              <Button
                variant="outline"
                onClick={() => setSearchTerm('')}
                className="border-gray-200 text-gray-700 hover:bg-gray-50"
              >
                {t('Clear Search')}
              </Button>
            )}
          </Card>
        )}
      </div>
    </div>
  );
};

export default LearnerCourses; 