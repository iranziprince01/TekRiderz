interface OfflineAction {
  type: string;
  data: any;
  timestamp: number;
}

// Simple offline manager without complex PWA features
export const offlineManager = {
  // Store actions for later sync (using localStorage as simple storage)
  storeOfflineAction: (key: string, action: OfflineAction) => {
    try {
      const existing = localStorage.getItem(key);
      const actions = existing ? JSON.parse(existing) : [];
      actions.push(action);
      localStorage.setItem(key, JSON.stringify(actions));
    } catch (error) {
      console.error('Failed to store offline action:', error);
    }
  },

  // Get pending actions
  getOfflineActions: (key: string): OfflineAction[] => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to get offline actions:', error);
      return [];
    }
  },

  // Clear offline actions
  clearOfflineActions: (key: string) => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Failed to clear offline actions:', error);
    }
  },

  // Store course progress offline
  storeCourseProgress: async (courseId: string, progress: number, token: string) => {
    const action: OfflineAction = {
      type: 'course-progress',
      data: { courseId, progress, token },
      timestamp: Date.now()
    };
    offlineManager.storeOfflineAction('pendingProgress', action);
  },

  // Store user data offline
  storeUserData: async (userData: any, token: string) => {
    const action: OfflineAction = {
      type: 'user-data',
      data: { userData, token },
      timestamp: Date.now()
    };
    offlineManager.storeOfflineAction('pendingUserData', action);
  },

  // Cache course data (simple localStorage implementation)
  cacheCourse: async (course: any) => {
    try {
      const cached = localStorage.getItem('cachedCourses');
      const courses = cached ? JSON.parse(cached) : {};
      courses[course.id] = {
        ...course,
        cachedAt: Date.now()
      };
      localStorage.setItem('cachedCourses', JSON.stringify(courses));
    } catch (error) {
      console.error('Failed to cache course:', error);
    }
  },

  // Get cached course
  getCachedCourse: async (courseId: string) => {
    try {
      const cached = localStorage.getItem('cachedCourses');
      const courses = cached ? JSON.parse(cached) : {};
      return courses[courseId] || null;
    } catch (error) {
      console.error('Failed to get cached course:', error);
      return null;
    }
  },

  // Get all cached courses
  getCachedCourses: async () => {
    try {
      const cached = localStorage.getItem('cachedCourses');
      const courses = cached ? JSON.parse(cached) : {};
      return Object.values(courses);
    } catch (error) {
      console.error('Failed to get cached courses:', error);
      return [];
    }
  },

  // Sync pending actions when online
  syncPendingActions: async () => {
    if (!navigator.onLine) return;

    try {
      const progressActions = offlineManager.getOfflineActions('pendingProgress');
      const userDataActions = offlineManager.getOfflineActions('pendingUserData');

      // Process progress actions
      for (const action of progressActions) {
        try {
          // Here you would make actual API calls to sync data
          console.log('Syncing progress:', action.data);
          // await apiClient.updateProgress(action.data);
        } catch (error) {
          console.error('Failed to sync progress:', error);
        }
      }

      // Process user data actions
      for (const action of userDataActions) {
        try {
          // Here you would make actual API calls to sync data
          console.log('Syncing user data:', action.data);
          // await apiClient.updateUserData(action.data);
        } catch (error) {
          console.error('Failed to sync user data:', error);
        }
      }

      // Clear synced actions
      offlineManager.clearOfflineActions('pendingProgress');
      offlineManager.clearOfflineActions('pendingUserData');
    } catch (error) {
      console.error('Failed to sync pending actions:', error);
    }
  }
}; 