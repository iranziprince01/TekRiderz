import React, { useEffect, useState } from 'react';
import { initializeOfflineEssentials } from '../../offline/offlineEssentials';

interface OfflineInitializerProps {
  children: React.ReactNode;
}

const OfflineInitializer: React.FC<OfflineInitializerProps> = ({ children }) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const initializeOffline = async () => {
      try {
        console.log('🚀 Initializing offline functionality...');
        
        // Initialize offline essentials
        const result = await initializeOfflineEssentials();
        
        if (result.success) {
          console.log('✅ Offline functionality initialized successfully');
          setIsInitialized(true);
        } else {
          console.warn('⚠️ Offline initialization completed with warnings:', result.message);
          setIsInitialized(true); // Still proceed even with warnings
        }
      } catch (error) {
        console.error('❌ Failed to initialize offline functionality:', error);
        setIsInitialized(true); // Proceed anyway to not block the app
      } finally {
        setIsInitializing(false);
      }
    };

    initializeOffline();
  }, []);

  // Show loading state while initializing
  if (isInitializing) {
    return (
      <div className="fixed inset-0 bg-white dark:bg-gray-900 flex items-center justify-center z-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">
            Initializing offline functionality...
          </p>
        </div>
      </div>
    );
  }

  // Render children once initialized
  return <>{children}</>;
};

export default OfflineInitializer; 