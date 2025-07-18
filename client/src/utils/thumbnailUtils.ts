// Utility functions for handling course thumbnails with Cloudinary and local fallback

/**
 * Get optimized thumbnail URL for course images
 * Supports both Cloudinary URLs and local base64 images
 */
export const getOptimizedThumbnailUrl = (thumbnailUrl: string | undefined, size: 'small' | 'medium' | 'large' = 'medium'): string => {
  if (!thumbnailUrl) {
    return getPlaceholderThumbnail(size);
  }

  // Handle local storage thumbnails (base64 data URLs)
  if (thumbnailUrl.startsWith('data:image/')) {
    return thumbnailUrl;
  }

  // Handle Cloudinary URLs with optimization
  if (thumbnailUrl.includes('cloudinary.com')) {
    return optimizeCloudinaryUrl(thumbnailUrl, size);
  }

  // Handle external URLs (return as-is)
  if (thumbnailUrl.startsWith('http')) {
    return thumbnailUrl;
  }

  // Handle relative URLs (legacy file system)
  if (thumbnailUrl.startsWith('/uploads/')) {
    const baseUrl = process.env.VITE_API_URL || 'http://localhost:3000';
    return `${baseUrl}${thumbnailUrl}`;
  }

  // Fallback to placeholder
  return getPlaceholderThumbnail(size);
};

/**
 * Optimize Cloudinary URLs with size-specific parameters
 */
const optimizeCloudinaryUrl = (url: string, size: 'small' | 'medium' | 'large'): string => {
  const sizeParams = {
    small: 'w_300,h_200,c_fill',
    medium: 'w_600,h_400,c_fill',
    large: 'w_1200,h_800,c_fill'
  };

  const params = sizeParams[size];
  const optimizationParams = 'q_auto,f_auto,dpr_auto';

  // Check if URL already has transformations
  if (url.includes('/upload/')) {
    // Insert optimization parameters
    return url.replace('/upload/', `/upload/${params},${optimizationParams}/`);
  }

  return url;
};

/**
 * Generate placeholder thumbnail based on size
 */
const getPlaceholderThumbnail = (size: 'small' | 'medium' | 'large'): string => {
  const dimensions = {
    small: '300x200',
    medium: '600x400',
    large: '1200x800'
  };

  const dimension = dimensions[size];
  return `https://via.placeholder.com/${dimension}/e2e8f0/6b7280?text=Course+Thumbnail`;
};

/**
 * Validate if a thumbnail URL is accessible
 */
export const validateThumbnailUrl = (url: string): Promise<boolean> => {
  return new Promise((resolve) => {
    if (!url || url.startsWith('data:image/')) {
      resolve(true);
      return;
    }

    const img = new Image();
    const timeout = setTimeout(() => {
      resolve(false);
    }, 5000); // 5 second timeout

    img.onload = () => {
      clearTimeout(timeout);
      resolve(true);
    };

    img.onerror = () => {
      clearTimeout(timeout);
      resolve(false);
    };

    img.src = url;
  });
};

/**
 * Get thumbnail from local storage if available
 */
export const getLocalThumbnail = (imageId: string): string | null => {
  try {
    return localStorage.getItem(`thumbnail_${imageId}`);
  } catch (error) {
    console.warn('Failed to retrieve local thumbnail:', error);
    return null;
  }
};

/**
 * Store thumbnail in local storage
 */
export const storeLocalThumbnail = (imageId: string, dataUrl: string): boolean => {
  try {
    localStorage.setItem(`thumbnail_${imageId}`, dataUrl);
    return true;
  } catch (error) {
    console.warn('Failed to store local thumbnail:', error);
    return false;
  }
};

/**
 * Clean up old local thumbnails to free storage space
 */
export const cleanupOldThumbnails = (): void => {
  try {
    const keys = Object.keys(localStorage);
    const thumbnailKeys = keys.filter(key => key.startsWith('thumbnail_'));
    
    // Remove thumbnails older than 30 days
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    
    thumbnailKeys.forEach(key => {
      const parts = key.split('_');
      if (parts.length >= 2) {
        const timestamp = parseInt(parts[1]);
        if (timestamp && timestamp < thirtyDaysAgo) {
          localStorage.removeItem(key);
          console.log('Cleaned up old thumbnail:', key);
        }
      }
    });
  } catch (error) {
    console.warn('Failed to cleanup old thumbnails:', error);
  }
};