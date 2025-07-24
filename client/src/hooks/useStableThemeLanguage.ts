import { useEffect, useCallback, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { 
  saveSettings, 
  getSettings, 
  setupSettingsSync, 
  applyThemeToDocument,
  setupSystemThemeListener,
  isValidTheme,
  isValidLanguage
} from '../utils/themeLanguageUtils';

/**
 * Custom hook to ensure stable theme and language switching across admin pages
 */
export const useStableThemeLanguage = () => {
  const { theme, setTheme, toggleTheme } = useTheme();
  const { language, setLanguage, isLoading } = useLanguage();
  const isInitialized = useRef(false);
  const settingsSyncCleanup = useRef<(() => void) | null>(null);
  const systemThemeCleanup = useRef<(() => void) | null>(null);

  // Initialize settings from localStorage on mount
  useEffect(() => {
    if (isInitialized.current) return;

    try {
      const savedSettings = getSettings();
      
      // Apply saved theme if valid
      if (isValidTheme(savedSettings.theme) && savedSettings.theme !== theme) {
        setTheme(savedSettings.theme);
      }
      
      // Apply saved language if valid
      if (isValidLanguage(savedSettings.language) && savedSettings.language !== language) {
        setLanguage(savedSettings.language);
      }
      
      isInitialized.current = true;
    } catch (error) {
      console.warn('Failed to initialize theme/language settings:', error);
    }
  }, [theme, language, setTheme, setLanguage]);

  // Save settings whenever theme or language changes
  useEffect(() => {
    if (!isInitialized.current) return;

    saveSettings({
      theme,
      language
    });
  }, [theme, language]);

  // Apply theme to document whenever it changes
  useEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);

  // Setup cross-tab synchronization
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleSettingsChange = (settings: any) => {
      if (settings.theme && isValidTheme(settings.theme) && settings.theme !== theme) {
        setTheme(settings.theme);
      }
      if (settings.language && isValidLanguage(settings.language) && settings.language !== language) {
        setLanguage(settings.language);
      }
    };

    settingsSyncCleanup.current = setupSettingsSync(handleSettingsChange);

    return () => {
      if (settingsSyncCleanup.current) {
        settingsSyncCleanup.current();
      }
    };
  }, [theme, language, setTheme, setLanguage]);

  // Setup system theme listener
  useEffect(() => {
    if (typeof window === 'undefined') return;

    systemThemeCleanup.current = setupSystemThemeListener((systemTheme) => {
      // Only auto-switch if user hasn't manually set a theme
      const savedSettings = getSettings();
      if (!savedSettings.theme || savedSettings.theme === 'light') {
        setTheme(systemTheme);
      }
    });

    return () => {
      if (systemThemeCleanup.current) {
        systemThemeCleanup.current();
      }
    };
  }, [setTheme]);

  // Enhanced theme toggle with error handling
  const stableToggleTheme = useCallback(() => {
    try {
      toggleTheme();
    } catch (error) {
      console.error('Failed to toggle theme:', error);
      // Fallback to manual toggle
      setTheme(theme === 'light' ? 'dark' : 'light');
    }
  }, [toggleTheme, setTheme, theme]);

  // Enhanced language setter with error handling
  const stableSetLanguage = useCallback((newLanguage: 'en' | 'rw') => {
    try {
      if (isValidLanguage(newLanguage)) {
        setLanguage(newLanguage);
      } else {
        console.warn('Invalid language:', newLanguage);
      }
    } catch (error) {
      console.error('Failed to set language:', error);
    }
  }, [setLanguage]);

  // Enhanced theme setter with error handling
  const stableSetTheme = useCallback((newTheme: 'light' | 'dark') => {
    try {
      if (isValidTheme(newTheme)) {
        setTheme(newTheme);
      } else {
        console.warn('Invalid theme:', newTheme);
      }
    } catch (error) {
      console.error('Failed to set theme:', error);
    }
  }, [setTheme]);

  return {
    theme,
    language,
    isLoading,
    toggleTheme: stableToggleTheme,
    setTheme: stableSetTheme,
    setLanguage: stableSetLanguage,
    isInitialized: isInitialized.current
  };
};

/**
 * Hook to detect theme/language changes and trigger re-renders
 */
export const useThemeLanguageChange = () => {
  const { theme, language } = useStableThemeLanguage();
  
  useEffect(() => {
    // Force re-render of components that depend on theme/language
    const event = new CustomEvent('themeLanguageChanged', {
      detail: { theme, language }
    });
    window.dispatchEvent(event);
  }, [theme, language]);

  return { theme, language };
}; 