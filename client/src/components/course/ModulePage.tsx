import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
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
  ExternalLink,
  FileText,
  Download
} from 'lucide-react';

interface Module {
  id: string;
  title: string;
  description: string;
  estimatedDuration: number;
  videoUrl: string;
  videoProvider: 'youtube';
  pdfUrl?: string; // PDF lecture notes URL
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
  const { theme } = useTheme();
  const [isCompleting, setIsCompleting] = useState(false);
  const [localCompleted, setLocalCompleted] = useState(module.isCompleted);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [watchTime, setWatchTime] = useState(0);
  const [lastProgressUpdate, setLastProgressUpdate] = useState(0);
  const [error, setError] = useState<string | null>(null);

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

  // Debug logging for module data
  useEffect(() => {
    console.log('Module data received:', {
      moduleId: module.id,
      moduleTitle: module.title,
      hasPdfUrl: !!module.pdfUrl,
      pdfUrl: module.pdfUrl
    });
    
    // Test PDF URL if available
    if (module.pdfUrl) {
      const validUrl = getValidPdfUrl(module.pdfUrl);
      if (validUrl) {
        testPdfUrl(validUrl).then(isAccessible => {
          console.log('PDF URL accessibility test completed:', {
            moduleId: module.id,
            url: validUrl,
            accessible: isAccessible
          });
        });
      }
    }
  }, [module]);

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

  // Function to validate and fix PDF URL
  const getValidPdfUrl = (url: string | undefined): string | null => {
    if (!url) return null;
    
    console.log('Validating PDF URL:', url);
    
    // If it's already a valid URL, return it
    if (url.startsWith('http')) {
      console.log('URL is already valid:', url);
      return url;
    }
    
    // If it's a Firebase Storage URL without protocol, add https
    if (url.includes('storage.googleapis.com')) {
      const fixedUrl = url.startsWith('https://') ? url : `https://${url}`;
      console.log('Fixed Firebase URL:', fixedUrl);
      return fixedUrl;
    }
    
    // If it's a Cloudinary URL without protocol, add https
    if (url.includes('cloudinary.com')) {
      const fixedUrl = url.startsWith('https://') ? url : `https://${url}`;
      console.log('Fixed Cloudinary URL:', fixedUrl);
      return fixedUrl;
    }
    
    // Handle relative URLs - construct full URL
    if (url.startsWith('/') || !url.includes('://')) {
      const baseUrl = window.location.origin;
      const fullUrl = url.startsWith('/') ? `${baseUrl}${url}` : `${baseUrl}/${url}`;
      console.log('Constructed full URL from relative path:', fullUrl);
      return fullUrl;
    }
    
    console.log('Invalid URL format:', url);
    return null;
  };

  // Function to test PDF URL accessibility with better error handling
  const testPdfUrl = async (url: string): Promise<boolean> => {
    try {
      console.log('Testing PDF URL accessibility:', url);
      
      // Use a more robust approach - try to fetch with different methods
      const response = await fetch(url, { 
        method: 'HEAD',
        mode: 'cors',
        cache: 'no-cache'
      });
      
      const isAccessible = response.ok;
      console.log('PDF URL test result:', { 
        url, 
        status: response.status, 
        statusText: response.statusText,
        accessible: isAccessible,
        contentType: response.headers.get('content-type')
      });
      
      return isAccessible;
    } catch (error) {
      console.error('PDF URL test failed:', { url, error });
      
      // For CORS issues or other errors, try opening directly without testing
      // This allows PDFs to open even if HEAD request fails
      return true; // Allow opening even if test fails
    }
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
              {module.pdfUrl && (
                <div className="flex items-center gap-1 text-blue-600">
                  <FileText className="w-4 h-4" />
                  {language === 'rw' ? 'Inyandiko zirahari' : 'Notes Available'}
                </div>
              )}
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

        {/* PDF Lecture Notes - Simplified Design */}
        {(module.pdfUrl || process.env.NODE_ENV === 'development') && (
          <Card className="p-4 bg-gray-50 border border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    {language === 'rw' ? 'Inyandiko z\'Isomo' : 'Lecture Notes'}
                  </h3>
                  <p className="text-xs text-gray-600 mt-1">
                    {module.pdfUrl ? (
                      language === 'rw' 
                        ? 'Fata inyandiko z\'isomo'
                        : 'Download lecture notes'
                    ) : (
                      language === 'rw'
                        ? 'Inyandiko ntizirahari'
                        : 'Notes not available'
                    )}
                  </p>
                </div>
              </div>
              <Button
                onClick={async () => {
                  const validUrl = getValidPdfUrl(module.pdfUrl);
                  if (validUrl) {
                    console.log('Downloading PDF URL:', validUrl);
                    
                    // For Firebase URLs, try direct download first
                    if (validUrl.includes('storage.googleapis.com')) {
                      try {
                        // Try direct download for Firebase URLs
                        const link = document.createElement('a');
                        link.href = validUrl;
                        
                        // Extract filename from URL or use module title
                        const urlParts = validUrl.split('/');
                        const filename = urlParts[urlParts.length - 1] || `${module.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
                        link.download = filename;
                        
                        // Set target to _blank to avoid navigation
                        link.target = '_blank';
                        link.rel = 'noopener noreferrer';
                        
                        // Append to body, click, and remove
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        
                        console.log('Firebase PDF download initiated successfully');
                        return;
                      } catch (error) {
                        console.log('Firebase direct download failed, trying fallback:', error);
                      }
                    }
                    
                    // Try multiple URL formats to handle Cloudinary folder structure
                    const urlAttempts = [
                      validUrl, // Original URL
                      // Try different folder structures
                      validUrl.replace('/course-thumbnails/', '/pdf-docs/'), // Try pdf-docs folder
                      validUrl.replace('/pdf-docs/', '/course-thumbnails/'), // Try course-thumbnails folder
                      validUrl.replace('/profile-pictures/', '/pdf-docs/'), // Try pdf-docs folder
                      // Try different URL formats
                      validUrl.replace('/upload/', '/upload/fl_attachment/'), // Try attachment format
                      validUrl.replace('/upload/', '/upload/v1/'), // Try versioned format
                      validUrl.replace('/raw/', '/image/'), // Try image format
                      // Try without version number
                      validUrl.replace(/\/v\d+\//, '/'), // Remove version number
                      // Try with different resource types
                      validUrl.replace('/raw/upload/', '/image/upload/'), // Try image format
                      validUrl.replace('/image/upload/', '/raw/upload/'), // Try raw format
                    ];
                    
                    let success = false;
                    for (const attemptUrl of urlAttempts) {
                      try {
                        console.log('Trying to download PDF from URL:', attemptUrl);
                        
                        // First, try to fetch the PDF to check if it's accessible
                        const response = await fetch(attemptUrl, { method: 'HEAD' });
                        if (!response.ok) {
                          console.log('PDF not accessible via HEAD request:', response.status, response.statusText);
                          continue;
                        }
                        
                        // If accessible, proceed with download
                        const link = document.createElement('a');
                        link.href = attemptUrl;
                        
                        // Extract filename from URL or use module title
                        const urlParts = attemptUrl.split('/');
                        const filename = urlParts[urlParts.length - 1] || `${module.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
                        link.download = filename;
                        
                        // Set target to _blank to avoid navigation
                        link.target = '_blank';
                        link.rel = 'noopener noreferrer';
                        
                        // Append to body, click, and remove
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        
                        console.log('PDF download initiated successfully with URL:', attemptUrl);
                        success = true;
                        break;
                      } catch (error) {
                        console.log('Failed to download from URL:', attemptUrl, error);
                        continue;
                      }
                    }
                    
                    if (!success) {
                      // If all download attempts fail, try to open in new tab as fallback
                      console.log('Download failed, trying to open in new tab as fallback');
                      try {
                        const newWindow = window.open(validUrl, '_blank');
                        if (newWindow) {
                          console.log('PDF opened in new tab as fallback');
                          success = true;
                        }
                      } catch (fallbackError) {
                        console.log('Fallback also failed:', fallbackError);
                      }
                    }
                    
                    if (!success) {
                      // Final fallback: try to download through backend direct download
                      console.log('Trying backend direct download as final fallback');
                      try {
                        const downloadUrl = `${import.meta.env.VITE_API_URL || '/api/v1'}/upload/download-pdf?url=${encodeURIComponent(validUrl)}&filename=${encodeURIComponent(module.title.replace(/[^a-zA-Z0-9]/g, '_') + '.pdf')}`;
                        const link = document.createElement('a');
                        link.href = downloadUrl;
                        link.download = `${module.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
                        link.target = '_blank';
                        link.rel = 'noopener noreferrer';
                        
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        
                        console.log('Backend direct download initiated');
                        success = true;
                      } catch (downloadError) {
                        console.log('Backend direct download failed:', downloadError);
                        
                        // Ultimate fallback: proxy download
                        try {
                          const proxyUrl = `${import.meta.env.VITE_API_URL || '/api/v1'}/upload/proxy-download?url=${encodeURIComponent(validUrl)}&filename=${encodeURIComponent(module.title.replace(/[^a-zA-Z0-9]/g, '_') + '.pdf')}`;
                          const link = document.createElement('a');
                          link.href = proxyUrl;
                          link.download = `${module.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
                          link.target = '_blank';
                          link.rel = 'noopener noreferrer';
                          
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                          
                          console.log('Backend proxy download initiated as ultimate fallback');
                          success = true;
                        } catch (proxyError) {
                          console.log('Backend proxy download failed:', proxyError);
                        }
                      }
                    }
                    
                    if (!success) {
                      // If all attempts fail, show error
                      setError('PDF is not accessible. This might be due to:\n• File permissions\n• Network restrictions\n• File not found\n\nPlease contact the course instructor.');
                    }
                  } else {
                    setError('Invalid PDF URL. Please contact the course instructor.');
                  }
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors duration-200"
              >
                <Download className="h-4 w-4" />
                {language === 'rw' ? 'Kuramo' : 'Download PDF'}
              </Button>
            </div>
            
            {/* Error display for PDF issues */}
            {error && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800 whitespace-pre-line">
                  {error}
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => setError(null)}
                    className="text-xs text-red-600 hover:text-red-800 underline"
                  >
                    {language === 'rw' ? 'Funga' : 'Dismiss'}
                  </button>
                  {module.pdfUrl && (
                    <button
                      onClick={async () => {
                        try {
                          const response = await fetch(`${import.meta.env.VITE_API_URL || '/api/v1'}/upload/fix-pdf-permissions`, {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${localStorage.getItem('token')}`
                            },
                            body: JSON.stringify({ pdfUrl: module.pdfUrl })
                          });
                          
                          if (response.ok) {
                            const result = await response.json();
                            console.log('PDF permissions fixed:', result);
                            setError(null);
                            // Optionally refresh the page or update the URL
                            window.location.reload();
                          } else {
                            console.error('Failed to fix PDF permissions');
                          }
                        } catch (error) {
                          console.error('Error fixing PDF permissions:', error);
                        }
                      }}
                      className="text-xs text-blue-600 hover:text-blue-800 underline"
                    >
                      {language === 'rw' ? 'Vugura' : 'Fix Permissions'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </Card>
        )}

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