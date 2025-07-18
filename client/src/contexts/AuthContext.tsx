import React, { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../utils/api';

// Types
interface User {
  id: string;
  name: string;
  email: string;
  role: 'learner' | 'tutor' | 'admin';
  avatar: string | null;
  verified: boolean;
  profile?: any;
  preferences?: any;
  lastLogin?: string;
}

// Role-based navigation utility
const RoleBasedNavigation = {
  getPostLoginRoute: (role: string, currentPath: string) => {
    if (currentPath === '/login' || currentPath === '/signup') {
      switch (role) {
        case 'admin': return '/admin';
        case 'tutor': return '/tutor';
        case 'learner': default: return '/dashboard';
      }
    }
    return currentPath;
  }
};

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isInitialized: boolean;
  otpSent: boolean;
  tempEmail: string | null;
  tempUserData: any | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isInitialized: boolean;
  otpSent: boolean;
  tempEmail: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string, role: 'learner' | 'tutor') => Promise<{ message: string }>;
  verifyOtp: (email: string, otp: string) => Promise<void>;
  resendOtp: (email: string) => Promise<{ message: string }>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Secure storage using IndexedDB only (no localStorage fallback)
class SecureAuthStorage {
  private dbName = 'TekRidersSecureAuth';
  private dbVersion = 2;
  private storeName = 'auth';
  private tokenKey = 'secure_auth_token';
  private refreshTokenKey = 'secure_refresh_token';
  private userKey = 'secure_user_data';
  private tempUserDataKey = 'temp_user_data';

  async init(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'key' });
          store.createIndex('timestamp', 'timestamp');
          store.createIndex('expires', 'expires');
        }
      };
    });
  }

  async storeToken(token: string): Promise<void> {
    const db = await this.init();
    const transaction = db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);
    
    await store.put({
      key: this.tokenKey,
      value: token,
      timestamp: Date.now(),
      expires: Date.now() + (15 * 60 * 1000) // 15 minutes
    });
  }

  async storeRefreshToken(refreshToken: string): Promise<void> {
    const db = await this.init();
    const transaction = db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);
    
    await store.put({
      key: this.refreshTokenKey,
      value: refreshToken,
      timestamp: Date.now(),
      expires: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
    });
  }

  async storeUser(user: User): Promise<void> {
    const db = await this.init();
    const transaction = db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);
    
    await store.put({
      key: this.userKey,
      value: user,
      timestamp: Date.now()
    });
  }

  async storeTempUserData(userData: any): Promise<void> {
    const db = await this.init();
    const transaction = db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);
    
    await store.put({
      key: this.tempUserDataKey,
      value: userData,
      timestamp: Date.now(),
      expires: Date.now() + (15 * 60 * 1000) // 15 minutes
    });
  }

  async getTempUserData(): Promise<any | null> {
    try {
      const db = await this.init();
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      
      return new Promise((resolve) => {
        const request = store.get(this.tempUserDataKey);
        request.onsuccess = () => {
          const result = request.result;
          if (result && (!result.expires || result.expires > Date.now())) {
            resolve(result.value);
          } else {
            if (result) this.removeTempUserData();
            resolve(null);
          }
        };
        request.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  async removeTempUserData(): Promise<void> {
    try {
      const db = await this.init();
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      await store.delete(this.tempUserDataKey);
    } catch {
      // Ignore errors during cleanup
    }
  }

  async getToken(): Promise<string | null> {
    try {
      const db = await this.init();
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      
      return new Promise((resolve) => {
        const request = store.get(this.tokenKey);
        request.onsuccess = () => {
          const result = request.result;
          if (result && result.expires > Date.now()) {
            resolve(result.value);
          } else {
            if (result) this.removeToken();
            resolve(null);
          }
        };
        request.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  async getRefreshToken(): Promise<string | null> {
    try {
      const db = await this.init();
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      
      return new Promise((resolve) => {
        const request = store.get(this.refreshTokenKey);
        request.onsuccess = () => {
          const result = request.result;
          if (result && result.expires > Date.now()) {
            resolve(result.value);
          } else {
            if (result) this.removeRefreshToken();
            resolve(null);
          }
        };
        request.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  async getUser(): Promise<User | null> {
    try {
      const db = await this.init();
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      
      return new Promise((resolve) => {
        const request = store.get(this.userKey);
        request.onsuccess = () => {
          const result = request.result;
          resolve(result ? result.value : null);
        };
        request.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  async removeToken(): Promise<void> {
    try {
      const db = await this.init();
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      await store.delete(this.tokenKey);
    } catch {
      // Ignore errors during cleanup
    }
  }

  async removeRefreshToken(): Promise<void> {
    try {
      const db = await this.init();
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      await store.delete(this.refreshTokenKey);
    } catch {
      // Ignore errors during cleanup
    }
  }

  async removeUser(): Promise<void> {
    try {
      const db = await this.init();
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      await store.delete(this.userKey);
    } catch {
      // Ignore errors during cleanup
    }
  }

  async clear(): Promise<void> {
    try {
      const db = await this.init();
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      await store.clear();
    } catch {
      // Ignore errors during cleanup
    }
  }
}

// Secure API service
class SecureAuthService {
  private baseUrl = import.meta.env.VITE_API_URL || '/api/v1';
  private storage = new SecureAuthStorage();

  async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const token = await this.storage.getToken();
    
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ 
        error: { 
          message: 'Network error occurred', 
          type: 'NETWORK_ERROR' 
        } 
      }));
      
      // Handle new error format from backend
      if (errorData.error) {
        const error = new Error(errorData.error.message || 'Request failed');
        (error as any).details = errorData.error;
        throw error;
      }
      
      // Handle legacy error format
      throw new Error(errorData.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  async login(email: string, password: string): Promise<{ user: User; token: string }> {
    const data = await this.makeRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    await Promise.all([
      this.storage.storeToken(data.data.token),
      this.storage.storeRefreshToken(data.data.refreshToken),
      this.storage.storeUser(data.data.user)
    ]);
    
    return {
      user: data.data.user,
      token: data.data.token,
    };
  }

  async signup(name: string, email: string, password: string, role: 'learner' | 'tutor'): Promise<{ message: string; otpSent: boolean }> {
    const data = await this.makeRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, role }),
    });

    // Store temporary user data for OTP verification
    const tempUserData = { 
      name, 
      email, 
      password, 
      role,
      id: crypto.randomUUID()
    };
    await this.storage.storeTempUserData(tempUserData);

    return {
      message: data.message,
      otpSent: data.data.otpSent,
    };
  }

  async verifyOtp(email: string, otp: string): Promise<{ user: User; token: string }> {
    const tempUserData = await this.storage.getTempUserData();
    if (!tempUserData || tempUserData.email !== email) {
      throw new Error('Invalid or expired OTP session. Please try registering again.');
    }
    
    const data = await this.makeRequest('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    });

    await Promise.all([
      this.storage.storeToken(data.data.token),
      this.storage.storeRefreshToken(data.data.refreshToken),
      this.storage.storeUser(data.data.user),
      this.storage.removeTempUserData() // Clean up temp data
    ]);
    
    return {
      user: data.data.user,
      token: data.data.token,
    };
  }

  async resendOtp(email: string): Promise<{ message: string }> {
    const data = await this.makeRequest('/auth/resend-otp', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });

    return { message: data.message };
  }

  async getCurrentUser(): Promise<User> {
    const data = await this.makeRequest('/auth/me');
    await this.storage.storeUser(data.data.user);
    return data.data.user;
  }

  async updateProfile(updates: Partial<User>): Promise<User> {
    const data = await this.makeRequest('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });

    await this.storage.storeUser(data.data.user);
    return data.data.user;
  }

  async refreshToken(): Promise<{ user: User; token: string }> {
    const refreshToken = await this.storage.getRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const data = await this.makeRequest('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });

    await Promise.all([
      this.storage.storeToken(data.data.token),
      this.storage.storeRefreshToken(data.data.refreshToken),
      this.storage.storeUser(data.data.user)
    ]);

    return {
      user: data.data.user,
      token: data.data.token,
    };
  }

  async logout(): Promise<void> {
    try {
      await this.makeRequest('/auth/logout', { method: 'POST' });
    } catch (error) {
      // Continue with local cleanup even if server logout fails
      // This is expected when tokens are expired
      console.info('Server logout call failed (expected if token expired), continuing with local cleanup:', error);
    }
    
    await this.storage.clear();
  }
}

const authService = new SecureAuthService();

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    token: null,
    isLoading: false,
    isInitialized: false,
    otpSent: false,
    tempEmail: null,
    tempUserData: null,
  });

  // Initialize auth state from secure storage
  useEffect(() => {
    const initAuth = async () => {
      try {
        console.log('🔐 Initializing auth context...');
        setAuthState(prev => ({ ...prev, isLoading: true }));
        
        const storage = new SecureAuthStorage();
        
        try {
          const [storedUser, storedToken] = await Promise.all([
            storage.getUser(),
            storage.getToken(),
          ]);

          if (storedUser && storedToken) {
            console.log('Found stored credentials');
            
            // Regular token validation
            // Set token in apiClient for API requests
            await apiClient.setToken(storedToken);
            
            // Store user data for immediate app functionality
            localStorage.setItem('currentUserId', storedUser.id);
            localStorage.setItem('userRole', storedUser.role);
            localStorage.setItem('userEmail', storedUser.email);
            
            setAuthState(prev => ({
              ...prev,
              user: storedUser,
              token: storedToken,
              isInitialized: true,
              isLoading: false
            }));
            
            console.log('Auth state restored from storage');
            
            // Verify token in background (don't block initialization)
            setTimeout(async () => {
              try {
                await authService.getCurrentUser();
                console.log('Token verified in background');
              } catch (error) {
                                  console.warn('Background token verification failed, user needs to login again');
                await storage.clear();
                await apiClient.setToken(null);
                setAuthState(prev => ({ 
                  ...prev, 
                  user: null, 
                  token: null 
                }));
              }
            }, 1000);
            
          } else {
            console.log('ℹ️ No stored credentials found');
            setAuthState(prev => ({
              ...prev,
              isInitialized: true,
              isLoading: false
            }));
          }
        } catch (storageError: any) {
          console.warn('Storage access failed:', storageError?.message || 'Unknown error');
          setAuthState(prev => ({
            ...prev,
            isInitialized: true,
            isLoading: false
          }));
        }
        
      } catch (error: any) {
        console.error('Auth initialization failed:', error?.message || 'Unknown error');
        setAuthState(prev => ({ 
          ...prev, 
          isInitialized: true,
          isLoading: false
        }));
      }
    };

    initAuth().catch((error: any) => {
      console.error('Critical auth initialization error:', error?.message || 'Unknown error');
      setAuthState(prev => ({ 
        ...prev, 
        isInitialized: true,
        isLoading: false
      }));
    });
  }, []);

  // Auto-refresh token before it expires
  useEffect(() => {
    if (!authState.token || !authState.user) return;

    // Refresh token every 12 minutes (3 minutes before 15-minute expiration)
    const tokenRefreshInterval = setInterval(async () => {
      try {
        await refreshToken();
      } catch (error) {
        console.error('Automatic token refresh failed:', error);
      }
    }, 12 * 60 * 1000); // 12 minutes

    return () => clearInterval(tokenRefreshInterval);
  }, [authState.token, authState.user]);

  // Auto-refresh user data periodically
  useEffect(() => {
    if (!authState.token || !authState.user) return;

    const refreshInterval = setInterval(async () => {
      try {
        await authService.getCurrentUser();
      } catch (error) {
        console.error('User refresh failed:', error);
        await logout();
      }
    }, 5 * 60 * 1000); // Refresh every 5 minutes

    return () => clearInterval(refreshInterval);
  }, [authState.token, authState.user]);

  const login = async (email: string, password: string) => {
    setAuthState(prev => ({ ...prev, isLoading: true }));
    
    try {
      console.log('🔐 Attempting login for:', email);
      
      // Try online login first
      try {
        const { user, token } = await authService.login(email, password);
        
        // Set token in apiClient for API requests
        await apiClient.setToken(token);
        
        setAuthState(prev => ({
          ...prev,
          user,
          token,
          isLoading: false,
          otpSent: false,
          tempEmail: null,
          tempUserData: null,
        }));

        // Auto-redirect based on user role
        const currentPath = window.location.pathname;
        const redirectTo = RoleBasedNavigation.getPostLoginRoute(user.role, currentPath);
        navigate(redirectTo, { replace: true });
        
        console.log('Login successful');
        return;
        
      } catch (error: any) {
        console.error('Login failed:', error?.message);
        setAuthState(prev => ({ ...prev, isLoading: false }));
        throw error;
            }
    } catch (error: any) {
      console.error('❌ Login failed:', error?.message);
      setAuthState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  };

  const signup = async (name: string, email: string, password: string, role: 'learner' | 'tutor') => {
    setAuthState(prev => ({ ...prev, isLoading: true }));
    
    try {
      const { message, otpSent } = await authService.signup(name, email, password, role);
      
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        otpSent,
        tempEmail: email,
        tempUserData: { name, email, password, role },
      }));
      
      return { message };
    } catch (error) {
      setAuthState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  };

  const verifyOtp = async (email: string, otp: string) => {
    setAuthState(prev => ({ ...prev, isLoading: true }));
    
    try {
      const { user, token } = await authService.verifyOtp(email, otp);
      
      // Set token in apiClient for API requests
      await apiClient.setToken(token);
      
      // Store user ID and role in localStorage for offline access and PouchDB sync
      localStorage.setItem('currentUserId', user.id);
      localStorage.setItem('userRole', user.role);
      localStorage.setItem('userEmail', user.email);
      
      setAuthState(prev => ({
        ...prev,
        user,
        token,
        isLoading: false,
        otpSent: false,
        tempEmail: null,
        tempUserData: null,
      }));

      // Auto-redirect to appropriate dashboard after successful verification
      const redirectTo = RoleBasedNavigation.getPostLoginRoute(user.role, '/dashboard');
      navigate(redirectTo, { replace: true });
      
    } catch (error) {
      setAuthState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  };

  const resendOtp = async (email: string) => {
    setAuthState(prev => ({ ...prev, isLoading: true }));
    
    try {
      const result = await authService.resendOtp(email);
      setAuthState(prev => ({ ...prev, isLoading: false }));
      return result;
    } catch (error) {
      setAuthState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  };

  const logout = async () => {
    setAuthState(prev => ({ ...prev, isLoading: true }));
    
    try {
      await authService.logout();
      // Clear token from apiClient
      await apiClient.setToken(null);
      
      // Clear offline session and cached credentials
      try {
        localStorage.removeItem('currentUserId');
        localStorage.removeItem('userRole');
        localStorage.removeItem('userEmail');
      } catch (cleanupError) {
        console.warn('Failed to clean up local storage:', cleanupError);
      }
      
      setAuthState({
        user: null,
        token: null,
        isLoading: false,
        isInitialized: true,
        otpSent: false,
        tempEmail: null,
        tempUserData: null,
      });

      navigate('/login', { replace: true });
    } catch (error) {
      // Even if online logout fails, clear offline data
      try {
        localStorage.removeItem('currentUserId');
        localStorage.removeItem('userRole');
        localStorage.removeItem('userEmail');
      } catch (cleanupError) {
        console.warn('Failed to clean up local storage:', cleanupError);
      }
      
      setAuthState({
        user: null,
        token: null,
        isLoading: false,
        isInitialized: true,
        otpSent: false,
        tempEmail: null,
        tempUserData: null,
      });
      
      navigate('/login', { replace: true });
    }
  };

  const refreshToken = async () => {
    try {
      const { user, token } = await authService.refreshToken();
      
      // Update token in apiClient
      await apiClient.setToken(token);
      
      // Update localStorage for offline access
      localStorage.setItem('currentUserId', user.id);
      localStorage.setItem('userRole', user.role);
      localStorage.setItem('userEmail', user.email);
      
      setAuthState(prev => ({
        ...prev,
        user,
        token,
      }));
    } catch (error) {
      console.error('Token refresh failed:', error);
      // If refresh fails, logout user
      await logout();
      throw error;
    }
  };

  const updateProfile = async (updates: Partial<User>) => {
    setAuthState(prev => ({ ...prev, isLoading: true }));
    
    try {
      const updatedUser = await authService.updateProfile(updates);
      setAuthState(prev => ({
        ...prev,
        user: updatedUser,
        isLoading: false,
      }));
    } catch (error) {
      setAuthState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  };

  const contextValue: AuthContextType = {
    user: authState.user,
    token: authState.token,
    isLoading: authState.isLoading,
    isInitialized: authState.isInitialized,
    otpSent: authState.otpSent,
    tempEmail: authState.tempEmail,
    isAuthenticated: !!authState.user && !!authState.token,
    login,
    signup,
    verifyOtp,
    resendOtp,
    logout,
    refreshToken,
    updateProfile,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};