import { Router, Request, Response } from 'express';
import { gamificationService } from '../services/gamificationService';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

// Get gamification data for a specific course
router.get('/course/:courseId', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { courseId } = req.params;
    const userId = (req as any).user.id;

    if (!courseId) {
      res.status(400).json({
        success: false,
        message: 'Course ID is required'
      });
      return;
    }

    const gamificationData = await gamificationService.getGamificationData(userId, courseId);

    if (!gamificationData) {
      res.status(404).json({
        success: false,
        message: 'Gamification data not found'
      });
      return;
    }

    res.json({
      success: true,
      data: gamificationData
    });
  } catch (error) {
    logger.error('Failed to get gamification data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get gamification data'
    });
  }
});

// Get user's overall gamification stats across all courses
router.get('/overall', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const overallStats = await gamificationService.getUserOverallStats(userId);

    res.json({
      success: true,
      data: overallStats
    });
  } catch (error) {
    logger.error('Failed to get overall gamification stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get overall gamification stats'
    });
  }
});

// Test endpoint to verify gamification with existing data
router.get('/test-migration/:courseId', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { courseId } = req.params;
    const userId = (req as any).user.id;

    if (!courseId) {
      res.status(400).json({
        success: false,
        message: 'Course ID is required'
      });
      return;
    }

    // This will trigger migration if no gamification data exists
    const gamificationData = await gamificationService.getGamificationData(userId, courseId);

    res.json({
      success: true,
      data: gamificationData,
      message: 'Gamification data retrieved (migrated if needed)'
    });
  } catch (error) {
    logger.error('Failed to test gamification migration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test gamification migration'
    });
  }
});

// Simple test endpoint without authentication for debugging
router.get('/debug/:courseId/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { courseId, userId } = req.params;

    if (!courseId || !userId) {
      res.status(400).json({
        success: false,
        message: 'Course ID and User ID are required'
      });
      return;
    }

    // This will trigger migration if no gamification data exists
    const gamificationData = await gamificationService.getGamificationData(userId, courseId);

    res.json({
      success: true,
      data: gamificationData,
      message: 'Gamification data retrieved (migrated if needed)',
      debug: {
        courseId,
        userId,
        hasData: !!gamificationData
      }
    });
  } catch (error) {
    logger.error('Failed to debug gamification migration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to debug gamification migration',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Force migration endpoint for testing
router.post('/force-migrate/:courseId/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { courseId, userId } = req.params;

    if (!courseId || !userId) {
      res.status(400).json({
        success: false,
        message: 'Course ID and User ID are required'
      });
      return;
    }

    // Import the gamification service directly to test migration
    const { gamificationService } = await import('../services/gamificationService');
    
    // Force migration by calling the private method through reflection
    const result = await (gamificationService as any).migrateExistingProgress(userId, courseId);

    res.json({
      success: true,
      data: result,
      message: 'Force migration completed',
      debug: {
        courseId,
        userId,
        hasData: !!result
      }
    });
  } catch (error) {
    logger.error('Failed to force migrate gamification data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to force migrate gamification data',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router; 