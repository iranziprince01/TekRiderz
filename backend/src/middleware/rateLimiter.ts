import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message?: string;
  statusCode?: number;
}

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

class RateLimiter {
  private store: RateLimitStore = {};
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = {
      ...config,
      message: config.message || 'Too many requests, please try again later.',
      statusCode: config.statusCode || 429,
      windowMs: config.windowMs || 60000, // 1 minute default
      maxRequests: config.maxRequests || 100, // 100 requests per window default
    };
  }

  middleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const key = this.getKey(req);
      const now = Date.now();

      // Clean up expired entries
      this.cleanup();

      // Get or create rate limit entry
      if (!this.store[key]) {
        this.store[key] = {
          count: 0,
          resetTime: now + this.config.windowMs
        };
      }

      const entry = this.store[key];

      // Check if window has reset
      if (now > entry.resetTime) {
        entry.count = 0;
        entry.resetTime = now + this.config.windowMs;
      }

      // Increment request count
      entry.count++;

      // Check if limit exceeded
      if (entry.count > this.config.maxRequests) {
        logger.warn('Rate limit exceeded', {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          endpoint: req.path,
          method: req.method,
          count: entry.count,
          limit: this.config.maxRequests
        });

        res.status(this.config.statusCode || 429).json({
          success: false,
          error: this.config.message,
          retryAfter: Math.ceil((entry.resetTime - now) / 1000)
        });
        return;
      }

      // Add rate limit headers
      res.set({
        'X-RateLimit-Limit': this.config.maxRequests.toString(),
        'X-RateLimit-Remaining': Math.max(0, this.config.maxRequests - entry.count).toString(),
        'X-RateLimit-Reset': new Date(entry.resetTime).toISOString()
      });

      next();
    };
  }

  private getKey(req: Request): string {
    // Use IP address as the key
    return req.ip || req.connection.remoteAddress || 'unknown';
  }

  private cleanup(): void {
    const now = Date.now();
    Object.keys(this.store).forEach(key => {
      const entry = this.store[key];
      if (entry && entry.resetTime < now) {
        delete this.store[key];
      }
    });
  }
}

// Create different rate limiters for different endpoints
export const createRateLimiter = (config: RateLimitConfig) => {
  return new RateLimiter(config).middleware();
};

// Specific rate limiters for different use cases
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 attempts per 15 minutes
  message: 'Too many authentication attempts, please try again later.'
});

export const apiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // 100 requests per minute
  message: 'Too many API requests, please slow down.'
});

export const progressRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 30, // 30 progress updates per minute
  message: 'Too many progress updates, please slow down.'
});

export const courseRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 50, // 50 course requests per minute
  message: 'Too many course requests, please slow down.'
});

// Development rate limiter (more lenient)
export const devRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 1000, // 1000 requests per minute in development
  message: 'Development rate limit exceeded.'
});

// Production rate limiter (stricter)
export const prodRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 60, // 60 requests per minute in production
  message: 'Rate limit exceeded, please try again later.'
});

// Dynamic rate limiter based on environment
export const dynamicRateLimiter = (req: Request, res: Response, next: NextFunction) => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const limiter = isDevelopment ? devRateLimiter : prodRateLimiter;
  return limiter(req, res, next);
}; 