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
import { connectToDatabases } from './config/database-simplified';
import { authRoutes } from './routes/auth';
import { userRoutes } from './routes/users';
import courseRoutes from './routes/courses';
import { adminRoutes } from './routes/admin';
import { fileUploadRoutes } from './routes/fileUpload';
import { certificateRoutes } from './routes/certificates';
import syncRoutes from './routes/sync';
import { globalRateLimiter, getRateLimitStatus, clearRateLimit } from './middleware/rateLimiter';

const app = express();
const server = createServer(app);

// Create uploads directory structure
async function createUploadsStructure() {
  const uploadsPath = path.join(__dirname, '../uploads');
  const directories = [
    'courses/thumbnails',
    'courses/videos',
    'users/avatars',
    'lessons/materials',
    'lessons/documents',
    'documents',
    'images',
    'certificates'
  ];

  try {
    // Create base uploads directory
    await fs.mkdir(uploadsPath, { recursive: true });
    
    // Create subdirectories
    for (const dir of directories) {
      const fullPath = path.join(uploadsPath, dir);
      await fs.mkdir(fullPath, { recursive: true });
      logger.info(`Created uploads directory: ${dir}`);
    }
    
    logger.info('Uploads directory structure created successfully');
  } catch (error) {
    logger.error('Error creating uploads structure:', error);
  }
}

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

// Apply global rate limiting
app.use(globalRateLimiter);

// CORS middleware for uploads - must be before static middleware
app.use('/uploads', (req, res, next) => {
  // Simple and permissive CORS for uploads in development
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  next();
});

// Static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads'), {
  maxAge: '30d', // Cache for 30 days
  etag: true,
  lastModified: true,
  index: false, // Don't serve index.html files
  dotfiles: 'deny', // Deny access to dotfiles
  // Additional security headers
  setHeaders: (res, filePath, stat) => {
    // Only allow specific file types
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.pdf', '.doc', '.docx', '.txt'];
    const ext = path.extname(filePath).toLowerCase();
    
    if (allowedExtensions.includes(ext)) {
      // Security headers
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      
      // Set proper MIME types
      if (['.jpg', '.jpeg'].includes(ext)) {
        res.setHeader('Content-Type', 'image/jpeg');
      } else if (ext === '.png') {
        res.setHeader('Content-Type', 'image/png');
      } else if (ext === '.gif') {
        res.setHeader('Content-Type', 'image/gif');
      } else if (ext === '.webp') {
        res.setHeader('Content-Type', 'image/webp');
      } else if (ext === '.mp4') {
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Accept-Ranges', 'bytes'); // Enable range requests for videos
      } else if (ext === '.pdf') {
        res.setHeader('Content-Type', 'application/pdf');
      }
      
      // Add cache control based on file type
      if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
        res.setHeader('Cache-Control', 'public, max-age=2592000, immutable'); // 30 days for images
      } else if (ext === '.mp4') {
        res.setHeader('Cache-Control', 'public, max-age=604800'); // 7 days for videos
      }
    } else {
      // Reject non-allowed file types
      res.status(403).end('File type not allowed');
    }
  }
}));

// Handle 404 for uploads directory
app.use('/uploads/*', (req, res) => {
  logger.warn('File not found:', req.originalUrl);
  res.status(404).json({
    success: false,
    error: 'File not found',
    message: 'The requested file does not exist'
  });
});

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
app.use('/api/v1/upload', fileUploadRoutes);
app.use('/api/v1/certificates', certificateRoutes);
app.use('/api/v1/sync', syncRoutes);

// Rate limiting status endpoint
app.get('/api/v1/rate-limit/status', getRateLimitStatus);
app.post('/api/v1/rate-limit/clear', clearRateLimit);

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
app.use('/api/upload*', (req, res) => {
  res.redirect(301, `/api/v1${req.originalUrl.replace('/api', '')}`);
});
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

    // Create uploads directory structure
    await createUploadsStructure();

    // Start HTTP server
    const PORT = config.server.port;
    server.listen(PORT, () => {
      logger.info(`TekRiders E-Learning API Server running on port ${PORT}`);
      logger.info(`Environment: ${config.server.nodeEnv}`);
      logger.info(`API Base URL: http://localhost:${PORT}/api/v1`);
      logger.info(`Uploads served from: http://localhost:${PORT}/uploads`);
      
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