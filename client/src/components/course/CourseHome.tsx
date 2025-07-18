import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { getFileUrl } from '../../utils/api';
import { 
  Users, 
  Star, 
  Clock, 
  BookOpen, 
  ArrowRight,
  CheckCircle 
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
  const { language } = useLanguage();

  const getThumbnailUrl = () => {
    return getFileUrl(course.thumbnail, 'thumbnail');
  };

  const handleContinue = () => {
    navigate(`/course/${course.id}/modules`);
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
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="md:flex">
          {/* Course Thumbnail */}
          <div className="md:w-1/3">
            <div className="aspect-video bg-gray-100 dark:bg-gray-700">
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
                  <BookOpen className="w-16 h-16 text-gray-400" />
                </div>
              )}
            </div>
          </div>

          {/* Course Info */}
          <div className="md:w-2/3 p-8">
            <div className="mb-4">
              <div className="flex flex-wrap gap-2 mb-3">
                <Badge variant="default">{course.category}</Badge>
                <Badge variant="default">{course.level}</Badge>
                <Badge variant={course.status === 'published' ? 'success' : 'warning'}>
                  {course.status}
                </Badge>
              </div>
              
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                {course.title}
              </h1>

              <p className="text-gray-600 dark:text-gray-300 text-lg leading-relaxed mb-6">
                {course.description}
              </p>

              {/* Course Stats */}
              <div className="flex flex-wrap gap-6 mb-6">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-500" />
                  <span className="text-gray-700 dark:text-gray-300">
                    {course.enrollmentCount?.toLocaleString() || '0'} students
                  </span>
                </div>
                
                {course.rating && (
                  <div className="flex items-center gap-2">
                    <Star className="w-5 h-5 text-yellow-500" />
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      {course.rating.average.toFixed(1)}
                    </span>
                    <span className="text-gray-500 text-sm">
                      ({course.rating.count} reviews)
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
              </div>

              {/* Progress Bar (if enrolled) */}
              {isEnrolled && userProgress && (
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Progress: {userProgress.completedLessons} of {userProgress.totalLessons} lessons
                    </span>
                    <span className="text-sm font-medium text-blue-600">
                      {Math.round(userProgress.overallProgress)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${userProgress.overallProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Continue Button */}
              {isEnrolled && (
                <Button
                  onClick={handleContinue}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg"
                >
                  {userProgress && userProgress.completedLessons > 0 
                    ? (language === 'rw' ? 'Komeza Kwiga' : 'Continue Learning')
                    : (language === 'rw' ? 'Tangira Kwiga' : 'Start Learning')
                  }
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* What You'll Learn */}
      {course.learningObjectives && course.learningObjectives.length > 0 && (
        <Card className="p-8">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
            {language === 'rw' ? 'Ibyo uziga' : 'What you\'ll learn'}
          </h3>
          <div className="grid md:grid-cols-2 gap-4">
            {course.learningObjectives.map((objective, index) => (
              <div key={index} className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700 dark:text-gray-300">{objective}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Course Instructor */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {language === 'rw' ? 'Mwarimu' : 'Instructor'}
        </h3>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
            <span className="text-blue-600 dark:text-blue-400 font-semibold text-lg">
              {course.instructorName.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="font-medium text-gray-900 dark:text-white">
              {course.instructorName}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {language === 'rw' ? 'Mwarimu' : 'Course Instructor'}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}; 