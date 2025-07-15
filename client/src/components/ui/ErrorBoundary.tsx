import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { Button } from './Button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  isOfflineError: boolean;
  retryAttempts: number;
}

export class ErrorBoundary extends Component<Props, State> {
  private maxRetries = 3;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      isOfflineError: false,
      retryAttempts: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Check if this is an offline-related error
    const isOfflineError = 
      error.message.includes('offline') ||
      error.message.includes('network') ||
      error.message.includes('sync') ||
      error.message.includes('IndexedDB') ||
      error.message.includes('service worker') ||
      !navigator.onLine;

    return {
      hasError: true,
      error,
      isOfflineError
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      errorInfo
    });

    // Call the optional onError callback
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Report to error tracking service if available
    if (typeof window !== 'undefined' && (window as any).reportError) {
      (window as any).reportError(error);
    }
  }

  handleRetry = () => {
    if (this.state.retryAttempts < this.maxRetries) {
      this.setState(prevState => ({
        hasError: false,
        error: null,
        errorInfo: null,
        isOfflineError: false,
        retryAttempts: prevState.retryAttempts + 1
      }));
    } else {
      // Force page reload after max retries
      window.location.reload();
    }
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { error, isOfflineError, retryAttempts } = this.state;
      const canRetry = retryAttempts < this.maxRetries;
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 text-center">
            <div className="mb-6">
              {isOfflineError ? (
                <div className="flex justify-center mb-4">
                  {isOnline ? (
                    <Wifi className="h-16 w-16 text-blue-500" />
                  ) : (
                    <WifiOff className="h-16 w-16 text-red-500" />
                  )}
                </div>
              ) : (
                <AlertTriangle className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
              )}
              
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {isOfflineError ? 'Connection Issue' : 'Something went wrong'}
              </h1>
              
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                {isOfflineError 
                  ? !isOnline 
                    ? "You're currently offline. Some features may not be available."
                    : "There was an issue with the offline functionality. Your data is safe."
                  : "An unexpected error occurred. We apologize for the inconvenience."
                }
              </p>
              
              {import.meta.env.DEV && error && (
                <details className="text-left bg-gray-100 dark:bg-gray-700 p-3 rounded mb-4">
                  <summary className="cursor-pointer text-sm font-medium">
                    Error Details (Development)
                  </summary>
                  <pre className="text-xs mt-2 overflow-auto">
                    {error.stack}
                  </pre>
                </details>
              )}
            </div>

            <div className="space-y-3">
              {canRetry && (
                <Button
                  onClick={this.handleRetry}
                  className="w-full flex items-center justify-center gap-2"
                  variant="primary"
                >
                  <RefreshCw className="h-4 w-4" />
                  Try Again {retryAttempts > 0 && `(${retryAttempts}/${this.maxRetries})`}
                </Button>
              )}
              
              <Button
                onClick={this.handleReload}
                className="w-full"
                variant={canRetry ? "secondary" : "primary"}
              >
                Reload Page
              </Button>
              
              {isOfflineError && !isOnline && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  The app will automatically retry when your connection is restored.
                </p>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook version of ErrorBoundary for functional components
export const useErrorBoundary = () => {
  const [error, setError] = React.useState<Error | null>(null);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  const captureError = React.useCallback((error: Error) => {
    setError(error);
  }, []);

  if (error) {
    throw error;
  }

  return { captureError, resetError };
};

// HOC version for class components
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) => {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  return WrappedComponent;
};

export default ErrorBoundary; 