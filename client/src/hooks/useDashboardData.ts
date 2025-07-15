import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../utils/api';

console.log('📊 Loading dashboard data cache hook...');

// Types for dashboard data
interface Course {
  id: string;
  title: string;
  description: string;
  thumbnail?: string;
  category: string;
  level: string;
  duration: number;
  status: string;
  rating?: number;
  students?: number;
  createdAt: string;
  updatedAt: string;
}

interface Enrollment {
  id: string;
  courseId: string;
  userId: string;
  progress: number;
  completed: boolean;
  enrolledAt: string;
  completedAt?: string;
}

interface Certificate {
  id: string;
  userId: string;
  courseId: string;
  courseName: string;
  issuedAt: string;
  skills: string[];
  grade?: number;
}

interface CachedData {
  courses: Course[];
  enrollments: Enrollment[];
  certificates: Certificate[];
  lastUpdated: number;
  version: string;
}

interface DashboardDataState {
  courses: Course[];
  enrollments: Enrollment[];
  certificates: Certificate[];
  loading: boolean;
  error: string | null;
  isOffline: boolean;
  lastSync: number | null;
}

// IndexedDB cache manager
class DashboardCache {
  private dbName = 'TekRidersDashboardCache';
  private dbVersion = 1;
  private storeName = 'dashboardData';

  async init(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'key' });
          store.createIndex('lastUpdated', 'lastUpdated');
        }
      };
    });
  }

  async save(key: string, data: any): Promise<void> {
    try {
      const db = await this.init();
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      await store.put({
        key,
        data,
        lastUpdated: Date.now(),
        version: '1.0'
      });
      
      console.log(`💾 Dashboard data cached: ${key}`);
    } catch (error: any) {
      console.error('❌ Failed to cache dashboard data:', error?.message);
    }
  }

  async get(key: string): Promise<any | null> {
    try {
      const db = await this.init();
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      
      return new Promise((resolve) => {
        const request = store.get(key);
        request.onsuccess = () => {
          const result = request.result;
          if (result && this.isValid(result)) {
            console.log(`📖 Dashboard data loaded from cache: ${key}`);
            resolve(result.data);
          } else {
            resolve(null);
          }
        };
        request.onerror = () => resolve(null);
      });
    } catch (error: any) {
      console.error('❌ Failed to load cached dashboard data:', error?.message);
      return null;
    }
  }

  private isValid(cachedItem: any): boolean {
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    return Date.now() - cachedItem.lastUpdated < maxAge;
  }

  async clear(): Promise<void> {
    try {
      const db = await this.init();
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      await store.clear();
      console.log('🧹 Dashboard cache cleared');
    } catch (error: any) {
      console.error('❌ Failed to clear dashboard cache:', error?.message);
    }
  }
}

const cache = new DashboardCache();

// Main hook for dashboard data
export const useDashboardData = (userId?: string) => {
  const [state, setState] = useState<DashboardDataState>({
    courses: [],
    enrollments: [],
    certificates: [],
    loading: true,
    error: null,
    isOffline: !navigator.onLine,
    lastSync: null
  });

  // Check online status
  useEffect(() => {
    const handleOnline = () => setState(prev => ({ ...prev, isOffline: false }));
    const handleOffline = () => setState(prev => ({ ...prev, isOffline: true }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load cached data first
  const loadCachedData = useCallback(async () => {
    if (!userId) return;

    try {
      const [cachedCourses, cachedEnrollments, cachedCertificates] = await Promise.all([
        cache.get(`courses_${userId}`),
        cache.get(`enrollments_${userId}`),
        cache.get(`certificates_${userId}`)
      ]);

      if (cachedCourses || cachedEnrollments || cachedCertificates) {
        setState(prev => ({
          ...prev,
          courses: Array.isArray(cachedCourses) ? cachedCourses : [],
          enrollments: Array.isArray(cachedEnrollments) ? cachedEnrollments : [],
          certificates: Array.isArray(cachedCertificates) ? cachedCertificates : [],
          loading: false,
          lastSync: cachedCourses?.lastUpdated || cachedEnrollments?.lastUpdated || Date.now()
        }));
        
        console.log('📊 Dashboard data loaded from cache');
      }
    } catch (error: any) {
      console.error('❌ Failed to load cached dashboard data:', error?.message);
    }
  }, [userId]);

  // Fetch fresh data from API
  const fetchFreshData = useCallback(async (forceRefresh = false) => {
    if (!userId) return;
    
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      console.log('🔄 Fetching fresh dashboard data...');
      
      // Fetch all data in parallel
      const [coursesResponse, enrollmentsResponse, certificatesResponse] = await Promise.all([
        apiClient.getCourses(),
        apiClient.getEnrollments(),
        apiClient.getUserCertificates().catch(() => ({ success: false, data: [] })) // Certificates might not exist
      ]);

      const courses = coursesResponse.success ? (Array.isArray(coursesResponse.data) ? coursesResponse.data : []) : [];
      const enrollments = enrollmentsResponse.success ? (Array.isArray(enrollmentsResponse.data) ? enrollmentsResponse.data : []) : [];
      const certificates = certificatesResponse.success ? (Array.isArray(certificatesResponse.data) ? certificatesResponse.data : []) : [];

      // Update state with fresh data
      setState(prev => ({
        ...prev,
        courses,
        enrollments,
        certificates,
        loading: false,
        error: null,
        lastSync: Date.now()
      }));

      // Cache the fresh data for offline access
      await Promise.all([
        cache.save(`courses_${userId}`, courses),
        cache.save(`enrollments_${userId}`, enrollments),
        cache.save(`certificates_${userId}`, certificates)
      ]);

      console.log('✅ Dashboard data fetched and cached successfully');
      
    } catch (error: any) {
      console.error('❌ Failed to fetch dashboard data:', error?.message);
      
      setState(prev => ({
        ...prev,
        loading: false,
        error: error?.message || 'Failed to load dashboard data'
      }));

      // If online fetch fails, try to use cached data
      if (!state.courses.length && !state.enrollments.length) {
        await loadCachedData();
      }
    }
  }, [userId, state.courses.length, state.enrollments.length, loadCachedData]);

  // Auto-refresh data when coming online
  useEffect(() => {
    if (!state.isOffline && userId) {
      fetchFreshData();
    }
  }, [state.isOffline, userId, fetchFreshData]);

  // Initial data load
  useEffect(() => {
    if (userId) {
      // Load cached data first for immediate display
      loadCachedData();
      
      // Then try to fetch fresh data if online
      if (navigator.onLine) {
        fetchFreshData();
      }
    }
  }, [userId, loadCachedData, fetchFreshData]);

  // Refresh function for manual refresh
  const refresh = useCallback(() => {
    if (navigator.onLine) {
      fetchFreshData(true);
    } else {
      loadCachedData();
    }
  }, [fetchFreshData, loadCachedData]);

  // Clear cache function
  const clearCache = useCallback(async () => {
    await cache.clear();
    setState(prev => ({
      ...prev,
      courses: [],
      enrollments: [],
      certificates: [],
      lastSync: null
    }));
  }, []);

  return {
    ...state,
    refresh,
    clearCache,
    // Helper functions for filtered data
    getEnrolledCourses: useCallback(() => {
      const enrolledIds = state.enrollments.map(e => e.courseId);
      return state.courses.filter(course => enrolledIds.includes(course.id));
    }, [state.courses, state.enrollments]),
    
    getCompletedCourses: useCallback(() => {
      const completedIds = state.enrollments.filter(e => e.completed).map(e => e.courseId);
      return state.courses.filter(course => completedIds.includes(course.id));
    }, [state.courses, state.enrollments]),
    
    getAvailableCourses: useCallback(() => {
      const enrolledIds = state.enrollments.map(e => e.courseId);
      return state.courses.filter(course => !enrolledIds.includes(course.id));
    }, [state.courses, state.enrollments]),
    
    getCourseProgress: useCallback((courseId: string) => {
      const enrollment = state.enrollments.find(e => e.courseId === courseId);
      return enrollment ? enrollment.progress : 0;
    }, [state.enrollments])
  };
};

// Export cache instance for direct access if needed
export { cache as dashboardCache };

console.log('✅ Dashboard data cache hook loaded successfully'); 