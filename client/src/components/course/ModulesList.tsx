import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { 
  PlayCircle, 
  CheckCircle, 
  Lock,
  Clock,
  ChevronDown,
  ChevronRight,
  Video,
  ArrowRight,
  BookOpen,
  Target,
  BarChart3,
  Calendar,
  Star
} from 'lucide-react';

interface Module {
  id: string;
  title: string;
  description: string;
  estimatedDuration: number;
  videoUrl?: string;
  isCompleted: boolean;
  isUnlocked: boolean;
  order: number;
}

interface ModulesListProps {
  courseId: string;
  modules: Module[];
  userProgress?: {
    completedModules: number;
    totalModules: number;
    overallProgress: number;
  };
}

export const ModulesList: React.FC<ModulesListProps> = ({ 
  courseId, 
  modules,
  userProgress 
}) => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { theme } = useTheme();
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [highlightedModule, setHighlightedModule] = useState<number | null>(null);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);

  const toggleModule = (moduleId: string) => {
    const newExpanded = new Set(expandedModules);
    if (newExpanded.has(moduleId)) {
      newExpanded.delete(moduleId);
    } else {
      newExpanded.add(moduleId);
    }
    setExpandedModules(newExpanded);
  };

  const openModule = (moduleId: string) => {
    navigate(`/course/${courseId}/module/${moduleId}`);
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

  const getModuleIcon = (module: Module) => {
    if (module.isCompleted) {
      return <CheckCircle className="w-6 h-6 text-green-500" />;
    } else if (module.isUnlocked) {
      return <PlayCircle className="w-6 h-6 text-blue-500" />;
    } else {
      return <Lock className="w-6 h-6 text-gray-400" />;
    }
  };

  const getNextModule = () => {
    return modules.find(module => module.isUnlocked && !module.isCompleted);
  };

  const nextModule = getNextModule();

  // Handle accessibility events
  useEffect(() => {
    const handleHighlightModule = (event: CustomEvent) => {
      const { moduleNumber, action } = event.detail;
      setHighlightedModule(moduleNumber);
      
      // Find the module by number (1-based index)
      const targetModule = modules[moduleNumber - 1];
      if (targetModule) {
        // Expand the module
        setExpandedModules(prev => new Set([...prev, targetModule.id]));
        
        // Scroll to module after a short delay
        setTimeout(() => {
          const element = document.getElementById(`module-${targetModule.id}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
      }
    };

    window.addEventListener('highlightModule', handleHighlightModule as EventListener);
    
    return () => {
      window.removeEventListener('highlightModule', handleHighlightModule as EventListener);
    };
  }, [modules]);

  const handleContinueNextModule = () => {
    if (nextModule) {
      openModule(nextModule.id);
    }
  };

  const handleStartCurrentModule = () => {
    const firstUnlocked = modules.find(m => m.isUnlocked);
    if (firstUnlocked) {
      openModule(firstUnlocked.id);
    }
  };

  const handleCompleteCurrentModule = () => {
    // This would typically be handled by the module page itself
    console.log('Module completion handled by module page');
  };

  const handleModuleAction = (module: Module, action: 'start' | 'review' | 'expand') => {
    switch (action) {
      case 'start':
        openModule(module.id);
        break;
      case 'review':
        openModule(module.id);
        break;
      case 'expand':
        toggleModule(module.id);
        break;
    }
  };

  const handleModuleKeyDown = (event: React.KeyboardEvent, module: Module) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (module.isUnlocked) {
        openModule(module.id);
      }
    }
  };

  const getModuleStatus = (module: Module) => {
    if (module.isCompleted) return 'completed';
    if (module.isUnlocked) return 'available';
    return 'locked';
  };

  const getProgressPercentage = () => {
    if (!userProgress || userProgress.totalModules === 0) return 0;
    return Math.round((userProgress.completedModules / userProgress.totalModules) * 100);
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {language === 'rw' ? 'Ibice by\'Isomo' : 'Course Modules'}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {language === 'rw' 
                ? 'Fata amasomo yawe kandi ufate ibizamini'
                : 'Take your lessons and complete assessments'
              }
            </p>
          </div>
          
          {/* Progress Overview */}
          <div className="text-right">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {getProgressPercentage()}%
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {language === 'rw' ? 'Byarangiye' : 'Complete'}
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

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <BookOpen className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {modules.length}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {language === 'rw' ? 'Ibice' : 'Modules'}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {userProgress?.completedModules || 0}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {language === 'rw' ? 'Byarangiye' : 'Completed'}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Clock className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {modules.reduce((total, module) => total + module.estimatedDuration, 0)}m
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {language === 'rw' ? 'Igihe' : 'Duration'}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <Target className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {modules.filter(m => m.isUnlocked && !m.isCompleted).length}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {language === 'rw' ? 'Bisubirwa' : 'Remaining'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      {nextModule && (
        <div className="mb-6">
          <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700">
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                    <PlayCircle className="w-6 h-6 text-blue-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {language === 'rw' ? 'Komeza Inyigisho' : 'Continue Learning'}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      {language === 'rw' 
                        ? `Igice ${nextModule.order}: ${nextModule.title}`
                        : `Module ${nextModule.order}: ${nextModule.title}`
                      }
                    </p>
                  </div>
                </div>
                <Button
                  onClick={handleContinueNextModule}
                  variant="primary"
                  className="flex items-center gap-2"
                >
                  {language === 'rw' ? 'Komeza' : 'Continue'}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Modules Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {modules.map((module, index) => {
          const isExpanded = expandedModules.has(module.id);
          const status = getModuleStatus(module);
          const isHighlighted = highlightedModule === index + 1;
          
          return (
            <div 
              key={module.id}
              id={`module-${module.id}`}
              className={`
                transition-all duration-300 cursor-pointer border-2 rounded-lg
                ${isHighlighted 
                  ? 'border-blue-500 shadow-lg scale-105' 
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }
                ${status === 'completed' 
                  ? 'bg-green-50 dark:bg-green-900/10' 
                  : status === 'locked' 
                    ? 'bg-gray-50 dark:bg-gray-800/50' 
                    : 'bg-white dark:bg-gray-800'
                }
              `}
              onClick={() => {
                if (module.isUnlocked) {
                  openModule(module.id);
                }
              }}
              onKeyDown={(e: React.KeyboardEvent) => handleModuleKeyDown(e, module)}
              tabIndex={0}
              role="button"
              aria-label={`${language === 'rw' ? 'Igice' : 'Module'} ${module.order}: ${module.title}`}
            >
              <Card className="border-0 shadow-none">
              <div className="p-6">
                {/* Module Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      {getModuleIcon(module)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                                                 <Badge variant={status === 'completed' ? 'success' : status === 'locked' ? 'info' : 'default'}>
                           {language === 'rw' ? 'Igice' : 'Module'} {module.order}
                         </Badge>
                         {status === 'locked' && (
                           <Badge variant="info">
                             <Lock className="w-3 h-3 mr-1" />
                             {language === 'rw' ? 'Ntabwo ahari' : 'Locked'}
                           </Badge>
                         )}
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                        {module.title}
                      </h3>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {formatDuration(module.estimatedDuration)}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleModule(module.id);
                      }}
                      className="p-1"
                    >
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                {/* Module Description */}
                <p className="text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                  {module.description}
                </p>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <Video className="w-4 h-4" />
                        <span>{language === 'rw' ? 'Amashusho y\'inyigisho' : 'Video lesson'}</span>
                      </div>
                      
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <Target className="w-4 h-4" />
                        <span>{language === 'rw' ? 'Ibihezo by\'inyigisho' : 'Learning objectives'}</span>
                      </div>
                      
                      {module.isCompleted && (
                        <div className="flex items-center gap-2 text-sm text-green-600">
                          <CheckCircle className="w-4 h-4" />
                          <span>{language === 'rw' ? 'Byarangiye' : 'Completed'}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {module.isCompleted && (
                      <Badge variant="success" className="text-xs">
                        {language === 'rw' ? 'Byarangiye' : 'Completed'}
                      </Badge>
                    )}
                                         {!module.isUnlocked && (
                       <Badge variant="info" className="text-xs">
                         {language === 'rw' ? 'Ntabwo ahari' : 'Locked'}
                       </Badge>
                     )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {module.isUnlocked && !module.isCompleted && (
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          openModule(module.id);
                        }}
                        variant="primary"
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        <PlayCircle className="w-4 h-4" />
                        {language === 'rw' ? 'Tangira' : 'Start'}
                      </Button>
                    )}
                    
                    {module.isCompleted && (
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          openModule(module.id);
                        }}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        <BookOpen className="w-4 h-4" />
                        {language === 'rw' ? 'Subiramo' : 'Review'}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
              </div>
          );
        })}
      </div>

      {/* Empty State */}
      {modules.length === 0 && (
        <div className="text-center py-12">
          <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {language === 'rw' ? 'Nta bice bihari' : 'No modules available'}
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {language === 'rw' 
              ? 'Ibice bizatangira kugaragara nyuma y\'uko umwarimu abishyiremo'
              : 'Modules will appear here once the instructor adds them'
            }
          </p>
        </div>
      )}
    </div>
  );
}; 