import { localDB } from './db';
import { saveProgress, getProgress, getCourseProgress } from './progressManager';
import { cacheModule, getCachedModule, updateCachedModule, getCachedUser, getEnrolledCoursesOffline, getCourseOffline, initializeCacheVersion } from './cacheService';


// Essential offline functionality for demonstration

/**
 * Essential offline authentication
 * Allows learners to login while offline using cached credentials
 */
export const authenticateOffline = async (email: string, password: string): Promise<{
  success: boolean;
  user?: any;
  message: string;
}> => {
  try {
    console.log('🔐 Attempting offline authentication for:', email);
    
    // First, check localStorage for existing user data
    const storedEmail = localStorage.getItem('userEmail');
    const storedUserId = localStorage.getItem('currentUserId');
    const storedUserName = localStorage.getItem('userName');
    const storedUserRole = localStorage.getItem('userRole');
    
    if (storedEmail && storedEmail.toLowerCase() === email.toLowerCase()) {
      console.log('✅ Found user in localStorage:', storedUserName);
      
      // Create user object from localStorage data
      const user = {
        id: storedUserId,
        email: storedEmail,
        name: storedUserName,
        role: storedUserRole,
        verified: localStorage.getItem('userVerified') === 'true'
      };
      
      // Update login time
      localStorage.setItem('offlineLoginTime', new Date().toISOString());
      
      return {
        success: true,
        user,
        message: 'Offline login successful'
      };
    }
    
    // Fallback: Check PouchDB for cached users
    console.log('🔍 Checking PouchDB for cached users...');
    const cachedUsers = await getAllCachedUsers();
    const user = cachedUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
    
    if (!user) {
      return {
        success: false,
        message: 'No cached user found. Please login online first to enable offline access.'
      };
    }
    
    // Store current user in localStorage for offline access
    localStorage.setItem('currentUserId', user.id);
    localStorage.setItem('userRole', user.role);
    localStorage.setItem('userEmail', user.email);
    localStorage.setItem('userName', user.name);
    localStorage.setItem('offlineLoginTime', new Date().toISOString());
    
    console.log('✅ Offline authentication successful for:', user.name);
    
    return {
      success: true,
      user,
      message: 'Offline login successful'
    };
  } catch (error) {
    console.error('❌ Offline authentication failed:', error);
    return {
      success: false,
      message: 'Offline authentication failed. Please try again.'
    };
  }
};

/**
 * Get all cached users for offline authentication
 */
export const getAllCachedUsers = async (): Promise<any[]> => {
  try {
    if (!localDB) {
      console.warn('Database not available for user cache');
      return [];
    }
    
    const result = await localDB.allDocs({
      include_docs: true,
      startkey: 'user_',
      endkey: 'user_\ufff0'
    });
    
    return result.rows.map((row: any) => row.doc?.user || row.doc).filter(Boolean);
  } catch (error) {
    console.error('Failed to get cached users:', error);
    return [];
  }
};

/**
 * Essential offline progress tracking
 * This ensures progress is properly saved even when offline
 */
export const saveOfflineProgress = async (
  userId: string,
  courseId: string,
  moduleId: string,
  progressData: {
    percentage: number;
    timeSpent: number;
    isCompleted: boolean;
    currentPosition?: number;
  }
): Promise<boolean> => {
  try {
    console.log('💾 Saving offline progress:', { courseId, moduleId, percentage: progressData.percentage });
    
    // Save progress to local database
    const success = await saveProgress({
      userId,
      courseId,
      lessonId: moduleId,
      moduleId,
      progress: {
        ...progressData,
        completedAt: progressData.isCompleted ? new Date().toISOString() : undefined,
        lastUpdated: new Date().toISOString(),
        interactions: [],
        notes: [],
        bookmarks: []
      },
      metadata: {
        courseTitle: 'Offline Course',
        lessonTitle: 'Offline Module',
        moduleTitle: 'Offline Module'
      }
    });

    if (success && progressData.isCompleted) {
      // Update module completion status in cache
      try {
        const cachedModule = await getCachedModule(moduleId);
        if (cachedModule) {
          const updatedModule = {
            ...cachedModule,
            isCompleted: true
          };
          await updateCachedModule(updatedModule);
          console.log('✅ Module marked as completed in offline cache:', moduleId);
        }
      } catch (cacheError) {
        console.warn('Failed to update module completion in cache:', cacheError);
      }
    }

    return success;
  } catch (error) {
    console.error('❌ Failed to save offline progress:', error);
    return false;
  }
};

/**
 * Essential offline module completion
 * Handles module completion in offline mode
 */
export const completeOfflineModule = async (
  userId: string,
  courseId: string,
  moduleId: string
): Promise<boolean> => {
  try {
    console.log('✅ Completing offline module:', moduleId);
    
    // Save completion progress
    const progressSaved = await saveOfflineProgress(userId, courseId, moduleId, {
      percentage: 100,
      timeSpent: 0,
      isCompleted: true
    });

    if (!progressSaved) {
      console.error('Failed to save module completion progress');
      return false;
    }

    // Update module in cache
    try {
      const cachedModule = await getCachedModule(moduleId);
      if (cachedModule) {
        const updatedModule = {
          ...cachedModule,
          isCompleted: true
        };
        await updateCachedModule(updatedModule);
        console.log('✅ Module completion saved to offline cache');
      }
    } catch (cacheError) {
      console.warn('Failed to update module in cache:', cacheError);
    }

    return true;
  } catch (error) {
    console.error('❌ Failed to complete offline module:', error);
    return false;
  }
};

/**
 * Essential offline status detection
 * More robust offline detection for demonstration
 */
export const getEssentialOfflineStatus = (): {
  isOffline: boolean;
  hasLocalData: boolean;
  canAccessCourses: boolean;
  lastSync: string | null;
  cachedUser?: any;
  hasCachedCourses: boolean;
  databaseStatus: 'ready' | 'initializing' | 'failed';
} => {
  const isOffline = !navigator.onLine;
  const hasLocalData = localStorage.getItem('currentUserId') !== null && 
                      localStorage.getItem('userEmail') !== null;
  const lastSync = localStorage.getItem('lastSync');
  const hasCachedCourses = localStorage.getItem('hasCachedCourses') === 'true';
  
  const cachedUser = hasLocalData ? {
    id: localStorage.getItem('currentUserId'),
    name: localStorage.getItem('userName'),
    email: localStorage.getItem('userEmail'),
    role: localStorage.getItem('userRole'),
    verified: localStorage.getItem('userVerified') === 'true'
  } : null;
  
  // Check database status
  let databaseStatus: 'ready' | 'initializing' | 'failed' = 'ready';
  try {
    const dbInfo = localStorage.getItem('pouchdb_status');
    if (dbInfo === 'failed') {
      databaseStatus = 'failed';
    } else if (dbInfo === 'initializing') {
      databaseStatus = 'initializing';
    }
  } catch (error) {
    databaseStatus = 'failed';
  }
  
  console.log('🔍 Enhanced offline status check:', {
    isOffline,
    hasLocalData,
    hasCachedCourses,
    databaseStatus,
    cachedUser: cachedUser ? { name: cachedUser.name, email: cachedUser.email, role: cachedUser.role } : null,
    lastSync: lastSync ? new Date(lastSync).toLocaleString() : null
  });
  
  return {
    isOffline,
    hasLocalData,
    canAccessCourses: isOffline && hasLocalData && hasCachedCourses && databaseStatus === 'ready',
    lastSync: lastSync ? new Date(lastSync).toLocaleString() : null,
    cachedUser,
    hasCachedCourses,
    databaseStatus
  };
};

/**
 * Enhanced offline error handling
 * Provides comprehensive error recovery and user feedback
 */
export const handleOfflineError = (error: any, context: string): {
  canRecover: boolean;
  message: string;
  action?: string;
  severity: 'low' | 'medium' | 'high';
  retryable: boolean;
} => {
  console.error(`❌ Offline error in ${context}:`, error);

  // Network-related errors
  if (error.name === 'NetworkError' || error.message?.includes('network') || error.message?.includes('fetch')) {
    return {
      canRecover: true,
      message: 'Network connection lost. Please check your internet connection and try again.',
      action: 'Check your internet connection and refresh the page.',
      severity: 'medium',
      retryable: true
    };
  }

  // Database-related errors
  if (error.name === 'QuotaExceededError' || error.message?.includes('quota')) {
    return {
      canRecover: true,
      message: 'Storage space is full. Please clear some data and try again.',
      action: 'Clear browser cache or remove some offline content.',
      severity: 'high',
      retryable: true
    };
  }

  if (error.name === 'IndexedDBError' || error.message?.includes('indexeddb')) {
    return {
      canRecover: true,
      message: 'Local database error. Please refresh the page to reset.',
      action: 'Refresh the page to reset the local database.',
      severity: 'medium',
      retryable: true
    };
  }

  // Cache-related errors
  if (error.name === 'CacheError' || error.message?.includes('cache')) {
    return {
      canRecover: true,
      message: 'Cache error occurred. Some offline content may not be available.',
      action: 'Refresh the page to rebuild the cache.',
      severity: 'low',
      retryable: true
    };
  }

  // Authentication errors
  if (error.status === 401 || error.message?.includes('unauthorized')) {
    return {
      canRecover: true,
      message: 'Authentication expired. Please login again.',
      action: 'Login again to continue.',
      severity: 'medium',
      retryable: false
    };
  }

  if (error.status === 403 || error.message?.includes('forbidden')) {
    return {
      canRecover: false,
      message: 'Access denied. You may not have permission to access this content.',
      action: 'Contact support if you believe this is an error.',
      severity: 'high',
      retryable: false
    };
  }

  // Data validation errors
  if (error.name === 'ValidationError' || error.message?.includes('validation')) {
    return {
      canRecover: true,
      message: 'Data validation error. Some content may be corrupted.',
      action: 'Refresh the page to reload clean data.',
      severity: 'medium',
      retryable: true
    };
  }

  // Timeout errors
  if (error.name === 'TimeoutError' || error.message?.includes('timeout')) {
    return {
      canRecover: true,
      message: 'Request timed out. Please try again.',
      action: 'Try again in a few moments.',
      severity: 'low',
      retryable: true
    };
  }

  // Rate limiting errors
  if (error.status === 429 || error.message?.includes('rate limit')) {
    return {
      canRecover: true,
      message: 'Too many requests. Please wait a moment and try again.',
      action: 'Wait a few seconds before trying again.',
      severity: 'low',
      retryable: true
    };
  }

  // Server errors
  if (error.status >= 500) {
    return {
      canRecover: true,
      message: 'Server error. Please try again later.',
      action: 'Try again in a few minutes.',
      severity: 'medium',
      retryable: true
    };
  }

  // Generic offline errors
  if (!navigator.onLine) {
    return {
      canRecover: true,
      message: 'You are currently offline. Some features may not be available.',
      action: 'Connect to the internet for full functionality.',
      severity: 'low',
      retryable: true
    };
  }

  // Unknown errors
  return {
    canRecover: false,
    message: 'An unexpected error occurred. Please try refreshing the page.',
    action: 'Refresh the page or contact support if the problem persists.',
    severity: 'high',
    retryable: true
  };
};

/**
 * Essential offline data validation
 * Validates that essential offline data is available
 */
export const validateOfflineData = async (): Promise<{
  isValid: boolean;
  issues: string[];
  canProceed: boolean;
}> => {
  const issues: string[] = [];
  let canProceed = true;

  try {
    // Check if user is cached
    const userId = localStorage.getItem('currentUserId');
    if (!userId) {
      issues.push('No cached user found');
      canProceed = false;
    }

    // Check if courses are cached
    if (localDB) {
      try {
        const result = await localDB.allDocs({
          include_docs: true,
          startkey: 'course_',
          endkey: 'course_\ufff0'
        });
        
        if (result.rows.length === 0) {
          issues.push('No cached courses found');
          canProceed = false;
        }
      } catch (error) {
        issues.push('Failed to check cached courses');
        canProceed = false;
      }
    } else {
      issues.push('Local database not available');
      canProceed = false;
    }

    // If we have any cached data, we can proceed
    if (localDB) {
      try {
        const userResult = await localDB.allDocs({
          include_docs: true,
          startkey: 'user_',
          endkey: 'user_\ufff0'
        });
        
        if (userResult.rows.length > 0) {
          console.log('✅ Cached user data available, offline mode can proceed');
          canProceed = true;
        }
      } catch (error) {
        console.warn('Failed to check cached user data:', error);
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
      canProceed
    };
  } catch (error) {
    console.error('Failed to validate offline data:', error);
    return {
      isValid: false,
      issues: ['Failed to validate offline data'],
      canProceed: false
    };
  }
};

/**
 * Essential offline initialization
 * Ensures offline functionality is ready for demonstration
 */
export const initializeOfflineEssentials = async (): Promise<{
  success: boolean;
  message: string;
  offlineReady: boolean;
}> => {
  try {
    console.log('🔧 Initializing offline essentials...');
    
    // Set database status to initializing
    localStorage.setItem('pouchdb_status', 'initializing');
    
    // Check if PouchDB is available
    const { getPouchDB } = await import('./db');
    const db = await getPouchDB();
    
    if (!db) {
      localStorage.setItem('pouchdb_status', 'failed');
      return {
        success: false,
        message: 'Database not available',
        offlineReady: false
      };
    }
    
    // Test database connection
    try {
      const dbInfo = await db.info();
      console.log('📊 Database info:', dbInfo);
      
      // Set database status to ready
      localStorage.setItem('pouchdb_status', 'ready');
    } catch (dbError) {
      console.error('❌ Database connection test failed:', dbError);
      localStorage.setItem('pouchdb_status', 'failed');
      return {
        success: false,
        message: 'Database connection failed',
        offlineReady: false
      };
    }
    
    // Initialize cache versioning
    await initializeCacheVersion();
    
    // Validate offline data
    const validation = await validateOfflineData();
    
    // Check if we have cached courses
    const { getCachedCourses } = await import('./cacheService');
    const cachedCourses = await getCachedCourses();
    
    if (cachedCourses.length > 0) {
      localStorage.setItem('hasCachedCourses', 'true');
      console.log(`📚 Found ${cachedCourses.length} cached courses during initialization`);
    } else {
      localStorage.removeItem('hasCachedCourses');
      console.log('📚 No cached courses found during initialization');
    }
    
    // Set last sync timestamp
    localStorage.setItem('lastSync', new Date().toISOString());
    
    console.log('✅ Offline essentials initialized successfully');
    
    return {
      success: true,
      message: `Offline mode ready (${cachedCourses.length} courses cached)`,
      offlineReady: validation.canProceed && cachedCourses.length > 0
    };
  } catch (error) {
    console.error('❌ Failed to initialize offline essentials:', error);
    localStorage.setItem('pouchdb_status', 'failed');
    return {
      success: false,
      message: `Initialization failed: ${error}`,
      offlineReady: false
    };
  }
};

/**
 * Essential offline cleanup
 * Cleans up offline data when needed
 */
export const cleanupOfflineEssentials = async (): Promise<void> => {
  try {
    console.log('🧹 Cleaning up offline essentials...');
    
    // Clear sync timestamp
    localStorage.removeItem('lastSync');
    
    console.log('✅ Offline essentials cleaned up');
  } catch (error) {
    console.error('❌ Failed to cleanup offline essentials:', error);
  }
};

/**
 * Get offline course data for a specific course
 */
export const getOfflineCourseData = async (courseId: string): Promise<{
  course: any;
  modules: any[];
  progress: any;
} | null> => {
  try {
    console.log('📚 Getting offline course data for:', courseId);
    
    // Get cached course
    const course = await getCourseOffline(courseId);
    if (!course) {
      console.log('Course not found in offline cache:', courseId);
      return null;
    }
    
    // Get cached modules for this course
    let modules = await getCachedModulesByCourse(courseId);
    console.log(`📖 Found ${modules.length} cached modules for course`);
    
    // If no modules found, return empty array instead of creating demo modules
    if (modules.length === 0) {
      console.log('⚠️ No real cached modules found for course. Only modules accessed while online are available offline.');
      modules = [];
    }
    
    // Get cached user progress
    const userId = localStorage.getItem('currentUserId');
    let progress = null;
    if (userId) {
      try {
        progress = await getCourseProgress(userId, courseId);
      } catch (error) {
        console.warn('Failed to get offline progress:', error);
        // Create basic progress data
        progress = {
          completedLessons: 0,
          totalLessons: modules.length,
          overallProgress: 0,
          completedModules: 0,
          totalModules: modules.length,
          completedQuizzes: 0,
          totalQuizzes: modules.filter(m => m.hasQuiz).length,
          averageScore: 0
        };
      }
    }
    
    console.log(`✅ Successfully retrieved offline course data: ${course.title} with ${modules.length} modules`);
    
    return {
      course,
      modules,
      progress
    };
  } catch (error) {
    console.error('Failed to get offline course data:', error);
    return null;
  }
};

/**
 * Get cached modules by course ID
 */
export const getCachedModulesByCourse = async (courseId: string): Promise<any[]> => {
  try {
    const { getPouchDB } = await import('./db');
    const db = await getPouchDB();
    
    if (!db) {
      console.warn('Database not available for module cache');
      return [];
    }
    
    const result = await db.allDocs({
      include_docs: true,
      startkey: 'module_',
      endkey: 'module_\ufff0'
    });
    
    return result.rows
      .map((row: any) => row.doc?.module || row.doc)
      .filter((module: any) => module && module.courseId === courseId)
      .sort((a: any, b: any) => a.order - b.order);
  } catch (error) {
    console.error('Failed to get cached modules by course:', error);
    return [];
  }
};

/**
 * Comprehensive offline system test
 * Tests all components of the offline system
 */
export const testOfflineSystem = async (): Promise<{
  success: boolean;
  results: {
    database: boolean;
    cacheService: boolean;
    localStorage: boolean;
    serviceWorker: boolean;
    courses: number;
    modules: number;
    users: number;
    pdfs: number;
  };
  message: string;
}> => {
  const results = {
    database: false,
    cacheService: false,
    localStorage: false,
    serviceWorker: false,
    courses: 0,
    modules: 0,
    users: 0,
    pdfs: 0
  };
  
  try {
    console.log('🧪 Testing offline system...');
    
    // Test database
    try {
      const { getPouchDB } = await import('./db');
      const db = await getPouchDB();
      if (db) {
        const dbInfo = await db.info();
        console.log('✅ Database test passed:', dbInfo);
        results.database = true;
      }
    } catch (error) {
      console.error('❌ Database test failed:', error);
    }
    
    // Test cache service
    try {
      const { getCachedCourses, getCachedModules, getAllCachedUsers, getCachedPdfsByCourse } = await import('./cacheService');
      const courses = await getCachedCourses();
      const modules = await getCachedModules();
      const users = await getAllCachedUsers();
      
      // Count PDFs across all courses
      let totalPdfs = 0;
      for (const course of courses) {
        const courseId = course.id || course._id;
        if (courseId) {
          const coursePdfs = await getCachedPdfsByCourse(courseId);
          totalPdfs += coursePdfs.length;
        }
      }
      
      results.courses = courses.length;
      results.modules = modules.length;
      results.users = users.length;
      results.pdfs = totalPdfs;
      results.cacheService = true;
      
      console.log(`✅ Cache service test passed: ${courses.length} courses, ${modules.length} modules, ${users.length} users, ${totalPdfs} PDFs`);
    } catch (error) {
      console.error('❌ Cache service test failed:', error);
    }
    
    // Test localStorage
    try {
      const testKey = 'offline_test_' + Date.now();
      localStorage.setItem(testKey, 'test');
      const testValue = localStorage.getItem(testKey);
      localStorage.removeItem(testKey);
      
      if (testValue === 'test') {
        results.localStorage = true;
        console.log('✅ localStorage test passed');
      }
    } catch (error) {
      console.error('❌ localStorage test failed:', error);
    }
    
    // Test service worker
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration && registration.active) {
          results.serviceWorker = true;
          console.log('✅ Service Worker test passed');
        }
      }
    } catch (error) {
      console.error('❌ Service Worker test failed:', error);
    }
    
    const success = results.database && results.cacheService && results.localStorage;
    
    return {
      success,
      results,
      message: success 
        ? `Offline system ready (${results.courses} courses, ${results.modules} modules, ${results.pdfs} PDFs cached)`
        : 'Offline system has issues - check console for details'
    };
  } catch (error) {
    console.error('❌ Offline system test failed:', error);
    return {
      success: false,
      results,
      message: `Test failed: ${error}`
    };
  }
}; 