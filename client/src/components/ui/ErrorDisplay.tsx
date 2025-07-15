import React, { useState } from 'react';
import { Alert } from './Alert';
import { 
  AlertCircle, 
  RefreshCw, 
  ChevronDown, 
  ChevronUp, 
  Clock, 
  HelpCircle,
  ExternalLink,
  Copy,
  Check
} from 'lucide-react';

interface ErrorDetails {
  type: string;
  message: string;
  code?: number;
  suggestions?: string[];
  retryable?: boolean;
  retryAfter?: number;
  timestamp?: string;
  technical?: string;
}

interface ErrorDisplayProps {
  error: string | ErrorDetails | null;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
  showTechnical?: boolean;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  onRetry,
  onDismiss,
  className = '',
  showTechnical = false
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!error) return null;

  // Handle string errors (legacy)
  if (typeof error === 'string') {
    return (
      <Alert variant="error" className={className}>
        <AlertCircle className="w-4 h-4" />
        <span>{error}</span>
        {onDismiss && (
          <button 
            onClick={onDismiss}
            className="ml-auto text-red-600 hover:text-red-800"
          >
            ×
          </button>
        )}
      </Alert>
    );
  }

  const errorDetails = error as ErrorDetails;
  const {
    type,
    message,
    code,
    suggestions = [],
    retryable = false,
    retryAfter = 0,
    timestamp,
    technical
  } = errorDetails;

  // Format retry time
  const formatRetryTime = (ms: number): string => {
    const minutes = Math.floor(ms / (1000 * 60));
    const seconds = Math.floor((ms % (1000 * 60)) / 1000);
    
    if (minutes > 0) {
      return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    }
    return `${seconds} second${seconds > 1 ? 's' : ''}`;
  };

  // Get error severity based on type
  const getErrorSeverity = (errorType: string): 'error' | 'warning' | 'info' => {
    const warningTypes = [
      'OTP_RATE_LIMIT',
      'RATE_LIMIT_EXCEEDED',
      'TOKEN_EXPIRED',
      'ACCOUNT_NOT_VERIFIED'
    ];
    
    const infoTypes = [
      'OTP_REQUIRED',
      'REQUIRED_FIELDS_MISSING'
    ];
    
    if (warningTypes.includes(errorType)) return 'warning';
    if (infoTypes.includes(errorType)) return 'info';
    return 'error';
  };

  // Get helpful error icon
  const getErrorIcon = (errorType: string) => {
    switch (errorType) {
      case 'OTP_RATE_LIMIT':
      case 'RATE_LIMIT_EXCEEDED':
        return <Clock className="w-4 h-4" />;
      case 'TOKEN_EXPIRED':
      case 'REFRESH_TOKEN_EXPIRED':
        return <RefreshCw className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  const severity = getErrorSeverity(type);
  const icon = getErrorIcon(type);

  const copyErrorDetails = async () => {
    const details = {
      type,
      message,
      code,
      timestamp: timestamp || new Date().toISOString(),
      ...(technical && { technical })
    };
    
    try {
      await navigator.clipboard.writeText(JSON.stringify(details, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy error details:', err);
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Main error alert */}
      <Alert variant={severity} className="relative">
        {icon}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <span className="text-sm font-medium">{message}</span>
            <div className="flex items-center gap-2 ml-4">
              {retryable && onRetry && (
                <button
                  onClick={onRetry}
                  className="text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded transition-colors"
                  title="Retry operation"
                >
                  <RefreshCw className="w-3 h-3 mr-1 inline" />
                  Retry
                </button>
              )}
              {onDismiss && (
                <button 
                  onClick={onDismiss}
                  className="text-current opacity-70 hover:opacity-100 transition-opacity"
                  title="Dismiss"
                >
                  ×
                </button>
              )}
            </div>
          </div>
          
          {/* Retry information */}
          {retryable && retryAfter > 0 && (
            <div className="mt-2 text-xs opacity-75">
              <Clock className="w-3 h-3 inline mr-1" />
              You can try again in {formatRetryTime(retryAfter)}
            </div>
          )}
        </div>
      </Alert>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
              Try these solutions:
            </span>
          </div>
          <ul className="space-y-1 text-sm text-blue-700 dark:text-blue-300">
            {suggestions.map((suggestion, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-blue-500 dark:text-blue-400 mt-0.5">•</span>
                <span>{suggestion}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Technical details (collapsible) */}
      {showTechnical && (technical || code || timestamp) && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Technical Details
            </span>
            {showDetails ? (
              <ChevronUp className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            )}
          </button>
          
          {showDetails && (
            <div className="border-t border-gray-200 dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-800">
              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Error Type:</span>
                  <span className="text-gray-900 dark:text-white">{type}</span>
                </div>
                
                {code && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Status Code:</span>
                    <span className="text-gray-900 dark:text-white">{code}</span>
                  </div>
                )}
                
                {timestamp && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Timestamp:</span>
                    <span className="text-gray-900 dark:text-white">
                      {new Date(timestamp).toLocaleString()}
                    </span>
                  </div>
                )}
                
                {technical && (
                  <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-600">
                    <div className="text-gray-600 dark:text-gray-400 mb-1">Technical Info:</div>
                    <div className="text-gray-900 dark:text-white bg-white dark:bg-gray-900 p-2 rounded text-xs">
                      {technical}
                    </div>
                  </div>
                )}
                
                <div className="flex justify-end pt-2">
                  <button
                    onClick={copyErrorDetails}
                    className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3 h-3" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        Copy Details
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Support link for critical errors */}
      {['SERVER_ERROR', 'DATABASE_ERROR', 'USER_DATA_CORRUPTED'].includes(type) && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
          <div className="flex items-center gap-2 text-sm text-yellow-800 dark:text-yellow-200">
            <ExternalLink className="w-4 h-4" />
            <span>
              If this problem persists, please{' '}
              <a 
                href="mailto:support@tekriders.com" 
                className="underline hover:no-underline"
              >
                contact our support team
              </a>
              {' '}with the error details above.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export { ErrorDisplay };
export type { ErrorDetails };
export default ErrorDisplay; 