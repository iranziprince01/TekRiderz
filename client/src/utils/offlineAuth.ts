/**
 * Simple offline authentication utility
 * Manages cached credentials for offline login
 */

interface CachedCredentials {
  email: string;
  hashedPassword: string;
  user: any;
  cachedAt: number;
}

export const hasCachedCredentials = async (email: string): Promise<boolean> => {
  try {
    const cached = localStorage.getItem(`auth_cache_${email}`);
    if (!cached) return false;

    const credentials: CachedCredentials = JSON.parse(cached);
    
    // Check if cache is not expired (24 hours)
    const isExpired = Date.now() - credentials.cachedAt > 24 * 60 * 60 * 1000;
    if (isExpired) {
      localStorage.removeItem(`auth_cache_${email}`);
      return false;
    }

    return true;
  } catch (error) {
    return false;
  }
};

export const cacheCredentials = async (email: string, password: string, user: any): Promise<void> => {
  try {
    const credentials: CachedCredentials = {
      email,
      hashedPassword: btoa(password), // Simple encoding (not secure, but for offline use)
      user,
      cachedAt: Date.now()
    };

    localStorage.setItem(`auth_cache_${email}`, JSON.stringify(credentials));
  } catch (error) {
    console.warn('Failed to cache credentials:', error);
  }
};

export const getCachedCredentials = async (email: string): Promise<CachedCredentials | null> => {
  try {
    const cached = localStorage.getItem(`auth_cache_${email}`);
    if (!cached) return null;

    const credentials: CachedCredentials = JSON.parse(cached);
    
    // Check if cache is not expired
    const isExpired = Date.now() - credentials.cachedAt > 24 * 60 * 60 * 1000;
    if (isExpired) {
      localStorage.removeItem(`auth_cache_${email}`);
      return null;
    }

    return credentials;
  } catch (error) {
    return null;
  }
};

export const authenticateOffline = async (email: string, password: string): Promise<{ success: boolean; user?: any; error?: string }> => {
  try {
    const cached = await getCachedCredentials(email);
    if (!cached) {
      return { success: false, error: 'No cached credentials found' };
    }

    // Simple password check (not secure, but works for offline)
    const hashedInput = btoa(password);
    if (hashedInput !== cached.hashedPassword) {
      return { success: false, error: 'Invalid credentials' };
    }

    return { success: true, user: cached.user };
  } catch (error) {
    return { success: false, error: 'Authentication failed' };
  }
};

export const clearCachedCredentials = async (email?: string): Promise<void> => {
  try {
    if (email) {
      localStorage.removeItem(`auth_cache_${email}`);
    } else {
      // Clear all cached credentials
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('auth_cache_')) {
          localStorage.removeItem(key);
        }
      });
    }
  } catch (error) {
    console.warn('Failed to clear cached credentials:', error);
  }
}; 