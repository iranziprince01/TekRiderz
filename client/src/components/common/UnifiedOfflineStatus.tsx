import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { getLearnerOfflineStatus } from '../../offline/cacheService';
import { getEssentialOfflineStatus } from '../../offline/offlineEssentials';
import { Wifi, WifiOff, CheckCircle, AlertTriangle } from 'lucide-react';

interface UnifiedOfflineStatusProps {
  showForLearnersOnly?: boolean;
}

const UnifiedOfflineStatus: React.FC<UnifiedOfflineStatusProps> = ({ 
  showForLearnersOnly = true 
}) => {
  const { isOfflineMode, user } = useAuth();
  const { language } = useLanguage();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [learnerStatus, setLearnerStatus] = useState<any>(null);
  const [essentialStatus, setEssentialStatus] = useState<any>(null);

  // Check if we should render the component
  const shouldRender = !showForLearnersOnly || user?.role === 'learner';
  const shouldShow = shouldRender && (isOfflineMode || !isOnline);

  useEffect(() => {
    if (!shouldRender) return;

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

    const updateStatus = async () => {
      await Promise.all([
        checkLearnerStatus(),
        checkEssentialStatus()
      ]);
    };

    updateStatus();
    const interval = setInterval(updateStatus, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [user?.role, shouldRender]);

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

  // Determine status and message
  const getStatusInfo = () => {
    if (!isOnline) {
      return {
        icon: <WifiOff className="w-4 h-4" />,
        message: language === 'rw' ? 'Ntibashobora kwinjira - Offline Mode' : 'Offline Mode - Limited Access',
        color: 'text-yellow-800 dark:text-yellow-200',
        bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
        borderColor: 'border-yellow-200 dark:border-yellow-800'
      };
    }
    
    if (isOfflineMode && isOnline) {
      return {
        icon: <Wifi className="w-4 h-4" />,
        message: language === 'rw' ? 'Online - Offline Mode Active' : 'Online - Offline Mode Active',
        color: 'text-blue-800 dark:text-blue-200',
        bgColor: 'bg-blue-50 dark:bg-blue-900/20',
        borderColor: 'border-blue-200 dark:border-blue-800'
      };
    }

    return null;
  };

  // Early return after all hooks are called
  if (!shouldShow) {
    return null;
  }

  const statusInfo = getStatusInfo();
  if (!statusInfo) return null;

  return (
    <div className={`fixed top-4 right-4 z-50 max-w-sm transition-all duration-300`}>
      <div className={`p-3 rounded-lg shadow-lg border ${statusInfo.bgColor} ${statusInfo.borderColor}`}>
        <div className="flex items-center justify-between space-x-2">
          <div className="flex items-center space-x-2">
            {statusInfo.icon}
            <span className={`text-sm font-medium ${statusInfo.color}`}>
              {statusInfo.message}
            </span>
          </div>
          
          {/* Status indicators */}
          <div className="flex items-center space-x-1">
            {learnerStatus?.hasOfflineData && (
              <CheckCircle className="w-3 h-3 text-green-500" />
            )}
            {essentialStatus?.hasLocalData && (
              <CheckCircle className="w-3 h-3 text-green-500" />
            )}
            {(!learnerStatus?.hasOfflineData || !essentialStatus?.hasLocalData) && (
              <AlertTriangle className="w-3 h-3 text-yellow-500" />
            )}
          </div>
        </div>
        
        {/* Additional info for offline mode */}
        {!isOnline && learnerStatus?.hasOfflineData && (
          <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
            {language === 'rw' ? 'Koresha amakuru y\'inyongera' : 'Using cached data'}
          </p>
        )}
      </div>
    </div>
  );
};

export default UnifiedOfflineStatus; 