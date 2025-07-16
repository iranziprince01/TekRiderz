import { useEffect, useRef } from 'react';
import { useNetworkStatus as useNetworkStatusContext } from '../contexts/NetworkStatusContext';

interface NetworkEventHandlers {
  onOnline?: () => void;
  onOffline?: () => void;
  onConnectionChange?: (status: any) => void;
}

// This hook now uses the global NetworkStatusContext to prevent multiple instances
// The complex network monitoring logic has been moved to NetworkStatusContext
export const useNetworkStatus = (handlers?: NetworkEventHandlers) => {
  const networkStatus = useNetworkStatusContext();
  const lastOnlineRef = useRef(networkStatus.isOnline);

  // Handle event callbacks when status changes
  useEffect(() => {
    if (handlers) {
      const wasOnline = lastOnlineRef.current;
      const isOnline = networkStatus.isOnline;

      if (wasOnline !== isOnline) {
        if (isOnline && handlers.onOnline) {
          handlers.onOnline();
        } else if (!isOnline && handlers.onOffline) {
          handlers.onOffline();
        }
        
        if (handlers.onConnectionChange) {
          handlers.onConnectionChange(networkStatus);
        }
        
        lastOnlineRef.current = isOnline;
      }
    }
  }, [networkStatus.isOnline, handlers]);

  return networkStatus;
};

export default useNetworkStatus; 