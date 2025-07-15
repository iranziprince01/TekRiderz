import React from 'react';
import { useAuth } from '../../contexts/AuthContext';

const OfflineLoginIndicator: React.FC = () => {
  const { token, user } = useAuth();
  
  // Check if user is logged in with offline credentials
  const isOfflineLogin = token === 'offline_token' && 
                        localStorage.getItem('isOfflineMode') === 'true' &&
                        localStorage.getItem('offlineSessionId') &&
                        user;

  if (!isOfflineLogin) {
    return null;
  }

  return (
    <div className="bg-orange-100 border-l-4 border-orange-500 p-3 mb-4 rounded-r-md">
      <div className="flex items-center">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-orange-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3">
          <p className="text-sm text-orange-700 font-medium">
            🔌 Offline Mode: You're logged in with cached credentials
          </p>
          <p className="text-xs text-orange-600 mt-1">
            Connect to the internet to sync your latest data and access all features.
          </p>
        </div>
      </div>
    </div>
  );
};

export default OfflineLoginIndicator; 