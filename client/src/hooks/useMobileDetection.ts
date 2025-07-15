import { useState, useEffect } from 'react';

export interface MobileDetectionState {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  orientation: 'portrait' | 'landscape';
  screenSize: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  touchEnabled: boolean;
  viewport: {
    width: number;
    height: number;
  };
}

export const useMobileDetection = (): MobileDetectionState => {
  const [state, setState] = useState<MobileDetectionState>({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    orientation: 'landscape',
    screenSize: 'lg',
    touchEnabled: false,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight
    }
  });

  useEffect(() => {
    const updateState = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      // Determine screen size based on Tailwind breakpoints
      let screenSize: MobileDetectionState['screenSize'] = 'xs';
      if (width >= 1536) screenSize = '2xl';
      else if (width >= 1280) screenSize = 'xl';
      else if (width >= 1024) screenSize = 'lg';
      else if (width >= 768) screenSize = 'md';
      else if (width >= 640) screenSize = 'sm';

      // Device type detection
      const isMobile = width < 768;
      const isTablet = width >= 768 && width < 1024;
      const isDesktop = width >= 1024;

      // Orientation detection
      const orientation = width > height ? 'landscape' : 'portrait';

      // Touch detection
      const touchEnabled = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

      setState({
        isMobile,
        isTablet,
        isDesktop,
        orientation,
        screenSize,
        touchEnabled,
        viewport: { width, height }
      });
    };

    // Initial detection
    updateState();

    // Listen for resize events
    window.addEventListener('resize', updateState);
    window.addEventListener('orientationchange', updateState);

    return () => {
      window.removeEventListener('resize', updateState);
      window.removeEventListener('orientationchange', updateState);
    };
  }, []);

  return state;
};

// Hook for responsive breakpoints
export const useBreakpoint = () => {
  const { screenSize } = useMobileDetection();
  
  return {
    isXs: screenSize === 'xs',
    isSm: screenSize === 'sm',
    isMd: screenSize === 'md',
    isLg: screenSize === 'lg',
    isXl: screenSize === 'xl',
    is2Xl: screenSize === '2xl',
    isSmUp: ['sm', 'md', 'lg', 'xl', '2xl'].includes(screenSize),
    isMdUp: ['md', 'lg', 'xl', '2xl'].includes(screenSize),
    isLgUp: ['lg', 'xl', '2xl'].includes(screenSize),
    isXlUp: ['xl', '2xl'].includes(screenSize),
    current: screenSize
  };
};

// Hook for touch interactions
export const useTouchSupport = () => {
  const { touchEnabled } = useMobileDetection();
  
  return {
    touchEnabled,
    isTouch: touchEnabled,
    isMouse: !touchEnabled
  };
};

// Hook for keyboard detection on mobile
export const useKeyboardDetection = () => {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [initialHeight, setInitialHeight] = useState(window.innerHeight);

  useEffect(() => {
    const handleResize = () => {
      const currentHeight = window.innerHeight;
      const heightDiff = initialHeight - currentHeight;
      
      // Keyboard is likely open if height decreased by more than 150px
      setIsKeyboardOpen(heightDiff > 150);
    };

    const handleFocus = () => {
      setTimeout(() => {
        setInitialHeight(window.innerHeight);
        handleResize();
      }, 300);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('focusin', handleFocus);
    window.addEventListener('focusout', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('focusin', handleFocus);
      window.removeEventListener('focusout', handleResize);
    };
  }, [initialHeight]);

  return { isKeyboardOpen, initialHeight };
};

// Hook for safe area insets (for devices with notches)
export const useSafeArea = () => {
  const [safeArea, setSafeArea] = useState({
    top: 0,
    right: 0,
    bottom: 0,
    left: 0
  });

  useEffect(() => {
    const updateSafeArea = () => {
      const root = document.documentElement;
      const computedStyle = getComputedStyle(root);
      
      setSafeArea({
        top: parseInt(computedStyle.getPropertyValue('--safe-area-inset-top') || '0'),
        right: parseInt(computedStyle.getPropertyValue('--safe-area-inset-right') || '0'),
        bottom: parseInt(computedStyle.getPropertyValue('--safe-area-inset-bottom') || '0'),
        left: parseInt(computedStyle.getPropertyValue('--safe-area-inset-left') || '0')
      });
    };

    updateSafeArea();
    window.addEventListener('resize', updateSafeArea);
    window.addEventListener('orientationchange', updateSafeArea);

    return () => {
      window.removeEventListener('resize', updateSafeArea);
      window.removeEventListener('orientationchange', updateSafeArea);
    };
  }, []);

  return safeArea;
};

// Hook for network status
export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [connectionType, setConnectionType] = useState<string | null>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check connection type if available
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      setConnectionType(connection.effectiveType);
      
      const handleConnectionChange = () => {
        setConnectionType(connection.effectiveType);
      };
      
      connection.addEventListener('change', handleConnectionChange);
      
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        connection.removeEventListener('change', handleConnectionChange);
      };
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline, connectionType };
};

// Hook for device orientation
export const useDeviceOrientation = () => {
  const [orientation, setOrientation] = useState<{
    alpha: number | null;
    beta: number | null;
    gamma: number | null;
  }>({
    alpha: null,
    beta: null,
    gamma: null
  });

  useEffect(() => {
    const handleOrientationChange = (event: DeviceOrientationEvent) => {
      setOrientation({
        alpha: event.alpha,
        beta: event.beta,
        gamma: event.gamma
      });
    };

    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', handleOrientationChange);
    }

    return () => {
      if (window.DeviceOrientationEvent) {
        window.removeEventListener('deviceorientation', handleOrientationChange);
      }
    };
  }, []);

  return orientation;
};

// Hook for haptic feedback
export const useHapticFeedback = () => {
  const vibrate = (pattern: number | number[]) => {
    if (navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  };

  const lightTap = () => vibrate(10);
  const mediumTap = () => vibrate(50);
  const heavyTap = () => vibrate(100);
  const doubleTap = () => vibrate([50, 50, 50]);
  const longPress = () => vibrate([100, 50, 100]);

  return {
    vibrate,
    lightTap,
    mediumTap,
    heavyTap,
    doubleTap,
    longPress,
    isSupported: !!navigator.vibrate
  };
};

// Hook for scroll position
export const useScrollPosition = () => {
  const [scrollPosition, setScrollPosition] = useState({
    x: 0,
    y: 0
  });

  useEffect(() => {
    const handleScroll = () => {
      setScrollPosition({
        x: window.pageXOffset,
        y: window.pageYOffset
      });
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return scrollPosition;
};

// Hook for pull-to-refresh
export const usePullToRefresh = (onRefresh: () => Promise<void>) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);

  useEffect(() => {
    let startY = 0;
    let currentY = 0;
    let isDragging = false;

    const handleTouchStart = (e: TouchEvent) => {
      if (window.pageYOffset === 0) {
        startY = e.touches[0].clientY;
        isDragging = true;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging) return;

      currentY = e.touches[0].clientY;
      const diff = currentY - startY;

      if (diff > 0 && window.pageYOffset === 0) {
        e.preventDefault();
        setPullDistance(Math.min(diff, 100));
      }
    };

    const handleTouchEnd = async () => {
      if (!isDragging) return;

      isDragging = false;
      
      if (pullDistance > 50) {
        setIsRefreshing(true);
        try {
          await onRefresh();
        } finally {
          setIsRefreshing(false);
        }
      }
      
      setPullDistance(0);
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onRefresh, pullDistance]);

  return { isRefreshing, pullDistance };
}; 