import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { useNetworkStatus } from './useNetworkStatus';
import { essentialDataCache, EssentialCacheData } from '../utils/offlineDataCache';
import { offlineOperations } from '../utils/offlineOperations';

interface DashboardData {
  user: any;
  stats: any;
  courses: any[];
  enrolledCourses: any[];
  certificates: any[];
  isLoading: boolean;
  error: string | null;
}

interface UseComprehensiveDashboardDataReturn extends DashboardData {
  refreshData: () => Promise<void>;
}

/**
 * Essential dashboard data hook with seamless offline functionality
 * Provides transparent access to data whether online or offline
 */
export const useComprehensiveDashboardData = (): UseComprehensiveDashboardDataReturn => {
  const { user: authUser, isAuthenticated } = useAuth();
  const { isOnline } = useNetworkStatus();
  
  const [data, setData] = useState<DashboardData>({
    user: null,
    stats: null,
    courses: [],
    enrolledCourses: [],
    certificates: [],
    isLoading: true,
    error: null,
  });

  const initializeOnceRef = useRef(false);
  const backgroundSyncRef = useRef<number>();
  const userId = authUser?.id || (authUser as any)?._id;

  /**
   * Load data seamlessly from cache or API
   */
  const loadData = useCallback(async (forceRefresh = false) => {
    if (!isAuthenticated || !userId) {
      return;
    }

    // Don't show loading on refresh to maintain seamless experience
    if (!forceRefresh) {
      setData(prev => ({ ...prev, isLoading: true, error: null }));
    }

    try {
      let hasData = false;

      // First, try to load from cache for instant display
      if (!forceRefresh) {
        const cachedProfile = essentialDataCache.getProfile(userId);
        const cachedCourses = essentialDataCache.getAllCourses();
        const cachedEnrollments = essentialDataCache.getEnrolledCourses(userId);
        const cachedCertificates = essentialDataCache.getCertificates(userId);
        const cachedStats = essentialDataCache.getStats(userId);

        // If we have any cached data, show it immediately
        const hasValidCache = !!(cachedProfile || cachedEnrollments.length > 0);
        
        if (hasValidCache) {
          setData(prev => ({
            ...prev,
            user: cachedProfile || prev.user,
            stats: cachedStats || prev.stats,
            courses: cachedCourses,
            enrolledCourses: cachedEnrollments,
            certificates: cachedCertificates,
            isLoading: false,
            error: null,
          }));
          hasData = true;
        }
      }

      // If online, fetch fresh data in background and update cache silently
      if (isOnline) {
        try {
          const freshData = await essentialDataCache.preloadEssentialData(userId, apiClient);
          
          setData(prev => ({
            ...prev,
            user: freshData.profile || prev.user,
            stats: freshData.stats || prev.stats,
            courses: freshData.allCourses || [],
            enrolledCourses: freshData.enrolledCourses || [],
            certificates: freshData.certificates || [],
            isLoading: false,
            error: null,
          }));
          hasData = true;

          // Sync any pending offline operations in background
          setTimeout(() => {
            offlineOperations.syncPendingOperations(apiClient).catch(error => {
              console.warn('Background sync failed:', error);
            });
          }, 1000);

        } catch (error) {
          // Silent background sync failure - don't disturb user experience
          if (import.meta.env.DEV) {
            console.warn('Background sync failed:', error);
          }
          
          // Only show error if we have no cached data
          if (!hasData) {
            setData(prev => ({
              ...prev,
              isLoading: false,
              error: 'Unable to load data. Please check your connection.',
            }));
          }
        }
      } else if (!hasData) {
        // Offline and no cache - minimal error
        setData(prev => ({
          ...prev,
          isLoading: false,
          error: 'No data available offline.',
        }));
      }

    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      
      setData(prev => ({
        ...prev,
        isLoading: false,
        error: 'Unable to load data.',
      }));
    }
  }, [isAuthenticated, userId, isOnline]);

  /**
   * Manual refresh (same as loadData but can be called by user)
   */
  const refreshData = useCallback(async () => {
    await loadData(true);
  }, [loadData]);

  /**
   * Initialize data loading
   */
  useEffect(() => {
    if (isAuthenticated && userId && !initializeOnceRef.current) {
      initializeOnceRef.current = true;
      loadData(false);
    }
  }, [isAuthenticated, userId, loadData]);

  /**
   * Background sync when coming online
   */
  useEffect(() => {
    if (isOnline && isAuthenticated && userId && initializeOnceRef.current) {
      // Delay to ensure connection is stable
      backgroundSyncRef.current = window.setTimeout(() => {
        // Sync offline operations first, then refresh data
        offlineOperations.syncPendingOperations(apiClient)
          .then(() => loadData(true))
          .catch(error => console.warn('Background sync failed:', error));
      }, 2000);
      
      return () => {
        if (backgroundSyncRef.current) {
          window.clearTimeout(backgroundSyncRef.current);
        }
      };
    }
  }, [isOnline, isAuthenticated, userId, loadData]);

  /**
   * Periodic background cache cleanup
   */
  useEffect(() => {
    const interval = setInterval(() => {
      essentialDataCache.clearExpired();
      offlineOperations.clearCompletedOperations();
    }, 10 * 60 * 1000); // Every 10 minutes

    return () => clearInterval(interval);
  }, []);

  /**
   * Reset state when user logs out
   */
  useEffect(() => {
    if (!isAuthenticated) {
      initializeOnceRef.current = false;
      setData({
        user: null,
        stats: null,
        courses: [],
        enrolledCourses: [],
        certificates: [],
        isLoading: false,
        error: null,
      });
    }
  }, [isAuthenticated]);

  return {
    ...data,
    refreshData,
  };
}; 