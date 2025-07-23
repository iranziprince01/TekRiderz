import React, { useState, useEffect } from 'react';

interface ServiceWorkerStatus {
  registered: boolean;
  active: boolean;
  scope: string;
  state: string;
}

const OfflineTest: React.FC = () => {
  const [swStatus, setSwStatus] = useState<ServiceWorkerStatus | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    // Check Service Worker status
    const checkServiceWorker = async () => {
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.getRegistration();
          if (registration) {
            setSwStatus({
              registered: true,
              active: !!registration.active,
              scope: registration.scope,
              state: registration.active?.state || 'unknown'
            });
          } else {
            setSwStatus({
              registered: false,
              active: false,
              scope: '',
              state: 'not registered'
            });
          }
        } catch (error) {
          console.error('Error checking Service Worker:', error);
          setSwStatus({
            registered: false,
            active: false,
            scope: '',
            state: 'error'
          });
        }
      } else {
        setSwStatus({
          registered: false,
          active: false,
          scope: '',
          state: 'not supported'
        });
      }
    };

    checkServiceWorker();

    // Listen for online/offline events
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const registerServiceWorker = async () => {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('Service Worker registered:', registration);
        // Refresh the page to show updated status
        window.location.reload();
      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    }
  };

  const unregisterServiceWorker = async () => {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          await registration.unregister();
          console.log('Service Worker unregistered');
          window.location.reload();
        }
      } catch (error) {
        console.error('Service Worker unregistration failed:', error);
      }
    }
  };

  if (!swStatus) {
    return <div className="p-4">Loading Service Worker status...</div>;
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-md max-w-md mx-auto mt-8">
      <h2 className="text-xl font-bold mb-4">Service Worker Status</h2>
      
      <div className="space-y-3">
        <div className="flex justify-between">
          <span className="font-medium">Network Status:</span>
          <span className={`px-2 py-1 rounded text-sm ${isOnline ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {isOnline ? '🟢 Online' : '🔴 Offline'}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="font-medium">Service Worker:</span>
          <span className={`px-2 py-1 rounded text-sm ${swStatus.registered ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {swStatus.registered ? '✅ Registered' : '❌ Not Registered'}
          </span>
        </div>

        {swStatus.registered && (
          <>
            <div className="flex justify-between">
              <span className="font-medium">Active:</span>
              <span className={`px-2 py-1 rounded text-sm ${swStatus.active ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                {swStatus.active ? '✅ Active' : '⏳ Inactive'}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="font-medium">State:</span>
              <span className="px-2 py-1 rounded text-sm bg-gray-100 text-gray-800">
                {swStatus.state}
              </span>
            </div>

            <div className="text-sm text-gray-600">
              <strong>Scope:</strong> {swStatus.scope}
            </div>
          </>
        )}
      </div>

      <div className="mt-6 space-y-2">
        {!swStatus.registered ? (
          <button
            onClick={registerServiceWorker}
            className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 transition-colors"
          >
            Register Service Worker
          </button>
        ) : (
          <button
            onClick={unregisterServiceWorker}
            className="w-full bg-red-500 text-white py-2 px-4 rounded hover:bg-red-600 transition-colors"
          >
            Unregister Service Worker
          </button>
        )}

        <button
          onClick={() => window.location.reload()}
          className="w-full bg-gray-500 text-white py-2 px-4 rounded hover:bg-gray-600 transition-colors"
        >
          Refresh Page
        </button>
      </div>

      <div className="mt-4 p-3 bg-blue-50 rounded text-sm text-blue-800">
        <strong>Testing Instructions:</strong>
        <ol className="mt-2 list-decimal list-inside space-y-1">
          <li>Go to DevTools → Application → Service Workers</li>
          <li>Check "Offline" checkbox</li>
          <li>Refresh the page</li>
          <li>Should see cached app instead of "No internet" page</li>
        </ol>
      </div>
    </div>
  );
};

export default OfflineTest; 