/**
 * Offline Debugging Utilities for TekRiders Platform
 * Use these functions in the browser console to test offline functionality
 */

import { essentialDataCache } from './offlineDataCache';
import { offlineAuthManager } from './offlineAuth';

// Make debugging functions available globally in development
declare global {
  interface Window {
    TekRidersOfflineDebug: typeof OfflineDebug;
  }
}

export class OfflineDebug {
  /**
   * Check offline data status for a user
   */
  static checkOfflineData(userId?: string): void {
    const currentUserId = userId || localStorage.getItem('currentUserId');
    
    if (!currentUserId) {
      console.log('❌ No user ID provided or found in localStorage');
      return;
    }

    console.log('🔍 Checking offline data for user:', currentUserId);
    
    const status = essentialDataCache.getOfflineDataStatus(currentUserId);
    
    console.table({
      'User Profile': status.profile ? '✅ Available' : '❌ Missing',
      'Courses': `📚 ${status.courses} courses`,
      'Enrollments': `🎓 ${status.enrollments} enrollments`,
      'Certificates': `🏆 ${status.certificates} certificates`,
      'Statistics': status.stats ? '✅ Available' : '❌ Missing',
      'Cache Size': status.totalCacheSize
    });

    if (status.enrollments === 0 && status.courses === 0) {
      console.warn('⚠️ No offline data found. Make sure to:');
      console.log('1. Login while online');
      console.log('2. Browse courses and enroll in some');
      console.log('3. Visit your dashboard to cache data');
      console.log('4. Then go offline to test');
    }
  }

  /**
   * Simulate going offline (network status)
   */
  static simulateOffline(): void {
    // Override navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false
    });
    
    // Dispatch offline event
    window.dispatchEvent(new Event('offline'));
    
    console.log('📴 Simulated offline mode');
    console.log('👉 Refresh the page or navigate to see offline UI');
    console.log('👉 Use TekRidersOfflineDebug.simulateOnline() to restore');
  }

  /**
   * Simulate going back online
   */
  static simulateOnline(): void {
    // Restore navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true
    });
    
    // Dispatch online event
    window.dispatchEvent(new Event('online'));
    
    console.log('🌐 Simulated online mode restored');
  }

  /**
   * Clear all offline data (for testing)
   */
  static clearOfflineData(): void {
    const keys = Object.keys(localStorage);
    const tekridersKeys = keys.filter(key => key.startsWith('tekr_'));
    
    tekridersKeys.forEach(key => localStorage.removeItem(key));
    
    console.log(`🧹 Cleared ${tekridersKeys.length} offline cache entries`);
    console.log('👉 Reload the page to see the effect');
  }

  /**
   * Force cache refresh (useful for testing)
   */
  static async refreshCache(): Promise<void> {
    const userId = localStorage.getItem('currentUserId');
    
    if (!userId) {
      console.log('❌ No user ID found - please login first');
      return;
    }

    try {
      console.log('🔄 Forcing cache refresh...');
      
      // Dynamic import to avoid circular dependencies
      const { apiClient } = await import('./api');
      const result = await essentialDataCache.preloadEssentialData(userId, apiClient);
      
      console.log('✅ Cache refresh completed');
      console.table({
        'Profile': result.profile ? '✅ Cached' : '❌ Failed',
        'All Courses': `📚 ${result.allCourses?.length || 0}`,
        'Enrollments': `🎓 ${result.enrolledCourses?.length || 0}`,
        'Certificates': `🏆 ${result.certificates?.length || 0}`,
        'Statistics': result.stats ? '✅ Cached' : '❌ Failed'
      });
      
    } catch (error) {
      console.error('❌ Cache refresh failed:', error);
    }
  }

  /**
   * Check if offline authentication is available
   */
  static checkOfflineAuth(): void {
    const currentUser = localStorage.getItem('currentUserId');
    const userEmail = localStorage.getItem('userEmail');
    
    console.log('🔐 Offline Authentication Status:');
    console.table({
      'Current User ID': currentUser || 'None',
      'User Email': userEmail || 'None',
      'Has Offline Capabilities': currentUser ? 
        offlineAuthManager.hasOfflineCapabilities(userEmail || '') : false
    });
  }

  /**
   * Show all available debug commands
   */
  static help(): void {
    console.log('🚀 TekRiders Offline Debug Commands:');
    console.log('');
    console.log('📊 TekRidersOfflineDebug.checkOfflineData() - Check cached data status');
    console.log('🔄 TekRidersOfflineDebug.refreshCache() - Force refresh cache from server');
    console.log('📴 TekRidersOfflineDebug.simulateOffline() - Simulate offline mode');
    console.log('🌐 TekRidersOfflineDebug.simulateOnline() - Restore online mode');
    console.log('🧹 TekRidersOfflineDebug.clearOfflineData() - Clear all cached data');
    console.log('🔐 TekRidersOfflineDebug.checkOfflineAuth() - Check auth status');
    console.log('❓ TekRidersOfflineDebug.help() - Show this help');
    console.log('');
    console.log('💡 Pro tip: Login online first, then test offline functionality!');
  }
}

// Make available globally in development
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  window.TekRidersOfflineDebug = OfflineDebug;
  console.log('🛠️ TekRiders Offline Debug tools loaded!');
  console.log('👉 Type TekRidersOfflineDebug.help() for available commands');
} 