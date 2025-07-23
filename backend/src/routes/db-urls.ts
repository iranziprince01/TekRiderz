import express from 'express';
import { authenticate } from '../middleware/auth';
import { config } from '../config/config';

const router = express.Router();

/**
 * GET /api/v1/db-urls
 * Returns pre-authenticated CouchDB URLs for the frontend
 * Requires authentication
 */
router.get('/', authenticate, async (req, res) => {
  try {
    // Get user from auth middleware
    const user = req.user;
    
    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }

    // Base CouchDB URL with credentials from config
    const couchdbUsername = config.database.username;
    const couchdbPassword = config.database.password;
    const couchdbHost = process.env.COUCHDB_HOST || 'localhost';
    const couchdbPort = process.env.COUCHDB_PORT || '5984';
    
    const baseUrl = `http://${couchdbUsername}:${couchdbPassword}@${couchdbHost}:${couchdbPort}`;
    
    // Define database URLs for different user roles
    const dbUrls: Record<string, string> = {
      users: `${baseUrl}/users`,
      courses: `${baseUrl}/courses`,
      enrollments: `${baseUrl}/enrollments`,
      progress: `${baseUrl}/progress`,
      otp: `${baseUrl}/otp`
    };

    // Role-based access control
    if (user.role === 'admin') {
      // Admin gets access to all databases
      res.json({
        success: true,
        data: dbUrls
      });
    } else if (user.role === 'tutor') {
      // Tutors get access to courses, enrollments, and progress
      const tutorUrls = {
        users: dbUrls.users,
        courses: dbUrls.courses,
        enrollments: dbUrls.enrollments,
        progress: dbUrls.progress
      };
      res.json({
        success: true,
        data: tutorUrls
      });
    } else if (user.role === 'learner') {
      // Learners get access to courses, enrollments, progress, and otp
      const learnerUrls = {
        users: dbUrls.users,
        courses: dbUrls.courses,
        enrollments: dbUrls.enrollments,
        progress: dbUrls.progress,
        otp: dbUrls.otp
      };
      res.json({
        success: true,
        data: learnerUrls
      });
    } else {
      // Unknown role - minimal access
      res.json({
        success: true,
        data: {
          users: dbUrls.users
        }
      });
    }

  } catch (error) {
    console.error('Error providing database URLs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to provide database URLs'
    });
  }
});

export { router as dbUrlsRoutes }; 