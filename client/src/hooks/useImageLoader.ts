import { useState, useEffect, useCallback, useRef } from 'react';
import { getFileUrl, getValidatedFileUrl, markFileUrlAsFailed } from '../utils/api';

interface UseImageLoaderOptions {
  maxRetries?: number;
  retryDelay?: number;
  enablePrevalidation?: boolean;
  fallbackUrl?: string;
  onError?: (error: Error) => void;
  onLoad?: () => void;
}

interface ImageLoaderState {
  src: string;
  isLoading: boolean;
  hasError: boolean;
  retryCount: number;
  isValidated: boolean;
}

export const useImageLoader = (
  filePath?: string | null,
  fileType: 'thumbnail' | 'video' | 'avatar' | 'document' | 'material' = 'thumbnail',
  options: UseImageLoaderOptions = {}
) => {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    enablePrevalidation = false,
    fallbackUrl,
    onError,
    onLoad
  } = options;

  const [state, setState] = useState<ImageLoaderState>({
    src: getFileUrl(filePath || undefined, fileType),
    isLoading: true,
    hasError: false,
    retryCount: 0,
    isValidated: false
  });

  const retryTimeoutRef = useRef<number>();
  const imageRef = useRef<HTMLImageElement>();

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  // Reset state when filePath changes
  useEffect(() => {
    setState({
      src: getFileUrl(filePath || undefined, fileType),
      isLoading: true,
      hasError: false,
      retryCount: 0,
      isValidated: false
    });
  }, [filePath, fileType]);

  // Pre-validate URL if enabled
  useEffect(() => {
    if (enablePrevalidation && filePath && !state.isValidated) {
      getValidatedFileUrl(filePath, fileType).then(validatedUrl => {
        setState(prev => ({
          ...prev,
          src: validatedUrl,
          isValidated: true
        }));
      });
    }
  }, [filePath, fileType, enablePrevalidation, state.isValidated]);

  // Load image with retry logic
  const loadImage = useCallback((url: string) => {
    if (!url || url.includes('placeholder')) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        hasError: false
      }));
      return;
    }

    // Create new image element for loading
    const img = new Image();
    imageRef.current = img;

    img.onload = () => {
      setState(prev => ({
        ...prev,
        isLoading: false,
        hasError: false
      }));
      onLoad?.();
    };

    img.onerror = () => {
      markFileUrlAsFailed(url);
      
      setState(prev => {
        const newRetryCount = prev.retryCount + 1;
        
        if (newRetryCount < maxRetries) {
          // Retry after delay
          retryTimeoutRef.current = window.setTimeout(() => {
            loadImage(url);
          }, retryDelay * newRetryCount);
          
          return {
            ...prev,
            retryCount: newRetryCount,
            isLoading: true
          };
        } else {
          // Max retries reached, use fallback
          const fallback = fallbackUrl || getFileUrl(undefined, fileType);
          const error = new Error(`Failed to load image after ${maxRetries} retries: ${url}`);
          onError?.(error);
          
          return {
            ...prev,
            src: fallback,
            isLoading: false,
            hasError: true,
            retryCount: newRetryCount
          };
        }
      });
    };

    img.src = url;
  }, [maxRetries, retryDelay, fallbackUrl, fileType, onError, onLoad]);

  // Load image when src changes
  useEffect(() => {
    if (state.src) {
      loadImage(state.src);
    }
  }, [state.src, loadImage]);

  // Manual retry function
  const retry = useCallback(() => {
    setState(prev => ({
      ...prev,
      isLoading: true,
      hasError: false,
      retryCount: 0
    }));
  }, []);

  // Refresh function to get new URL and retry
  const refresh = useCallback(() => {
    const newSrc = getFileUrl(filePath || undefined, fileType);
    setState({
      src: newSrc,
      isLoading: true,
      hasError: false,
      retryCount: 0,
      isValidated: false
    });
  }, [filePath, fileType]);

  return {
    src: state.src,
    isLoading: state.isLoading,
    hasError: state.hasError,
    retryCount: state.retryCount,
    retry,
    refresh
  };
};

// Simplified hook for basic image loading without retry logic
export const useSimpleImageLoader = (
  filePath?: string | null,
  fileType: 'thumbnail' | 'video' | 'avatar' | 'document' | 'material' = 'thumbnail'
) => {
  const [src, setSrc] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('useSimpleImageLoader effect triggered:', { filePath, fileType });
    }
    const newSrc = getFileUrl(filePath || undefined, fileType);
    if (import.meta.env.DEV) {
      console.log('Generated src URL:', newSrc);
    }
    setSrc(newSrc);
    setIsLoading(true);
    setHasError(false);
  }, [filePath, fileType]);

  const handleLoad = useCallback(() => {
    if (import.meta.env.DEV) {
      console.log('Image loaded successfully:', src);
    }
    setIsLoading(false);
    setHasError(false);
  }, [src]);

  const handleError = useCallback((event?: any) => {
    if (import.meta.env.DEV) {
      console.warn('Image failed to load:', { src, event });
    }
    markFileUrlAsFailed(src);
    const fallbackSrc = getFileUrl(undefined, fileType);
    if (import.meta.env.DEV) {
      console.log('Using fallback src:', fallbackSrc);
    }
    setSrc(fallbackSrc);
    setIsLoading(false);
    setHasError(true);
  }, [src, fileType]);

  return {
    src,
    isLoading,
    hasError,
    onLoad: handleLoad,
    onError: handleError
  };
}; 