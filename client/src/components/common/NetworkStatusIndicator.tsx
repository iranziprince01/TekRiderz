import React from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';

const NetworkStatusIndicator: React.FC = () => {
  const { isOnline } = useNetworkStatus();

  return (
    <div className="flex items-center" title={isOnline ? "Online" : "Offline"}>
      {isOnline ? (
        <Wifi className="w-4 h-4 text-green-500" />
      ) : (
        <WifiOff className="w-4 h-4 text-red-500" />
      )}
    </div>
  );
};

export default NetworkStatusIndicator; 