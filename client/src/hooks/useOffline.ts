import { useState, useEffect } from 'react';
import { offlineManager } from '../utils/offline';

export const useOffline = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingActions, setPendingActions] = useState(0);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      offlineManager.syncPendingActions();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check for pending actions
    const checkPendingActions = async () => {
      try {
        const progress = await offlineManager.getOfflineActions('pendingProgress');
        const userData = await offlineManager.getOfflineActions('pendingUserData');
        setPendingActions(progress.length + userData.length);
      } catch (error) {
        console.error('Failed to check pending actions:', error);
      }
    };

    checkPendingActions();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const storeCourseProgress = async (courseId: string, progress: number, token: string) => {
    await offlineManager.storeCourseProgress(courseId, progress, token);
    setPendingActions(prev => prev + 1);
  };

  const storeUserData = async (userData: any, token: string) => {
    await offlineManager.storeUserData(userData, token);
    setPendingActions(prev => prev + 1);
  };

  const getCachedCourse = async (courseId: string) => {
    return await offlineManager.getCachedCourse(courseId);
  };

  const getCachedCourses = async () => {
    return await offlineManager.getCachedCourses();
  };

  const cacheCourse = async (course: any) => {
    await offlineManager.cacheCourse(course);
  };

  return {
    isOnline,
    pendingActions,
    storeCourseProgress,
    storeUserData,
    getCachedCourse,
    getCachedCourses,
    cacheCourse
  };
};