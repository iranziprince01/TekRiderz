// Comprehensive secure storage utility for offline-first applications

interface SecureStorageItem {
  key: string;
  value: string; // Encrypted value
  salt: string;
  iv: string;
  timestamp: number;
  expiresAt: number;
  metadata?: {
    type: 'token' | 'user_data' | 'sensitive' | 'temporary';
    userId?: string;
    version: string;
  };
}

interface StorageOptions {
  expiryMinutes?: number;
  encrypt?: boolean;
  type?: 'token' | 'user_data' | 'sensitive' | 'temporary';
  userId?: string;
}

class SecureStorageManager {
  private dbName = 'TekRidersSecureStorage';
  private dbVersion = 2;
  private storeName = 'secureData';
  private db: IDBDatabase | null = null;
  private masterKey: CryptoKey | null = null;

  // Default expiry times (in minutes)
  private defaultExpiry = {
    token: 15,        // 15 minutes for access tokens
    refresh_token: 10080, // 7 days for refresh tokens
    user_data: 1440,  // 24 hours for user data
    sensitive: 60,    // 1 hour for sensitive data
    temporary: 5      // 5 minutes for temporary data
  };

  async init(): Promise<void> {
    await this.initDatabase();
    await this.initCryptography();
    await this.cleanupExpiredItems();
  }

  private async initDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create or upgrade the store
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'key' });
          store.createIndex('timestamp', 'timestamp');
          store.createIndex('expiresAt', 'expiresAt');
          store.createIndex('userId', 'metadata.userId');
          store.createIndex('type', 'metadata.type');
        }
      };
    });
  }

  private async initCryptography(): Promise<void> {
    try {
      // Check if we have a stored master key
      const storedKeyData = localStorage.getItem('_skm');
      
      if (storedKeyData) {
        // Import existing key
        const keyData = JSON.parse(storedKeyData);
        this.masterKey = await crypto.subtle.importKey(
          'raw',
          new Uint8Array(keyData),
          { name: 'PBKDF2' },
          false,
          ['deriveKey']
        );
      } else {
        // Generate new master key
        const keyMaterial = crypto.getRandomValues(new Uint8Array(32));
        this.masterKey = await crypto.subtle.importKey(
          'raw',
          keyMaterial,
          { name: 'PBKDF2' },
          false,
          ['deriveKey']
        );

        // Store the key material (in a real app, you'd want better key management)
        localStorage.setItem('_skm', JSON.stringify(Array.from(keyMaterial)));
      }
    } catch (error) {
      console.warn('Cryptography not available, falling back to plain storage:', error);
      this.masterKey = null;
    }
  }

  private async deriveKey(salt: Uint8Array): Promise<CryptoKey | null> {
    if (!this.masterKey) return null;

    try {
      return await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: 100000,
          hash: 'SHA-256'
        },
        this.masterKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
    } catch (error) {
      console.error('Key derivation failed:', error);
      return null;
    }
  }

  private async encrypt(data: string, key: CryptoKey): Promise<{ encrypted: string; iv: string }> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encodedData = new TextEncoder().encode(data);

    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encodedData
    );

    return {
      encrypted: Array.from(new Uint8Array(encrypted)).map(b => b.toString(16).padStart(2, '0')).join(''),
      iv: Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('')
    };
  }

  private async decrypt(encryptedData: string, iv: string, key: CryptoKey): Promise<string> {
    const encryptedBytes = new Uint8Array(
      encryptedData.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
    );
    const ivBytes = new Uint8Array(
      iv.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
    );

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBytes },
      key,
      encryptedBytes
    );

    return new TextDecoder().decode(decrypted);
  }

  private async ensureDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.init();
    }
    return this.db!;
  }

  // Store data securely
  async setItem(
    key: string, 
    value: any, 
    options: StorageOptions = {}
  ): Promise<void> {
    const db = await this.ensureDB();
    
    const {
      expiryMinutes = this.defaultExpiry[options.type || 'user_data'],
      encrypt = true,
      type = 'user_data',
      userId
    } = options;

    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    const expiresAt = Date.now() + (expiryMinutes * 60 * 1000);
    
    let storedValue = stringValue;
    let salt = '';
    let iv = '';

    // Encrypt if requested and crypto is available
    if (encrypt && this.masterKey && crypto.subtle) {
      try {
        const saltBytes = crypto.getRandomValues(new Uint8Array(16));
        salt = Array.from(saltBytes).map(b => b.toString(16).padStart(2, '0')).join('');
        
        const derivedKey = await this.deriveKey(saltBytes);
        if (derivedKey) {
          const encrypted = await this.encrypt(stringValue, derivedKey);
          storedValue = encrypted.encrypted;
          iv = encrypted.iv;
        }
      } catch (error) {
        console.warn('Encryption failed, storing as plain text:', error);
      }
    }

    const item: SecureStorageItem = {
      key,
      value: storedValue,
      salt,
      iv,
      timestamp: Date.now(),
      expiresAt,
      metadata: {
        type,
        userId,
        version: '1.0'
      }
    };

    const transaction = db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);
    await store.put(item);
  }

  // Retrieve data securely
  async getItem<T = any>(key: string): Promise<T | null> {
    const db = await this.ensureDB();
    const transaction = db.transaction([this.storeName], 'readonly');
    const store = transaction.objectStore(this.storeName);

    return new Promise((resolve) => {
      const request = store.get(key);
      
      request.onsuccess = async () => {
        const item: SecureStorageItem = request.result;
        
        if (!item) {
          resolve(null);
          return;
        }

        // Check expiry
        if (item.expiresAt <= Date.now()) {
          // Item expired, remove it
          this.removeItem(key);
          resolve(null);
          return;
        }

        let value = item.value;

        // Decrypt if needed
        if (item.salt && item.iv && this.masterKey && crypto.subtle) {
          try {
            const saltBytes = new Uint8Array(
              item.salt.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
            );
            const derivedKey = await this.deriveKey(saltBytes);
            
            if (derivedKey) {
              value = await this.decrypt(item.value, item.iv, derivedKey);
            }
          } catch (error) {
            console.error('Decryption failed:', error);
            resolve(null);
            return;
          }
        }

        // Try to parse as JSON, fallback to string
        try {
          resolve(JSON.parse(value));
        } catch {
          resolve(value as T);
        }
      };

      request.onerror = () => resolve(null);
    });
  }

  // Remove item
  async removeItem(key: string): Promise<void> {
    const db = await this.ensureDB();
    const transaction = db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);
    await store.delete(key);
  }

  // Get all keys
  async getKeys(filter?: { type?: string; userId?: string }): Promise<string[]> {
    const db = await this.ensureDB();
    const transaction = db.transaction([this.storeName], 'readonly');
    const store = transaction.objectStore(this.storeName);

    return new Promise((resolve) => {
      const request = store.getAll();
      
      request.onsuccess = () => {
        const items: SecureStorageItem[] = request.result;
        let filteredItems = items;

        if (filter) {
          filteredItems = items.filter(item => {
            if (filter.type && item.metadata?.type !== filter.type) {
              return false;
            }
            if (filter.userId && item.metadata?.userId !== filter.userId) {
              return false;
            }
            return true;
          });
        }

        // Filter out expired items
        const now = Date.now();
        filteredItems = filteredItems.filter(item => item.expiresAt > now);

        resolve(filteredItems.map(item => item.key));
      };

      request.onerror = () => resolve([]);
    });
  }

  // Check if item exists and is not expired
  async hasItem(key: string): Promise<boolean> {
    const db = await this.ensureDB();
    const transaction = db.transaction([this.storeName], 'readonly');
    const store = transaction.objectStore(this.storeName);

    return new Promise((resolve) => {
      const request = store.get(key);
      
      request.onsuccess = () => {
        const item: SecureStorageItem = request.result;
        
        if (!item) {
          resolve(false);
          return;
        }

        // Check expiry
        if (item.expiresAt <= Date.now()) {
          // Item expired, remove it
          this.removeItem(key);
          resolve(false);
          return;
        }

        resolve(true);
      };

      request.onerror = () => resolve(false);
    });
  }

  // Update expiry time
  async updateExpiry(key: string, expiryMinutes: number): Promise<boolean> {
    const db = await this.ensureDB();
    const transaction = db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);

    return new Promise((resolve) => {
      const request = store.get(key);
      
      request.onsuccess = () => {
        const item: SecureStorageItem = request.result;
        
        if (!item) {
          resolve(false);
          return;
        }

        item.expiresAt = Date.now() + (expiryMinutes * 60 * 1000);
        
        const updateRequest = store.put(item);
        updateRequest.onsuccess = () => resolve(true);
        updateRequest.onerror = () => resolve(false);
      };

      request.onerror = () => resolve(false);
    });
  }

  // Clean up expired items
  async cleanupExpiredItems(): Promise<number> {
    const db = await this.ensureDB();
    const transaction = db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);
    const index = store.index('expiresAt');

    return new Promise((resolve) => {
      const now = Date.now();
      const request = index.getAll(IDBKeyRange.upperBound(now));
      
      request.onsuccess = () => {
        const expiredItems: SecureStorageItem[] = request.result;
        let deleted = 0;

        expiredItems.forEach(item => {
          store.delete(item.key);
          deleted++;
        });

        resolve(deleted);
      };

      request.onerror = () => resolve(0);
    });
  }

  // Get storage statistics
  async getStorageStats(): Promise<{
    totalItems: number;
    itemsByType: Record<string, number>;
    totalSize: number;
    oldestItem: number;
    newestItem: number;
  }> {
    const db = await this.ensureDB();
    const transaction = db.transaction([this.storeName], 'readonly');
    const store = transaction.objectStore(this.storeName);

    return new Promise((resolve) => {
      const request = store.getAll();
      
      request.onsuccess = () => {
        const items: SecureStorageItem[] = request.result;
        const now = Date.now();
        const validItems = items.filter(item => item.expiresAt > now);

        const stats = {
          totalItems: validItems.length,
          itemsByType: {} as Record<string, number>,
          totalSize: 0,
          oldestItem: now,
          newestItem: 0
        };

        validItems.forEach(item => {
          const type = item.metadata?.type || 'unknown';
          stats.itemsByType[type] = (stats.itemsByType[type] || 0) + 1;
          stats.totalSize += item.value.length;
          stats.oldestItem = Math.min(stats.oldestItem, item.timestamp);
          stats.newestItem = Math.max(stats.newestItem, item.timestamp);
        });

        resolve(stats);
      };

      request.onerror = () => resolve({
        totalItems: 0,
        itemsByType: {},
        totalSize: 0,
        oldestItem: 0,
        newestItem: 0
      });
    });
  }

  // Clear all data (for logout or reset)
  async clear(filter?: { type?: string; userId?: string }): Promise<void> {
    const db = await this.ensureDB();
    const transaction = db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);

    if (!filter) {
      // Clear everything
      await store.clear();
      return;
    }

    // Clear with filter
    return new Promise((resolve) => {
      const request = store.getAll();
      
      request.onsuccess = () => {
        const items: SecureStorageItem[] = request.result;
        
        items.forEach(item => {
          let shouldDelete = false;
          
          if (filter.type && item.metadata?.type === filter.type) {
            shouldDelete = true;
          }
          if (filter.userId && item.metadata?.userId === filter.userId) {
            shouldDelete = true;
          }
          
          if (shouldDelete) {
            store.delete(item.key);
          }
        });

        resolve();
      };

      request.onerror = () => resolve();
    });
  }

  // Secure token storage methods
  async storeToken(token: string, type: 'access' | 'refresh' = 'access', userId?: string): Promise<void> {
    const key = type === 'access' ? 'auth_token' : 'refresh_token';
    const expiryMinutes = type === 'access' ? this.defaultExpiry.token : this.defaultExpiry.refresh_token;
    
    await this.setItem(key, token, {
      expiryMinutes,
      encrypt: true,
      type: 'token',
      userId
    });
  }

  async getToken(type: 'access' | 'refresh' = 'access'): Promise<string | null> {
    const key = type === 'access' ? 'auth_token' : 'refresh_token';
    return await this.getItem<string>(key);
  }

  async clearTokens(): Promise<void> {
    await Promise.all([
      this.removeItem('auth_token'),
      this.removeItem('refresh_token')
    ]);
  }

  // Secure user data storage
  async storeUserData(userData: any, userId: string): Promise<void> {
    await this.setItem('user_data', userData, {
      expiryMinutes: this.defaultExpiry.user_data,
      encrypt: true,
      type: 'user_data',
      userId
    });
  }

  async getUserData(): Promise<any> {
    return await this.getItem('user_data');
  }

  // Temporary secure storage (for sensitive operations)
  async storeTemporary(key: string, data: any, expiryMinutes: number = 5): Promise<void> {
    await this.setItem(`temp_${key}`, data, {
      expiryMinutes,
      encrypt: true,
      type: 'temporary'
    });
  }

  async getTemporary(key: string): Promise<any> {
    return await this.getItem(`temp_${key}`);
  }

  // Check if encryption is available
  isEncryptionAvailable(): boolean {
    return !!(this.masterKey && crypto.subtle);
  }

  // Rotate master key (for enhanced security)
  async rotateMasterKey(): Promise<void> {
    // Get all current data
    const allKeys = await this.getKeys();
    const allData: Array<{ key: string; value: any; options: StorageOptions }> = [];
    
    for (const key of allKeys) {
      const value = await this.getItem(key);
      if (value !== null) {
        allData.push({
          key,
          value,
          options: { encrypt: true } // Re-encrypt everything
        });
      }
    }

    // Clear old master key
    localStorage.removeItem('_skm');
    this.masterKey = null;

    // Generate new master key
    await this.initCryptography();

    // Re-encrypt and store all data
    for (const item of allData) {
      await this.setItem(item.key, item.value, item.options);
    }
  }
}

// Create singleton instance
export const secureStorage = new SecureStorageManager();

// Initialize on import
secureStorage.init().catch(error => {
  console.error('Failed to initialize secure storage:', error);
});

// Utility functions for common use cases

export const storeAuthTokens = async (
  accessToken: string, 
  refreshToken?: string, 
  userId?: string
): Promise<void> => {
  await secureStorage.storeToken(accessToken, 'access', userId);
  if (refreshToken) {
    await secureStorage.storeToken(refreshToken, 'refresh', userId);
  }
};

export const getAuthTokens = async (): Promise<{
  accessToken: string | null;
  refreshToken: string | null;
}> => {
  const [accessToken, refreshToken] = await Promise.all([
    secureStorage.getToken('access'),
    secureStorage.getToken('refresh')
  ]);

  return { accessToken, refreshToken };
};

export const clearAllAuthData = async (userId?: string): Promise<void> => {
  if (userId) {
    await secureStorage.clear({ userId });
  } else {
    await secureStorage.clear({ type: 'token' });
    await secureStorage.clear({ type: 'user_data' });
  }
};

export const isTokenExpired = async (type: 'access' | 'refresh' = 'access'): Promise<boolean> => {
  const token = await secureStorage.getToken(type);
  return token === null;
};

export const storeUserSettings = async (settings: any, userId: string): Promise<void> => {
  await secureStorage.setItem('user_settings', settings, {
    expiryMinutes: 10080, // 7 days
    encrypt: false, // Settings don't need encryption
    type: 'user_data',
    userId
  });
};

export const getUserSettings = async (): Promise<any> => {
  return await secureStorage.getItem('user_settings');
}; 