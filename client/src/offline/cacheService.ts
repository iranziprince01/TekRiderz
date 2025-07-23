import { localDB } from './db';

// User interface matching the one in AuthContext
interface User {
  id: string;
  name: string;
  email: string;
  role: 'learner' | 'tutor' | 'admin';
  avatar: string | null;
  verified: boolean;
  profile?: any;
  preferences?: any;
  lastLogin?: string;
}

// Course interface for caching
interface Course {
  _id: string;
  id?: string;
  title: string;
  description: string;
  thumbnail?: string;
  instructorId: string;
  instructorName: string;
  totalDuration?: number;
  level: string;
  category: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  learningObjectives?: string[];
  enrollment?: {
    id: string;
    enrolledAt: string;
    progress: number;
    status: string;
  } | null;
  progress?: {
    overallProgress?: number;
    percentage?: number;
    completedLessons?: number;
    totalLessons?: number;
  } | null;
  sections?: any[];
  totalModules?: number;
  isEnrolled?: boolean;
  lastCached?: string;
  offlineAccessible?: boolean;
}

// Module interface for caching
interface Module {
  _id: string;
  id: string;
  title: string;
  description: string;
  estimatedDuration: number;
  videoUrl: string;
  videoProvider: 'youtube';
  pdfUrl?: string; // PDF lecture notes URL
  order: number;
  isCompleted: boolean;
  isUnlocked: boolean;
  nextModuleId?: string;
  hasQuiz?: boolean;
  courseId: string; // Reference to parent course
}

// PouchDB document interface for user cache
interface UserCacheDoc {
  _id: string;
  _rev?: string;
  type: 'user';
  userId: string;
  user: User;
  cachedAt: string;
  lastUpdated: string;
}

// PouchDB document interface for course cache
interface CourseCacheDoc {
  _id: string;
  _rev?: string;
  type: 'course';
  courseId: string;
  course: Course;
  cachedAt: string;
  lastUpdated: string;
}

// PouchDB document interface for module cache
interface ModuleCacheDoc {
  _id: string;
  _rev?: string;
  type: 'module';
  moduleId: string;
  module: Module;
  cachedAt: string;
  lastUpdated: string;
}

/**
 * Cache user data in both localStorage and PouchDB for offline access
 * @param user - The user object to cache
 */
export const cacheUser = async (user: User): Promise<void> => {
  try {
    const userId = user.id;
    const pouchId = `user_${userId}`;
    
    // Store basic user info in localStorage for quick access
    localStorage.setItem('currentUserId', userId);
    localStorage.setItem('userName', user.name);
    localStorage.setItem('userEmail', user.email);
    localStorage.setItem('userRole', user.role);
    localStorage.setItem('userAvatar', user.avatar || '');
    localStorage.setItem('userVerified', user.verified.toString());
    
    // Store complete user object in PouchDB for offline access
    try {
      // Check if localDB is available
      if (!localDB || !localDB.put) {
        console.warn('⚠️ LocalDB not available, skipping PouchDB cache');
        return;
      }

      // Check if user document already exists
      let existingDoc;
      try {
        existingDoc = await localDB.get(pouchId);
      } catch (error: any) {
        // Document doesn't exist, which is fine
        if (error.name !== 'not_found') {
          throw error;
        }
      }
      
      const userDoc = {
        _id: pouchId,
        _rev: existingDoc?._rev, // Include revision if updating existing doc
        type: 'user',
        userId: userId,
        user: user,
        cachedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      };
      
      await localDB.put(userDoc);
      console.log(`User cached successfully in PouchDB: ${userId}`);
      
    } catch (pouchError) {
      console.error('Failed to cache user in PouchDB:', pouchError);
      // Don't throw error - localStorage caching is still successful
    }
    
    console.log(`User cached successfully: ${userId}`);
    
  } catch (error) {
    console.error('Failed to cache user:', error);
    // Don't throw error to prevent app crashes
  }
};

/**
 * Retrieve cached user data from localStorage and PouchDB
 * @param userId - The user ID to retrieve
 * @returns The cached user object or null if not found
 */
export const getCachedUser = async (userId: string): Promise<User | null> => {
  try {
    const pouchId = `user_${userId}`;
    
    // Try to get from PouchDB first (more complete data)
    try {
      // Check if localDB is available
      if (!localDB || !localDB.get) {
        console.warn('⚠️ LocalDB not available, using localStorage fallback');
        throw new Error('LocalDB not available');
      }

      const doc = await localDB.get(pouchId) as UserCacheDoc;
      if (doc && doc.user) {
        console.log(`Retrieved user from PouchDB cache: ${userId}`);
        return doc.user;
      }
    } catch (error: any) {
      if (error.name !== 'not_found') {
        console.error('Error retrieving user from PouchDB:', error);
      }
    }
    
    // Fallback to localStorage (basic data)
    const cachedUserId = localStorage.getItem('currentUserId');
    if (cachedUserId === userId) {
      const user: User = {
        id: userId,
        name: localStorage.getItem('userName') || '',
        email: localStorage.getItem('userEmail') || '',
        role: (localStorage.getItem('userRole') as 'learner' | 'tutor' | 'admin') || 'learner',
        avatar: localStorage.getItem('userAvatar') || null,
        verified: localStorage.getItem('userVerified') === 'true',
      };
      
      console.log(`Retrieved user from localStorage cache: ${userId}`);
      return user;
    }
    
    return null;
    
  } catch (error) {
    console.error('Failed to get cached user:', error);
    return null;
  }
};

/**
 * Update cached user data
 * @param user - The updated user object
 */
export const updateCachedUser = async (user: User): Promise<void> => {
  try {
    const userId = user.id;
    const pouchId = `user_${userId}`;
    
    // Update localStorage
    localStorage.setItem('userName', user.name);
    localStorage.setItem('userEmail', user.email);
    localStorage.setItem('userRole', user.role);
    localStorage.setItem('userAvatar', user.avatar || '');
    localStorage.setItem('userVerified', user.verified.toString());
    
    // Update PouchDB
    try {
      let existingDoc;
      try {
        existingDoc = await localDB.get(pouchId);
      } catch (error: any) {
        if (error.name !== 'not_found') {
          throw error;
        }
      }
      
      const userDoc = {
        _id: pouchId,
        _rev: existingDoc?._rev,
        type: 'user',
        userId: userId,
        user: user,
        cachedAt: (existingDoc as UserCacheDoc)?.cachedAt || new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      };
      
      await localDB.put(userDoc);
      console.log(`User updated in PouchDB cache: ${userId}`);
      
    } catch (pouchError) {
      console.error('Failed to update user in PouchDB:', pouchError);
    }
    
    console.log(`User updated successfully: ${userId}`);
    
  } catch (error) {
    console.error('Failed to update cached user:', error);
    throw error;
  }
};

/**
 * Remove cached user data
 * @param userId - The user ID to remove
 */
export const removeCachedUser = async (userId: string): Promise<void> => {
  try {
    const pouchId = `user_${userId}`;
    
    // Remove from localStorage
    const currentUserId = localStorage.getItem('currentUserId');
    if (currentUserId === userId) {
      localStorage.removeItem('currentUserId');
      localStorage.removeItem('userName');
      localStorage.removeItem('userEmail');
      localStorage.removeItem('userRole');
      localStorage.removeItem('userAvatar');
      localStorage.removeItem('userVerified');
    }
    
    // Remove from PouchDB
    try {
      const doc = await localDB.get(pouchId);
      await localDB.remove(doc);
      console.log(`User removed from PouchDB cache: ${userId}`);
    } catch (error: any) {
      if (error.name !== 'not_found') {
        console.error('Failed to remove user from PouchDB:', error);
      }
    }
    
    console.log(`User removed successfully: ${userId}`);
    
  } catch (error) {
    console.error('Failed to remove cached user:', error);
    throw error;
  }
};

/**
 * Check if user is cached
 * @param userId - The user ID to check
 * @returns True if user is cached, false otherwise
 */
export const isUserCached = async (userId: string): Promise<boolean> => {
  try {
    const pouchId = `user_${userId}`;
    
    // Check PouchDB first
    try {
      await localDB.get(pouchId);
      return true;
    } catch (error: any) {
      if (error.name !== 'not_found') {
        console.error('Error checking user in PouchDB:', error);
      }
    }
    
    // Check localStorage
    const cachedUserId = localStorage.getItem('currentUserId');
    return cachedUserId === userId;
    
  } catch (error) {
    console.error('Failed to check if user is cached:', error);
    return false;
  }
};

/**
 * Get all cached users from PouchDB
 * @returns Array of cached users
 */
export const getAllCachedUsers = async (): Promise<User[]> => {
  try {
    const result = await localDB.allDocs({
      include_docs: true,
      startkey: 'user_',
      endkey: 'user_\ufff0'
    });
    
    return result.rows
      .map((row: any) => (row.doc as UserCacheDoc)?.user)
      .filter(Boolean) as User[];
      
  } catch (error) {
    console.error('Failed to get all cached users:', error);
    return [];
  }
};

/**
 * Check if app is in offline mode
 * @returns True if offline, false if online
 */
export const isOfflineMode = (): boolean => {
  return !navigator.onLine;
};

/**
 * Get offline status information
 * @returns Object with offline status details
 */
export const getOfflineStatus = () => {
  return {
    isOffline: !navigator.onLine,
    hasLocalStorage: typeof localStorage !== 'undefined',
    hasIndexedDB: typeof indexedDB !== 'undefined',
    timestamp: new Date().toISOString()
  };
};

/**
 * Cache course data in PouchDB for offline access
 * @param course - The course object to cache
 */
export const cacheCourse = async (course: Course): Promise<void> => {
  try {
    const courseId = course._id || course.id || '';
    const pouchId = `course_${courseId}`;
    
    // Check if course document already exists
    let existingDoc;
    try {
      existingDoc = await localDB.get(pouchId);
    } catch (error: any) {
      if (error.name !== 'not_found') {
        throw error;
      }
    }
    
    // Enhanced course data for offline access
    const enhancedCourse = {
      ...course,
      // Ensure all essential fields are present
      id: courseId,
      _id: courseId,
      title: course.title || 'Untitled Course',
      description: course.description || '',
      instructorName: course.instructorName || 'Unknown Instructor',
      category: course.category || 'General',
      level: course.level || 'Beginner',
      status: course.status || 'published',
      // Preserve enrollment and progress data
      enrollment: course.enrollment || null,
      progress: course.progress || null,
      isEnrolled: course.isEnrolled || false,
      // Cache essential course structure
      sections: course.sections || [],
      totalModules: course.totalModules || course.sections?.length || 0,
      totalDuration: course.totalDuration || 0,
      // Metadata for offline functionality
      lastCached: new Date().toISOString(),
      offlineAccessible: true
    };
    
    const courseDoc: CourseCacheDoc = {
      _id: pouchId,
      _rev: existingDoc?._rev,
      type: 'course',
      courseId: courseId,
      course: enhancedCourse,
      cachedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };
    
    await localDB.put(courseDoc);
    console.log(`📚 Course cached for offline access: ${courseId} - ${enhancedCourse.title}`);
    
  } catch (error) {
    console.error('Failed to cache course:', error);
    throw error;
  }
};

/**
 * Get cached course from PouchDB
 * @param courseId - The course ID to retrieve
 * @returns The cached course object or null if not found
 */
export const getCachedCourse = async (courseId: string): Promise<Course | null> => {
  try {
    const pouchId = `course_${courseId}`;
    const doc = await localDB.get(pouchId) as CourseCacheDoc;
    return doc?.course || null;
  } catch (error: any) {
    if (error.name !== 'not_found') {
      console.error('Error retrieving course from PouchDB:', error);
    }
    return null;
  }
};

/**
 * Get all cached courses from PouchDB
 * @returns Array of cached courses
 */
export const getCachedCourses = async (): Promise<Course[]> => {
  try {
    const result = await localDB.allDocs({
      include_docs: true,
      startkey: 'course_',
      endkey: 'course_\ufff0'
    });
    
    return result.rows
      .map((row: any) => (row.doc as CourseCacheDoc)?.course)
      .filter(Boolean) as Course[];
      
  } catch (error) {
    console.error('Failed to get all cached courses:', error);
    return [];
  }
};

/**
 * Update cached course data
 * @param course - The updated course object
 */
export const updateCachedCourse = async (course: Course): Promise<void> => {
  try {
    const courseId = course._id || course.id || '';
    const pouchId = `course_${courseId}`;
    
    let existingDoc;
    try {
      existingDoc = await localDB.get(pouchId);
    } catch (error: any) {
      if (error.name !== 'not_found') {
        throw error;
      }
    }
    
          const courseDoc: CourseCacheDoc = {
        _id: pouchId,
        _rev: existingDoc?._rev,
        type: 'course',
        courseId: courseId,
        course: course,
        cachedAt: (existingDoc as CourseCacheDoc)?.cachedAt || new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      };
    
    await localDB.put(courseDoc);
    console.log(`Course updated successfully: ${courseId}`);
    
  } catch (error) {
    console.error('Failed to update cached course:', error);
    throw error;
  }
};

/**
 * Remove cached course data
 * @param courseId - The course ID to remove
 */
export const removeCachedCourse = async (courseId: string): Promise<void> => {
  try {
    const pouchId = `course_${courseId}`;
    const doc = await localDB.get(pouchId);
    await localDB.remove(doc);
    console.log(`Course removed successfully: ${courseId}`);
  } catch (error: any) {
    if (error.name !== 'not_found') {
      console.error('Failed to remove cached course:', error);
      throw error;
    }
  }
};

/**
 * Cache module data in PouchDB for offline access
 * @param module - The module object to cache
 */
export const cacheModule = async (module: Module): Promise<void> => {
  try {
    const moduleId = module._id || module.id || '';
    const pouchId = `module_${moduleId}`;
    
    let existingDoc;
    try {
      existingDoc = await localDB.get(pouchId);
    } catch (error: any) {
      if (error.name !== 'not_found') {
        throw error;
      }
    }
    
    const moduleDoc: ModuleCacheDoc = {
      _id: pouchId,
      _rev: existingDoc?._rev,
      type: 'module',
      moduleId: moduleId,
      module: module,
      cachedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };
    
    await localDB.put(moduleDoc);
    console.log(`Module cached successfully: ${moduleId}`);
    
  } catch (error) {
    console.error('Failed to cache module:', error);
    throw error;
  }
};

/**
 * Get cached module from PouchDB
 * @param moduleId - The module ID to retrieve
 * @returns The cached module object or null if not found
 */
export const getCachedModule = async (moduleId: string): Promise<Module | null> => {
  try {
    const pouchId = `module_${moduleId}`;
    const doc = await localDB.get(pouchId) as ModuleCacheDoc;
    return doc?.module || null;
  } catch (error: any) {
    if (error.name !== 'not_found') {
      console.error('Error retrieving module from PouchDB:', error);
    }
    return null;
  }
};

/**
 * Get all cached modules from PouchDB
 * @returns Array of cached modules
 */
export const getCachedModules = async (): Promise<Module[]> => {
  try {
    const result = await localDB.allDocs({
      include_docs: true,
      startkey: 'module_',
      endkey: 'module_\ufff0'
    });
    
    return result.rows
      .map((row: any) => (row.doc as ModuleCacheDoc)?.module)
      .filter(Boolean) as Module[];
      
  } catch (error) {
    console.error('Failed to get all cached modules:', error);
    return [];
  }
};

/**
 * Get cached modules by course ID
 * @param courseId - The course ID to filter by
 * @returns Array of cached modules for the course
 */
export const getCachedModulesByCourse = async (courseId: string): Promise<Module[]> => {
  try {
    const allModules = await getCachedModules();
    return allModules.filter(module => module.courseId === courseId);
  } catch (error) {
    console.error('Failed to get cached modules by course:', error);
    return [];
  }
};

/**
 * Update cached module data
 * @param module - The updated module object
 */
export const updateCachedModule = async (module: Module): Promise<void> => {
  try {
    const moduleId = module._id || module.id || '';
    const pouchId = `module_${moduleId}`;
    
    let existingDoc;
    try {
      existingDoc = await localDB.get(pouchId);
    } catch (error: any) {
      if (error.name !== 'not_found') {
        throw error;
      }
    }
    
          const moduleDoc: ModuleCacheDoc = {
        _id: pouchId,
        _rev: existingDoc?._rev,
        type: 'module',
        moduleId: moduleId,
        module: module,
        cachedAt: (existingDoc as ModuleCacheDoc)?.cachedAt || new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      };
    
    await localDB.put(moduleDoc);
    console.log(`Module updated successfully: ${moduleId}`);
    
  } catch (error) {
    console.error('Failed to update cached module:', error);
    throw error;
  }
};

/**
 * Remove cached module data
 * @param moduleId - The module ID to remove
 */
export const removeCachedModule = async (moduleId: string): Promise<void> => {
  try {
    const pouchId = `module_${moduleId}`;
    const doc = await localDB.get(pouchId);
    await localDB.remove(doc);
    console.log(`Module removed successfully: ${moduleId}`);
  } catch (error: any) {
    if (error.name !== 'not_found') {
      console.error('Failed to remove cached module:', error);
      throw error;
    }
  }
};

/**
 * Clear all cached modules
 */
export const clearAllCachedModules = async (): Promise<void> => {
  try {
    const result = await localDB.allDocs({
      startkey: 'module_',
      endkey: 'module_\ufff0'
    });
    
    const deletePromises = result.rows.map((row: any) => 
      localDB.remove(row.id, row.value.rev)
    );
    
    await Promise.all(deletePromises);
    console.log('All cached modules cleared successfully');
    
  } catch (error) {
    console.error('Failed to clear all cached modules:', error);
    throw error;
  }
};

/**
 * Clear all cached courses
 */
export const clearAllCachedCourses = async (): Promise<void> => {
  try {
    const result = await localDB.allDocs({
      startkey: 'course_',
      endkey: 'course_\ufff0'
    });
    
    const deletePromises = result.rows.map((row: any) => 
      localDB.remove(row.id, row.value.rev)
    );
    
    await Promise.all(deletePromises);
    console.log('All cached courses cleared successfully');
    
  } catch (error) {
    console.error('Failed to clear all cached courses:', error);
    throw error;
  }
};

/**
 * Clear all cached users
 */
export const clearAllCachedUsers = async (): Promise<void> => {
  try {
    const result = await localDB.allDocs({
      startkey: 'user_',
      endkey: 'user_\ufff0'
    });
    
    const deletePromises = result.rows.map((row: any) => 
      localDB.remove(row.id, row.value.rev)
    );
    
    await Promise.all(deletePromises);
    console.log('All cached users cleared successfully');
    
  } catch (error) {
    console.error('Failed to clear all cached users:', error);
    throw error;
  }
};

// ==================== LEARNER OFFLINE FUNCTIONALITY ====================

/**
 * Get enrolled courses for offline access (learner-specific)
 * @returns Array of enrolled courses with full offline data
 */
export const getEnrolledCoursesOffline = async (): Promise<Course[]> => {
  try {
    const allCourses = await getCachedCourses();
    const enrolledCourses = allCourses.filter(course => 
      course.isEnrolled || course.enrollment || course.status === 'enrolled'
    );
    
    console.log(`📚 Found ${enrolledCourses.length} enrolled courses for offline access`);
    return enrolledCourses;
  } catch (error) {
    console.error('Failed to get enrolled courses for offline access:', error);
    return [];
  }
};

/**
 * Get course details for offline viewing (learner-specific)
 * @param courseId - The course ID to retrieve
 * @returns The course with full offline data or null if not found
 */
export const getCourseOffline = async (courseId: string): Promise<Course | null> => {
  try {
    const course = await getCachedCourse(courseId);
    if (course && (course.isEnrolled || course.enrollment || course.offlineAccessible)) {
      console.log(`📚 Course available offline: ${courseId} - ${course.title}`);
      return course;
    }
    console.log(`⚠️ Course not available offline: ${courseId}`);
    return null;
  } catch (error) {
    console.error('Failed to get course for offline access:', error);
    return null;
  }
};

/**
 * Cache learner's complete learning data for offline access
 * @param user - The learner user object
 * @param courses - Array of enrolled courses
 */
export const cacheLearnerData = async (user: User, courses: Course[]): Promise<void> => {
  try {
    console.log('💾 Caching learner data for offline access...');
    
    // Cache user data
    await cacheUser(user);
    
    // Cache all enrolled courses
    const cachePromises = courses.map(course => cacheCourse(course));
    await Promise.all(cachePromises);
    
    // Store learner-specific metadata
    const learnerMetadata = {
      _id: 'learner_metadata',
      type: 'learner_metadata',
      userId: user.id,
      cachedAt: new Date().toISOString(),
      totalEnrolledCourses: courses.length,
      lastSync: new Date().toISOString(),
      offlineEnabled: true
    };
    
    try {
      await localDB.put(learnerMetadata);
    } catch (error: any) {
      if (error.name !== 'conflict') {
        throw error;
      }
      // Update existing metadata
      const existing = await localDB.get('learner_metadata');
      await localDB.put({ ...learnerMetadata, _rev: existing._rev });
    }
    
    console.log(`✅ Learner data cached successfully: ${user.name} - ${courses.length} courses`);
  } catch (error) {
    console.error('Failed to cache learner data:', error);
    throw error;
  }
};

/**
 * Get learner's offline learning status
 * @returns Object with offline learning capabilities
 */
export const getLearnerOfflineStatus = async (): Promise<{
  hasOfflineData: boolean;
  enrolledCoursesCount: number;
  lastSync: string | null;
  offlineEnabled: boolean;
}> => {
  try {
    const enrolledCourses = await getEnrolledCoursesOffline();
    let metadata = null;
    
    try {
      metadata = await localDB.get('learner_metadata');
    } catch (error: any) {
      if (error.name !== 'not_found') {
        console.error('Error getting learner metadata:', error);
      }
    }
    
    return {
      hasOfflineData: enrolledCourses.length > 0,
      enrolledCoursesCount: enrolledCourses.length,
      lastSync: (metadata as any)?.lastSync || null,
      offlineEnabled: (metadata as any)?.offlineEnabled || false
    };
  } catch (error) {
    console.error('Failed to get learner offline status:', error);
    return {
      hasOfflineData: false,
      enrolledCoursesCount: 0,
      lastSync: null,
      offlineEnabled: false
    };
  }
};

/**
 * Clear all learner offline data
 */
export const clearLearnerOfflineData = async (): Promise<void> => {
  try {
    console.log('🧹 Clearing learner offline data...');
    
    // Clear all course data
    await clearAllCachedCourses();
    
    // Clear learner metadata
    try {
      const metadata = await localDB.get('learner_metadata');
      await localDB.remove(metadata);
    } catch (error: any) {
      if (error.name !== 'not_found') {
        console.error('Error clearing learner metadata:', error);
      }
    }
    
    console.log('✅ Learner offline data cleared successfully');
  } catch (error) {
    console.error('Failed to clear learner offline data:', error);
    throw error;
  }
}; 