// Offline Video Player with Progress Tracking
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, RotateCcw, SkipBack, SkipForward } from 'lucide-react';
import { offlineLearning } from '../../utils/offlineLearning';

interface OfflineVideoPlayerProps {
  videoUrl: string;
  courseId: string;
  lessonId: string;
  userId: string;
  title: string;
  onProgress?: (progress: number, timeSpent: number) => void;
  onComplete?: () => void;
  autoPlay?: boolean;
  startPosition?: number; // Resume from specific position
}

export const OfflineVideoPlayer: React.FC<OfflineVideoPlayerProps> = ({
  videoUrl,
  courseId,
  lessonId,
  userId,
  title,
  onProgress,
  onComplete,
  autoPlay = false,
  startPosition = 0
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [cachedVideoUrl, setCachedVideoUrl] = useState<string | null>(null);
  const [sessionStartTime] = useState(Date.now());
  const [totalTimeSpent, setTotalTimeSpent] = useState(0);
  const [lastProgressUpdate, setLastProgressUpdate] = useState(Date.now());

  // Load cached video or original URL
  useEffect(() => {
    const loadVideo = async () => {
      setIsLoading(true);
      
      // Try to get cached video first
      const cached = await offlineLearning.getCachedVideo(videoUrl);
      if (cached) {
        setCachedVideoUrl(cached);
        console.log('Using cached video for offline playback');
      } else {
        // Use original URL (online)
        setCachedVideoUrl(videoUrl);
        console.log('Using online video URL');
      }
      
      setIsLoading(false);
    };

    if (videoUrl) {
      loadVideo();
    }
  }, [videoUrl]);

  // Load saved progress
  useEffect(() => {
    const loadSavedProgress = async () => {
      const savedProgress = await offlineLearning.getLessonProgress(userId, courseId, lessonId);
      if (savedProgress?.videoPosition && videoRef.current) {
        videoRef.current.currentTime = savedProgress.videoPosition;
        setCurrentTime(savedProgress.videoPosition);
      } else if (startPosition && videoRef.current) {
        videoRef.current.currentTime = startPosition;
        setCurrentTime(startPosition);
      }
    };

    if (cachedVideoUrl && videoRef.current) {
      loadSavedProgress();
    }
  }, [cachedVideoUrl, userId, courseId, lessonId, startPosition]);

  // Auto-hide controls
  useEffect(() => {
    let timeout: number;
    
    if (isPlaying) {
      timeout = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    } else {
      setShowControls(true);
    }

    return () => clearTimeout(timeout);
  }, [isPlaying, showControls]);

  // Track time spent
  useEffect(() => {
    let interval: number;
    
    if (isPlaying) {
      interval = setInterval(() => {
        const now = Date.now();
        const timeSpent = Math.floor((now - lastProgressUpdate) / 1000);
        setTotalTimeSpent(prev => prev + timeSpent);
        setLastProgressUpdate(now);
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [isPlaying, lastProgressUpdate]);

  // Save progress periodically
  useEffect(() => {
    let interval: number;
    
    if (isPlaying && duration > 0) {
      interval = setInterval(async () => {
        const progressPercent = (currentTime / duration) * 100;
        const timeSpent = Math.floor((Date.now() - sessionStartTime) / 1000);
        
        await offlineLearning.trackLessonProgress(
          userId,
          courseId,
          lessonId,
          progressPercent,
          timeSpent,
          currentTime
        );

        if (onProgress) {
          onProgress(progressPercent, timeSpent);
        }

        // Mark as complete if watched 90% or more
        if (progressPercent >= 90 && onComplete) {
          onComplete();
        }
      }, 10000); // Save every 10 seconds
    }

    return () => clearInterval(interval);
  }, [isPlaying, currentTime, duration, userId, courseId, lessonId, onProgress, onComplete, sessionStartTime]);

  const togglePlay = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    }
  }, [isPlaying]);

  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  }, [isMuted]);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setIsMuted(newVolume === 0);
    }
  }, []);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (progressRef.current && videoRef.current && duration > 0) {
      const rect = progressRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const newTime = (clickX / rect.width) * duration;
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  }, [duration]);

  const skip = useCallback((seconds: number) => {
    if (videoRef.current) {
      const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  }, [currentTime, duration]);

  const toggleFullscreen = useCallback(() => {
    if (containerRef.current) {
      if (!isFullscreen) {
        if (containerRef.current.requestFullscreen) {
          containerRef.current.requestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        }
      }
    }
  }, [isFullscreen]);

  const formatTime = (time: number): string => {
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Video event handlers
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const time = videoRef.current.currentTime;
      setCurrentTime(time);
      setProgress((time / duration) * 100);
    }
  };

  const handlePlay = () => setIsPlaying(true);
  const handlePause = () => setIsPlaying(false);
  const handleEnded = () => {
    setIsPlaying(false);
    if (onComplete) {
      onComplete();
    }
  };

  const handleFullscreenChange = () => {
    setIsFullscreen(!!document.fullscreenElement);
  };

  useEffect(() => {
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const showControlsTemporarily = () => {
    setShowControls(true);
  };

  if (isLoading) {
    return (
      <div className="w-full aspect-video bg-gray-900 flex items-center justify-center rounded-lg">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
          <p>Loading video...</p>
        </div>
      </div>
    );
  }

  if (!cachedVideoUrl) {
    return (
      <div className="w-full aspect-video bg-gray-900 flex items-center justify-center rounded-lg">
        <div className="text-white text-center">
          <p>Video not available offline</p>
          <p className="text-sm text-gray-400 mt-2">
            This video needs to be cached when online
          </p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={`relative w-full aspect-video bg-black rounded-lg overflow-hidden group ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}
      onMouseMove={showControlsTemporarily}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      <video
        ref={videoRef}
        src={cachedVideoUrl}
        className="w-full h-full"
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={handleEnded}
        autoPlay={autoPlay}
        preload="metadata"
      />

      {/* Video Title Overlay */}
      <div className={`absolute top-0 left-0 right-0 bg-gradient-to-b from-black/60 to-transparent p-4 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        <h3 className="text-white font-medium truncate">{title}</h3>
        {navigator.onLine === false && (
          <div className="flex items-center text-green-400 text-sm mt-1">
            <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
            Playing offline
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div 
        ref={progressRef}
        className={`absolute bottom-16 left-4 right-4 h-2 bg-white/30 rounded-full cursor-pointer transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleSeek}
      >
        <div 
          className="h-full bg-blue-500 rounded-full transition-all duration-200"
          style={{ width: `${progress}%` }}
        />
        <div 
          className="absolute top-1/2 w-3 h-3 bg-blue-500 rounded-full transform -translate-y-1/2 transition-all duration-200"
          style={{ left: `${progress}%`, marginLeft: '-6px' }}
        />
      </div>

      {/* Controls */}
      <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        <div className="flex items-center gap-4">
          {/* Play/Pause */}
          <button
            onClick={togglePlay}
            className="text-white hover:text-blue-400 transition-colors"
          >
            {isPlaying ? <Pause size={24} /> : <Play size={24} />}
          </button>

          {/* Skip buttons */}
          <button
            onClick={() => skip(-10)}
            className="text-white hover:text-blue-400 transition-colors"
          >
            <SkipBack size={20} />
          </button>
          
          <button
            onClick={() => skip(10)}
            className="text-white hover:text-blue-400 transition-colors"
          >
            <SkipForward size={20} />
          </button>

          {/* Time display */}
          <div className="text-white text-sm">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>

          <div className="flex-1" />

          {/* Volume controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMute}
              className="text-white hover:text-blue-400 transition-colors"
            >
              {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={volume}
              onChange={handleVolumeChange}
              className="w-20 h-1 bg-white/30 rounded-lg appearance-none slider"
            />
          </div>

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            className="text-white hover:text-blue-400 transition-colors"
          >
            <Maximize size={20} />
          </button>
        </div>
      </div>

      {/* Loading/Buffering indicator */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      )}

      {/* Click to play overlay */}
      {!isPlaying && !showControls && (
        <div 
          className="absolute inset-0 flex items-center justify-center cursor-pointer"
          onClick={togglePlay}
        >
          <div className="bg-black/50 rounded-full p-4">
            <Play size={48} className="text-white" />
          </div>
        </div>
      )}
    </div>
  );
};

export default OfflineVideoPlayer; 