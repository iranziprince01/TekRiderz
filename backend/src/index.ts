import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import path from 'path';
import fs from 'fs/promises';
import { config } from './config/config';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFoundHandler';
import { connectToDatabases } from './config/database';
import { authRoutes } from './routes/auth';
import { userRoutes } from './routes/users';
import courseRoutes from './routes/courses';
import { adminRoutes } from './routes/admin';
import uploadRoutes from './routes/upload';
import firebasePdfRoutes from './routes/firebasePdf';
import cleanupRoutes from './routes/cleanup';
import { cleanupService } from './services/cleanupService';


import speechRoutes from './routes/speech';
import { certificateRoutes } from './routes/certificates';
import analyticsRoutes from './routes/analytics';

import notificationRoutes from './routes/notifications';
import { apiRateLimiter, progressRateLimiter, courseRateLimiter, dynamicRateLimiter } from './middleware/rateLimiter';
import { dbUrlsRoutes } from './routes/db-urls';

const app = express();
const server = createServer(app);

// Upload directory structure removed - using external services only

// Configure CORS with specific origins
const corsOptions = {
  origin: config.cors.allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count', 'X-Rate-Limit-Remaining'],
  maxAge: 86400, // 24 hours
};

// Basic middleware
app.use(cors(corsOptions));
app.use(helmet({
  crossOriginEmbedderPolicy: false, // Allow embedding for video content
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:", "http://localhost:*", "http://127.0.0.1:*"],
      mediaSrc: ["'self'", "https:", "http://localhost:*", "http://127.0.0.1:*"],
      connectSrc: ["'self'", "http://localhost:*", "http://127.0.0.1:*"],
    },
  },
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Apply dynamic rate limiting based on environment
app.use(dynamicRateLimiter);

// Upload CORS middleware removed - no local file serving

// Static file serving removed - using external services only

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

// API Routes - Version 1
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/courses', courseRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/upload', uploadRoutes);
app.use('/api/v1/firebase-pdf', firebasePdfRoutes);
app.use('/api/v1/speech', speechRoutes);
app.use('/api/v1/certificates', certificateRoutes);
app.use('/api/v1/analytics', analyticsRoutes);

app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/cleanup', cleanupRoutes);
app.use('/api/v1/db-urls', dbUrlsRoutes);



// Rate limiting status endpoint (development only)
if (process.env.NODE_ENV === 'development') {
  app.get('/api/v1/rate-limit/status', (req, res) => {
    res.json({
      message: 'Rate limiting is active',
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString()
    });
  });
}

// Health check endpoint
app.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'TekRiders E-Learning API is running',
    timestamp: new Date().toISOString(),
    environment: config.server.nodeEnv,
    uptime: process.uptime(),
    version: '1.0.0',
    apiVersion: 'v1',
  });
});

// Integration check endpoint
app.get('/api/v1/integration-check', async (req, res) => {
  try {
    const checks = {
      database: false,
      models: false,
      routes: false,
      fileSystem: false,
      compatibility: false
    };

    // Check database
    try {
      const { databases } = await import('./config/database');
      checks.database = !!databases.users && !!databases.courses && !!databases.enrollments;
    } catch (error) {
      logger.error('Database check failed:', error);
    }

    // Check models
    try {
      const { courseModel } = await import('./models/Course');
      const { userModel } = await import('./models/User');
      checks.models = !!courseModel && !!userModel;
    } catch (error) {
      logger.error('Models check failed:', error);
    }

    // Check routes
    try {
      const courseRoutes = await import('./routes/courses');
      const adminRoutes = await import('./routes/admin');
      checks.routes = !!courseRoutes && !!adminRoutes;
    } catch (error) {
      logger.error('Routes check failed:', error);
    }

    // Check file system
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const uploadsPath = path.join(__dirname, '../uploads');
      await fs.access(uploadsPath);
      checks.fileSystem = true;
    } catch (error) {
      logger.error('File system check failed:', error);
    }

    // Check compatibility layer
    try {
      const compatibility = await import('./routes/compatibility');
      checks.compatibility = !!compatibility.normalizeCourseResponse && !!compatibility.handleCourseFormData;
    } catch (error) {
      logger.error('Compatibility check failed:', error);
    }

    const allPassed = Object.values(checks).every(check => check === true);
    const passedCount = Object.values(checks).filter(check => check === true).length;
    const totalCount = Object.keys(checks).length;

    res.json({
      status: allPassed ? 'OK' : 'PARTIAL',
      message: allPassed ? 'All integration checks passed' : 'Some integration checks failed',
      checks,
      summary: `${passedCount}/${totalCount} checks passed`,
      timestamp: new Date().toISOString(),
      ready: allPassed
    });
  } catch (error) {
    logger.error('Integration check failed:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Integration check failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      ready: false
    });
  }
});

// Debug endpoint for file system
app.get('/api/v1/debug/uploads', async (req, res) => {
  try {
    const uploadsPath = path.join(__dirname, '../uploads');
    
    const checkDirectory = async (dirPath: string): Promise<any> => {
      try {
        const stats = await fs.stat(dirPath);
        if (stats.isDirectory()) {
          const items = await fs.readdir(dirPath);
          const details = await Promise.all(
            items.map(async (item) => {
              const itemPath = path.join(dirPath, item);
              const itemStats = await fs.stat(itemPath);
              return {
                name: item,
                isDirectory: itemStats.isDirectory(),
                size: itemStats.isDirectory() ? null : itemStats.size,
                modified: itemStats.mtime.toISOString()
              };
            })
          );
          return {
            exists: true,
            isDirectory: true,
            items: details
          };
        } else {
          return {
            exists: true,
            isDirectory: false,
            size: stats.size,
            modified: stats.mtime.toISOString()
          };
        }
      } catch (error) {
        return {
          exists: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    };

    const directories = [
      'courses/thumbnails',
      'courses/videos', 
      'users/avatars',
      'lessons/materials',
      'lessons/documents',
      'documents',
      'images'
    ];

    const results: any = {
      timestamp: new Date().toISOString(),
      uploadsPath,
      baseDirectory: await checkDirectory(uploadsPath),
      subdirectories: {}
    };

    for (const dir of directories) {
      const fullPath = path.join(uploadsPath, dir);
      results.subdirectories[dir] = await checkDirectory(fullPath);
    }

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    logger.error('Debug uploads error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Debug failed'
    });
  }
});

// Backward compatibility - redirect old API paths to v1
app.use('/api/auth*', (req, res) => {
  res.redirect(301, `/api/v1${req.originalUrl.replace('/api', '')}`);
});
app.use('/api/users*', (req, res) => {
  res.redirect(301, `/api/v1${req.originalUrl.replace('/api', '')}`);
});
app.use('/api/courses*', (req, res) => {
  res.redirect(301, `/api/v1${req.originalUrl.replace('/api', '')}`);
});
app.use('/api/admin*', (req, res) => {
  res.redirect(301, `/api/v1${req.originalUrl.replace('/api', '')}`);
});
// Upload API redirects removed
app.get('/api/health', (req, res) => {
  res.redirect(301, '/api/v1/health');
});

// Error handling middleware
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    // Connect to database
    await connectToDatabases();
    logger.info('Database connected successfully');

    // Upload directory creation removed - using external services only

    // Start scheduled cleanup task
    setInterval(async () => {
      try {
        await cleanupService.performCleanup();
      } catch (error) {
        logger.error('Scheduled cleanup failed:', error);
      }
    }, 30 * 60 * 1000); // Run every 30 minutes

    // Start HTTP server
    const PORT = config.server.port;
    server.listen(PORT, () => {
      logger.info(`TekRiders E-Learning API Server running on port ${PORT}`);
      logger.info(`Environment: ${config.server.nodeEnv}`);
      logger.info(`API Base URL: http://localhost:${PORT}/api/v1`);
      logger.info(`External services: Cloudinary (images) + YouTube (videos)`);
      logger.info(`Scheduled cleanup enabled (every 30 minutes)`);
      
      if (config.server.isDevelopment) {
        logger.info(`Development mode - CORS enabled for: ${config.cors.allowedOrigins.join(', ')}`);
      }
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
startServer(); 