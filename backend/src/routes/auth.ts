import express from 'express';
import { body } from 'express-validator';
import { authController } from '../controllers/authController';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { config } from '../config/config';
import { authRateLimiter, createRateLimiter } from '../middleware/rateLimiter';

// Create specific rate limiters for auth routes
const registerRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 3, // 3 registration attempts per 15 minutes
  message: 'Too many registration attempts, please try again later.'
});

const otpRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  maxRequests: 5, // 5 OTP attempts per 5 minutes
  message: 'Too many OTP attempts, please try again later.'
});

const loginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 login attempts per 15 minutes
  message: 'Too many login attempts, please try again later.'
});

const passwordResetRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 3, // 3 password reset attempts per 15 minutes
  message: 'Too many password reset attempts, please try again later.'
});

const router = express.Router();

// Enhanced validation with development-aware settings
const enhancedEmailValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address')
    .custom((value) => {
      // Block common temp email domains (less strict in development)
      const tempDomains = config.server.isDevelopment ? [] : [
        '10minutemail.com', 'tempmail.org', 'guerrillamail.com', 
        'mailinator.com', 'throwaway.email'
      ];
      
      const domain = value.split('@')[1];
      if (tempDomains.includes(domain)) {
        throw new Error('Temporary email addresses are not allowed');
      }
      return true;
    })
];

// Registration validation
const registerValidation = [
  body('name')
    .isLength({ min: 2, max: 100 })
    .trim()
    .withMessage('Name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Name must contain only letters and spaces'),
  
  ...enhancedEmailValidation,

  body('password')
    .isLength({ min: config.server.isDevelopment ? 3 : 8 })
    .withMessage(`Password must be at least ${config.server.isDevelopment ? 3 : 8} characters long`)
    .matches(config.server.isDevelopment ? /.*/ : /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),

  body('role')
    .optional()
    .isIn(['learner', 'tutor'])
    .withMessage('Role must be either learner or tutor'),
];

// Login validation
const loginValidation = [
  ...enhancedEmailValidation,

  body('password')
    .notEmpty()
    .withMessage('Password is required'),

  body('rememberMe')
    .optional()
    .isBoolean()
    .withMessage('Remember me must be a boolean'),
];

// OTP validation
const otpValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),

  body('otp')
    .isLength({ min: 6, max: 6 })
    .isNumeric()
    .withMessage('OTP must be a 6-digit number'),
];

// Password reset validation
const passwordResetValidation = [
  ...enhancedEmailValidation,
];

// Change password validation
const changePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),

  body('newPassword')
    .isLength({ min: config.server.isDevelopment ? 3 : 8 })
    .withMessage(`New password must be at least ${config.server.isDevelopment ? 3 : 8} characters long`)
    .matches(config.server.isDevelopment ? /.*/ : /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, and one number'),

  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Password confirmation does not match');
      }
      return true;
    }),
];

// Development rate limiting info middleware
const addRateLimitInfo = (req: any, res: any, next: any) => {
  if (config.server.isDevelopment) {
    res.set({
      'X-Dev-Mode': 'true',
      'X-Rate-Limit-Info': 'Use /api/debug/rate-limits to view current status',
      'X-Rate-Limit-Bypass': 'Add X-Rate-Limit-Bypass header or bypass-token query param',
    });
  }
  next();
};

// Public routes with specific rate limiting
router.post('/register', 
  registerRateLimiter,
  addRateLimitInfo,
  registerValidation, 
  validate,
  authController.register.bind(authController)
);

router.post('/verify-otp', 
  otpRateLimiter,
  addRateLimitInfo,
  otpValidation, 
  validate,
  authController.verifyOTP.bind(authController)
);

router.post('/resend-otp', 
  otpRateLimiter,
  addRateLimitInfo,
  enhancedEmailValidation, 
  validate,
  authController.resendOTP.bind(authController)
);

router.post('/login', 
  loginRateLimiter,
  addRateLimitInfo,
  loginValidation, 
  validate,
  authController.login.bind(authController)
);

router.post('/refresh', 
  loginRateLimiter, // Reuse login rate limiter for refresh
  addRateLimitInfo,
  authController.refreshToken.bind(authController)
);

router.post('/logout', 
  authController.logout.bind(authController)
);

// Password reset routes
router.post('/forgot-password', 
  passwordResetRateLimiter,
  addRateLimitInfo,
  passwordResetValidation, 
  validate,
  authController.forgotPassword.bind(authController)
);

router.post('/reset-password', 
  passwordResetRateLimiter,
  addRateLimitInfo,
  [
    ...enhancedEmailValidation,
    body('otp')
      .isLength({ min: 6, max: 6 })
      .isNumeric()
      .withMessage('OTP must be a 6-digit number'),
    body('newPassword')
      .isLength({ min: config.server.isDevelopment ? 3 : 8 })
      .withMessage(`New password must be at least ${config.server.isDevelopment ? 3 : 8} characters long`)
      .matches(config.server.isDevelopment ? /.*/ : /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('New password must contain at least one uppercase letter, one lowercase letter, and one number'),
  ], 
  validate,
  authController.resetPassword.bind(authController)
);

// Protected routes (no specific rate limiting needed as they use global limiter)
router.get('/me', authenticate, authController.getCurrentUser.bind(authController));

router.post('/change-password', 
  authenticate,
  changePasswordValidation, 
  validate,
  authController.changePassword.bind(authController)
);

export { router as authRoutes }; 