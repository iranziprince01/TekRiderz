import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { cleanupService } from '../services/cleanupService';
import { logger } from '../utils/logger';

const router = Router();

// Middleware to ensure only admins can access cleanup endpoints
const requireAdmin = (req: Request, res: Response, next: Function) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Admin access required'
    });
  }
  return next();
};

// Get cleanup statistics
router.get('/stats', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const stats = await cleanupService.getCleanupStats();
    
    res.json({
      success: true,
      data: {
        ...stats,
        lastCleanupTime: stats.lastCleanupTime ? new Date(stats.lastCleanupTime).toISOString() : null,
        nextCleanupTime: stats.nextCleanupTime ? new Date(stats.nextCleanupTime).toISOString() : null
      }
    });
  } catch (error) {
    logger.error('Failed to get cleanup stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get cleanup statistics'
    });
  }
});

// Perform manual cleanup
router.post('/perform', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { force = false } = req.body;
    
    logger.info('Manual cleanup requested:', { 
      userId: req.user?.id, 
      force,
      timestamp: new Date().toISOString()
    });

    const result = force 
      ? await cleanupService.forceCleanup()
      : await cleanupService.performCleanup();

    res.json({
      success: true,
      data: {
        ...result,
        timestamp: new Date().toISOString(),
        performedBy: req.user?.id
      }
    });
  } catch (error) {
    logger.error('Manual cleanup failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to perform cleanup'
    });
  }
});

// Force immediate cleanup (bypasses rate limiting)
router.post('/force', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    logger.info('Force cleanup requested:', { 
      userId: req.user?.id,
      timestamp: new Date().toISOString()
    });

    const result = await cleanupService.forceCleanup();

    res.json({
      success: true,
      data: {
        ...result,
        timestamp: new Date().toISOString(),
        performedBy: req.user?.id,
        forced: true
      }
    });
  } catch (error) {
    logger.error('Force cleanup failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to perform force cleanup'
    });
  }
});

export default router; 