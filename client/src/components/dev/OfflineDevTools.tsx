// Development tools for testing offline functionality

import React, { useState, useEffect } from 'react';
import { 
  Wifi, 
  WifiOff, 
  Database, 
  Monitor, 
  RefreshCw, 
  Trash2, 
  Settings, 
  Bug,
  ChevronDown,
  ChevronUp,
  Play,
  Pause,
  RotateCcw
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { useSyncQueue, usePendingCounts } from '../../hooks/useSyncQueue';
import { useOffline } from '../../hooks/useOffline';
import { offlineStorage } from '../../utils/offlineStorage';
import { secureStorage } from '../../utils/secureStorage';

interface DevToolsState {
  isVisible: boolean;
  activeTab: 'network' | 'storage' | 'sync' | 'testing';
  networkSimulation: {
    isActive: boolean;
    mode: 'offline' | 'slow' | 'normal';
    latency: number;
    bandwidth: number;
  };
  storageStats: {
    indexedDB: any;
    secureStorage: any;
    localStorage: number;
    cacheAPI: number;
  };
}

export const OfflineDevTools: React.FC = () => {
  const { syncStatus, syncNow, clearFailedActions } = useSyncQueue();
  const pendingCounts = usePendingCounts();
  const { isOnline, getStorageStats } = useOffline();
  
  const [devState, setDevState] = useState<DevToolsState>({
    isVisible: false,
    activeTab: 'network',
    networkSimulation: {
      isActive: false,
      mode: 'normal',
      latency: 0,
      bandwidth: 0
    },
    storageStats: {
      indexedDB: null,
      secureStorage: null,
      localStorage: 0,
      cacheAPI: 0
    }
  });

  // Only show in development
  const isDev = import.meta.env.DEV || localStorage.getItem('dev-tools-enabled') === 'true';
  
  if (!isDev) return null;

  // Update storage stats
  useEffect(() => {
    const updateStats = async () => {
      try {
        const [
          offlineStats,
          secureStats,
          localStorageSize,
          cacheSize
        ] = await Promise.all([
          getStorageStats(),
          secureStorage.getStorageStats(),
          getLocalStorageSize(),
          getCacheAPISize()
        ]);

        setDevState(prev => ({
          ...prev,
          storageStats: {
            indexedDB: offlineStats,
            secureStorage: secureStats,
            localStorage: localStorageSize,
            cacheAPI: cacheSize
          }
        }));
      } catch (error) {
        console.error('Failed to update storage stats:', error);
      }
    };

    if (devState.isVisible) {
      updateStats();
      const interval = setInterval(updateStats, 5000);
      return () => clearInterval(interval);
    }
  }, [devState.isVisible, getStorageStats]);

  // Network simulation
  const simulateNetwork = (mode: 'offline' | 'slow' | 'normal') => {
    setDevState(prev => ({
      ...prev,
      networkSimulation: {
        ...prev.networkSimulation,
        isActive: mode !== 'normal',
        mode
      }
    }));

    if (mode === 'offline') {
      // Simulate offline by intercepting fetch
      mockOfflineMode(true);
    } else if (mode === 'slow') {
      // Simulate slow network
      mockSlowNetwork(true);
    } else {
      // Restore normal network
      mockOfflineMode(false);
      mockSlowNetwork(false);
    }
  };

  // Clear all storage
  const clearAllStorage = async () => {
    if (confirm('This will clear ALL offline data. Are you sure?')) {
      try {
        await offlineStorage.clearAllData();
        await secureStorage.clear();
        localStorage.clear();
        sessionStorage.clear();
        
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map(name => caches.delete(name)));
        }
        
        alert('All storage cleared!');
        window.location.reload();
      } catch (error) {
        console.error('Failed to clear storage:', error);
        alert('Failed to clear storage');
      }
    }
  };

  // Trigger test scenarios
  const triggerTestScenario = async (scenario: string) => {
    switch (scenario) {
      case 'offline_quiz':
        // Simulate taking a quiz offline
        await testOfflineQuiz();
        break;
      case 'sync_conflict':
        // Simulate sync conflict
        await testSyncConflict();
        break;
      case 'storage_full':
        // Simulate storage quota exceeded
        await testStorageFull();
        break;
      case 'network_intermittent':
        // Simulate intermittent connectivity
        await testIntermittentNetwork();
        break;
    }
  };

  if (!devState.isVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={() => setDevState(prev => ({ ...prev, isVisible: true }))}
          className="bg-purple-600 hover:bg-purple-700 text-white shadow-lg"
          size="sm"
        >
          <Bug className="h-4 w-4 mr-2" />
          Dev Tools
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md">
      <Card className="bg-gray-900 text-gray-100 shadow-2xl border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center space-x-2">
            <Bug className="h-5 w-5 text-purple-400" />
            <span className="font-semibold">Offline Dev Tools</span>
          </div>
          <Button
            onClick={() => setDevState(prev => ({ ...prev, isVisible: false }))}
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-gray-200"
          >
            ✕
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700">
          {(['network', 'storage', 'sync', 'testing'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setDevState(prev => ({ ...prev, activeTab: tab }))}
              className={`flex-1 px-3 py-2 text-sm font-medium capitalize ${
                devState.activeTab === tab
                  ? 'text-purple-400 border-b-2 border-purple-400'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-4 max-h-96 overflow-y-auto">
          {devState.activeTab === 'network' && (
            <NetworkTab 
              isOnline={isOnline}
              simulation={devState.networkSimulation}
              onSimulate={simulateNetwork}
            />
          )}
          
          {devState.activeTab === 'storage' && (
            <StorageTab 
              stats={devState.storageStats}
              onClearAll={clearAllStorage}
            />
          )}
          
          {devState.activeTab === 'sync' && (
            <SyncTab 
              syncStatus={syncStatus}
              pendingCounts={pendingCounts}
              onSyncNow={syncNow}
              onClearFailed={clearFailedActions}
            />
          )}
          
          {devState.activeTab === 'testing' && (
            <TestingTab onTriggerScenario={triggerTestScenario} />
          )}
        </div>
      </Card>
    </div>
  );
};

// Network Tab Component
const NetworkTab: React.FC<{
  isOnline: boolean;
  simulation: any;
  onSimulate: (mode: 'offline' | 'slow' | 'normal') => void;
}> = ({ isOnline, simulation, onSimulate }) => (
  <div className="space-y-4">
    <div className="flex items-center space-x-2">
      {isOnline ? (
        <Wifi className="h-4 w-4 text-green-400" />
      ) : (
        <WifiOff className="h-4 w-4 text-red-400" />
      )}
      <span className={`text-sm font-medium ${isOnline ? 'text-green-400' : 'text-red-400'}`}>
        {isOnline ? 'Online' : 'Offline'}
      </span>
    </div>

    <div>
      <h4 className="text-sm font-medium mb-2">Network Simulation</h4>
      <div className="space-y-2">
                 <Button
           onClick={() => onSimulate('normal')}
           variant={simulation.mode === 'normal' ? 'primary' : 'outline'}
           size="sm"
           className="w-full justify-start"
         >
           <Wifi className="h-3 w-3 mr-2" />
           Normal Connection
         </Button>
         <Button
           onClick={() => onSimulate('slow')}
           variant={simulation.mode === 'slow' ? 'primary' : 'outline'}
           size="sm"
           className="w-full justify-start"
         >
           <RefreshCw className="h-3 w-3 mr-2" />
           Slow Connection (2G)
         </Button>
         <Button
           onClick={() => onSimulate('offline')}
           variant={simulation.mode === 'offline' ? 'primary' : 'outline'}
           size="sm"
           className="w-full justify-start"
         >
          <WifiOff className="h-3 w-3 mr-2" />
          Force Offline
        </Button>
      </div>
    </div>

    {simulation.isActive && (
      <div className="text-xs text-yellow-400 bg-yellow-400/10 p-2 rounded">
        Network simulation active: {simulation.mode}
      </div>
    )}
  </div>
);

// Storage Tab Component
const StorageTab: React.FC<{
  stats: any;
  onClearAll: () => void;
}> = ({ stats, onClearAll }) => (
  <div className="space-y-4">
    <h4 className="text-sm font-medium">Storage Usage</h4>
    
    {/* IndexedDB Stats */}
    <div className="space-y-2">
      <div className="text-xs text-gray-400">IndexedDB (Offline Storage)</div>
      {stats.indexedDB && (
        <div className="text-xs space-y-1">
          <div>Courses: {stats.indexedDB.courses}</div>
          <div>Modules: {stats.indexedDB.modules}</div>
          <div>Progress: {stats.indexedDB.progress}</div>
          <div>Quiz Attempts: {stats.indexedDB.quizAttempts}</div>
          <div>Sync Queue: {stats.indexedDB.syncQueue}</div>
          <div>Total Size: {formatBytes(stats.indexedDB.totalSize)}</div>
        </div>
      )}
    </div>

    {/* Secure Storage Stats */}
    <div className="space-y-2">
      <div className="text-xs text-gray-400">Secure Storage</div>
      {stats.secureStorage && (
        <div className="text-xs space-y-1">
          <div>Total Items: {stats.secureStorage.totalItems}</div>
          <div>Types: {Object.entries(stats.secureStorage.itemsByType).map(([type, count]) => (
            <span key={type} className="mr-2">{type}: {count as number}</span>
          ))}</div>
        </div>
      )}
    </div>

    {/* LocalStorage Stats */}
    <div className="space-y-2">
      <div className="text-xs text-gray-400">LocalStorage</div>
      <div className="text-xs">Size: {formatBytes(stats.localStorage)}</div>
    </div>

         <Button
       onClick={onClearAll}
       variant="secondary"
       size="sm"
       className="w-full bg-red-600 hover:bg-red-700 text-white"
     >
      <Trash2 className="h-3 w-3 mr-2" />
      Clear All Storage
    </Button>
  </div>
);

// Sync Tab Component
const SyncTab: React.FC<{
  syncStatus: any;
  pendingCounts: any;
  onSyncNow: () => Promise<any>;
  onClearFailed: () => Promise<void>;
}> = ({ syncStatus, pendingCounts, onSyncNow, onClearFailed }) => (
  <div className="space-y-4">
    <div>
      <h4 className="text-sm font-medium mb-2">Sync Status</h4>
      <div className="text-xs space-y-1">
        <div>Active: {syncStatus.isActive ? 'Yes' : 'No'}</div>
        <div>Pending: {syncStatus.totalPending}</div>
        <div>Failed: {syncStatus.failedActions}</div>
        <div>Last Sync: {syncStatus.lastSyncAt ? new Date(syncStatus.lastSyncAt).toLocaleTimeString() : 'Never'}</div>
      </div>
    </div>

    <div>
      <h4 className="text-sm font-medium mb-2">Pending by Type</h4>
      <div className="text-xs space-y-1">
        <div>Quiz Attempts: {pendingCounts.quizAttempts}</div>
        <div>Module Completions: {pendingCounts.moduleCompletions}</div>
        <div>Progress Updates: {pendingCounts.progressUpdates}</div>
        <div>User Data: {pendingCounts.userDataUpdates}</div>
      </div>
    </div>

    <div className="space-y-2">
      <Button
        onClick={onSyncNow}
        size="sm"
        className="w-full"
        disabled={syncStatus.isActive}
      >
        <RefreshCw className={`h-3 w-3 mr-2 ${syncStatus.isActive ? 'animate-spin' : ''}`} />
        Force Sync Now
      </Button>
      
      {syncStatus.failedActions > 0 && (
        <Button
          onClick={onClearFailed}
          variant="outline"
          size="sm"
          className="w-full"
        >
          <Trash2 className="h-3 w-3 mr-2" />
          Clear Failed Actions
        </Button>
      )}
    </div>
  </div>
);

// Testing Tab Component
const TestingTab: React.FC<{
  onTriggerScenario: (scenario: string) => void;
}> = ({ onTriggerScenario }) => (
  <div className="space-y-4">
    <h4 className="text-sm font-medium">Test Scenarios</h4>
    
    <div className="space-y-2">
      <Button
        onClick={() => onTriggerScenario('offline_quiz')}
        variant="outline"
        size="sm"
        className="w-full justify-start"
      >
        <Play className="h-3 w-3 mr-2" />
        Test Offline Quiz
      </Button>
      
      <Button
        onClick={() => onTriggerScenario('sync_conflict')}
        variant="outline"
        size="sm"
        className="w-full justify-start"
      >
        <RefreshCw className="h-3 w-3 mr-2" />
        Test Sync Conflict
      </Button>
      
      <Button
        onClick={() => onTriggerScenario('storage_full')}
        variant="outline"
        size="sm"
        className="w-full justify-start"
      >
        <Database className="h-3 w-3 mr-2" />
        Test Storage Full
      </Button>
      
      <Button
        onClick={() => onTriggerScenario('network_intermittent')}
        variant="outline"
        size="sm"
        className="w-full justify-start"
      >
        <WifiOff className="h-3 w-3 mr-2" />
        Test Intermittent Network
      </Button>
    </div>

    <div className="text-xs text-gray-400 mt-4">
      These scenarios simulate real-world offline conditions for testing purposes.
    </div>
  </div>
);

// Helper functions

function mockOfflineMode(enable: boolean) {
  if (enable) {
    // Override fetch to simulate offline
    const originalFetch = window.fetch;
    window.fetch = () => Promise.reject(new Error('Network offline (simulated)'));
    (window as any).__originalFetch = originalFetch;
  } else {
    // Restore original fetch
    if ((window as any).__originalFetch) {
      window.fetch = (window as any).__originalFetch;
      delete (window as any).__originalFetch;
    }
  }
}

function mockSlowNetwork(enable: boolean) {
  if (enable) {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      // Add 2-5 second delay
      await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));
      return originalFetch(...args);
    };
    (window as any).__originalSlowFetch = originalFetch;
  } else {
    if ((window as any).__originalSlowFetch) {
      window.fetch = (window as any).__originalSlowFetch;
      delete (window as any).__originalSlowFetch;
    }
  }
}

async function getLocalStorageSize(): Promise<number> {
  let total = 0;
  for (const key in localStorage) {
    if (localStorage.hasOwnProperty(key)) {
      total += localStorage[key].length + key.length;
    }
  }
  return total;
}

async function getCacheAPISize(): Promise<number> {
  if (!('caches' in window)) return 0;
  
  try {
    const cacheNames = await caches.keys();
    let total = 0;
    
    for (const name of cacheNames) {
      const cache = await caches.open(name);
      const requests = await cache.keys();
      total += requests.length;
    }
    
    return total;
  } catch (error) {
    return 0;
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Test scenario implementations
async function testOfflineQuiz(): Promise<void> {
  console.log('🧪 Testing offline quiz scenario...');
  // Implementation would simulate taking a quiz while offline
}

async function testSyncConflict(): Promise<void> {
  console.log('🧪 Testing sync conflict scenario...');
  // Implementation would create conflicting data to test resolution
}

async function testStorageFull(): Promise<void> {
  console.log('🧪 Testing storage full scenario...');
  // Implementation would fill storage to test quota handling
}

async function testIntermittentNetwork(): Promise<void> {
  console.log('🧪 Testing intermittent network scenario...');
  // Implementation would simulate on/off network connectivity
} 