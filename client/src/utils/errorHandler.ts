import React from 'react';
import { toast } from 'react-hot-toast';

// Error types
export enum ErrorType {
  NETWORK = 'network',
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  FILE_UPLOAD = 'file_upload',
  RATE_LIMIT = 'rate_limit',
  SERVER = 'server',
  CLIENT = 'client',
  UNKNOWN = 'unknown'
}

// Error severity levels
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Error interface
export interface AppError {
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  userMessage: string;
  code?: string;
  details?: any;
  timestamp: Date;
  context?: string;
  recoverable: boolean;
  retryable: boolean;
  suggestions?: string[];
}

// Error recovery actions
export interface ErrorRecoveryAction {
  label: string;
  action: () => void | Promise<void>;
  primary?: boolean;
}

// Error context
export interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  sessionId?: string;
  userAgent?: string;
  url?: string;
  additionalData?: Record<string, any>;
}

// Error handler class
export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorLog: AppError[] = [];
  private maxLogSize = 100;
  private context: ErrorContext = {};

  private constructor() {
    this.setupGlobalErrorHandlers();
  }

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  // Set context for error reporting
  setContext(context: Partial<ErrorContext>) {
    this.context = { ...this.context, ...context };
  }

  // Setup global error handlers
  private setupGlobalErrorHandlers() {
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError(event.reason, 'Unhandled promise rejection');
    });

    // Handle JavaScript errors
    window.addEventListener('error', (event) => {
      this.handleError(event.error, 'JavaScript error');
    });

    // Handle network errors

  }

  // Main error handling method
  handleError(
    error: any,
    context?: string,
    recoveryActions?: ErrorRecoveryAction[]
  ): AppError {
    const appError = this.createAppError(error, context);
    
    // Log the error
    this.logError(appError);
    
    // Show user-friendly message
    this.showUserMessage(appError, recoveryActions);
    
    // Report to monitoring service (in production)
    this.reportError(appError);
    
    return appError;
  }

  // Create standardized error object
  private createAppError(error: any, context?: string): AppError {
    const timestamp = new Date();
    let type = ErrorType.UNKNOWN;
    let severity = ErrorSeverity.MEDIUM;
    let message = 'An unexpected error occurred';
    let userMessage = 'Something went wrong. Please try again.';
    let code: string | undefined;
    let recoverable = true;
    let retryable = false;
    let suggestions: string[] = [];

    // Determine error type and details
    if (error instanceof TypeError && error.message.includes('fetch')) {
      type = ErrorType.NETWORK;
      severity = ErrorSeverity.HIGH;
      message = 'Network request failed';
      userMessage = 'Unable to connect to the server. Please check your internet connection.';
      retryable = true;
      suggestions = [
        'Check your internet connection',
        'Try refreshing the page',
        'Wait a moment and try again'
      ];
    } else if (error?.status === 401) {
      type = ErrorType.AUTHENTICATION;
      severity = ErrorSeverity.HIGH;
      message = 'Authentication failed';
      userMessage = 'Your session has expired. Please log in again.';
      recoverable = false;
      suggestions = ['Please log in again'];
    } else if (error?.status === 403) {
      type = ErrorType.AUTHORIZATION;
      severity = ErrorSeverity.HIGH;
      message = 'Access denied';
      userMessage = 'You don\'t have permission to perform this action.';
      recoverable = false;
      suggestions = ['Contact support if you believe this is an error'];
    } else if (error?.status === 400) {
      type = ErrorType.VALIDATION;
      severity = ErrorSeverity.MEDIUM;
      message = 'Validation error';
      userMessage = 'Please check your input and try again.';
      suggestions = ['Review the form for errors', 'Ensure all required fields are filled'];
    } else if (error?.status === 413) {
      type = ErrorType.FILE_UPLOAD;
      severity = ErrorSeverity.MEDIUM;
      message = 'File too large';
      userMessage = 'The file you\'re trying to upload is too large.';
      suggestions = ['Try a smaller file', 'Compress the file before uploading'];
    } else if (error?.status === 429) {
      type = ErrorType.RATE_LIMIT;
      severity = ErrorSeverity.MEDIUM;
      message = 'Rate limit exceeded';
      userMessage = 'Too many requests. Please wait a moment and try again.';
      retryable = true;
      suggestions = ['Wait a few minutes before trying again'];
    } else if (error?.status >= 500) {
      type = ErrorType.SERVER;
      severity = ErrorSeverity.HIGH;
      message = 'Server error';
      userMessage = 'Our servers are experiencing issues. Please try again later.';
      retryable = true;
      suggestions = ['Try again in a few minutes', 'Contact support if the problem persists'];
    } else if (error?.message?.includes('upload')) {
      type = ErrorType.FILE_UPLOAD;
      severity = ErrorSeverity.MEDIUM;
      message = error.message;
      userMessage = 'File upload failed. Please try again.';
      retryable = true;
      suggestions = ['Check your file format and size', 'Try uploading again'];
    } else if (error?.message) {
      message = error.message;
      // Try to make user message more friendly
      if (error.message.includes('network')) {
        type = ErrorType.NETWORK;
        userMessage = 'Network connection issue. Please check your connection.';
        retryable = true;
      } else if (error.message.includes('timeout')) {
        type = ErrorType.NETWORK;
        userMessage = 'Request timed out. Please try again.';
        retryable = true;
      } else if (error.message.includes('validation')) {
        type = ErrorType.VALIDATION;
        userMessage = 'Please check your input and try again.';
      }
    }

    // Extract error code if available
    if (error?.code) {
      code = error.code;
    }

    return {
      type,
      severity,
      message,
      userMessage,
      code,
      details: error,
      timestamp,
      context: context || this.context.action,
      recoverable,
      retryable,
      suggestions
    };
  }

  // Log error for debugging
  private logError(error: AppError) {
    // Add to internal log
    this.errorLog.unshift(error);
    
    // Keep log size manageable
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(0, this.maxLogSize);
    }

    // Console logging with appropriate level
    const logData = {
      ...error,
      context: this.context,
      stack: error.details?.stack
    };

    switch (error.severity) {
      case ErrorSeverity.LOW:
        console.info('Error (Low):', logData);
        break;
      case ErrorSeverity.MEDIUM:
        console.warn('Error (Medium):', logData);
        break;
      case ErrorSeverity.HIGH:
        console.error('Error (High):', logData);
        break;
      case ErrorSeverity.CRITICAL:
        console.error('CRITICAL ERROR:', logData);
        break;
    }
  }

  // Show user-friendly message
  private showUserMessage(error: AppError, recoveryActions?: ErrorRecoveryAction[]) {
    const toastOptions = {
      duration: error.severity === ErrorSeverity.HIGH ? 8000 : 4000,
      position: 'top-center' as const,
    };

    // Create message with suggestions
    let message = error.userMessage;
    if (error.suggestions && error.suggestions.length > 0) {
      message += '\n\nSuggestions:\n• ' + error.suggestions.join('\n• ');
    }

    switch (error.severity) {
      case ErrorSeverity.LOW:
        toast(message, toastOptions);
        break;
      case ErrorSeverity.MEDIUM:
        toast.error(message, toastOptions);
        break;
      case ErrorSeverity.HIGH:
      case ErrorSeverity.CRITICAL:
        toast.error(message, {
          ...toastOptions,
          duration: 10000,
        });
        break;
    }

    // Add recovery actions if provided
    if (recoveryActions && recoveryActions.length > 0) {
      recoveryActions.forEach(action => {
        toast(
          `${action.label} - ${action.primary ? 'Retry available' : 'Action available'}`,
          { duration: 8000 }
        );
      });
    }
  }

  // Report error to monitoring service
  private reportError(error: AppError) {
    // In production, send to error monitoring service
    if (import.meta.env.PROD) {
      // Example: Send to Sentry, LogRocket, etc.
      try {
        // Simulated error reporting
        const errorReport = {
          ...error,
          context: this.context,
          userAgent: navigator.userAgent,
          url: window.location.href,
          timestamp: error.timestamp.toISOString()
        };
        
        // In real implementation, send to your monitoring service
        console.log('Error reported to monitoring service:', errorReport);
      } catch (reportingError) {
        console.error('Failed to report error:', reportingError);
      }
    }
  }

  // Get error history for debugging
  getErrorHistory(): AppError[] {
    return [...this.errorLog];
  }

  // Clear error history
  clearErrorHistory() {
    this.errorLog = [];
  }

  // Check if error is recoverable
  isRecoverable(error: AppError): boolean {
    return error.recoverable;
  }

  // Check if error is retryable
  isRetryable(error: AppError): boolean {
    return error.retryable;
  }

  // Get error statistics
  getErrorStats(): {
    total: number;
    byType: Record<ErrorType, number>;
    bySeverity: Record<ErrorSeverity, number>;
    recent: AppError[];
  } {
    const stats = {
      total: this.errorLog.length,
      byType: {} as Record<ErrorType, number>,
      bySeverity: {} as Record<ErrorSeverity, number>,
      recent: this.errorLog.slice(0, 10)
    };

    // Initialize counters
    Object.values(ErrorType).forEach(type => {
      stats.byType[type] = 0;
    });
    Object.values(ErrorSeverity).forEach(severity => {
      stats.bySeverity[severity] = 0;
    });

    // Count errors
    this.errorLog.forEach(error => {
      stats.byType[error.type]++;
      stats.bySeverity[error.severity]++;
    });

    return stats;
  }
}

// Specific error handlers for common scenarios
export class CourseCreationErrorHandler {
  private errorHandler = ErrorHandler.getInstance();

  constructor() {
    this.errorHandler.setContext({
      component: 'CourseCreation',
      action: 'course_creation'
    });
  }

  // Handle validation errors
  handleValidationError(errors: string[], field?: string) {
    const error = new Error(`Validation failed: ${errors.join(', ')}`);
    return this.errorHandler.handleError(error, `Validation error${field ? ` in ${field}` : ''}`);
  }



  // Handle auto-save errors
  handleAutoSaveError(error: any) {
    const recoveryActions: ErrorRecoveryAction[] = [
      {
        label: 'Save manually',
        action: () => console.log('Manual save triggered'),
        primary: true
      }
    ];

    return this.errorHandler.handleError(
      error, 
      'Auto-save failed',
      recoveryActions
    );
  }

  // Handle network errors
  handleNetworkError(error: any, action?: string) {
    const recoveryActions: ErrorRecoveryAction[] = [
      {
        label: 'Retry',
        action: () => window.location.reload(),
        primary: true
      },
      {
        label: 'Check connection',
        action: () => { window.open('https://www.google.com', '_blank'); }
      }
    ];

    return this.errorHandler.handleError(
      error, 
      `Network error${action ? ` during ${action}` : ''}`,
      recoveryActions
    );
  }

  // Handle submission errors
  handleSubmissionError(error: any) {
    const recoveryActions: ErrorRecoveryAction[] = [
      {
        label: 'Try again',
        action: () => console.log('Submission retry triggered'),
        primary: true
      },
      {
        label: 'Save as draft',
        action: () => console.log('Save as draft triggered')
      }
    ];

    return this.errorHandler.handleError(
      error, 
      'Course submission failed',
      recoveryActions
    );
  }
}

// Utility functions for error handling
export const handleApiError = (error: any, context?: string) => {
  const errorHandler = ErrorHandler.getInstance();
  return errorHandler.handleError(error, context);
};



export const handleValidationError = (errors: string[], field?: string) => {
  const courseErrorHandler = new CourseCreationErrorHandler();
  return courseErrorHandler.handleValidationError(errors, field);
};

export const handleNetworkError = (error: any, action?: string) => {
  const courseErrorHandler = new CourseCreationErrorHandler();
  return courseErrorHandler.handleNetworkError(error, action);
};

// Legacy compatibility functions
export const handleCatchError = (error: any, defaultMessage: string = 'An unexpected error occurred'): string => {
  const errorHandler = ErrorHandler.getInstance();
  const appError = errorHandler.handleError(error, 'Catch block error');
  return appError.userMessage || defaultMessage;
};

export const getErrorMessage = (error: any): string => {
  if (typeof error === 'string') return error;
  if (!error) return 'An unknown error occurred';
  if (error.error && typeof error.error === 'string') return error.error;
  if (error.message) return error.message;
  if (error instanceof Error) return error.message;
  return 'An unexpected error occurred';
};

// Error boundary helper
export const createErrorBoundary = (fallback: React.ComponentType<{ error: Error }>) => {
  return class ErrorBoundary extends React.Component<
    { children: React.ReactNode },
    { hasError: boolean; error: Error | null }
  > {
    constructor(props: { children: React.ReactNode }) {
      super(props);
      this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error) {
      return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
      const errorHandler = ErrorHandler.getInstance();
      errorHandler.handleError(error, 'React Error Boundary');
      console.error('Error caught by boundary:', error, errorInfo);
    }

    render() {
      if (this.state.hasError && this.state.error) {
        return React.createElement(fallback, { error: this.state.error });
      }

      return this.props.children;
    }
  };
};

// Hook for error handling in components
export const useErrorHandler = () => {
  const errorHandler = ErrorHandler.getInstance();
  
  return {
    handleError: (error: any, context?: string) => errorHandler.handleError(error, context),
    handleValidationError: (errors: string[], field?: string) => handleValidationError(errors, field),

    handleNetworkError: (error: any, action?: string) => handleNetworkError(error, action),
    getErrorHistory: () => errorHandler.getErrorHistory(),
    getErrorStats: () => errorHandler.getErrorStats(),
    clearErrorHistory: () => errorHandler.clearErrorHistory(),
    setContext: (context: Partial<ErrorContext>) => errorHandler.setContext(context)
  };
};

export default ErrorHandler; 