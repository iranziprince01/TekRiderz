// Enhanced offline development tools for TekRiders
// Provides debugging and monitoring capabilities for offline functionality

import React, { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { 
  Download, 
  Trash2, 
  RefreshCw, 
  Database, 
  Wifi, 
  WifiOff,
  AlertCircle,
  CheckCircle,
  Clock,
  HardDrive
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useOffline } from '../../hooks/useOffline';
import { useSyncQueue } from '../../hooks/useSyncQueue';
import { offlineStorage } from '../../utils/offlineStorage';
import { essentialDataCache } from '../../utils/offlineDataCache';

const OfflineDevTools: React.FC = () => {
  const { user } = useAuth();
  const { isOnline, hasOfflineData, clearOfflineData } = useOffline();
  const { syncStatus, syncNow, clearFailedActions, pendingCount } = useSyncQueue();
  const [isClearing, setIsClearing] = useState(false);
  const [lastAction, setLastAction] = useState<string>('');

  // Simple pending counts
  const [pendingCounts, setPendingCounts] = useState({
    quizAttempts: 0,
    progressUpdates: 0,
    total: 0
  });

  // Update pending counts
  useEffect(() => {
    const updateCounts = async () => {
      if (!user?.id) return;

      try {
        const queuedActions = await offlineStorage.getQueuedActions();
        const newCounts = {
          quizAttempts: queuedActions.filter(a => a.type === 'quiz_submission').length,
          progressUpdates: queuedActions.filter(a => a.type === 'video_progress').length,
          total: queuedActions.length
        };
        setPendingCounts(newCounts);
      } catch (error) {
        console.error('Failed to get pending counts:', error);
      }
    };

    updateCounts();
    const interval = setInterval(updateCounts, 10000);
    return () => clearInterval(interval);
  }, [user?.id]);

  const handleSync = async () => {
    try {
      setLastAction('Syncing...');
      const result = await syncNow();
      setLastAction(`Synced: ${result.synced} items, ${result.failed} failed`);
    } catch (error) {
      setLastAction(`Sync failed: ${error}`);
    }
  };

  const handleClearCache = async () => {
    if (!user?.id) return;
    
    setIsClearing(true);
    try {
      clearOfflineData(user.id);
      await clearFailedActions();
      setLastAction('Cache cleared successfully');
    } catch (error) {
      setLastAction(`Clear failed: ${error}`);
    } finally {
      setIsClearing(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <Card className="p-6 bg-gray-50 border-dashed">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Database className="w-5 h-5" />
        Offline Development Tools
      </h3>

      {/* Connection Status */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          {isOnline ? (
            <Wifi className="w-4 h-4 text-green-500" />
          ) : (
            <WifiOff className="w-4 h-4 text-red-500" />
          )}
          <span className="font-medium">
            Status: {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-blue-500" />
          <span>
            Offline Data: {hasOfflineData(user.id) ? 'Available' : 'None'}
          </span>
        </div>
      </div>

      {/* Sync Status */}
      <div className="mb-4 p-3 bg-white rounded border">
        <h4 className="font-medium mb-2">Sync Status</h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
                     <div>
             <span className="text-gray-600">Pending: </span>
             <Badge variant={pendingCount > 0 ? 'error' : 'default'}>
               {pendingCount}
             </Badge>
           </div>
           <div>
             <span className="text-gray-600">Quiz Attempts: </span>
             <Badge variant="info">{pendingCounts.quizAttempts}</Badge>
           </div>
           <div>
             <span className="text-gray-600">Progress Updates: </span>
             <Badge variant="info">{pendingCounts.progressUpdates}</Badge>
           </div>
          <div>
            <span className="text-gray-600">Last Sync: </span>
            <span className="text-xs">
              {syncStatus.lastSyncAt 
                ? new Date(syncStatus.lastSyncAt).toLocaleTimeString()
                : 'Never'
              }
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <Button
            onClick={handleSync}
            disabled={!isOnline || syncStatus.isActive}
            size="sm"
            className="flex-1"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${syncStatus.isActive ? 'animate-spin' : ''}`} />
            Sync Now
          </Button>
          
          <Button
            onClick={handleClearCache}
            disabled={isClearing}
            variant="outline"
            size="sm"
            className="flex-1"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Clear Cache
          </Button>
        </div>

        {lastAction && (
          <div className="text-xs text-gray-600 p-2 bg-gray-100 rounded">
            Last Action: {lastAction}
          </div>
        )}
      </div>

      {/* Debug Info */}
      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-medium text-gray-700">
          Debug Information
        </summary>
        <div className="mt-2 text-xs text-gray-600 space-y-1">
          <div>User ID: {user.id}</div>
          <div>Sync Active: {syncStatus.isActive ? 'Yes' : 'No'}</div>
          <div>Total Pending: {syncStatus.totalPending}</div>
          <div>Online Status: {isOnline ? 'Connected' : 'Disconnected'}</div>
        </div>
      </details>
    </Card>
  );
};

export default OfflineDevTools; 