/**
 * Essential Data Cache for TekRiders Platform
 * Lightweight caching for dashboard functionality
 */

interface CacheEntry {
  data: any;
  timestamp: number;
  expiry: number;
}

interface EssentialCacheData {
  profile?: any;
  allCourses?: any[];
  enrolledCourses?: any[];
  certificates?: any[];
  stats?: any;
}

class EssentialDataCache {
  private static instance: EssentialDataCache;
  private readonly CACHE_VERSION = '1.0.0';
  private readonly CACHE_DURATIONS = {
    profile: 24 * 60 * 60 * 1000,    // 24 hours
    courses: 12 * 60 * 60 * 1000,    // 12 hours  
    enrollments: 6 * 60 * 60 * 1000,  // 6 hours
    certificates: 24 * 60 * 60 * 1000, // 24 hours
    stats: 2 * 60 * 60 * 1000,       // 2 hours
  };

  static getInstance(): EssentialDataCache {
    if (!EssentialDataCache.instance) {
      EssentialDataCache.instance = new EssentialDataCache();
    }
    return EssentialDataCache.instance;
  }

  private getCacheKey(type: string, userId?: string): string {
    return `tekr_${this.CACHE_VERSION}_${type}${userId ? `_${userId}` : ''}`;
  }

  private setCache(key: string, data: any, duration: number): void {
    try {
      const entry: CacheEntry = {
        data,
        timestamp: Date.now(),
        expiry: Date.now() + duration
      };
      localStorage.setItem(key, JSON.stringify(entry));
    } catch (error) {
      // Silent fail on storage quota exceeded
      console.warn('Cache storage failed:', error);
    }
  }

  private getCache(key: string): any {
    try {
      const item = localStorage.getItem(key);
      if (!item) return null;

      const entry: CacheEntry = JSON.parse(item);
      
      // Check if expired
      if (Date.now() > entry.expiry) {
        localStorage.removeItem(key);
        return null;
      }

      return entry.data;
    } catch (error) {
      // Clean up corrupted cache entry
      localStorage.removeItem(key);
      return null;
    }
  }

  // Cache user profile
  cacheProfile(userId: string, profile: any): void {
    const key = this.getCacheKey('profile', userId);
    this.setCache(key, profile, this.CACHE_DURATIONS.profile);
  }

  getProfile(userId: string): any {
    const key = this.getCacheKey('profile', userId);
    return this.getCache(key);
  }

  // Cache all available courses
  cacheAllCourses(courses: any[]): void {
    const key = this.getCacheKey('courses');
    this.setCache(key, courses, this.CACHE_DURATIONS.courses);
  }

  getAllCourses(): any[] {
    const key = this.getCacheKey('courses');
    return this.getCache(key) || [];
  }

  // Cache enrolled courses
  cacheEnrolledCourses(userId: string, courses: any[]): void {
    const key = this.getCacheKey('enrollments', userId);
    this.setCache(key, courses, this.CACHE_DURATIONS.enrollments);
  }

  getEnrolledCourses(userId: string): any[] {
    const key = this.getCacheKey('enrollments', userId);
    return this.getCache(key) || [];
  }

  // Cache certificates
  cacheCertificates(userId: string, certificates: any[]): void {
    const key = this.getCacheKey('certificates', userId);
    this.setCache(key, certificates, this.CACHE_DURATIONS.certificates);
  }

  getCertificates(userId: string): any[] {
    const key = this.getCacheKey('certificates', userId);
    return this.getCache(key) || [];
  }

  // Cache user statistics
  cacheStats(userId: string, stats: any): void {
    const key = this.getCacheKey('stats', userId);
    this.setCache(key, stats, this.CACHE_DURATIONS.stats);
  }

  getStats(userId: string): any {
    const key = this.getCacheKey('stats', userId);
    return this.getCache(key);
  }

  // Preload all essential data for a user
  async preloadEssentialData(userId: string, apiClient: any): Promise<EssentialCacheData> {
    const results: EssentialCacheData = {};

    try {
      // Load data in parallel for efficiency
      const [profileRes, coursesRes, enrollmentsRes, certificatesRes, statsRes] = await Promise.allSettled([
        apiClient.getProfile(),
        apiClient.getCourses({ status: 'published', limit: 100 }),
        apiClient.getUserCourses(),
        apiClient.getMyCertificates(),
        apiClient.getUserStats()
      ]);

      // Process and cache results
      if (profileRes.status === 'fulfilled' && profileRes.value?.success) {
        results.profile = profileRes.value.data;
        this.cacheProfile(userId, results.profile);
      }

             if (coursesRes.status === 'fulfilled' && coursesRes.value?.success) {
         const courses = coursesRes.value.data?.courses || [];
         results.allCourses = courses;
         this.cacheAllCourses(courses);
       }

       if (enrollmentsRes.status === 'fulfilled' && enrollmentsRes.value?.success) {
         const enrollments = Array.isArray(enrollmentsRes.value.data) ? enrollmentsRes.value.data : [];
         results.enrolledCourses = enrollments;
         this.cacheEnrolledCourses(userId, enrollments);
       }

       if (certificatesRes.status === 'fulfilled' && certificatesRes.value?.success) {
         const certificates = Array.isArray(certificatesRes.value.data) ? certificatesRes.value.data : [];
         results.certificates = certificates;
         this.cacheCertificates(userId, certificates);
       }

      if (statsRes.status === 'fulfilled' && statsRes.value?.success) {
        results.stats = statsRes.value.data;
        this.cacheStats(userId, results.stats);
      }

    } catch (error) {
      console.warn('Failed to preload some data:', error);
    }

    return results;
  }

  // Clear expired cache entries
  clearExpired(): void {
    const keysToRemove: string[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(`tekr_${this.CACHE_VERSION}_`)) {
        try {
          const item = localStorage.getItem(key);
          if (item) {
            const entry: CacheEntry = JSON.parse(item);
            if (Date.now() > entry.expiry) {
              keysToRemove.push(key);
            }
          }
        } catch (error) {
          keysToRemove.push(key);
        }
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));
  }

  // Clear all cached data for a user
  clearUserCache(userId: string): void {
    const keys = [
      this.getCacheKey('profile', userId),
      this.getCacheKey('enrollments', userId),
      this.getCacheKey('certificates', userId),
      this.getCacheKey('stats', userId)
    ];

    keys.forEach(key => localStorage.removeItem(key));
  }

  // Check if essential data exists for user
  hasEssentialData(userId: string): boolean {
    return !!(
      this.getProfile(userId) || 
      this.getEnrolledCourses(userId).length > 0
    );
  }
}

export const essentialDataCache = EssentialDataCache.getInstance();
export type { EssentialCacheData }; 