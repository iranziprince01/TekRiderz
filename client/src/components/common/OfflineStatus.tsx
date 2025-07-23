import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getLearnerOfflineStatus } from '../../offline/cacheService';

interface CacheStatus {
  staticCache: boolean;
  dynamicCache: boolean;
  cacheEntries: number;
  lastUpdated: string;
}

interface OfflineStatusProps {
  showDetails?: boolean;
}

const OfflineStatus: React.FC<OfflineStatusProps> = ({ showDetails = false }) => {
  const { isOfflineMode } = useAuth();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [cacheStatus, setCacheStatus] = useState<CacheStatus | null>(null);
  const [learnerStatus, setLearnerStatus] = useState<any>(null);
  const [isExpanded, setIsExpanded] = useState(showDetails);

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
        const status = await getLearnerOfflineStatus();
        setLearnerStatus(status);
      } catch (error) {
        console.error('Failed to check learner status:', error);
      }
    };

    checkCacheStatus();
    checkLearnerStatus();

    const interval = setInterval(() => {
      checkCacheStatus();
      checkLearnerStatus();
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, []);

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

  if (!isExpanded && !isOfflineMode && isOnline) {
    return null; // Don't show when online and not in offline mode
  }

  return (
    <div className={`fixed bottom-4 right-4 z-50 transition-all duration-300 ${
      isExpanded ? 'w-80' : 'w-auto'
    }`}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-400' : 'bg-red-400'}`}></div>
            <span className="font-medium text-sm">
              {isOnline ? 'Online' : 'Offline'} Mode
            </span>
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-white hover:text-gray-200 transition-colors"
          >
            {isExpanded ? '−' : '+'}
          </button>
        </div>

        {/* Content */}
        {isExpanded && (
          <div className="p-4 space-y-3">
            {/* Network Status */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-300">Network:</span>
              <span className={`font-medium ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
                {isOnline ? 'Connected' : 'Disconnected'}
              </span>
            </div>

            {/* Cache Status */}
            {cacheStatus && (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-300">Cache Status:</span>
                  <span className={`font-medium ${cacheStatus.cacheEntries > 0 ? 'text-green-600' : 'text-yellow-600'}`}>
                    {cacheStatus.cacheEntries} entries
                  </span>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-300">Static Cache:</span>
                  <span className={`font-medium ${cacheStatus.staticCache ? 'text-green-600' : 'text-red-600'}`}>
                    {cacheStatus.staticCache ? 'Ready' : 'Missing'}
                  </span>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-300">Dynamic Cache:</span>
                  <span className={`font-medium ${cacheStatus.dynamicCache ? 'text-green-600' : 'text-red-600'}`}>
                    {cacheStatus.dynamicCache ? 'Ready' : 'Missing'}
                  </span>
                </div>
              </>
            )}

            {/* Learner Status */}
            {learnerStatus && (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-300">Offline Data:</span>
                  <span className={`font-medium ${learnerStatus.hasOfflineData ? 'text-green-600' : 'text-red-600'}`}>
                    {learnerStatus.hasOfflineData ? 'Available' : 'Not Available'}
                  </span>
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
              </>
            )}

            {/* Actions */}
            <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-blue-500 text-white py-2 px-3 rounded text-sm hover:bg-blue-600 transition-colors"
              >
                Refresh Page
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OfflineStatus; 