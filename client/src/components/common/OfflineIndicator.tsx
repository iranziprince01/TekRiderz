import React from 'react';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';

/**
 * Simple network status indicator
 * Shows basic online/offline status without verbose technical details
 */
const OfflineIndicator: React.FC = () => {
  const { isOnline } = useNetworkStatus();

  // Only show indicator when offline to avoid visual clutter
  if (isOnline) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50">
      <div className="bg-amber-500 text-white px-3 py-2 rounded-lg shadow-lg text-sm flex items-center gap-2">
        <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
        Working offline
      </div>
    </div>
  );
};

export default OfflineIndicator;