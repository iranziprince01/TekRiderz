import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { getFileUrl, apiClient, cleanInstructorName } from '../../utils/api';
import { 
  Users, 
  Star, 
  Clock, 
  BookOpen, 
  ArrowRight,
  CheckCircle,
  Plus,
  UserPlus
} from 'lucide-react';

interface Course {
  id: string;
  title: string;
  description: string;
  thumbnail?: string;
  category: string;
  level: string;
  status: string;
  enrollmentCount?: number;
  rating?: {
    average: number;
    count: number;
  };
  totalLessons?: number;
  totalDuration?: number;
  instructorName: string;
  learningObjectives?: string[];
}

interface CourseHomeProps {
  course: Course;
  isEnrolled: boolean;
  userProgress?: {
    completedLessons: number;
    totalLessons: number;
    overallProgress: number;
  };
}

export const CourseHome: React.FC<CourseHomeProps> = ({ 
  course, 
  isEnrolled, 
  userProgress 
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language } = useLanguage();
  const { theme } = useTheme();
  const [isEnrolling, setIsEnrolling] = useState(false);
  
  const getThumbnailUrl = () => {
    return getFileUrl(course.thumbnail, 'thumbnail');
  };

  const handleContinue = () => {
    navigate(`/course/${course.id}/modules`);
  };

  const handleEnroll = async () => {
    if (!user || isEnrolling) return;

    setIsEnrolling(true);
    
    try {
      const response = await apiClient.enrollInCourse(course.id);
      if (response.success) {
        console.log('Enrollment successful:', response.data);
        
        // Dispatch global event to notify other components
        window.dispatchEvent(new CustomEvent('courseEnrollmentUpdated', {
          detail: { courseId: course.id, enrollment: response.data.enrollment }
        }));
        
        // Navigate to modules page after successful enrollment
        navigate(`/course/${course.id}/modules`);
      } else {
        throw new Error(response.error || 'Enrollment failed');
      }
    } catch (error) {
      console.error('Failed to enroll in course:', error);
    } finally {
      setIsEnrolling(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Course Header */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="md:flex">
          {/* Course Thumbnail */}
          <div className="md:w-1/3">
            <div className="aspect-video bg-gray-100 dark:bg-gray-800">
              {course.thumbnail ? (
                <img
                  src={getThumbnailUrl()}
                  alt={course.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <BookOpen className="w-16 h-16 text-gray-400 dark:text-gray-600" />
                </div>
              )}
            </div>
          </div>

          {/* Course Info */}
          <div className="md:w-2/3 p-8">
            <div className="mb-4">
              <div className="flex flex-wrap gap-2 mb-4">
                <Badge variant="default" className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">{course.category}</Badge>
                <Badge variant="default" className="bg-blue-100 text-blue-700">{course.level}</Badge>
                {course.status === 'published' && (
                  <Badge variant="success" className="bg-green-100 text-green-700">
                    {language === 'rw' ? 'Bihari' : 'Available'}
                  </Badge>
                )}
              </div>
              
                      <h1 className="text-3xl font-semibold text-gray-900 dark:text-white mb-4">
          {course.title}
        </h1>
        
        <p className="text-gray-600 dark:text-gray-400 text-lg leading-relaxed mb-6">
          {course.description}
        </p>

              {/* Course Stats */}
              <div className="flex flex-wrap gap-6 mb-6">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-500" />
                  <span className="text-gray-700 dark:text-gray-300">
                    {course.enrollmentCount?.toLocaleString() || '0'} {language === 'rw' ? 'abanyeshuri' : 'students'}
                  </span>
                </div>
                
                {course.rating && (
                  <div className="flex items-center gap-2">
                    <Star className="w-5 h-5 text-amber-500" />
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      {course.rating.average.toFixed(1)}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400 text-sm">
                      ({course.rating.count} {language === 'rw' ? 'ibitekerezo' : 'reviews'})
                    </span>
                  </div>
                )}

                {course.totalDuration && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-green-500" />
                    <span className="text-gray-700 dark:text-gray-300">
                      {formatDuration(course.totalDuration)}
                    </span>
                  </div>
                )}

                {course.totalLessons && (
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-purple-500" />
                    <span className="text-gray-700 dark:text-gray-300">
                      {course.totalLessons} {language === 'rw' ? 'amasomo' : 'lessons'}
                    </span>
                  </div>
                )}
              </div>

              {/* Progress Bar (if enrolled) */}
              {isEnrolled && (
                <div className="mb-6">
                  {userProgress ? (
                    <>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {language === 'rw' ? 'Aho ugeze:' : 'Progress:'} {userProgress.completedLessons} {language === 'rw' ? 'kuri' : 'of'} {userProgress.totalLessons} {language === 'rw' ? 'amasomo' : 'lessons'}
                        </span>
                        <span className="text-sm font-medium text-blue-600">
                          {Math.round(userProgress.overallProgress)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                        <div 
                          className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                          style={{ width: `${userProgress.overallProgress}%` }}
                        />
                      </div>
                    </>
                  ) : null}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-4">
                {isEnrolled ? (
                  <Button
                    onClick={handleContinue}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-3 text-lg transition-colors duration-200"
                  >
                    {userProgress && userProgress.completedLessons > 0 
                      ? (
                        <>
                          <ArrowRight className="w-5 h-5 mr-2" />
                          {language === 'rw' ? 'Komeza Kwiga' : 'Continue Learning'}
                        </>
                      ) : (
                        <>
                          <BookOpen className="w-5 h-5 mr-2" />
                          {language === 'rw' ? 'Tangira Kwiga' : 'Start Learning'}
                        </>
                      )
                    }
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={handleEnroll}
                      disabled={isEnrolling}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-3 text-lg transition-colors duration-200"
                    >
                      {isEnrolling ? (
                        <>
                          <LoadingSpinner className="w-5 h-5 mr-2" />
                          {language === 'rw' ? 'Urimo kwiyandikisha...' : 'Enrolling...'}
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-5 h-5 mr-2" />
                          {language === 'rw' ? 'Kwiyandikisha kubusa' : 'Enroll Free'}
                        </>
                      )}
                    </Button>
                    
                    <Button
                      onClick={() => navigate(`/course/${course.id}/modules`)}
                      variant="outline"
                      className="border-gray-200 text-gray-700 hover:bg-gray-50 px-6 py-3"
                    >
                      <BookOpen className="w-5 h-5 mr-2" />
                      {language === 'rw' ? 'Reba Ubusanzwe' : 'Preview Course'}
                    </Button>
                  </>
                )}
              </div>

              {/* Free Course Notice */}
              {!isEnrolled && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="text-green-800 font-medium">
                      {language === 'rw' ? 'Isomo ni ubusa - Ntakiguzi gisabwa' : 'Free Course - No payment required'}
                    </span>
                  </div>
                  <p className="text-green-700 text-sm mt-1">
                    {language === 'rw' 
                      ? 'Kwiyandikisha mu minota mike gusa hanyuma utangire kwiga ako kanya.'
                      : 'Enroll in just a few clicks and start learning immediately.'
                    }
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* What You'll Learn */}
        {course.learningObjectives && course.learningObjectives.length > 0 && (
          <Card className="p-8 border border-gray-200 shadow-sm">
            <h3 className="text-xl font-semibold text-gray-900 mb-6">
              {language === 'rw' ? 'Ibyo uziga' : 'What you\'ll learn'}
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              {course.learningObjectives.map((objective, index) => (
                <div key={index} className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">{objective}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Instructor Info */}
        <Card className="p-8 border border-gray-200 shadow-sm">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">
            {language === 'rw' ? 'Umwarimu' : 'Instructor'}
          </h3>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xl font-semibold">
              {cleanInstructorName(course.instructorName).charAt(0).toUpperCase()}
            </div>
            <div>
              <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                {cleanInstructorName(course.instructorName)}
              </h4>
              <p className="text-gray-600 dark:text-gray-400">
                {language === 'rw' ? 'Umwarimu ukomeye' : 'Course Instructor'}
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}; 