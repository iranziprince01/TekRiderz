import { useState, useCallback } from 'react';
import { useOffline } from './useOffline';

interface OfflineFormOptions {
  showSuccessMessage?: boolean;
  showOfflineMessage?: boolean;
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
  onOfflineQueue?: () => void;
}

interface FormSubmissionState {
  isSubmitting: boolean;
  isQueued: boolean;
  error: string | null;
  success: boolean;
}

export const useOfflineForm = (options: OfflineFormOptions = {}) => {
  const { isOnline } = useOffline();
  const [state, setState] = useState<FormSubmissionState>({
    isSubmitting: false,
    isQueued: false,
    error: null,
    success: false
  });

  const submitForm = useCallback(async (
    url: string,
    data: any,
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'POST'
  ) => {
    setState(prev => ({
      ...prev,
      isSubmitting: true,
      error: null,
      success: false,
      isQueued: false
    }));

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('token') && {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          })
        },
        body: JSON.stringify(data)
      });

      // Check if this was queued by service worker
      const isOfflineQueued = response.headers.get('X-Offline-Queued') === 'true';
      
      if (isOfflineQueued) {
        const queuedData = await response.json();
        
        setState(prev => ({
          ...prev,
          isSubmitting: false,
          isQueued: true,
          success: true
        }));

        if (options.onOfflineQueue) {
          options.onOfflineQueue();
        }

        return {
          success: true,
          queued: true,
          message: queuedData.message || 'Saved offline. Will sync when back online.',
          data: queuedData
        };
      }

      // Handle normal response
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || result.message || `HTTP ${response.status}`);
      }

      setState(prev => ({
        ...prev,
        isSubmitting: false,
        success: true
      }));

      if (options.onSuccess) {
        options.onSuccess(result);
      }

      return {
        success: true,
        queued: false,
        message: result.message || 'Saved successfully',
        data: result
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      
      setState(prev => ({
        ...prev,
        isSubmitting: false,
        error: errorMessage
      }));

      if (options.onError) {
        options.onError(errorMessage);
      }

      // If offline, the service worker should have handled this
      if (!isOnline) {
        setState(prev => ({
          ...prev,
          isQueued: true,
          success: true,
          error: null
        }));

        return {
          success: true,
          queued: true,
          message: 'Saved offline. Will sync when back online.',
          data: null
        };
      }

      return {
        success: false,
        queued: false,
        message: errorMessage,
        data: null
      };
    }
  }, [isOnline, options]);

  const resetState = useCallback(() => {
    setState({
      isSubmitting: false,
      isQueued: false,
      error: null,
      success: false
    });
  }, []);

  return {
    ...state,
    submitForm,
    resetState,
    isOnline
  };
}; 