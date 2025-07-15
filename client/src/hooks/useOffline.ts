/**
 * Simple offline hook
 * Provides basic offline status and minimal functionality
 */

import { useState, useEffect } from 'react';
import { useNetworkStatus } from './useNetworkStatus';
import { essentialDataCache } from '../utils/offlineDataCache';
import { offlineOperations } from '../utils/offlineOperations';

interface OfflineState {
  isOnline: boolean;
  hasOfflineData: boolean;
  pendingOperations: number;
}

export const useOffline = () => {
  const { isOnline } = useNetworkStatus();
  const [state, setState] = useState<OfflineState>({
    isOnline,
    hasOfflineData: false,
    pendingOperations: 0
  });

  useEffect(() => {
    setState(prev => ({
      ...prev,
      isOnline
    }));
  }, [isOnline]);

  // Check for offline data
  const hasOfflineData = (userId: string): boolean => {
    return essentialDataCache.hasEssentialData(userId);
  };

  // Get pending operations count
  const getPendingOperationsCount = (userId?: string): number => {
    return offlineOperations.getPendingCount(userId);
  };

  // Simple cache management
  const clearOfflineData = (userId: string): void => {
    essentialDataCache.clearUserCache(userId);
    offlineOperations.clearUserOperations(userId);
  };

  return {
    isOnline: state.isOnline,
    hasOfflineData,
    getPendingOperationsCount,
    clearOfflineData,
    pendingOperations: state.pendingOperations
  };
};