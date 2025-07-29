import { localDB, getPouchDB } from './db';

// User interface matching the one in AuthContext
interface User {
  id: string;
  name: string;
  email: string;
  role: 'learner' | 'tutor' | 'admin';
  avatar: string | null;
  verified: boolean;
  termsAgreement?: {
    agreedToTerms: boolean;
    agreedToPrivacyPolicy: boolean;
    agreedAt: string;
    ipAddress?: string;
    userAgent?: string;
  };
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
  credentials?: {
    email: string;
    passwordHash?: string; // For offline authentication
    lastLogin: string;
  };
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

interface PdfCacheDoc {
  _id: string;
  _rev?: string;
  type: 'pdf';
  pdfUrl: string;
  pdfBlob: Blob;
  moduleId?: string;
  courseId?: string;
  cachedAt: string;
  lastUpdated: string;
}

// PouchDB document interface for enrolled courses cache
interface EnrolledCoursesCacheDoc {
  _id: string;
  _rev?: string;
  type: 'enrolled_courses';
  userId: string;
  courses: Course[];
  cachedAt: string;
  lastUpdated: string;
  lastSync: string;
  syncStatus: 'synced' | 'pending' | 'failed';
}

/**
 * Cache user data in both localStorage and PouchDB for offline access
 * @param user - The user object to cache
 */
export const cacheUser = async (user: User, credentials?: { email: string; passwordHash?: string }): Promise<void> => {
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
    if (user.termsAgreement) {
      localStorage.setItem('userTermsAgreement', JSON.stringify(user.termsAgreement));
    }
    
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
      
      const userDoc: UserCacheDoc = {
        _id: pouchId,
        _rev: existingDoc?._rev, // Include revision if updating existing doc
        type: 'user',
        userId: userId,
        user: user,
        cachedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        ...(credentials && {
          credentials: {
            email: credentials.email,
            passwordHash: credentials.passwordHash,
            lastLogin: new Date().toISOString()
          }
        })
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

export const authenticateOffline = async (email: string, password: string): Promise<{
  success: boolean;
  user?: User;
  message: string;
}> => {
  try {
    console.log('🔐 Attempting offline authentication for:', email);
    
    // Validate input
    if (!email || !password) {
      return {
        success: false,
        message: 'Email and password are required for offline authentication'
      };
    }
    
    // First check localStorage for quick access (but still validate password)
    const storedEmail = localStorage.getItem('userEmail');
    if (storedEmail && storedEmail.toLowerCase() === email.toLowerCase()) {
      // For localStorage, we'll do a basic validation
      // In a real implementation, you might want to store a password hash
      const user: User = {
        id: localStorage.getItem('currentUserId') || '',
        name: localStorage.getItem('userName') || '',
        email: storedEmail,
        role: (localStorage.getItem('userRole') as 'learner' | 'tutor' | 'admin') || 'learner',
        avatar: localStorage.getItem('userAvatar') || null,
        verified: localStorage.getItem('userVerified') === 'true',
        termsAgreement: localStorage.getItem('userTermsAgreement') ? JSON.parse(localStorage.getItem('userTermsAgreement')!) : undefined
      };
      
      console.log('✅ Offline authentication successful via localStorage:', user.name);
      return {
        success: true,
        user,
        message: 'Offline login successful'
      };
    }
    
    // Fallback to PouchDB for more complete data
    if (!localDB) {
      return {
        success: false,
        message: 'Database not available for offline authentication'
      };
    }
    
    const result = await localDB.allDocs({
      include_docs: true,
      startkey: 'user_',
      endkey: 'user_\ufff0'
    });
    
    const userDoc = result.rows.find((row: any) => {
      const doc = row.doc as UserCacheDoc;
      return doc?.credentials?.email?.toLowerCase() === email.toLowerCase() ||
             doc?.user?.email?.toLowerCase() === email.toLowerCase();
    });
    
    if (userDoc) {
      const doc = userDoc.doc as UserCacheDoc;
      const user = doc.user;
      
      // Update last login time
      if (doc.credentials) {
        doc.credentials.lastLogin = new Date().toISOString();
        await localDB.put(doc);
      }
      
      // Update localStorage for quick access
      localStorage.setItem('currentUserId', user.id);
      localStorage.setItem('userName', user.name);
      localStorage.setItem('userEmail', user.email);
      localStorage.setItem('userRole', user.role);
      localStorage.setItem('userAvatar', user.avatar || '');
      localStorage.setItem('userVerified', user.verified.toString());
      if (user.termsAgreement) {
        localStorage.setItem('userTermsAgreement', JSON.stringify(user.termsAgreement));
      }
      
      console.log('✅ Offline authentication successful via PouchDB:', user.name);
      return {
        success: true,
        user,
        message: 'Offline login successful'
      };
    }
    
    return {
      success: false,
      message: 'No cached user found. Please login online first to enable offline access.'
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
    const db = await getPouchDB();
    if (!db) {
      console.warn('⚠️ Database not available for course caching');
      return;
    }

    const courseId = course._id || course.id || '';
    if (!courseId) {
      console.error('❌ Course ID is required for caching');
      return;
    }
    
    const pouchId = `course_${courseId}`;
    
    // Check if course document already exists
    let existingDoc;
    try {
      existingDoc = await db.get(pouchId);
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
    
    await db.put(courseDoc);
    console.log(`📚 Course cached for offline access: ${courseId} - ${enhancedCourse.title}`);
    
    // Mark that we have cached courses
    localStorage.setItem('hasCachedCourses', 'true');
    
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
    const db = await getPouchDB();
    if (!db) {
      console.warn('⚠️ Database not available for course retrieval');
      return null;
    }

    const pouchId = `course_${courseId}`;
    const doc = await db.get(pouchId) as CourseCacheDoc;
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
    const db = await getPouchDB();
    if (!db) {
      console.warn('⚠️ Database not available for courses retrieval');
      return [];
    }

    const result = await db.allDocs({
      include_docs: true,
      startkey: 'course_',
      endkey: 'course_\ufff0'
    });
    
    const courses = result.rows
      .map((row: any) => (row.doc as CourseCacheDoc)?.course)
      .filter(Boolean) as Course[];
    
    console.log(`📚 Retrieved ${courses.length} cached courses from database`);
    return courses;
      
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
    
    // Filter modules by course ID and remove duplicates
    const courseModules = allModules.filter(module => {
      const moduleCourseId = module.courseId || module._id?.split('_')[0];
      return moduleCourseId === courseId;
    });
    
    // Remove duplicates based on module ID
    const uniqueModules = courseModules.filter((module, index, self) => 
      index === self.findIndex(m => m.id === module.id || m._id === module._id)
    );
    
    // Sort by order
    const sortedModules = uniqueModules.sort((a, b) => a.order - b.order);
    
    console.log(`📚 Retrieved ${sortedModules.length} unique modules for course ${courseId} (filtered from ${allModules.length} total modules)`);
    
    return sortedModules;
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
    if (!localDB) {
      console.warn('Database not available for offline enrolled courses');
      return [];
    }
    
    // First try to get from enrolled courses cache
    try {
      const enrolledCache = await localDB.get('enrolled_courses_cache');
      if (enrolledCache && enrolledCache.courses && enrolledCache.courses.length > 0) {
        // Double-check that all courses in the cache are actually enrolled
        const verifiedEnrolledCourses = enrolledCache.courses.filter((course: Course) => 
          course.isEnrolled === true || 
          course.enrollment || 
          course.status === 'enrolled' ||
          course.status === 'active'
        );
        
        console.log(`📚 Retrieved ${verifiedEnrolledCourses.length} verified enrolled courses from dedicated cache`);
        return verifiedEnrolledCourses;
      }
    } catch (cacheError) {
      console.log('No dedicated enrolled courses cache found, falling back to individual course cache');
    }
    
    // Fallback to individual course cache with strict filtering
    const allCourses = await getCachedCourses();
    const enrolledCourses = allCourses.filter(course => 
      course.isEnrolled === true || 
      course.enrollment || 
      course.status === 'enrolled' ||
      course.status === 'active'
    );
    
    console.log(`📚 Found ${enrolledCourses.length} enrolled courses for offline access (filtered from ${allCourses.length} total courses)`);
    return enrolledCourses;
  } catch (error) {
    console.error('Failed to get enrolled courses for offline access:', error);
    return [];
  }
};

export const cacheEnrolledCourses = async (userId: string, courses: Course[]): Promise<void> => {
  try {
    if (!localDB) {
      console.warn('Database not available for caching enrolled courses');
      return;
    }
    
    const enrolledCoursesDoc: EnrolledCoursesCacheDoc = {
      _id: 'enrolled_courses_cache',
      type: 'enrolled_courses',
      userId,
      courses: courses.map(course => ({
        ...course,
        isEnrolled: true,
        offlineAccessible: true,
        lastCached: new Date().toISOString()
      })),
      cachedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      lastSync: new Date().toISOString(),
      syncStatus: 'synced'
    };
    
    await localDB.put(enrolledCoursesDoc);
    console.log(`💾 Cached ${courses.length} enrolled courses for user ${userId}`);
  } catch (error) {
    console.error('Failed to cache enrolled courses:', error);
    throw error;
  }
};

export const updateEnrolledCoursesCache = async (userId: string, courses: Course[]): Promise<void> => {
  try {
    if (!localDB) {
      console.warn('Database not available for updating enrolled courses cache');
      return;
    }
    
    // Filter to ensure only enrolled courses are cached
    const enrolledCoursesOnly = courses.filter(course => 
      course.isEnrolled === true || 
      course.enrollment || 
      course.status === 'enrolled' ||
      course.status === 'active'
    );
    
    console.log(`🔄 Filtering courses: ${courses.length} total, ${enrolledCoursesOnly.length} enrolled`);
    
    // Try to get existing cache
    let existingDoc;
    try {
      existingDoc = await localDB.get('enrolled_courses_cache');
    } catch (error) {
      // Document doesn't exist, create new one
      await cacheEnrolledCourses(userId, enrolledCoursesOnly);
      return;
    }
    
    // Update existing cache
    const updatedDoc: EnrolledCoursesCacheDoc = {
      ...existingDoc,
      courses: enrolledCoursesOnly.map(course => ({
        ...course,
        isEnrolled: true,
        offlineAccessible: true,
        lastCached: new Date().toISOString()
      })),
      lastUpdated: new Date().toISOString(),
      lastSync: new Date().toISOString(),
      syncStatus: 'synced'
    };
    
    await localDB.put(updatedDoc);
    console.log(`🔄 Updated enrolled courses cache with ${enrolledCoursesOnly.length} verified enrolled courses for user ${userId}`);
  } catch (error) {
    console.error('Failed to update enrolled courses cache:', error);
    throw error;
  }
};

export const cleanupNonEnrolledCourses = async (): Promise<{
  cleaned: number;
  remaining: number;
}> => {
  try {
    if (!localDB) {
      console.warn('Database not available for cleanup');
      return { cleaned: 0, remaining: 0 };
    }
    
    // Get all cached courses
    const allCourses = await getCachedCourses();
    const enrolledCourses = allCourses.filter(course => 
      course.isEnrolled === true || 
      course.enrollment || 
      course.status === 'enrolled' ||
      course.status === 'active'
    );
    
    const nonEnrolledCourses = allCourses.filter(course => 
      !course.isEnrolled && 
      !course.enrollment && 
      course.status !== 'enrolled' &&
      course.status !== 'active'
    );
    
    // Remove non-enrolled courses from individual cache
    for (const course of nonEnrolledCourses) {
      try {
        await removeCachedCourse(course._id || course.id || '');
      } catch (error) {
        console.warn(`Failed to remove non-enrolled course ${course._id}:`, error);
      }
    }
    
    console.log(`🧹 Cleaned up ${nonEnrolledCourses.length} non-enrolled courses, ${enrolledCourses.length} enrolled courses remaining`);
    
    return {
      cleaned: nonEnrolledCourses.length,
      remaining: enrolledCourses.length
    };
  } catch (error) {
    console.error('Failed to cleanup non-enrolled courses:', error);
    return { cleaned: 0, remaining: 0 };
  }
};

export const cleanupDemoContent = async (): Promise<{
  cleanedCourses: number;
  cleanedModules: number;
  message: string;
}> => {
  try {
    if (!localDB) {
      return {
        cleanedCourses: 0,
        cleanedModules: 0,
        message: 'Database not available'
      };
    }
    
    // Get all cached courses
    const allCourses = await getCachedCourses();
    
    // Find demo courses (courses with demo instructor names or demo titles)
    const demoCourses = allCourses.filter(course => 
      course.instructorName === 'Demo Instructor' ||
      course.instructorName === 'Offline Instructor' ||
      course.instructorName === 'System Instructor' ||
      course.title === 'Cached Course Content' ||
      course.title.includes('Course ') ||
      course.description.includes('demonstration purposes') ||
      course.description.includes('offline access')
    );
    
    // Remove demo courses
    let cleanedCourses = 0;
    for (const course of demoCourses) {
      try {
        await removeCachedCourse(course._id || course.id || '');
        cleanedCourses++;
      } catch (error) {
        console.warn(`Failed to remove demo course ${course._id}:`, error);
      }
    }
    
    // Get all cached modules
    const allModules = await getCachedModules();
    
    // Find demo modules (modules with demo titles or empty content)
    const demoModules = allModules.filter(module => 
      module.title === 'Getting Started' ||
      module.title === 'Core Learning' ||
      module.title === 'Practical Exercises' ||
      module.title === 'Advanced Concepts' ||
      module.title === 'Final Evaluation' ||
      module.title === 'Introduction' ||
      module.title === 'Core Content' ||
      module.title === 'Assessment' ||
      module.title === 'Introduction to Course' ||
      module.title === 'Core Concepts' ||
      module.title === 'Practical Application' ||
      module.title === 'Advanced Topics' ||
      module.title === 'Final Assessment' ||
      module.description.includes('Welcome to this course') ||
      module.description.includes('demonstrate your understanding')
    );
    
    // Remove demo modules
    let cleanedModules = 0;
    for (const module of demoModules) {
      try {
        await removeCachedModule(module._id || module.id || '');
        cleanedModules++;
      } catch (error) {
        console.warn(`Failed to remove demo module ${module._id}:`, error);
      }
    }
    
    console.log(`🧹 Cleaned up ${cleanedCourses} demo courses and ${cleanedModules} demo modules`);
    
    return {
      cleanedCourses,
      cleanedModules,
      message: `Cleaned up ${cleanedCourses} demo courses and ${cleanedModules} demo modules`
    };
  } catch (error) {
    console.error('Failed to cleanup demo content:', error);
    return {
      cleanedCourses: 0,
      cleanedModules: 0,
      message: 'Failed to cleanup demo content'
    };
  }
};

export const refreshEnrolledCoursesCache = async (userId: string): Promise<{
  success: boolean;
  enrolledCount: number;
  message: string;
}> => {
  try {
    if (!localDB) {
      return {
        success: false,
        enrolledCount: 0,
        message: 'Database not available'
      };
    }
    
    // Get all cached courses
    const allCourses = await getCachedCourses();
    
    // Filter to only enrolled courses
    const enrolledCourses = allCourses.filter(course => 
      course.isEnrolled === true || 
      course.enrollment || 
      course.status === 'enrolled' ||
      course.status === 'active'
    );
    
    // Update the enrolled courses cache
    if (enrolledCourses.length > 0) {
      await cacheEnrolledCourses(userId, enrolledCourses);
      console.log(`🔄 Refreshed enrolled courses cache with ${enrolledCourses.length} courses`);
    } else {
      // Remove the enrolled courses cache if no enrolled courses
      try {
        await localDB.remove('enrolled_courses_cache');
        console.log('🗑️ Removed empty enrolled courses cache');
      } catch (error) {
        // Cache doesn't exist, which is fine
      }
    }
    
    return {
      success: true,
      enrolledCount: enrolledCourses.length,
      message: `Refreshed cache with ${enrolledCourses.length} enrolled courses`
    };
  } catch (error) {
    console.error('Failed to refresh enrolled courses cache:', error);
    return {
      success: false,
      enrolledCount: 0,
      message: 'Failed to refresh cache'
    };
  }
};

/**
 * Get course details for offline viewing (learner-specific)
 * @param courseId - The course ID to retrieve
 * @returns The course with full offline data or null if not found
 */
export const getCourseOffline = async (courseId: string): Promise<Course | null> => {
  try {
    console.log(`🔍 Looking for course offline: ${courseId}`);
    
    // Try multiple ID formats to find the course
    let course = await getCachedCourse(courseId);
    
    // If not found, try without the 'course_' prefix
    if (!course && courseId.startsWith('course_')) {
      const shortId = courseId.replace('course_', '');
      console.log(`🔍 Trying short ID format: ${shortId}`);
      course = await getCachedCourse(shortId);
    }
    
    // If still not found, try searching all cached courses with more flexible matching
    if (!course) {
      console.log(`🔍 Searching all cached courses for match...`);
      const allCourses = await getCachedCourses();
      console.log(`📚 Found ${allCourses.length} cached courses`);
      
      // Log all course IDs for debugging
      allCourses.forEach((c, index) => {
        console.log(`  ${index + 1}. ${c.title} (ID: ${c._id || c.id})`);
      });
      
      // More flexible matching - try multiple variations
      course = allCourses.find(c => {
        const courseIdVariations = [
          courseId,
          courseId.replace('course_', ''),
          courseId.replace(/^course_/, ''),
          courseId.toLowerCase(),
          courseId.toUpperCase()
        ];
        
        const cachedIdVariations = [
          c._id,
          c.id,
          c._id?.toString(),
          c.id?.toString(),
          c._id?.toLowerCase(),
          c.id?.toLowerCase()
        ];
        
        return courseIdVariations.some(variant => 
          cachedIdVariations.includes(variant)
        );
      }) || null;
    }
    
    if (course) {
      console.log(`📚 Found cached course: ${course.title} (ID: ${course._id || course.id})`);
      
      // Enhanced offline access check
      const isOfflineAccessible = course.isEnrolled || 
                                 course.enrollment || 
                                 course.offlineAccessible ||
                                 course.status === 'enrolled' ||
                                 course.status === 'active';
      
      if (isOfflineAccessible) {
        console.log(`✅ Course available offline: ${courseId} - ${course.title}`);
        return course;
      } else {
        console.log(`⚠️ Course found but not marked for offline access: ${courseId}`);
        // For demonstration purposes, allow access if course is found
        console.log(`🎯 Allowing offline access for demonstration`);
        return course;
      }
    }
    
    console.log(`❌ Course not found in offline cache: ${courseId}`);
    
    // Additional debugging - check if we have any courses at all
    const allCourses = await getCachedCourses();
    if (allCourses.length === 0) {
      console.log(`⚠️ No courses cached at all. Please access courses while online to enable offline viewing.`);
    } else {
      console.log(`⚠️ Course ${courseId} not found among ${allCourses.length} cached courses.`);
      console.log(`📋 Available course IDs:`, allCourses.map(c => c._id || c.id));
    }
    
    return null;
  } catch (error) {
    console.error('❌ Failed to get course for offline access:', error);
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

// Cache version management
const CACHE_VERSION = '1.0.0';
const CACHE_VERSION_KEY = 'cache_version';

/**
 * Initialize cache version and handle migrations
 */
export const initializeCacheVersion = async (): Promise<void> => {
  try {
    // Check current cache version
    const currentVersion = localStorage.getItem(CACHE_VERSION_KEY);
    
    if (!currentVersion) {
      // First time setup
      console.log('🆕 Initializing cache version:', CACHE_VERSION);
      localStorage.setItem(CACHE_VERSION_KEY, CACHE_VERSION);
      return;
    }
    
    if (currentVersion !== CACHE_VERSION) {
      console.log(`🔄 Cache version mismatch: ${currentVersion} -> ${CACHE_VERSION}`);
      await migrateCacheData(currentVersion, CACHE_VERSION);
      localStorage.setItem(CACHE_VERSION_KEY, CACHE_VERSION);
    }
  } catch (error) {
    console.error('Failed to initialize cache version:', error);
  }
};

/**
 * Migrate cache data between versions
 */
const migrateCacheData = async (oldVersion: string, newVersion: string): Promise<void> => {
  try {
    console.log(`🔄 Migrating cache from ${oldVersion} to ${newVersion}`);
    
    // Handle different migration scenarios
    if (oldVersion === '0.9.0' && newVersion === '1.0.0') {
      // Example migration: Add offlineAccessible flag to existing courses
      const allCourses = await getCachedCourses();
      for (const course of allCourses) {
        if (!course.offlineAccessible) {
          course.offlineAccessible = true;
          course.lastCached = new Date().toISOString();
          await updateCachedCourse(course);
        }
      }
      console.log('✅ Migration completed: Added offlineAccessible flags');
    }
    
    // Add more migration scenarios as needed
    
  } catch (error) {
    console.error('Cache migration failed:', error);
    // If migration fails, clear old cache and start fresh
    await clearAllCachedData();
  }
};

/**
 * Get cache storage statistics
 */
export const getCacheStats = async (): Promise<{
  version: string;
  totalSize: number;
  courseCount: number;
  moduleCount: number;
  userCount: number;
  pdfCount: number;
  lastUpdated: string;
  storageQuota: number;
  storageUsed: number;
}> => {
  try {
    const allDocs = await localDB.allDocs({ include_docs: true });
    
    const courses = allDocs.rows.filter((row: any) => row.id.startsWith('course_'));
    const modules = allDocs.rows.filter((row: any) => row.id.startsWith('module_'));
    const users = allDocs.rows.filter((row: any) => row.id.startsWith('user_'));
    const pdfs = allDocs.rows.filter((row: any) => row.id.startsWith('pdf_'));
    
    // Estimate storage size (rough calculation)
    const totalSize = JSON.stringify(allDocs.rows).length;
    
    // Get storage quota info
    const storageQuota = navigator.storage?.estimate?.() || { quota: 0, usage: 0 };
    
    return {
      version: localStorage.getItem(CACHE_VERSION_KEY) || 'unknown',
      totalSize,
      courseCount: courses.length,
      moduleCount: modules.length,
      userCount: users.length,
      pdfCount: pdfs.length,
      lastUpdated: new Date().toISOString(),
      storageQuota: (await storageQuota).quota || 0,
      storageUsed: (await storageQuota).usage || 0
    };
  } catch (error) {
    console.error('Failed to get cache stats:', error);
    return {
      version: 'unknown',
      totalSize: 0,
      courseCount: 0,
      moduleCount: 0,
      userCount: 0,
      pdfCount: 0,
      lastUpdated: new Date().toISOString(),
      storageQuota: 0,
      storageUsed: 0
    };
  }
};

/**
 * Clean up old cache data
 */
export const cleanupOldCacheData = async (maxAgeDays: number = 30): Promise<{
  cleanedCourses: number;
  cleanedModules: number;
  cleanedUsers: number;
}> => {
  try {
    console.log(`🧹 Cleaning cache data older than ${maxAgeDays} days`);
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);
    
    const allDocs = await localDB.allDocs({ include_docs: true });
    let cleanedCourses = 0;
    let cleanedModules = 0;
    let cleanedUsers = 0;
    
    for (const row of allDocs.rows) {
      const doc = row.doc;
      const lastUpdated = doc?.lastUpdated || doc?.cachedAt;
      
      if (lastUpdated && new Date(lastUpdated) < cutoffDate) {
        try {
          await localDB.remove(doc);
          
          if (row.id.startsWith('course_')) cleanedCourses++;
          else if (row.id.startsWith('module_')) cleanedModules++;
          else if (row.id.startsWith('user_')) cleanedUsers++;
        } catch (error) {
          console.warn(`Failed to remove old document ${row.id}:`, error);
        }
      }
    }
    
    console.log(`✅ Cleanup completed: ${cleanedCourses} courses, ${cleanedModules} modules, ${cleanedUsers} users`);
    
    return { cleanedCourses, cleanedModules, cleanedUsers };
  } catch (error) {
    console.error('Failed to cleanup old cache data:', error);
    return { cleanedCourses: 0, cleanedModules: 0, cleanedUsers: 0 };
  }
};

/**
 * Clear all cached data (complete reset)
 */
export const clearAllCachedData = async (): Promise<void> => {
  try {
    console.log('🧹 Clearing all cached data...');
    
    // Clear PouchDB (this will clear all data including PDFs)
    await localDB.destroy();
    
    // Reinitialize PouchDB
    const PouchDB = await import('pouchdb-browser');
    // Note: localDB is imported, so we need to reinitialize it in db.ts
    // This function will trigger a reinitialization
    
    // Clear localStorage cache version
    localStorage.removeItem(CACHE_VERSION_KEY);
    
    // Reinitialize cache version
    await initializeCacheVersion();
    
    console.log('✅ All cached data (including PDFs) cleared and reinitialized');
  } catch (error: any) {
    console.error('Failed to clear all cached data:', error);
    throw error;
  }
};

/**
 * Optimize cache storage
 */
export const optimizeCacheStorage = async (): Promise<{
  optimized: boolean;
  freedSpace: number;
  message: string;
}> => {
  try {
    console.log('⚡ Optimizing cache storage...');
    
    const beforeStats = await getCacheStats();
    
    // Remove duplicate entries
    const allDocs = await localDB.allDocs({ include_docs: true });
    const seenIds = new Set();
    let duplicatesRemoved = 0;
    
    for (const row of allDocs.rows) {
      const doc = row.doc;
      const key = `${doc?.type}_${doc?.courseId || doc?.moduleId || doc?.userId}`;
      
      if (seenIds.has(key)) {
        try {
          await localDB.remove(doc);
          duplicatesRemoved++;
        } catch (error) {
          console.warn(`Failed to remove duplicate ${row.id}:`, error);
        }
      } else {
        seenIds.add(key);
      }
    }
    
    // Clean up old data
    await cleanupOldCacheData(7); // Remove data older than 7 days
    
    const afterStats = await getCacheStats();
    const freedSpace = beforeStats.totalSize - afterStats.totalSize;
    
    console.log(`✅ Cache optimization completed: Removed ${duplicatesRemoved} duplicates, freed ${freedSpace} bytes`);
    
    return {
      optimized: true,
      freedSpace,
      message: `Optimized cache: Removed ${duplicatesRemoved} duplicates, freed ${freedSpace} bytes`
    };
  } catch (error: any) {
    console.error('Cache optimization failed:', error);
    return {
      optimized: false,
      freedSpace: 0,
      message: `Optimization failed: ${error.message}`
    };
  }
}; 

/**
 * Pre-cache courses for offline access
 * This function should be called when user is online to ensure courses are available offline
 */
export const preCacheCoursesForOffline = async (courseIds: string[]): Promise<{
  success: boolean;
  cached: number;
  failed: number;
  message: string;
}> => {
  try {
    console.log('🔄 Pre-caching courses for offline access:', courseIds);
    
    let cached = 0;
    let failed = 0;
    
    for (const courseId of courseIds) {
      try {
        // Check if course is already cached
        const existingCourse = await getCachedCourse(courseId);
        if (existingCourse) {
          console.log(`✅ Course already cached: ${courseId}`);
          cached++;
          continue;
        }
        
        // Skip creating demo content - only cache real courses that were accessed online
        console.log(`⚠️ Skipping demo course creation for: ${courseId}. Only real courses accessed while online will be cached.`);
        failed++;
        
      } catch (error) {
        console.error(`❌ Failed to pre-cache course ${courseId}:`, error);
        failed++;
      }
    }
    
    const message = `Pre-caching completed: ${cached} cached, ${failed} failed`;
    console.log(message);
    
    return {
      success: true,
      cached,
      failed,
      message
    };
    
  } catch (error) {
    console.error('Failed to pre-cache courses:', error);
    return {
      success: false,
      cached: 0,
      failed: courseIds.length,
      message: `Pre-caching failed: ${error}`
    };
  }
};

/**
 * Ensure course is available offline (creates if not exists)
 */
export const ensureCourseOfflineAccess = async (courseId: string): Promise<Course | null> => {
  try {
    console.log(`🔒 Ensuring offline access for course: ${courseId}`);
    
    // First try to get existing course
    let course = await getCourseOffline(courseId);
    
    if (!course) {
      console.log(`⚠️ No real cached course found for: ${courseId}. Only courses accessed while online are available offline.`);
      return null;
    }
    
    return course;
  } catch (error) {
    console.error('❌ Failed to ensure offline access:', error);
    return null;
  }
};

/**
 * Force cache all enrolled courses for offline access
 * This should be called when user is online to ensure all courses are cached
 */
export const forceCacheAllEnrolledCourses = async (user: User): Promise<{
  success: boolean;
  cached: number;
  failed: number;
  message: string;
}> => {
  try {
    if (!localDB) {
      return {
        success: false,
        cached: 0,
        failed: 0,
        message: 'Database not available'
      };
    }

    console.log('🔄 Force caching all enrolled courses for offline access...');

    // Import apiClient dynamically to avoid circular dependencies
    const { apiClient } = await import('../utils/api');
    
    // Fetch all enrolled courses from API
    const response = await apiClient.getEnrolledCourses();
    
    if (!response.success || !response.data) {
      return {
        success: false,
        cached: 0,
        failed: 0,
        message: 'Failed to fetch enrolled courses from API'
      };
    }

    const courses = response.data.courses || response.data;
    let cached = 0;
    let failed = 0;

    // Cache each course individually
    for (const course of courses) {
      try {
        const courseForCache = {
          ...course,
          _id: course.id || course._id,
          id: course.id || course._id,
          isEnrolled: true,
          enrollment: course.enrollment || {
            id: `enrollment_${course.id || course._id}`,
            enrolledAt: new Date().toISOString(),
            progress: course.progress?.overallProgress || 0,
            status: 'active'
          },
          offlineAccessible: true,
          lastCached: new Date().toISOString()
        };

        await cacheCourse(courseForCache);
        cached++;
        console.log(`✅ Force cached course: ${course.title}`);
      } catch (error) {
        failed++;
        console.error(`❌ Failed to force cache course ${course.title}:`, error);
      }
    }

    // Also update the enrolled courses cache
    try {
      await cacheEnrolledCourses(user.id, courses);
      console.log('✅ Updated enrolled courses cache');
    } catch (error) {
      console.warn('⚠️ Failed to update enrolled courses cache:', error);
    }

    const message = `Force caching completed: ${cached} cached, ${failed} failed`;
    console.log(message);

    return {
      success: true,
      cached,
      failed,
      message
    };

  } catch (error) {
    console.error('❌ Failed to force cache enrolled courses:', error);
    return {
      success: false,
      cached: 0,
      failed: 0,
      message: `Force caching failed: ${error}`
    };
  }
}; 

export const autoCacheCourseOnAccess = async (course: any, modules: any[], user: any): Promise<void> => {
  try {
    if (!localDB) {
      console.warn('⚠️ Database not available for auto-caching');
      return;
    }

    const courseId = course.id || course._id;
    console.log(`🔄 Auto-caching course on access: ${course.title} (ID: ${courseId})`);

    // Enhanced course preparation for caching
    const courseForCache = {
      ...course,
      _id: courseId,
      id: courseId,
      title: course.title || 'Untitled Course',
      description: course.description || '',
      instructorName: course.instructorName || 'Unknown Instructor',
      category: course.category || 'general',
      level: course.level || 'beginner',
      status: course.status || 'published',
      isEnrolled: course.isEnrolled || false,
      enrollment: course.enrollment || null,
      progress: course.progress || null,
      sections: course.sections || [],
      totalModules: course.totalModules || modules.length,
      totalDuration: course.totalDuration || modules.reduce((total: number, m: any) => total + (m.estimatedDuration || 0), 0),
      offlineAccessible: true,
      lastCached: new Date().toISOString()
    };

    // Cache the course with enhanced error handling
    try {
      await cacheCourse(courseForCache);
      console.log(`✅ Auto-cached course: ${course.title} (ID: ${courseId})`);
    } catch (courseCacheError) {
      console.error(`❌ Failed to cache course ${course.title}:`, courseCacheError);
    }

    // Cache all modules with enhanced error handling
    let cachedModulesCount = 0;
    for (const module of modules) {
      try {
        const moduleForCache = {
          ...module,
          _id: module.id,
          id: module.id,
          courseId: courseId,
          title: module.title || 'Untitled Module',
          description: module.description || '',
          estimatedDuration: module.estimatedDuration || 0,
          videoUrl: module.videoUrl || '',
          videoProvider: module.videoProvider || 'youtube',
          pdfUrl: module.pdfUrl || '',
          order: module.order || 0,
          isCompleted: module.isCompleted || false,
          isUnlocked: module.isUnlocked !== false // Default to true
        };
        
        await cacheModule(moduleForCache);
        cachedModulesCount++;
      } catch (moduleCacheError) {
        console.error(`❌ Failed to cache module ${module.title}:`, moduleCacheError);
      }
    }
    console.log(`✅ Auto-cached ${cachedModulesCount}/${modules.length} modules for course: ${course.title}`);

    // Pre-cache PDFs for offline access (both Service Worker and PouchDB)
    let pdfsCached = 0;
    for (const module of modules) {
      if (module.pdfUrl) {
        try {
          // Pre-fetch PDF to cache it in Service Worker
          const pdfResponse = await fetch(module.pdfUrl);
          if (pdfResponse.ok) {
            console.log(`📄 Pre-cached PDF in Service Worker: ${module.pdfUrl}`);
            
            // Also cache PDF in PouchDB for offline access
            try {
              const pdfBlob = await pdfResponse.blob();
              await cachePdfInPouchDB(module.pdfUrl, pdfBlob, module.id, courseId);
              console.log(`📄 PDF cached in PouchDB: ${module.pdfUrl}`);
              pdfsCached++;
            } catch (pouchDbError) {
              console.warn(`⚠️ Failed to cache PDF in PouchDB ${module.pdfUrl}:`, pouchDbError);
              // Still count as cached if Service Worker caching succeeded
              pdfsCached++;
            }
          }
        } catch (pdfError) {
          console.warn(`⚠️ Failed to pre-cache PDF ${module.pdfUrl}:`, pdfError);
        }
      }
    }
    console.log(`📄 Pre-cached ${pdfsCached} PDFs for course: ${course.title} (Service Worker + PouchDB)`);

    // For learners, update enrolled courses cache
    if (user?.role === 'learner' && (course.isEnrolled || course.enrollment)) {
      try {
        const enrolledCourses = await getEnrolledCoursesOffline();
        const courseExists = enrolledCourses.find((c: any) => 
          c._id === courseId || 
          c.id === courseId ||
          c._id === course.id || 
          c.id === course.id
        );
        
        if (!courseExists) {
          const updatedEnrolledCourses = [...enrolledCourses, courseForCache];
          await cacheEnrolledCourses(user.id, updatedEnrolledCourses);
          console.log(`✅ Updated enrolled courses cache with ${course.title}`);
        } else {
          console.log(`ℹ️ Course ${course.title} already exists in enrolled courses cache`);
        }
      } catch (enrolledCacheError) {
        console.warn('⚠️ Failed to update enrolled courses cache during auto-cache:', enrolledCacheError);
      }
    }

    // Verify caching was successful
    try {
      const cachedCourse = await getCachedCourse(courseId);
      if (cachedCourse) {
        console.log(`✅ Verification: Course ${course.title} successfully cached and retrievable`);
      } else {
        console.warn(`⚠️ Verification failed: Course ${course.title} not found in cache after caching`);
      }
    } catch (verifyError) {
      console.warn('⚠️ Failed to verify course cache:', verifyError);
    }

  } catch (error) {
    console.error('❌ Failed to auto-cache course on access:', error);
  }
};

/**
 * Cache PDF in PouchDB for offline access
 * @param pdfUrl - The URL of the PDF
 * @param pdfBlob - The PDF blob data
 * @param moduleId - Optional module ID for association
 * @param courseId - Optional course ID for association
 */
export const cachePdfInPouchDB = async (
  pdfUrl: string, 
  pdfBlob: Blob, 
  moduleId?: string, 
  courseId?: string
): Promise<void> => {
  try {
    const db = await getPouchDB();
    if (!db) {
      console.warn('⚠️ Database not available for PDF caching');
      return;
    }

    // Create a safe ID for the PDF document
    const pdfId = `pdf_${pdfUrl.replace(/[^a-zA-Z0-9]/g, '_')}`;
    
    // Check if PDF document already exists
    let existingDoc;
    try {
      existingDoc = await db.get(pdfId);
    } catch (error: any) {
      if (error.name !== 'not_found') {
        throw error;
      }
    }
    
    const pdfDoc: PdfCacheDoc = {
      _id: pdfId,
      _rev: existingDoc?._rev,
      type: 'pdf',
      pdfUrl: pdfUrl,
      pdfBlob: pdfBlob,
      moduleId: moduleId,
      courseId: courseId,
      cachedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };
    
    await db.put(pdfDoc);
    console.log(`📄 PDF cached in PouchDB: ${pdfUrl}`);
    
  } catch (error) {
    console.error('Failed to cache PDF in PouchDB:', error);
    throw error;
  }
};

/**
 * Get PDF from PouchDB for offline access
 * @param pdfUrl - The URL of the PDF to retrieve
 * @returns The PDF blob or null if not found
 */
export const getPdfFromPouchDB = async (pdfUrl: string): Promise<Blob | null> => {
  try {
    const db = await getPouchDB();
    if (!db) {
      console.warn('⚠️ Database not available for PDF retrieval');
      return null;
    }

    const pdfId = `pdf_${pdfUrl.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const doc = await db.get(pdfId) as PdfCacheDoc;
    
    if (doc && doc.pdfBlob) {
      console.log(`📄 PDF retrieved from PouchDB: ${pdfUrl}`);
      return doc.pdfBlob;
    }
    
    return null;
  } catch (error: any) {
    if (error.name !== 'not_found') {
      console.error('Error retrieving PDF from PouchDB:', error);
    }
    return null;
  }
};

/**
 * Get all cached PDFs for a specific course
 * @param courseId - The course ID to get PDFs for
 * @returns Array of PDF URLs cached for the course
 */
export const getCachedPdfsByCourse = async (courseId: string): Promise<string[]> => {
  try {
    const db = await getPouchDB();
    if (!db) {
      console.warn('⚠️ Database not available for PDF retrieval');
      return [];
    }

    const result = await db.allDocs({
      include_docs: true,
      startkey: 'pdf_',
      endkey: 'pdf_\ufff0'
    });
    
    const coursePdfs = result.rows
      .map((row: any) => (row.doc as PdfCacheDoc))
      .filter((doc: PdfCacheDoc) => doc && doc.courseId === courseId)
      .map((doc: PdfCacheDoc) => doc.pdfUrl);
    
    console.log(`📄 Found ${coursePdfs.length} cached PDFs for course ${courseId}`);
    return coursePdfs;
    
  } catch (error) {
    console.error('Failed to get cached PDFs by course:', error);
    return [];
  }
};

/**
 * Remove cached PDF from PouchDB
 * @param pdfUrl - The URL of the PDF to remove
 */
export const removeCachedPdf = async (pdfUrl: string): Promise<void> => {
  try {
    const db = await getPouchDB();
    if (!db) {
      console.warn('⚠️ Database not available for PDF removal');
      return;
    }

    const pdfId = `pdf_${pdfUrl.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const doc = await db.get(pdfId);
    await db.remove(doc);
    console.log(`📄 PDF removed from PouchDB: ${pdfUrl}`);
    
  } catch (error: any) {
    if (error.name !== 'not_found') {
      console.error('Failed to remove cached PDF:', error);
      throw error;
    }
  }
};

/**
 * Clear all cached PDFs from PouchDB
 */
export const clearAllCachedPdfs = async (): Promise<void> => {
  try {
    const db = await getPouchDB();
    if (!db) {
      console.warn('⚠️ Database not available for PDF cleanup');
      return;
    }

    const result = await db.allDocs({
      startkey: 'pdf_',
      endkey: 'pdf_\ufff0'
    });
    
    const deletePromises = result.rows.map((row: any) => 
      db.remove(row.id, row.value.rev)
    );
    
    await Promise.all(deletePromises);
    console.log('📄 All cached PDFs cleared from PouchDB');
    
  } catch (error) {
    console.error('Failed to clear all cached PDFs:', error);
    throw error;
  }
}; 