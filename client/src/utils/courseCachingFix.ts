// Course Caching Fix for TekRiders
// This script addresses issues where specific courses are not cached for offline access

export interface CourseCachingFixResult {
  success: boolean;
  message: string;
  details: {
    coursesCached: number;
    coursesFound: number;
    missingCourses: (string | undefined)[];
    cacheImproved: boolean;
  };
}

/**
 * Fix course caching issues
 */
export const fixCourseCaching = async (): Promise<CourseCachingFixResult> => {
  const result = {
    coursesCached: 0,
    coursesFound: 0,
    missingCourses: [] as (string | undefined)[],
    cacheImproved: false
  };

  try {
    console.log('🔧 Starting course caching fix...');

    // Step 1: Check current cached courses
    console.log('📚 Step 1: Checking current cached courses...');
    const { getCachedCourses } = await import('../offline/cacheService');
    const cachedCourses = await getCachedCourses();
    
    result.coursesFound = cachedCourses.length;
    console.log(`📚 Found ${cachedCourses.length} cached courses`);

    // Step 2: Check enrolled courses
    console.log('📚 Step 2: Checking enrolled courses...');
    const { getEnrolledCoursesOffline } = await import('../offline/cacheService');
    const enrolledCourses = await getEnrolledCoursesOffline();
    
    console.log(`📚 Found ${enrolledCourses.length} enrolled courses`);

    // Step 3: Identify missing courses
    console.log('🔍 Step 3: Identifying missing courses...');
    const cachedCourseIds = cachedCourses.map(c => c._id || c.id);
    const missingCourses = enrolledCourses.filter(course => 
      !cachedCourseIds.includes(course._id || course.id)
    );
    
    result.missingCourses = missingCourses.map(c => c._id || c.id).filter((id): id is string => id !== undefined);
    console.log(`⚠️ Found ${missingCourses.length} missing courses`);

    // Step 4: Cache missing courses if online
    if (missingCourses.length > 0 && navigator.onLine) {
      console.log('🌐 Step 4: Caching missing courses (online mode)...');
      
      try {
        const { cacheCourse } = await import('../offline/cacheService');
        
        for (const course of missingCourses) {
          try {
            await cacheCourse(course);
            result.coursesCached++;
            console.log(`✅ Cached course: ${course.title}`);
          } catch (error) {
            console.warn(`⚠️ Failed to cache course ${course.title}:`, error);
          }
        }
        
        result.cacheImproved = true;
      } catch (error) {
        console.warn('⚠️ Failed to cache missing courses:', error);
      }
    } else if (missingCourses.length > 0 && !navigator.onLine) {
      console.log('🔌 Step 4: Cannot cache missing courses - offline mode');
      console.log('💡 Please connect online to cache missing courses');
    }

    // Step 5: Improve existing cache
    console.log('🔄 Step 5: Improving existing cache...');
    try {
      const { refreshEnrolledCoursesCache } = await import('../offline/cacheService');
      
      // Get current user ID
      const currentUserId = localStorage.getItem('currentUserId');
      if (currentUserId) {
        const refreshResult = await refreshEnrolledCoursesCache(currentUserId);
        console.log(`🔄 Cache refresh result: ${refreshResult.message}`);
        result.cacheImproved = true;
      }
    } catch (error) {
      console.warn('⚠️ Failed to refresh cache:', error);
    }

    console.log('✅ Course caching fix completed');
    
    return {
      success: true,
      message: `Course caching fix completed. Found ${result.coursesFound} courses, cached ${result.coursesCached} missing courses, ${result.missingCourses.length} still missing.`,
      details: result
    };

  } catch (error) {
    console.error('❌ Course caching fix failed:', error);
    return {
      success: false,
      message: `Course caching fix failed: ${error}`,
      details: result
    };
  }
};

/**
 * Force cache a specific course
 */
export const forceCacheCourse = async (courseId: string): Promise<{
  success: boolean;
  message: string;
}> => {
  try {
    console.log(`🔧 Force caching course: ${courseId}`);
    
    if (!navigator.onLine) {
      return {
        success: false,
        message: 'Cannot cache course while offline. Please connect online first.'
      };
    }

    // Try to fetch course from API
    const { apiClient } = await import('../utils/api');
    const courseResponse = await apiClient.getCourse(courseId);
    
    if (courseResponse.success && courseResponse.data) {
      const course = courseResponse.data.course || courseResponse.data;
      
      // Cache the course
      const { cacheCourse } = await import('../offline/cacheService');
      await cacheCourse(course);
      
      console.log(`✅ Successfully cached course: ${course.title}`);
      
      return {
        success: true,
        message: `Successfully cached course: ${course.title}`
      };
    } else {
      return {
        success: false,
        message: `Failed to fetch course from API: ${courseResponse.error}`
      };
    }

  } catch (error) {
    console.error('❌ Force cache course failed:', error);
    return {
      success: false,
      message: `Force cache course failed: ${error}`
    };
  }
};

/**
 * Check course availability in cache
 */
export const checkCourseAvailability = async (courseId: string): Promise<{
  available: boolean;
  cached: boolean;
  enrolled: boolean;
  message: string;
}> => {
  try {
    console.log(`🔍 Checking availability for course: ${courseId}`);
    
    // Check if course is cached
    const { getCourseOffline } = await import('../offline/cacheService');
    const cachedCourse = await getCourseOffline(courseId);
    
    if (cachedCourse) {
      console.log(`✅ Course found in cache: ${cachedCourse.title}`);
      return {
        available: true,
        cached: true,
        enrolled: cachedCourse.isEnrolled || false,
        message: `Course available offline: ${cachedCourse.title}`
      };
    }
    
    // Check if course is in enrolled courses
    const { getEnrolledCoursesOffline } = await import('../offline/cacheService');
    const enrolledCourses = await getEnrolledCoursesOffline();
    const enrolledCourse = enrolledCourses.find(c => 
      (c._id || c.id) === courseId || 
      (c._id || c.id) === courseId.replace('course_', '')
    );
    
    if (enrolledCourse) {
      console.log(`⚠️ Course found in enrolled courses but not cached: ${enrolledCourse.title}`);
      return {
        available: false,
        cached: false,
        enrolled: true,
        message: `Course is enrolled but not cached. Please connect online to cache it.`
      };
    }
    
    console.log(`❌ Course not found in cache or enrolled courses: ${courseId}`);
    return {
      available: false,
      cached: false,
      enrolled: false,
      message: `Course not available offline. Please connect online to access it.`
    };

  } catch (error) {
    console.error('❌ Check course availability failed:', error);
    return {
      available: false,
      cached: false,
      enrolled: false,
      message: `Failed to check course availability: ${error}`
    };
  }
};

/**
 * Get list of available offline courses
 */
export const getAvailableOfflineCourses = async (): Promise<{
  success: boolean;
  courses: any[];
  message: string;
}> => {
  try {
    console.log('📚 Getting available offline courses...');
    
    const { getCachedCourses } = await import('../offline/cacheService');
    const cachedCourses = await getCachedCourses();
    
    const availableCourses = cachedCourses.filter(course => 
      course.isEnrolled || 
      course.enrollment || 
      course.offlineAccessible ||
      course.status === 'enrolled' ||
      course.status === 'active'
    );
    
    console.log(`📚 Found ${availableCourses.length} available offline courses`);
    
    return {
      success: true,
      courses: availableCourses,
      message: `Found ${availableCourses.length} courses available offline`
    };

  } catch (error) {
    console.error('❌ Get available offline courses failed:', error);
    return {
      success: false,
      courses: [],
      message: `Failed to get available offline courses: ${error}`
    };
  }
};

// Expose functions for browser console
(window as any).fixCourseCaching = fixCourseCaching;
(window as any).forceCacheCourse = forceCacheCourse;
(window as any).checkCourseAvailability = checkCourseAvailability;
(window as any).getAvailableOfflineCourses = getAvailableOfflineCourses; 