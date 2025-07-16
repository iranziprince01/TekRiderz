/**
 * Simple offline API using localStorage
 * Basic offline data management
 */

import { essentialDataCache } from './offlineDataCache';

export const offlineApi = {
  // Get user courses offline
  getUserCourses: async (userId: string): Promise<any[]> => {
    try {
      return essentialDataCache.getEnrolledCourses(userId);
    } catch (error) {
      return [];
    }
  },

  // Get user profile offline
  getUserProfile: async (userId: string): Promise<any | null> => {
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
  },

  // Save data to offline storage
  saveToOffline: async (key: string, data: any): Promise<void> => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save to offline storage:', error);
    }
  },

  // Get data from offline storage
  getFromOffline: async (key: string): Promise<any | null> => {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      return null;
    }
  }
}; 