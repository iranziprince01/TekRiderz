import { apiClient } from '../utils/api';

export interface CleanupResult {
  deletedCourses: string[];
  deletedEnrollments: string[];
  deletedProgress: string[];
  deletedThumbnails: string[];
  deletedPdfs: string[];
  errors: string[];
}

export interface CleanupStats {
  lastCleanupTime: number;
  isRunning: boolean;
  nextCleanupTime: number;
}

export class FrontendCleanupService {
  private static instance: FrontendCleanupService;
  private fileValidationCache = new Map<string, boolean>();
  private failedUrls = new Set<string>();
  private validationQueue: string[] = [];
  private isProcessing = false;

  static getInstance(): FrontendCleanupService {
    if (!FrontendCleanupService.instance) {
      FrontendCleanupService.instance = new FrontendCleanupService();
    }
    return FrontendCleanupService.instance;
  }

  /**
   * Validate if a file URL is accessible
   */
  async validateFileUrl(url: string): Promise<boolean> {
    if (!url) return false;

    // Check cache first
    if (this.fileValidationCache.has(url)) {
      return this.fileValidationCache.get(url)!;
    }

    // Check if URL has failed before
    if (this.failedUrls.has(url)) {
      return false;
    }

    try {
      // For external services, use HEAD request to check accessibility
      const response = await fetch(url, {
        method: 'HEAD',
        mode: 'cors',
        cache: 'no-cache'
      });

      const isValid = response.ok;
      
      // Cache the result
      this.fileValidationCache.set(url, isValid);
      
      if (!isValid) {
        this.failedUrls.add(url);
        console.warn('File URL validation failed:', { url, status: response.status });
      }

      return isValid;
    } catch (error) {
      console.warn('File URL validation error:', { url, error });
      this.fileValidationCache.set(url, false);
      this.failedUrls.add(url);
      return false;
    }
  }

  /**
   * Validate multiple file URLs in batch
   */
  async validateFileUrls(urls: string[]): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    
    // Process URLs in parallel with concurrency limit
    const batchSize = 5;
    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);
      const batchPromises = batch.map(async (url) => {
        const isValid = await this.validateFileUrl(url);
        return { url, isValid };
      });
      
      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(({ url, isValid }) => {
        results.set(url, isValid);
      });
      
      // Small delay between batches to avoid overwhelming servers
      if (i + batchSize < urls.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return results;
  }

  /**
   * Clean up invalid file references from course data
   */
  cleanCourseData(courseData: any): any {
    if (!courseData) return courseData;

    const cleaned = { ...courseData };

    // Clean thumbnail
    if (cleaned.thumbnail && this.failedUrls.has(cleaned.thumbnail)) {
      console.log('Removing invalid thumbnail:', cleaned.thumbnail);
      cleaned.thumbnail = null;
    }

    // Clean sections and lessons
    if (cleaned.sections && Array.isArray(cleaned.sections)) {
      cleaned.sections = cleaned.sections.map((section: any) => {
        if (section.lessons && Array.isArray(section.lessons)) {
          section.lessons = section.lessons.map((lesson: any) => {
            if (lesson.content) {
              // Clean video URL
              if (lesson.content.videoUrl && this.failedUrls.has(lesson.content.videoUrl)) {
                console.log('Removing invalid video URL:', lesson.content.videoUrl);
                lesson.content.videoUrl = null;
              }

              // Clean document URL
              if (lesson.content.documentUrl && this.failedUrls.has(lesson.content.documentUrl)) {
                console.log('Removing invalid document URL:', lesson.content.documentUrl);
                lesson.content.documentUrl = null;
              }
            }
            return lesson;
          });
        }
        return section;
      });
    }

    return cleaned;
  }

  /**
   * Get cleanup statistics from backend
   */
  async getCleanupStats(): Promise<CleanupStats | null> {
    try {
      const response = await fetch('/api/v1/cleanup/stats', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        return data.data;
      }
    } catch (error) {
      console.warn('Failed to get cleanup stats:', error);
    }
    return null;
  }

  /**
   * Perform manual cleanup via backend
   */
  async performCleanup(force = false): Promise<CleanupResult | null> {
    try {
      const response = await fetch(`/api/v1/cleanup/${force ? 'force' : 'perform'}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: force ? '{}' : JSON.stringify({ force })
      });

      if (response.ok) {
        const data = await response.json();
        return data.data;
      }
    } catch (error) {
      console.error('Failed to perform cleanup:', error);
    }
    return null;
  }

  /**
   * Clear validation cache
   */
  clearCache(): void {
    this.fileValidationCache.clear();
    this.failedUrls.clear();
    console.log('Cleanup service cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    cachedUrls: number;
    failedUrls: number;
    queueLength: number;
  } {
    return {
      cachedUrls: this.fileValidationCache.size,
      failedUrls: this.failedUrls.size,
      queueLength: this.validationQueue.length
    };
  }

  /**
   * Add URL to validation queue for background processing
   */
  queueValidation(url: string): void {
    if (!this.validationQueue.includes(url)) {
      this.validationQueue.push(url);
      this.processQueue();
    }
  }

  /**
   * Process validation queue in background
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.validationQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      while (this.validationQueue.length > 0) {
        const url = this.validationQueue.shift()!;
        await this.validateFileUrl(url);
        
        // Small delay to avoid overwhelming servers
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Check if a course has any invalid file references
   */
  hasInvalidFiles(courseData: any): boolean {
    if (!courseData) return false;

    // Check thumbnail
    if (courseData.thumbnail && this.failedUrls.has(courseData.thumbnail)) {
      return true;
    }

    // Check sections and lessons
    if (courseData.sections && Array.isArray(courseData.sections)) {
      for (const section of courseData.sections) {
        if (section.lessons && Array.isArray(section.lessons)) {
          for (const lesson of section.lessons) {
            if (lesson.content) {
              if ((lesson.content.videoUrl && this.failedUrls.has(lesson.content.videoUrl)) ||
                  (lesson.content.documentUrl && this.failedUrls.has(lesson.content.documentUrl))) {
                return true;
              }
            }
          }
        }
      }
    }

    return false;
  }

  /**
   * Get list of invalid file URLs in a course
   */
  getInvalidFiles(courseData: any): string[] {
    const invalidFiles: string[] = [];

    if (!courseData) return invalidFiles;

    // Check thumbnail
    if (courseData.thumbnail && this.failedUrls.has(courseData.thumbnail)) {
      invalidFiles.push(courseData.thumbnail);
    }

    // Check sections and lessons
    if (courseData.sections && Array.isArray(courseData.sections)) {
      for (const section of courseData.sections) {
        if (section.lessons && Array.isArray(section.lessons)) {
          for (const lesson of section.lessons) {
            if (lesson.content) {
              if (lesson.content.videoUrl && this.failedUrls.has(lesson.content.videoUrl)) {
                invalidFiles.push(lesson.content.videoUrl);
              }
              if (lesson.content.documentUrl && this.failedUrls.has(lesson.content.documentUrl)) {
                invalidFiles.push(lesson.content.documentUrl);
              }
            }
          }
        }
      }
    }

    return invalidFiles;
  }
}

export const frontendCleanupService = FrontendCleanupService.getInstance(); 