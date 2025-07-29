import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { getLearnerOfflineStatus } from '../../offline/cacheService';
import { getEssentialOfflineStatus } from '../../offline/offlineEssentials';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { 
  Wifi, 
  WifiOff, 
  Database, 
  HardDrive, 
  RefreshCw, 
  AlertTriangle,
  CheckCircle,
  X,
  Info,
  Settings
} from 'lucide-react';

interface CacheStatus {
  staticCache: boolean;
  dynamicCache: boolean;
  cacheEntries: number;
  lastUpdated: string;
}

interface OfflineStatusProps {
  showDetails?: boolean;
  position?: 'bottom-right' | 'top-right' | 'bottom-left' | 'top-left';
}

const OfflineStatus: React.FC<OfflineStatusProps> = ({ 
  showDetails = false, 
  position = 'bottom-right' 
}) => {
  const { isOfflineMode, user } = useAuth();
  const { t } = useLanguage();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [cacheStatus, setCacheStatus] = useState<CacheStatus | null>(null);
  const [learnerStatus, setLearnerStatus] = useState<any>(null);
  const [essentialStatus, setEssentialStatus] = useState<any>(null);
  const [isExpanded, setIsExpanded] = useState(showDetails);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Position classes
  const getPositionClasses = () => {
    switch (position) {
      case 'top-right':
        return 'top-4 right-4';
      case 'bottom-left':
        return 'bottom-4 left-4';
      case 'top-left':
        return 'top-4 left-4';
      default:
        return 'bottom-4 right-4';
    }
  };

  useEffect(() => {
    const checkCacheStatus = async () => {
      try {
        if ('caches' in window) {
          const staticCache = await caches.open('tekriders-static-v1');
          const dynamicCache = await caches.open('tekriders-dynamic-v1');
          
          const staticKeys = await staticCache.keys();
          const dynamicKeys = await dynamicCache.keys();
          
          setCacheStatus({
            staticCache: staticKeys.length > 0,
            dynamicCache: dynamicKeys.length > 0,
            cacheEntries: staticKeys.length + dynamicKeys.length,
            lastUpdated: new Date().toLocaleTimeString()
          });
        }
      } catch (error) {
        console.error('Failed to check cache status:', error);
      }
    };

    const checkLearnerStatus = async () => {
      try {
        if (user?.role === 'learner') {
          const status = await getLearnerOfflineStatus();
          setLearnerStatus(status);
        }
      } catch (error) {
        console.error('Failed to check learner status:', error);
      }
    };

    const checkEssentialStatus = () => {
      try {
        const status = getEssentialOfflineStatus();
        setEssentialStatus(status);
      } catch (error) {
        console.error('Failed to check essential status:', error);
      }
    };

    const updateAllStatus = async () => {
      setIsLoading(true);
      await Promise.all([
        checkCacheStatus(),
        checkLearnerStatus(),
        checkEssentialStatus()
      ]);
      setLastUpdate(new Date());
      setIsLoading(false);
    };

    updateAllStatus();

    const interval = setInterval(updateAllStatus, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [user?.role]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Don't show when online and not in offline mode, unless explicitly requested
  if (!isExpanded && !isOfflineMode && isOnline && !showDetails) {
    return null;
  }

  const handleRefresh = () => {
    window.location.reload();
  };

  const handleClearCache = async () => {
    if (confirm('Are you sure you want to clear all cached data? This will remove offline content.')) {
      try {
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map(name => caches.delete(name)));
          setCacheStatus({
            staticCache: false,
            dynamicCache: false,
            cacheEntries: 0,
            lastUpdated: new Date().toLocaleTimeString()
          });
        }
      } catch (error) {
        console.error('Failed to clear cache:', error);
      }
    }
  };

  const getStatusColor = () => {
    if (isOnline && !isOfflineMode) return 'bg-green-500';
    if (isOnline && isOfflineMode) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getStatusText = () => {
    if (isOnline && !isOfflineMode) return 'Online';
    if (isOnline && isOfflineMode) return 'Online (Offline Mode)';
    return 'Offline';
  };

  const getStatusIcon = () => {
    if (isOnline && !isOfflineMode) return <Wifi className="w-4 h-4" />;
    if (isOnline && isOfflineMode) return <Wifi className="w-4 h-4" />;
    return <WifiOff className="w-4 h-4" />;
  };

  return (
    <div className={`fixed ${getPositionClasses()} z-50 transition-all duration-300 ${
      isExpanded ? 'w-80' : 'w-auto'
    }`}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${getStatusColor()}`}></div>
            <span className="font-medium text-sm">
              {getStatusText()} Mode
            </span>
          </div>
          <div className="flex items-center space-x-2">
            {isLoading && <LoadingSpinner size="sm" className="text-white" />}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-white hover:text-gray-200 transition-colors"
            >
              {isExpanded ? <X className="w-4 h-4" /> : <Info className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Content */}
        {isExpanded && (
          <div className="p-4 space-y-4">
            {/* Network Status */}
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-2">
                {getStatusIcon()}
                <span className="text-gray-600 dark:text-gray-300">Network:</span>
              </div>
              <span className={`font-medium ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
                {isOnline ? 'Connected' : 'Disconnected'}
              </span>
            </div>

            {/* Cache Status */}
            {cacheStatus && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-2">
                    <Database className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600 dark:text-gray-300">Cache:</span>
                  </div>
                  <span className={`font-medium ${cacheStatus.cacheEntries > 0 ? 'text-green-600' : 'text-yellow-600'}`}>
                    {cacheStatus.cacheEntries} entries
                  </span>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-300">Static Cache:</span>
                  <div className="flex items-center space-x-1">
                    {cacheStatus.staticCache ? (
                      <CheckCircle className="w-3 h-3 text-green-500" />
                    ) : (
                      <AlertTriangle className="w-3 h-3 text-yellow-500" />
                    )}
                    <span className={`font-medium ${cacheStatus.staticCache ? 'text-green-600' : 'text-yellow-600'}`}>
                      {cacheStatus.staticCache ? 'Ready' : 'Missing'}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-300">Dynamic Cache:</span>
                  <div className="flex items-center space-x-1">
                    {cacheStatus.dynamicCache ? (
                      <CheckCircle className="w-3 h-3 text-green-500" />
                    ) : (
                      <AlertTriangle className="w-3 h-3 text-yellow-500" />
                    )}
                    <span className={`font-medium ${cacheStatus.dynamicCache ? 'text-green-600' : 'text-yellow-600'}`}>
                      {cacheStatus.dynamicCache ? 'Ready' : 'Missing'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Learner Status */}
            {learnerStatus && user?.role === 'learner' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-2">
                    <HardDrive className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600 dark:text-gray-300">Offline Data:</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    {learnerStatus.hasOfflineData ? (
                      <CheckCircle className="w-3 h-3 text-green-500" />
                    ) : (
                      <AlertTriangle className="w-3 h-3 text-red-500" />
                    )}
                    <span className={`font-medium ${learnerStatus.hasOfflineData ? 'text-green-600' : 'text-red-600'}`}>
                      {learnerStatus.hasOfflineData ? 'Available' : 'Not Available'}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-300">Enrolled Courses:</span>
                  <span className="font-medium text-blue-600">
                    {learnerStatus.enrolledCoursesCount}
                  </span>
                </div>
                
                {learnerStatus.lastSync && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-300">Last Sync:</span>
                    <span className="font-medium text-gray-800 dark:text-gray-200">
                      {new Date(learnerStatus.lastSync).toLocaleTimeString()}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Essential Status */}
            {essentialStatus && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-300">Local Data:</span>
                  <div className="flex items-center space-x-1">
                    {essentialStatus.hasLocalData ? (
                      <CheckCircle className="w-3 h-3 text-green-500" />
                    ) : (
                      <AlertTriangle className="w-3 h-3 text-red-500" />
                    )}
                    <span className={`font-medium ${essentialStatus.hasLocalData ? 'text-green-600' : 'text-red-600'}`}>
                      {essentialStatus.hasLocalData ? 'Available' : 'Not Available'}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-300">Course Access:</span>
                  <div className="flex items-center space-x-1">
                    {essentialStatus.canAccessCourses ? (
                      <CheckCircle className="w-3 h-3 text-green-500" />
                    ) : (
                      <AlertTriangle className="w-3 h-3 text-yellow-500" />
                    )}
                    <span className={`font-medium ${essentialStatus.canAccessCourses ? 'text-green-600' : 'text-yellow-600'}`}>
                      {essentialStatus.canAccessCourses ? 'Ready' : 'Limited'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Last Update */}
            <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
              Last updated: {lastUpdate.toLocaleTimeString()}
            </div>

            {/* Actions */}
            <div className="pt-2 border-t border-gray-200 dark:border-gray-700 space-y-2">
              <Button
                onClick={handleRefresh}
                size="sm"
                className="w-full"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh Page
              </Button>
              
              <Button
                onClick={handleClearCache}
                variant="outline"
                size="sm"
                className="w-full"
              >
                <Settings className="w-4 h-4 mr-2" />
                Clear Cache
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OfflineStatus; 