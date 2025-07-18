import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { NetworkStatusProvider } from './contexts/NetworkStatusContext';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { NotificationManager } from './components/ui/NotificationManager';
import ProtectedRoute from './components/ProtectedRoute';
import OfflineIndicator from './components/common/OfflineIndicator';
import NetworkStatusIndicator from './components/common/NetworkStatusIndicator';
import OfflineLoginIndicator from './components/common/OfflineLoginIndicator';

// Pages
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import OTPVerify from './pages/OTPVerify';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import Course from './pages/Course';
import Profile from './pages/Profile';
import NotFound from './pages/NotFound';

function App() {
  // Initialize app systems after mount
  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('Initializing TekRiders App...');
        
        // Initialize service worker in production only
        if (import.meta.env.PROD && 'serviceWorker' in navigator) {
          try {
            const registration = await navigator.serviceWorker.register('/sw.js', {
              scope: '/'
            });
            console.log('Service Worker registered:', registration.scope);
          } catch (swError: any) {
                          console.warn('Service Worker registration failed:', swError?.message || 'Unknown error');
          }
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
      console.error('🚨 Unhandled promise rejection caught:', event.reason);
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
      console.error('🚨 Unhandled error during app initialization:', error?.message || 'Unknown error');
    });

    // Cleanup
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
    };
  }, []);

  return (
    <ErrorBoundary>
      <NetworkStatusProvider>
      <ThemeProvider>
      <LanguageProvider>
          <Router>
            <AuthProvider>
              <div className="App">
                <NotificationManager />
                
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

                  {/* 404 */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </div>
            </AuthProvider>
          </Router>
        </LanguageProvider>
        </ThemeProvider>
      </NetworkStatusProvider>
    </ErrorBoundary>
  );
}

export default App;