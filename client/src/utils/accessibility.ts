import { useEffect, useRef, useState, useCallback } from 'react';

// WCAG Guidelines and utilities
export const WCAG_GUIDELINES = {
  AA: {
    colorContrast: 4.5,
    largeTextContrast: 3,
    fontSize: 14,
    touchTargetSize: 44 // pixels
  },
  AAA: {
    colorContrast: 7,
    largeTextContrast: 4.5,
    fontSize: 16,
    touchTargetSize: 44
  }
};

// Color contrast calculation
export const calculateContrastRatio = (color1: string, color2: string): number => {
  const getLuminance = (hex: string): number => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    
    const [rs, gs, bs] = [r, g, b].map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  };
  
  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);
  
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  
  return (brightest + 0.05) / (darkest + 0.05);
};

// Check if color combination meets WCAG standards
export const meetsWCAGContrast = (
  foreground: string, 
  background: string, 
  level: 'AA' | 'AAA' = 'AA',
  isLargeText: boolean = false
): boolean => {
  const ratio = calculateContrastRatio(foreground, background);
  const requiredRatio = isLargeText 
    ? WCAG_GUIDELINES[level].largeTextContrast 
    : WCAG_GUIDELINES[level].colorContrast;
  
  return ratio >= requiredRatio;
};

// Screen reader utilities
export class ScreenReaderUtils {
  private static announceElement: HTMLElement | null = null;

  static initialize() {
    if (!this.announceElement) {
      this.announceElement = document.createElement('div');
      this.announceElement.setAttribute('aria-live', 'polite');
      this.announceElement.setAttribute('aria-atomic', 'true');
      this.announceElement.setAttribute('aria-relevant', 'additions text');
      this.announceElement.style.position = 'absolute';
      this.announceElement.style.left = '-10000px';
      this.announceElement.style.width = '1px';
      this.announceElement.style.height = '1px';
      this.announceElement.style.overflow = 'hidden';
      document.body.appendChild(this.announceElement);
    }
  }

  static announce(message: string, priority: 'polite' | 'assertive' = 'polite') {
    if (!this.announceElement) {
      this.initialize();
    }
    
    if (this.announceElement) {
      this.announceElement.setAttribute('aria-live', priority);
      this.announceElement.textContent = message;
      
      // Clear after a short delay to allow for re-announcing the same message
      setTimeout(() => {
        if (this.announceElement) {
          this.announceElement.textContent = '';
        }
      }, 1000);
    }
  }

  static cleanup() {
    if (this.announceElement) {
      document.body.removeChild(this.announceElement);
      this.announceElement = null;
    }
  }
}

// Keyboard navigation utilities
export class KeyboardNavigation {
  private static trapElements: HTMLElement[] = [];

  static trapFocus(element: HTMLElement) {
    const focusableElements = this.getFocusableElements(element);
    
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    element.addEventListener('keydown', handleTabKey);
    firstElement.focus();

    // Store cleanup function
    const cleanup = () => {
      element.removeEventListener('keydown', handleTabKey);
    };

    this.trapElements.push(element);
    return cleanup;
  }

  static getFocusableElements(element: HTMLElement): HTMLElement[] {
    const focusableSelectors = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]'
    ];

    return Array.from(element.querySelectorAll(focusableSelectors.join(', ')))
      .filter(el => {
        const element = el as HTMLElement;
        return element.offsetWidth > 0 && element.offsetHeight > 0 && 
               !element.hidden && getComputedStyle(element).display !== 'none';
      }) as HTMLElement[];
  }

  static handleArrowNavigation(
    elements: HTMLElement[],
    currentIndex: number,
    direction: 'up' | 'down' | 'left' | 'right'
  ): number {
    let newIndex = currentIndex;
    
    switch (direction) {
      case 'up':
      case 'left':
        newIndex = currentIndex > 0 ? currentIndex - 1 : elements.length - 1;
        break;
      case 'down':
      case 'right':
        newIndex = currentIndex < elements.length - 1 ? currentIndex + 1 : 0;
        break;
    }
    
    elements[newIndex]?.focus();
    return newIndex;
  }
}

// Accessibility hooks
export const useScreenReader = () => {
  useEffect(() => {
    ScreenReaderUtils.initialize();
    return () => ScreenReaderUtils.cleanup();
  }, []);

  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    ScreenReaderUtils.announce(message, priority);
  }, []);

  return { announce };
};

export const useFocusTrap = (active: boolean) => {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (active && ref.current) {
      const cleanup = KeyboardNavigation.trapFocus(ref.current);
      return cleanup;
    }
  }, [active]);

  return ref;
};

export const useKeyboardNavigation = (
  items: HTMLElement[],
  options: {
    loop?: boolean;
    orientation?: 'horizontal' | 'vertical';
    onSelectionChange?: (index: number) => void;
  } = {}
) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const { loop = true, orientation = 'vertical', onSelectionChange } = options;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const isVertical = orientation === 'vertical';
    const upKey = isVertical ? 'ArrowUp' : 'ArrowLeft';
    const downKey = isVertical ? 'ArrowDown' : 'ArrowRight';

    let newIndex = currentIndex;

    switch (e.key) {
      case upKey:
        e.preventDefault();
        newIndex = currentIndex > 0 ? currentIndex - 1 : (loop ? items.length - 1 : 0);
        break;
      case downKey:
        e.preventDefault();
        newIndex = currentIndex < items.length - 1 ? currentIndex + 1 : (loop ? 0 : items.length - 1);
        break;
      case 'Home':
        e.preventDefault();
        newIndex = 0;
        break;
      case 'End':
        e.preventDefault();
        newIndex = items.length - 1;
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        items[currentIndex]?.click();
        return;
    }

    if (newIndex !== currentIndex) {
      setCurrentIndex(newIndex);
      items[newIndex]?.focus();
      onSelectionChange?.(newIndex);
    }
  }, [currentIndex, items, loop, orientation, onSelectionChange]);

  return { currentIndex, handleKeyDown };
};

// Skip link functionality
export const useSkipLink = () => {
  const [isVisible, setIsVisible] = useState(false);
  const skipLinkRef = useRef<HTMLAnchorElement>(null);

  const showSkipLink = useCallback(() => {
    setIsVisible(true);
  }, []);

  const hideSkipLink = useCallback(() => {
    setIsVisible(false);
  }, []);

  const handleSkipToContent = useCallback((targetId: string) => {
    const target = document.getElementById(targetId);
    if (target) {
      target.focus();
      target.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  return {
    isVisible,
    skipLinkRef,
    showSkipLink,
    hideSkipLink,
    handleSkipToContent
  };
};

// High contrast mode detection
export const useHighContrastMode = () => {
  const [isHighContrast, setIsHighContrast] = useState(false);

  useEffect(() => {
    const checkHighContrast = () => {
      const testElement = document.createElement('div');
      testElement.style.border = '1px solid';
      testElement.style.borderColor = 'red green';
      document.body.appendChild(testElement);

      const computedStyle = getComputedStyle(testElement);
      const isHighContrastMode = computedStyle.borderTopColor === computedStyle.borderRightColor;

      document.body.removeChild(testElement);
      setIsHighContrast(isHighContrastMode);
    };

    checkHighContrast();
    
    // Check for Windows High Contrast Mode
    if (window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-contrast: high)');
      setIsHighContrast(mediaQuery.matches);
      
      const handleChange = (e: MediaQueryListEvent) => {
        setIsHighContrast(e.matches);
      };
      
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, []);

  return isHighContrast;
};

// Reduced motion detection
export const useReducedMotion = () => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      setPrefersReducedMotion(mediaQuery.matches);
      
      const handleChange = (e: MediaQueryListEvent) => {
        setPrefersReducedMotion(e.matches);
      };
      
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, []);

  return prefersReducedMotion;
};

// Focus management
export const useFocusManagement = () => {
  const [lastFocusedElement, setLastFocusedElement] = useState<HTMLElement | null>(null);

  const saveFocus = useCallback(() => {
    setLastFocusedElement(document.activeElement as HTMLElement);
  }, []);

  const restoreFocus = useCallback(() => {
    if (lastFocusedElement) {
      lastFocusedElement.focus();
    }
  }, [lastFocusedElement]);

  const focusFirst = useCallback((container: HTMLElement) => {
    const focusableElements = KeyboardNavigation.getFocusableElements(container);
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }
  }, []);

  return {
    saveFocus,
    restoreFocus,
    focusFirst
  };
};

// ARIA live region management
export const useAriaLiveRegion = () => {
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<'polite' | 'assertive'>('polite');

  const announce = useCallback((newMessage: string, newPriority: 'polite' | 'assertive' = 'polite') => {
    setMessage(newMessage);
    setPriority(newPriority);
    
    // Clear message after announcement
    setTimeout(() => {
      setMessage('');
    }, 1000);
  }, []);

  return {
    message,
    priority,
    announce
  };
};

// Touch target size validation
export const validateTouchTargetSize = (element: HTMLElement): boolean => {
  const rect = element.getBoundingClientRect();
  const minSize = WCAG_GUIDELINES.AA.touchTargetSize;
  
  return rect.width >= minSize && rect.height >= minSize;
};

// Text size and readability
export const calculateTextSize = (element: HTMLElement): number => {
  const computedStyle = getComputedStyle(element);
  const fontSize = parseFloat(computedStyle.fontSize);
  return fontSize;
};

// Accessibility testing utilities
export const AccessibilityTester = {
  // Test all interactive elements for proper ARIA labels
  testAriaLabels: (): { element: HTMLElement; issues: string[] }[] => {
    const interactiveElements = document.querySelectorAll('button, a, input, select, textarea');
    const results: { element: HTMLElement; issues: string[] }[] = [];

    interactiveElements.forEach((element) => {
      const el = element as HTMLElement;
      const issues: string[] = [];

      if (!el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby') && !el.textContent?.trim()) {
        issues.push('Missing accessible name');
      }

      if (el.getAttribute('aria-hidden') === 'true' && el.tabIndex !== -1) {
        issues.push('Hidden element is focusable');
      }

      if (issues.length > 0) {
        results.push({ element: el, issues });
      }
    });

    return results;
  },

  // Test color contrast for all text elements
  testColorContrast: (): { element: HTMLElement; ratio: number; passes: boolean }[] => {
    const textElements = document.querySelectorAll('*');
    const results: { element: HTMLElement; ratio: number; passes: boolean }[] = [];

    textElements.forEach((element) => {
      const el = element as HTMLElement;
      const computedStyle = getComputedStyle(el);
      const color = computedStyle.color;
      const backgroundColor = computedStyle.backgroundColor;

      if (color && backgroundColor && el.textContent?.trim()) {
        try {
          const ratio = calculateContrastRatio(color, backgroundColor);
          const passes = ratio >= WCAG_GUIDELINES.AA.colorContrast;
          results.push({ element: el, ratio, passes });
        } catch (error) {
          console.warn('Could not calculate contrast ratio for element:', el);
        }
      }
    });

    return results;
  },

  // Test touch target sizes
  testTouchTargets: (): { element: HTMLElement; width: number; height: number; passes: boolean }[] => {
    const interactiveElements = document.querySelectorAll('button, a, input, select, textarea');
    const results: { element: HTMLElement; width: number; height: number; passes: boolean }[] = [];
    const minSize = WCAG_GUIDELINES.AA.touchTargetSize;

    interactiveElements.forEach((element) => {
      const el = element as HTMLElement;
      const rect = el.getBoundingClientRect();
      const passes = rect.width >= minSize && rect.height >= minSize;
      
      results.push({
        element: el,
        width: rect.width,
        height: rect.height,
        passes
      });
    });

    return results;
  }
};

// Initialize accessibility features
export const initializeAccessibility = () => {
  ScreenReaderUtils.initialize();
  
  // Add skip link to page
  const skipLink = document.createElement('a');
  skipLink.href = '#main-content';
  skipLink.className = 'skip-link';
  skipLink.textContent = 'Skip to main content';
  skipLink.style.position = 'absolute';
  skipLink.style.top = '-40px';
  skipLink.style.left = '6px';
  skipLink.style.background = '#000';
  skipLink.style.color = '#fff';
  skipLink.style.padding = '8px';
  skipLink.style.textDecoration = 'none';
  skipLink.style.zIndex = '100';
  skipLink.style.transition = 'top 0.3s';
  
  skipLink.addEventListener('focus', () => {
    skipLink.style.top = '6px';
  });
  
  skipLink.addEventListener('blur', () => {
    skipLink.style.top = '-40px';
  });
  
  document.body.insertBefore(skipLink, document.body.firstChild);
  
  // Add main content landmark if not present
  if (!document.getElementById('main-content')) {
    const main = document.createElement('main');
    main.id = 'main-content';
    main.setAttribute('role', 'main');
    
    // Wrap existing content
    const body = document.body;
    while (body.firstChild && body.firstChild !== skipLink) {
      main.appendChild(body.firstChild);
    }
    body.appendChild(main);
  }
}; 