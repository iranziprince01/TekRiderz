import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';

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
  isConnecting: boolean;
  connectionAttempts: number;
}

interface NetworkStatusContextType extends NetworkStatus {
  retryConnection: () => Promise<boolean>;
  testConnectivity: () => Promise<boolean>;
  getConnectionDescription: () => string;
  isGoodConnection: boolean;
  shouldShowOfflineUI: boolean;
  canUseHeavyFeatures: boolean;
}

const NetworkStatusContext = createContext<NetworkStatusContextType | undefined>(undefined);

// Global ping interval - only one instance for the entire app
let globalPingInterval: ReturnType<typeof setInterval> | null = null;

export const NetworkStatusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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
    connectionStable: true,
    isConnecting: false,
    connectionAttempts: 0
  });

  const stabilityCheckRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

      const response = await fetch('/api/v1/health', {
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
      setNetworkStatus(prev => ({ ...prev, isConnecting: true }));
      actuallyOnline = await testConnectivity();
      setNetworkStatus(prev => ({ 
        ...prev, 
        isConnecting: false,
        connectionAttempts: actuallyOnline ? 0 : prev.connectionAttempts + 1
      }));
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
      connectionStable: true,
      isConnecting: false,
      connectionAttempts: actuallyOnline ? 0 : networkStatus.connectionAttempts
    };

    setNetworkStatus(newStatus);
    lastStatusRef.current = actuallyOnline;

    return newStatus;
  }, [networkStatus.lastOnline, networkStatus.lastOffline, networkStatus.connectionAttempts, getConnectionInfo, testConnectivity]);

  // Check connection stability
  const checkStability = useCallback(() => {
    let statusChanges = 0;
    const checkInterval = 1000;
    const totalChecks = 10;
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
        
        const isStable = statusChanges <= 2;
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
    updateNetworkStatus(false, true);
  }, [updateNetworkStatus]);

  // Handle connection change
  const handleConnectionChange = useCallback(() => {
    setTimeout(() => {
      updateNetworkStatus(navigator.onLine);
    }, 1000);
  }, [updateNetworkStatus]);

  // Manual retry connection
  const retryConnection = useCallback(async (): Promise<boolean> => {
    setNetworkStatus(prev => ({ ...prev, isConnecting: true }));
    const isConnected = await testConnectivity();
    
    setNetworkStatus(prev => ({
      ...prev,
      isConnecting: false,
      connectionAttempts: isConnected ? 0 : prev.connectionAttempts + 1
    }));

    if (isConnected) {
      await updateNetworkStatus(true);
    }

    return isConnected;
  }, [testConnectivity, updateNetworkStatus]);

  // Get human readable connection description
  const getConnectionDescription = useCallback((): string => {
    if (!networkStatus.isOnline) {
      return 'No internet connection';
    }

    if (networkStatus.isConnecting) {
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
  }, [networkStatus]);

  // Setup event listeners and global ping (only once for the entire app)
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

    // Start the global ping interval only if it's not already running
    if (!globalPingInterval) {
      globalPingInterval = setInterval(async () => {
        if (navigator.onLine) {
          const actuallyOnline = await testConnectivity();
          if (!actuallyOnline && networkStatus.isOnline) {
            updateNetworkStatus(false, true);
          }
        }
      }, 300000); // Check every 5 minutes (reduced frequency)

      // Only log in development and less frequently
      if (import.meta.env.DEV) {
        console.log('🌐 Network monitoring active');
      }
    }

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

      // Only clear the global interval when the provider unmounts
      if (globalPingInterval) {
        clearInterval(globalPingInterval);
        globalPingInterval = null;
        
        if (import.meta.env.DEV) {
          console.log('🌐 Global network monitoring stopped');
        }
      }
    };
  }, [handleOnline, handleOffline, handleConnectionChange, updateNetworkStatus, testConnectivity, networkStatus.isOnline]);

  const contextValue: NetworkStatusContextType = {
    ...networkStatus,
    retryConnection,
    testConnectivity,
    getConnectionDescription,
    isGoodConnection: networkStatus.isOnline && !networkStatus.isSlowConnection && networkStatus.connectionStable,
    shouldShowOfflineUI: !networkStatus.isOnline || networkStatus.isConnecting,
    canUseHeavyFeatures: networkStatus.isOnline && !networkStatus.isSlowConnection && !networkStatus.saveData
  };

  return (
    <NetworkStatusContext.Provider value={contextValue}>
      {children}
    </NetworkStatusContext.Provider>
  );
};

export const useNetworkStatus = () => {
  const context = useContext(NetworkStatusContext);
  if (context === undefined) {
    throw new Error('useNetworkStatus must be used within a NetworkStatusProvider');
  }
  return context;
};

export default NetworkStatusProvider; 