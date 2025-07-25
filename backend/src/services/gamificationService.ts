import { gamificationModel, BadgeType, Gamification } from '../models/Gamification';
import { progressModel } from '../models/Progress';
import { logger } from '../utils/logger';

export class GamificationService {
  
  // Award points for module completion
  async awardModuleCompletion(userId: string, courseId: string, moduleId: string): Promise<void> {
    try {
      // Award points for module completion
      await gamificationModel.awardPoints(
        userId, 
        courseId, 
        15, 
        'Module completed', 
        moduleId
      );

      // Check if this is the first module (first_module badge)
      const gamification = await gamificationModel.findByUserAndCourse(userId, courseId);
      if (gamification && gamification.achievements.modulesCompleted === 0) {
        await gamificationModel.unlockBadge(userId, courseId, 'first_module');
      }

      // Unlock module_completion badge
      await gamificationModel.unlockBadge(userId, courseId, 'module_completion');

      // Update achievements
      await gamificationModel.updateAchievements(userId, courseId, {
        modulesCompleted: (gamification?.achievements.modulesCompleted || 0) + 1
      });

      logger.info('Module completion points awarded:', {
        userId,
        courseId,
        moduleId,
        points: 15
      });
    } catch (error) {
      logger.error('Failed to award module completion points:', { userId, courseId, moduleId, error });
    }
  }

  // Award points for quiz completion
  async awardQuizCompletion(
    userId: string, 
    courseId: string, 
    quizId: string, 
    score: number, 
    passed: boolean
  ): Promise<void> {
    try {
      let points = 0;
      let reason = '';

      if (passed) {
        points = 20;
        reason = 'Quiz passed';
        
        // Unlock quiz_master badge
        await gamificationModel.unlockBadge(userId, courseId, 'quiz_master');
      } else {
        points = 5;
        reason = 'Quiz attempted';
      }

      // Award points
      await gamificationModel.awardPoints(userId, courseId, points, reason, undefined, quizId);

      // Check for perfect score badge
      if (score === 100) {
        await gamificationModel.unlockBadge(userId, courseId, 'perfect_score');
      }

      // Update achievements
      const gamification = await gamificationModel.findByUserAndCourse(userId, courseId);
      if (passed) {
        await gamificationModel.updateAchievements(userId, courseId, {
          quizzesPassed: (gamification?.achievements.quizzesPassed || 0) + 1
        });
      }

      if (score === 100) {
        await gamificationModel.updateAchievements(userId, courseId, {
          perfectScores: (gamification?.achievements.perfectScores || 0) + 1
        });
      }

      logger.info('Quiz completion points awarded:', {
        userId,
        courseId,
        quizId,
        score,
        passed,
        points
      });
    } catch (error) {
      logger.error('Failed to award quiz completion points:', { userId, courseId, quizId, score, error });
    }
  }

  // Award points for course completion
  async awardCourseCompletion(userId: string, courseId: string): Promise<void> {
    try {
      // Award significant points for course completion
      await gamificationModel.awardPoints(
        userId, 
        courseId, 
        100, 
        'Course completed'
      );

      // Unlock course_completion badge
      await gamificationModel.unlockBadge(userId, courseId, 'course_completion');

      logger.info('Course completion points awarded:', {
        userId,
        courseId,
        points: 100
      });
    } catch (error) {
      logger.error('Failed to award course completion points:', { userId, courseId, error });
    }
  }

  // Award points for consistent learning (daily streak)
  async awardConsistentLearning(userId: string, courseId: string): Promise<void> {
    try {
      const gamification = await gamificationModel.findByUserAndCourse(userId, courseId);
      if (!gamification) return;

      const today = new Date().toISOString().split('T')[0];
      const lastActivity = gamification.lastActivityAt.split('T')[0];

      // Check if user has been active for consecutive days
      if (today !== lastActivity) {
        const streakDays = gamification.streakDays + 1;
        
        // Award points for maintaining streak
        if (streakDays >= 3) {
          await gamificationModel.awardPoints(
            userId, 
            courseId, 
            10, 
            `Learning streak: ${streakDays} days`
          );

          // Unlock consistent_learner badge for 7-day streak
          if (streakDays >= 7 && !gamification.unlockedBadges.includes('consistent_learner')) {
            await gamificationModel.unlockBadge(userId, courseId, 'consistent_learner');
          }
        }

        // Update streak
        await gamificationModel.update(gamification._id!, {
          streakDays,
          longestStreak: Math.max(gamification.longestStreak, streakDays),
          lastActivityAt: new Date().toISOString()
        } as any);
      }

      logger.info('Consistent learning check completed:', {
        userId,
        courseId,
        streakDays: gamification.streakDays
      });
    } catch (error) {
      logger.error('Failed to award consistent learning points:', { userId, courseId, error });
    }
  }

  // Get gamification data for a user-course combination
  async getGamificationData(userId: string, courseId: string) {
    try {
      let gamification = await gamificationModel.findByUserAndCourse(userId, courseId);
      
      // If no gamification data exists, try to migrate from existing progress
      if (!gamification) {
        gamification = await this.migrateExistingProgress(userId, courseId);
      }
      
      if (!gamification) {
        return {
          totalPoints: 0,
          level: 1,
          levelProgress: 0,
          badges: [],
          achievements: {
            modulesCompleted: 0,
            quizzesPassed: 0,
            perfectScores: 0,
            consecutiveDays: 0,
            totalTimeSpent: 0
          },
          streakDays: 0,
          longestStreak: 0
        };
      }

      return {
        totalPoints: gamification.totalPoints,
        level: gamification.level,
        levelProgress: gamification.levelProgress,
        badges: gamification.badges,
        achievements: gamification.achievements,
        streakDays: gamification.streakDays,
        longestStreak: gamification.longestStreak
      };
    } catch (error) {
      logger.error('Failed to get gamification data:', { userId, courseId, error });
      return null;
    }
  }

  // Migrate existing progress data to gamification records
  private async migrateExistingProgress(userId: string, courseId: string) {
    try {
      logger.info('Starting migration for existing progress:', { userId, courseId });
      
      // Import here to avoid circular dependency
      const { progressModel } = await import('../models/Progress');
      const { courseModel } = await import('../models/Course');
      
      // Get existing progress data
      const progress = await progressModel.findByUserAndCourse(userId, courseId);
      if (!progress) {
        logger.warn('No progress data found for migration:', { userId, courseId });
        return null;
      }

      logger.info('Found progress data:', { 
        userId, 
        courseId, 
        completedLessons: progress.completedLessons?.length || 0,
        quizScoresCount: Object.keys(progress.quizScores || {}).length
      });

      // Get course data
      const course = await courseModel.findById(courseId);
      if (!course) {
        logger.warn('No course data found for migration:', { courseId });
        return null;
      }

      logger.info('Found course data:', { 
        courseId, 
        title: course.title,
        totalLessons: course.totalLessons,
        sectionsCount: course.sections?.length || 0
      });

      // Calculate achievements from existing progress
      const completedLessons = progress.completedLessons || [];
      const quizScores = progress.quizScores || {};
      
      let totalPoints = 0;
      const badges: any[] = [];
      const unlockedBadges: string[] = [];
      
      // Award points for completed modules
      const modulesCompleted = completedLessons.length;
      if (modulesCompleted > 0) {
        totalPoints += modulesCompleted * 15;
        
        logger.info('Awarding points for completed modules:', { 
          modulesCompleted, 
          pointsAwarded: modulesCompleted * 15,
          totalPoints 
        });
        
        // Unlock first module badge
        if (modulesCompleted >= 1) {
          badges.push({
            id: 'first_module',
            type: 'first_module',
            name: 'First Steps',
            description: 'Completed your first module',
            icon: '🎯',
            points: 10,
            unlockedAt: new Date().toISOString()
          });
          unlockedBadges.push('first_module');
          totalPoints += 10;
          logger.info('Unlocked first module badge');
        }
        
        // Unlock module completion badges
        for (let i = 0; i < modulesCompleted; i++) {
          badges.push({
            id: `module_completion_${i}`,
            type: 'module_completion',
            name: 'Module Master',
            description: 'Completed a module',
            icon: '📚',
            points: 15,
            unlockedAt: new Date().toISOString()
          });
          unlockedBadges.push('module_completion');
          totalPoints += 15;
        }
        logger.info('Unlocked module completion badges:', { count: modulesCompleted });
      }
      
      // Award points for quiz completions
      let quizzesPassed = 0;
      let perfectScores = 0;
      
      Object.values(quizScores).forEach((quizScore: any) => {
        if (quizScore.bestScore && quizScore.bestScore > 0) {
          // Award points for quiz completion
          totalPoints += 20;
          quizzesPassed++;
          
          logger.info('Awarding points for quiz completion:', { 
            quizScore: quizScore.bestScore,
            percentage: quizScore.bestPercentage,
            pointsAwarded: 20,
            totalPoints 
          });
          
          // Check for perfect score
          if (quizScore.bestPercentage === 100) {
            totalPoints += 25;
            perfectScores++;
            
            badges.push({
              id: 'perfect_score',
              type: 'perfect_score',
              name: 'Perfect Score',
              description: 'Achieved 100% on a quiz',
              icon: '⭐',
              points: 25,
              unlockedAt: new Date().toISOString()
            });
            unlockedBadges.push('perfect_score');
            logger.info('Unlocked perfect score badge');
          }
          
          // Unlock quiz master badge
          badges.push({
            id: 'quiz_master',
            type: 'quiz_master',
            name: 'Quiz Master',
            description: 'Passed a quiz or assessment',
            icon: '🧠',
            points: 20,
            unlockedAt: new Date().toISOString()
          });
          unlockedBadges.push('quiz_master');
        }
      });
      
      logger.info('Quiz analysis completed:', { 
        quizzesPassed, 
        perfectScores,
        totalQuizPoints: quizzesPassed * 20 + perfectScores * 25
      });
      
      // Check for course completion
      const totalLessons = course.totalLessons || course.sections?.reduce((acc: number, section: any) => 
        acc + (section.lessons?.length || 0), 0) || 0;
      
      if (modulesCompleted >= totalLessons && totalLessons > 0) {
        totalPoints += 100;
        
        badges.push({
          id: 'course_completion',
          type: 'course_completion',
          name: 'Course Champion',
          description: 'Completed the entire course',
          icon: '🏆',
          points: 100,
          unlockedAt: new Date().toISOString()
        });
        unlockedBadges.push('course_completion');
        logger.info('Unlocked course completion badge');
      }
      
      // Calculate level
      const level = Math.floor(totalPoints / 100) + 1;
      const levelProgress = totalPoints % 100;
      
      logger.info('Final migration calculation:', { 
        totalPoints, 
        level, 
        levelProgress,
        badgesCount: badges.length,
        unlockedBadgesCount: unlockedBadges.length
      });
      
      // Create gamification record
      const gamificationData: Omit<Gamification, '_id' | '_rev' | 'createdAt' | 'updatedAt'> = {
        type: 'gamification',
        id: `gamification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        courseId,
        totalPoints,
        pointsHistory: [], // Will be populated with migration history
        badges,
        unlockedBadges,
        achievements: {
          modulesCompleted,
          quizzesPassed,
          perfectScores,
          consecutiveDays: 0, // Can't determine from existing data
          totalTimeSpent: progress.timeSpent || 0,
          lastActivityDate: progress.lastWatched || new Date().toISOString()
        },
        level,
        levelProgress,
        firstActivityAt: progress.lastWatched || new Date().toISOString(),
        lastActivityAt: progress.lastWatched || new Date().toISOString(),
        streakDays: 0, // Can't determine from existing data
        longestStreak: 0
      };
      
      // Save the migrated gamification data
      const migratedGamification = await gamificationModel.create(gamificationData);
      
      logger.info('Successfully migrated existing progress to gamification data:', {
        userId,
        courseId,
        modulesCompleted,
        quizzesPassed,
        perfectScores,
        totalPoints,
        level,
        gamificationId: migratedGamification.id
      });
      
      return migratedGamification;
    } catch (error) {
      logger.error('Failed to migrate existing progress:', { userId, courseId, error });
      return null;
    }
  }

  // Get user's overall gamification stats across all courses
  async getUserOverallStats(userId: string) {
    try {
      const totalPoints = await gamificationModel.getUserTotalPoints(userId);
      const allBadges = await gamificationModel.getUserBadges(userId);
      
      return {
        totalPoints,
        totalBadges: allBadges.length,
        badges: allBadges,
        level: Math.floor(totalPoints / 100) + 1,
        levelProgress: totalPoints % 100
      };
    } catch (error) {
      logger.error('Failed to get user overall stats:', { userId, error });
      return {
        totalPoints: 0,
        totalBadges: 0,
        badges: [],
        level: 1,
        levelProgress: 0
      };
    }
  }
}

export const gamificationService = new GamificationService(); 