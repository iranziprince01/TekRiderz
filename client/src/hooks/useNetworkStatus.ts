import { useState, useEffect, useCallback, useRef } from 'react';

interface NetworkStatus {
  isOnline: boolean;
  connectionType: string;
  effectiveType: string;
  downlink: number;
  rtt: number;
  saveData: boolean;
  isSlowConnection: boolean;
  lastOnline: number | null;
  lastOffline: number | null;
  connectionStable: boolean;
}

interface NetworkEventHandlers {
  onOnline?: () => void;
  onOffline?: () => void;
  onConnectionChange?: (status: NetworkStatus) => void;
}

export const useNetworkStatus = (handlers?: NetworkEventHandlers) => {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    connectionType: 'unknown',
    effectiveType: 'unknown',
    downlink: 0,
    rtt: 0,
    saveData: false,
    isSlowConnection: false,
    lastOnline: typeof navigator !== 'undefined' && navigator.onLine ? Date.now() : null,
    lastOffline: typeof navigator !== 'undefined' && !navigator.onLine ? Date.now() : null,
    connectionStable: true
  });

  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const stabilityCheckRef = useRef<number | null>(null);
  const pingIntervalRef = useRef<number | null>(null);
  const lastStatusRef = useRef(typeof navigator !== 'undefined' ? navigator.onLine : true);

  // Get detailed connection information
  const getConnectionInfo = useCallback((): Partial<NetworkStatus> => {
    const connection = (navigator as any).connection || 
                      (navigator as any).mozConnection || 
                      (navigator as any).webkitConnection;

    if (connection) {
      return {
        connectionType: connection.type || 'unknown',
        effectiveType: connection.effectiveType || 'unknown',
        downlink: connection.downlink || 0,
        rtt: connection.rtt || 0,
        saveData: connection.saveData || false,
        isSlowConnection: connection.effectiveType === 'slow-2g' || 
                         connection.effectiveType === '2g' ||
                         (connection.downlink && connection.downlink < 1)
      };
    }

    return {
      connectionType: 'unknown',
      effectiveType: 'unknown',
      downlink: 0,
      rtt: 0,
      saveData: false,
      isSlowConnection: false
    };
  }, []);

  // Test actual connectivity by making a ping request
  const testConnectivity = useCallback(async (): Promise<boolean> => {
    if (!navigator.onLine) return false;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch('/api/health', {
        method: 'HEAD',
        cache: 'no-cache',
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      return false;
    }
  }, []);

  // Update network status
  const updateNetworkStatus = useCallback(async (isOnline: boolean, skipConnectivityTest = false) => {
    const connectionInfo = getConnectionInfo();
    const now = Date.now();

    // Test actual connectivity if we think we're online
    let actuallyOnline = isOnline;
    if (isOnline && !skipConnectivityTest) {
      setIsConnecting(true);
      actuallyOnline = await testConnectivity();
      setIsConnecting(false);

      if (!actuallyOnline) {
        setConnectionAttempts(prev => prev + 1);
      } else {
        setConnectionAttempts(0);
      }
    }

    const newStatus: NetworkStatus = {
      isOnline: actuallyOnline,
      connectionType: connectionInfo.connectionType || 'unknown',
      effectiveType: connectionInfo.effectiveType || 'unknown',
      downlink: connectionInfo.downlink || 0,
      rtt: connectionInfo.rtt || 0,
      saveData: connectionInfo.saveData || false,
      isSlowConnection: connectionInfo.isSlowConnection || false,
      lastOnline: actuallyOnline ? now : networkStatus.lastOnline,
      lastOffline: !actuallyOnline ? now : networkStatus.lastOffline,
      connectionStable: true // Will be updated by stability check
    };

    setNetworkStatus(newStatus);

    // Call handlers
    if (actuallyOnline !== lastStatusRef.current) {
      if (actuallyOnline && handlers?.onOnline) {
        handlers.onOnline();
      } else if (!actuallyOnline && handlers?.onOffline) {
        handlers.onOffline();
      }
      lastStatusRef.current = actuallyOnline;
    }

    if (handlers?.onConnectionChange) {
      handlers.onConnectionChange(newStatus);
    }

    return newStatus;
  }, [networkStatus.lastOnline, networkStatus.lastOffline, getConnectionInfo, testConnectivity, handlers]);

  // Check connection stability
  const checkStability = useCallback(() => {
    let statusChanges = 0;
    const checkInterval = 1000; // 1 second
    const totalChecks = 10; // Check for 10 seconds
    let checksCompleted = 0;

    const stabilityInterval = setInterval(() => {
      const currentOnline = navigator.onLine;
      if (currentOnline !== lastStatusRef.current) {
        statusChanges++;
        lastStatusRef.current = currentOnline;
      }

      checksCompleted++;
      if (checksCompleted >= totalChecks) {
        clearInterval(stabilityInterval);
        
        const isStable = statusChanges <= 2; // Allow up to 2 changes in 10 seconds
        setNetworkStatus(prev => ({
          ...prev,
          connectionStable: isStable
        }));
      }
    }, checkInterval);

    return () => clearInterval(stabilityInterval);
  }, []);

  // Handle online event
  const handleOnline = useCallback(() => {
    updateNetworkStatus(true);
    
    // Check stability after going online
    if (stabilityCheckRef.current) {
      clearTimeout(stabilityCheckRef.current);
    }
    stabilityCheckRef.current = setTimeout(checkStability, 2000);
  }, [updateNetworkStatus, checkStability]);

  // Handle offline event
  const handleOffline = useCallback(() => {
    updateNetworkStatus(false, true); // Skip connectivity test when offline
  }, [updateNetworkStatus]);

  // Handle connection change (mobile/wifi switch, etc.)
  const handleConnectionChange = useCallback(() => {
    // Wait a bit for the connection to stabilize
    setTimeout(() => {
      updateNetworkStatus(navigator.onLine);
    }, 1000);
  }, [updateNetworkStatus]);

  // Periodic ping to verify connection
  const startPeriodicPing = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }

    pingIntervalRef.current = setInterval(async () => {
      if (navigator.onLine) {
        const actuallyOnline = await testConnectivity();
        if (!actuallyOnline && networkStatus.isOnline) {
          updateNetworkStatus(false, true);
        }
      }
    }, 30000); // Check every 30 seconds
  }, [testConnectivity, networkStatus.isOnline, updateNetworkStatus]);

  // Manual retry connection
  const retryConnection = useCallback(async (): Promise<boolean> => {
    setIsConnecting(true);
    const isConnected = await testConnectivity();
    setIsConnecting(false);

    if (isConnected) {
      await updateNetworkStatus(true);
      setConnectionAttempts(0);
    } else {
      setConnectionAttempts(prev => prev + 1);
    }

    return isConnected;
  }, [testConnectivity, updateNetworkStatus]);

  // Get human readable connection description
  const getConnectionDescription = useCallback((): string => {
    if (!networkStatus.isOnline) {
      return 'No internet connection';
    }

    if (isConnecting) {
      return 'Connecting...';
    }

    if (!networkStatus.connectionStable) {
      return 'Unstable connection';
    }

    if (networkStatus.isSlowConnection) {
      return 'Slow connection';
    }

    switch (networkStatus.effectiveType) {
      case 'slow-2g':
        return 'Very slow connection';
      case '2g':
        return 'Slow connection';
      case '3g':
        return 'Moderate connection';
      case '4g':
        return 'Fast connection';
      default:
        return networkStatus.connectionType === 'wifi' ? 'WiFi connection' : 'Mobile connection';
    }
  }, [networkStatus, isConnecting]);

  // Setup event listeners
  useEffect(() => {
    // Initial status update
    updateNetworkStatus(navigator.onLine);

    // Add event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listen for connection changes (mobile only)
    const connection = (navigator as any).connection || 
                      (navigator as any).mozConnection || 
                      (navigator as any).webkitConnection;
    
    if (connection) {
      connection.addEventListener('change', handleConnectionChange);
    }

    // Start periodic ping
    startPeriodicPing();

    // Cleanup
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      
      if (connection) {
        connection.removeEventListener('change', handleConnectionChange);
      }

      if (stabilityCheckRef.current) {
        clearTimeout(stabilityCheckRef.current);
      }

      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
    };
  }, [handleOnline, handleOffline, handleConnectionChange, startPeriodicPing, updateNetworkStatus]);

  // Return network status and utilities
  return {
    ...networkStatus,
    isConnecting,
    connectionAttempts,
    retryConnection,
    testConnectivity,
    getConnectionDescription,
    // Computed properties
    isGoodConnection: networkStatus.isOnline && !networkStatus.isSlowConnection && networkStatus.connectionStable,
    shouldShowOfflineUI: !networkStatus.isOnline || isConnecting,
    canUseHeavyFeatures: networkStatus.isOnline && !networkStatus.isSlowConnection && !networkStatus.saveData
  };
};

export default useNetworkStatus; 