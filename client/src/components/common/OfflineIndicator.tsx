import React from 'react';
import { useOffline } from '../../hooks/useOffline';
import { Alert } from '../ui/Alert';
import { Wifi, WifiOff, Clock } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const { isOnline, pendingActions } = useOffline();

  if (isOnline && pendingActions === 0) return null;

  return (
    <div className="fixed top-20 left-4 right-4 z-50 max-w-md mx-auto">
      {!isOnline ? (
        <Alert variant="warning" className="shadow-lg">
          <div className="flex items-center space-x-2">
            <WifiOff className="h-4 w-4" />
            <span className="font-medium">You're offline</span>
          </div>
          <p className="mt-1 text-xs">
            Your progress will be saved and synced when you're back online.
          </p>
        </Alert>
      ) : pendingActions > 0 ? (
        <Alert variant="info" className="shadow-lg">
          <div className="flex items-center space-x-2">
            <Clock className="h-4 w-4" />
            <span className="font-medium">Syncing data...</span>
          </div>
          <p className="mt-1 text-xs">
            {pendingActions} action{pendingActions > 1 ? 's' : ''} pending sync.
          </p>
        </Alert>
      ) : null}
    </div>
  );
};