// Offline Course Loading Fix for TekRiders
// This script specifically addresses the issue where My Courses page doesn't display cached courses when offline

export interface OfflineCourseFixResult {
  success: boolean;
  message: string;
  details: {
    userLoaded: boolean;
    coursesLoaded: boolean;
    cacheCleared: boolean;
    authFixed: boolean;
  };
}

/**
 * Fix offline course loading issues
 */
export const fixOfflineCourseLoading = async (): Promise<OfflineCourseFixResult> => {
  const result = {
    userLoaded: false,
    coursesLoaded: false,
    cacheCleared: false,
    authFixed: false
  };

  try {
    console.log('🔧 Starting offline course loading fix...');

    // Step 1: Check if we're offline
    const isOffline = !navigator.onLine;
    console.log('🌐 Connection status:', isOffline ? 'Offline' : 'Online');

    // Step 2: Fix auth state
    console.log('🔐 Step 2: Fixing auth state...');
    try {
      // Check localStorage for user data
      const currentUserId = localStorage.getItem('currentUserId');
      const userRole = localStorage.getItem('userRole');
      const userName = localStorage.getItem('userName');
      const userEmail = localStorage.getItem('userEmail');

      if (currentUserId && userRole && userName && userEmail) {
        console.log('✅ Found user data in localStorage:', userName);
        result.authFixed = true;
      } else {
        console.log('⚠️ No user data found in localStorage');
        
        // Try to get from PouchDB
        try {
          const { getCachedUserData } = await import('../services/offlineSyncService');
          const cachedData = await getCachedUserData();
          
          if (cachedData && cachedData.user) {
            console.log('✅ Found user data in PouchDB:', cachedData.user.name);
            
            // Set in localStorage
            localStorage.setItem('currentUserId', cachedData.user.id);
            localStorage.setItem('userRole', cachedData.user.role);
            localStorage.setItem('userName', cachedData.user.name);
            localStorage.setItem('userEmail', cachedData.user.email);
            localStorage.setItem('userAvatar', cachedData.user.avatar || '');
            localStorage.setItem('userVerified', cachedData.user.verified?.toString() || 'false');
            
            result.authFixed = true;
          }
        } catch (error) {
          console.warn('Failed to get user from PouchDB:', error);
        }
      }
    } catch (error) {
      console.warn('Failed to fix auth state:', error);
    }

    // Step 3: Clear problematic cache entries
    console.log('🧹 Step 3: Clearing problematic cache entries...');
    try {
      const cacheNames = await caches.keys();
      for (const cacheName of cacheNames) {
        if (cacheName.includes('auth') || cacheName.includes('api')) {
          await caches.delete(cacheName);
          console.log('✅ Cleared cache:', cacheName);
        }
      }
      result.cacheCleared = true;
    } catch (error) {
      console.warn('⚠️ Could not clear cache:', error);
    }

    // Step 4: Test course loading
    console.log('📚 Step 4: Testing course loading...');
    try {
      const { getEnrolledCoursesOffline } = await import('../offline/cacheService');
      const courses = await getEnrolledCoursesOffline();
      
      if (courses && courses.length > 0) {
        console.log('✅ Found', courses.length, 'cached courses');
        
        // Filter to only enrolled courses
        const enrolledCourses = courses.filter(course =>
          course.isEnrolled === true ||
          course.enrollment ||
          course.status === 'enrolled' ||
          course.status === 'active'
        );
        
        console.log('✅ Found', enrolledCourses.length, 'enrolled courses');
        result.coursesLoaded = true;
        
        // Store courses in localStorage for immediate access
        localStorage.setItem('cachedEnrolledCourses', JSON.stringify(enrolledCourses));
        console.log('✅ Stored courses in localStorage for immediate access');
      } else {
        console.log('ℹ️ No cached courses found');
      }
    } catch (error) {
      console.warn('⚠️ Could not test course loading:', error);
    }

    // Step 5: Force page refresh if needed
    console.log('🔄 Step 5: Checking if page refresh is needed...');
    const needsRefresh = !result.authFixed || !result.coursesLoaded;
    
    if (needsRefresh && isOffline) {
      console.log('🔄 Page refresh recommended for offline mode');
      console.log('💡 Please refresh the page to see the fix in action');
    }

    console.log('✅ Offline course loading fix completed');
    
    return {
      success: true,
      message: `Offline course loading fix completed. Auth: ${result.authFixed}, Courses: ${result.coursesLoaded}, Cache: ${result.cacheCleared}`,
      details: result
    };

  } catch (error) {
    console.error('❌ Offline course loading fix failed:', error);
    return {
      success: false,
      message: `Offline course loading fix failed: ${error}`,
      details: result
    };
  }
};

/**
 * Quick fix for immediate course loading issues
 */
export const quickCourseFix = async (): Promise<{
  success: boolean;
  message: string;
}> => {
  try {
    console.log('⚡ Running quick course fix...');
    
    // Clear loading state
    localStorage.removeItem('loading');
    localStorage.removeItem('isLoading');
    localStorage.removeItem('authLoading');
    localStorage.removeItem('userLoading');
    
    // Force reload courses from cache
    try {
      const { getEnrolledCoursesOffline } = await import('../offline/cacheService');
      const courses = await getEnrolledCoursesOffline();
      
      if (courses && courses.length > 0) {
        const enrolledCourses = courses.filter(course =>
          course.isEnrolled === true ||
          course.enrollment ||
          course.status === 'enrolled' ||
          course.status === 'active'
        );
        
        localStorage.setItem('cachedEnrolledCourses', JSON.stringify(enrolledCourses));
        console.log('✅ Quick fix: Found and stored', enrolledCourses.length, 'enrolled courses');
      }
    } catch (error) {
      console.warn('⚠️ Could not reload courses:', error);
    }
    
    console.log('✅ Quick course fix completed');
    
    return {
      success: true,
      message: 'Quick course fix completed. Please refresh the page.'
    };

  } catch (error) {
    console.error('❌ Quick course fix failed:', error);
    return {
      success: false,
      message: `Quick course fix failed: ${error}`
    };
  }
};

/**
 * Check if offline course loading is working
 */
export const checkOfflineCourseLoading = async (): Promise<{
  working: boolean;
  issues: string[];
  recommendations: string[];
}> => {
  const issues: string[] = [];
  const recommendations: string[] = [];

  try {
    console.log('🔍 Checking offline course loading status...');

    // Check if we're offline
    if (navigator.onLine) {
      issues.push('Currently online - offline course loading not applicable');
      recommendations.push('Test offline course loading by disconnecting from internet');
      return { working: true, issues, recommendations };
    }

    // Check user authentication
    const currentUserId = localStorage.getItem('currentUserId');
    const userRole = localStorage.getItem('userRole');
    
    if (!currentUserId || !userRole) {
      issues.push('No user authentication found');
      recommendations.push('Login while online to enable offline course access');
    }

    // Check cached courses
    try {
      const { getEnrolledCoursesOffline } = await import('../offline/cacheService');
      const courses = await getEnrolledCoursesOffline();
      
      if (!courses || courses.length === 0) {
        issues.push('No cached courses found');
        recommendations.push('Access courses while online to cache them for offline use');
      } else {
        const enrolledCourses = courses.filter(course =>
          course.isEnrolled === true ||
          course.enrollment ||
          course.status === 'enrolled' ||
          course.status === 'active'
        );
        
        if (enrolledCourses.length === 0) {
          issues.push('No enrolled courses found in cache');
          recommendations.push('Enroll in courses while online to see them offline');
        } else {
          console.log('✅ Found', enrolledCourses.length, 'enrolled courses in cache');
        }
      }
    } catch (error) {
      issues.push('Failed to check cached courses');
      recommendations.push('Check PouchDB status and clear cache if needed');
    }

    const working = issues.length === 0;
    
    console.log(`🔍 Offline course loading check completed. Working: ${working}, Issues: ${issues.length}`);
    
    return {
      working,
      issues,
      recommendations
    };

  } catch (error) {
    console.error('❌ Offline course loading check failed:', error);
    return {
      working: false,
      issues: [`Check failed: ${error}`],
      recommendations: ['Refresh the page and try again']
    };
  }
};

// Expose functions for browser console
(window as any).fixOfflineCourseLoading = fixOfflineCourseLoading;
(window as any).quickCourseFix = quickCourseFix;
(window as any).checkOfflineCourseLoading = checkOfflineCourseLoading; 