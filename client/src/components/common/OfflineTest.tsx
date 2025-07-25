import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { getEssentialOfflineStatus } from '../../offline/offlineEssentials';

const OfflineTest: React.FC = () => {
  const [status, setStatus] = useState(getEssentialOfflineStatus());
  const [isVisible, setIsVisible] = useState(false);

  const refreshStatus = () => {
    setStatus(getEssentialOfflineStatus());
  };

  const toggleVisibility = () => {
    setIsVisible(!isVisible);
  };

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 left-4 z-40">
        <Button
          onClick={toggleVisibility}
          size="sm"
          variant="outline"
          className="bg-white dark:bg-gray-800 shadow-lg"
        >
          Test Offline
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 z-40 w-80">
      <Card className="p-4 shadow-lg border-2 border-blue-200 dark:border-blue-800">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900 dark:text-white">Offline Test Panel</h3>
          <Button
            onClick={toggleVisibility}
            size="sm"
            variant="ghost"
            className="text-gray-500 hover:text-gray-700"
          >
            ×
          </Button>
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Network Status:</span>
            <span className={`font-medium ${status.isOffline ? 'text-red-600' : 'text-green-600'}`}>
              {status.isOffline ? 'Offline' : 'Online'}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Local Data:</span>
            <span className={`font-medium ${status.hasLocalData ? 'text-green-600' : 'text-red-600'}`}>
              {status.hasLocalData ? 'Available' : 'Not Available'}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Course Access:</span>
            <span className={`font-medium ${status.canAccessCourses ? 'text-green-600' : 'text-yellow-600'}`}>
              {status.canAccessCourses ? 'Ready' : 'Limited'}
            </span>
          </div>

          {status.cachedUser && (
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Cached User:</span>
              <span className="font-medium text-blue-600">
                {status.cachedUser.name}
              </span>
            </div>
          )}

          {status.lastSync && (
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Last Sync:</span>
              <span className="font-medium text-gray-800 dark:text-gray-200">
                {status.lastSync}
              </span>
            </div>
          )}

          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              Offline Access:
            </div>
            <div className="text-xs bg-gray-50 dark:bg-gray-700 p-2 rounded">
              <div>Login with cached credentials</div>
              <div>Access enrolled courses offline</div>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              onClick={refreshStatus}
              size="sm"
              variant="outline"
              className="flex-1"
            >
              Refresh
            </Button>
            <Button
              onClick={() => {
                localStorage.clear();
                refreshStatus();
              }}
              size="sm"
              variant="outline"
              className="flex-1 text-red-600 hover:text-red-700"
            >
              Clear Data
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default OfflineTest; 