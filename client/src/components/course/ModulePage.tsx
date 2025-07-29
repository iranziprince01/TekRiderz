import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
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
  Download,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  List,
  Target,
  Lightbulb
} from 'lucide-react';
import { saveOfflineProgress, completeOfflineModule, handleOfflineError } from '../../offline/offlineEssentials';
import { usePdfDownload } from '../../services/pdfDownloadService';

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
  modules?: Module[]; // Add modules for sidebar
  currentModuleIndex?: number; // Add current module index
}

export const ModulePage: React.FC<ModulePageProps> = ({ 
  module, 
  courseId,
  onMarkComplete,
  onProgress,
  modules = [],
  currentModuleIndex = 0
}) => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { theme } = useTheme();
  const { isOfflineMode } = useAuth();
  const { openPdfInNewTab, isPdfAvailableOffline, isPdfUrlAccessible } = usePdfDownload();
  const [isCompleting, setIsCompleting] = useState(false);
  const [localCompleted, setLocalCompleted] = useState(module.isCompleted);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [watchTime, setWatchTime] = useState(0);
  const [lastProgressUpdate, setLastProgressUpdate] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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

  // Detect offline mode
  useEffect(() => {
    const checkOfflineMode = () => {
      const offline = isOfflineMode || !navigator.onLine;
      setIsOffline(offline);
      if (offline) {
        console.log('📱 Module page in offline mode');
      }
    };
    
    checkOfflineMode();
    window.addEventListener('online', checkOfflineMode);
    window.addEventListener('offline', checkOfflineMode);
    
    return () => {
      window.removeEventListener('online', checkOfflineMode);
      window.removeEventListener('offline', checkOfflineMode);
    };
  }, [isOfflineMode]);

  // Track video watch time
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (videoLoaded && !localCompleted && !isOffline) {
      interval = setInterval(() => {
        setWatchTime(prev => {
          const newTime = prev + 1;
          
          // Update progress every 30 seconds
          if (newTime - lastProgressUpdate >= 30) {
            setLastProgressUpdate(newTime);
            if (onProgress) {
              onProgress(module.id, Math.min((newTime / (module.estimatedDuration * 60)) * 100, 100));
            }
          }
          
          return newTime;
        });
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [videoLoaded, localCompleted, isOffline, module.id, module.estimatedDuration, onProgress, lastProgressUpdate]);

  // Enhanced PDF viewer handler using the new service
  const handlePdfView = async () => {
    if (!module.pdfUrl) {
      setError('No PDF available for this module.');
      return;
    }

    try {
      setError(null);
      console.log('📄 Opening PDF in new tab:', module.pdfUrl);
      
      // Check if PDF is available offline first
      const isOfflineAvailable = await isPdfAvailableOffline(module.pdfUrl);
      if (isOfflineAvailable) {
        console.log('📄 PDF is available offline, opening from cache');
      } else {
        console.log('📄 PDF not in cache, will open from network');
        
        // Check if URL is accessible (only if online)
        if (navigator.onLine) {
          const isAccessible = await isPdfUrlAccessible(module.pdfUrl);
          if (!isAccessible) {
            console.warn('⚠️ PDF URL appears to be inaccessible');
          }
        }
      }
      
      // Open PDF in new tab (original intended flow)
      await openPdfInNewTab(
        module.pdfUrl,
        module.id,
        courseId
      );
      
      console.log('📄 PDF opened in new tab successfully');
      
      // Clear any existing error after successful opening
      setError(null);
      
    } catch (error) {
      console.error('❌ Failed to open PDF:', error);
      
      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes('popup may be blocked')) {
          setError('PDF could not be opened. Please allow popups for this site and try again.');
        } else if (error.message.includes('Failed to fetch')) {
          setError('Network error. Please check your internet connection and try again.');
        } else {
          setError(`Failed to open PDF: ${error.message}`);
        }
      } else {
        setError('Failed to open PDF. Please try again or contact support.');
      }
    }
  };

  const handleComplete = async () => {
    if (isCompleting || isOffline) return;
    
    setIsCompleting(true);
    setError(null);
    
    try {
      if (isOfflineMode) {
        // Handle offline completion
        const userId = localStorage.getItem('currentUserId') || '';
        await completeOfflineModule(userId, courseId, module.id);
        setLocalCompleted(true);
        console.log('✅ Module marked complete offline');
      } else {
        // Handle online completion
        await onMarkComplete(module.id);
        setLocalCompleted(true);
        console.log('✅ Module marked complete online');
      }
    } catch (error) {
      console.error('❌ Failed to mark module complete:', error);
      setError(language === 'rw' 
        ? 'Ntibyashoboka kwandika igice nk\'uko byarangiye. Ongera ugerageze.'
        : 'Failed to mark module as complete. Please try again.'
      );
      
             // Handle offline error
       if (isOfflineMode) {
         handleOfflineError(error, 'module_completion');
       }
    } finally {
      setIsCompleting(false);
    }
  };

  const handleContinue = () => {
    if (module.nextModuleId) {
      navigate(`/course/${courseId}/module/${module.nextModuleId}`);
    } else {
      // Navigate to next available module or back to modules list
      const nextModule = modules.find(m => m.order === module.order + 1);
      if (nextModule) {
        navigate(`/course/${courseId}/module/${nextModule.id}`);
      } else {
        navigate(`/course/${courseId}/modules`);
      }
    }
  };

  const handleBackToModules = () => {
    navigate(`/course/${courseId}/modules`);
  };

  const formatDuration = (minutes: number) => {
    // Handle NaN, undefined, or invalid values
    if (!minutes || isNaN(minutes) || minutes < 0) {
      return 'N/A';
    }
    
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };



  const navigateToModule = (moduleId: string) => {
    navigate(`/course/${courseId}/module/${moduleId}`);
  };

  const getModuleStatus = (module: Module) => {
    if (module.isCompleted) return 'completed';
    if (module.id === module.id) return 'current';
    return 'upcoming';
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Module Sidebar */}
      <div className={`
        ${sidebarCollapsed ? 'w-16' : 'w-80'} 
        bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 
        transition-all duration-300 ease-in-out flex flex-col
      `}>
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
                         {!sidebarCollapsed && (
               <div className="flex items-center gap-2">
                 <BookOpen className="w-5 h-5 text-blue-500" />
                 <span className="font-semibold text-gray-900 dark:text-white">
                   {language === 'rw' ? 'Ibice' : 'Modules'}
                 </span>
               </div>
             )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-1"
            >
              {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* Module List */}
        <div className="flex-1 overflow-y-auto">
          {modules.map((mod, index) => (
            <div
              key={mod.id}
              onClick={() => navigateToModule(mod.id)}
              className={`
                p-3 cursor-pointer transition-colors duration-200 border-l-4
                ${mod.id === module.id 
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500' 
                  : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }
              `}
            >
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  {mod.isCompleted ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : mod.id === module.id ? (
                    <Play className="w-5 h-5 text-blue-500" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-600" />
                  )}
                </div>
                {!sidebarCollapsed && (
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`
                        text-sm font-medium truncate
                        ${mod.id === module.id 
                          ? 'text-blue-600 dark:text-blue-400' 
                          : 'text-gray-900 dark:text-white'
                        }
                      `}>
                        {language === 'rw' ? 'Igice' : 'Module'} {mod.order}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatDuration(mod.estimatedDuration)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 truncate mt-1">
                      {mod.title}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Sidebar Footer */}
        {!sidebarCollapsed && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              onClick={handleBackToModules}
              variant="outline"
              className="w-full"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {language === 'rw' ? 'Garuka ku bice' : 'Back to Modules'}
            </Button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Video Player Section */}
        <div className="h-96 bg-black relative">
          {isOffline ? (
            <div className="flex items-center justify-center h-full text-white">
              <div className="text-center">
                <Video className="w-16 h-16 mx-auto mb-4 opacity-60" />
                <p className="text-lg opacity-80 mb-2">
                  {language === 'rw' ? 'Reconnect to view video' : 'Reconnect to view video'}
                </p>
                <p className="text-sm opacity-60">
                  {language === 'rw' ? 'Video content requires internet connection' : 'Video content requires internet connection'}
                </p>
              </div>
            </div>
          ) : videoId && module.videoProvider === 'youtube' ? (
            <iframe
              src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&controls=1&showinfo=0&fs=1`}
              title={module.title}
              className="w-full h-full border-0"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
              allowFullScreen
              onLoad={() => setVideoLoaded(true)}
              loading="lazy"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-white">
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

        {/* Content Section */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Module Header */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Badge variant="default">
                    {language === 'rw' ? 'Igice' : 'Module'} {module.order}
                  </Badge>
                  {localCompleted && (
                    <Badge variant="success">
                      {language === 'rw' ? 'Byarangiye' : 'Completed'}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Clock className="w-4 h-4" />
                  {formatDuration(module.estimatedDuration)}
                </div>
              </div>
              
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                {module.title}
              </h1>
              
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                {module.description}
              </p>
            </div>

            

            {/* Resources Section */}
            {(module.pdfUrl || process.env.NODE_ENV === 'development') && (
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                                 <div className="flex items-center gap-2 mb-4">
                   <FileText className="w-5 h-5 text-blue-500" />
                   <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                     {language === 'rw' ? 'Ibikoresho' : 'Resources'}
                   </h3>
                 </div>
                
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                                         <div className="flex items-center gap-3">
                       <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                         <FileText className="w-5 h-5 text-blue-500" />
                       </div>
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white">
                          {language === 'rw' ? 'Inyandiko z\'Isomo' : 'Lecture Notes'}
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {isOffline ? (
                            language === 'rw' 
                              ? 'Reconnect to view PDF'
                              : 'Reconnect to view PDF'
                          ) : module.pdfUrl ? (
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
                      onClick={handlePdfView}
                                             className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors duration-200"
                    >
                      <FileText className="h-4 w-4" />
                      {language === 'rw' ? 'Reba' : 'View PDF'}
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
                                console.log('Retrying PDF view with enhanced service...');
                                setError(null);
                                await handlePdfView();
                              } catch (error) {
                                console.error('PDF retry failed:', error);
                                setError('Failed to open PDF. Please check your internet connection and try again.');
                              }
                            }}
                            className="text-xs text-blue-600 hover:text-blue-800 underline"
                          >
                            {language === 'rw' ? 'Ongera ugerageze' : 'Retry View'}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Progress and Actions */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
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
                      disabled={isCompleting || isOffline}
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}; 