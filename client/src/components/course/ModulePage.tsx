import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { updateLessonProgress } from '../../utils/api';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { 
  CheckCircle, 
  ArrowRight,
  ArrowLeft,
  Clock,
  Video,
  Play,
  ExternalLink
} from 'lucide-react';

interface Module {
  id: string;
  title: string;
  description: string;
  estimatedDuration: number;
  videoUrl: string;
  videoProvider: 'youtube';
  order: number;
  isCompleted: boolean;
  nextModuleId?: string;
  hasQuiz?: boolean;
}

interface ModulePageProps {
  module: Module;
  courseId: string;
  onMarkComplete: (moduleId: string) => Promise<void>;
  onProgress?: (moduleId: string, progress: number) => void;
}

export const ModulePage: React.FC<ModulePageProps> = ({ 
  module, 
  courseId,
  onMarkComplete,
  onProgress 
}) => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const [isCompleting, setIsCompleting] = useState(false);
  const [localCompleted, setLocalCompleted] = useState(module.isCompleted);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [watchTime, setWatchTime] = useState(0);
  const [lastProgressUpdate, setLastProgressUpdate] = useState(0);

  // Extract YouTube video ID from URL
  const extractYouTubeId = (url: string): string => {
    if (!url) return '';
    
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^"&?\/\s]{11})/,
      /^([^"&?\/\s]{11})$/ // Direct video ID
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    
    return '';
  };

  const videoId = extractYouTubeId(module.videoUrl);

  useEffect(() => {
    setLocalCompleted(module.isCompleted);
  }, [module.isCompleted]);

  // Track video watching time and sync to CouchDB
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (videoLoaded && !localCompleted) {
      interval = setInterval(async () => {
        const newWatchTime = watchTime + 10; // Increment by 10 seconds
        setWatchTime(newWatchTime);

        // Update progress every 30 seconds
        if (newWatchTime - lastProgressUpdate >= 30) {
          try {
            const progressPercentage = Math.min(
              (newWatchTime / (module.estimatedDuration * 60)) * 100, 
              100
            );

            await updateLessonProgress(courseId, module.id, {
              timeSpent: newWatchTime,
              currentPosition: progressPercentage,
              interactions: [{
                type: 'video_progress',
                timestamp: new Date().toISOString(),
                data: { 
                  position: progressPercentage,
                  timeSpent: newWatchTime,
                  moduleId: module.id,
                  courseId
                }
              }]
            });

            setLastProgressUpdate(newWatchTime);
            
            // Notify parent component
            if (onProgress) {
              onProgress(module.id, progressPercentage);
            }

            console.log('Progress updated:', {
              moduleId: module.id,
              timeSpent: newWatchTime,
              progress: progressPercentage
            });
          } catch (error) {
            console.error('Error updating progress:', error);
          }
        }
      }, 10000); // Update every 10 seconds
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [videoLoaded, localCompleted, watchTime, lastProgressUpdate, module.estimatedDuration, module.id, courseId, onProgress]);

  const handleComplete = async () => {
    if (isCompleting || localCompleted) return;

    setIsCompleting(true);
    try {
      await onMarkComplete(module.id);
      setLocalCompleted(true);
      
      // Final progress sync
      await updateLessonProgress(courseId, module.id, {
        timeSpent: watchTime,
        currentPosition: 100,
        interactions: [{
          type: 'module_completed',
          timestamp: new Date().toISOString(),
          data: { 
            moduleId: module.id,
            courseId,
            totalTimeSpent: watchTime,
            completedAt: new Date().toISOString()
          }
        }]
      });
      
      console.log('Module marked as complete:', {
        moduleId: module.id,
        totalWatchTime: watchTime
      });
    } catch (error) {
      console.error('Error completing module:', error);
    } finally {
      setIsCompleting(false);
    }
  };

  const handleContinue = () => {
    if (module.nextModuleId) {
      navigate(`/course/${courseId}/module/${module.nextModuleId}`);
    } else {
      // No next module - go to assessments
      navigate(`/course/${courseId}/assessments`);
    }
  };

  const handleBackToModules = () => {
    navigate(`/course/${courseId}/modules`);
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
          return `${hours}h ${remainingMinutes}m`;
    };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
        {/* Navigation Header */}
        <div className="flex items-center justify-between">
          <Button
            onClick={handleBackToModules}
            variant="outline"
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            {language === 'rw' ? 'Garuka ku bice' : 'Back to Modules'}
          </Button>
          
          <div className="flex items-center gap-2">
            <Badge variant="default">
              {language === 'rw' ? 'Igice' : 'Module'} {module.order}
            </Badge>
            {localCompleted && (
              <Badge variant="success">
                {language === 'rw' ? 'Byarangiye' : 'Completed'}
              </Badge>
            )}
          </div>
        </div>

        {/* Module Header */}
        <Card className="p-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              {module.title}
            </h1>
            
            <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-6">
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {formatDuration(module.estimatedDuration)}
              </div>
              <div className="flex items-center gap-1">
                <Video className="w-4 h-4" />
                {language === 'rw' ? 'Amashusho' : 'Video Lesson'}
              </div>
            </div>

            <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-lg">
              {module.description}
            </p>
          </div>
        </Card>

        {/* Video Player */}
        <Card className="overflow-hidden">
          <div className="relative">
            <div className="w-full bg-gray-900 rounded-lg overflow-hidden" style={{ aspectRatio: '16/9', minHeight: '400px' }}>
              {videoId && module.videoProvider === 'youtube' ? (
                <iframe
                  src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&controls=1&showinfo=0&fs=1`}
                  title={module.title}
                  className="w-full h-full border-0"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                  allowFullScreen
                  onLoad={() => setVideoLoaded(true)}
                  loading="lazy"
                  style={{ minHeight: '400px' }}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-white" style={{ minHeight: '400px' }}>
                  <div className="text-center">
                    <Play className="w-16 h-16 mx-auto mb-4 opacity-60" />
                    <p className="text-lg opacity-80">
                      {language === 'rw' ? 'Amashusho ntabwo ahari' : 'Video not available'}
                    </p>
                    {module.videoUrl && (
                      <a 
                        href={module.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 mt-4 text-blue-400 hover:text-blue-300"
                      >
                        <ExternalLink className="w-4 h-4" />
                        {language === 'rw' ? 'Fungura hanze' : 'Open External Link'}
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Progress and Actions */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Progress Info */}
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {language === 'rw' ? 'Igihe cyakoreshejwe:' : 'Time spent:'} {Math.floor(watchTime / 60)}m {watchTime % 60}s
              </div>
              
              {localCompleted && (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">
                    {language === 'rw' ? 'Byarangiye' : 'Completed'}
                  </span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              {!localCompleted && (
                <Button
                  onClick={handleComplete}
                  variant="primary"
                  disabled={isCompleting}
                  className="flex items-center gap-2"
                >
                  {isCompleting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      {language === 'rw' ? 'Birasabwa...' : 'Marking...'}
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      {language === 'rw' ? 'Rangiza igice' : 'Mark as Complete'}
                    </>
                  )}
                </Button>
              )}
              
              {localCompleted && (
                <Button
                  onClick={handleContinue}
                  variant="primary"
                  className="flex items-center gap-2"
                >
                  {language === 'rw' ? 'Komeza' : 'Continue'}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
              <span>{language === 'rw' ? 'Aho ugeze' : 'Progress'}</span>
              <span>
                {localCompleted ? '100%' : `${Math.round((watchTime / (module.estimatedDuration * 60)) * 100)}%`}
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-300 ${
                  localCompleted ? 'bg-green-500' : 'bg-blue-500'
                }`}
                style={{ 
                  width: localCompleted ? '100%' : `${Math.min((watchTime / (module.estimatedDuration * 60)) * 100, 100)}%` 
                }}
              />
            </div>
          </div>
        </Card>
    </div>
  );
}; 