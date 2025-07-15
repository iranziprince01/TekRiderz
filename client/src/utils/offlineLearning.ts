/**
 * Simple offline learning utilities
 * Basic functionality for offline course access
 */

import { essentialDataCache } from './offlineDataCache';
import { offlineOperations } from './offlineOperations';

export const offlineLearning = {
  // Get courses available offline
  getOfflineCourses: async (userId: string): Promise<any[]> => {
    try {
      return essentialDataCache.getEnrolledCourses(userId);
    } catch (error) {
      console.warn('Failed to get offline courses:', error);
      return [];
    }
  },

  // Check if course is available offline
  isCourseAvailable: async (courseId: string, userId: string): Promise<boolean> => {
    try {
      const courses = essentialDataCache.getEnrolledCourses(userId);
      return courses.some((course: any) => course.id === courseId || course._id === courseId);
    } catch (error) {
      return false;
    }
  },

  // Save learning progress
  saveProgress: async (userId: string, courseId: string, progressData: any): Promise<void> => {
    try {
      await offlineOperations.updateVideoProgress({ 
        courseId, 
        ...progressData 
      }, userId);
    } catch (error) {
      console.warn('Failed to save progress offline:', error);
    }
  },

  // Submit quiz offline
  submitQuiz: async (userId: string, quizData: any): Promise<void> => {
    try {
      await offlineOperations.submitQuiz(quizData, userId);
    } catch (error) {
      console.warn('Failed to submit quiz offline:', error);
    }
  },

  // Get user profile offline
  getUserProfile: async (userId: string): Promise<any> => {
    try {
      return essentialDataCache.getProfile(userId);
    } catch (error) {
      return null;
    }
  },

  // Get user certificates offline
  getUserCertificates: async (userId: string): Promise<any[]> => {
    try {
      return essentialDataCache.getCertificates(userId);
    } catch (error) {
      return [];
    }
  }
}; 