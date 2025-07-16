// Service Worker registration and management utilities
// This ensures SW is registered safely without interfering with app startup

const isLocalhost = Boolean(
  window.location.hostname === 'localhost' ||
  window.location.hostname === '[::1]' ||
  window.location.hostname.match(
    /^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/
  )
);

interface ServiceWorkerEventHandlers {
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onOfflineReady?: () => void;
  onError?: (error: Error) => void;
}

export const registerServiceWorker = (handlers?: ServiceWorkerEventHandlers) => {
  if ('serviceWorker' in navigator) {
    // Don't register SW in development unless explicitly enabled
    if (import.meta.env.DEV && import.meta.env.VITE_ENABLE_SW !== 'true') {
      console.log('Service worker disabled in development mode');
      return;
    }

    // Wait for the page to load before registering SW
    window.addEventListener('load', async () => {
      try {
        await registerSW(handlers);
      } catch (error) {
        console.error('Service worker registration failed:', error);
        handlers?.onError?.(error as Error);
      }
    });
  } else {
    console.log('Service workers are not supported.');
  }
};

async function registerSW(handlers?: ServiceWorkerEventHandlers): Promise<void> {
  const swUrl = '/sw.js';

  if (isLocalhost) {
    // Check if a service worker still exists or not on localhost
    await checkValidServiceWorker(swUrl, handlers);
    
    // Add some additional logging for localhost
    navigator.serviceWorker.ready.then(() => {
      console.log(
        'This web app is being served cache-first by a service worker. ' +
        'To learn more, visit https://cra.link/PWA'
      );
    });
  } else {
    // In production, register service worker normally
    await registerValidSW(swUrl, handlers);
  }
}

async function registerValidSW(swUrl: string, handlers?: ServiceWorkerEventHandlers): Promise<void> {
  try {
    const registration = await navigator.serviceWorker.register(swUrl);
    
    registration.onupdatefound = () => {
      const installingWorker = registration.installing;
      if (!installingWorker) return;

      installingWorker.onstatechange = () => {
        if (installingWorker.state === 'installed') {
          if (navigator.serviceWorker.controller) {
            // At this point, the updated precached content has been fetched,
            // but the previous service worker will still serve the older
            // content until all client tabs are closed.
            console.log(
              'New content is available and will be used when all ' +
              'tabs for this page are closed. See https://cra.link/PWA.'
            );

            // Execute callback
            handlers?.onUpdate?.(registration);
          } else {
            // At this point, everything has been precached.
            // It's the perfect time to display a
            // "Content is cached for offline use." message.
            console.log('Content is cached for offline use.');

            // Execute callback
            handlers?.onSuccess?.(registration);
            handlers?.onOfflineReady?.();
          }
        }
      };
    };

    // Listen for service worker messages
    navigator.serviceWorker.addEventListener('message', (event) => {
      handleServiceWorkerMessage(event.data);
    });

    console.log('Service worker registered successfully');
  } catch (error) {
    console.error('Error during service worker registration:', error);
    throw error;
  }
}

async function checkValidServiceWorker(swUrl: string, handlers?: ServiceWorkerEventHandlers): Promise<void> {
  try {
    // Check if the service worker can be found
    const response = await fetch(swUrl, {
      headers: { 'Service-Worker': 'script' },
    });

    // Ensure service worker exists and that we really are getting a JS file
    const contentType = response.headers.get('content-type');
    
    if (
      response.status === 404 ||
      (contentType != null && contentType.indexOf('javascript') === -1)
    ) {
      // No service worker found. Probably a different app. Reload the page.
      const registration = await navigator.serviceWorker.ready;
      await registration.unregister();
      window.location.reload();
    } else {
      // Service worker found. Proceed as normal.
      await registerValidSW(swUrl, handlers);
    }
  } catch (error) {
    console.log('No internet connection found. App is running in offline mode.');
    handlers?.onOfflineReady?.();
  }
}

// Handle messages from service worker
function handleServiceWorkerMessage(data: any): void {
  console.log('Message from service worker:', data);

  switch (data.type) {
    case 'OFFLINE_READY':
      console.log('App is ready for offline use');
      // Optionally show a notification to the user
      break;
    
    case 'SYNC_COMPLETE':
      console.log('Background sync completed');
      // Show success notification
      showNotification('Data synchronized successfully', 'success');
      break;
    
    case 'CACHE_UPDATED':
      console.log('Cache updated with new content');
      break;
    
    case 'UPDATE_AVAILABLE':
      console.log('New version available');
      // Show update notification
      showUpdateNotification();
      break;
  }
}

// Unregister service worker
export async function unregisterServiceWorker(): Promise<void> {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.unregister();
      console.log('Service worker unregistered');
    } catch (error) {
      console.error('Error unregistering service worker:', error);
    }
  }
}

// Update service worker
export async function updateServiceWorker(): Promise<void> {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.update();
      console.log('Service worker update triggered');
    } catch (error) {
      console.error('Error updating service worker:', error);
    }
  }
}

// Skip waiting and activate new service worker
export async function skipWaitingAndActivate(): Promise<void> {
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.ready;
    
    if (registration.waiting) {
      // Send message to waiting service worker to skip waiting
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      
      // Reload page to use new service worker
      window.location.reload();
    }
  }
}

// Send message to service worker
export function sendMessageToServiceWorker(message: any): void {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage(message);
  }
}

// Request background sync
export function requestBackgroundSync(tag: string = 'sync-offline-actions'): void {
  sendMessageToServiceWorker({
    type: 'REQUEST_SYNC',
    tag
  });
}

// Cache course data
export function cacheOfflineData(data: any): void {
  sendMessageToServiceWorker({
    type: 'CACHE_OFFLINE_DATA',
    data
  });
}

// Simple notification helper (you might want to use a toast library instead)
function showNotification(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
  // This is a simple implementation - in a real app you'd use a proper toast library
  console.log(`${type.toUpperCase()}: ${message}`);
  
  // You could create a custom toast notification here
  // or dispatch an event that your notification system listens to
  window.dispatchEvent(new CustomEvent('sw-notification', {
    detail: { message, type }
  }));
}

// Show update notification
function showUpdateNotification(): void {
  const message = 'A new version is available. Refresh to update?';
  
  if (confirm(message)) {
    skipWaitingAndActivate();
  }
}

// Check if app is running as PWA
export function isPWA(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
         (window.navigator as any).standalone ||
         document.referrer.includes('android-app://');
}

// Get service worker registration
export async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if ('serviceWorker' in navigator) {
    try {
      return await navigator.serviceWorker.ready;
    } catch (error) {
      console.error('Error getting service worker registration:', error);
      return null;
    }
  }
  return null;
}

// Check if service worker is active
export function isServiceWorkerActive(): boolean {
  return 'serviceWorker' in navigator && !!navigator.serviceWorker.controller;
}

// Service worker status
export async function getServiceWorkerStatus(): Promise<{
  supported: boolean;
  registered: boolean;
  active: boolean;
  updateAvailable: boolean;
}> {
  const supported = 'serviceWorker' in navigator;
  let registered = false;
  let active = false;
  let updateAvailable = false;

  if (supported) {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      registered = !!registration;
      active = !!navigator.serviceWorker.controller;
      updateAvailable = !!(registration?.waiting);
    } catch (error) {
      console.error('Error checking service worker status:', error);
    }
  }

  return {
    supported,
    registered,
    active,
    updateAvailable
  };
}

// Default registration with basic handlers
export function initializeServiceWorker(): void {
  registerServiceWorker({
    onUpdate: (registration) => {
      console.log('New content available');
      // You might want to show a toast notification here
    },
    onSuccess: (registration) => {
      console.log('App is ready for offline use');
    },
    onOfflineReady: () => {
      console.log('App is ready to work offline');
    },
    onError: (error) => {
      console.error('Service worker registration failed:', error);
    }
  });
}

// Export default initialization function
export default initializeServiceWorker; 