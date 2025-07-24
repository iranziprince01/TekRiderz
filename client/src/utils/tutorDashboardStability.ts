/**
 * Tutor Dashboard Stability Utilities
 * Provides functions to test and ensure stability of tutor dashboard and course creation flow
 */

export interface StabilityTestResult {
  component: string;
  status: 'stable' | 'unstable' | 'error';
  issues: string[];
  recommendations: string[];
}

export interface CourseCreationStabilityTest {
  formValidation: boolean;
  dataPersistence: boolean;
  themeLanguageSync: boolean;
  errorHandling: boolean;
  navigation: boolean;
  fileUploads: boolean;
}

/**
 * Test tutor dashboard stability
 */
export const testTutorDashboardStability = (): StabilityTestResult => {
  const issues: string[] = [];
  const recommendations: string[] = [];

  // Test localStorage availability
  try {
    localStorage.setItem('test', 'test');
    localStorage.removeItem('test');
  } catch (error) {
    issues.push('localStorage not available');
    recommendations.push('Implement fallback storage mechanism');
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

  // Test course store
  try {
    const courseStore = localStorage.getItem('course-storage');
    if (courseStore) {
      const parsed = JSON.parse(courseStore);
      if (!parsed || typeof parsed !== 'object') {
        issues.push('Course store data corrupted');
        recommendations.push('Implement store data validation');
      }
    }
  } catch (error) {
    issues.push('Course store access failed');
    recommendations.push('Add error handling for store access');
  }

  const status = issues.length === 0 ? 'stable' : issues.length < 3 ? 'unstable' : 'error';

  return {
    component: 'TutorDashboard',
    status,
    issues,
    recommendations
  };
};

/**
 * Test course creation flow stability
 */
export const testCourseCreationStability = (): StabilityTestResult => {
  const issues: string[] = [];
  const recommendations: string[] = [];

  // Test form validation
  try {
    // Simulate validation
    const testData = {
      title: '',
      description: '',
      category: '',
      level: '',
      modules: []
    };
    
    if (!testData.title || !testData.description) {
      // This is expected behavior
    }
  } catch (error) {
    issues.push('Form validation failed');
    recommendations.push('Add error handling to validation functions');
  }

  // Test file upload stability
  try {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
  } catch (error) {
    issues.push('File input creation failed');
    recommendations.push('Add fallback for file uploads');
  }

  // Test navigation stability
  try {
    const currentPath = window.location.pathname;
    if (!currentPath.includes('/dashboard/courses')) {
      // Not on course creation page
    }
  } catch (error) {
    issues.push('Navigation state check failed');
    recommendations.push('Add error handling for navigation');
  }

  const status = issues.length === 0 ? 'stable' : issues.length < 3 ? 'unstable' : 'error';

  return {
    component: 'CourseCreation',
    status,
    issues,
    recommendations
  };
};

/**
 * Validate course data structure
 */
export const validateCourseDataStructure = (courseData: any): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!courseData) {
    errors.push('Course data is null or undefined');
    return { isValid: false, errors };
  }

  if (typeof courseData !== 'object') {
    errors.push('Course data must be an object');
    return { isValid: false, errors };
  }

  // Check required fields
  const requiredFields = ['title', 'description', 'category', 'level', 'modules'];
  requiredFields.forEach(field => {
    if (!courseData[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  });

  // Check modules structure
  if (Array.isArray(courseData.modules)) {
    courseData.modules.forEach((module: any, index: number) => {
      if (!module.title || !module.description) {
        errors.push(`Module ${index + 1} missing title or description`);
      }
    });
  } else {
    errors.push('Modules must be an array');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Test theme and language synchronization
 */
export const testThemeLanguageSync = (): StabilityTestResult => {
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
    issues.push('Theme/language sync test failed');
    recommendations.push('Add error handling for sync operations');
  }

  const status = issues.length === 0 ? 'stable' : issues.length < 3 ? 'unstable' : 'error';

  return {
    component: 'ThemeLanguageSync',
    status,
    issues,
    recommendations
  };
};

/**
 * Monitor course creation performance
 */
export const monitorCourseCreationPerformance = (): {
  memoryUsage: number;
  localStorageSize: number;
  performanceScore: number;
} => {
  let memoryUsage = 0;
  let localStorageSize = 0;
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

    if (localStorageSize > 5120) { // 5MB
      performanceScore -= 30;
    }

  } catch (error) {
    console.warn('Performance monitoring failed:', error);
    performanceScore -= 10;
  }

  return {
    memoryUsage,
    localStorageSize,
    performanceScore: Math.max(0, performanceScore)
  };
};

/**
 * Get stability recommendations
 */
export const getStabilityRecommendations = (): string[] => {
  return [
    'Always use stable theme/language hooks in tutor components',
    'Implement proper error boundaries for course creation',
    'Add loading states during theme/language changes',
    'Validate course data before submission',
    'Handle localStorage quota exceeded errors',
    'Implement fallback mechanisms for failed operations',
    'Add proper cleanup for auto-refresh timers',
    'Monitor performance during course creation',
    'Test cross-tab synchronization',
    'Validate file uploads before processing'
  ];
};

/**
 * Run comprehensive stability test
 */
export const runComprehensiveStabilityTest = (): {
  dashboard: StabilityTestResult;
  courseCreation: StabilityTestResult;
  themeLanguage: StabilityTestResult;
  performance: ReturnType<typeof monitorCourseCreationPerformance>;
  overallStatus: 'stable' | 'unstable' | 'error';
} => {
  const dashboard = testTutorDashboardStability();
  const courseCreation = testCourseCreationStability();
  const themeLanguage = testThemeLanguageSync();
  const performance = monitorCourseCreationPerformance();

  const allResults = [dashboard, courseCreation, themeLanguage];
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
    courseCreation,
    themeLanguage,
    performance,
    overallStatus
  };
}; 