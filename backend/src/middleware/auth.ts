import { Request, Response, NextFunction } from 'express';
import { JWTUtils } from '../utils/jwt';
import { userModel } from '../models/User';
import { UserRole, User } from '../types';
import { AppError } from './errorHandler';
import { logger } from '../utils/logger';
import { config } from '../config/config';

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

// Authentication middleware
export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = JWTUtils.extractTokenFromHeader(authHeader);

    if (!token) {
      return next(new AppError('Access token required', 401));
    }

    if (!JWTUtils.isValidTokenFormat(token)) {
      return next(new AppError('Invalid token format', 401));
    }

    const payload = JWTUtils.verifyAccessToken(token);
    if (!payload) {
      return next(new AppError('Invalid or expired token', 401));
    }

    // Get user from database
    const user = await userModel.findById(payload.userId);
    if (!user) {
      return next(new AppError('User not found', 401));
    }

    // Check if user is active
    if (user.status !== 'active') {
      return next(new AppError('Account is not active', 401));
    }

    // Ensure user has proper id field for consistency
    if (!user.id && user._id) {
      user.id = user._id;
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    next(new AppError('Authentication failed', 401));
  }
};

// Authorization middleware for specific roles
export const authorize = (...roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    if (!roles.includes(req.user.role)) {
      return next(new AppError('Insufficient permissions', 403));
    }

    next();
  };
};

// Optional authentication (doesn't fail if no token)
export const optionalAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = JWTUtils.extractTokenFromHeader(authHeader);

    if (token && JWTUtils.isValidTokenFormat(token)) {
      const payload = JWTUtils.verifyAccessToken(token);
      if (payload) {
        const user = await userModel.findById(payload.userId);
        if (user && user.status === 'active') {
          req.user = user;
        }
      }
    }

    next();
  } catch (error) {
    // Don't fail on optional auth errors, just continue without user
    logger.warn('Optional authentication failed:', error);
    next();
  }
};

// Middleware to check if user owns the resource
export const checkOwnership = (userIdParam: string = 'userId') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    const resourceUserId = req.params[userIdParam];
    
    // Admin can access any resource
    if (req.user.role === 'admin') {
      return next();
    }

    // User can only access their own resources
    if (req.user.id !== resourceUserId) {
      return next(new AppError('Access denied', 403));
    }

    next();
  };
};

// Middleware to check if user is verified
export const requireVerified = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    return next(new AppError('Authentication required', 401));
  }

  if (!req.user.verified) {
    return next(new AppError('Email verification required', 403));
  }

  next();
};

// Middleware to extract user ID from token (for public endpoints that need user context)
export const extractUserId = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = JWTUtils.extractTokenFromHeader(authHeader);

    if (token && JWTUtils.isValidTokenFormat(token)) {
      const payload = JWTUtils.verifyAccessToken(token);
      if (payload) {
        req.user = { id: payload.userId, role: payload.role } as User;
      }
    }

    next();
  } catch (error) {
    // Don't fail, just continue without user ID
    next();
  }
};

// Admin only middleware
export const adminOnly = [authenticate, authorize('admin')];

// Tutor or Admin middleware
export const tutorOrAdmin = [authenticate, authorize('tutor', 'admin')];

// Learner or higher middleware
export const learnerOrHigher = [authenticate, authorize('learner', 'tutor', 'admin')];

// Verified users only
export const verifiedOnly = [authenticate, requireVerified];

// Check if user can access course content
export const checkCourseAccess = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    const courseId = req.params.courseId;
    if (!courseId) {
      return next(new AppError('Course ID required', 400));
    }

    // Admin can access any course
    if (req.user.role === 'admin') {
      return next();
    }

    // TODO: Check if user is enrolled in the course or is the instructor
    // This would require enrollment model which we'll implement later
    
    next();
  } catch (error) {
    logger.error('Course access check error:', error);
    next(new AppError('Failed to check course access', 500));
  }
};

// Rate limiting by user (development-aware)
export const rateLimitByUser = (
  maxRequests: number = config.server.isDevelopment ? 10000 : 100, 
  windowMs: number = config.server.isDevelopment ? 60 * 1000 : 15 * 60 * 1000
) => {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const userId = req.user?.id || req.ip || 'anonymous';
    const now = Date.now();

    // Clean up expired entries
    for (const [key, value] of requests.entries()) {
      if (now > value.resetTime) {
        requests.delete(key);
      }
    }

    const userRequests = requests.get(userId);
    
    if (!userRequests) {
      requests.set(userId, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (now > userRequests.resetTime) {
      requests.set(userId, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (userRequests.count >= maxRequests) {
      return next(new AppError('Too many requests', 429));
    }

    userRequests.count++;
    next();
  };
};

// Middleware to log user activity
export const logUserActivity = (action: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.user) {
      logger.info('User activity', {
        userId: req.user.id,
        action,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        timestamp: new Date().toISOString(),
      });
    }
    next();
  };
};

export default {
  authenticate,
  authorize,
  optionalAuth,
  checkOwnership,
  requireVerified,
  extractUserId,
  adminOnly,
  tutorOrAdmin,
  learnerOrHigher,
  verifiedOnly,
  checkCourseAccess,
  rateLimitByUser,
  logUserActivity,
}; 