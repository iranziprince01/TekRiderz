// Simple API client for TekRiders E-Learning Platform
// Core functionality for graduation project

// Environment detection utilities
export const isDevelopment = () => {
  return import.meta.env.NODE_ENV === 'development' || 
         import.meta.env.VITE_NODE_ENV === 'development' ||
         import.meta.env.DEV === true ||
         window.location.hostname === 'localhost' ||
         window.location.hostname === '127.0.0.1';
};

export const isProduction = () => !isDevelopment();

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// IndexedDB token storage to match AuthContext's SecureAuthStorage
class TokenStorage {
  private dbName = 'TekRidersSecureAuth';
  private dbVersion = 2;
  private storeName = 'auth';
  private tokenKey = 'secure_auth_token';
  private refreshTokenKey = 'secure_refresh_token';

  async init(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'key' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
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
            resolve(null);
          }
        };
        request.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
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

  async clear(): Promise<void> {
    const db = await this.init();
    const transaction = db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);
    
    await Promise.all([
      store.delete(this.tokenKey),
      store.delete(this.refreshTokenKey)
    ]);
  }
}

// Course data transformation utilities
// These functions map backend "lessons" terminology to frontend "modules" terminology
// while keeping the backend structure intact

const transformLessonToModule = (lesson: any) => {
  if (!lesson) return lesson;
  
  return {
    ...lesson,
    // Keep the original structure but frontend will treat it as a module
    type: lesson.type || 'module',
    // Add any additional module-specific properties if needed
  };
};

const transformSectionData = (section: any) => {
  if (!section) return section;
  
  return {
    ...section,
    // Transform lessons array to modules (keep same data, just for frontend interpretation)
    lessons: section.lessons?.map(transformLessonToModule) || [],
    // You could add a modules alias if needed:
    // modules: section.lessons?.map(transformLessonToModule) || [],
  };
};

const transformCourseData = (course: any) => {
  if (!course) return course;
  
  return {
    ...course,
    // Transform sections to include transformed lessons
    sections: course.sections?.map(transformSectionData) || [],
    // Keep original field names for backward compatibility
    totalLessons: course.totalLessons || 0,
    // Add modules count alias for frontend
    totalModules: course.totalLessons || 0,
  };
};

const transformProgressData = (progress: any) => {
  if (!progress) return progress;
  
  return {
    ...progress,
    // Keep original field names for API compatibility
    completedLessons: progress.completedLessons || [],
    // Add modules alias for frontend
    completedModules: progress.completedLessons || [],
    lessonProgress: progress.lessonProgress || {},
    // Add modules progress alias
    moduleProgress: progress.lessonProgress || {},
  };
};

class ApiClient {
  private baseURL: string;
  private token: string | null;
  private tokenStorage: TokenStorage;

  constructor() {
    this.baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
    this.token = null;
    this.tokenStorage = new TokenStorage();
    this.initializeToken();
  }

  private async initializeToken(): Promise<void> {
    this.token = await this.tokenStorage.getToken();
  }

  // Token management methods for AuthContext integration
  async setToken(token: string | null): Promise<void> {
    this.token = token;
    if (token) {
      await this.tokenStorage.storeToken(token);
      // Also store in localStorage for backward compatibility
      localStorage.setItem('token', token);
      console.log('🔐 Token set in apiClient:', token ? 'Token stored' : 'No token');
    } else {
      await this.tokenStorage.clear();
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      console.log('🔐 Token cleared from apiClient');
    }
  }

  async getToken(): Promise<string | null> {
    if (!this.token) {
      this.token = await this.tokenStorage.getToken();
      console.log('🔐 Token retrieved from storage:', this.token ? 'Found' : 'Not found');
    }
    return this.token;
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    // Get token from IndexedDB storage
    const token = await this.getToken();
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      console.log('🔐 Token found and set in headers');
    } else {
      console.warn('⚠️ No authentication token found in IndexedDB storage');
    }
    
    return headers;
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    retryCount: number = 0
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseURL}${endpoint}`;
      
      // Log the request details for debugging
      console.log('🌐 API Request:', {
        method: options.method || 'GET',
        url: url,
        endpoint: endpoint,
        hasAuth: !!(await this.getToken()),
        retryCount: retryCount
      });
      
      const response = await fetch(url, {
        ...options,
        headers: {
          ...(await this.getAuthHeaders()),
          ...options.headers,
        },
      });

      // Handle 401 Unauthorized - try to refresh token
      if (response.status === 401 && retryCount === 0) {
        console.log('🔄 Token expired, attempting to refresh...');
        
        const refreshSuccess = await this.attemptTokenRefresh();
        if (refreshSuccess) {
          console.log('✅ Token refreshed successfully, retrying request...');
          // Retry the original request with the new token
          return this.makeRequest(endpoint, options, retryCount + 1);
        } else {
          console.error('❌ Token refresh failed, redirecting to login...');
          this.handleAuthFailure();
          return {
            success: false,
            error: 'Authentication failed. Please login again.',
          };
        }
      }

      if (!response.ok) {
        // Try to parse the error response from the backend
        let errorMessage = `HTTP error! status: ${response.status}`;
        let errorData = null;
        
        try {
          const errorResponse = await response.json();
          errorData = errorResponse;
          
          // Extract meaningful error message from backend response
          if (errorResponse.error) {
            errorMessage = errorResponse.error;
          } else if (errorResponse.message) {
            errorMessage = errorResponse.message;
          } else if (errorResponse.details) {
            errorMessage = errorResponse.details;
          }
          
          console.error('❌ API Error Response:', {
            status: response.status,
            statusText: response.statusText,
            url: response.url,
            errorData: errorResponse
          });
          
          // Return the error in the expected format instead of throwing
          return {
            success: false,
            error: errorMessage,
            data: errorData
          };
        } catch (jsonError) {
          // If we can't parse the error response, use the generic message
          console.error('❌ Failed to parse error response:', jsonError);
          return {
            success: false,
            error: errorMessage
          };
        }
      }

      // Parse successful response
      const data = await response.json();
      
      // Log successful response for debugging
      console.log('✅ API Response:', {
        status: response.status,
        url: response.url,
        success: data.success !== false
      });
      
      return data;
    } catch (error) {
      console.error('❌ API Request failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred',
      };
    }
  }

  private async attemptTokenRefresh(): Promise<boolean> {
    try {
      const refreshToken = await this.tokenStorage.getRefreshToken();
      if (!refreshToken) {
        console.warn('⚠️ No refresh token available');
        return false;
      }

      const response = await fetch(`${this.baseURL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.token) {
          this.token = data.data.token;
          if (this.token) {
            await this.tokenStorage.storeToken(this.token);
            // Also update localStorage for backward compatibility
            localStorage.setItem('token', this.token);
          }
          
          // Update refresh token if provided
          if (data.data.refreshToken) {
            await this.tokenStorage.storeRefreshToken(data.data.refreshToken);
            localStorage.setItem('refreshToken', data.data.refreshToken);
          }
          
          console.log('✅ Token refresh successful');
          return true;
        }
      }
      
      console.error('❌ Token refresh failed:', response.status, response.statusText);
      return false;
    } catch (error) {
      console.error('❌ Token refresh error:', error);
      return false;
    }
  }

  private handleAuthFailure(): void {
    // Clear all tokens
    this.token = null;
    this.tokenStorage.clear();
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    
    // Redirect to login page
    window.location.href = '/login';
  }

  // Authentication methods
  async login(email: string, password: string): Promise<ApiResponse> {
    const response = await this.makeRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (response.success && response.data && (response.data as any).token) {
      this.token = (response.data as any).token;
      if (this.token) {
        await this.tokenStorage.storeToken(this.token);
      }
      
      // Store refresh token if available
      const refreshToken = (response.data as any).refreshToken;
      if (refreshToken) {
        await this.tokenStorage.storeRefreshToken(refreshToken);
      }
    }

    return response;
  }

  async signup(userData: {
    name: string;
    email: string;
    password: string;
    role: string;
  }): Promise<ApiResponse> {
    return this.makeRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async logout(): Promise<void> {
    this.token = null;
    this.tokenStorage.clear();
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
  }

  async verifyOTP(email: string, otp: string): Promise<ApiResponse> {
    return this.makeRequest('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    });
  }

  async resendOTP(email: string): Promise<ApiResponse> {
    return this.makeRequest('/auth/resend-otp', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async forgotPassword(email: string): Promise<ApiResponse> {
    return this.makeRequest('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async resetPassword(token: string, password: string): Promise<ApiResponse> {
    return this.makeRequest('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  }

  // User methods
  async getCurrentUser(): Promise<ApiResponse> {
    return this.makeRequest('/auth/me');
  }

  async updateProfile(userData: any): Promise<ApiResponse> {
    return this.makeRequest('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<ApiResponse> {
    return this.makeRequest('/users/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  // Course methods
  async getCourses(params?: any): Promise<ApiResponse> {
    const queryParams = params ? new URLSearchParams(params).toString() : '';
    return this.makeRequest(`/courses${queryParams ? `?${queryParams}` : ''}`);
  }

  async getCourse(courseId: string): Promise<ApiResponse> {
    const response = await this.makeRequest(`/courses/${courseId}`);
    
    // Transform the response data to use modules terminology
    if (response.success && response.data) {
      return {
        ...response,
        data: {
          ...response.data,
          course: (response.data as any).course ? transformCourseData((response.data as any).course) : (response.data as any).course,
          progress: (response.data as any).progress ? transformProgressData((response.data as any).progress) : (response.data as any).progress,
        }
      };
    }
    
    return response;
  }

  async createCourse(courseData: any): Promise<ApiResponse> {
    // Check if courseData is FormData (for file uploads)
    if (courseData instanceof FormData) {
      // For FormData, we need to handle headers differently
      const url = `${this.baseURL}/courses`;
      try {
        const response = await fetch(url, {
          method: 'POST',
          body: courseData,
          headers: this.token ? { 'Authorization': `Bearer ${this.token}` } : {},
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data;
      } catch (error) {
        console.error('API request failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    } else {
      // For regular JSON data
      return this.makeRequest('/courses', {
        method: 'POST',
        body: JSON.stringify(courseData),
      });
    }
  }

  async updateCourse(courseId: string, courseData: any): Promise<ApiResponse> {
    return this.makeRequest(`/courses/${courseId}`, {
      method: 'PUT',
      body: JSON.stringify(courseData),
    });
  }

  async deleteCourse(courseId: string): Promise<ApiResponse> {
    return this.makeRequest(`/courses/${courseId}`, {
      method: 'DELETE',
    });
  }

  async submitCourse(courseId: string): Promise<ApiResponse> {
    return this.makeRequest(`/courses/${courseId}/submit`, {
      method: 'POST',
    });
  }

  async enrollInCourse(courseId: string): Promise<ApiResponse> {
    return this.makeRequest(`/courses/${courseId}/enroll`, {
      method: 'POST',
    });
  }

  async getEnrollments(): Promise<ApiResponse> {
    return this.makeRequest('/users/courses');
  }

  // Additional course-related methods needed by frontend
  async getInstructorCourses(params?: any): Promise<ApiResponse> {
    const queryParams = params ? new URLSearchParams(params).toString() : '';
    return this.makeRequest(`/courses/instructor/my-courses${queryParams ? `?${queryParams}` : ''}`);
  }

  async getEnrolledCourses(params?: any): Promise<ApiResponse> {
    const queryParams = params ? new URLSearchParams(params).toString() : '';
    return this.makeRequest(`/users/courses${queryParams ? `?${queryParams}` : ''}`);
  }

  async getPublishedCourses(params?: any): Promise<ApiResponse> {
    const queryParams = params ? new URLSearchParams(params).toString() : '';
    return this.makeRequest(`/courses${queryParams ? `?${queryParams}` : ''}`);
  }

  // Course content and progress methods
  async getCourseContent(courseId: string): Promise<ApiResponse> {
    const response = await this.makeRequest(`/courses/${courseId}/content`);
    
    // Transform the response data to use modules terminology
    if (response.success && response.data) {
      return {
        ...response,
        data: {
          ...response.data,
          course: (response.data as any).course ? transformCourseData((response.data as any).course) : (response.data as any).course,
          progress: (response.data as any).progress ? transformProgressData((response.data as any).progress) : (response.data as any).progress,
        }
      };
    }
    
    return response;
  }

  async getCourseQuizzes(courseId: string): Promise<ApiResponse> {
    return this.makeRequest(`/courses/${courseId}/quizzes`);
  }

  // Get quiz attempts status
  async getQuizAttempts(courseId: string, quizId: string): Promise<ApiResponse> {
    return this.makeRequest(`/courses/${courseId}/quizzes/${quizId}/attempts`);
  }

  // Admin methods
  async getAdminDashboard(): Promise<ApiResponse> {
    return this.makeRequest('/admin/stats');
  }

  async getAllUsers(): Promise<ApiResponse> {
    return this.makeRequest('/admin/users');
  }

  async getUsers(params?: any): Promise<ApiResponse> {
    const queryParams = params ? new URLSearchParams(params).toString() : '';
    return this.makeRequest(`/admin/users${queryParams ? `?${queryParams}` : ''}`);
  }

  async createUser(userData: any): Promise<ApiResponse> {
    return this.makeRequest('/admin/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async updateUser(userId: string, userData: any): Promise<ApiResponse> {
    return this.makeRequest(`/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  }

  async updateUserStatus(userId: string, isActive: boolean): Promise<ApiResponse> {
    return this.makeRequest(`/admin/users/${userId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ isActive }),
    });
  }

  async deleteUser(userId: string): Promise<ApiResponse> {
    return this.makeRequest(`/admin/users/${userId}`, {
      method: 'DELETE',
    });
  }

  async updateUserRole(userId: string, role: string): Promise<ApiResponse> {
    return this.makeRequest(`/admin/users/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    });
  }

  async getAllCourses(): Promise<ApiResponse> {
    return this.makeRequest('/admin/courses');
  }

  async getAdminCourses(params?: any): Promise<ApiResponse> {
    const queryParams = params ? new URLSearchParams(params).toString() : '';
    return this.makeRequest(`/admin/courses${queryParams ? `?${queryParams}` : ''}`);
  }

  async getAdminCourse(courseId: string): Promise<ApiResponse> {
    return this.makeRequest(`/admin/courses/${courseId}`);
  }

  async bulkCourseAction(action: string, courseIds: string[]): Promise<ApiResponse> {
    return this.makeRequest('/admin/courses/bulk', {
      method: 'POST',
      body: JSON.stringify({ action, courseIds }),
    });
  }

  async startCourseReview(courseId: string): Promise<ApiResponse> {
    return this.makeRequest(`/admin/courses/${courseId}/start-review`, {
      method: 'POST',
    });
  }

  async deleteAdminCourse(courseId: string): Promise<ApiResponse> {
    return this.makeRequest(`/admin/courses/${courseId}`, {
      method: 'DELETE',
    });
  }

  async updateCourseStatus(courseId: string, status: string, reason?: string): Promise<ApiResponse> {
    return this.makeRequest(`/admin/courses/${courseId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, reason }),
    });
  }

  async getCourseWorkflowHistory(courseId: string): Promise<ApiResponse> {
    return this.makeRequest(`/admin/courses/${courseId}/workflow-history`);
  }

  async approveCourse(courseId: string, feedback?: any): Promise<ApiResponse> {
    return this.makeRequest(`/admin/courses/${courseId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ feedback }),
    });
  }

  async rejectCourse(courseId: string, reason?: string): Promise<ApiResponse> {
    return this.makeRequest(`/admin/courses/${courseId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async exportData(type: string, format: string): Promise<ApiResponse> {
    return this.makeRequest(`/admin/export/${type}?format=${format}`);
  }

  // Admin profile methods
  async getAdminProfile(): Promise<ApiResponse> {
    return this.makeRequest('/admin/profile');
  }

  async updateAdminProfile(profileData: any): Promise<ApiResponse> {
    return this.makeRequest('/admin/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
  }

  // User progress and stats methods
  async getUserProgress(): Promise<ApiResponse> {
    return this.makeRequest('/users/progress');
  }

  async getUserCourseProgress(courseId: string): Promise<ApiResponse> {
    return this.makeRequest(`/users/progress/${courseId}`);
  }

  async updateCourseProgress(courseId: string, progressData: any): Promise<ApiResponse> {
    return this.makeRequest(`/users/progress/${courseId}`, {
      method: 'PUT',
      body: JSON.stringify(progressData),
    });
  }

  async getUserEnrolledCourses(params?: any): Promise<ApiResponse> {
    const queryParams = params ? new URLSearchParams(params).toString() : '';
    return this.makeRequest(`/users/courses${queryParams ? `?${queryParams}` : ''}`);
  }

  async getUserStats(): Promise<ApiResponse> {
    return this.makeRequest('/users/stats');
  }

  async getUserProfile(): Promise<ApiResponse> {
    return this.makeRequest('/users/profile');
  }

  async updateUserProfile(userData: any): Promise<ApiResponse> {
    return this.makeRequest('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  }

  async uploadAvatar(file: File): Promise<ApiResponse> {
    const formData = new FormData();
    formData.append('avatar', file);

    const url = `${this.baseURL}/users/avatar`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
        headers: this.token ? { 'Authorization': `Bearer ${this.token}` } : {},
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Avatar upload failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // File upload methods
  async uploadFile(file: File, type: string): Promise<ApiResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);

    return this.makeRequest('/upload', {
      method: 'POST',
      body: formData,
      headers: this.token ? { 'Authorization': `Bearer ${this.token}` } : {},
    });
  }

  // Certificate methods
  async getUserCertificates(): Promise<ApiResponse> {
    return this.makeRequest('/certificates/my-certificates');
  }

  async getCertificate(certificateId: string): Promise<ApiResponse> {
    return this.makeRequest(`/certificates/${certificateId}`);
  }

  async viewCertificate(certificateId: string): Promise<ApiResponse> {
    return this.makeRequest(`/certificates/${certificateId}/view`);
  }

  async downloadCertificate(certificateId: string): Promise<ApiResponse> {
    return this.makeRequest(`/certificates/${certificateId}/download`);
  }

  async verifyCertificate(certificateId: string, certificateNumber?: string): Promise<ApiResponse> {
    const params = certificateNumber ? `?cert=${certificateNumber}` : '';
    return this.makeRequest(`/certificates/verify/${certificateId}${params}`);
  }

  async generateCertificate(userId: string, courseId: string, enrollmentId: string): Promise<ApiResponse> {
    return this.makeRequest('/certificates/generate', {
      method: 'POST',
      body: JSON.stringify({ userId, courseId, enrollmentId }),
    });
  }

  async getCourseCertificates(courseId: string): Promise<ApiResponse> {
    return this.makeRequest(`/certificates/course/${courseId}`);
  }

  async getCertificateStats(): Promise<ApiResponse> {
    return this.makeRequest('/certificates/stats');
  }

  // Enhanced course navigation methods
  async getCourseHome(courseId: string): Promise<ApiResponse> {
    return this.makeRequest(`/courses/${courseId}/home`);
  }

  async getCourseGrades(courseId: string): Promise<ApiResponse> {
    return this.makeRequest(`/courses/${courseId}/grades`);
  }

  async updateLessonProgressEnhanced(courseId: string, lessonId: string, progressData: {
    timeSpent?: number;
    currentPosition?: number;
    percentageWatched?: number;
    interactions?: any[];
    notes?: any[];
    bookmarks?: any[];
    isCompleted?: boolean;
  }): Promise<ApiResponse> {
    return this.makeRequest(`/courses/${courseId}/lessons/${lessonId}/progress`, {
      method: 'PUT',
      body: JSON.stringify(progressData)
    });
  }

  async markLessonComplete(courseId: string, lessonId: string): Promise<ApiResponse> {
    return this.makeRequest(`/courses/${courseId}/lessons/${lessonId}/complete`, {
      method: 'POST'
    });
  }

  // Quiz methods
  async submitQuizAttempt(courseId: string, attemptData: {
    quizId: string;
    answers: Array<{
      questionId: string;
      answer: string | string[];
      timeSpent: number;
      hintsUsed: number;
      confidence: number;
    }>;
    score: number;
    timeSpent: number;
  }): Promise<ApiResponse> {
    // Validate required parameters
    if (!courseId || !attemptData.quizId) {
      return {
        success: false,
        error: 'Course ID and Quiz ID are required'
      };
    }

    if (!attemptData.answers || !Array.isArray(attemptData.answers) || attemptData.answers.length === 0) {
      return {
        success: false,
        error: 'Quiz answers are required'
      };
    }

    // Validate each answer
    for (const answer of attemptData.answers) {
      if (!answer.questionId || answer.answer === undefined || answer.answer === null) {
        return {
          success: false,
          error: 'All questions must have valid answers'
        };
      }
    }

    try {
      return await this.makeRequest(`/courses/${courseId}/quizzes/${attemptData.quizId}/submit`, {
        method: 'POST',
        body: JSON.stringify({
          answers: attemptData.answers,
          score: attemptData.score,
          timeSpent: attemptData.timeSpent
        }),
      });
    } catch (error) {
      console.error('Quiz submission error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to submit quiz'
      };
    }
  }

  // Learner achievements - for dynamic achievements data
  async getLearnerAchievements(params?: any): Promise<ApiResponse> {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null) {
          queryParams.append(key, params[key].toString());
        }
    });
  }

    const queryString = queryParams.toString();
    const endpoint = queryString ? `/users/achievements?${queryString}` : '/users/achievements';
    
    return this.makeRequest(endpoint);
  }

  // Health check
  async healthCheck(): Promise<ApiResponse> {
    return this.makeRequest('/health');
  }
}

export const apiClient = new ApiClient();

// Export common API methods for easy use
export const login = (email: string, password: string) => apiClient.login(email, password);
export const signup = (userData: any) => apiClient.signup(userData);
export const logout = () => apiClient.logout();
export const verifyOTP = (email: string, otp: string) => apiClient.verifyOTP(email, otp);
export const resendOTP = (email: string) => apiClient.resendOTP(email);
export const forgotPassword = (email: string) => apiClient.forgotPassword(email);
export const resetPassword = (token: string, password: string) => apiClient.resetPassword(token, password);

export const getCurrentUser = () => apiClient.getCurrentUser();
export const updateProfile = (userData: any) => apiClient.updateProfile(userData);
export const changePassword = (currentPassword: string, newPassword: string) => apiClient.changePassword(currentPassword, newPassword);

// Course exports
export const getCourses = (params?: any) => apiClient.getCourses(params);
export const getCourse = (courseId: string) => apiClient.getCourse(courseId);
export const createCourse = (courseData: any) => apiClient.createCourse(courseData);
export const updateCourse = (courseId: string, courseData: any) => apiClient.updateCourse(courseId, courseData);
export const deleteCourse = (courseId: string) => apiClient.deleteCourse(courseId);
export const submitCourse = (courseId: string) => apiClient.submitCourse(courseId);
export const enrollInCourse = (courseId: string) => apiClient.enrollInCourse(courseId);
export const getEnrollments = () => apiClient.getEnrollments();
export const getInstructorCourses = (params?: any) => apiClient.getInstructorCourses(params);
export const getEnrolledCourses = (params?: any) => apiClient.getEnrolledCourses(params);
export const getPublishedCourses = (params?: any) => apiClient.getPublishedCourses(params);

// Enhanced course navigation exports
export const getCourseHome = (courseId: string) => apiClient.getCourseHome(courseId);
export const getCourseGrades = (courseId: string) => apiClient.getCourseGrades(courseId);
export const updateLessonProgressEnhanced = (courseId: string, lessonId: string, progressData: {
  timeSpent?: number;
  currentPosition?: number;
  percentageWatched?: number;
  interactions?: any[];
  notes?: any[];
  bookmarks?: any[];
  isCompleted?: boolean;
}) => apiClient.updateLessonProgressEnhanced(courseId, lessonId, progressData);

export const getCourseContent = (courseId: string) => apiClient.getCourseContent(courseId);
export const getCourseQuizzes = (courseId: string) => apiClient.getCourseQuizzes(courseId);
export const getQuizAttempts = (courseId: string, quizId: string) => apiClient.getQuizAttempts(courseId, quizId);

// User progress and stats exports
export const getUserProgress = () => apiClient.getUserProgress();
export const getUserCourseProgress = (courseId: string) => apiClient.getUserCourseProgress(courseId);
export const updateCourseProgress = (courseId: string, progressData: any) => apiClient.updateCourseProgress(courseId, progressData);
export const getUserEnrolledCourses = (params?: any) => apiClient.getUserEnrolledCourses(params);
export const getUserStats = () => apiClient.getUserStats();

// Admin exports
export const getAdminDashboard = () => apiClient.getAdminDashboard();
export const getAllUsers = () => apiClient.getAllUsers();
export const getUsers = (params?: any) => apiClient.getUsers(params);
export const createUser = (userData: any) => apiClient.createUser(userData);
export const updateUser = (userId: string, userData: any) => apiClient.updateUser(userId, userData);
export const updateUserStatus = (userId: string, isActive: boolean) => apiClient.updateUserStatus(userId, isActive);
export const deleteUser = (userId: string) => apiClient.deleteUser(userId);
export const updateUserRole = (userId: string, role: string) => apiClient.updateUserRole(userId, role);

export const getAllCourses = () => apiClient.getAllCourses();
export const getAdminCourses = (params?: any) => apiClient.getAdminCourses(params);
export const getAdminCourse = (courseId: string) => apiClient.getAdminCourse(courseId);
export const bulkCourseAction = (action: string, courseIds: string[]) => apiClient.bulkCourseAction(action, courseIds);
export const startCourseReview = (courseId: string) => apiClient.startCourseReview(courseId);
export const deleteAdminCourse = (courseId: string) => apiClient.deleteAdminCourse(courseId);
export const updateCourseStatus = (courseId: string, status: string, reason?: string) => apiClient.updateCourseStatus(courseId, status, reason);
export const getCourseWorkflowHistory = (courseId: string) => apiClient.getCourseWorkflowHistory(courseId);
export const approveCourse = (courseId: string, feedback?: any) => apiClient.approveCourse(courseId, feedback);
export const rejectCourse = (courseId: string, reason?: string) => apiClient.rejectCourse(courseId, reason);
export const exportData = (type: string, format: string) => apiClient.exportData(type, format);

// Admin profile exports
export const getAdminProfile = () => apiClient.getAdminProfile();
export const updateAdminProfile = (profileData: any) => apiClient.updateAdminProfile(profileData);

// User profile exports
export const getUserProfile = () => apiClient.getUserProfile();
export const updateUserProfile = (userData: any) => apiClient.updateUserProfile(userData);
export const uploadAvatar = (file: File) => apiClient.uploadAvatar(file);

// File upload exports
export const uploadFile = (file: File, type: string) => apiClient.uploadFile(file, type);

// Certificate exports
export const getUserCertificates = () => apiClient.getUserCertificates();
export const getCertificate = (certificateId: string) => apiClient.getCertificate(certificateId);
export const viewCertificate = (certificateId: string) => apiClient.viewCertificate(certificateId);
export const downloadCertificate = (certificateId: string) => apiClient.downloadCertificate(certificateId);
export const verifyCertificate = (certificateId: string, certificateNumber?: string) => apiClient.verifyCertificate(certificateId, certificateNumber);
export const generateCertificate = (userId: string, courseId: string, enrollmentId: string) => apiClient.generateCertificate(userId, courseId, enrollmentId);
export const getCourseCertificates = (courseId: string) => apiClient.getCourseCertificates(courseId);
export const getCertificateStats = () => apiClient.getCertificateStats();

// Quiz exports
export const submitQuizAttempt = (courseId: string, attemptData: any) => apiClient.submitQuizAttempt(courseId, attemptData);

// Achievement exports
export const getLearnerAchievements = (params?: any) => apiClient.getLearnerAchievements(params);

// Quiz and analytics exports removed - using mock data in frontend

export const healthCheck = () => apiClient.healthCheck();

// File URL Service with comprehensive handling
class FileUrlService {
  private baseUrl: string;
  private apiUrl: string;
  private urlCache = new Map<string, string>();
  private failedUrls = new Set<string>();

  constructor() {
    this.apiUrl = import.meta.env.VITE_API_URL || '/api/v1';
    
    // Extract base URL from API URL
    if (this.apiUrl.includes('/api/v1')) {
      this.baseUrl = this.apiUrl.replace('/api/v1', '');
    } else if (this.apiUrl.includes('/api')) {
      this.baseUrl = this.apiUrl.replace('/api', '');
    } else {
      // If API URL doesn't contain /api, assume it's the base URL
      this.baseUrl = this.apiUrl;
    }
    
    // Fallback to current origin if base URL is empty or malformed
    if (!this.baseUrl || this.baseUrl === this.apiUrl || this.baseUrl === '') {
      this.baseUrl = window.location.origin;
      console.warn('FileUrlService: Using fallback base URL (current origin):', this.baseUrl);
    }
    
    // Ensure base URL doesn't end with a slash
    if (this.baseUrl.endsWith('/')) {
      this.baseUrl = this.baseUrl.slice(0, -1);
    }
    
    // Only log in development mode
    if (import.meta.env.DEV) {
      console.log('🔧 FileUrlService initialized:', { 
        apiUrl: this.apiUrl, 
        baseUrl: this.baseUrl,
        env: import.meta.env.VITE_API_URL,
        origin: window.location.origin,
        mode: import.meta.env.MODE
      });
    }
  }

  /**
   * Get a validated file URL with fallback handling
   */
  getFileUrl(filePath?: string | null, fileType: 'thumbnail' | 'video' | 'avatar' | 'document' | 'material' = 'thumbnail'): string {
    if (import.meta.env.DEV) {
      console.log('🔍 Getting file URL for:', { filePath, fileType, baseUrl: this.baseUrl });
    }
    
    if (!filePath || filePath === 'undefined' || filePath === 'null') {
      if (import.meta.env.DEV) {
        console.log('❌ No file path provided, returning placeholder');
      }
      return this.getPlaceholderUrl(fileType);
    }

    // Check cache first
    const cacheKey = `${fileType}:${filePath}`;
    if (this.urlCache.has(cacheKey)) {
      const cachedUrl = this.urlCache.get(cacheKey)!;
      if (import.meta.env.DEV) {
        console.log('💾 Returning cached URL:', cachedUrl);
      }
      return cachedUrl;
    }

    // Check if this URL has failed before
    if (this.failedUrls.has(filePath)) {
      if (import.meta.env.DEV) {
        console.log('⚠️ URL has failed before, returning placeholder:', filePath);
      }
      return this.getPlaceholderUrl(fileType);
    }

    let finalUrl = '';

    try {
      // Handle different URL formats
      if (this.isFullUrl(filePath)) {
        finalUrl = filePath;
        if (import.meta.env.DEV) console.log('✅ Using full URL:', finalUrl);
      } else if (this.isBlobUrl(filePath)) {
        finalUrl = filePath;
        if (import.meta.env.DEV) console.log('✅ Using blob URL:', finalUrl);
      } else if (this.isRelativeUploadPath(filePath)) {
        finalUrl = `${this.baseUrl}${filePath}`;
        if (import.meta.env.DEV) console.log('✅ Using relative upload path:', finalUrl);
      } else if (this.isFilename(filePath)) {
        finalUrl = this.constructFileUrl(filePath, fileType);
        if (import.meta.env.DEV) console.log('✅ Constructed URL from filename:', finalUrl);
      } else {
        // Fallback for unknown formats - assume it's a relative path
        if (this.isValidPath(filePath)) {
          // If path doesn't start with /, add it
          const cleanPath = filePath.startsWith('/') ? filePath : `/${filePath}`;
          finalUrl = `${this.baseUrl}${cleanPath}`;
          if (import.meta.env.DEV) console.log('✅ Using fallback relative path:', finalUrl);
        } else {
          finalUrl = this.getPlaceholderUrl(fileType);
          if (import.meta.env.DEV) console.log('❌ Invalid path, using placeholder:', finalUrl);
        }
      }

      // Cache the result only if it's not a placeholder
      if (!this.isPlaceholderUrl(finalUrl)) {
        this.urlCache.set(cacheKey, finalUrl);
      }
      
      if (import.meta.env.DEV) {
        console.log('🎯 Final URL generated:', finalUrl);
        
        // Test the URL immediately in development
        this.testUrlInBackground(finalUrl);
      }
      return finalUrl;
    } catch (error) {
      console.warn('❌ Error constructing file URL:', error, { filePath, fileType });
      return this.getPlaceholderUrl(fileType);
    }
  }

  /**
   * Test a URL in the background (development only)
   */
  private async testUrlInBackground(url: string): Promise<void> {
    if (!import.meta.env.DEV) return;
    
    try {
      const response = await fetch(url, { method: 'HEAD' });
      if (response.ok) {
        console.log('✅ URL is accessible:', url);
      } else {
        console.warn('⚠️ URL returned error:', url, response.status, response.statusText);
      }
    } catch (error) {
      console.error('❌ URL test failed:', url, error);
    }
  }

  /**
   * Mark a URL as failed to prevent repeated attempts
   */
  markUrlAsFailed(url: string): void {
    this.failedUrls.add(url);
    // Remove from cache if it exists
    for (const [key, value] of this.urlCache.entries()) {
      if (value === url) {
        this.urlCache.delete(key);
      }
    }
    
    if (import.meta.env.DEV) {
      console.warn('❌ Marked URL as failed:', url);
    }
  }

  /**
   * Clear failed URL cache (useful for retry mechanisms)
   */
  clearFailedUrls(): void {
    this.failedUrls.clear();
    if (import.meta.env.DEV) {
      console.log('🔄 Cleared failed URLs cache');
    }
  }

  /**
   * Validate if a URL is accessible
   */
  async validateUrl(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      const isValid = response.ok;
      
      if (import.meta.env.DEV) {
        console.log(`🔍 URL validation for ${url}:`, isValid ? '✅ Valid' : '❌ Invalid', response.status);
      }
      
      return isValid;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('❌ URL validation failed:', url, error);
      }
      return false;
    }
  }

  /**
   * Pre-validate a file URL and return the best option
   */
  async getValidatedFileUrl(filePath?: string | null, fileType: 'thumbnail' | 'video' | 'avatar' | 'document' | 'material' = 'thumbnail'): Promise<string> {
    const url = this.getFileUrl(filePath, fileType);
    
    // If it's a placeholder, return immediately
    if (this.isPlaceholderUrl(url)) {
      return url;
    }

    // If it's a blob URL, return immediately (local file)
    if (this.isBlobUrl(url)) {
      return url;
    }

    // Validate the URL
    const isValid = await this.validateUrl(url);
    if (isValid) {
      return url;
    } else {
      this.markUrlAsFailed(url);
      return this.getPlaceholderUrl(fileType);
    }
  }

  // Private helper methods
  private isFullUrl(path: string): boolean {
    return path.startsWith('http://') || path.startsWith('https://');
  }

  private isBlobUrl(path: string): boolean {
    return path.startsWith('blob:');
  }

  private isRelativeUploadPath(path: string): boolean {
    return path.startsWith('/uploads');
  }

  private isFilename(path: string): boolean {
    return !path.includes('/') && path.includes('.');
  }

  private isValidPath(path: string): boolean {
    return path.length > 0 && !path.includes('undefined') && !path.includes('null');
  }

  private isPlaceholderUrl(url: string): boolean {
    return url.includes('/api/placeholder/') || url.includes('placeholder') || url.startsWith('data:');
  }

  private constructFileUrl(filename: string, fileType: string): string {
    const subPaths = {
      thumbnail: 'courses/thumbnails',
      video: 'courses/videos',
      avatar: 'users/avatars',
      document: 'documents',
      material: 'lessons/materials'
    };

    const subPath = subPaths[fileType as keyof typeof subPaths] || 'images';
    const constructedUrl = `${this.baseUrl}/uploads/${subPath}/${filename}`;
    
    if (import.meta.env.DEV) {
      console.log('🔨 Constructed file URL:', { filename, fileType, subPath, baseUrl: this.baseUrl, constructedUrl });
    }
    
    return constructedUrl;
  }

  private getPlaceholderUrl(fileType: string): string {
    // Use data URLs for better reliability
    const placeholders = {
      thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+CiAgPHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIyNCIgZmlsbD0iIzZiNzI4MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkNvdXJzZSBUaHVtYm5haWw8L3RleHQ+Cjwvc3ZnPg==',
      video: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQwIiBoZWlnaHQ9IjM2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMWYyOTM3Ii8+CiAgPGNpcmNsZSBjeD0iNTAlIiBjeT0iNTAlIiByPSI0MCIgZmlsbD0iIzM3NEY2OCIvPgogIDxwb2x5Z29uIHBvaW50cz0iMjkwLDIwMCAzNTAsMjMwIDI5MCwyNjAiIGZpbGw9IndoaXRlIi8+CiAgPHRleHQgeD0iNTAlIiB5PSI4NSUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxOCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiPlZpZGVvIFBsYXllcjwvdGV4dD4KPC9zdmc+',
      avatar: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTUwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8Y2lyY2xlIGN4PSI3NSIgY3k9Ijc1IiByPSI3NSIgZmlsbD0iI2YzZjRmNiIvPgogIDx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTgiIGZpbGw9IiM2YjcyODAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5Vc2VyPC90ZXh0Pgo8L3N2Zz4=',
      document: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjI1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2IiBzdHJva2U9IiNkMWQ1ZGIiLz4KICA8dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE2IiBmaWxsPSIjNmI3MjgwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+RG9jdW1lbnQ8L3RleHQ+Cjwvc3ZnPg==',
      material: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2IiBzdHJva2U9IiNkMWQ1ZGIiLz4KICA8dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE2IiBmaWxsPSIjNmI3MjgwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+TWF0ZXJpYWw8L3RleHQ+Cjwvc3ZnPg=='
    };

    const placeholder = placeholders[fileType as keyof typeof placeholders];
    if (import.meta.env.DEV) {
      console.log('📄 Generated placeholder URL for', fileType);
    }
    return placeholder || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+CiAgPHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxOCIgZmlsbD0iIzZiNzI4MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pgo8L3N2Zz4=';
  }

  /**
   * Get debug information about the service
   */
  getDebugInfo(): any {
    return {
      baseUrl: this.baseUrl,
      apiUrl: this.apiUrl,
      environment: {
        VITE_API_URL: import.meta.env.VITE_API_URL,
        DEV: import.meta.env.DEV,
        MODE: import.meta.env.MODE,
        VITE_BACKEND_URL: import.meta.env.VITE_BACKEND_URL
      },
      cacheSize: this.urlCache.size,
      failedUrlsCount: this.failedUrls.size,
      windowOrigin: window.location.origin,
      windowLocation: window.location.href
    };
  }
}

// Create singleton instance
const fileUrlService = new FileUrlService();

// Helper function to get proper file URL (keeping backward compatibility)
export const getFileUrl = (filePath?: string, fileType: 'thumbnail' | 'video' | 'avatar' | 'document' | 'material' = 'thumbnail'): string => {
  return fileUrlService.getFileUrl(filePath, fileType);
};

// Enhanced function with validation
export const getValidatedFileUrl = async (filePath?: string, fileType: 'thumbnail' | 'video' | 'avatar' | 'document' | 'material' = 'thumbnail'): Promise<string> => {
  return fileUrlService.getValidatedFileUrl(filePath, fileType);
};

// Mark URL as failed
export const markFileUrlAsFailed = (url: string): void => {
  fileUrlService.markUrlAsFailed(url);
};

// Clear failed URL cache
export const clearFailedFileUrls = (): void => {
  fileUrlService.clearFailedUrls();
};

// Debug function to test file URL resolution and backend connectivity
export const debugFileSystem = async (courseId?: string) => {
  try {
    const results = {
      timestamp: new Date().toISOString(),
      environment: {
        VITE_API_URL: import.meta.env.VITE_API_URL,
        isDevelopment: import.meta.env.DEV,
        mode: import.meta.env.MODE,
        currentOrigin: window.location.origin
      },
      fileUrlService: {
        baseUrl: (fileUrlService as any).baseUrl,
        apiUrl: (fileUrlService as any).apiUrl
      },
      fileUrlTests: {
        thumbnail: getFileUrl('test-thumbnail.jpg', 'thumbnail'),
        video: getFileUrl('test-video.mp4', 'video'),
        avatar: getFileUrl('test-avatar.png', 'avatar'),
        placeholderThumbnail: getFileUrl(undefined, 'thumbnail'),
        placeholderAvatar: getFileUrl(undefined, 'avatar')
      },
      backendTests: {
        health: null as any,
        uploads: null as any
      },
      courseFiles: null as any,
      courseData: null as any
    };

    // Test backend health
    try {
      const healthResponse = await fetch(`${import.meta.env.VITE_API_URL || '/api/v1'}/health`);
      if (healthResponse.ok) {
        results.backendTests.health = await healthResponse.json();
      } else {
        results.backendTests.health = { 
          error: `HTTP ${healthResponse.status}: ${healthResponse.statusText}` 
        };
      }
    } catch (error) {
      results.backendTests.health = { 
        error: error instanceof Error ? error.message : 'Health check failed' 
      };
    }

    // Test uploads debug endpoint
    try {
      const uploadsResponse = await fetch(`${import.meta.env.VITE_API_URL || '/api/v1'}/debug/uploads`);
      if (uploadsResponse.ok) {
        results.backendTests.uploads = await uploadsResponse.json();
      } else {
        results.backendTests.uploads = { 
          error: `HTTP ${uploadsResponse.status}: ${uploadsResponse.statusText}` 
        };
      }
    } catch (error) {
      results.backendTests.uploads = { 
        error: error instanceof Error ? error.message : 'Uploads debug failed' 
      };
    }

    // Test course-specific files if courseId provided
    if (courseId) {
      // Test course data fetching
      try {
        const courseResponse = await getCourse(courseId);
        results.courseData = {
          success: courseResponse.success,
          course: courseResponse.success ? {
            id: courseResponse.data.course?.id || courseResponse.data.course?._id,
            title: courseResponse.data.course?.title,
            thumbnail: courseResponse.data.course?.thumbnail,
            sections: courseResponse.data.course?.sections?.length || 0,
            instructorName: courseResponse.data.course?.instructorName,
            status: courseResponse.data.course?.status
          } : null,
          error: courseResponse.error
        };
      } catch (error) {
        results.courseData = { error: error instanceof Error ? error.message : 'Failed to fetch course data' };
      }
    }

    return results;
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Debug function failed',
      timestamp: new Date().toISOString()
    };
  }
};

// Test a specific file URL by trying to fetch it
export const testFileUrl = async (url: string) => {
  try {
    console.log('Testing file URL:', url);
    const response = await fetch(url, { method: 'HEAD' });
    console.log('File URL test result:', {
      url,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
    });
    return {
      url,
      accessible: response.ok,
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get('content-type'),
      contentLength: response.headers.get('content-length')
    };
  } catch (error) {
    console.error('File URL test failed:', error);
    return {
      url,
      accessible: false,
      error: error instanceof Error ? error.message : 'Test failed'
    };
  }
};

export default apiClient;

// Helper function to handle API responses
const handleApiResponse = async (response: Response) => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }
  return response.json();
};



export const submitQuiz = async (courseId: string, quizId: string, answers: any[], timeSpent: number = 0) => {
  try {
    const token = await apiClient.getToken();
    console.log('🔐 Submit quiz with token:', token ? 'Token found' : 'No token');
    
    const response = await fetch(`${import.meta.env.VITE_API_URL || '/api/v1'}/courses/${courseId}/quizzes/${quizId}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
      body: JSON.stringify({
        answers,
        timeSpent,
      }),
    });

    return await handleApiResponse(response);
  } catch (error) {
    console.error('Error submitting quiz:', error);
    throw error;
  }
};

export const getQuizResults = async (courseId: string, quizId: string) => {
  try {
    const token = await apiClient.getToken();
    
    const response = await fetch(`${import.meta.env.VITE_API_URL || '/api/v1'}/courses/${courseId}/quizzes/${quizId}/results`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
    });

    return await handleApiResponse(response);
  } catch (error) {
    console.error('Error getting quiz results:', error);
    throw error;
  }
};

export const markLessonComplete = async (courseId: string, lessonId: string): Promise<ApiResponse> => {
  try {
    const token = await apiClient.getToken();
    const response = await fetch(`${import.meta.env.VITE_API_URL || '/api/v1'}/courses/${courseId}/lessons/${lessonId}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    return await handleApiResponse(response);
  } catch (error) {
    console.error('Error marking lesson complete:', error);
    throw error;
  }
};

export const updateLessonProgress = async (courseId: string, lessonId: string, progressData: {
  timeSpent?: number;
  currentPosition?: number;
  interactions?: any[];
}): Promise<ApiResponse> => {
  try {
    const token = await apiClient.getToken();
    const response = await fetch(`${import.meta.env.VITE_API_URL || '/api/v1'}/courses/${courseId}/lessons/${lessonId}/progress`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(progressData),
    });

    return await handleApiResponse(response);
  } catch (error) {
    console.error('Error updating lesson progress:', error);
    throw error;
  }
};

export const getCourseProgress = async (courseId: string): Promise<ApiResponse> => {
  try {
    const token = await apiClient.getToken();
    const response = await fetch(`${import.meta.env.VITE_API_URL || '/api/v1'}/courses/${courseId}/progress`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    const result = await handleApiResponse(response);
    
    // Transform the response data to use modules terminology
    if (result.success && result.data) {
      return {
        ...result,
        data: {
          ...result.data,
          progress: (result.data as any).progress ? transformProgressData((result.data as any).progress) : (result.data as any).progress,
        }
      };
    }
    
    return result;
  } catch (error) {
    console.error('Error getting course progress:', error);
    throw error;
  }
};

export const getInstructorAnalytics = async () => {
  try {
    const token = await apiClient.getToken();
    const response = await fetch(`${import.meta.env.VITE_API_URL || '/api/v1'}/courses/instructor/analytics`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    return await handleApiResponse(response);
  } catch (error) {
    console.error('Error getting instructor analytics:', error);
    throw error;
  }
};

export const getCourseStats = async (courseId: string) => {
  try {
    const token = await apiClient.getToken();
    const response = await fetch(`${import.meta.env.VITE_API_URL || '/api/v1'}/courses/${courseId}/stats`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    return await handleApiResponse(response);
  } catch (error) {
    console.error('Error getting course stats:', error);
    throw error;
  }
};