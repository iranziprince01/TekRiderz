// Offline Navigation Utils for TekRiders PWA
// Handles SPA routing and page caching when offline

interface CachedRoute {
  path: string;
  html: string;
  timestamp: number;
  dependencies: string[];
}

class OfflineNavigationManager {
  private dbName = 'TekridersNavigation';
  private dbVersion = 1;
  private storeName = 'routes';
  private db: IDBDatabase | null = null;

  // Critical routes that should always be cached
  private criticalRoutes = [
    '/',
    '/dashboard',
    '/login',
    '/courses',
    '/profile',
    '/offline'
  ];

  async init(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'path' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  // Cache a route's HTML content
  async cacheRoute(path: string, html: string, dependencies: string[] = []): Promise<void> {
    await this.init();
    if (!this.db) return;

    const transaction = this.db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);
    
    const cachedRoute: CachedRoute = {
      path,
      html,
      timestamp: Date.now(),
      dependencies
    };

    await store.put(cachedRoute);
  }

  // Get cached route HTML
  async getCachedRoute(path: string): Promise<string | null> {
    await this.init();
    if (!this.db) return null;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(path);
      
      request.onsuccess = () => {
        const result = request.result as CachedRoute;
        resolve(result ? result.html : null);
      };
      
      request.onerror = () => resolve(null);
    });
  }

  // Pre-cache critical routes
  async preCacheCriticalRoutes(): Promise<void> {
    if (!navigator.onLine) return;

    console.log('Pre-caching critical routes for offline access...');

    const promises = this.criticalRoutes.map(async (route) => {
      try {
        const response = await fetch(route);
        if (response.ok) {
          const html = await response.text();
          await this.cacheRoute(route, html);
          console.log(`Cached route: ${route}`);
        }
      } catch (error) {
        console.warn(`Failed to cache route ${route}:`, error);
      }
    });

    await Promise.allSettled(promises);
    console.log('Critical routes pre-caching completed');
  }

  // Handle offline navigation
  async handleOfflineNavigation(path: string): Promise<string | null> {
    // Try to get cached route
    let cachedHtml = await this.getCachedRoute(path);
    
    if (cachedHtml) {
      return cachedHtml;
    }

    // Try to get cached index.html for SPA routing
    cachedHtml = await this.getCachedRoute('/');
    if (cachedHtml) {
      return cachedHtml;
    }

    // Ultimate fallback - return basic offline page
    return this.getBasicOfflinePage(path);
  }

  // Generate a basic offline page for routes
  private getBasicOfflinePage(path: string): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Tek Riders - Offline</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #333;
          }
          .container {
            background: white;
            padding: 2rem;
            border-radius: 1rem;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
            text-align: center;
            max-width: 400px;
          }
          .icon { font-size: 3rem; margin-bottom: 1rem; }
          h1 { color: #1a202c; margin-bottom: 0.5rem; }
          p { color: #718096; margin-bottom: 2rem; }
          .button {
            background: #667eea;
            color: white;
            padding: 0.75rem 2rem;
            border: none;
            border-radius: 0.5rem;
            text-decoration: none;
            display: inline-block;
            margin: 0.25rem;
            cursor: pointer;
          }
          .button:hover { background: #5a67d8; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">📱</div>
          <h1>You're Offline</h1>
          <p>This page (${path}) isn't available offline, but you can still access your cached content.</p>
          <a href="/dashboard" class="button">Go to Dashboard</a>
          <a href="/courses" class="button">View Courses</a>
          <button onclick="history.back()" class="button">Go Back</button>
        </div>
        
        <script>
          // Auto-redirect when back online
          window.addEventListener('online', () => {
            if (window.location.pathname !== '${path}') {
              window.location.href = '${path}';
            } else {
              window.location.reload();
            }
          });
        </script>
      </body>
      </html>
    `;
  }

  // Clean up old cached routes
  async cleanupOldRoutes(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    await this.init();
    if (!this.db) return;

    const transaction = this.db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);
    const index = store.index('timestamp');
    
    const cutoffTime = Date.now() - maxAge;
    const request = index.openCursor(IDBKeyRange.upperBound(cutoffTime));
    
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        const route = cursor.value as CachedRoute;
        // Don't delete critical routes
        if (!this.criticalRoutes.includes(route.path)) {
          cursor.delete();
        }
        cursor.continue();
      }
    };
  }

  // Get cache statistics
  async getCacheStats(): Promise<{total: number, size: number, oldestRoute: string | null}> {
    await this.init();
    if (!this.db) return { total: 0, size: 0, oldestRoute: null };

    return new Promise((resolve) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();
      
      request.onsuccess = () => {
        const routes = request.result as CachedRoute[];
        const totalSize = routes.reduce((acc, route) => acc + route.html.length, 0);
        const oldestRoute = routes.length > 0 
          ? routes.reduce((oldest, route) => 
              route.timestamp < oldest.timestamp ? route : oldest
            ).path
          : null;
        
        resolve({
          total: routes.length,
          size: totalSize,
          oldestRoute
        });
      };
      
      request.onerror = () => resolve({ total: 0, size: 0, oldestRoute: null });
    });
  }
}

// Global instance
export const offlineNavigation = new OfflineNavigationManager();

// Initialize offline navigation when the module loads
if (typeof window !== 'undefined') {
  // Auto-initialize when online
  if (navigator.onLine) {
    offlineNavigation.preCacheCriticalRoutes().catch(console.error);
  }

  // Pre-cache routes when connection is restored
  window.addEventListener('online', () => {
    offlineNavigation.preCacheCriticalRoutes().catch(console.error);
  });

  // Cleanup old routes periodically
  setInterval(() => {
    offlineNavigation.cleanupOldRoutes().catch(console.error);
  }, 24 * 60 * 60 * 1000); // Daily cleanup
}

// Hook for React components
export const useOfflineNavigation = () => {
  return {
    cacheRoute: offlineNavigation.cacheRoute.bind(offlineNavigation),
    getCachedRoute: offlineNavigation.getCachedRoute.bind(offlineNavigation),
    handleOfflineNavigation: offlineNavigation.handleOfflineNavigation.bind(offlineNavigation),
    getCacheStats: offlineNavigation.getCacheStats.bind(offlineNavigation),
    preCacheCriticalRoutes: offlineNavigation.preCacheCriticalRoutes.bind(offlineNavigation)
  };
}; 