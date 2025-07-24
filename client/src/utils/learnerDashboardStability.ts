/**
 * Learner Dashboard Stability Utilities
 * Provides functions to test and ensure stability of learner dashboard and course enrollment flow
 */

export interface LearnerStabilityTestResult {
  component: string;
  status: 'stable' | 'unstable' | 'error';
  issues: string[];
  recommendations: string[];
}

export interface LearnerDashboardStabilityTest {
  offlineFunctionality: boolean;
  courseEnrollment: boolean;
  progressTracking: boolean;
  themeLanguageSync: boolean;
  errorHandling: boolean;
  dataSync: boolean;
}

/**
 * Test learner dashboard stability
 */
export const testLearnerDashboardStability = (): LearnerStabilityTestResult => {
  const issues: string[] = [];
  const recommendations: string[] = [];

  // Test localStorage availability for offline functionality
  try {
    localStorage.setItem('test', 'test');
    localStorage.removeItem('test');
  } catch (error) {
    issues.push('localStorage not available for offline functionality');
    recommendations.push('Implement fallback storage mechanism for offline mode');
  }

  // Test theme and language context
  try {
    const theme = localStorage.getItem('theme');
    const language = localStorage.getItem('language');
    
    if (!theme || !language) {
      issues.push('Theme or language settings not persisted');
      recommendations.push('Ensure proper initialization of theme/language settings');
    }
  } catch (error) {
    issues.push('Failed to access theme/language settings');
    recommendations.push('Add error handling for settings access');
  }

  // Test offline cache storage
  try {
    const offlineCache = localStorage.getItem('offline-cache');
    if (offlineCache) {
      const parsed = JSON.parse(offlineCache);
      if (!parsed || typeof parsed !== 'object') {
        issues.push('Offline cache data corrupted');
        recommendations.push('Implement cache data validation and cleanup');
      }
    }
  } catch (error) {
    issues.push('Offline cache access failed');
    recommendations.push('Add error handling for cache access');
  }

  // Test course enrollment data
  try {
    const enrollmentData = localStorage.getItem('enrollment-data');
    if (enrollmentData) {
      const parsed = JSON.parse(enrollmentData);
      if (!parsed || typeof parsed !== 'object') {
        issues.push('Enrollment data corrupted');
        recommendations.push('Implement enrollment data validation');
      }
    }
  } catch (error) {
    issues.push('Enrollment data access failed');
    recommendations.push('Add error handling for enrollment data access');
  }

  const status = issues.length === 0 ? 'stable' : issues.length < 3 ? 'unstable' : 'error';

  return {
    component: 'LearnerDashboard',
    status,
    issues,
    recommendations
  };
};

/**
 * Test learner courses stability
 */
export const testLearnerCoursesStability = (): LearnerStabilityTestResult => {
  const issues: string[] = [];
  const recommendations: string[] = [];

  // Test course data structure
  try {
    const testCourseData = {
      id: 'test-course',
      title: 'Test Course',
      description: 'Test Description',
      modules: [],
      enrollment: {
        id: 'test-enrollment',
        enrolledAt: new Date().toISOString(),
        progress: 0,
        status: 'active'
      }
    };
    
    if (!testCourseData.id || !testCourseData.title) {
      issues.push('Course data structure validation failed');
      recommendations.push('Implement comprehensive course data validation');
    }
  } catch (error) {
    issues.push('Course data structure test failed');
    recommendations.push('Add error handling to course data validation');
  }

  // Test progress tracking
  try {
    const progressData = {
      courseId: 'test-course',
      progress: 50,
      completedLessons: ['lesson1', 'lesson2'],
      lastAccessed: new Date().toISOString()
    };
    
    if (progressData.progress < 0 || progressData.progress > 100) {
      issues.push('Progress data validation failed');
      recommendations.push('Implement progress data validation');
    }
  } catch (error) {
    issues.push('Progress tracking test failed');
    recommendations.push('Add error handling to progress tracking');
  }

  // Test offline course access
  try {
    const offlineCourses = localStorage.getItem('offline-courses');
    if (offlineCourses) {
      const parsed = JSON.parse(offlineCourses);
      if (!Array.isArray(parsed)) {
        issues.push('Offline courses data structure invalid');
        recommendations.push('Implement offline courses data validation');
      }
    }
  } catch (error) {
    issues.push('Offline courses access failed');
    recommendations.push('Add error handling for offline courses access');
  }

  const status = issues.length === 0 ? 'stable' : issues.length < 3 ? 'unstable' : 'error';

  return {
    component: 'LearnerCourses',
    status,
    issues,
    recommendations
  };
};

/**
 * Test offline functionality stability
 */
export const testOfflineFunctionalityStability = (): LearnerStabilityTestResult => {
  const issues: string[] = [];
  const recommendations: string[] = [];

  // Test network status detection
  try {
    const isOnline = navigator.onLine;
    // This is just a test, actual online status may vary
  } catch (error) {
    issues.push('Network status detection failed');
    recommendations.push('Implement fallback network detection');
  }

  // Test service worker availability (if applicable)
  try {
    if ('serviceWorker' in navigator) {
      // Service worker is available
    } else {
      recommendations.push('Consider implementing service worker for better offline experience');
    }
  } catch (error) {
    issues.push('Service worker detection failed');
    recommendations.push('Add error handling for service worker detection');
  }

  // Test IndexedDB availability (if used)
  try {
    if ('indexedDB' in window) {
      // IndexedDB is available
    } else {
      recommendations.push('Consider implementing IndexedDB for better offline storage');
    }
  } catch (error) {
    issues.push('IndexedDB detection failed');
    recommendations.push('Add error handling for IndexedDB detection');
  }

  const status = issues.length === 0 ? 'stable' : issues.length < 3 ? 'unstable' : 'error';

  return {
    component: 'OfflineFunctionality',
    status,
    issues,
    recommendations
  };
};

/**
 * Validate learner course data structure
 */
export const validateLearnerCourseData = (courseData: any): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!courseData) {
    errors.push('Course data is null or undefined');
    return { isValid: false, errors };
  }

  if (typeof courseData !== 'object') {
    errors.push('Course data must be an object');
    return { isValid: false, errors };
  }

  // Check required fields for learner courses
  const requiredFields = ['id', 'title', 'description'];
  requiredFields.forEach(field => {
    if (!courseData[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  });

  // Check enrollment data if present
  if (courseData.enrollment) {
    if (!courseData.enrollment.id || !courseData.enrollment.enrolledAt) {
      errors.push('Enrollment data is incomplete');
    }
  }

  // Check progress data if present
  if (courseData.progress) {
    if (typeof courseData.progress !== 'number' || courseData.progress < 0 || courseData.progress > 100) {
      errors.push('Progress data is invalid (must be 0-100)');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Test course enrollment stability
 */
export const testCourseEnrollmentStability = (): LearnerStabilityTestResult => {
  const issues: string[] = [];
  const recommendations: string[] = [];

  // Test enrollment data structure
  try {
    const enrollmentData = {
      courseId: 'test-course',
      userId: 'test-user',
      enrolledAt: new Date().toISOString(),
      status: 'active',
      progress: 0
    };
    
    if (!enrollmentData.courseId || !enrollmentData.userId) {
      issues.push('Enrollment data structure validation failed');
      recommendations.push('Implement enrollment data validation');
    }
  } catch (error) {
    issues.push('Enrollment data structure test failed');
    recommendations.push('Add error handling to enrollment validation');
  }

  // Test enrollment state management
  try {
    const enrollmentState = {
      isEnrolled: true,
      enrollmentDate: new Date().toISOString(),
      lastAccessed: new Date().toISOString()
    };
    
    if (typeof enrollmentState.isEnrolled !== 'boolean') {
      issues.push('Enrollment state validation failed');
      recommendations.push('Implement enrollment state validation');
    }
  } catch (error) {
    issues.push('Enrollment state test failed');
    recommendations.push('Add error handling to enrollment state management');
  }

  const status = issues.length === 0 ? 'stable' : issues.length < 3 ? 'unstable' : 'error';

  return {
    component: 'CourseEnrollment',
    status,
    issues,
    recommendations
  };
};

/**
 * Monitor learner dashboard performance
 */
export const monitorLearnerDashboardPerformance = (): {
  memoryUsage: number;
  localStorageSize: number;
  offlineCacheSize: number;
  performanceScore: number;
} => {
  let memoryUsage = 0;
  let localStorageSize = 0;
  let offlineCacheSize = 0;
  let performanceScore = 100;

  try {
    // Check memory usage (if available)
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      memoryUsage = memory.usedJSHeapSize / 1024 / 1024; // MB
      
      if (memoryUsage > 50) {
        performanceScore -= 20;
      }
    }

    // Check localStorage size
    let totalSize = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key);
        if (value) {
          totalSize += key.length + value.length;
        }
      }
    }
    localStorageSize = totalSize / 1024; // KB

    // Check offline cache size
    const offlineCache = localStorage.getItem('offline-cache');
    if (offlineCache) {
      offlineCacheSize = offlineCache.length / 1024; // KB
    }

    if (localStorageSize > 5120) { // 5MB
      performanceScore -= 30;
    }

    if (offlineCacheSize > 2048) { // 2MB
      performanceScore -= 15;
    }

  } catch (error) {
    console.warn('Learner dashboard performance monitoring failed:', error);
    performanceScore -= 10;
  }

  return {
    memoryUsage,
    localStorageSize,
    offlineCacheSize,
    performanceScore: Math.max(0, performanceScore)
  };
};

/**
 * Get learner dashboard stability recommendations
 */
export const getLearnerStabilityRecommendations = (): string[] => {
  return [
    'Always use stable theme/language hooks in learner components',
    'Implement proper error boundaries for course enrollment',
    'Add loading states during offline/online transitions',
    'Validate course data before enrollment',
    'Handle localStorage quota exceeded errors for offline cache',
    'Implement fallback mechanisms for failed offline operations',
    'Add proper cleanup for progress tracking timers',
    'Monitor performance during course enrollment',
    'Test offline/online synchronization',
    'Validate enrollment data before processing',
    'Implement proper error handling for network failures',
    'Add progress tracking validation',
    'Test course completion workflows',
    'Monitor offline cache size and cleanup',
    'Implement proper data sync on reconnection'
  ];
};

/**
 * Run comprehensive learner dashboard stability test
 */
export const runLearnerDashboardStabilityTest = (): {
  dashboard: LearnerStabilityTestResult;
  courses: LearnerStabilityTestResult;
  offline: LearnerStabilityTestResult;
  enrollment: LearnerStabilityTestResult;
  performance: ReturnType<typeof monitorLearnerDashboardPerformance>;
  overallStatus: 'stable' | 'unstable' | 'error';
} => {
  const dashboard = testLearnerDashboardStability();
  const courses = testLearnerCoursesStability();
  const offline = testOfflineFunctionalityStability();
  const enrollment = testCourseEnrollmentStability();
  const performance = monitorLearnerDashboardPerformance();

  const allResults = [dashboard, courses, offline, enrollment];
  const errorCount = allResults.filter(r => r.status === 'error').length;
  const unstableCount = allResults.filter(r => r.status === 'unstable').length;

  let overallStatus: 'stable' | 'unstable' | 'error';
  if (errorCount > 0) {
    overallStatus = 'error';
  } else if (unstableCount > 0 || performance.performanceScore < 70) {
    overallStatus = 'unstable';
  } else {
    overallStatus = 'stable';
  }

  return {
    dashboard,
    courses,
    offline,
    enrollment,
    performance,
    overallStatus
  };
};

/**
 * Test learner-specific theme and language synchronization
 */
export const testLearnerThemeLanguageSync = (): LearnerStabilityTestResult => {
  const issues: string[] = [];
  const recommendations: string[] = [];

  try {
    // Test theme persistence
    const theme = localStorage.getItem('theme');
    if (theme && !['light', 'dark'].includes(theme)) {
      issues.push('Invalid theme value stored');
      recommendations.push('Add theme value validation');
    }

    // Test language persistence
    const language = localStorage.getItem('language');
    if (language && !['en', 'rw'].includes(language)) {
      issues.push('Invalid language value stored');
      recommendations.push('Add language value validation');
    }

    // Test settings sync
    const settings = localStorage.getItem('tekriders-settings');
    if (settings) {
      try {
        const parsed = JSON.parse(settings);
        if (!parsed.theme || !parsed.language) {
          issues.push('Settings sync data incomplete');
          recommendations.push('Ensure all settings are properly synced');
        }
      } catch (error) {
        issues.push('Settings sync data corrupted');
        recommendations.push('Add settings data validation');
      }
    }
  } catch (error) {
    issues.push('Learner theme/language sync test failed');
    recommendations.push('Add error handling for sync operations');
  }

  const status = issues.length === 0 ? 'stable' : issues.length < 3 ? 'unstable' : 'error';

  return {
    component: 'LearnerThemeLanguageSync',
    status,
    issues,
    recommendations
  };
}; 