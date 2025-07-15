import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config/config';
import { logger } from '../utils/logger';
import { AppError } from './errorHandler';

// Types for rate limiting configuration
interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  enabled?: boolean;
  skipOnError?: boolean;
  message?: string;
  keyGenerator?: (req: Request) => string;
  skip?: (req: Request, res: Response) => boolean;
  onLimitReached?: (req: Request, res: Response) => void;
}

// Enhanced rate limiting class
export class RateLimiter {
  private static instance: RateLimiter;
  private requestCounts: Map<string, { count: number; resetTime: number }> = new Map();
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = config.server.isDevelopment;
    
    // Clean up expired entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  static getInstance(): RateLimiter {
    if (!RateLimiter.instance) {
      RateLimiter.instance = new RateLimiter();
    }
    return RateLimiter.instance;
  }

  // Clean up expired entries
  private cleanup(): void {
    const now = Date.now();
    for (const [key, value] of this.requestCounts.entries()) {
      if (now > value.resetTime) {
        this.requestCounts.delete(key);
      }
    }
  }

  // Check if IP is whitelisted
  private isWhitelisted(ip: string): boolean {
    return config.rateLimit.development.whitelistedIPs.includes(ip) ||
           config.rateLimit.development.whitelistedIPs.includes('*');
  }

  // Check for bypass token
  private hasBypassToken(req: Request): boolean {
    const token = config.rateLimit.development.bypassToken;
    if (!token) return false;

    return req.headers['x-rate-limit-bypass'] === token ||
           req.query['bypass-token'] === token;
  }

  // Enhanced key generator that considers user context
  private generateKey(req: Request, prefix: string = 'default'): string {
    const user = (req as any).user;
    const userId = user?.id || 'anonymous';
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    
    return `${prefix}:${userId}:${ip}`;
  }

  // Log rate limit activity
  private logActivity(req: Request, type: string, blocked: boolean = false, remaining?: number): void {
    if (!this.isDevelopment) return;

    const shouldLog = blocked ? config.rateLimit.development.logBlocked : config.rateLimit.development.logRequests;
    if (!shouldLog) return;

    const user = (req as any).user;
    const logData = {
      type,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userId: user?.id,
      userAgent: req.get('User-Agent'),
      blocked,
      remaining,
      timestamp: new Date().toISOString(),
    };

    if (blocked) {
      logger.warn('Rate limit exceeded', logData);
    } else if (config.rateLimit.development.logRequests) {
      logger.debug('Rate limit check', logData);
    }
  }

  // Add rate limit headers
  private addHeaders(res: Response, windowMs: number, maxRequests: number, current: number): void {
    if (!config.rateLimit.development.showHeaders && !this.isDevelopment) return;

    const remaining = Math.max(0, maxRequests - current);
    const resetTime = Math.ceil((Date.now() + windowMs) / 1000);

    res.set({
      'X-RateLimit-Limit': maxRequests.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': resetTime.toString(),
      'X-RateLimit-Window': windowMs.toString(),
      'X-RateLimit-Environment': this.isDevelopment ? 'development' : 'production',
    });
  }

  // Create rate limiter with custom configuration
  public createLimiter(rateLimitConfig: RateLimitConfig, type: string = 'default') {
    // Skip if disabled globally or for this specific type
    if (!config.rateLimit.development.enabled || !rateLimitConfig.enabled) {
      return (req: Request, res: Response, next: NextFunction) => {
        this.logActivity(req, type, false);
        next();
      };
    }

    // Test mode - completely disable rate limiting
    if (config.rateLimit.development.testMode) {
      return (req: Request, res: Response, next: NextFunction) => {
        logger.debug('Rate limiting disabled in test mode');
        next();
      };
    }

    return rateLimit({
      windowMs: rateLimitConfig.windowMs,
      max: rateLimitConfig.maxRequests,
      message: rateLimitConfig.message || {
        error: `Too many ${type} requests. Please try again later.`,
        retryAfter: Math.ceil(rateLimitConfig.windowMs / 1000),
        type,
      },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: rateLimitConfig.keyGenerator || ((req: Request) => this.generateKey(req, type)),
      skip: (req: Request, res: Response) => {
        // Skip if whitelisted IP
        if (this.isWhitelisted(req.ip || '')) {
          this.logActivity(req, type, false);
          return true;
        }

        // Skip if bypass token provided
        if (this.hasBypassToken(req)) {
          this.logActivity(req, type, false);
          return true;
        }

        // Custom skip logic
        if (rateLimitConfig.skip && rateLimitConfig.skip(req, res)) {
          this.logActivity(req, type, false);
          return true;
        }

        return false;
      },
      handler: (req: Request, res: Response, next: NextFunction) => {
        this.logActivity(req, type, true);
        
        if (rateLimitConfig.onLimitReached) {
          rateLimitConfig.onLimitReached(req, res);
        }

        const error = new AppError(
          rateLimitConfig.message || `Too many ${type} requests`,
          429
        );

        next(error);
      },
    });
  }

  // Custom rate limiter for user-specific actions
  public createUserLimiter(maxRequests: number, windowMs: number, type: string = 'user-action') {
    return (req: Request, res: Response, next: NextFunction) => {
      // Skip if disabled
      if (!config.rateLimit.development.enabled || config.rateLimit.development.testMode) {
        return next();
      }

      // Skip if whitelisted or has bypass token
      if (this.isWhitelisted(req.ip || '') || this.hasBypassToken(req)) {
        return next();
      }

      const key = this.generateKey(req, type);
      const now = Date.now();

      // Clean up expired entries
      this.cleanup();

      const userRequests = this.requestCounts.get(key);
      
      if (!userRequests) {
        this.requestCounts.set(key, { count: 1, resetTime: now + windowMs });
        this.addHeaders(res, windowMs, maxRequests, 1);
        this.logActivity(req, type, false, maxRequests - 1);
        return next();
      }

      if (now > userRequests.resetTime) {
        this.requestCounts.set(key, { count: 1, resetTime: now + windowMs });
        this.addHeaders(res, windowMs, maxRequests, 1);
        this.logActivity(req, type, false, maxRequests - 1);
        return next();
      }

      if (userRequests.count >= maxRequests) {
        this.addHeaders(res, windowMs, maxRequests, userRequests.count);
        this.logActivity(req, type, true, 0);
        return next(new AppError(`Too many ${type} requests`, 429));
      }

      userRequests.count++;
      this.addHeaders(res, windowMs, maxRequests, userRequests.count);
      this.logActivity(req, type, false, maxRequests - userRequests.count);
      next();
    };
  }

  // Development helper to show current rate limit status
  public getStatus(): any {
    if (!this.isDevelopment) {
      return { message: 'Rate limit status only available in development mode' };
    }

    const now = Date.now();
    const activeEntries = Array.from(this.requestCounts.entries())
      .filter(([_, value]) => now <= value.resetTime)
      .map(([key, value]) => ({
        key,
        count: value.count,
        resetTime: new Date(value.resetTime).toISOString(),
        timeUntilReset: Math.ceil((value.resetTime - now) / 1000),
      }));

    return {
      environment: this.isDevelopment ? 'development' : 'production',
      testMode: config.rateLimit.development.testMode,
      globalEnabled: config.rateLimit.development.enabled,
      whitelistedIPs: config.rateLimit.development.whitelistedIPs,
      bypassTokenConfigured: !!config.rateLimit.development.bypassToken,
      activeEntries,
      totalActiveEntries: activeEntries.length,
      configuration: {
        global: config.rateLimit.global,
        auth: config.rateLimit.auth,
        api: config.rateLimit.api,
      },
    };
  }

  // Clear all rate limit entries (development only)
  public clearAll(): void {
    if (!this.isDevelopment) {
      logger.warn('Rate limit clearing only available in development mode');
      return;
    }

    this.requestCounts.clear();
    logger.info('All rate limit entries cleared');
  }
}

// Pre-configured rate limiters for different use cases
export const rateLimiter = RateLimiter.getInstance();

// Global API rate limiter
export const globalRateLimiter = rateLimiter.createLimiter({
  windowMs: config.rateLimit.global.windowMs,
  maxRequests: config.rateLimit.global.maxRequests,
  enabled: config.rateLimit.global.enabled,
  skipOnError: config.rateLimit.global.skipOnError,
  message: 'Too many requests from this IP, please try again later.',
}, 'global');

// Authentication rate limiters
export const loginRateLimiter = rateLimiter.createLimiter({
  windowMs: config.rateLimit.auth.login.windowMs,
  maxRequests: config.rateLimit.auth.login.maxRequests,
  enabled: config.rateLimit.auth.login.enabled,
  message: 'Too many login attempts. Please try again later.',
}, 'login');

export const registerRateLimiter = rateLimiter.createLimiter({
  windowMs: config.rateLimit.auth.register.windowMs,
  maxRequests: config.rateLimit.auth.register.maxRequests,
  enabled: config.rateLimit.auth.register.enabled,
  message: 'Too many registration attempts. Please try again later.',
}, 'register');

export const otpRateLimiter = rateLimiter.createLimiter({
  windowMs: config.rateLimit.auth.otp.windowMs,
  maxRequests: config.rateLimit.auth.otp.maxRequests,
  enabled: config.rateLimit.auth.otp.enabled,
  message: 'Too many OTP requests. Please try again later.',
}, 'otp');

export const passwordResetRateLimiter = rateLimiter.createLimiter({
  windowMs: config.rateLimit.auth.passwordReset.windowMs,
  maxRequests: config.rateLimit.auth.passwordReset.maxRequests,
  enabled: config.rateLimit.auth.passwordReset.enabled,
  message: 'Too many password reset attempts. Please try again later.',
}, 'password-reset');

// API rate limiters
export const uploadRateLimiter = rateLimiter.createLimiter({
  windowMs: config.rateLimit.api.upload.windowMs,
  maxRequests: config.rateLimit.api.upload.maxRequests,
  enabled: config.rateLimit.api.upload.enabled,
  message: 'Too many file uploads. Please try again later.',
}, 'upload');

export const coursesRateLimiter = rateLimiter.createLimiter({
  windowMs: config.rateLimit.api.courses.windowMs,
  maxRequests: config.rateLimit.api.courses.maxRequests,
  enabled: config.rateLimit.api.courses.enabled,
  message: 'Too many course operations. Please try again later.',
}, 'courses');

export const adminRateLimiter = rateLimiter.createLimiter({
  windowMs: config.rateLimit.api.admin.windowMs,
  maxRequests: config.rateLimit.api.admin.maxRequests,
  enabled: config.rateLimit.api.admin.enabled,
  message: 'Too many admin operations. Please try again later.',
}, 'admin');

export const searchRateLimiter = rateLimiter.createLimiter({
  windowMs: config.rateLimit.api.search.windowMs,
  maxRequests: config.rateLimit.api.search.maxRequests,
  enabled: config.rateLimit.api.search.enabled,
  message: 'Too many search requests. Please try again later.',
}, 'search');

// User-specific rate limiters
export const userActionRateLimiter = rateLimiter.createUserLimiter(
  config.server.isDevelopment ? 10000 : 100,
  config.server.isDevelopment ? 60 * 1000 : 15 * 60 * 1000,
  'user-action'
);

// Development helpers
export const getRateLimitStatus = () => rateLimiter.getStatus();
export const clearRateLimit = () => rateLimiter.clearAll();

export default rateLimiter; 