import { AppError } from '../middleware/errorHandler';

// Authentication error types
export enum AuthErrorType {
  // Registration errors
  EMAIL_ALREADY_EXISTS = 'EMAIL_ALREADY_EXISTS',
  INVALID_EMAIL_FORMAT = 'INVALID_EMAIL_FORMAT',
  WEAK_PASSWORD = 'WEAK_PASSWORD',
  INVALID_ROLE = 'INVALID_ROLE',
  INVALID_NAME = 'INVALID_NAME',
  TEMP_EMAIL_BLOCKED = 'TEMP_EMAIL_BLOCKED',
  REGISTRATION_FAILED = 'REGISTRATION_FAILED',
  
  // Login errors
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  ACCOUNT_NOT_FOUND = 'ACCOUNT_NOT_FOUND',
  ACCOUNT_INACTIVE = 'ACCOUNT_INACTIVE',
  ACCOUNT_SUSPENDED = 'ACCOUNT_SUSPENDED',
  ACCOUNT_NOT_VERIFIED = 'ACCOUNT_NOT_VERIFIED',
  LOGIN_FAILED = 'LOGIN_FAILED',
  
  // OTP errors
  OTP_REQUIRED = 'OTP_REQUIRED',
  OTP_INVALID = 'OTP_INVALID',
  OTP_EXPIRED = 'OTP_EXPIRED',
  OTP_RATE_LIMIT = 'OTP_RATE_LIMIT',
  OTP_NOT_FOUND = 'OTP_NOT_FOUND',
  OTP_VERIFICATION_FAILED = 'OTP_VERIFICATION_FAILED',
  OTP_SEND_FAILED = 'OTP_SEND_FAILED',
  
  // Token errors
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  TOKEN_MISSING = 'TOKEN_MISSING',
  REFRESH_TOKEN_EXPIRED = 'REFRESH_TOKEN_EXPIRED',
  REFRESH_TOKEN_INVALID = 'REFRESH_TOKEN_INVALID',
  
  // General errors
  REQUIRED_FIELDS_MISSING = 'REQUIRED_FIELDS_MISSING',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  SERVER_ERROR = 'SERVER_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  
  // Email service errors
  EMAIL_SERVICE_UNAVAILABLE = 'EMAIL_SERVICE_UNAVAILABLE',
  EMAIL_DELIVERY_FAILED = 'EMAIL_DELIVERY_FAILED',
  
  // Database errors
  DATABASE_ERROR = 'DATABASE_ERROR',
  USER_DATA_CORRUPTED = 'USER_DATA_CORRUPTED',
}

// User-friendly error messages
export const AuthErrorMessages: Record<AuthErrorType, {
  user: string;
  technical: string;
  suggestions?: string[];
}> = {
  // Registration errors
  [AuthErrorType.EMAIL_ALREADY_EXISTS]: {
    user: 'An account with this email address already exists.',
    technical: 'User registration failed: email already exists in database',
    suggestions: [
      'Try signing in instead',
      'Use a different email address',
      'Reset your password if you forgot it'
    ]
  },
  [AuthErrorType.INVALID_EMAIL_FORMAT]: {
    user: 'Please enter a valid email address.',
    technical: 'Email format validation failed',
    suggestions: [
      'Check for typos in your email',
      'Make sure the email includes @ and domain',
      'Use a standard email format like user@domain.com'
    ]
  },
  [AuthErrorType.WEAK_PASSWORD]: {
    user: 'Password doesn\'t meet security requirements.',
    technical: 'Password validation failed: insufficient complexity',
    suggestions: [
      'Use at least 8 characters',
      'Include uppercase and lowercase letters',
      'Add numbers and special characters',
      'Avoid common words or patterns'
    ]
  },
  [AuthErrorType.INVALID_ROLE]: {
    user: 'Please select a valid role.',
    technical: 'Role validation failed: invalid role provided',
    suggestions: [
      'Choose either "Learner" or "Tutor"',
      'Contact support if you need a different role'
    ]
  },
  [AuthErrorType.INVALID_NAME]: {
    user: 'Please enter a valid name.',
    technical: 'Name validation failed: invalid characters or format',
    suggestions: [
      'Use only letters, spaces, hyphens, and apostrophes',
      'Enter your real name',
      'Ensure name is between 2 and 100 characters'
    ]
  },
  [AuthErrorType.TEMP_EMAIL_BLOCKED]: {
    user: 'Temporary email addresses are not allowed.',
    technical: 'Registration blocked: temporary email domain detected',
    suggestions: [
      'Use a permanent email address',
      'Try Gmail, Outlook, or your school/work email',
      'Contact support if you need help'
    ]
  },
  [AuthErrorType.REGISTRATION_FAILED]: {
    user: 'We couldn\'t create your account right now.',
    technical: 'User registration failed: unknown error',
    suggestions: [
      'Please try again in a few minutes',
      'Check your internet connection',
      'Contact support if the problem persists'
    ]
  },
  
  // Login errors
  [AuthErrorType.INVALID_CREDENTIALS]: {
    user: 'Invalid email or password.',
    technical: 'Login failed: credentials do not match',
    suggestions: [
      'Check your email and password',
      'Try resetting your password',
      'Make sure Caps Lock is off'
    ]
  },
  [AuthErrorType.ACCOUNT_NOT_FOUND]: {
    user: 'No account found with this email address.',
    technical: 'Login failed: user not found in database',
    suggestions: [
      'Check your email for typos',
      'Try creating a new account',
      'Contact support if you think this is an error'
    ]
  },
  [AuthErrorType.ACCOUNT_INACTIVE]: {
    user: 'Your account is inactive.',
    technical: 'Login blocked: account status is inactive',
    suggestions: [
      'Complete your email verification',
      'Check your email for activation instructions',
      'Contact support for help'
    ]
  },
  [AuthErrorType.ACCOUNT_SUSPENDED]: {
    user: 'Your account has been suspended.',
    technical: 'Login blocked: account is suspended',
    suggestions: [
      'Contact support for more information',
      'Review our terms of service',
      'Appeal the suspension if needed'
    ]
  },
  [AuthErrorType.ACCOUNT_NOT_VERIFIED]: {
    user: 'Please verify your email address first.',
    technical: 'Login blocked: account not verified',
    suggestions: [
      'Check your email for verification link',
      'Request a new verification email',
      'Check your spam folder'
    ]
  },
  [AuthErrorType.LOGIN_FAILED]: {
    user: 'Sign in failed. Please try again.',
    technical: 'Login process failed: unknown error',
    suggestions: [
      'Check your internet connection',
      'Try again in a few minutes',
      'Contact support if the problem persists'
    ]
  },
  
  // OTP errors
  [AuthErrorType.OTP_REQUIRED]: {
    user: 'Please enter the verification code.',
    technical: 'OTP validation failed: code not provided',
    suggestions: [
      'Enter the 6-digit code from your email',
      'Check your email for the verification code',
      'Request a new code if needed'
    ]
  },
  [AuthErrorType.OTP_INVALID]: {
    user: 'Invalid verification code.',
    technical: 'OTP validation failed: incorrect code',
    suggestions: [
      'Double-check the code from your email',
      'Make sure to enter all 6 digits',
      'Request a new code if this one expired'
    ]
  },
  [AuthErrorType.OTP_EXPIRED]: {
    user: 'Verification code has expired.',
    technical: 'OTP validation failed: code expired',
    suggestions: [
      'Request a new verification code',
      'Check your email for the latest code',
      'Codes expire after 10 minutes'
    ]
  },
  [AuthErrorType.OTP_RATE_LIMIT]: {
    user: 'Too many verification attempts. Please wait before trying again.',
    technical: 'OTP blocked: rate limit exceeded',
    suggestions: [
      'Wait 15 minutes before requesting another code',
      'Make sure you\'re entering the correct code',
      'Contact support if you need help'
    ]
  },
  [AuthErrorType.OTP_NOT_FOUND]: {
    user: 'No verification code found for this email.',
    technical: 'OTP validation failed: no valid OTP found',
    suggestions: [
      'Request a new verification code',
      'Make sure you\'re using the correct email',
      'Start the registration process again'
    ]
  },
  [AuthErrorType.OTP_VERIFICATION_FAILED]: {
    user: 'Email verification failed.',
    technical: 'OTP verification process failed',
    suggestions: [
      'Try the verification process again',
      'Request a new verification code',
      'Contact support if the problem persists'
    ]
  },
  [AuthErrorType.OTP_SEND_FAILED]: {
    user: 'Couldn\'t send verification email.',
    technical: 'Email service failed to send OTP',
    suggestions: [
      'Check your email address for typos',
      'Try again in a few minutes',
      'Contact support if emails aren\'t arriving'
    ]
  },
  
  // Token errors
  [AuthErrorType.TOKEN_EXPIRED]: {
    user: 'Your session has expired. Please sign in again.',
    technical: 'Authentication failed: JWT token expired',
    suggestions: [
      'Sign in again to continue',
      'Use "Remember me" for longer sessions',
      'Your session expires after 15 minutes of inactivity'
    ]
  },
  [AuthErrorType.TOKEN_INVALID]: {
    user: 'Invalid session. Please sign in again.',
    technical: 'Authentication failed: JWT token invalid',
    suggestions: [
      'Sign in again to get a new session',
      'Clear your browser data if problems persist',
      'Contact support if you keep getting signed out'
    ]
  },
  [AuthErrorType.TOKEN_MISSING]: {
    user: 'Please sign in to continue.',
    technical: 'Authentication failed: no token provided',
    suggestions: [
      'Sign in to access this feature',
      'Check if you\'re still logged in',
      'Enable cookies in your browser'
    ]
  },
  [AuthErrorType.REFRESH_TOKEN_EXPIRED]: {
    user: 'Your session has expired. Please sign in again.',
    technical: 'Token refresh failed: refresh token expired',
    suggestions: [
      'Sign in again to continue',
      'Sessions expire after 7 days of inactivity',
      'Use "Remember me" for longer sessions'
    ]
  },
  [AuthErrorType.REFRESH_TOKEN_INVALID]: {
    user: 'Session error. Please sign in again.',
    technical: 'Token refresh failed: invalid refresh token',
    suggestions: [
      'Sign in again to get a new session',
      'Clear your browser data if problems persist',
      'Contact support if issues continue'
    ]
  },
  
  // General errors
  [AuthErrorType.REQUIRED_FIELDS_MISSING]: {
    user: 'Please fill in all required fields.',
    technical: 'Validation failed: required fields missing',
    suggestions: [
      'Complete all fields marked with *',
      'Make sure no fields are empty',
      'Check form validation messages'
    ]
  },
  [AuthErrorType.RATE_LIMIT_EXCEEDED]: {
    user: 'Too many attempts. Please wait before trying again.',
    technical: 'Rate limit exceeded: too many requests',
    suggestions: [
      'Wait 15 minutes before trying again',
      'Avoid rapid successive attempts',
      'Contact support if you need immediate access'
    ]
  },
  [AuthErrorType.SERVER_ERROR]: {
    user: 'Something went wrong on our end. Please try again.',
    technical: 'Internal server error occurred',
    suggestions: [
      'Try again in a few minutes',
      'Check if the service is operational',
      'Contact support if the problem persists'
    ]
  },
  [AuthErrorType.VALIDATION_ERROR]: {
    user: 'Please check your information and try again.',
    technical: 'Input validation failed',
    suggestions: [
      'Review the form for errors',
      'Follow the format requirements',
      'Make sure all fields are filled correctly'
    ]
  },
  [AuthErrorType.UNAUTHORIZED]: {
    user: 'You don\'t have permission to access this.',
    technical: 'Authorization failed: insufficient permissions',
    suggestions: [
      'Sign in with the correct account',
      'Contact an administrator for access',
      'Check if your account has the required permissions'
    ]
  },
  [AuthErrorType.FORBIDDEN]: {
    user: 'Access denied.',
    technical: 'Authorization failed: action forbidden',
    suggestions: [
      'Make sure you have the required permissions',
      'Contact support if you believe this is an error',
      'Check if your account is in good standing'
    ]
  },
  
  // Email service errors
  [AuthErrorType.EMAIL_SERVICE_UNAVAILABLE]: {
    user: 'Email service is temporarily unavailable.',
    technical: 'Email service connection failed',
    suggestions: [
      'Try again in a few minutes',
      'Check your email address is correct',
      'Contact support if emails aren\'t arriving'
    ]
  },
  [AuthErrorType.EMAIL_DELIVERY_FAILED]: {
    user: 'Couldn\'t deliver email to your address.',
    technical: 'Email delivery failed: recipient unreachable',
    suggestions: [
      'Check your email address for typos',
      'Make sure your email isn\'t full',
      'Check your spam folder'
    ]
  },
  
  // Database errors
  [AuthErrorType.DATABASE_ERROR]: {
    user: 'Database temporarily unavailable. Please try again.',
    technical: 'Database operation failed',
    suggestions: [
      'Try again in a few minutes',
      'Check your internet connection',
      'Contact support if the problem persists'
    ]
  },
  [AuthErrorType.USER_DATA_CORRUPTED]: {
    user: 'Account data issue. Please contact support.',
    technical: 'User data integrity check failed',
    suggestions: [
      'Contact support immediately',
      'Do not attempt to fix this yourself',
      'Provide your account email for assistance'
    ]
  },
};

// Enhanced error creation utility
export class AuthErrorUtil {
  static createError(
    type: AuthErrorType,
    additionalInfo?: string,
    statusCode?: number
  ): AppError {
    const errorInfo = AuthErrorMessages[type];
    const message = additionalInfo || errorInfo.user;
    
    // Determine appropriate status code
    const defaultStatusCode = AuthErrorUtil.getDefaultStatusCode(type);
    const finalStatusCode = statusCode || defaultStatusCode;
    
    const error = new AppError(message, finalStatusCode);
    
    // Add additional properties for better error handling
    (error as any).type = type;
    (error as any).suggestions = errorInfo.suggestions || [];
    (error as any).technical = errorInfo.technical;
    
    return error;
  }
  
  static getDefaultStatusCode(type: AuthErrorType): number {
    switch (type) {
      case AuthErrorType.EMAIL_ALREADY_EXISTS:
        return 409; // Conflict
      
      case AuthErrorType.INVALID_CREDENTIALS:
      case AuthErrorType.ACCOUNT_NOT_FOUND:
      case AuthErrorType.TOKEN_EXPIRED:
      case AuthErrorType.TOKEN_INVALID:
      case AuthErrorType.TOKEN_MISSING:
      case AuthErrorType.REFRESH_TOKEN_EXPIRED:
      case AuthErrorType.REFRESH_TOKEN_INVALID:
      case AuthErrorType.UNAUTHORIZED:
        return 401; // Unauthorized
      
      case AuthErrorType.ACCOUNT_INACTIVE:
      case AuthErrorType.ACCOUNT_SUSPENDED:
      case AuthErrorType.ACCOUNT_NOT_VERIFIED:
      case AuthErrorType.FORBIDDEN:
        return 403; // Forbidden
      
      case AuthErrorType.OTP_NOT_FOUND:
        return 404; // Not Found
      
      case AuthErrorType.OTP_RATE_LIMIT:
      case AuthErrorType.RATE_LIMIT_EXCEEDED:
        return 429; // Too Many Requests
      
      case AuthErrorType.INVALID_EMAIL_FORMAT:
      case AuthErrorType.WEAK_PASSWORD:
      case AuthErrorType.INVALID_ROLE:
      case AuthErrorType.INVALID_NAME:
      case AuthErrorType.TEMP_EMAIL_BLOCKED:
      case AuthErrorType.OTP_REQUIRED:
      case AuthErrorType.OTP_INVALID:
      case AuthErrorType.OTP_EXPIRED:
      case AuthErrorType.REQUIRED_FIELDS_MISSING:
      case AuthErrorType.VALIDATION_ERROR:
        return 400; // Bad Request
      
      case AuthErrorType.REGISTRATION_FAILED:
      case AuthErrorType.LOGIN_FAILED:
      case AuthErrorType.OTP_VERIFICATION_FAILED:
      case AuthErrorType.OTP_SEND_FAILED:
      case AuthErrorType.SERVER_ERROR:
      case AuthErrorType.EMAIL_SERVICE_UNAVAILABLE:
      case AuthErrorType.EMAIL_DELIVERY_FAILED:
      case AuthErrorType.DATABASE_ERROR:
      case AuthErrorType.USER_DATA_CORRUPTED:
        return 500; // Internal Server Error
      
      default:
        return 500;
    }
  }
  
  static isRetryableError(type: AuthErrorType): boolean {
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
  }
  
  static getRetryDelay(type: AuthErrorType): number {
    if (type === AuthErrorType.RATE_LIMIT_EXCEEDED || type === AuthErrorType.OTP_RATE_LIMIT) {
      return 15 * 60 * 1000; // 15 minutes
    }
    
    if (AuthErrorUtil.isRetryableError(type)) {
      return 5 * 60 * 1000; // 5 minutes
    }
    
    return 0; // No retry
  }
}

// Export for use in other modules
export default AuthErrorUtil; 