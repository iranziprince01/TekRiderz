// IndexedDB utilities for TekRiders offline functionality
const DB_NAME = 'TekRidersDB';
const DB_VERSION = 1;

// Store names
export const STORES = {
  USER_DATA: 'userData',
  COURSES: 'courses',
  COURSE_CONTENT: 'courseContent',
  PROGRESS: 'progress',
  OFFLINE_ACTIONS: 'offlineActions',
  SETTINGS: 'settings',
  CACHE_METADATA: 'cacheMetadata'
} as const;

// Types for our data structures
export interface UserData {
  id: string;
  email: string;
  name: string;
  role: 'learner' | 'tutor' | 'admin';
  avatar?: string;
  lastSync: number;
  offline: boolean;
}

export interface CourseData {
  id: string;
  title: string;
  description: string;
  instructor: string;
  thumbnail?: string;
  modules: CourseModule[];
  enrollmentStatus: 'enrolled' | 'completed' | 'not_enrolled';
  lastAccessed: number;
  cachedAt: number;
}

export interface CourseModule {
  id: string;
  title: string;
  type: 'video' | 'text' | 'quiz' | 'assignment';
  content?: string;
  videoUrl?: string;
  duration?: number;
  order: number;
}

export interface ProgressData {
  id: string;
  userId: string;
  courseId: string;
  moduleId: string;
  type: 'video_progress' | 'quiz_completion' | 'module_completion';
  progress: number; // 0-100
  timeSpent: number; // in seconds
  lastPosition?: number; // for video progress
  quizAnswers?: any[];
  completed: boolean;
  timestamp: number;
  synced: boolean;
}

export interface OfflineAction {
  id: string;
  type: 'enrollment' | 'progress_update' | 'quiz_submission' | 'user_update';
  endpoint: string;
  method: 'POST' | 'PUT' | 'PATCH';
  data: any;
  timestamp: number;
  priority: number; // 1 = high, 2 = medium, 3 = low
  retryCount: number;
  maxRetries: number;
}

export interface CacheMetadata {
  key: string;
  type: 'course' | 'video' | 'image' | 'api_response';
  size: number;
  lastAccessed: number;
  expiresAt?: number;
  url: string;
}

// Database connection and initialization
class IndexedDBManager {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('IndexedDB initialized successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create object stores
        this.createStores(db);
      };
    });

    return this.initPromise;
  }

  private createStores(db: IDBDatabase): void {
    // User data store
    if (!db.objectStoreNames.contains(STORES.USER_DATA)) {
      const userStore = db.createObjectStore(STORES.USER_DATA, { keyPath: 'id' });
      userStore.createIndex('email', 'email', { unique: true });
    }

    // Courses store
    if (!db.objectStoreNames.contains(STORES.COURSES)) {
      const coursesStore = db.createObjectStore(STORES.COURSES, { keyPath: 'id' });
      coursesStore.createIndex('enrollmentStatus', 'enrollmentStatus');
      coursesStore.createIndex('lastAccessed', 'lastAccessed');
    }

    // Course content store (for large content like videos)
    if (!db.objectStoreNames.contains(STORES.COURSE_CONTENT)) {
      const contentStore = db.createObjectStore(STORES.COURSE_CONTENT, { keyPath: 'id' });
      contentStore.createIndex('courseId', 'courseId');
      contentStore.createIndex('type', 'type');
    }

    // Progress tracking store
    if (!db.objectStoreNames.contains(STORES.PROGRESS)) {
      const progressStore = db.createObjectStore(STORES.PROGRESS, { keyPath: 'id' });
      progressStore.createIndex('userId', 'userId');
      progressStore.createIndex('courseId', 'courseId');
      progressStore.createIndex('moduleId', 'moduleId');
      progressStore.createIndex('synced', 'synced');
      progressStore.createIndex('timestamp', 'timestamp');
    }

    // Offline actions queue
    if (!db.objectStoreNames.contains(STORES.OFFLINE_ACTIONS)) {
      const actionsStore = db.createObjectStore(STORES.OFFLINE_ACTIONS, { keyPath: 'id' });
      actionsStore.createIndex('priority', 'priority');
      actionsStore.createIndex('timestamp', 'timestamp');
      actionsStore.createIndex('type', 'type');
    }

    // Settings store
    if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
      db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
    }

    // Cache metadata store
    if (!db.objectStoreNames.contains(STORES.CACHE_METADATA)) {
      const cacheStore = db.createObjectStore(STORES.CACHE_METADATA, { keyPath: 'key' });
      cacheStore.createIndex('type', 'type');
      cacheStore.createIndex('lastAccessed', 'lastAccessed');
      cacheStore.createIndex('expiresAt', 'expiresAt');
    }
  }

  async ensureConnection(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.init();
    }
    if (!this.db) {
      throw new Error('Database connection failed');
    }
    return this.db;
  }

  // Generic CRUD operations
  async add<T>(storeName: string, data: T): Promise<void> {
    const db = await this.ensureConnection();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.add(data);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to add data to ${storeName}`));
    });
  }

  async put<T>(storeName: string, data: T): Promise<void> {
    const db = await this.ensureConnection();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(data);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to update data in ${storeName}`));
    });
  }

  async get<T>(storeName: string, key: string): Promise<T | undefined> {
    const db = await this.ensureConnection();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error(`Failed to get data from ${storeName}`));
    });
  }

  async getAll<T>(storeName: string): Promise<T[]> {
    const db = await this.ensureConnection();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error(`Failed to get all data from ${storeName}`));
    });
  }

  async delete(storeName: string, key: string): Promise<void> {
    const db = await this.ensureConnection();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to delete data from ${storeName}`));
    });
  }

  async getByIndex<T>(storeName: string, indexName: string, value: any): Promise<T[]> {
    const db = await this.ensureConnection();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(value);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error(`Failed to query index ${indexName} in ${storeName}`));
    });
  }

  async clear(storeName: string): Promise<void> {
    const db = await this.ensureConnection();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to clear ${storeName}`));
    });
  }
}

// Singleton instance
const dbManager = new IndexedDBManager();

// High-level API functions
export const initDB = () => dbManager.init();

// User data operations
export const saveUserData = (userData: UserData) => 
  dbManager.put(STORES.USER_DATA, userData);

export const getUserData = (userId: string): Promise<UserData | undefined> => 
  dbManager.get(STORES.USER_DATA, userId);

export const getCurrentUser = async (): Promise<UserData | undefined> => {
  const users = await dbManager.getAll<UserData>(STORES.USER_DATA);
  return users.find(user => user.offline);
};

// Course operations
export const saveCourse = (course: CourseData) => 
  dbManager.put(STORES.COURSES, course);

export const getCourse = (courseId: string): Promise<CourseData | undefined> => 
  dbManager.get(STORES.COURSES, courseId);

export const getAllCourses = (): Promise<CourseData[]> => 
  dbManager.getAll(STORES.COURSES);

export const getEnrolledCourses = (): Promise<CourseData[]> => 
  dbManager.getByIndex(STORES.COURSES, 'enrollmentStatus', 'enrolled');

export const deleteCourse = (courseId: string) => 
  dbManager.delete(STORES.COURSES, courseId);

// Progress operations
export const saveProgress = (progress: ProgressData) => {
  progress.id = progress.id || `${progress.courseId}-${progress.moduleId}-${progress.userId}-${Date.now()}`;
  return dbManager.put(STORES.PROGRESS, progress);
};

export const getProgress = (progressId: string): Promise<ProgressData | undefined> => 
  dbManager.get(STORES.PROGRESS, progressId);

export const getCourseProgress = (courseId: string): Promise<ProgressData[]> => 
  dbManager.getByIndex(STORES.PROGRESS, 'courseId', courseId);

export const getUserProgress = (userId: string): Promise<ProgressData[]> => 
  dbManager.getByIndex(STORES.PROGRESS, 'userId', userId);

export const getUnsyncedProgress = (): Promise<ProgressData[]> => 
  dbManager.getByIndex(STORES.PROGRESS, 'synced', false);

// Offline actions queue
export const queueOfflineAction = (action: Omit<OfflineAction, 'id' | 'timestamp' | 'retryCount' | 'maxRetries'>) => {
  const fullAction: OfflineAction = {
    id: `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    retryCount: 0,
    maxRetries: action.priority === 1 ? 5 : 3, // High priority gets more retries
    ...action
  };
  return dbManager.add(STORES.OFFLINE_ACTIONS, fullAction);
};

export const getOfflineActions = (): Promise<OfflineAction[]> => 
  dbManager.getAll(STORES.OFFLINE_ACTIONS);

export const getOfflineActionsByPriority = (priority: number): Promise<OfflineAction[]> => 
  dbManager.getByIndex(STORES.OFFLINE_ACTIONS, 'priority', priority);

export const removeOfflineAction = (actionId: string) => 
  dbManager.delete(STORES.OFFLINE_ACTIONS, actionId);

export const updateOfflineAction = (action: OfflineAction) => 
  dbManager.put(STORES.OFFLINE_ACTIONS, action);

// Settings operations
export const saveSetting = (key: string, value: any) => 
  dbManager.put(STORES.SETTINGS, { key, value });

export const getSetting = async (key: string): Promise<any> => {
  const result = await dbManager.get<{ key: string; value: any }>(STORES.SETTINGS, key);
  return result?.value;
};

// Cache metadata operations
export const saveCacheMetadata = (metadata: CacheMetadata) => 
  dbManager.put(STORES.CACHE_METADATA, metadata);

export const getCacheMetadata = (key: string): Promise<CacheMetadata | undefined> => 
  dbManager.get(STORES.CACHE_METADATA, key);

export const getAllCacheMetadata = (): Promise<CacheMetadata[]> => 
  dbManager.getAll(STORES.CACHE_METADATA);

export const deleteCacheMetadata = (key: string) => 
  dbManager.delete(STORES.CACHE_METADATA, key);

// Utility functions
export const clearAllOfflineData = async (): Promise<void> => {
  const stores = Object.values(STORES);
  for (const store of stores) {
    await dbManager.clear(store);
  }
};

export const getStorageStats = async () => {
  const stats = {
    users: 0,
    courses: 0,
    progress: 0,
    offlineActions: 0,
    cacheItems: 0,
    totalSize: 0
  };

  try {
    const [users, courses, progress, actions, cache] = await Promise.all([
      dbManager.getAll(STORES.USER_DATA),
      dbManager.getAll(STORES.COURSES),
      dbManager.getAll(STORES.PROGRESS),
      dbManager.getAll(STORES.OFFLINE_ACTIONS),
      dbManager.getAll(STORES.CACHE_METADATA)
    ]);

    stats.users = users.length;
    stats.courses = courses.length;
    stats.progress = progress.length;
    stats.offlineActions = actions.length;
    stats.cacheItems = cache.length;
    stats.totalSize = (cache as CacheMetadata[]).reduce((sum: number, item: CacheMetadata) => sum + item.size, 0);

    return stats;
  } catch (error) {
    console.error('Failed to get storage stats:', error);
    return stats;
  }
};

// Data cleanup utilities
export const cleanupExpiredCache = async (): Promise<void> => {
  const now = Date.now();
  const allMetadata = await getAllCacheMetadata();
  
  for (const metadata of allMetadata) {
    if (metadata.expiresAt && metadata.expiresAt < now) {
      await deleteCacheMetadata(metadata.key);
    }
  }
};

export const cleanupOldProgress = async (daysOld: number = 30): Promise<void> => {
  const cutoff = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
  const allProgress = await dbManager.getAll<ProgressData>(STORES.PROGRESS);
  
  for (const progress of allProgress) {
    if (progress.synced && progress.timestamp < cutoff) {
      await dbManager.delete(STORES.PROGRESS, progress.id);
    }
  }
};

// Export the manager for advanced usage
export { dbManager };

// Initialize on import
initDB().catch(console.error); 