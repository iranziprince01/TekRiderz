// Theme and Language Utilities for stable switching across admin pages

export interface ThemeLanguageSettings {
  theme: 'light' | 'dark';
  language: 'en' | 'rw';
  timestamp: number;
}

const SETTINGS_KEY = 'tekriders-settings';

/**
 * Save theme and language settings to localStorage with error handling
 */
export const saveSettings = (settings: Partial<ThemeLanguageSettings>): void => {
  try {
    const existing = getSettings();
    const updated = {
      ...existing,
      ...settings,
      timestamp: Date.now()
    };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
  } catch (error) {
    console.warn('Failed to save settings:', error);
  }
};

/**
 * Get theme and language settings from localStorage with fallbacks
 */
export const getSettings = (): ThemeLanguageSettings => {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === 'object') {
        return {
          theme: parsed.theme === 'dark' ? 'dark' : 'light',
          language: parsed.language === 'rw' ? 'rw' : 'en',
          timestamp: parsed.timestamp || Date.now()
        };
      }
    }
  } catch (error) {
    console.warn('Failed to parse settings:', error);
  }
  
  // Default settings
  return {
    theme: 'light',
    language: 'rw',
    timestamp: Date.now()
  };
};

/**
 * Clear all settings
 */
export const clearSettings = (): void => {
  try {
    localStorage.removeItem(SETTINGS_KEY);
  } catch (error) {
    console.warn('Failed to clear settings:', error);
  }
};

/**
 * Check if settings are stale (older than 30 days)
 */
export const isSettingsStale = (): boolean => {
  const settings = getSettings();
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  return settings.timestamp < thirtyDaysAgo;
};

/**
 * Sync settings across browser tabs/windows
 */
export const setupSettingsSync = (onSettingsChange: (settings: ThemeLanguageSettings) => void): (() => void) => {
  const handleStorageChange = (event: StorageEvent) => {
    if (event.key === SETTINGS_KEY && event.newValue) {
      try {
        const newSettings = JSON.parse(event.newValue);
        onSettingsChange(newSettings);
      } catch (error) {
        console.warn('Failed to parse settings from storage event:', error);
      }
    }
  };

  window.addEventListener('storage', handleStorageChange);
  
  return () => {
    window.removeEventListener('storage', handleStorageChange);
  };
};

/**
 * Apply theme to document with proper error handling
 */
export const applyThemeToDocument = (theme: 'light' | 'dark'): void => {
  try {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    
    // Update meta theme-color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', theme === 'dark' ? '#111827' : '#ffffff');
    }
    
    // Update body class for additional styling
    document.body.classList.remove('light', 'dark');
    document.body.classList.add(theme);
  } catch (error) {
    console.warn('Failed to apply theme to document:', error);
  }
};

/**
 * Get system theme preference
 */
export const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'light';
  
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch (error) {
    console.warn('Failed to get system theme:', error);
    return 'light';
  }
};

/**
 * Setup system theme listener
 */
export const setupSystemThemeListener = (
  callback: (theme: 'light' | 'dark') => void
): (() => void) => {
  if (typeof window === 'undefined') return () => {};
  
  try {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      callback(e.matches ? 'dark' : 'light');
    };
    
    mediaQuery.addEventListener('change', handleChange);
    
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  } catch (error) {
    console.warn('Failed to setup system theme listener:', error);
    return () => {};
  }
};

/**
 * Validate theme value
 */
export const isValidTheme = (theme: any): theme is 'light' | 'dark' => {
  return theme === 'light' || theme === 'dark';
};

/**
 * Validate language value
 */
export const isValidLanguage = (language: any): language is 'en' | 'rw' => {
  return language === 'en' || language === 'rw';
}; 