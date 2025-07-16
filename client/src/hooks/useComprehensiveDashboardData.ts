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
    // Always try to load public course data, even if not authenticated
    if (!forceRefresh) {
      setData(prev => ({ ...prev, isLoading: true, error: null }));
    }

    // Don't show loading on refresh to maintain seamless experience
    if (!forceRefresh) {
      setData(prev => ({ ...prev, isLoading: true, error: null }));
    }

    try {
      let hasData = false;

      // First, try to load from cache for instant display
      if (!forceRefresh) {
        const cachedCourses = essentialDataCache.getAllCourses();
        
        // For authenticated users, load all cached data
        if (isAuthenticated && userId) {
          const cachedProfile = essentialDataCache.getProfile(userId);
          const cachedEnrollments = essentialDataCache.getEnrolledCourses(userId);
          const cachedCertificates = essentialDataCache.getCertificates(userId);
          const cachedStats = essentialDataCache.getStats(userId);

          // If we have any cached data, show it immediately
          const hasValidCache = !!(cachedProfile || cachedEnrollments.length > 0 || cachedCourses.length > 0);
          
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
        } else {
          // For non-authenticated users, just show cached courses
          if (cachedCourses.length > 0) {
            setData(prev => ({
              ...prev,
              courses: cachedCourses,
              isLoading: false,
              error: null,
            }));
            hasData = true;
          }
        }
      }

      // If online, fetch fresh data in background and update cache silently
      if (isOnline) {
        try {
          let freshData: any = {};

          // Always load courses first (public data)
          try {
            const coursesResponse = await apiClient.getCourses({ status: 'published', limit: 100 });
            if (coursesResponse.success) {
              freshData.allCourses = coursesResponse.data?.courses || [];
              essentialDataCache.cacheAllCourses(freshData.allCourses);
              
            }
          } catch (error) {
            console.warn('Failed to load public courses:', error);
            freshData.allCourses = [];
          }

          if (isAuthenticated && userId) {
            // Load additional authenticated data
            try {
              const [profileRes, enrollmentsRes, certificatesRes, statsRes] = await Promise.allSettled([
                apiClient.getProfile(),
                apiClient.getEnrollments(),
                apiClient.getUserCertificates(),
                apiClient.getUserStats()
              ]);

              if (profileRes.status === 'fulfilled' && profileRes.value?.success) {
                freshData.profile = profileRes.value.data;
                essentialDataCache.cacheProfile(userId, freshData.profile);
              }

              if (enrollmentsRes.status === 'fulfilled' && enrollmentsRes.value?.success) {
                const enrollments = Array.isArray(enrollmentsRes.value.data) ? enrollmentsRes.value.data : [];
                freshData.enrolledCourses = enrollments;
                essentialDataCache.cacheEnrolledCourses(userId, enrollments);
              }

              if (certificatesRes.status === 'fulfilled' && certificatesRes.value?.success) {
                const certificates = Array.isArray(certificatesRes.value.data) ? certificatesRes.value.data : [];
                freshData.certificates = certificates;
                essentialDataCache.cacheCertificates(userId, certificates);
              }

              if (statsRes.status === 'fulfilled' && statsRes.value?.success) {
                freshData.stats = statsRes.value.data;
                essentialDataCache.cacheStats(userId, freshData.stats);
              }
            } catch (error) {
              console.warn('Failed to load some authenticated data:', error);
            }
          }
          
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
            const errorMessage = isAuthenticated 
              ? 'Unable to load data. Please check your connection.'
              : 'Unable to load courses. Please check your connection.';
              
            setData(prev => ({
              ...prev,
              isLoading: false,
              error: errorMessage,
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
    // Initialize for both authenticated and non-authenticated users
    if (!initializeOnceRef.current) {
      initializeOnceRef.current = true;
      loadData(false);
    }
  }, [loadData]);

  // Reset and reload when authentication state changes
  useEffect(() => {
    if (initializeOnceRef.current) {
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
   * Partial reset when user logs out (keep public courses)
   */
  useEffect(() => {
    if (!isAuthenticated) {
      setData(prev => ({
        ...prev,
        user: null,
        stats: null,
        enrolledCourses: [],
        certificates: [],
        // Keep courses for browsing when logged out
      }));
    }
  }, [isAuthenticated]);

  return {
    ...data,
    refreshData,
  };
}; 