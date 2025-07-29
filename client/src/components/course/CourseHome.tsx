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
  UserPlus,
  Play,
  Target,
  Award,
  Calendar,
  BarChart3
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
  students?: number;
  rating?: {
    average: number;
    count: number;
  };
  totalLessons?: number;
  totalDuration?: number;
  instructorName: string;
  instructorId?: string;
  instructorAvatar?: string;
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

  const handleReviewCourse = () => {
    navigate(`/course/${course.id}/modules`);
  };

  const isCourseCompleted = () => {
    return userProgress && userProgress.overallProgress >= 100;
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
    // Handle NaN, undefined, or invalid values
    if (!seconds || isNaN(seconds) || seconds < 0) {
      return 'N/A';
    }
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  const getProgressPercentage = () => {
    if (!userProgress || userProgress.totalLessons === 0) return 0;
    return Math.round((userProgress.completedLessons / userProgress.totalLessons) * 100);
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Hero Section */}
      <div className="mb-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Course Thumbnail */}
          <div className="lg:col-span-1">
            <div className="relative">
              <img
                src={getThumbnailUrl()}
                alt={course.title}
                className="w-full h-64 lg:h-80 object-cover rounded-xl shadow-lg"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = '/placeholder-course.jpg';
                }}
              />
              <div className="absolute top-4 left-4">
                <Badge variant="default" className="bg-white/90 dark:bg-gray-800/90">
                  {course.category}
                </Badge>
              </div>
              <div className="absolute top-4 right-4">
                <Badge variant={course.level === 'beginner' ? 'success' : course.level === 'intermediate' ? 'warning' : 'error'}>
                  {course.level}
                </Badge>
              </div>
            </div>
          </div>

          {/* Course Info */}
          <div className="lg:col-span-2">
            <div className="space-y-6">
              {/* Course Header */}
              <div>
                <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4">
                  {course.title}
                </h1>
                <p className="text-lg text-gray-600 dark:text-gray-400 leading-relaxed">
                  {course.description}
                </p>
              </div>

              {/* Course Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="flex items-center justify-center w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full mx-auto mb-2">
                    <Users className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {course.enrollmentCount || course.students || 0}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {language === 'rw' ? 'Abanyeshuri' : 'Students'}
                  </div>
                </div>

                <div className="text-center">
                  <div className="flex items-center justify-center w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full mx-auto mb-2">
                    <Star className="w-6 h-6 text-green-600" />
                  </div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {course.rating?.average?.toFixed(1) || '4.5'}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {language === 'rw' ? 'Igihembo' : 'Rating'}
                  </div>
                </div>

                <div className="text-center">
                  <div className="flex items-center justify-center w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full mx-auto mb-2">
                    <Clock className="w-6 h-6 text-purple-600" />
                  </div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {course.totalDuration ? formatDuration(course.totalDuration) : '2h 30m'}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {language === 'rw' ? 'Igihe' : 'Duration'}
                  </div>
                </div>

                <div className="text-center">
                  <div className="flex items-center justify-center w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-full mx-auto mb-2">
                    <BookOpen className="w-6 h-6 text-orange-600" />
                  </div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {course.totalLessons || 12}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {language === 'rw' ? 'Amasomo' : 'Lessons'}
                  </div>
                </div>
              </div>

              {/* Instructor Info */}
              <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                {course.instructorAvatar ? (
                  <img
                    src={course.instructorAvatar}
                    alt={cleanInstructorName(course.instructorName)}
                    className="w-12 h-12 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      target.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <div className={`w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold ${course.instructorAvatar ? 'hidden' : ''}`}>
                  {cleanInstructorName(course.instructorName).charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {cleanInstructorName(course.instructorName)}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {language === 'rw' ? 'Umwarimu' : 'Instructor'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Section (if enrolled) */}
      {isEnrolled && userProgress && (
        <div className="mb-8">
          <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    {language === 'rw' ? 'Iterambere Ryawe' : 'Your Progress'}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400">
                    {language === 'rw' 
                      ? `Uwarangiye amasomo ${userProgress.completedLessons} kuri ${userProgress.totalLessons}`
                      : `You've completed ${userProgress.completedLessons} of ${userProgress.totalLessons} lessons`
                    }
                  </p>
                </div>
                               <div className="text-right">
                 <div className="text-3xl font-bold text-blue-500 dark:text-blue-400">
                   {getProgressPercentage()}%
                 </div>
               </div>
              </div>
              
              {/* Progress Bar */}
              <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-3 mb-4">
                <div 
                  className="bg-blue-500 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${getProgressPercentage()}%` }}
                />
              </div>

              <div className="flex gap-3">
                {isCourseCompleted() ? (
                  <Button
                    onClick={handleReviewCourse}
                    variant="primary"
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                  >
                    <BookOpen className="w-4 h-4" />
                    {language === 'rw' ? 'Subiramo Inyigisho' : 'Review Course'}
                  </Button>
                ) : (
                  <Button
                    onClick={handleContinue}
                    variant="primary"
                    className="flex items-center gap-2"
                  >
                    <Play className="w-4 h-4" />
                    {language === 'rw' ? 'Komeza Inyigisho' : 'Continue Learning'}
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Course Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Learning Objectives */}
        <Card>
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {language === 'rw' ? 'Ibihezo by\'Inyigisho' : 'Learning Objectives'}
              </h3>
            </div>
            
            {course.learningObjectives && course.learningObjectives.length > 0 ? (
              <ul className="space-y-3">
                {course.learningObjectives.map((objective, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                    <span className="text-gray-700 dark:text-gray-300">{objective}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                  <span className="text-gray-700 dark:text-gray-300">
                    {language === 'rw' 
                      ? 'Umenya ibintu by\'ingenzi by\'inyigisho'
                      : 'Understand key concepts of the course'
                    }
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                  <span className="text-gray-700 dark:text-gray-300">
                    {language === 'rw' 
                      ? 'Ushobora gukoresha amabwiriza mu buzima'
                      : 'Apply the concepts in real-world scenarios'
                    }
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                  <span className="text-gray-700 dark:text-gray-300">
                    {language === 'rw' 
                      ? 'Ufata ibizamini kandi ufata impamyabumenyi'
                      : 'Complete assessments and earn certificates'
                    }
                  </span>
                </div>
              </div>
            )}
          </div>
        </Card>

                 {/* What's In */}
         <Card>
           <div className="p-6">
             <div className="flex items-center gap-2 mb-4">
               <Award className="w-5 h-5 text-blue-500" />
               <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                 {language === 'rw' ? 'Ibiri Mo' : 'What\'s In'}
               </h3>
             </div>
            
                         <div className="space-y-4">
               <div className="flex items-center gap-3">
                 <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                   <Play className="w-4 h-4 text-blue-500" />
                 </div>
                 <div>
                   <div className="font-medium text-gray-900 dark:text-white">
                     {language === 'rw' ? 'Amashusho' : 'Videos'}
                   </div>
                   <div className="text-sm text-gray-600 dark:text-gray-400">
                     {language === 'rw' 
                       ? 'Amashusho y\'inyigisho y\'ingenzi'
                       : 'High-quality video lessons'
                     }
                   </div>
                 </div>
               </div>

               <div className="flex items-center gap-3">
                 <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                   <BookOpen className="w-4 h-4 text-blue-500" />
                 </div>
                 <div>
                   <div className="font-medium text-gray-900 dark:text-white">
                     {language === 'rw' ? 'Inyandiko' : 'PDFs'}
                   </div>
                   <div className="text-sm text-gray-600 dark:text-gray-400">
                     {language === 'rw' 
                       ? 'Inyandiko z\'isomo n\'ibikoresho'
                       : 'Course materials and resources'
                     }
                   </div>
                 </div>
               </div>

               <div className="flex items-center gap-3">
                 <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                   <BarChart3 className="w-4 h-4 text-blue-500" />
                 </div>
                 <div>
                   <div className="font-medium text-gray-900 dark:text-white">
                     {language === 'rw' ? 'Ibizamini' : 'Quizzes'}
                   </div>
                   <div className="text-sm text-gray-600 dark:text-gray-400">
                     {language === 'rw' 
                       ? 'Ibizamini by\'inyigisho n\'ibizamini bya nyuma'
                       : 'Module quizzes and final assessment'
                     }
                   </div>
                 </div>
               </div>

               <div className="flex items-center gap-3">
                 <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                   <Award className="w-4 h-4 text-blue-500" />
                 </div>
                 <div>
                   <div className="font-medium text-gray-900 dark:text-white">
                     {language === 'rw' ? 'Impamyabumenyi' : 'Certificate'}
                   </div>
                   <div className="text-sm text-gray-600 dark:text-gray-400">
                     {language === 'rw' 
                       ? 'Impamyabumenyi y\'inyigisho'
                       : 'Course completion certificate'
                     }
                   </div>
                 </div>
               </div>
             </div>
          </div>
        </Card>
      </div>

             {/* Enrollment Section */}
       {!isEnrolled && (
         <div className="mt-8">
           <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700">
            <div className="p-8 text-center">
                             <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                 <UserPlus className="w-8 h-8 text-blue-500" />
               </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                {language === 'rw' ? 'Tangira Inyigisho' : 'Start Learning Today'}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-2xl mx-auto">
                {language === 'rw' 
                  ? 'Injira muri iyi nyigisho kandi ufate amasomo y\'ingenzi. Ushobora gufata amasomo offline kandi ufata ibizamini.'
                  : 'Enroll in this course and take essential lessons. You can access content offline and complete assessments.'
                }
              </p>
              <Button
                onClick={handleEnroll}
                variant="primary"
                size="lg"
                disabled={isEnrolling}
                className="flex items-center gap-2"
              >
                {isEnrolling ? (
                  <>
                    <LoadingSpinner size="sm" />
                    {language === 'rw' ? 'Birasabwa...' : 'Enrolling...'}
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5" />
                    {language === 'rw' ? 'Injira muri Inyigisho' : 'Enroll in Course'}
                  </>
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}; 