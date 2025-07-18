import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Youtube, Check, AlertCircle, Play, ExternalLink, Lightbulb } from 'lucide-react';
import { Button } from '../ui/Button';

interface YouTubeVideoInputProps {
  onVideoAdded: (videoData: {
    videoId: string;
    videoUrl: string;
    title?: string;
    thumbnail?: string;
    duration?: string;
  }) => void;
  currentVideoUrl?: string;
  label?: string;
  placeholder?: string;
  className?: string;
}

// YouTube URL patterns
const YOUTUBE_REGEX = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;

export const YouTubeVideoInput: React.FC<YouTubeVideoInputProps> = ({
  onVideoAdded,
  currentVideoUrl,
  label = "Video URL",
  placeholder = "https://www.youtube.com/watch?v=...",
  className = ''
}) => {
  const [videoUrl, setVideoUrl] = useState(currentVideoUrl || '');
  const [videoId, setVideoId] = useState('');
  const [isValid, setIsValid] = useState(false);
  const [error, setError] = useState('');
  const [videoInfo, setVideoInfo] = useState<{
    title?: string;
    thumbnail?: string;
    duration?: string;
  }>({});
  
  const debounceTimeoutRef = useRef<NodeJS.Timeout>();
  const currentVideoIdRef = useRef<string>('');

  const extractVideoId = (url: string): string => {
    const match = url.match(YOUTUBE_REGEX);
    return match ? match[1] : '';
  };

  const validateYouTubeUrl = (url: string): boolean => {
    return YOUTUBE_REGEX.test(url);
  };

  const fetchVideoInfo = useCallback(async (videoId: string) => {
    // Prevent duplicate calls for the same video
    if (currentVideoIdRef.current === videoId) {
      return;
    }
    currentVideoIdRef.current = videoId;
    
    setError(''); // Clear any previous errors
    
    // Immediately set basic video info without loading state
    setVideoInfo({
      title: `YouTube Video (${videoId})`,
      thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      duration: 'Unknown'
    });
    
    // Silently try to fetch better title in background - no loading state
    try {
      const response = await fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
        { signal: AbortSignal.timeout(3000) } // 3 second timeout
      );
      
      if (response.ok && currentVideoIdRef.current === videoId) {
        const data = await response.json();
        setVideoInfo({
          title: data.title || `YouTube Video (${videoId})`,
          thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
          duration: 'Unknown'
        });
      }
    } catch (fetchError) {
      // Completely silent - no console logs, no user-visible errors
      // Basic video info is already set
    }
  }, []);

  useEffect(() => {
    // Clear any existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    // Debounce the validation to prevent rapid fire updates
    debounceTimeoutRef.current = setTimeout(() => {
      if (videoUrl.trim()) {
        const id = extractVideoId(videoUrl.trim());
        const valid = validateYouTubeUrl(videoUrl.trim());
        
        setVideoId(id);
        setIsValid(valid);
        setError('');

        if (valid && id) {
          fetchVideoInfo(id);
          onVideoAdded({
            videoId: id,
            videoUrl: videoUrl.trim(),
          });
        } else if (videoUrl.length > 10) {
          setError('Please enter a valid YouTube URL');
          setVideoInfo({});
          currentVideoIdRef.current = '';
        }
      } else {
        setVideoId('');
        setIsValid(false);
        setError('');
        setVideoInfo({});
        currentVideoIdRef.current = '';
      }
    }, 500); // 500ms debounce
    
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [videoUrl, onVideoAdded, fetchVideoInfo]);

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value.trim();
    setVideoUrl(url);
  };

  const clearVideo = () => {
    setVideoUrl('');
    setVideoId('');
    setIsValid(false);
    setError('');
    setVideoInfo({});
  };

  const openYouTube = () => {
    if (videoUrl) {
      window.open(videoUrl, '_blank');
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <label className="block text-sm font-medium text-gray-700">
        {label}
      </label>

      {/* URL Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Youtube className="h-5 w-5 text-red-500" />
        </div>
        <input
          type="url"
          value={videoUrl}
          onChange={handleUrlChange}
          placeholder={placeholder}
          className={`block w-full pl-10 pr-10 py-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            isValid ? 'border-green-300' : error ? 'border-red-300' : 'border-gray-300'
          }`}
        />
        {isValid && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            <Check className="h-5 w-5 text-green-500" />
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center text-red-600 text-sm">
          <AlertCircle className="h-4 w-4 mr-2" />
          {error}
        </div>
      )}

      {/* Removed loading state to prevent dancing effect */}

      {/* Video Preview */}
      {isValid && videoId && (
        <div className="bg-gray-50 border rounded-lg p-4">
          <div className="flex space-x-4">
            {/* Thumbnail */}
            <div className="flex-shrink-0">
              <div className="relative w-48 h-28 bg-gray-200 rounded-lg overflow-hidden shadow-md">
                {videoInfo.thumbnail ? (
                  <img
                    src={videoInfo.thumbnail}
                    alt="Video thumbnail"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Fallback to default thumbnail
                      e.currentTarget.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Youtube className="h-8 w-8 text-gray-400" />
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 opacity-0 hover:opacity-100 transition-opacity">
                  <Play className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>

            {/* Video Info */}
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium text-gray-900 truncate">
                {videoInfo.title || 'YouTube Video'}
              </h4>
              <p className="text-sm text-gray-500 mt-1">
                Video ID: {videoId}
              </p>
              {videoInfo.duration && (
                <p className="text-sm text-gray-500">
                  Duration: {videoInfo.duration}
                </p>
              )}
              
              {/* Action Buttons */}
              <div className="flex space-x-2 mt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={openYouTube}
                  className="text-xs"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  View on YouTube
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={clearVideo}
                  className="text-xs text-red-600 hover:text-red-700"
                >
                  Remove
                </Button>
              </div>
            </div>
          </div>

          {/* Video Embed Preview */}
          <div className="mt-4">
            <div className="w-full bg-gray-900 rounded-xl overflow-hidden shadow-lg relative" style={{ aspectRatio: '16/9', minHeight: '300px' }}>
              {/* Loading overlay for iframe */}
              <div className="absolute inset-0 bg-gray-900 flex items-center justify-center z-10" id={`loading-${videoId}`}>
                <div className="text-white text-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mx-auto mb-2"></div>
                  <span className="text-sm">Loading video...</span>
                </div>
              </div>
              
              <iframe
                src={`https://www.youtube.com/embed/${videoId}?controls=1&modestbranding=1&rel=0`}
                title={videoInfo.title || 'YouTube video'}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="w-full h-full relative z-20 border-0"
                style={{ minHeight: '300px' }}
                onLoad={() => {
                  // Hide loading overlay when iframe loads
                  const loadingDiv = document.getElementById(`loading-${videoId}`);
                  if (loadingDiv) {
                    loadingDiv.style.display = 'none';
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="text-sm text-gray-500">
        <p className="font-medium">Supported formats:</p>
        <ul className="list-disc list-inside mt-1 space-y-1">
          <li>https://www.youtube.com/watch?v=VIDEO_ID</li>
          <li>https://youtu.be/VIDEO_ID</li>
          <li>https://www.youtube.com/embed/VIDEO_ID</li>
        </ul>
        <div className="mt-2 flex items-center gap-2">
          <Lightbulb className="h-3 w-3 text-blue-600" />
          <p className="text-xs">
            Tip: Make sure your video is set to "Unlisted" for course content
          </p>
        </div>
      </div>
    </div>
  );
};

export default YouTubeVideoInput; 