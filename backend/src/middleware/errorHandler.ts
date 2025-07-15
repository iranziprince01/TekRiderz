import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { AuthErrorType } from '../utils/authErrors';

export interface ApiError extends Error {
  statusCode?: number;
  status?: string;
  isOperational?: boolean;
  code?: string;
  path?: string;
  value?: string;
  errors?: any[];
  type?: AuthErrorType;
  suggestions?: string[];
  technical?: string;
}

class AppError extends Error implements ApiError {
  statusCode: number;
  status: string;
  isOperational: boolean;
  type?: AuthErrorType;
  suggestions?: string[];
  technical?: string;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

const handleCastErrorDB = (err: any): AppError => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400);
};

const handleDuplicateFieldsDB = (err: any): AppError => {
  const value = err.errmsg?.match(/(["'])(\\?.)*?\1/)?.[0];
  const message = `Duplicate field value: ${value}. Please use another value!`;
  return new AppError(message, 400);
};

const handleValidationErrorDB = (err: any): AppError => {
  const errors = Object.values(err.errors).map((el: any) => el.message);
  const message = `Invalid input data. ${errors.join('. ')}`;
  return new AppError(message, 400);
};

const handleJWTError = (): AppError => {
  const error = new AppError('Invalid token. Please log in again!', 401);
  error.type = AuthErrorType.TOKEN_INVALID;
  error.suggestions = [
    'Sign in again to get a new session',
    'Clear your browser data if problems persist',
    'Contact support if you keep getting signed out'
  ];
  return error;
};

const handleJWTExpiredError = (): AppError => {
  const error = new AppError('Your token has expired! Please log in again.', 401);
  error.type = AuthErrorType.TOKEN_EXPIRED;
  error.suggestions = [
    'Sign in again to continue',
    'Use "Remember me" for longer sessions',
    'Your session expires after 15 minutes of inactivity'
  ];
  return error;
};

const sendErrorDev = (err: ApiError, req: Request, res: Response): void => {
  // Log error with full details in development
  logger.error('Development Error:', {
    error: err,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    body: req.body,
    query: req.query,
    params: req.params,
  });

  res.status(err.statusCode || 500).json({
    success: false,
    error: {
      type: err.type || 'UNKNOWN_ERROR',
      status: err.status,
      message: err.message,
      suggestions: err.suggestions || [],
      technical: err.technical,
      stack: err.stack,
      details: {
        url: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString(),
      },
    },
  });
};

const sendErrorProd = (err: ApiError, req: Request, res: Response): void => {
  // Log error with essential details in production
  logger.error('Production Error:', {
    type: err.type || 'UNKNOWN_ERROR',
    message: err.message,
    statusCode: err.statusCode,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    userId: (req as any).user?.id,
    timestamp: new Date().toISOString(),
  });

  // Operational, trusted error: send message to client
  if (err.isOperational) {
    const response: any = {
      success: false,
      error: {
        type: err.type || 'UNKNOWN_ERROR',
        message: err.message,
        code: err.statusCode,
      },
    };

    // Add suggestions for better UX (only for non-sensitive errors)
    if (err.suggestions && err.suggestions.length > 0) {
      response.error.suggestions = err.suggestions;
    }

    // Add retry information for retryable errors
    if (err.type && isRetryableError(err.type)) {
      response.error.retryable = true;
      response.error.retryAfter = getRetryDelay(err.type);
    }

    res.status(err.statusCode || 500).json(response);
  } else {
    // Programming or other unknown error: don't leak error details
    logger.error('Unknown/Non-operational error:', {
      message: err.message,
      stack: err.stack,
      url: req.originalUrl,
      method: req.method,
    });

    res.status(500).json({
      success: false,
      error: {
        type: 'SERVER_ERROR',
        message: 'Something went wrong on our end. Please try again.',
        code: 500,
        suggestions: [
          'Try again in a few minutes',
          'Check your internet connection',
          'Contact support if the problem persists'
        ],
      },
    });
  }
};

// Helper function to determine if an error is retryable
const isRetryableError = (type: AuthErrorType): boolean => {
  const retryableErrors = [
    AuthErrorType.SERVER_ERROR,
    AuthErrorType.DATABASE_ERROR,
    AuthErrorType.EMAIL_SERVICE_UNAVAILABLE,
    AuthErrorType.EMAIL_DELIVERY_FAILED,
    AuthErrorType.OTP_SEND_FAILED,
    AuthErrorType.REGISTRATION_FAILED,
    AuthErrorType.LOGIN_FAILED,
    AuthErrorType.OTP_VERIFICATION_FAILED,
  ];
  
  return retryableErrors.includes(type);
};

// Helper function to get retry delay
const getRetryDelay = (type: AuthErrorType): number => {
  switch (type) {
    case AuthErrorType.RATE_LIMIT_EXCEEDED:
    case AuthErrorType.OTP_RATE_LIMIT:
      return 15 * 60 * 1000; // 15 minutes
    default:
      return 5 * 60 * 1000; // 5 minutes
  }
};

// Enhanced error handler with better categorization
export const errorHandler = (
  err: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Don't process if response already sent
  if (res.headersSent) {
    return next(err);
  }

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, req, res);
  } else {
    let error = { ...err };
    error.message = err.message;

    // Handle specific database errors
    if (error.name === 'CastError') error = handleCastErrorDB(error);
    if (error.code && Number(error.code) === 11000) error = handleDuplicateFieldsDB(error);
    if (error.name === 'ValidationError') error = handleValidationErrorDB(error);
    
    // Handle JWT errors
    if (error.name === 'JsonWebTokenError') error = handleJWTError();
    if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();

    // Handle CouchDB specific errors
    if (error.message && error.message.includes('ECONNREFUSED')) {
      error = new AppError('Database connection failed. Please try again.', 500);
      error.type = AuthErrorType.DATABASE_ERROR;
      error.suggestions = [
        'Try again in a few minutes',
        'Check your internet connection',
        'Contact support if the problem persists'
      ];
    }

    // Handle validation errors from express-validator
    if (error.name === 'ValidationError' || (error as any).errors) {
      error = new AppError('Please check your input and try again.', 400);
      error.type = AuthErrorType.VALIDATION_ERROR;
      error.suggestions = [
        'Review the form for errors',
        'Follow the format requirements',
        'Make sure all fields are filled correctly'
      ];
    }

    sendErrorProd(error, req, res);
  }
};

// Helper function to create standardized error responses
export const createErrorResponse = (
  type: AuthErrorType,
  message: string,
  statusCode: number,
  suggestions?: string[]
) => {
  return {
    success: false,
    error: {
      type,
      message,
      code: statusCode,
      suggestions: suggestions || [],
      timestamp: new Date().toISOString(),
    },
  };
};

export { AppError };
export default errorHandler; 