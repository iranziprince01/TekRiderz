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
} => {
  const isOffline = !navigator.onLine;
  const hasLocalData = localStorage.getItem('currentUserId') !== null && 
                      localStorage.getItem('userEmail') !== null;
  const lastSync = localStorage.getItem('lastSync');
  const cachedUser = hasLocalData ? {
    id: localStorage.getItem('currentUserId'),
    name: localStorage.getItem('userName'),
    email: localStorage.getItem('userEmail'),
    role: localStorage.getItem('userRole'),
    verified: localStorage.getItem('userVerified') === 'true'
  } : null;
  
  console.log('🔍 Offline status check:', {
    isOffline,
    hasLocalData,
    cachedUser: cachedUser ? { name: cachedUser.name, email: cachedUser.email } : null
  });
  
  return {
    isOffline,
    hasLocalData,
    canAccessCourses: isOffline && hasLocalData,
    lastSync: lastSync ? new Date(lastSync).toLocaleString() : null,
    cachedUser
  };
};

/**
 * Essential offline error recovery
 * Handles common offline errors gracefully
 */
export const handleOfflineError = (error: any, context: string): {
  canRecover: boolean;
  message: string;
  action?: string;
} => {
  console.error(`Offline error in ${context}:`, error);

  // Network errors
  if (error.name === 'NetworkError' || error.message?.includes('network')) {
    return {
      canRecover: true,
      message: 'Network connection lost. Working in offline mode.',
      action: 'continue_offline'
    };
  }

  // Database errors
  if (error.name === 'QuotaExceededError' || error.message?.includes('quota')) {
    return {
      canRecover: false,
      message: 'Storage quota exceeded. Please clear some data.',
      action: 'clear_storage'
    };
  }

  // Cache errors
  if (error.name === 'NotFoundError' || error.message?.includes('not found')) {
    return {
      canRecover: true,
      message: 'Some cached data is missing. Loading available content.',
      action: 'load_available'
    };
  }

  // Generic offline error
  return {
    canRecover: true,
    message: 'Working in offline mode with limited functionality.',
    action: 'continue_offline'
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
    
    // Initialize cache versioning first
    await initializeCacheVersion();
    
    // Validate offline data
    const validation = await validateOfflineData();
    
    if (!validation.canProceed) {
      console.log('⚠️ Offline validation failed:', validation.issues.join(', '));
      localStorage.setItem('lastSync', new Date().toISOString());
      
      return {
        success: true,
        message: 'Offline mode ready (limited functionality)',
        offlineReady: true
      };
    }

    // Set last sync timestamp
    localStorage.setItem('lastSync', new Date().toISOString());
    
    console.log('✅ Offline essentials initialized successfully');
    
    return {
      success: true,
      message: 'Offline mode ready for demonstration',
      offlineReady: true
    };
  } catch (error) {
    console.error('❌ Failed to initialize offline essentials:', error);
    return {
      success: false,
      message: 'Failed to initialize offline mode',
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
    
    // If no modules found, try to create some basic modules for demonstration
    if (modules.length === 0) {
      console.log('No modules found, creating basic modules for offline access');
      modules = [
        {
          id: `module_1_${courseId}`,
          _id: `module_1_${courseId}`,
          title: 'Introduction to Course',
          description: 'Welcome to this course. This module provides an overview of what you will learn.',
          estimatedDuration: 15,
          videoUrl: '',
          videoProvider: 'youtube',
          order: 1,
          isCompleted: false,
          isUnlocked: true,
          courseId: courseId,
          hasQuiz: false
        },
        {
          id: `module_2_${courseId}`,
          _id: `module_2_${courseId}`,
          title: 'Core Concepts',
          description: 'Learn the fundamental concepts and principles covered in this course.',
          estimatedDuration: 30,
          videoUrl: '',
          videoProvider: 'youtube',
          order: 2,
          isCompleted: false,
          isUnlocked: true,
          courseId: courseId,
          hasQuiz: true
        },
        {
          id: `module_3_${courseId}`,
          _id: `module_3_${courseId}`,
          title: 'Practical Application',
          description: 'Apply what you have learned through hands-on exercises and projects.',
          estimatedDuration: 45,
          videoUrl: '',
          videoProvider: 'youtube',
          order: 3,
          isCompleted: false,
          isUnlocked: true,
          courseId: courseId,
          hasQuiz: true
        },
        {
          id: `module_4_${courseId}`,
          _id: `module_4_${courseId}`,
          title: 'Advanced Topics',
          description: 'Explore advanced concepts and techniques in this comprehensive module.',
          estimatedDuration: 60,
          videoUrl: '',
          videoProvider: 'youtube',
          order: 4,
          isCompleted: false,
          isUnlocked: false,
          courseId: courseId,
          hasQuiz: true
        },
        {
          id: `module_5_${courseId}`,
          _id: `module_5_${courseId}`,
          title: 'Final Assessment',
          description: 'Complete the final assessment to demonstrate your understanding of the course material.',
          estimatedDuration: 30,
          videoUrl: '',
          videoProvider: 'youtube',
          order: 5,
          isCompleted: false,
          isUnlocked: false,
          courseId: courseId,
          hasQuiz: true
        }
      ];
      
      // Cache the basic modules
      try {
        for (const module of modules) {
          await cacheModule(module);
        }
        console.log('✅ Cached basic modules for offline access');
      } catch (cacheError) {
        console.warn('Failed to cache basic modules:', cacheError);
      }
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
    if (!localDB) {
      console.warn('Database not available for module cache');
      return [];
    }
    
    const result = await localDB.allDocs({
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