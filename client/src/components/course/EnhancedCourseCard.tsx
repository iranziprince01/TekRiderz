import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useSimpleImageLoader } from '../../hooks/useImageLoader';
import { 
  Play, 
  Clock, 
  Users, 
  Star, 
  BookOpen, 
  Edit, 
  Trash2, 
  Eye, 
  MoreVertical,
  ChevronRight,
  Award,
  CheckCircle,
  XCircle
} from 'lucide-react';

interface EnhancedCourseCardProps {
  course: {
    id: string;
    title: string;
    description: string;
    shortDescription?: string;
    thumbnail: string;
    instructorName: string;
    instructorAvatar?: string;
    category: string;
    level: 'beginner' | 'intermediate' | 'advanced';
    status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'published' | 'under_review';
    rating: { average: number; count: number };
    enrollmentCount: number;
    totalDuration: number;
    totalLessons: number;

  
    tags: string[];
    createdAt: string;
    updatedAt: string;
    progress?: number;
    isEnrolled?: boolean;
    certificate?: boolean;
    language?: string;
  };
  variant?: 'learner' | 'tutor' | 'admin';
  onEdit?: (courseId: string) => void;
  onDelete?: (courseId: string) => void;
  onApprove?: (courseId: string) => void;
  onReject?: (courseId: string) => void;
  onEnroll?: (courseId: string) => void;
  onView?: (courseId: string) => void;
  loading?: boolean;
  compact?: boolean;
}

export const EnhancedCourseCard: React.FC<EnhancedCourseCardProps> = ({ 
  course, 
  variant = 'learner', 
  onEdit, 
  onDelete, 
  onApprove,
  onReject,
  onEnroll,
  onView,
  loading = false,
  compact = false 
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language } = useLanguage();
  const [showMenu, setShowMenu] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  // Use robust image loader for course thumbnail
  const thumbnail = useSimpleImageLoader(course.thumbnail, 'thumbnail');

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { variant: 'default' as const, text: language === 'rw' ? 'Igishushanyo' : 'Draft' },
      submitted: { variant: 'warning' as const, text: language === 'rw' ? 'Byoherejwe' : 'Submitted' },
      approved: { variant: 'success' as const, text: language === 'rw' ? 'Byemejwe' : 'Approved' },
      rejected: { variant: 'error' as const, text: language === 'rw' ? 'Byanze' : 'Rejected' },
      published: { variant: 'success' as const, text: language === 'rw' ? 'Byatangajwe' : 'Published' },
      under_review: { variant: 'warning' as const, text: language === 'rw' ? 'Birasuzumwa' : 'Under Review' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    return <Badge variant={config.variant}>{config.text}</Badge>;
  };

  const getLevelBadge = (level: string) => {
    const levelConfig = {
      beginner: { color: 'bg-green-100 text-green-800', text: language === 'rw' ? 'Intangiriro' : 'Beginner' },
      intermediate: { color: 'bg-yellow-100 text-yellow-800', text: language === 'rw' ? 'Hagati' : 'Intermediate' },
      advanced: { color: 'bg-red-100 text-red-800', text: language === 'rw' ? 'Byimvugo' : 'Advanced' }
    };

    const config = levelConfig[level as keyof typeof levelConfig] || levelConfig.beginner;
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        {config.text}
      </span>
    );
  };

  const handleEnroll = async () => {
    if (!onEnroll) return;
    setIsEnrolling(true);
    try {
      await onEnroll(course.id);
    } finally {
      setIsEnrolling(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(course.id);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleApprove = async () => {
    if (!onApprove) return;
    setIsApproving(true);
    try {
      await onApprove(course.id);
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!onReject) return;
    setIsRejecting(true);
    try {
      await onReject(course.id);
    } finally {
      setIsRejecting(false);
    }
  };

  const handleView = () => {
    if (onView) {
      onView(course.id);
    } else {
      navigate(`/course/${course.id}`);
    }
  };

  const renderActions = () => {
    if (variant === 'learner') {
      return (
        <div className="flex items-center space-x-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleView}
          >
            <Eye className="w-4 h-4 mr-2" />
            {language === 'rw' ? 'Kureba' : 'Preview'}
          </Button>
          {course.isEnrolled ? (
            <Button
              size="sm"
              onClick={() => navigate(`/course/${course.id}/learn`)}
            >
              <Play className="w-4 h-4 mr-2" />
              {language === 'rw' ? 'Komeza' : 'Continue'}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleEnroll}
              disabled={isEnrolling}
            >
              {isEnrolling ? (
                <LoadingSpinner size="sm" />
              ) : (
                <ChevronRight className="w-4 h-4 mr-2" />
              )}
              {language === 'rw' ? 'Kwiyandikisha' : 'Enroll'}
            </Button>
          )}
        </div>
      );
    }

    if (variant === 'tutor') {
      return (
        <div className="flex items-center space-x-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleView}
          >
            <Eye className="w-4 h-4 mr-2" />
            {language === 'rw' ? 'Kureba' : 'View'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onEdit?.(course.id)}
          >
            <Edit className="w-4 h-4 mr-2" />
            {language === 'rw' ? 'Guhindura' : 'Edit'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleDelete}
            disabled={isDeleting}
            className="text-red-600 hover:text-red-700"
          >
            {isDeleting ? (
              <LoadingSpinner size="sm" />
            ) : (
              <Trash2 className="w-4 h-4 mr-2" />
            )}
            {language === 'rw' ? 'Gusiba' : 'Delete'}
          </Button>
        </div>
      );
    }

    if (variant === 'admin') {
      return (
        <div className="flex items-center space-x-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleView}
          >
            <Eye className="w-4 h-4 mr-2" />
            {language === 'rw' ? 'Kureba' : 'View'}
          </Button>
          {(course.status === 'submitted' || course.status === 'under_review') && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={handleApprove}
                disabled={isApproving}
                className="text-green-600 hover:text-green-700"
              >
                {isApproving ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <CheckCircle className="w-4 h-4 mr-2" />
                )}
                {language === 'rw' ? 'Kwemeza' : 'Approve'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleReject}
                disabled={isRejecting}
                className="text-red-600 hover:text-red-700"
              >
                {isRejecting ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <XCircle className="w-4 h-4 mr-2" />
                )}
                {language === 'rw' ? 'Kwanga' : 'Reject'}
              </Button>
            </>
          )}
        </div>
      );
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse">
          <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-lg mb-4"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
        </div>
      </Card>
    );
  }

  return (
    <Card className={`group hover:shadow-lg transition-shadow duration-200 ${compact ? 'p-4' : 'p-6'}`}>
      {/* Course Thumbnail */}
      <div className="relative mb-4">
        <div className="w-full aspect-video bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden relative">
          {thumbnail.isLoading ? (
            <div className="flex items-center justify-center h-full">
              <LoadingSpinner size="md" />
            </div>
          ) : thumbnail.hasError ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-400">
                <BookOpen className="w-12 h-12 mx-auto mb-2" />
                <p className="text-sm">Image not available</p>
              </div>
            </div>
          ) : (
            <img
              src={thumbnail.src}
              alt={course.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
              onLoad={thumbnail.onLoad}
              onError={thumbnail.onError}
            />
          )}
        </div>
        
        {/* Status Badge */}
        <div className="absolute top-2 left-2">
          {getStatusBadge(course.status)}
        </div>
        
        {/* Duration Badge */}
        <div className="absolute top-2 right-2">
          <Badge variant="default" className="bg-black bg-opacity-75 text-white">
            <Clock className="w-3 h-3 mr-1" />
            {formatDuration(course.totalDuration)}
          </Badge>
        </div>
        
        {/* Progress Bar (for enrolled courses) */}
        {course.isEnrolled && course.progress !== undefined && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200 dark:bg-gray-700">
            <div 
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${course.progress}%` }}
            />
          </div>
        )}
      </div>

      {/* Course Info */}
      <div className="mb-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex-1 overflow-hidden">
            <span className="block overflow-hidden text-ellipsis whitespace-nowrap">
              {course.title}
            </span>
          </h3>
          {variant !== 'learner' && (
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="ml-2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <MoreVertical className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </button>
          )}
        </div>
        
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-3 overflow-hidden">
          <p className="overflow-hidden text-ellipsis whitespace-nowrap">
            {course.shortDescription || course.description}
          </p>
        </div>
        
        {/* Instructor Info */}
        <div className="flex items-center space-x-2 mb-3">
          <div className="w-6 h-6 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
            {course.instructorAvatar ? (
              <img
                src={course.instructorAvatar}
                alt={course.instructorName || 'Instructor'}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <span className="text-xs text-gray-600 dark:text-gray-400">
                {course.instructorName?.charAt(0) || '?'}
              </span>
            )}
          </div>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {course.instructorName || 'Unknown Instructor'}
          </span>
        </div>
        
        {/* Course Meta */}
        <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400 mb-3">
          <div className="flex items-center space-x-1">
            <Star className="w-4 h-4 text-yellow-500" />
            <span>{course.rating.average.toFixed(1)}</span>
            <span>({course.rating.count})</span>
          </div>
          <div className="flex items-center space-x-1">
            <Users className="w-4 h-4" />
            <span>{course.enrollmentCount}</span>
          </div>
          <div className="flex items-center space-x-1">
            <BookOpen className="w-4 h-4" />
            <span>{course.totalLessons} {language === 'rw' ? 'amasomo' : 'lessons'}</span>
          </div>
        </div>
        
        {/* Tags */}
        <div className="flex flex-wrap gap-1 mb-3">
          {getLevelBadge(course.level)}
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            {course.category}
          </span>
          {course.certificate && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
              <Award className="w-3 h-3 mr-1" />
              {language === 'rw' ? 'Icyemezo' : 'Certificate'}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold text-green-600">
          {language === 'rw' ? 'Ubuntu' : 'Free'}
        </div>
        
        {renderActions()}
      </div>
      
      {/* Additional Info for Admin/Tutor */}
      {variant !== 'learner' && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
            <span>{language === 'rw' ? 'Byashyizweho' : 'Created'}: {formatDate(course.createdAt)}</span>
            <span>{language === 'rw' ? 'Byavuguruwe' : 'Updated'}: {formatDate(course.updatedAt)}</span>
          </div>
        </div>
      )}
    </Card>
  );
};

export default EnhancedCourseCard; 