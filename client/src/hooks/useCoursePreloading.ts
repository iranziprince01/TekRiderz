// React hook for intelligent course and module preloading

import { useState, useCallback } from 'react';
import { offlineStorage } from '../utils/offlineStorage';
import { apiClient } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';

export interface PreloadStatus {
  isPreloading: boolean;
  progress: number; // 0-100
  currentItem: string;
  totalItems: number;
  completedItems: number;
  failedItems: string[];
  estimatedTimeRemaining: number; // in seconds
}

export interface PreloadOptions {
  includeVideos?: boolean;
  includeAssets?: boolean;
  priority?: 'high' | 'normal' | 'low';
  maxConcurrent?: number;
}

export interface UseCoursePreloadingReturn {
  preloadStatus: PreloadStatus;
  preloadCourse: (courseId: string, options?: PreloadOptions) => Promise<void>;
  preloadModule: (courseId: string, moduleId: string, sectionId: string) => Promise<void>;
  cancelPreload: () => void;
  isPreloaded: (courseId: string) => Promise<boolean>;
  getPreloadedCourses: () => Promise<string[]>;
  clearPreloadedCourse: (courseId: string) => Promise<void>;
  getStorageUsage: () => Promise<{
    used: number;
    total: number;
    courses: Record<string, number>;
  }>;
}

export const useCoursePreloading = (): UseCoursePreloadingReturn => {
  const { user } = useAuth();
  const [preloadStatus, setPreloadStatus] = useState<PreloadStatus>({
    isPreloading: false,
    progress: 0,
    currentItem: '',
    totalItems: 0,
    completedItems: 0,
    failedItems: [],
    estimatedTimeRemaining: 0
  });

  const [abortController, setAbortController] = useState<AbortController | null>(null);

  // Preload entire course with all modules and assets
  const preloadCourse = useCallback(async (
    courseId: string, 
    options: PreloadOptions = {}
  ): Promise<void> => {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    // Cancel any existing preload
    if (abortController) {
      abortController.abort();
    }

    const newAbortController = new AbortController();
    setAbortController(newAbortController);

    const {
      includeVideos = true,
      includeAssets = true,
      priority = 'normal',
      maxConcurrent = 3
    } = options;

    try {
      setPreloadStatus({
        isPreloading: true,
        progress: 0,
        currentItem: 'Fetching course details...',
        totalItems: 0,
        completedItems: 0,
        failedItems: [],
        estimatedTimeRemaining: 0
      });

      // 1. Fetch course details
      console.log('Starting course preload:', courseId);
      
      const courseResponse = await apiClient.getCourseDetails(courseId);
      if (!courseResponse.success) {
        throw new Error('Failed to fetch course details');
      }

      const course = courseResponse.data;
      
      // 2. Cache course data
      await offlineStorage.cacheCourse(course, true);
      
      // 3. Calculate total items to preload
      const modules = course.sections?.flatMap((section: any) => 
        section.lessons?.map((lesson: any) => ({
          ...lesson,
          sectionId: section.id,
          sectionTitle: section.title
        })) || []
      ) || [];

      const videos = modules.filter((m: any) => m.type === 'video' && includeVideos);
      const assets = includeAssets ? extractAssetUrls(course) : [];
      const totalItems = modules.length + videos.length + assets.length;

      setPreloadStatus(prev => ({
        ...prev,
        totalItems,
        currentItem: 'Caching course modules...'
      }));

      let completedItems = 0;
      const failedItems: string[] = [];
      const startTime = Date.now();

      // 4. Cache modules in batches
      for (let i = 0; i < modules.length; i += maxConcurrent) {
        if (newAbortController.signal.aborted) {
          throw new Error('Preload cancelled');
        }

        const batch = modules.slice(i, i + maxConcurrent);
        const modulePromises = batch.map(async (module: any) => {
          try {
            setPreloadStatus(prev => ({
              ...prev,
              currentItem: `Caching: ${module.title}`,
              progress: Math.round((completedItems / totalItems) * 100)
            }));

            await offlineStorage.cacheModule(module, courseId, module.sectionId);
            
            // Cache module assets if it's a text lesson with images
            if (module.type === 'text' && module.content) {
              const moduleAssets = extractAssetsFromContent(module.content);
              await preloadAssets(moduleAssets, courseId);
            }

            completedItems++;
            
            setPreloadStatus(prev => ({
              ...prev,
              completedItems,
              progress: Math.round((completedItems / totalItems) * 100),
              estimatedTimeRemaining: calculateETA(startTime, completedItems, totalItems)
            }));

          } catch (error) {
            console.error(`Failed to cache module ${module.id}:`, error);
            failedItems.push(`Module: ${module.title}`);
          }
        });

        await Promise.all(modulePromises);
      }

      // 5. Preload video content (if enabled)
      if (includeVideos && videos.length > 0) {
        setPreloadStatus(prev => ({
          ...prev,
          currentItem: 'Preloading video content...'
        }));

        for (const video of videos) {
          if (newAbortController.signal.aborted) {
            throw new Error('Preload cancelled');
          }

          try {
            await preloadVideoContent(video, courseId);
            completedItems++;
            
            setPreloadStatus(prev => ({
              ...prev,
              completedItems,
              progress: Math.round((completedItems / totalItems) * 100),
              estimatedTimeRemaining: calculateETA(startTime, completedItems, totalItems)
            }));

          } catch (error) {
            console.error(`Failed to preload video ${video.id}:`, error);
            failedItems.push(`Video: ${video.title}`);
          }
        }
      }

      // 6. Preload assets (images, documents)
      if (includeAssets && assets.length > 0) {
        setPreloadStatus(prev => ({
          ...prev,
          currentItem: 'Preloading course assets...'
        }));

        await preloadAssets(assets, courseId);
        completedItems += assets.length;
      }

      // 7. Mark course as fully preloaded
      await offlineStorage.setSetting(`course_preloaded_${courseId}`, {
        preloadedAt: Date.now(),
        userId: user.id,
        includeVideos,
        includeAssets,
        totalItems,
        completedItems,
        failedItems
      });

      setPreloadStatus({
        isPreloading: false,
        progress: 100,
        currentItem: 'Preload completed!',
        totalItems,
        completedItems,
        failedItems,
        estimatedTimeRemaining: 0
      });

      console.log('Course preload completed:', {
        courseId,
        totalItems,
        completedItems,
        failedItems: failedItems.length
      });

    } catch (error) {
      console.error('Course preload failed:', error);
      
      setPreloadStatus(prev => ({
        ...prev,
        isPreloading: false,
        currentItem: error instanceof Error ? error.message : 'Preload failed'
      }));

      throw error;
    } finally {
      setAbortController(null);
    }
  }, [user?.id, abortController]);

  // Preload individual module
  const preloadModule = useCallback(async (
    courseId: string,
    moduleId: string,
    sectionId: string
  ): Promise<void> => {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    try {
      setPreloadStatus({
        isPreloading: true,
        progress: 0,
        currentItem: 'Loading module...',
        totalItems: 1,
        completedItems: 0,
        failedItems: [],
        estimatedTimeRemaining: 0
      });

      // Fetch module details
      const moduleResponse = await apiClient.getModuleDetails(courseId, moduleId);
      if (!moduleResponse.success) {
        throw new Error('Failed to fetch module details');
      }

      const module = moduleResponse.data;
      
      // Cache module
      await offlineStorage.cacheModule(module, courseId, sectionId);

      // Cache module assets
      if (module.type === 'text' && module.content) {
        const assets = extractAssetsFromContent(module.content);
        await preloadAssets(assets, courseId);
      } else if (module.type === 'video' && module.videoUrl) {
        await preloadVideoContent(module, courseId);
      }

      setPreloadStatus({
        isPreloading: false,
        progress: 100,
        currentItem: 'Module preloaded!',
        totalItems: 1,
        completedItems: 1,
        failedItems: [],
        estimatedTimeRemaining: 0
      });

    } catch (error) {
      console.error('Module preload failed:', error);
      
      setPreloadStatus(prev => ({
        ...prev,
        isPreloading: false,
        currentItem: error instanceof Error ? error.message : 'Module preload failed'
      }));

      throw error;
    }
  }, [user?.id]);

  // Cancel ongoing preload
  const cancelPreload = useCallback(() => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
    }

    setPreloadStatus(prev => ({
      ...prev,
      isPreloading: false,
      currentItem: 'Preload cancelled'
    }));
  }, [abortController]);

  // Check if course is preloaded
  const isPreloaded = useCallback(async (courseId: string): Promise<boolean> => {
    try {
      const preloadInfo = await offlineStorage.getSetting(`course_preloaded_${courseId}`);
      return !!preloadInfo;
    } catch (error) {
      return false;
    }
  }, []);

  // Get list of preloaded courses
  const getPreloadedCourses = useCallback(async (): Promise<string[]> => {
    try {
      const keys = await offlineStorage.getKeys({ type: 'user_data' });
      const preloadedKeys = keys.filter(key => key.startsWith('course_preloaded_'));
      return preloadedKeys.map(key => key.replace('course_preloaded_', ''));
    } catch (error) {
      console.error('Failed to get preloaded courses:', error);
      return [];
    }
  }, []);

  // Clear preloaded course
  const clearPreloadedCourse = useCallback(async (courseId: string): Promise<void> => {
    try {
      // Remove course cache
      await offlineStorage.removeCachedCourse(courseId);
      
      // Remove preload settings
      await offlineStorage.removeItem(`course_preloaded_${courseId}`);
      
      console.log('Cleared preloaded course:', courseId);
    } catch (error) {
      console.error('Failed to clear preloaded course:', error);
      throw error;
    }
  }, []);

  // Get storage usage statistics
  const getStorageUsage = useCallback(async (): Promise<{
    used: number;
    total: number;
    courses: Record<string, number>;
  }> => {
    try {
      const stats = await offlineStorage.getStorageStats();
      
      // Get storage quota
      let total = 0;
      if (navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        total = estimate.quota || 0;
      }

      return {
        used: stats.totalSize,
        total,
        courses: {} // Would need to calculate per-course usage
      };
    } catch (error) {
      console.error('Failed to get storage usage:', error);
      return { used: 0, total: 0, courses: {} };
    }
  }, []);

  return {
    preloadStatus,
    preloadCourse,
    preloadModule,
    cancelPreload,
    isPreloaded,
    getPreloadedCourses,
    clearPreloadedCourse,
    getStorageUsage
  };
};

// Helper functions

function extractAssetUrls(course: any): string[] {
  const urls: string[] = [];
  
  // Course thumbnail
  if (course.thumbnail) {
    urls.push(course.thumbnail);
  }

  // Section and lesson assets
  course.sections?.forEach((section: any) => {
    section.lessons?.forEach((lesson: any) => {
      if (lesson.thumbnail) {
        urls.push(lesson.thumbnail);
      }
      
      if (lesson.type === 'text' && lesson.content) {
        urls.push(...extractAssetsFromContent(lesson.content));
      }
    });
  });

  return [...new Set(urls)]; // Remove duplicates
}

function extractAssetsFromContent(content: string): string[] {
  const urls: string[] = [];
  
  // Extract image URLs from HTML content
  const imgRegex = /<img[^>]+src="([^"]+)"/g;
  let match;
  while ((match = imgRegex.exec(content)) !== null) {
    urls.push(match[1]);
  }

  // Extract other asset URLs (videos, audios, etc.)
  const assetRegex = /<(?:video|audio|source)[^>]+(?:src|href)="([^"]+)"/g;
  while ((match = assetRegex.exec(content)) !== null) {
    urls.push(match[1]);
  }

  return urls;
}

async function preloadAssets(urls: string[], courseId: string): Promise<void> {
  const promises = urls.map(async (url) => {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const blob = await response.blob();
        await offlineStorage.cacheAsset(url, blob, courseId, blob.type);
      }
    } catch (error) {
      console.warn(`Failed to preload asset: ${url}`, error);
    }
  });

  await Promise.all(promises);
}

async function preloadVideoContent(video: any, courseId: string): Promise<void> {
  try {
    if (video.videoUrl) {
      // For now, just cache the video metadata
      // Full video preloading would require chunked download strategy
      await offlineStorage.cacheModule({
        ...video,
        preloaded: true,
        preloadedAt: Date.now()
      }, courseId, video.sectionId);
    }
  } catch (error) {
    console.warn(`Failed to preload video: ${video.title}`, error);
  }
}

function calculateETA(startTime: number, completed: number, total: number): number {
  if (completed === 0) return 0;
  
  const elapsed = Date.now() - startTime;
  const rate = completed / elapsed; // items per ms
  const remaining = total - completed;
  
  return Math.round(remaining / rate / 1000); // seconds
} 