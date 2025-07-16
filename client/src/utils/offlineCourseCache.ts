/**
 * Simple course cache using localStorage
 * Basic offline course caching functionality
 */

export const offlineCourseCache = {
  // Cache a course
  cacheeCourse: async (courseId: string, courseData: any): Promise<void> => {
    try {
      const key = `cached_course_${courseId}`;
      const cacheData = {
        ...courseData,
        cachedAt: Date.now()
      };
      localStorage.setItem(key, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to cache course:', error);
    }
  },

  // Get cached course
  getCachedCourse: async (courseId: string): Promise<any | null> => {
    try {
      const key = `cached_course_${courseId}`;
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      return null;
    }
  },

  // Remove cached course
  removeCachedCourse: async (courseId: string): Promise<void> => {
    try {
      const key = `cached_course_${courseId}`;
      localStorage.removeItem(key);
    } catch (error) {
      console.warn('Failed to remove cached course:', error);
    }
  },

  // Get all cached courses
  getAllCachedCourses: async (): Promise<any[]> => {
    try {
      const courses = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('cached_course_')) {
          const data = localStorage.getItem(key);
          if (data) {
            courses.push(JSON.parse(data));
          }
        }
      }
      return courses;
    } catch (error) {
      return [];
    }
  }
}; 