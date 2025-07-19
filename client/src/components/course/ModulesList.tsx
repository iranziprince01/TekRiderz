import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
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
  BookOpen
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
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

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

  return (
    <div className="max-w-4xl mx-auto space-y-6">
        {/* Progress Header */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {language === 'rw' ? 'Ibice by\'isomo' : 'Course Modules'}
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {userProgress ? (
                  <>
                    {userProgress.completedModules} of {userProgress.totalModules} modules completed
                  </>
                ) : (
                  `${modules.length} modules available`
                )}
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                {userProgress && typeof userProgress.overallProgress === 'number' && !isNaN(userProgress.overallProgress) 
                  ? Math.round(userProgress.overallProgress) 
                  : 0}%
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {language === 'rw' ? 'Iterambere' : 'Progress'}
              </div>
            </div>
          </div>
          
          {/* Progress Bar */}
          {userProgress && (
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
              <div 
                className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                style={{ 
                  width: `${
                    typeof userProgress.overallProgress === 'number' && !isNaN(userProgress.overallProgress) 
                      ? Math.max(0, Math.min(100, userProgress.overallProgress))
                      : 0
                  }%` 
                }}
              />
            </div>
          )}

          {/* Continue Button for next module */}
          {nextModule && (
            <div className="mt-6">
              <Button
                onClick={() => openModule(nextModule.id)}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {language === 'rw' ? 'Komeza na' : 'Continue with'}: {nextModule.title}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}
        </div>

        {/* Modules List */}
        <div className="space-y-4">
          {modules.map((module, index) => (
            <Card key={module.id} className="overflow-hidden">
              {/* Module Header - Horizontal Card */}
              <div 
                className={`flex items-center p-6 cursor-pointer transition-all duration-200 ${
                  module.isUnlocked 
                    ? 'hover:bg-gray-50 dark:hover:bg-gray-700' 
                    : 'opacity-60 cursor-not-allowed'
                }`}
                onClick={() => module.isUnlocked && toggleModule(module.id)}
              >
                {/* Module Number & Status */}
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center text-lg font-bold text-gray-700 dark:text-gray-300">
                      {index + 1}
                    </div>
                    {getModuleIcon(module)}
                  </div>

                  {/* Module Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1 truncate">
                      {module.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 text-sm line-clamp-2">
                      {module.description}
                    </p>
                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <Clock className="w-4 h-4" />
                        {formatDuration(module.estimatedDuration)}
                      </div>
                      {module.videoUrl && (
                        <div className="flex items-center gap-1 text-sm text-gray-500">
                          <Video className="w-4 h-4" />
                          {language === 'rw' ? 'Amashusho' : 'Video'}
                        </div>
                      )}
                      {module.isCompleted && (
                        <Badge variant="success" className="text-xs">
                          {language === 'rw' ? 'Byarangiye' : 'Completed'}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expand/Collapse Arrow */}
                <div className="ml-4">
                  {expandedModules.has(module.id) ? (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </div>

              {/* Expanded Module Details */}
              {expandedModules.has(module.id) && module.isUnlocked && (
                <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-6">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                        {language === 'rw' ? 'Ibisobanuro' : 'Module Description'}
                      </h4>
                      <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
                        {module.description}
                      </p>
                      
                      {/* Module Stats */}
                      <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                        <span>
                          {language === 'rw' ? 'Igihe:' : 'Duration:'} {formatDuration(module.estimatedDuration)}
                        </span>
                        {module.videoUrl && (
                          <span>
                            {language === 'rw' ? 'Ubwoko:' : 'Type:'} {language === 'rw' ? 'Amashusho' : 'Video Lesson'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Start Module Button */}
                    <Button
                      onClick={() => openModule(module.id)}
                      className="bg-blue-600 hover:bg-blue-700 text-white ml-6"
                    >
                      {module.isCompleted 
                        ? (language === 'rw' ? 'Subiramo' : 'Review') 
                        : (language === 'rw' ? 'Tangira' : 'Start Module')
                      }
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>

        {/* Course Completion Message */}
        {modules.every(module => module.isCompleted) && (
          <Card className="p-8 text-center bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              {language === 'rw' ? 'Ushaka Waje!' : 'Congratulations!'}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {language === 'rw' 
                ? 'Warangije ibice byose. Wongere ubabaze ikizamini cya nyuma!'
                : 'You\'ve completed all modules. Time for the final assessment!'
              }
            </p>
            <Button
              onClick={() => navigate(`/course/${courseId}/assessments`)}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {language === 'rw' ? 'Ikizamini cya Nyuma' : 'Take Final Assessment'}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Card>
        )}
    </div>
  );
}; 