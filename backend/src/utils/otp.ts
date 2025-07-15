import crypto from 'crypto';
import { config } from '../config/config';
import { OTP } from '../types';
import { logger } from './logger';

export class OTPUtils {
  // Generate OTP code
  static generateOTP(length: number = config.otp.length): string {
    const digits = '0123456789';
    let otp = '';
    
    for (let i = 0; i < length; i++) {
      otp += digits[crypto.randomInt(0, digits.length)];
    }
    
    return otp;
  }

  // Generate OTP document for database
  static createOTPDocument(
    email: string,
    purpose: 'signup' | 'password-reset' | 'email-verification'
  ): Omit<OTP, '_id' | '_rev' | 'createdAt' | 'updatedAt'> {
    const code = this.generateOTP();
    const expiresAt = new Date(Date.now() + config.otp.expiry).toISOString();

    return {
      type: 'otp',
      id: this.generateOTPId(),
      email,
      code,
      purpose,
      expiresAt,
      attempts: 0,
      verified: false,
    };
  }

  // Generate unique OTP ID
  static generateOTPId(): string {
    return `otp_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  // Verify OTP code
  static verifyOTP(storedOTP: OTP, providedCode: string): {
    isValid: boolean;
    error?: string;
  } {
    // Check if OTP is already verified
    if (storedOTP.verified) {
      return {
        isValid: false,
        error: 'OTP has already been used',
      };
    }

    // Check if OTP has expired
    if (new Date() > new Date(storedOTP.expiresAt)) {
      return {
        isValid: false,
        error: 'OTP has expired',
      };
    }

    // Check if maximum attempts exceeded
    if (storedOTP.attempts >= config.otp.maxAttempts) {
      return {
        isValid: false,
        error: 'Maximum verification attempts exceeded',
      };
    }

    // Verify the code
    if (storedOTP.code !== providedCode) {
      return {
        isValid: false,
        error: 'Invalid OTP code',
      };
    }

    return {
      isValid: true,
    };
  }

  // Check if OTP is expired
  static isExpired(otp: OTP): boolean {
    return new Date() > new Date(otp.expiresAt);
  }

  // Check if OTP can be resent (to prevent spam)
  static canResendOTP(lastOTP: OTP): boolean {
    const minResendInterval = 60 * 1000; // 1 minute
    const timeSinceLastOTP = Date.now() - new Date(lastOTP.createdAt).getTime();
    return timeSinceLastOTP >= minResendInterval;
  }

  // Generate secure random code for other purposes
  static generateSecureCode(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  // Hash sensitive data (like reset tokens)
  static hashData(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  // Validate OTP format
  static isValidOTPFormat(code: string): boolean {
    if (!code || typeof code !== 'string') {
      return false;
    }

    // Check if code contains only digits
    if (!/^\d+$/.test(code)) {
      return false;
    }

    // Check if code has correct length
    if (code.length !== config.otp.length) {
      return false;
    }

    return true;
  }

  // Clean up expired OTPs (helper for background cleanup)
  static shouldCleanupOTP(otp: OTP): boolean {
    const cleanupBuffer = 24 * 60 * 60 * 1000; // 24 hours after expiry
    const cleanupTime = new Date(otp.expiresAt).getTime() + cleanupBuffer;
    return Date.now() > cleanupTime;
  }

  // Get remaining time for OTP expiry
  static getRemainingTime(otp: OTP): number {
    const expiryTime = new Date(otp.expiresAt).getTime();
    const currentTime = Date.now();
    const remaining = expiryTime - currentTime;
    return Math.max(0, Math.floor(remaining / 1000)); // Return seconds
  }

  // Format remaining time for display
  static formatRemainingTime(seconds: number): string {
    if (seconds <= 0) {
      return 'Expired';
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${remainingSeconds}s`;
    }
  }

  // Generate OTP for testing (in development mode only)
  static generateTestOTP(): string {
    if (config.server.nodeEnv === 'development') {
      return '123456'; // Fixed OTP for testing
    }
    
    logger.warn('Attempted to generate test OTP in non-development environment');
    return this.generateOTP();
  }

  // Validate email format for OTP
  static isValidEmailForOTP(email: string): boolean {
    if (!email || typeof email !== 'string') {
      return false;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Rate limiting check for OTP generation
  static checkRateLimit(email: string, recentOTPs: OTP[]): {
    allowed: boolean;
    error?: string;
    waitTime?: number;
  } {
    // Much more permissive limits for development testing
    const maxOTPsPerHour = config.server.isDevelopment ? 1000 : 5;
    const hourInMs = config.server.isDevelopment ? 60 * 1000 : 60 * 60 * 1000; // 1 minute in dev, 1 hour in prod
    const now = Date.now();

    // Count OTPs sent in the last hour
    const recentCount = recentOTPs.filter(otp => {
      const otpTime = new Date(otp.createdAt).getTime();
      return (now - otpTime) < hourInMs;
    }).length;

    if (recentCount >= maxOTPsPerHour) {
      const oldestRecent = recentOTPs
        .filter(otp => {
          const otpTime = new Date(otp.createdAt).getTime();
          return (now - otpTime) < hourInMs;
        })
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];

      if (oldestRecent) {
        const waitTime = hourInMs - (now - new Date(oldestRecent.createdAt).getTime());

        return {
          allowed: false,
          error: 'Too many OTP requests. Please try again later.',
          waitTime: Math.ceil(waitTime / 1000), // Convert to seconds
        };
      }
    }

    return {
      allowed: true,
    };
  }

  // In development, log the OTP for testing
  static logTestOTP(email: string, otp: string, purpose: string): void {
    if (config.server.nodeEnv === 'development') {
      logger.debug('Generated OTP for testing:', { email, otp, purpose });
    }
  }
}

export default OTPUtils; 