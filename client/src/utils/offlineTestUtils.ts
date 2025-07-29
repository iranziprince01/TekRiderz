import { localDB } from '../offline/db';
import { getCachedUser, getCachedCourses, getCachedModules } from '../offline/cacheService';

/**
 * Utility functions for testing offline functionality
 */

/**
 * Check what data is currently cached
 */
export const checkCachedData = async () => {
  try {
    console.log('🔍 Checking cached data...');
    
    // Check users
    const users = await getCachedUser('all');
    console.log('👥 Cached users:', users ? 1 : 0);
    
    // Check courses
    const courses = await getCachedCourses();
    console.log('📚 Cached courses:', courses.length);
    
    // Check modules
    const modules = await getCachedModules();
    console.log('📖 Cached modules:', modules.length);
    
    // Check localStorage
    const currentUser = localStorage.getItem('currentUserId');
    const userRole = localStorage.getItem('userRole');
    console.log('🔑 Current user in localStorage:', currentUser);
    console.log('👤 User role:', userRole);
    
    return {
      users: users ? 1 : 0,
      courses: courses.length,
      modules: modules.length,
      currentUser,
      userRole
    };
  } catch (error) {
    console.error('Failed to check cached data:', error);
    return null;
  }
};

/**
 * Clear all cached data
 */
export const clearAllCachedData = async () => {
  try {
    console.log('🧹 Clearing all cached data...');
    
    // Clear PouchDB
    if (localDB) {
      const allDocs = await localDB.allDocs();
          const deletePromises = allDocs.rows.map((row: any) => 
      localDB.remove(row.id, row.value.rev)
    );
      await Promise.all(deletePromises);
    }
    
    // Clear localStorage
    localStorage.clear();
    
    console.log('✅ All cached data cleared');
  } catch (error) {
    console.error('Failed to clear cached data:', error);
  }
};

/**
 * Get detailed cache information
 */
export const getCacheInfo = async () => {
  try {
    if (!localDB) {
      return { error: 'Database not available' };
    }
    
    const info = await localDB.info();
    const allDocs = await localDB.allDocs();
    
    const userDocs = allDocs.rows.filter((row: any) => row.id.startsWith('user_'));
    const courseDocs = allDocs.rows.filter((row: any) => row.id.startsWith('course_'));
    const moduleDocs = allDocs.rows.filter((row: any) => row.id.startsWith('module_'));
    const progressDocs = allDocs.rows.filter((row: any) => row.id.startsWith('progress_'));
    
    return {
      databaseName: info.db_name,
      documentCount: info.doc_count,
      updateSeq: info.update_seq,
      users: userDocs.length,
      courses: courseDocs.length,
      modules: moduleDocs.length,
      progress: progressDocs.length,
      totalDocs: allDocs.rows.length
    };
  } catch (error: any) {
    console.error('Failed to get cache info:', error);
    return { error: error.message };
  }
};

/**
 * Test offline functionality
 */
export const testOfflineFunctionality = async () => {
  console.log('🧪 Testing offline functionality...');
  
  const cacheInfo = await getCacheInfo();
  console.log('📊 Cache info:', cacheInfo);
  
  const cachedData = await checkCachedData();
  console.log('📋 Cached data summary:', cachedData);
  
  // Test if we can access courses offline
  if (cachedData && cachedData.courses > 0) {
    console.log('✅ Offline functionality ready - courses available');
    return true;
  } else {
    console.log('⚠️ Offline functionality not ready - no courses cached');
    console.log('💡 Login online first to cache your courses');
    return false;
  }
};

/**
 * Check if a specific course is cached and show details
 */
export const checkCourseCache = async (courseId: string) => {
  try {
    console.log(`🔍 Checking cache for course: ${courseId}`);
    
    // Check all cached courses
    const allCourses = await (window as any).offlineTest.getCacheInfo();
    console.log('📊 All cached courses:', allCourses);
    
    // Try to get the specific course
    const { getCachedCourse } = await import('../offline/cacheService');
    const course = await getCachedCourse(courseId);
    
    if (course) {
      console.log('✅ Course found in cache:', {
        id: course._id || course.id,
        title: course.title,
        isEnrolled: course.isEnrolled,
        offlineAccessible: course.offlineAccessible,
        enrollment: course.enrollment,
        lastCached: course.lastCached
      });
    } else {
      console.log('❌ Course not found in cache');
      
      // Try different ID formats
      const shortId = courseId.replace('course_', '');
      const courseShort = await getCachedCourse(shortId);
      if (courseShort) {
        console.log('✅ Course found with short ID:', courseShort.title);
      }
    }
    
    return course;
  } catch (error) {
    console.error('Error checking course cache:', error);
    return null;
  }
};

/**
 * Test offline login functionality
 */
export const testOfflineLogin = async (email: string, password: string) => {
  try {
    console.log(`🧪 Testing offline login for: ${email}`);
    
    // Check if user data exists in localStorage
    const storedEmail = localStorage.getItem('userEmail');
    const storedUserId = localStorage.getItem('currentUserId');
    const storedUserName = localStorage.getItem('userName');
    
    console.log('📋 Current localStorage data:', {
      storedEmail,
      storedUserId,
      storedUserName,
      hasUserData: !!(storedEmail && storedUserId)
    });
    
    // Import and test the offline authentication
    const { authenticateOffline } = await import('../offline/offlineEssentials');
    const result = await authenticateOffline(email, password);
    
    console.log('🔐 Offline authentication result:', result);
    
    return result;
  } catch (error: any) {
    console.error('❌ Offline login test failed:', error);
    return { success: false, message: error.message };
  }
};

/**
 * Comprehensive investigation of PouchDB/IndexedDB course caching
 */
export const investigateCourseCaching = async () => {
  try {
    console.log('🔍 Investigating PouchDB/IndexedDB course caching...');
    
    // Check if PouchDB is available
    const { localDB } = await import('../offline/db');
    if (!localDB) {
      console.log('❌ PouchDB not available');
      return { error: 'PouchDB not available' };
    }
    
    // Get database info
    const dbInfo = await localDB.info();
    console.log('📊 Database Info:', dbInfo);
    
    // Get all documents
    const allDocs = await localDB.allDocs({ include_docs: true });
    console.log('📋 Total documents in database:', allDocs.rows.length);
    
    // Categorize documents
    const courses = allDocs.rows.filter((row: any) => row.id.startsWith('course_'));
    const modules = allDocs.rows.filter((row: any) => row.id.startsWith('module_'));
    const users = allDocs.rows.filter((row: any) => row.id.startsWith('user_'));
    const other = allDocs.rows.filter((row: any) => 
      !row.id.startsWith('course_') && 
      !row.id.startsWith('module_') && 
      !row.id.startsWith('user_')
    );
    
    console.log('📚 Course documents:', courses.length);
    console.log('📖 Module documents:', modules.length);
    console.log('👤 User documents:', users.length);
    console.log('📄 Other documents:', other.length);
    
    // Detailed course analysis
    if (courses.length > 0) {
      console.log('📚 Course Details:');
      courses.forEach((row: any, index: number) => {
        const course = row.doc?.course || row.doc;
        console.log(`  ${index + 1}. ${course?.title || 'Unknown'} (ID: ${row.id})`);
        console.log(`     - Enrolled: ${course?.isEnrolled || false}`);
        console.log(`     - Offline Accessible: ${course?.offlineAccessible || false}`);
        console.log(`     - Last Cached: ${course?.lastCached || 'Unknown'}`);
        console.log(`     - Modules: ${course?.totalModules || 0}`);
      });
    }
    
    // Detailed module analysis
    if (modules.length > 0) {
      console.log('📖 Module Details:');
      modules.forEach((row: any, index: number) => {
        const module = row.doc?.module || row.doc;
        console.log(`  ${index + 1}. ${module?.title || 'Unknown'} (Course: ${module?.courseId || 'Unknown'})`);
        console.log(`     - Completed: ${module?.isCompleted || false}`);

        console.log(`     - Duration: ${module?.estimatedDuration || 0} min`);
      });
    }
    
    // Check for specific course
    const courseId = 'course_1752860263581_pbro4k57v';
    const shortId = '1752860263581_pbro4k57v';
    
    console.log(`🔍 Looking for specific course: ${courseId}`);
    
    // Try to get the specific course
    const { getCachedCourse } = await import('../offline/cacheService');
    const course = await getCachedCourse(courseId);
    const courseShort = await getCachedCourse(shortId);
    
    console.log('Course lookup results:', {
      fullId: course ? 'Found' : 'Not found',
      shortId: courseShort ? 'Found' : 'Not found',
      courseTitle: course?.title || courseShort?.title || 'Not found'
    });
    
    return {
      dbInfo,
      totalDocs: allDocs.rows.length,
      courses: courses.length,
      modules: modules.length,
      users: users.length,
      other: other.length,
      specificCourse: {
        fullId: !!course,
        shortId: !!courseShort,
        title: course?.title || courseShort?.title
      }
    };
    
  } catch (error: any) {
    console.error('❌ Investigation failed:', error);
    return { error: error.message };
  }
};

/**
 * Check if a specific course and its modules are properly cached
 */
export const checkCourseCacheCompleteness = async (courseId: string) => {
  try {
    console.log(`🔍 Checking cache completeness for course: ${courseId}`);
    
    // Get course
    const { getCachedCourse, getCachedModulesByCourse } = await import('../offline/cacheService');
    const course = await getCachedCourse(courseId);
    
    if (!course) {
      console.log('❌ Course not found in cache');
      return { courseFound: false };
    }
    
    console.log('✅ Course found:', {
      title: course.title,
      id: course._id || course.id,
      isEnrolled: course.isEnrolled,
      offlineAccessible: course.offlineAccessible,
      totalModules: course.totalModules,
      sections: course.sections?.length || 0
    });
    
    // Get modules for this course
    const modules = await getCachedModulesByCourse(courseId);
    console.log(`📖 Found ${modules.length} modules for course`);
    
    // Check module details
    const moduleDetails = modules.map(module => ({
      title: module.title,
      id: module._id || module.id,
      courseId: module.courseId,
      isCompleted: module.isCompleted,

      hasQuiz: module.hasQuiz
    }));
    
    console.log('Module details:', moduleDetails);
    
    return {
      courseFound: true,
      course: {
        title: course.title,
        id: course._id || course.id,
        isEnrolled: course.isEnrolled,
        offlineAccessible: course.offlineAccessible
      },
      modules: {
        count: modules.length,
        details: moduleDetails
      }
    };
    
  } catch (error: any) {
    console.error('❌ Cache completeness check failed:', error);
    return { error: error.message };
  }
};

/**
 * Storage maintenance and cache management utilities
 */
export const storageMaintenance = {
  /**
   * Get comprehensive cache statistics
   */
  getStats: async () => {
    try {
      const { getCacheStats } = await import('../offline/cacheService');
      const stats = await getCacheStats();
      console.log('📊 Cache Statistics:', stats);
      return stats;
    } catch (error: any) {
      console.error('Failed to get cache stats:', error);
      return null;
    }
  },

  /**
   * Clean up old cache data
   */
  cleanupOldData: async (maxAgeDays: number = 30) => {
    try {
      const { cleanupOldCacheData } = await import('../offline/cacheService');
      const result = await cleanupOldCacheData(maxAgeDays);
      console.log('🧹 Cleanup Result:', result);
      return result;
    } catch (error: any) {
      console.error('Failed to cleanup old data:', error);
      return null;
    }
  },

  /**
   * Optimize cache storage
   */
  optimize: async () => {
    try {
      const { optimizeCacheStorage } = await import('../offline/cacheService');
      const result = await optimizeCacheStorage();
      console.log('⚡ Optimization Result:', result);
      return result;
    } catch (error: any) {
      console.error('Failed to optimize cache:', error);
      return null;
    }
  },

  /**
   * Check cache version and migration status
   */
  checkVersion: async () => {
    try {
      const version = localStorage.getItem('cache_version');
      console.log('📋 Cache Version:', version);
      return { version };
    } catch (error: any) {
      console.error('Failed to check cache version:', error);
      return { version: 'unknown' };
    }
  },

  /**
   * Force cache version migration
   */
  migrate: async () => {
    try {
      const { initializeCacheVersion } = await import('../offline/cacheService');
      await initializeCacheVersion();
      console.log('🔄 Cache migration completed');
      return { success: true };
    } catch (error: any) {
      console.error('Failed to migrate cache:', error);
      return { success: false, error: error.message };
    }
  }
};

/**
 * Test and fix offline course access
 */
export const testOfflineCourseAccess = async (courseId: string) => {
  try {
    console.log(`🔍 Testing offline course access for: ${courseId}`);
    
    // Import the new functions
    const { ensureCourseOfflineAccess, getCourseOffline } = await import('../offline/cacheService');
    
    // First, check if course exists
    const existingCourse = await getCourseOffline(courseId);
    console.log('Existing course check:', existingCourse ? 'Found' : 'Not found');
    
    // Ensure course is available offline
    const course = await ensureCourseOfflineAccess(courseId);
    console.log('Offline access ensured:', course ? 'Success' : 'Failed');
    
    if (course) {
      console.log('✅ Course details:', {
        title: course.title,
        id: course._id || course.id,
        isEnrolled: course.isEnrolled,
        offlineAccessible: course.offlineAccessible
      });
    }
    
    return {
      success: !!course,
      course: course,
      message: course ? 'Offline course access ready' : 'Failed to ensure offline access'
    };
  } catch (error: any) {
    console.error('❌ Offline course access test failed:', error);
    return {
      success: false,
      course: null,
      message: `Test failed: ${error.message}`
    };
  }
};

/**
 * Pre-cache specific courses for offline access
 */
export const preCacheCourses = async (courseIds: string[]) => {
  try {
    console.log(`🔄 Pre-caching courses:`, courseIds);
    
    const { preCacheCoursesForOffline } = await import('../offline/cacheService');
    const result = await preCacheCoursesForOffline(courseIds);
    
    console.log('Pre-caching result:', result);
    return result;
  } catch (error: any) {
    console.error('❌ Pre-caching failed:', error);
    return {
      success: false,
      cached: 0,
      failed: courseIds.length,
      message: `Pre-caching failed: ${error.message}`
    };
  }
};

// Offline Authentication Test Utilities
import { authenticateOffline } from '../offline/cacheService';
import { getLearnerOfflineStatus } from '../offline/cacheService';

export const testOfflineAuthentication = async () => {
  console.log('🧪 Testing offline authentication system...');
  
  try {
    // Test 1: Check if user data exists in localStorage
    const storedEmail = localStorage.getItem('userEmail');
    const storedUserId = localStorage.getItem('currentUserId');
    
    console.log('📱 localStorage data:', {
      email: storedEmail,
      userId: storedUserId,
      name: localStorage.getItem('userName'),
      role: localStorage.getItem('userRole'),
      verified: localStorage.getItem('userVerified'),
      termsAgreement: localStorage.getItem('userTermsAgreement')
    });
    
    if (!storedEmail || !storedUserId) {
      console.log('❌ No cached user data found in localStorage');
      return {
        success: false,
        message: 'No cached user data found. Please login online first.'
      };
    }
    
    // Test 2: Try offline authentication
    console.log('🔐 Attempting offline authentication...');
    const authResult = await authenticateOffline(storedEmail, 'test-password');
    
    console.log('🔐 Offline authentication result:', authResult);
    
    // Test 3: Check learner offline status
    if (authResult.success && authResult.user?.role === 'learner') {
      const learnerStatus = await getLearnerOfflineStatus();
      console.log('📊 Learner offline status:', learnerStatus);
    }
    
    return {
      success: authResult.success,
      message: authResult.message,
      user: authResult.user,
      localStorageData: {
        email: storedEmail,
        userId: storedUserId,
        name: localStorage.getItem('userName'),
        role: localStorage.getItem('userRole')
      }
    };
    
  } catch (error) {
    console.error('❌ Offline authentication test failed:', error);
    return {
      success: false,
      message: 'Test failed: ' + (error as Error).message
    };
  }
};

export const clearOfflineTestData = () => {
  console.log('🧹 Clearing offline test data...');
  
  // Clear localStorage
  localStorage.removeItem('currentUserId');
  localStorage.removeItem('userName');
  localStorage.removeItem('userEmail');
  localStorage.removeItem('userRole');
  localStorage.removeItem('userAvatar');
  localStorage.removeItem('userVerified');
  localStorage.removeItem('userTermsAgreement');
  
  console.log('✅ Offline test data cleared');
};

export const simulateOfflineMode = () => {
  console.log('📱 Simulating offline mode...');
  
  // Override navigator.onLine
  Object.defineProperty(navigator, 'onLine', {
    writable: true,
    value: false
  });
  
  // Trigger offline event
  window.dispatchEvent(new Event('offline'));
  
  console.log('✅ Offline mode simulated');
};

export const simulateOnlineMode = () => {
  console.log('📱 Simulating online mode...');
  
  // Override navigator.onLine
  Object.defineProperty(navigator, 'onLine', {
    writable: true,
    value: true
  });
  
  // Trigger online event
  window.dispatchEvent(new Event('online'));
  
  console.log('✅ Online mode simulated');
};

// Global test functions for browser console
if (typeof window !== 'undefined') {
  (window as any).offlineTest = {
    checkCachedData,
    clearAllCachedData,
    getCacheInfo,
    testOfflineFunctionality,
    checkCourseCache,
    testOfflineLogin,
    investigateCourseCaching,
    checkCourseCacheCompleteness,
    storageMaintenance,
    testOfflineCourseAccess,
    preCacheCourses
  };
  
  (window as any).testOfflineAuth = testOfflineAuthentication;
  (window as any).clearOfflineData = clearOfflineTestData;
  (window as any).simulateOffline = simulateOfflineMode;
  (window as any).simulateOnline = simulateOnlineMode;
  
  console.log(`
🔧 Offline Test Utilities Available:
   offlineTest.checkCachedData()     - Check what's cached
   offlineTest.clearAllCachedData()  - Clear all cached data
   offlineTest.getCacheInfo()        - Get detailed cache info
   offlineTest.testOfflineFunctionality() - Test offline readiness

Type any command in the console to use these utilities.
  `);
} 