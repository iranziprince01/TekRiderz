/**
 * TekRiders Frontend Application
 * 
 * Main React application for the TekRiders e-learning platform.
 * Provides offline-first learning experience with PWA capabilities,
 * multi-role user management, and real-time synchronization.
 * 
 * @author TekRiders Team
 * @version 1.0.0
 */

import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Context providers for global state management
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';
import NotificationProvider from './contexts/NotificationContext';

// Core UI components
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { NotificationManager } from './components/ui/NotificationManager';
import ProtectedRoute from './components/ProtectedRoute';

// Offline and PWA components
import UnifiedOfflineStatus from './components/common/UnifiedOfflineStatus';
import OfflineInitializer from './components/common/OfflineInitializer';
import PWAInstallPrompt from './components/common/PWAInstallPrompt';
import PWAStatus from './components/common/PWAStatus';

// Offline functionality and synchronization
import { performOneTimeSync, checkSyncNeeded, clearOfflineData } from './offline/syncManager';
import { localDB } from './offline/db';
import { initializeOfflineEssentials, cleanupOfflineEssentials, getEssentialOfflineStatus } from './offline/offlineEssentials';
import './utils/offlineTestUtils';

// Application page components
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import OTPVerify from './pages/OTPVerify';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import Course from './pages/Course';
import Profile from './pages/Profile';
import Analytics from './pages/Analytics';
import Certificates from './pages/Certificates';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsAndConditions from './pages/TermsAndConditions';
import Notifications from './pages/Notifications';
import NotFound from './pages/NotFound';






/**
 * Sync Initializer Component
 * 
 * Manages online/offline state transitions and triggers synchronization
 * when the application comes back online. Only runs for authenticated learners.
 */
const SyncInitializer: React.FC = () => {
  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    // Set up online/offline event listeners only once
    const handleOnline = async () => {
      try {
        // Check if sync is needed when coming back online
        const needsSync = await checkSyncNeeded();
        if (needsSync && isAuthenticated && user?.role === 'learner') {
          console.log('App came online, performing one-time sync...');
          await performOneTimeSync();
        }
      } catch (error) {
        console.error('Failed to perform sync on online:', error);
      }
    };

    const handleOffline = () => {
      console.log('App went offline - continuing with cached data');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Cleanup
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []); // Empty dependency array - only run once

  return null; // This component doesn't render anything
};


/**
 * Main Application Component
 * 
 * Root component that initializes the TekRiders application,
 * sets up offline functionality, and provides the routing structure.
 */
function App() {

  // Initialize app systems after mount
  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('Initializing TekRiders App...');
        
        // Initialize local database for offline functionality
        try {
          console.log('Initializing local database...');
          console.log('Local database available:', localDB.name);
          console.log('App will work in offline mode with local database');
        } catch (error) {
          console.warn('Failed to initialize local database:', error);
          // Continue without database - app will work with basic functionality
        }

        // Initialize offline essentials for PWA functionality
        try {
          console.log('Initializing offline essentials...');
          const { initializeOfflineEssentials, testOfflineSystem } = await import('./offline/offlineEssentials');
          
          const offlineInit = await initializeOfflineEssentials();
          if (offlineInit.success) {
            console.log('✅ Offline essentials initialized:', offlineInit.message);
          } else {
            console.warn('⚠️ Offline essentials initialization failed:', offlineInit.message);
          }
          
          // Test the offline system
          const testResult = await testOfflineSystem();
          console.log('🧪 Offline system test result:', testResult);
          
          // Set global offline status
          if (testResult.success) {
            localStorage.setItem('offline_system_ready', 'true');
            console.log('✅ Offline system is ready for use');
          } else {
            localStorage.setItem('offline_system_ready', 'false');
            console.warn('⚠️ Offline system has issues:', testResult.message);
          }
        } catch (error) {
          console.warn('⚠️ Failed to initialize offline essentials:', error);
          localStorage.setItem('offline_system_ready', 'false');
        }

        console.log('App initialization completed successfully');
        
        // Dev tools message
        if (import.meta.env.DEV) {
          // Add global offline test function
          (window as any).testOfflineSystem = async () => {
            const { testOfflineSystem } = await import('./offline/offlineEssentials');
            const result = await testOfflineSystem();
            console.log('🧪 Offline System Test Result:', result);
            return result;
          };
          
          // Add global cache status function
          (window as any).getOfflineStatus = () => {
            const { getEssentialOfflineStatus } = require('./offline/offlineEssentials');
            const status = getEssentialOfflineStatus();
            console.log('📊 Offline Status:', status);
            return status;
          };
          
          console.log(`
      TekRiders Development Tools Available:
   🧹 clearAllStorage()        - Clear all browser storage
   🧪 testOfflineSystem()      - Test offline system components
   📊 getOfflineStatus()       - Get current offline status
   
Type any command in the console to use these tools.
          `);
        }
      } catch (error: any) {
        console.error('App initialization failed:', error?.message || 'Unknown error');
        // Don't throw - allow app to continue with basic functionality
      }
    };

    // Global error handler for unhandled promises
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('🚨 Unhandled promise rejection caught:', {
        reason: event.reason,
        message: event.reason?.message,
        status: event.reason?.status,
        code: event.reason?.code,
        stack: event.reason?.stack
      });
      
      // Prevent the error from being logged as an uncaught exception
      event.preventDefault();
      
      // Don't show user-facing errors for non-critical promise rejections
      // These are usually background operations that failed
      if (event.reason?.code === 403) {
        console.warn('⚠️ 403 Forbidden error caught - likely a background API call that failed');
      }
    };

    // Global error handler
    const handleError = (event: ErrorEvent) => {
      console.error('🚨 Global error caught:', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error
      });
    };

    // Add error listeners before initialization
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);

    // Initialize with error handling
    initializeApp().catch((error: any) => {
      console.error('Unhandled error during app initialization:', error?.message || 'Unknown error');
    });

    // Cleanup
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
    };
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider>
      <LanguageProvider>
          <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <AuthProvider>
              <NotificationProvider>
                <OfflineInitializer>
                  <SyncInitializer />
                  <div className="App">
                    <NotificationManager />
                    <UnifiedOfflineStatus showForLearnersOnly={true} />
                    <PWAStatus />
                    <PWAInstallPrompt />
                
                <Routes>
                  {/* Public routes */}
                  <Route path="/" element={<Landing />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/signup" element={<Signup />} />
                  <Route path="/verify-otp" element={<OTPVerify />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                  <Route path="/terms-and-conditions" element={<TermsAndConditions />} />

                  {/* Protected routes */}
                  <Route path="/dashboard/*" element={
                      <ProtectedRoute>
                        <Dashboard />
                      </ProtectedRoute>
                  } />
                  
                  <Route path="/course/:id/*" element={
                      <ProtectedRoute>
                        <Course />
                      </ProtectedRoute>
                  } />
                  
                  <Route path="/profile" element={
                      <ProtectedRoute>
                        <Profile />
                      </ProtectedRoute>
                  } />
                  
                  <Route path="/analytics" element={
                      <ProtectedRoute>
                        <Analytics />
                      </ProtectedRoute>
                  } />
                  
                  <Route path="/certificates" element={
                      <ProtectedRoute>
                        <Certificates />
                      </ProtectedRoute>
                  } />
                  
                  <Route path="/notifications" element={
                      <ProtectedRoute>
                        <Notifications />
                      </ProtectedRoute>
                  } />

                  {/* 404 */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
                                </div>
                </OfflineInitializer>
              </NotificationProvider>
            </AuthProvider>
          </Router>
        </LanguageProvider>
        </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;