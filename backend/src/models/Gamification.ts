import { BaseModel } from './BaseModel';
import { BaseDocument } from '../types';
import { logger } from '../utils/logger';
import { databases } from '../config/database';

// Badge types for different achievements
export type BadgeType = 
  | 'first_module' 
  | 'module_completion' 
  | 'quiz_master' 
  | 'course_completion' 
  | 'perfect_score' 
  | 'fast_learner' 
  | 'consistent_learner';

// Badge interface
export interface Badge {
  id: string;
  type: BadgeType;
  name: string;
  description: string;
  icon: string;
  points: number;
  unlockedAt?: string;
}

// Gamification data for a user-course combination
export interface Gamification extends BaseDocument {
  type: 'gamification';
  id: string;
  userId: string;
  courseId: string;
  
  // Points system
  totalPoints: number;
  pointsHistory: {
    id: string;
    points: number;
    reason: string;
    timestamp: string;
    moduleId?: string;
    quizId?: string;
  }[];
  
  // Badges system
  badges: Badge[];
  unlockedBadges: string[]; // Badge IDs that have been unlocked
  
  // Achievement tracking
  achievements: {
    modulesCompleted: number;
    quizzesPassed: number;
    perfectScores: number;
    consecutiveDays: number;
    totalTimeSpent: number; // in minutes
    lastActivityDate: string;
  };
  
  // Level system (simple)
  level: number;
  levelProgress: number; // 0-100 percentage to next level
  
  // Metadata
  firstActivityAt: string;
  lastActivityAt: string;
  streakDays: number;
  longestStreak: number;
}

export class GamificationModel extends BaseModel<Gamification> {
  constructor() {
    super(databases.progress as any, 'gamification');
  }

  // Get or create gamification record for user-course
  async getOrCreateGamification(userId: string, courseId: string): Promise<Gamification> {
    try {
      const existing = await this.findByUserAndCourse(userId, courseId);
      if (existing) {
        return existing;
      }

      // Create new gamification record
      const gamification: Omit<Gamification, '_id' | '_rev' | 'createdAt' | 'updatedAt'> = {
        type: 'gamification',
        id: `gamification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        courseId,
        totalPoints: 0,
        pointsHistory: [],
        badges: [],
        unlockedBadges: [],
        achievements: {
          modulesCompleted: 0,
          quizzesPassed: 0,
          perfectScores: 0,
          consecutiveDays: 0,
          totalTimeSpent: 0,
          lastActivityDate: new Date().toISOString()
        },
        level: 1,
        levelProgress: 0,
        firstActivityAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString(),
        streakDays: 0,
        longestStreak: 0
      };

      return await this.create(gamification);
    } catch (error) {
      logger.error('Failed to get or create gamification:', { userId, courseId, error });
      throw error;
    }
  }

  // Find gamification by user and course
  async findByUserAndCourse(userId: string, courseId: string): Promise<Gamification | null> {
    try {
      const result = await (this.db as any).query('gamification/by_user_course', {
        key: [userId, courseId],
        include_docs: true
      });

      if (result.rows.length > 0) {
        return result.rows[0].doc as Gamification;
      }

      return null;
    } catch (error) {
      logger.error('Failed to find gamification by user and course:', { userId, courseId, error });
      return null;
    }
  }

  // Award points for an action
  async awardPoints(
    userId: string, 
    courseId: string, 
    points: number, 
    reason: string, 
    moduleId?: string, 
    quizId?: string
  ): Promise<Gamification> {
    try {
      const gamification = await this.getOrCreateGamification(userId, courseId);
      
      const pointEntry = {
        id: `points_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        points,
        reason,
        timestamp: new Date().toISOString(),
        moduleId,
        quizId
      };

      const updatedPointsHistory = [...gamification.pointsHistory, pointEntry];
      const newTotalPoints = gamification.totalPoints + points;
      
      // Calculate new level and progress
      const { level, levelProgress } = this.calculateLevel(newTotalPoints);
      
      const updatedGamification = await this.update(gamification._id!, {
        totalPoints: newTotalPoints,
        pointsHistory: updatedPointsHistory,
        level,
        levelProgress,
        lastActivityAt: new Date().toISOString()
      } as Partial<Gamification>);

      logger.info('Points awarded:', {
        userId,
        courseId,
        points,
        reason,
        newTotalPoints,
        level,
        levelProgress
      });

      return updatedGamification;
    } catch (error) {
      logger.error('Failed to award points:', { userId, courseId, points, reason, error });
      throw error;
    }
  }

  // Unlock a badge
  async unlockBadge(
    userId: string, 
    courseId: string, 
    badgeType: BadgeType
  ): Promise<Gamification> {
    try {
      const gamification = await this.getOrCreateGamification(userId, courseId);
      
      // Check if badge is already unlocked
      if (gamification.unlockedBadges.includes(badgeType)) {
        return gamification;
      }

      // Get badge details
      const badgeDetails = this.getBadgeDetails(badgeType);
      
      const newBadge: Badge = {
        ...badgeDetails,
        unlockedAt: new Date().toISOString()
      };

      const updatedBadges = [...gamification.badges, newBadge];
      const updatedUnlockedBadges = [...gamification.unlockedBadges, badgeType];

      // Award points for badge
      const updatedGamification = await this.awardPoints(
        userId, 
        courseId, 
        badgeDetails.points, 
        `Badge unlocked: ${badgeDetails.name}`
      );

      // Update badges
      const finalGamification = await this.update(updatedGamification._id!, {
        badges: updatedBadges,
        unlockedBadges: updatedUnlockedBadges
      } as Partial<Gamification>);

      logger.info('Badge unlocked:', {
        userId,
        courseId,
        badgeType,
        badgeName: badgeDetails.name,
        pointsAwarded: badgeDetails.points
      });

      return finalGamification;
    } catch (error) {
      logger.error('Failed to unlock badge:', { userId, courseId, badgeType, error });
      throw error;
    }
  }

  // Update achievements
  async updateAchievements(
    userId: string,
    courseId: string,
    updates: Partial<Gamification['achievements']>
  ): Promise<Gamification> {
    try {
      const gamification = await this.getOrCreateGamification(userId, courseId);
      
      const updatedAchievements = {
        ...gamification.achievements,
        ...updates
      };

      const updatedGamification = await this.update(gamification._id!, {
        achievements: updatedAchievements,
        lastActivityAt: new Date().toISOString()
      } as Partial<Gamification>);

      logger.info('Achievements updated:', {
        userId,
        courseId,
        updates
      });

      return updatedGamification;
    } catch (error) {
      logger.error('Failed to update achievements:', { userId, courseId, updates, error });
      throw error;
    }
  }

  // Calculate level based on total points
  private calculateLevel(totalPoints: number): { level: number; levelProgress: number } {
    // Simple level calculation: every 100 points = 1 level
    const level = Math.floor(totalPoints / 100) + 1;
    const levelProgress = (totalPoints % 100);
    
    return { level, levelProgress };
  }

  // Get badge details
  private getBadgeDetails(badgeType: BadgeType): Omit<Badge, 'unlockedAt'> {
    const badgeDetails = {
      first_module: {
        id: 'first_module',
        type: 'first_module' as BadgeType,
        name: 'First Steps',
        description: 'Completed your first module',
        icon: '🎯',
        points: 10
      },
      module_completion: {
        id: 'module_completion',
        type: 'module_completion' as BadgeType,
        name: 'Module Master',
        description: 'Completed a module',
        icon: '📚',
        points: 15
      },
      quiz_master: {
        id: 'quiz_master',
        type: 'quiz_master' as BadgeType,
        name: 'Quiz Master',
        description: 'Passed a quiz or assessment',
        icon: '🧠',
        points: 20
      },
      course_completion: {
        id: 'course_completion',
        type: 'course_completion' as BadgeType,
        name: 'Course Champion',
        description: 'Completed the entire course',
        icon: '🏆',
        points: 100
      },
      perfect_score: {
        id: 'perfect_score',
        type: 'perfect_score' as BadgeType,
        name: 'Perfect Score',
        description: 'Achieved 100% on a quiz',
        icon: '⭐',
        points: 25
      },
      fast_learner: {
        id: 'fast_learner',
        type: 'fast_learner' as BadgeType,
        name: 'Fast Learner',
        description: 'Completed multiple modules quickly',
        icon: '⚡',
        points: 30
      },
      consistent_learner: {
        id: 'consistent_learner',
        type: 'consistent_learner' as BadgeType,
        name: 'Consistent Learner',
        description: 'Maintained a learning streak',
        icon: '🔥',
        points: 20
      }
    };

    return badgeDetails[badgeType];
  }

  // Get all badges for a user across all courses
  async getUserBadges(userId: string): Promise<Badge[]> {
    try {
      const result = await (this.db as any).query('gamification/by_user', {
        key: userId,
        include_docs: true
      });

      const allBadges: Badge[] = [];
      result.rows.forEach((row: any) => {
        const gamification = row.doc as Gamification;
        allBadges.push(...gamification.badges);
      });

      return allBadges;
    } catch (error) {
      logger.error('Failed to get user badges:', { userId, error });
      return [];
    }
  }

  // Get user's total points across all courses
  async getUserTotalPoints(userId: string): Promise<number> {
    try {
      const result = await (this.db as any).query('gamification/by_user', {
        key: userId,
        include_docs: true
      });

      const totalPoints = result.rows.reduce((sum: number, row: any) => {
        const gamification = row.doc as Gamification;
        return sum + gamification.totalPoints;
      }, 0);

      return totalPoints;
    } catch (error) {
      logger.error('Failed to get user total points:', { userId, error });
      return 0;
    }
  }
}

export const gamificationModel = new GamificationModel(); 