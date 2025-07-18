import { BaseModel } from './BaseModel';
import { Progress } from '../types';
import { logger } from '../utils/logger';
import { databases } from '../config/database';

export class ProgressModel extends BaseModel<Progress> {
  constructor() {
    super('progress', 'progress');
  }

  // Create progress with proper validation
  async create(progressData: Omit<Progress, '_id' | '_rev' | 'createdAt' | 'updatedAt'>): Promise<Progress> {
    try {
      const progressWithDefaults = {
        ...progressData,
        type: 'progress' as const,
        completedLessons: progressData.completedLessons || [],
        timeSpent: progressData.timeSpent || 0,
        quizScores: progressData.quizScores || {},
        assignments: progressData.assignments || {},
      };

      return await super.create(progressWithDefaults);
    } catch (error) {
      logger.error('Failed to create progress:', error);
      throw error;
    }
  }

  // Find progress by user and course
  async findByUserAndCourse(userId: string, courseId: string): Promise<Progress | null> {
    try {
      const result = await databases.progress.view('progress', 'by_user', {
        key: userId,
        include_docs: true,
      });

      const progress = result.rows.find(row => 
        row.doc && (row.doc as any).courseId === courseId
      );

      return progress ? progress.doc as Progress : null;
    } catch (error) {
      logger.error('Failed to find progress by user and course:', { userId, courseId, error });
      throw error;
    }
  }

  // Get or create progress for user and course
  async getOrCreateProgress(userId: string, courseId: string): Promise<Progress> {
    try {
      let progress = await this.findByUserAndCourse(userId, courseId);
      
      if (!progress) {
        progress = await this.create({
          type: 'progress',
          id: this.generateId(),
          userId,
          courseId,
          completedLessons: [],
          completedSections: [],
          timeSpent: 0,
          overallProgress: 0,
          sectionProgress: {},
          lessonProgress: {},
          quizScores: {},
          assignments: {},
          engagement: {
            sessionCount: 0,
            averageSessionLength: 0,
            longestSession: 0,
            totalActiveTime: 0,
            lastActiveAt: new Date().toISOString(),
            streakDays: 0,
            completionVelocity: 0,
            interactionRate: 0
          },
          achievements: {
            earnedAchievements: [],
            progressTowardsAchievements: {}
          }
        });
      }

      return progress;
    } catch (error) {
      logger.error('Failed to get or create progress:', { userId, courseId, error });
      throw error;
    }
  }

  // Update lesson completion
  async completeLesson(userId: string, courseId: string, lessonId: string): Promise<Progress> {
    try {
      const progress = await this.getOrCreateProgress(userId, courseId);
      
      if (!progress.completedLessons.includes(lessonId)) {
        const updatedLessons = [...progress.completedLessons, lessonId];
        
        return await this.update(progress._id!, {
          completedLessons: updatedLessons,
          currentLesson: lessonId,
          lastWatched: new Date().toISOString(),
        } as Partial<Progress>);
      }

      return progress;
    } catch (error) {
      logger.error('Failed to complete lesson:', { userId, courseId, lessonId, error });
      throw error;
    }
  }

  // Update time spent
  async updateTimeSpent(userId: string, courseId: string, additionalTime: number): Promise<Progress> {
    try {
      const progress = await this.getOrCreateProgress(userId, courseId);
      
      return await this.update(progress._id!, {
        timeSpent: progress.timeSpent + additionalTime,
        lastWatched: new Date().toISOString(),
      } as Partial<Progress>);
    } catch (error) {
      logger.error('Failed to update time spent:', { userId, courseId, additionalTime, error });
      throw error;
    }
  }

  // Update current lesson
  async updateCurrentLesson(userId: string, courseId: string, lessonId: string): Promise<Progress> {
    try {
      const progress = await this.getOrCreateProgress(userId, courseId);
      
      return await this.update(progress._id!, {
        currentLesson: lessonId,
        lastWatched: new Date().toISOString(),
      } as Partial<Progress>);
    } catch (error) {
      logger.error('Failed to update current lesson:', { userId, courseId, lessonId, error });
      throw error;
    }
  }

  // Update quiz score with multiple attempts and highest grade tracking
  async updateQuizScore(
    userId: string, 
    courseId: string, 
    quizId: string, 
    quizResult: {
      score: number;
      maxScore: number;
      percentage: number;
      passed: boolean;
      answers: any[];
      submittedAt: string;
    }
  ): Promise<Progress> {
    try {
      logger.info('Starting quiz score update:', {
        userId,
        courseId,
        quizId,
        score: quizResult.score,
        percentage: quizResult.percentage,
        passed: quizResult.passed
      });

      const progress = await this.getOrCreateProgress(userId, courseId);
      
      if (!progress._id) {
        throw new Error('Progress document missing _id - cannot update');
      }
      
      // Get existing quiz score data
      const existingQuizScore = progress.quizScores[quizId];
      
      // Create new attempt
      const newAttempt = {
        id: `${quizId}-${Date.now()}`,
        score: quizResult.score,
        maxScore: quizResult.maxScore,
        percentage: quizResult.percentage,
        startedAt: new Date().toISOString(),
        completedAt: quizResult.submittedAt,
        timeSpent: 0,
        answers: quizResult.answers,
      };
      
      let updatedQuizScore;
      
      if (existingQuizScore) {
        // Add new attempt to existing attempts
        const allAttempts = [...(existingQuizScore.attempts || []), newAttempt];
        const totalAttempts = (existingQuizScore.totalAttempts || 0) + 1;
        
        // Calculate best score and percentage (keep highest)
        const bestScore = Math.max(existingQuizScore.bestScore || 0, quizResult.score);
        const bestPercentage = Math.max(existingQuizScore.bestPercentage || 0, quizResult.percentage);
        const passed = existingQuizScore.passed || quizResult.passed; // Once passed, always passed
        
        updatedQuizScore = {
          attempts: allAttempts,
          bestScore,
          bestPercentage,
          totalAttempts,
          passed,
          certificationEligible: passed && bestPercentage >= 80,
        };

        logger.info('Updating existing quiz score:', {
          quizId,
          previousAttempts: existingQuizScore.totalAttempts || 0,
          newTotalAttempts: totalAttempts,
          previousBestScore: existingQuizScore.bestScore || 0,
          newBestScore: bestScore
        });
      } else {
        // First attempt
        updatedQuizScore = {
          attempts: [newAttempt],
          bestScore: quizResult.score,
          bestPercentage: quizResult.percentage,
          totalAttempts: 1,
          passed: quizResult.passed,
          certificationEligible: quizResult.passed && quizResult.percentage >= 80,
        };

        logger.info('Creating first quiz score:', {
          quizId,
          score: quizResult.score,
          percentage: quizResult.percentage,
          passed: quizResult.passed
        });
      }
      
      const updatedQuizScores = {
        ...progress.quizScores,
        [quizId]: updatedQuizScore,
      };

      // Perform the CouchDB update
      logger.info('Saving quiz scores to CouchDB:', {
        progressId: progress._id,
        userId,
        courseId,
        quizId,
        hasExistingScores: Object.keys(progress.quizScores).length > 0
      });

      const updatedProgress = await this.update(progress._id!, {
        quizScores: updatedQuizScores,
        lastWatched: new Date().toISOString(),
      } as Partial<Progress>);

      // Verify the update was successful
      if (!updatedProgress.quizScores || !updatedProgress.quizScores[quizId]) {
        throw new Error('Quiz score update verification failed - data not found in updated progress');
      }

      logger.info('Quiz score successfully saved to CouchDB:', {
        progressId: progress._id,
        userId,
        courseId,
        quizId,
        finalBestScore: updatedProgress.quizScores[quizId].bestScore,
        finalTotalAttempts: updatedProgress.quizScores[quizId].totalAttempts,
        finalPassed: updatedProgress.quizScores[quizId].passed
      });

      return updatedProgress;
    } catch (error) {
      logger.error('Failed to update quiz score in CouchDB:', { 
        userId, 
        courseId, 
        quizId, 
        quizResult, 
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack
        } : error
      });
      throw error;
    }
  }

  // Submit assignment
  async submitAssignment(
    userId: string, 
    courseId: string, 
    lessonId: string,
    grade?: number,
    feedback?: string
  ): Promise<Progress> {
    try {
      const progress = await this.getOrCreateProgress(userId, courseId);
      
      const updatedAssignments = {
        ...progress.assignments,
        [lessonId]: {
          submitted: true,
          submittedAt: new Date().toISOString(),
          grade,
          feedback,
        },
      };

      return await this.update(progress._id!, {
        assignments: updatedAssignments,
      } as Partial<Progress>);
    } catch (error) {
      logger.error('Failed to submit assignment:', { userId, courseId, lessonId, error });
      throw error;
    }
  }

  // Get user progress for multiple courses
  async getUserProgress(userId: string, options: {
    limit?: number;
    skip?: number;
  } = {}): Promise<{
    progress: Progress[];
    total: number;
  }> {
    try {
      const result = await databases.progress.view('progress', 'by_user', {
        key: userId,
        include_docs: true,
        limit: options.limit || 50,
        skip: options.skip || 0,
      });

      const progress = result.rows.map(row => row.doc as Progress);

      // Get total count
      const totalResult = await databases.progress.view('progress', 'by_user', {
        key: userId,
        include_docs: false,
      });

      return {
        progress,
        total: totalResult.rows.length,
      };
    } catch (error) {
      logger.error('Failed to get user progress:', { userId, options, error });
      throw error;
    }
  }

  // Get course progress for all users
  async getCourseProgress(courseId: string, options: {
    limit?: number;
    skip?: number;
  } = {}): Promise<{
    progress: Progress[];
    total: number;
  }> {
    try {
      const result = await databases.progress.view('progress', 'by_course', {
        key: courseId,
        include_docs: true,
        limit: options.limit || 50,
        skip: options.skip || 0,
      });

      const progress = result.rows.map(row => row.doc as Progress);

      // Get total count
      const totalResult = await databases.progress.view('progress', 'by_course', {
        key: courseId,
        include_docs: false,
      });

      return {
        progress,
        total: totalResult.rows.length,
      };
    } catch (error) {
      logger.error('Failed to get course progress:', { courseId, options, error });
      throw error;
    }
  }

  // Calculate progress percentage
  async calculateProgressPercentage(
    userId: string, 
    courseId: string, 
    totalLessons: number
  ): Promise<number> {
    try {
      const progress = await this.findByUserAndCourse(userId, courseId);
      
      if (!progress || totalLessons === 0) {
        return 0;
      }

      const completedLessons = progress.completedLessons.length;
      return Math.round((completedLessons / totalLessons) * 100);
    } catch (error) {
      logger.error('Failed to calculate progress percentage:', { userId, courseId, totalLessons, error });
      return 0;
    }
  }

  // Calculate and sync progress with enrollment
  async calculateAndSyncProgress(userId: string, courseId: string): Promise<{
    progressPercentage: number;
    completedLessons: number;
    totalLessons: number;
    isCompleted: boolean;
  }> {
    try {
      // Import here to avoid circular dependency
      const { courseModel } = await import('./Course');
      const { enrollmentModel } = await import('./Enrollment');
      
      const [progress, course, enrollment] = await Promise.all([
        this.findByUserAndCourse(userId, courseId),
        courseModel.findById(courseId),
        enrollmentModel.findByUserAndCourse(userId, courseId)
      ]);

      if (!progress || !course) {
        return {
          progressPercentage: 0,
          completedLessons: 0,
          totalLessons: 0,
          isCompleted: false
        };
      }

      // Calculate total lessons from course structure
      const totalLessons = course.totalLessons || 
        course.sections?.reduce((acc, section) => acc + section.lessons.length, 0) || 0;
      
      const completedLessons = progress.completedLessons.length;
      const progressPercentage = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
      const isCompleted = progressPercentage >= 100;

      // Update progress record with calculated percentage
      await this.update(progress._id!, {
        overallProgress: progressPercentage,
        lastWatched: new Date().toISOString(),
      } as Partial<Progress>);

      // Sync with enrollment if it exists
      if (enrollment) {
        await enrollmentModel.updateProgress(enrollment._id!, progressPercentage);
        
        logger.info('Progress synced with enrollment:', {
          userId,
          courseId,
          progressPercentage,
          completedLessons,
          totalLessons,
          isCompleted,
          enrollmentStatus: isCompleted ? 'completed' : enrollment.status
        });
      }

      return {
        progressPercentage,
        completedLessons,
        totalLessons,
        isCompleted
      };
    } catch (error) {
      logger.error('Failed to calculate and sync progress:', { userId, courseId, error });
      return {
        progressPercentage: 0,
        completedLessons: 0,
        totalLessons: 0,
        isCompleted: false
      };
    }
  }

  // Get progress statistics
  async getProgressStats(courseId?: string): Promise<{
    totalUsers: number;
    averageProgress: number;
    averageTimeSpent: number;
    completedCourses: number;
    activeUsers: number; // Users who accessed content in last 7 days
  }> {
    try {
      let progressData: Progress[];

      if (courseId) {
        // Get progress for specific course
        const result = await this.getCourseProgress(courseId, { limit: 1000 });
        progressData = result.progress;
      } else {
        // Get all progress data
        const result = await databases.progress.view('progress', 'by_user', {
          include_docs: true,
          limit: 1000,
        });
        progressData = result.rows.map(row => row.doc as Progress);
      }

      const totalUsers = progressData.length;
      const totalProgress = progressData.reduce((sum, p) => {
        // Calculate percentage based on completed lessons (simplified)
        return sum + (p.completedLessons.length * 10); // Assume 10% per lesson
      }, 0);
      const totalTimeSpent = progressData.reduce((sum, p) => sum + p.timeSpent, 0);

      const averageProgress = totalUsers > 0 ? Math.round(totalProgress / totalUsers) : 0;
      const averageTimeSpent = totalUsers > 0 ? Math.round(totalTimeSpent / totalUsers) : 0;

      // Count completed courses (100% progress)
      const completedCourses = progressData.filter(p => 
        p.completedLessons.length >= 10 // Simplified: assume 10 lessons = complete
      ).length;

      // Count active users (accessed in last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const activeUsers = progressData.filter(p => 
        p.lastWatched && new Date(p.lastWatched) > sevenDaysAgo
      ).length;

      return {
        totalUsers,
        averageProgress: Math.min(100, averageProgress),
        averageTimeSpent,
        completedCourses,
        activeUsers,
      };
    } catch (error) {
      logger.error('Failed to get progress statistics:', { courseId, error });
      throw error;
    }
  }

  // Get user learning streak (consecutive days of learning activity)
  async getUserLearningStreak(userId: string): Promise<{
    currentStreak: number;
    longestStreak: number;
    lastActivityDate: string | null;
  }> {
    try {
      // Get user progress entries
      const result = await databases.progress.view('progress', 'by_user', {
        key: userId,
        include_docs: true,
      });

      const progressEntries = result.rows.map(row => row.doc as Progress);

      if (progressEntries.length === 0) {
        return {
          currentStreak: 0,
          longestStreak: 0,
          lastActivityDate: null,
        };
      }

      // Find the most recent activity and count basic streak
      let lastActivity: string | null = null;
      let activityCount = 0;

      for (const progress of progressEntries) {
        if (progress.lastWatched) {
          activityCount++;
          if (!lastActivity || progress.lastWatched > lastActivity) {
            lastActivity = progress.lastWatched;
          }
        }
      }

      // Simple streak calculation based on recent activity
      const currentStreak = activityCount > 0 ? Math.min(activityCount, 7) : 0;
      const longestStreak = Math.min(activityCount, 30);

      return {
        currentStreak,
        longestStreak,
        lastActivityDate: lastActivity ? lastActivity.substring(0, 10) : null,
      };
    } catch (error) {
      logger.error('Failed to get user learning streak:', { userId, error });
      return {
        currentStreak: 0,
        longestStreak: 0,
        lastActivityDate: null,
      };
    }
  }

  // Enhanced video progress tracking with real-time updates
  async updateVideoProgress(
    userId: string,
    courseId: string,
    lessonId: string,
    progressData: {
      currentTime: number;
      duration: number;
      percentageWatched: number;
      watchedSegments: { start: number; end: number }[];
      playbackSpeed: number;
      quality: string;
      interactions: {
        type: 'play' | 'pause' | 'seek' | 'speed_change' | 'quality_change';
        timestamp: number;
        value?: any;
      }[];
    }
  ): Promise<Progress> {
    try {
      const progress = await this.getOrCreateProgress(userId, courseId);
      
      // Update lesson progress with detailed video tracking
      const lessonProgress = {
        ...progress.lessonProgress[lessonId],
        startedAt: progress.lessonProgress[lessonId]?.startedAt || new Date().toISOString(),
        lastPosition: progressData.currentTime,
        duration: progressData.duration,
        percentageWatched: progressData.percentageWatched,
        watchedSegments: progressData.watchedSegments,
        playbackSpeed: progressData.playbackSpeed,
        quality: progressData.quality,
        timeSpent: (progress.lessonProgress[lessonId]?.timeSpent || 0) + 1, // Increment by 1 second
        interactions: [
          ...(progress.lessonProgress[lessonId]?.interactions || []),
          ...progressData.interactions
        ],
        lastUpdated: new Date().toISOString()
      };

      // Check if lesson should be marked as completed
      const isCompleted = progressData.percentageWatched >= 80; // 80% completion threshold
      if (isCompleted && !progress.lessonProgress[lessonId]?.completedAt) {
        lessonProgress.completedAt = new Date().toISOString();
        
        // Add to completed lessons if not already there
        if (!progress.completedLessons.includes(lessonId)) {
          progress.completedLessons.push(lessonId);
        }
      }

      // Update engagement metrics
      const engagement = {
        ...progress.engagement,
        totalActiveTime: progress.engagement.totalActiveTime + 1,
        lastActiveAt: new Date().toISOString(),
        sessionCount: progress.engagement.sessionCount, // Will be updated elsewhere
        interactionRate: this.calculateInteractionRate(progress.lessonProgress)
      };

      return await this.update(progress._id!, {
        lessonProgress: {
          ...progress.lessonProgress,
          [lessonId]: lessonProgress
        },
        completedLessons: progress.completedLessons,
        engagement,
        lastWatched: new Date().toISOString(),
        overallProgress: this.calculateOverallProgress(progress.completedLessons, courseId)
      } as Partial<Progress>);
    } catch (error) {
      logger.error('Failed to update video progress:', { userId, courseId, lessonId, error });
      throw error;
    }
  }

  // Real-time lesson interaction tracking
  async recordLessonInteraction(
    userId: string,
    courseId: string,
    lessonId: string,
    interaction: {
      type: 'note' | 'bookmark' | 'highlight' | 'question' | 'pause' | 'rewind' | 'fast_forward';
      timestamp: number;
      content?: string;
      position?: number;
      duration?: number;
      data?: any;
    }
  ): Promise<void> {
    try {
      const progress = await this.getOrCreateProgress(userId, courseId);
      
      const currentLesson = progress.lessonProgress[lessonId] || {
        startedAt: new Date().toISOString(),
        timeSpent: 0,
        interactions: [],
        notes: [],
        bookmarks: []
      };

      // Add interaction to lesson progress
      currentLesson.interactions.push({
        type: interaction.type,
        timestamp: new Date().toISOString(),
        data: {
          ...interaction,
          position: interaction.position,
          duration: interaction.duration
        }
      });

      // Handle specific interaction types
      switch (interaction.type) {
        case 'note':
          if (interaction.content) {
            currentLesson.notes.push({
              id: `note_${Date.now()}`,
              timestamp: interaction.timestamp,
              content: interaction.content,
              createdAt: new Date().toISOString()
            });
          }
          break;
        case 'bookmark':
          currentLesson.bookmarks.push({
            id: `bookmark_${Date.now()}`,
            timestamp: interaction.timestamp,
            title: interaction.content || `Bookmark at ${this.formatTime(interaction.timestamp)}`,
            createdAt: new Date().toISOString()
          });
          break;
      }

      await this.update(progress._id!, {
        lessonProgress: {
          ...progress.lessonProgress,
          [lessonId]: currentLesson
        }
      } as Partial<Progress>);

      logger.debug('Lesson interaction recorded:', {
        userId,
        courseId,
        lessonId,
        interactionType: interaction.type
      });
    } catch (error) {
      logger.error('Failed to record lesson interaction:', { userId, courseId, lessonId, interaction, error });
    }
  }

  // Enhanced section completion with prerequisites checking
  async completeSection(
    userId: string,
    courseId: string,
    sectionId: string,
    completionData: {
      requiredLessons: string[];
      optionalLessons: string[];
      minimumScore?: number;
      timeSpent: number;
    }
  ): Promise<{
    sectionCompleted: boolean;
    nextSection?: string;
    courseCompleted: boolean;
    completionRate: number;
  }> {
    try {
      const progress = await this.getOrCreateProgress(userId, courseId);
      
      // Check if all required lessons are completed
      const completedRequiredLessons = completionData.requiredLessons.filter(
        lessonId => progress.completedLessons.includes(lessonId)
      );
      
      const sectionCompleted = completedRequiredLessons.length === completionData.requiredLessons.length;
      
      if (sectionCompleted) {
        // Update section progress
        const sectionProgress = {
          ...progress.sectionProgress[sectionId],
          completedLessons: [...new Set([
            ...(progress.sectionProgress[sectionId]?.completedLessons || []),
            ...completedRequiredLessons
          ])],
          progress: 100,
          timeSpent: (progress.sectionProgress[sectionId]?.timeSpent || 0) + completionData.timeSpent,
          completedAt: new Date().toISOString(),
          startedAt: progress.sectionProgress[sectionId]?.startedAt || new Date().toISOString()
        };

        // Add to completed sections
        if (!progress.completedSections.includes(sectionId)) {
          progress.completedSections.push(sectionId);
        }

        // Calculate overall progress
        const overallProgress = this.calculateOverallProgress(progress.completedLessons, courseId);

        const updatedProgress = await this.update(progress._id!, {
          completedSections: progress.completedSections,
          sectionProgress: {
            ...progress.sectionProgress,
            [sectionId]: sectionProgress
          },
          overallProgress,
          lastActiveAt: new Date().toISOString()
        } as Partial<Progress>);

        // Check if course is completed
        const courseCompleted = await this.checkCourseCompletion(userId, courseId);
        
        const nextSection = await this.getNextAvailableSection(userId, courseId, sectionId);
         
        return {
          sectionCompleted: true,
          courseCompleted,
          completionRate: overallProgress,
          ...(nextSection && { nextSection })
        };
      }

      return {
        sectionCompleted: false,
        courseCompleted: false,
        completionRate: progress.overallProgress
      };
    } catch (error) {
      logger.error('Failed to complete section:', { userId, courseId, sectionId, error });
      throw error;
    }
  }

  // Get detailed progress analytics
  async getProgressAnalytics(userId: string, courseId: string): Promise<{
    overallProgress: number;
    timeSpent: number;
    streak: number;
    averageSessionLength: number;
    completionVelocity: number;
    strongAreas: string[];
    improvementAreas: string[];
    recommendedNextSteps: string[];
    engagementScore: number;
    predictions: {
      estimatedCompletionDate: string;
      riskOfDropout: number;
      recommendedStudyTime: number;
    };
  }> {
    try {
      const progress = await this.getOrCreateProgress(userId, courseId);
      
      // Calculate engagement score
      const engagementScore = this.calculateEngagementScore(progress);
      
      // Identify strong and weak areas
      const { strongAreas, improvementAreas } = this.analyzePerformanceAreas(progress);
      
      // Generate recommendations
      const recommendedNextSteps = this.generateRecommendations(progress);
      
      // Calculate predictions
      const predictions = this.calculatePredictions(progress);

      return {
        overallProgress: progress.overallProgress,
        timeSpent: progress.timeSpent,
        streak: progress.engagement.streakDays,
        averageSessionLength: progress.engagement.averageSessionLength,
        completionVelocity: progress.engagement.completionVelocity,
        strongAreas,
        improvementAreas,
        recommendedNextSteps,
        engagementScore,
        predictions
      };
    } catch (error) {
      logger.error('Failed to get progress analytics:', { userId, courseId, error });
      throw error;
    }
  }

  // Real-time progress synchronization
  async syncProgressState(userId: string, courseId: string, clientState: any): Promise<{
    serverState: Progress;
    conflicts: any[];
    resolution: 'server_wins' | 'client_wins' | 'merged';
  }> {
    try {
      const serverProgress = await this.getOrCreateProgress(userId, courseId);
      const conflicts = [];
      let resolution: 'server_wins' | 'client_wins' | 'merged' = 'server_wins';

      // Compare timestamps to detect conflicts
      const serverLastUpdate = new Date(serverProgress.updatedAt);
      const clientLastUpdate = new Date(clientState.lastUpdated || 0);

      if (clientLastUpdate > serverLastUpdate) {
        // Client has newer data, merge carefully
        const mergedState = await this.mergeProgressStates(serverProgress, clientState);
        await this.update(serverProgress._id!, mergedState);
        resolution = 'merged';
      } else if (clientLastUpdate < serverLastUpdate) {
        // Server has newer data, return server state
        resolution = 'server_wins';
      } else {
        // Same timestamp, check for conflicts
        const detectedConflicts = this.detectProgressConflicts(serverProgress, clientState);
        if (detectedConflicts.length > 0) {
          conflicts.push(...detectedConflicts);
          resolution = 'server_wins'; // Default to server in case of conflicts
        }
      }

      return {
        serverState: serverProgress,
        conflicts,
        resolution
      };
    } catch (error) {
      logger.error('Failed to sync progress state:', { userId, courseId, error });
      throw error;
    }
  }

  // Helper methods
  private calculateInteractionRate(lessonProgress: any): number {
    const totalLessons = Object.keys(lessonProgress).length;
    if (totalLessons === 0) return 0;

    const totalInteractions = Object.values(lessonProgress).reduce(
      (sum: number, lesson: any) => sum + (lesson.interactions?.length || 0),
      0
    );

    return totalInteractions / totalLessons;
  }

  private calculateOverallProgress(completedLessons: string[], courseId: string): number {
    // This would typically fetch total lessons from course data
    // For now, return a simple calculation
    return Math.min(completedLessons.length * 10, 100); // Simplified calculation
  }

  private calculateEngagementScore(progress: Progress): number {
    const factors = {
      streakDays: Math.min(progress.engagement.streakDays * 2, 20),
      sessionCount: Math.min(progress.engagement.sessionCount, 30),
      interactionRate: Math.min(progress.engagement.interactionRate * 10, 25),
      completionVelocity: Math.min(progress.engagement.completionVelocity * 5, 25)
    };

    return Math.round(Object.values(factors).reduce((sum, score) => sum + score, 0));
  }

  private analyzePerformanceAreas(progress: Progress): {
    strongAreas: string[];
    improvementAreas: string[];
  } {
    const strongAreas = [];
    const improvementAreas = [];

    // Analyze quiz performance
    const quizScores = Object.values(progress.quizScores);
    const avgQuizScore = quizScores.reduce((sum, quiz) => sum + quiz.bestPercentage, 0) / quizScores.length;
    
    if (avgQuizScore >= 85) {
      strongAreas.push('Assessment Performance');
    } else if (avgQuizScore < 70) {
      improvementAreas.push('Assessment Performance');
    }

    // Analyze engagement
    if (progress.engagement.streakDays >= 7) {
      strongAreas.push('Consistency');
    } else if (progress.engagement.streakDays < 3) {
      improvementAreas.push('Study Consistency');
    }

    // Analyze completion velocity
    if (progress.engagement.completionVelocity >= 1) {
      strongAreas.push('Learning Pace');
    } else if (progress.engagement.completionVelocity < 0.5) {
      improvementAreas.push('Learning Pace');
    }

    return { strongAreas, improvementAreas };
  }

  private generateRecommendations(progress: Progress): string[] {
    const recommendations = [];

    // Based on engagement
    if (progress.engagement.streakDays < 3) {
      recommendations.push('Try to study at least 20 minutes daily to build consistency');
    }

    // Based on completion velocity
    if (progress.engagement.completionVelocity < 0.5) {
      recommendations.push('Consider breaking lessons into smaller chunks');
    }

    // Based on quiz performance
    const quizScores = Object.values(progress.quizScores);
    const avgQuizScore = quizScores.reduce((sum, quiz) => sum + quiz.bestPercentage, 0) / quizScores.length;
    
    if (avgQuizScore < 70) {
      recommendations.push('Review previous lessons before attempting new quizzes');
    }

    return recommendations;
  }

  private calculatePredictions(progress: Progress): {
    estimatedCompletionDate: string;
    riskOfDropout: number;
    recommendedStudyTime: number;
  } {
    const currentVelocity = progress.engagement.completionVelocity || 0.5;
    const remainingLessons = 100 - progress.overallProgress; // Simplified
    const daysToComplete = remainingLessons / currentVelocity;
    
    const estimatedCompletionDate = new Date();
    estimatedCompletionDate.setDate(estimatedCompletionDate.getDate() + daysToComplete);

    // Risk factors
    const riskFactors = {
      lowEngagement: progress.engagement.streakDays < 3 ? 30 : 0,
      slowProgress: currentVelocity < 0.5 ? 25 : 0,
      poorQuizScores: Object.values(progress.quizScores).some(q => q.bestPercentage < 60) ? 20 : 0,
      longInactivity: (Date.now() - new Date(progress.engagement.lastActiveAt).getTime()) > 7 * 24 * 60 * 60 * 1000 ? 25 : 0
    };

    const riskOfDropout = Math.min(Object.values(riskFactors).reduce((sum, risk) => sum + risk, 0), 100);

    // Recommended study time (minutes per day)
    const recommendedStudyTime = Math.max(30, Math.min(120, 60 * (1 + riskOfDropout / 100)));

    return {
      estimatedCompletionDate: estimatedCompletionDate.toISOString(),
      riskOfDropout,
      recommendedStudyTime
    };
  }

  private async mergeProgressStates(serverState: Progress, clientState: any): Promise<Partial<Progress>> {
    // Merge logic for conflicting states
    return {
      ...serverState,
      // Merge lesson progress, taking the most recent updates
      lessonProgress: {
        ...serverState.lessonProgress,
        ...clientState.lessonProgress
      },
      // Take the higher completion count
      completedLessons: [...new Set([
        ...serverState.completedLessons,
        ...(clientState.completedLessons || [])
      ])],
      // Sum up time spent
      timeSpent: Math.max(serverState.timeSpent, clientState.timeSpent || 0),
      // Take the higher overall progress
      overallProgress: Math.max(serverState.overallProgress, clientState.overallProgress || 0)
    };
  }

  private detectProgressConflicts(serverState: Progress, clientState: any): any[] {
    const conflicts = [];

    // Check for lesson completion conflicts
    const serverLessons = new Set<string>(serverState.completedLessons);
    const clientLessons = new Set<string>(clientState.completedLessons || []);
    
    const onlyInServer = Array.from(serverLessons).filter((l) => !clientLessons.has(l));
    const onlyInClient = Array.from(clientLessons).filter((l) => !serverLessons.has(l));

    if (onlyInServer.length > 0 || onlyInClient.length > 0) {
      conflicts.push({
        type: 'lesson_completion',
        serverOnly: onlyInServer,
        clientOnly: onlyInClient
      });
    }

    return conflicts;
  }

  private async checkCourseCompletion(userId: string, courseId: string): Promise<boolean> {
    // This would check against course requirements
    // For now, return false as a placeholder
    return false;
  }

  private async getNextAvailableSection(userId: string, courseId: string, currentSectionId: string): Promise<string | undefined> {
    // This would check course structure and prerequisites
    // For now, return undefined as a placeholder
    return undefined;
  }

  private formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
}

export const progressModel = new ProgressModel();
export default progressModel; 