import React from 'react';
import { useImageLoader } from '../../hooks/useImageLoader';
import { LoadingSpinner } from './LoadingSpinner';
import { Button } from './Button';
import { RefreshCcw, ImageIcon } from 'lucide-react';

interface ImageLoaderProps {
  src?: string | null;
  alt: string;
  className?: string;
  fileType?: 'thumbnail' | 'video' | 'avatar' | 'document' | 'material';
  showRetry?: boolean;
  showError?: boolean;
  fallbackIcon?: React.ReactNode;
  onLoad?: () => void;
  onError?: (error: Error) => void;
  aspectRatio?: 'square' | 'video' | 'auto';
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const ImageLoader: React.FC<ImageLoaderProps> = ({
  src,
  alt,
  className = '',
  fileType = 'thumbnail',
  showRetry = true,
  showError = true,
  fallbackIcon,
  onLoad,
  onError,
  aspectRatio = 'auto',
  size = 'md'
}) => {
  const { 
    src: imageSrc, 
    isLoading, 
    hasError, 
    retryCount, 
    retry, 
    refresh 
  } = useImageLoader(src, fileType, {
    maxRetries: 3,
    retryDelay: 1000,
    onLoad,
    onError
  });

  const aspectRatioClass = {
    square: 'aspect-square',
    video: 'aspect-video',
    auto: ''
  }[aspectRatio];

  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-32 h-32',
    lg: 'w-48 h-48',
    xl: 'w-64 h-64'
  };

  const spinnerSize = {
    sm: 'sm' as const,
    md: 'md' as const,
    lg: 'lg' as const,
    xl: 'lg' as const
  };

  const baseClasses = `relative overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800 ${aspectRatioClass} ${className}`;

  if (isLoading) {
    return (
      <div className={baseClasses}>
        <div className="absolute inset-0 flex items-center justify-center">
          <LoadingSpinner size={spinnerSize[size]} />
        </div>
      </div>
    );
  }

  if (hasError && showError) {
    return (
      <div className={baseClasses}>
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
          <div className="text-gray-400 mb-2">
            {fallbackIcon || <ImageIcon className="w-8 h-8" />}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            Image failed to load
          </p>
          {showRetry && retryCount < 3 && (
            <div className="space-y-2">
              <Button
                size="sm"
                variant="outline"
                onClick={retry}
                className="text-xs"
              >
                <RefreshCcw className="w-3 h-3 mr-1" />
                Retry ({retryCount}/3)
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={refresh}
                className="text-xs"
              >
                Refresh
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={baseClasses}>
      <img
        src={imageSrc}
        alt={alt}
        className="w-full h-full object-cover"
        loading="lazy"
        decoding="async"
      />
    </div>
  );
};

// Simple version without retry controls
export const SimpleImageLoader: React.FC<Omit<ImageLoaderProps, 'showRetry' | 'showError'>> = (props) => {
  return <ImageLoader {...props} showRetry={false} showError={false} />;
};

export default ImageLoader; 