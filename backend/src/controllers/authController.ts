import { Request, Response, NextFunction } from 'express';
import { userModel } from '../models/User';
import { otpModel } from '../models/OTP';
import { emailService } from '../services/emailService';
import { JWTUtils } from '../utils/jwt';
import { OTPUtils } from '../utils/otp';
import { AuthErrorUtil, AuthErrorType } from '../utils/authErrors';
import { logger } from '../utils/logger';
import { ApiResponse, User } from '../types';

export class AuthController {
  // User registration
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, email, password, role = 'learner' } = req.body;

      // Validate required fields
      if (!name || !email || !password) {
        return next(AuthErrorUtil.createError(AuthErrorType.REQUIRED_FIELDS_MISSING));
      }

      // Validate role
      if (!['learner', 'tutor'].includes(role)) {
        return next(AuthErrorUtil.createError(AuthErrorType.INVALID_ROLE));
      }

      // Check if user already exists
      const existingUser = await userModel.findByEmail(email);
      if (existingUser) {
        return next(AuthErrorUtil.createError(AuthErrorType.EMAIL_ALREADY_EXISTS));
      }

      // Check OTP rate limiting
      const recentOTPs = await otpModel.getRecentOTPs(email, 1);
      const rateLimitCheck = OTPUtils.checkRateLimit(email, recentOTPs);
      
      if (!rateLimitCheck.allowed) {
        return next(AuthErrorUtil.createError(AuthErrorType.OTP_RATE_LIMIT));
      }

      // Create user immediately with verified: false
      const userId = userModel.generateUserId();
      const user = await userModel.create({
        id: userId,
        name,
        email,
        password,
        role,
        type: 'user',
        verified: false, // User starts unverified
        status: 'active',
        profile: {
          bio: '',
          expertise: [],
          location: '',
          website: '',
          socialMedia: {},
        },
        preferences: {
          language: 'en',
          notifications: {
            email: true,
            push: true,
            marketing: false,
          },
          accessibility: {
            highContrast: false,
            largeText: false,
            screenReader: false,
            reducedMotion: false,
          },
        },
        refreshTokens: [], // No tokens until verified
      });

      logger.info('User created (unverified)', { userId: user.id, email: user.email });

      // Create OTP
      const otpDoc = OTPUtils.createOTPDocument(email, 'signup');
      const otp = await otpModel.create(otpDoc);

      // Send OTP email
      const emailSent = await emailService.sendOTPEmail(email, otp.code, 'signup');
      if (!emailSent) {
        // Clean up OTP if email fails, but keep the user (they can request resend)
        await otpModel.delete(otp._id!);
        return next(AuthErrorUtil.createError(AuthErrorType.OTP_SEND_FAILED));
      }

      logger.info('OTP sent for registration', { email, otpId: otp.id, userId: user.id });

      const response: ApiResponse = {
        success: true,
        message: 'Account created! Please check your email for verification code.',
        data: {
          email,
          userId: user.id,
          otpSent: true,
          expiresIn: 600, // 10 minutes
          nextStep: 'Enter the 6-digit code from your email to verify your account'
        },
      };

      res.status(201).json(response);
    } catch (error) {
      logger.error('Registration error:', error);
      next(AuthErrorUtil.createError(AuthErrorType.REGISTRATION_FAILED));
    }
  }

  // Verify OTP and activate user account
  async verifyOTP(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, otp } = req.body;

      logger.info('OTP verification request', { email });

      // Validate required fields
      if (!email || !otp) {
        return next(AuthErrorUtil.createError(AuthErrorType.REQUIRED_FIELDS_MISSING));
      }

      // Find the user (should exist since they registered)
      const user = await userModel.findByEmail(email);
      if (!user) {
        return next(AuthErrorUtil.createError(AuthErrorType.ACCOUNT_NOT_FOUND, 'Account not found. Please register first.'));
      }

      // Check if user is already verified
      if (user.verified) {
        return next(AuthErrorUtil.createError(AuthErrorType.EMAIL_ALREADY_EXISTS, 'Account already verified. You can sign in directly.'));
      }

      // Find the OTP
      const otpRecord = await otpModel.findByEmailAndPurpose(email, 'signup');
      if (!otpRecord) {
        return next(AuthErrorUtil.createError(AuthErrorType.OTP_NOT_FOUND));
      }

      // Verify the OTP
      const verification = await otpModel.verifyOTP(otpRecord._id!, otp);
      if (!verification.success) {
        // Determine specific error type
        let errorType = AuthErrorType.OTP_INVALID;
        if (verification.message.includes('expired')) {
          errorType = AuthErrorType.OTP_EXPIRED;
        } else if (verification.message.includes('attempts')) {
          errorType = AuthErrorType.OTP_RATE_LIMIT;
        }
        return next(AuthErrorUtil.createError(errorType, verification.message));
      }

      logger.info('OTP verified, activating user account', { email, userId: user.id });

      // Generate tokens for the verified user
      const tokens = JWTUtils.generateTokenPair(user);

      // Update user: set verified = true, add refresh token, set lastLogin
      const updatedUser = await userModel.update(user._id!, {
        verified: true,
        refreshTokens: [tokens.refreshToken],
        lastLogin: new Date().toISOString(),
      });

      logger.info('User account activated successfully', { 
        userId: user.id, 
        email: user.email, 
        role: user.role 
      });

      // Clean up the OTP immediately
      try {
        await otpModel.delete(otpRecord._id!);
        logger.info('OTP cleaned up successfully', { otpId: otpRecord._id });
      } catch (cleanupError) {
        logger.warn('Failed to delete OTP, will be cleaned up later', { 
          otpId: otpRecord._id, 
          error: cleanupError 
        });
      }

      // Send welcome email (async, don't block response)
      emailService.sendWelcomeEmail(user.email, user.name, user.role).catch(error => {
        logger.warn('Failed to send welcome email', { email: user.email, error });
      });

      logger.info('User registration completed successfully', { 
        userId: user.id, 
        email: user.email, 
        role: user.role 
      });

      const response: ApiResponse = {
        success: true,
        message: 'Email verified successfully! Welcome to TekRiders.',
        data: {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            verified: true,
            avatar: user.avatar,
          },
          token: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: tokens.expiresIn,
          welcomeMessage: `Welcome to TekRiders, ${user.name}! Your ${user.role} account is now active.`
        },
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('OTP verification error:', error);
      
      // Provide more specific error information in development
      if (process.env.NODE_ENV === 'development') {
        logger.error('OTP verification detailed error:', {
          error: error,
          stack: (error as Error)?.stack,
          message: (error as Error)?.message
        });
      }
      
      next(AuthErrorUtil.createError(AuthErrorType.OTP_VERIFICATION_FAILED));
    }
  }

  // Resend OTP
  async resendOTP(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = req.body;

      if (!email) {
        return next(AuthErrorUtil.createError(AuthErrorType.REQUIRED_FIELDS_MISSING, 'Email is required'));
      }

      // Find the user
      const user = await userModel.findByEmail(email);
      if (!user) {
        return next(AuthErrorUtil.createError(AuthErrorType.ACCOUNT_NOT_FOUND, 'No account found with this email. Please register first.'));
      }

      // Check if user is already verified
      if (user.verified) {
        return next(AuthErrorUtil.createError(AuthErrorType.EMAIL_ALREADY_EXISTS, 'Account already verified. You can sign in directly.'));
      }

      // Check rate limiting
      const recentOTPs = await otpModel.getRecentOTPs(email, 1);
      const rateLimitCheck = OTPUtils.checkRateLimit(email, recentOTPs);
      
      if (!rateLimitCheck.allowed) {
        return next(AuthErrorUtil.createError(AuthErrorType.OTP_RATE_LIMIT));
      }

      // Check if we can resend (1 minute cooldown)
      const lastOTP = await otpModel.findByEmailAndPurpose(email, 'signup');
      if (lastOTP && !OTPUtils.canResendOTP(lastOTP)) {
        return next(AuthErrorUtil.createError(
          AuthErrorType.OTP_RATE_LIMIT,
          'Please wait 1 minute before requesting another verification code'
        ));
      }

      // Invalidate existing OTPs
      await otpModel.invalidateOTPs(email, 'signup');

      // Create new OTP
      const otpDoc = OTPUtils.createOTPDocument(email, 'signup');
      const otp = await otpModel.create(otpDoc);

      // Send OTP email
      const emailSent = await emailService.sendOTPEmail(email, otp.code, 'signup');
      if (!emailSent) {
        await otpModel.delete(otp._id!);
        return next(AuthErrorUtil.createError(AuthErrorType.OTP_SEND_FAILED));
      }

      logger.info('OTP resent', { email, otpId: otp.id, userId: user.id });

      const response: ApiResponse = {
        success: true,
        message: 'New verification code sent to your email. Please check your inbox.',
        data: {
          email,
          userId: user.id,
          expiresIn: 600,
          tip: 'Check your spam folder if you don\'t see the email within a few minutes'
        },
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Resend OTP error:', error);
      next(AuthErrorUtil.createError(AuthErrorType.OTP_SEND_FAILED));
    }
  }

  // User login
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return next(AuthErrorUtil.createError(AuthErrorType.REQUIRED_FIELDS_MISSING, 'Email and password are required'));
      }

      // Find user by email
      const user = await userModel.findByEmail(email);
      if (!user) {
        return next(AuthErrorUtil.createError(AuthErrorType.INVALID_CREDENTIALS));
      }

      // Check if user is verified
      if (!user.verified) {
        return next(AuthErrorUtil.createError(AuthErrorType.ACCOUNT_NOT_VERIFIED));
      }

      // Check account status
      if (user.status === 'suspended') {
        return next(AuthErrorUtil.createError(AuthErrorType.ACCOUNT_SUSPENDED));
      }
      
      if (user.status === 'inactive') {
        return next(AuthErrorUtil.createError(AuthErrorType.ACCOUNT_INACTIVE));
      }

      // Verify password
      const isPasswordValid = await userModel.verifyPassword(user, password);
      if (!isPasswordValid) {
        return next(AuthErrorUtil.createError(AuthErrorType.INVALID_CREDENTIALS));
      }

      // Generate tokens
      const tokens = JWTUtils.generateTokenPair(user);
      
      // Add refresh token to user
      await userModel.addRefreshToken(user.id, tokens.refreshToken);

      // Update last login
      await userModel.updateLastLogin(user.id);

      logger.info('User logged in successfully', { userId: user.id, email: user.email });

      const response: ApiResponse = {
        success: true,
        message: `Welcome back, ${user.name}!`,
        data: {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            verified: user.verified,
            avatar: user.avatar,
          },
          token: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: tokens.expiresIn,
          loginTime: new Date().toISOString(),
        },
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Login error:', error);
      next(AuthErrorUtil.createError(AuthErrorType.LOGIN_FAILED));
    }
  }

  // Refresh token
  async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return next(AuthErrorUtil.createError(AuthErrorType.TOKEN_MISSING, 'Refresh token is required'));
      }

      // Verify refresh token
      const payload = JWTUtils.verifyRefreshToken(refreshToken);
      if (!payload) {
        return next(AuthErrorUtil.createError(AuthErrorType.REFRESH_TOKEN_INVALID));
      }

      // Find user
      const user = await userModel.findById(payload.userId);
      if (!user) {
        return next(AuthErrorUtil.createError(AuthErrorType.ACCOUNT_NOT_FOUND));
      }

      // Check if refresh token exists in user's tokens
      if (!user.refreshTokens.includes(refreshToken)) {
        return next(AuthErrorUtil.createError(AuthErrorType.REFRESH_TOKEN_INVALID));
      }

      // Generate new tokens
      const tokens = JWTUtils.generateTokenPair(user);

      // Remove old refresh token and add new one
      await userModel.removeRefreshToken(user.id, refreshToken);
      await userModel.addRefreshToken(user.id, tokens.refreshToken);

      logger.info('Token refreshed successfully', { userId: user.id });

      const response: ApiResponse = {
        success: true,
        message: 'Session refreshed successfully',
        data: {
          token: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: tokens.expiresIn,
        },
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Token refresh error:', error);
      
      // Check if it's a token expiration error
      if (error instanceof Error && error.message.includes('expired')) {
        return next(AuthErrorUtil.createError(AuthErrorType.REFRESH_TOKEN_EXPIRED));
      }
      
      next(AuthErrorUtil.createError(AuthErrorType.REFRESH_TOKEN_INVALID));
    }
  }

  // Get current user
  async getCurrentUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as User;

      const response: ApiResponse = {
        success: true,
        message: 'User information retrieved successfully',
        data: {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            verified: user.verified,
            avatar: user.avatar,
            profile: user.profile,
            preferences: user.preferences,
            lastLogin: user.lastLogin,
          },
        },
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Get current user error:', error);
      next(AuthErrorUtil.createError(AuthErrorType.SERVER_ERROR, 'Failed to retrieve user information'));
    }
  }

  // Logout
  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;
      const user = req.user as User; // May be undefined if token is expired

      // Only attempt to clear refresh tokens if we have a valid user
      if (user?.id) {
        if (refreshToken) {
          // Remove specific refresh token
          await userModel.removeRefreshToken(user.id, refreshToken);
        } else {
          // Clear all refresh tokens
          await userModel.clearRefreshTokens(user.id);
        }
        logger.info('User logged out successfully', { userId: user.id });
      } else {
        // No valid user session, but still allow logout (for expired tokens)
        logger.info('Logout requested with no valid session (expired token)');
      }

      const response: ApiResponse = {
        success: true,
        message: 'Successfully signed out. See you next time!',
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Logout error:', error);
      
      // Always succeed for logout, even if there are errors
      // This ensures the frontend can always clean up its state
      const response: ApiResponse = {
        success: true,
        message: 'Successfully signed out. See you next time!',
      };

      res.status(200).json(response);
    }
  }

  // Change password
  async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { currentPassword, newPassword } = req.body;
      const user = req.user as User;

      if (!currentPassword || !newPassword) {
        return next(AuthErrorUtil.createError(AuthErrorType.REQUIRED_FIELDS_MISSING, 'Current password and new password are required'));
      }

      // Verify current password
      const isCurrentPasswordValid = await userModel.verifyPassword(user, currentPassword);
      if (!isCurrentPasswordValid) {
        return next(AuthErrorUtil.createError(AuthErrorType.INVALID_CREDENTIALS, 'Current password is incorrect'));
      }

      // Update password (password validation is handled by the User model)
      await userModel.updatePassword(user.id, newPassword);

      logger.info('Password changed successfully', { userId: user.id });

      const response: ApiResponse = {
        success: true,
        message: 'Password changed successfully. Your account is now more secure.',
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Change password error:', error);
      
      // Check if it's a validation error
      if (error instanceof Error && error.message.includes('Password')) {
        return next(AuthErrorUtil.createError(AuthErrorType.WEAK_PASSWORD, error.message));
      }
      
      next(AuthErrorUtil.createError(AuthErrorType.SERVER_ERROR, 'Failed to change password'));
    }
  }

  // Forgot password - Send reset email
  async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = req.body;

      if (!email) {
        return next(AuthErrorUtil.createError(AuthErrorType.REQUIRED_FIELDS_MISSING, 'Email is required'));
      }

      // Find user by email
      const user = await userModel.findByEmail(email);
      if (!user) {
        // For security, don't reveal if email exists - always return success
        logger.info('Password reset requested for non-existent email', { email });
        const response: ApiResponse = {
          success: true,
          message: 'If an account with this email exists, you will receive password reset instructions.',
          data: {
            email,
            message: 'Check your email for reset instructions'
          }
        };
        res.status(200).json(response);
        return;
      }

      // Check if user account is active
      if (user.status !== 'active') {
        // Don't reveal account status - return success
        logger.info('Password reset requested for inactive account', { email, status: user.status });
        const response: ApiResponse = {
          success: true,
          message: 'If an account with this email exists, you will receive password reset instructions.',
        };
        res.status(200).json(response);
        return;
      }

      // Rate limiting check
      const recentOTPs = await otpModel.getRecentOTPs(email, 3); // Check last 3 requests
      const rateLimitCheck = OTPUtils.checkRateLimit(email, recentOTPs);
      
      if (!rateLimitCheck.allowed) {
        return next(AuthErrorUtil.createError(AuthErrorType.OTP_RATE_LIMIT, 'Too many password reset requests. Please wait before trying again.'));
      }

      // Invalidate existing password reset OTPs
      await otpModel.invalidateOTPs(email, 'password-reset');

      // Create password reset OTP
      const otpDoc = OTPUtils.createOTPDocument(email, 'password-reset');
      const otp = await otpModel.create(otpDoc);

      // Send password reset email
      const emailSent = await emailService.sendOTPEmail(email, otp.code, 'password-reset');
      if (!emailSent) {
        await otpModel.delete(otp._id!);
        return next(AuthErrorUtil.createError(AuthErrorType.OTP_SEND_FAILED, 'Failed to send password reset email. Please try again.'));
      }

      logger.info('Password reset email sent', { email, otpId: otp.id, userId: user.id });

      const response: ApiResponse = {
        success: true,
        message: 'Password reset instructions have been sent to your email.',
        data: {
          email,
          expiresIn: 600, // 10 minutes
          message: 'Check your email for a 6-digit code to reset your password'
        },
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Forgot password error:', error);
      next(AuthErrorUtil.createError(AuthErrorType.SERVER_ERROR, 'Failed to process password reset request'));
    }
  }

  // Reset password with OTP
  async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, otp, newPassword } = req.body;

      if (!email || !otp || !newPassword) {
        return next(AuthErrorUtil.createError(AuthErrorType.REQUIRED_FIELDS_MISSING, 'Email, OTP code, and new password are required'));
      }

      logger.info('Password reset attempt', { email });

      // Find the user
      const user = await userModel.findByEmail(email);
      if (!user) {
        return next(AuthErrorUtil.createError(AuthErrorType.ACCOUNT_NOT_FOUND, 'Account not found'));
      }

      // Check if user account is active
      if (user.status !== 'active') {
        return next(AuthErrorUtil.createError(AuthErrorType.ACCOUNT_INACTIVE, 'Account is not active'));
      }

      // Find the password reset OTP
      const otpRecord = await otpModel.findByEmailAndPurpose(email, 'password-reset');
      if (!otpRecord) {
        return next(AuthErrorUtil.createError(AuthErrorType.OTP_NOT_FOUND, 'Invalid or expired reset code. Please request a new password reset.'));
      }

      // Verify the OTP
      const verification = await otpModel.verifyOTP(otpRecord._id!, otp);
      if (!verification.success) {
        // Determine specific error type
        let errorType = AuthErrorType.OTP_INVALID;
        if (verification.message.includes('expired')) {
          errorType = AuthErrorType.OTP_EXPIRED;
        } else if (verification.message.includes('attempts')) {
          errorType = AuthErrorType.OTP_RATE_LIMIT;
        }
        return next(AuthErrorUtil.createError(errorType, verification.message));
      }

      logger.info('Password reset OTP verified, updating password', { email, userId: user.id });

      // Update user password
      await userModel.updatePassword(user.id, newPassword);

      // Clear all refresh tokens to force re-login
      await userModel.clearRefreshTokens(user.id);

      // Clean up the OTP
      try {
        await otpModel.delete(otpRecord._id!);
        logger.info('Password reset OTP cleaned up successfully', { otpId: otpRecord._id });
      } catch (cleanupError) {
        logger.warn('Failed to delete OTP, will be cleaned up later', { 
          otpId: otpRecord._id, 
          error: cleanupError 
        });
      }

      // Send confirmation email (async, don't block response)
      emailService.sendWelcomeEmail(user.email, user.name, user.role).catch((error: any) => {
        logger.warn('Failed to send password reset confirmation email', { email: user.email, error });
      });

      logger.info('Password reset completed successfully', { 
        userId: user.id, 
        email: user.email 
      });

      const response: ApiResponse = {
        success: true,
        message: 'Password reset successfully! You can now sign in with your new password.',
        data: {
          email: user.email,
          message: 'Your password has been updated. Please sign in with your new password.',
          nextStep: 'Sign in with your new password'
        },
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Reset password error:', error);
      
      // Check if it's a password validation error
      if (error instanceof Error && error.message.includes('Password')) {
        return next(AuthErrorUtil.createError(AuthErrorType.WEAK_PASSWORD, error.message));
      }
      
      next(AuthErrorUtil.createError(AuthErrorType.SERVER_ERROR, 'Failed to reset password'));
    }
  }

  // Development helper - Get test OTP
  async getTestOTP(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (process.env.NODE_ENV !== 'development') {
        return next(AuthErrorUtil.createError(AuthErrorType.UNAUTHORIZED, 'Test endpoints only available in development'));
      }

      const { email } = req.params;

      if (!email) {
        return next(AuthErrorUtil.createError(AuthErrorType.REQUIRED_FIELDS_MISSING, 'Email is required'));
      }

      // Find the user
      const user = await userModel.findByEmail(email);
      if (!user) {
        return next(AuthErrorUtil.createError(AuthErrorType.ACCOUNT_NOT_FOUND, 'No account found with this email'));
      }

      // Find the OTP
      const otpRecord = await otpModel.findByEmailAndPurpose(email, 'signup');
      if (!otpRecord) {
        return next(AuthErrorUtil.createError(AuthErrorType.OTP_NOT_FOUND, 'No OTP found for this email'));
      }

      const response: ApiResponse = {
        success: true,
        message: 'Test OTP retrieved successfully',
        data: {
          email,
          userId: user.id,
          otp: otpRecord.code,
          expiresAt: otpRecord.expiresAt,
          verified: user.verified,
          attempts: otpRecord.attempts,
        },
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Test OTP retrieval error:', error);
      next(AuthErrorUtil.createError(AuthErrorType.OTP_NOT_FOUND));
    }
  }

  // Development helper - Clear test user
  async clearTestUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (process.env.NODE_ENV !== 'development') {
        return next(AuthErrorUtil.createError(AuthErrorType.UNAUTHORIZED, 'Test endpoints only available in development'));
      }

      const { email } = req.params;

      if (!email) {
        return next(AuthErrorUtil.createError(AuthErrorType.REQUIRED_FIELDS_MISSING, 'Email is required'));
      }

      let deletedUser = false;
      let deletedOTPs = 0;

      // Find and delete user
      const user = await userModel.findByEmail(email);
      if (user) {
        await userModel.delete(user._id!);
        deletedUser = true;
        logger.info('Test user deleted', { email, userId: user.id });
      }

      // Find and delete all OTPs for this email
      try {
        const otpRecords = await otpModel.getRecentOTPs(email, 50); // Get many OTPs
        for (const otp of otpRecords) {
          await otpModel.delete(otp._id!);
          deletedOTPs++;
        }
        logger.info('Test OTPs deleted', { email, count: deletedOTPs });
      } catch (otpError) {
        logger.warn('Error cleaning up OTPs', { email, error: otpError });
      }

      const response: ApiResponse = {
        success: true,
        message: 'Test data cleared successfully',
        data: {
          email,
          userDeleted: deletedUser,
          otpsDeleted: deletedOTPs,
          status: deletedUser ? 'User and OTPs cleared' : 'No user found, OTPs cleared'
        },
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Test user cleanup error:', error);
      next(AuthErrorUtil.createError(AuthErrorType.SERVER_ERROR, 'Failed to clear test data'));
    }
  }
}

export const authController = new AuthController();
export default authController; 