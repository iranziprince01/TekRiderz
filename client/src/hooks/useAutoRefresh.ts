import { useState, useEffect, useCallback, useRef } from 'react';

interface UseAutoRefreshOptions {
  interval?: number; // in milliseconds
  enabled?: boolean;
  immediate?: boolean; // whether to run the callback immediately
  onRefresh?: () => void | Promise<void>;
}

interface UseAutoRefreshReturn {
  isRunning: boolean;
  timeUntilNextRefresh: number;
  start: () => void;
  stop: () => void;
  toggle: () => void;
  refresh: () => void;
  setInterval: (newInterval: number) => void;
}

export const useAutoRefresh = ({
  interval = 30000, // 30 seconds default
  enabled = true,
  immediate = false,
  onRefresh
}: UseAutoRefreshOptions): UseAutoRefreshReturn => {
  const [isRunning, setIsRunning] = useState(enabled);
  const [timeUntilNextRefresh, setTimeUntilNextRefresh] = useState(interval);
  const [currentInterval, setCurrentInterval] = useState(interval);
  
  const intervalRef = useRef<number | null>(null);
  const countdownRef = useRef<number | null>(null);
  const callbackRef = useRef(onRefresh);

  // Update callback ref when onRefresh changes
  useEffect(() => {
    callbackRef.current = onRefresh;
  }, [onRefresh]);

  // Countdown timer
  const startCountdown = useCallback(() => {
    setTimeUntilNextRefresh(currentInterval);
    
    countdownRef.current = window.setInterval(() => {
      setTimeUntilNextRefresh((prev) => {
        if (prev <= 1000) {
          return currentInterval;
        }
        return prev - 1000;
      });
    }, 1000);
  }, [currentInterval]);

  const stopCountdown = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  // Main refresh function
  const executeRefresh = useCallback(async () => {
    if (callbackRef.current) {
      try {
        await callbackRef.current();
      } catch (error) {
        console.error('Auto-refresh callback error:', error);
      }
    }
  }, []);

  // Start auto-refresh
  const start = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    setIsRunning(true);
    startCountdown();

    intervalRef.current = window.setInterval(() => {
      executeRefresh();
    }, currentInterval);

    // Execute immediately if requested
    if (immediate && callbackRef.current) {
      executeRefresh();
    }
  }, [currentInterval, immediate, executeRefresh, startCountdown]);

  // Stop auto-refresh
  const stop = useCallback(() => {
    setIsRunning(false);
    stopCountdown();
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    setTimeUntilNextRefresh(currentInterval);
  }, [currentInterval, stopCountdown]);

  // Toggle auto-refresh
  const toggle = useCallback(() => {
    if (isRunning) {
      stop();
    } else {
      start();
    }
  }, [isRunning, start, stop]);

  // Manual refresh
  const refresh = useCallback(() => {
    executeRefresh();
    
    // Reset the timer
    if (isRunning) {
      stop();
      start();
    }
  }, [executeRefresh, isRunning, stop, start]);

  // Set new interval
  const setInterval = useCallback((newInterval: number) => {
    setCurrentInterval(newInterval);
    setTimeUntilNextRefresh(newInterval);
    
    // Restart with new interval if currently running
    if (isRunning) {
      stop();
      setTimeout(() => start(), 100); // Small delay to ensure cleanup
    }
  }, [isRunning, stop, start]);

  // Initial setup
  useEffect(() => {
    if (enabled) {
      start();
    }

    return () => {
      stop();
    };
  }, [enabled]); // Only depend on enabled to avoid infinite loops

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  // Handle page visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page is hidden, stop auto-refresh to save resources
        if (isRunning) {
          stop();
        }
      } else {
        // Page is visible, resume auto-refresh if it was enabled
        if (enabled && !isRunning) {
          start();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, isRunning, start, stop]);

  return {
    isRunning,
    timeUntilNextRefresh,
    start,
    stop,
    toggle,
    refresh,
    setInterval
  };
};

export default useAutoRefresh; 