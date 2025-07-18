import { useState, useEffect, useCallback } from 'react';

interface AccessibilitySettings {
  enabled: boolean;
  speechToText: boolean;
  textToSpeech: boolean;
  autoRead: boolean;
  speechRate: number;
  speechPitch: number;
  speechVolume: number;
}

const DEFAULT_SETTINGS: AccessibilitySettings = {
  enabled: false,
  speechToText: true,
  textToSpeech: true,
  autoRead: false,
  speechRate: 1,
  speechPitch: 1,
  speechVolume: 1
};

export const useAccessibility = () => {
  const [settings, setSettings] = useState<AccessibilitySettings>(() => {
    // Load from localStorage
    try {
      const saved = localStorage.getItem('accessibility-settings');
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const [currentContent, setCurrentContent] = useState<string>('');
  const [isVisible, setIsVisible] = useState(false);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('accessibility-settings', JSON.stringify(settings));
    } catch (error) {
      console.warn('Failed to save accessibility settings:', error);
    }
  }, [settings]);

  // Update settings
  const updateSettings = useCallback((updates: Partial<AccessibilitySettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  }, []);

  // Toggle accessibility panel
  const togglePanel = useCallback((visible?: boolean) => {
    setIsVisible(prev => visible !== undefined ? visible : !prev);
  }, []);

  // Set content for text-to-speech
  const setContentToRead = useCallback((content: string) => {
    setCurrentContent(content);
  }, []);

  // Handle speech-to-text result
  const handleSpeechToText = useCallback((text: string) => {
    // Can be used for search, notes, etc.
    console.log('Speech to text result:', text);
    
    // Dispatch custom event for other components to listen
    window.dispatchEvent(new CustomEvent('speech-to-text-result', {
      detail: { text }
    }));
  }, []);

  // Extract text content from DOM element
  const extractTextContent = useCallback((element: HTMLElement | null): string => {
    if (!element) return '';
    
    // Remove scripts, styles, and other non-content elements
    const clone = element.cloneNode(true) as HTMLElement;
    const scripts = clone.querySelectorAll('script, style, noscript');
    scripts.forEach(el => el.remove());
    
    // Get clean text content
    return clone.textContent?.trim() || '';
  }, []);

  // Auto-read content when it changes (if enabled)
  useEffect(() => {
    if (settings.enabled && settings.autoRead && currentContent) {
      // Delay to allow UI to settle
      const timer = setTimeout(() => {
        window.dispatchEvent(new CustomEvent('auto-read-content', {
          detail: { content: currentContent }
        }));
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [currentContent, settings.enabled, settings.autoRead]);

  return {
    settings,
    updateSettings,
    isVisible,
    togglePanel,
    currentContent,
    setContentToRead,
    handleSpeechToText,
    extractTextContent
  };
}; 