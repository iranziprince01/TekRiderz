import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { NotificationManager } from './components/ui/NotificationManager';
import ProtectedRoute from './components/ProtectedRoute';
import OfflineStatus from './components/common/OfflineStatus';
import { performOneTimeSync, checkSyncNeeded, clearOfflineData } from './offline/syncManager';
import { localDB } from './offline/db';



// Offline Status Hook
const useOfflineStatus = () => {
  const [isOffline, setIsOffline] = React.useState(!navigator.onLine);

  React.useEffect(() => {
    const handleOnline = () => {
      // Reduce logging to prevent console spam
      // console.log('App came online');
      setIsOffline(false);
    };

    const handleOffline = () => {
      // Reduce logging to prevent console spam
      // console.log('App went offline');
      setIsOffline(true);
    };

    // Set initial state
    setIsOffline(!navigator.onLine);

    // Add event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Cleanup
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOffline;
};

// Offline Banner Component
const OfflineBanner: React.FC = () => {
  const isOffline = useOfflineStatus();

  if (!isOffline) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 text-yellow-900 px-4 py-2 text-center text-sm font-medium shadow-md border-b border-yellow-600">
      <div className="flex items-center justify-center space-x-2">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        <span>Offline Mode: Viewing cached content</span>
      </div>
    </div>
  );
};

// Sync Initializer Component
const SyncInitializer: React.FC = () => {
  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    // Set up online/offline event listeners only once
    const handleOnline = async () => {
      try {
        // Check if sync is needed when coming back online
        const needsSync = await checkSyncNeeded();
        if (needsSync && isAuthenticated && user?.role === 'learner') {
          console.log('🔄 App came online, performing one-time sync...');
          await performOneTimeSync();
        }
      } catch (error) {
        console.error('Failed to perform sync on online:', error);
      }
    };

    const handleOffline = () => {
      console.log('📱 App went offline - continuing with cached data');
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

// Pages
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
import NotFound from './pages/NotFound';

function App() {
  const isOffline = useOfflineStatus();

  // Initialize app systems after mount
  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('Initializing TekRiders App...');
        
        // Initialize local database
        try {
          console.log('🔗 Initializing local database...');
          console.log('✅ Local database available:', localDB.name);
          console.log('📱 App will work in offline mode with local database');
        } catch (error) {
          console.warn('⚠️ Failed to initialize local database:', error);
          // Continue without database - app will work with basic functionality
        }

        console.log('App initialization completed successfully');
        
        // Dev tools message
        if (import.meta.env.DEV) {
          console.log(`
      TekRiders Development Tools Available:
   🧹 clearAllStorage()        - Clear all browser storage
   
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
      console.error('Unhandled promise rejection caught:', event.reason);
      // Log additional details if available
      if (event.reason?.message) {
        console.error('Error message:', event.reason.message);
      }
      if (event.reason?.stack) {
        console.error('Error stack:', event.reason.stack);
      }
      event.preventDefault(); // Prevent default browser behavior
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
              <SyncInitializer />
              <div className={`App ${isOffline ? 'pt-10' : ''}`}>
                <OfflineBanner />
                <NotificationManager />
                <OfflineStatus showDetails={false} />
                
                <Routes>
                  {/* Public routes */}
                  <Route path="/" element={<Landing />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/signup" element={<Signup />} />
                  <Route path="/verify-otp" element={<OTPVerify />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />

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

                  {/* 404 */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </div>
            </AuthProvider>
          </Router>
        </LanguageProvider>
        </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;