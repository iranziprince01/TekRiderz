import { useEffect, useRef, useCallback, useState } from 'react';
import { apiClient } from '../utils/api';

interface AutoSaveOptions {
  enabled?: boolean;
  interval?: number; // in milliseconds
  debounceDelay?: number; // in milliseconds
  maxRetries?: number;
  onSave?: (success: boolean, error?: string) => void;
  onError?: (error: string) => void;
}

interface AutoSaveState {
  lastSaved: Date | null;
  saving: boolean;
  error: string | null;
  hasUnsavedChanges: boolean;
  saveCount: number;
}

export const useAutoSave = <T>(
  data: T,
  saveFunction: (data: T) => Promise<{ success: boolean; error?: string }>,
  options: AutoSaveOptions = {}
) => {
  const {
    enabled = true,
    interval = 30000, // 30 seconds
    debounceDelay = 2000, // 2 seconds
    maxRetries = 3,
    onSave,
    onError
  } = options;

  const [autoSaveState, setAutoSaveState] = useState<AutoSaveState>({
    lastSaved: null,
    saving: false,
    error: null,
    hasUnsavedChanges: false,
    saveCount: 0
  });

  const intervalRef = useRef<number | null>(null);
  const debounceRef = useRef<number | null>(null);
  const lastDataRef = useRef<T>(data);
  const retryCountRef = useRef<number>(0);

  // Check if data has changed
  const hasDataChanged = useCallback((newData: T, oldData: T): boolean => {
    return JSON.stringify(newData) !== JSON.stringify(oldData);
  }, []);

  // Perform the actual save operation
  const performSave = useCallback(async () => {
    if (!enabled || autoSaveState.saving) return;

    setAutoSaveState(prev => ({ ...prev, saving: true, error: null }));

    try {
      const result = await saveFunction(data);
      
      if (result.success) {
        setAutoSaveState(prev => ({
          ...prev,
          saving: false,
          lastSaved: new Date(),
          hasUnsavedChanges: false,
          saveCount: prev.saveCount + 1,
          error: null
        }));
        
        retryCountRef.current = 0;
        lastDataRef.current = data;
        
        onSave?.(true);
      } else {
        throw new Error(result.error || 'Save failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Auto-save failed';
      
      retryCountRef.current += 1;
      
      if (retryCountRef.current <= maxRetries) {
        // Retry with exponential backoff
        const retryDelay = Math.min(1000 * Math.pow(2, retryCountRef.current - 1), 10000);
        
        setTimeout(() => {
          performSave();
        }, retryDelay);
      } else {
        setAutoSaveState(prev => ({
          ...prev,
          saving: false,
          error: errorMessage
        }));
        
        onSave?.(false, errorMessage);
        onError?.(errorMessage);
        
        // Reset retry count for next attempt
        retryCountRef.current = 0;
      }
    }
  }, [data, enabled, saveFunction, maxRetries, onSave, onError, autoSaveState.saving]);

  // Debounced save
  const debouncedSave = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      performSave();
    }, debounceDelay);
  }, [performSave, debounceDelay]);

  // Manual save function
  const manualSave = useCallback(async () => {
    // Clear any pending debounced saves
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    await performSave();
  }, [performSave]);

  // Force save (ignores enabled state)
  const forceSave = useCallback(async () => {
    if (autoSaveState.saving) return;

    setAutoSaveState(prev => ({ ...prev, saving: true, error: null }));

    try {
      const result = await saveFunction(data);
      
      if (result.success) {
        setAutoSaveState(prev => ({
          ...prev,
          saving: false,
          lastSaved: new Date(),
          hasUnsavedChanges: false,
          saveCount: prev.saveCount + 1,
          error: null
        }));
        
        lastDataRef.current = data;
        onSave?.(true);
        return true;
      } else {
        throw new Error(result.error || 'Save failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Save failed';
      
      setAutoSaveState(prev => ({
        ...prev,
        saving: false,
        error: errorMessage
      }));
      
      onSave?.(false, errorMessage);
      onError?.(errorMessage);
      return false;
    }
  }, [data, saveFunction, onSave, onError, autoSaveState.saving]);

  // Set up auto-save interval
  useEffect(() => {
    if (!enabled) return;

    intervalRef.current = setInterval(() => {
      if (autoSaveState.hasUnsavedChanges && !autoSaveState.saving) {
        performSave();
      }
    }, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, interval, autoSaveState.hasUnsavedChanges, autoSaveState.saving, performSave]);

  // Watch for data changes
  useEffect(() => {
    if (hasDataChanged(data, lastDataRef.current)) {
      setAutoSaveState(prev => ({ ...prev, hasUnsavedChanges: true }));
      
      if (enabled) {
        debouncedSave();
      }
    }
  }, [data, enabled, hasDataChanged, debouncedSave]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return {
    ...autoSaveState,
    manualSave,
    forceSave,
    isEnabled: enabled
  };
};

// Specialized hook for course creation
export const useCourseAutoSave = (courseData: any, options: AutoSaveOptions = {}) => {
  const saveFunction = useCallback(async (data: any) => {
    try {
      // Only auto-save if there's meaningful content
      if (!data.title || data.title.trim().length < 3) {
        return { success: true }; // Skip saving if no meaningful content
      }

      const formData = new FormData();
      
      // Basic course info
      formData.append('title', data.title);
      formData.append('shortDescription', data.shortDescription || '');
      formData.append('description', data.description || '');
      formData.append('category', data.category || '');
      formData.append('level', data.level || 'beginner');
      formData.append('language', 'en');
              // All courses are free - no pricing data needed
      formData.append('status', 'draft');
      formData.append('targetAudience', 'General learners');
      
      // Arrays as JSON strings
      formData.append('tags', JSON.stringify(data.tags || []));
      formData.append('requirements', JSON.stringify([]));
      formData.append('learningObjectives', JSON.stringify(data.learningObjectives || []));

      // Convert modules to sections format expected by backend
      const sections = (data.modules || []).map((module: any, index: number) => ({
        id: module.id,
        title: module.title || '',
        description: module.description || '',
        order: index + 1,
        isPublished: false,
        isRequired: true,
        estimatedDuration: 1800, // 30 minutes default
        learningObjectives: [],
        lessons: module.videoUrl ? [{
          id: `lesson_${module.id}`,
          title: module.title || '',
          description: module.description || '',
          type: 'video',
          content: {
            videoUrl: module.videoUrl,
            duration: 1800
          },
          order: 1,
          isPublished: false,
          isRequired: true,
          estimatedDuration: 30
        }] : []
      }));
      
      formData.append('sections', JSON.stringify(sections));

      // Add thumbnail file if exists
      if (data.thumbnailFileId) {
        formData.append('thumbnailFileId', data.thumbnailFileId);
      }

      // Calculate totals
      const totalLessons = sections.reduce((total: number, section: any) => total + section.lessons.length, 0);
      const totalDuration = sections.reduce((total: number, section: any) => total + section.estimatedDuration, 0);
      
      formData.append('totalLessons', totalLessons.toString());
      formData.append('totalDuration', totalDuration.toString());

      const result = await apiClient.createCourse(formData);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Auto-save failed'
      };
    }
  }, []);

  return useAutoSave(courseData, saveFunction, {
    ...options,
    interval: options.interval || 30000, // 30 seconds for course auto-save
    debounceDelay: options.debounceDelay || 3000, // 3 seconds debounce
  });
};

// Hook for local storage backup
export const useLocalStorageBackup = <T>(
  key: string,
  data: T,
  options: { enabled?: boolean; debounceDelay?: number } = {}
) => {
  const { enabled = true, debounceDelay = 1000 } = options;
  const debounceRef = useRef<number | null>(null);

  const saveToLocalStorage = useCallback(() => {
    if (!enabled) return;

    try {
      const serializedData = JSON.stringify({
        data,
        timestamp: new Date().toISOString(),
        version: '1.0'
      });
      
      localStorage.setItem(key, serializedData);
    } catch (error) {
      console.error('Failed to save to local storage:', error);
    }
  }, [key, data, enabled]);

  const loadFromLocalStorage = useCallback((): T | null => {
    if (!enabled) return null;

    try {
      const stored = localStorage.getItem(key);
      if (!stored) return null;

      const parsed = JSON.parse(stored);
      return parsed.data;
    } catch (error) {
      console.error('Failed to load from local storage:', error);
      return null;
    }
  }, [key, enabled]);

  const clearLocalStorage = useCallback(() => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Failed to clear local storage:', error);
    }
  }, [key]);

  // Debounced save to local storage
  useEffect(() => {
    if (!enabled) return;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      saveToLocalStorage();
    }, debounceDelay);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [data, enabled, debounceDelay, saveToLocalStorage]);

  return {
    loadFromLocalStorage,
    clearLocalStorage,
    saveToLocalStorage
  };
};

export default useAutoSave; 