import express, { Request, Response } from 'express';
import { authenticate, adminOnly } from '../middleware/auth';
import { cleanupUnnecessaryDatabases, listDatabaseStats } from '../scripts/cleanupDatabases';

const router = express.Router();

/**
 * Clean up unnecessary databases (Admin only)
 */
router.post('/databases', authenticate, adminOnly, async (req: Request, res: Response) => {
  try {
    console.log('🧹 Admin requested database cleanup');
    
    await cleanupUnnecessaryDatabases();
    
    res.json({
      success: true,
      message: 'Database cleanup completed successfully'
    });
  } catch (error: any) {
    console.error('Database cleanup failed:', error);
    res.status(500).json({
      success: false,
      message: 'Database cleanup failed',
      error: error.message
    });
  }
});

/**
 * List database statistics (Admin only)
 */
router.get('/databases/stats', authenticate, adminOnly, async (req: Request, res: Response) => {
  try {
    console.log('📊 Admin requested database statistics');
    
    await listDatabaseStats();
    
    res.json({
      success: true,
      message: 'Database statistics logged to console'
    });
  } catch (error: any) {
    console.error('Failed to get database stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get database statistics',
      error: error.message
    });
  }
});

export default router; 