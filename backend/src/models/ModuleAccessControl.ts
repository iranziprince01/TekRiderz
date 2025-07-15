import { BaseModel } from './BaseModel';
import { Course, CourseSection, CourseLesson, Progress } from '../types';
import { logger } from '../utils/logger';
import { courseModel } from './Course';
import { progressModel } from './Progress';

interface AccessRule {
  id: string;
  type: 'prerequisite' | 'time_based' | 'score_based' | 'completion_based' | 'sequential';
  condition: any;
  targetType: 'lesson' | 'section' | 'course';
  targetId: string;
  isRequired: boolean;
  weight: number; // For weighted prerequisites
}

interface AccessResult {
  hasAccess: boolean;
  reason?: string;
  requirementsUnmet: string[];
  estimatedUnlockTime?: string;
  alternativePaths?: string[];
  recommendations: string[];
}

interface LearningPath {
  id: string;
  courseId: string;
  userId: string;
  path: string[]; // Ordered list of content IDs
  isAdaptive: boolean;
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedDuration: number;
  completionRate: number;
  customizations: any;
}

export class ModuleAccessControlModel extends BaseModel<any> {
  constructor() {
    super('courses', 'access_control');
  }

  // Check if user has access to a specific lesson
  async checkLessonAccess(
    userId: string,
    courseId: string,
    sectionId: string,
    lessonId: string
  ): Promise<AccessResult> {
    try {
      const [course, progress] = await Promise.all([
        courseModel.findById(courseId),
        progressModel.findByUserAndCourse(userId, courseId)
      ]);

      if (!course || !progress) {
        return {
          hasAccess: false,
          reason: 'Course or progress not found',
          requirementsUnmet: ['course_enrollment'],
          recommendations: ['Please enroll in the course first']
        };
      }

      const section = course.sections.find(s => s.id === sectionId);
      if (!section) {
        return {
          hasAccess: false,
          reason: 'Section not found',
          requirementsUnmet: ['section_exists'],
          recommendations: ['Contact support if this error persists']
        };
      }

      const lesson = section.lessons.find(l => l.id === lessonId);
      if (!lesson) {
        return {
          hasAccess: false,
          reason: 'Lesson not found',
          requirementsUnmet: ['lesson_exists'],
          recommendations: ['Contact support if this error persists']
        };
      }

      // Check lesson prerequisites
      const prerequisiteCheck = await this.checkPrerequisites(
        userId,
        courseId,
        lesson.prerequisites || [],
        'lesson'
      );

      if (!prerequisiteCheck.hasAccess) {
        return prerequisiteCheck;
      }

      // Check section prerequisites
      const sectionPrereqCheck = await this.checkPrerequisites(
        userId,
        courseId,
        section.prerequisites || [],
        'section'
      );

      if (!sectionPrereqCheck.hasAccess) {
        return sectionPrereqCheck;
      }

      // Check unlock conditions
      const unlockCheck = await this.checkUnlockConditions(
        userId,
        courseId,
        section.unlockConditions || [],
        progress
      );

      if (!unlockCheck.hasAccess) {
        return unlockCheck;
      }

      // Check if lesson is published
      if (!lesson.isPublished) {
        return {
          hasAccess: false,
          reason: 'Lesson not yet published',
          requirementsUnmet: ['lesson_published'],
          recommendations: ['This lesson will be available once published by the instructor']
        };
      }

      // Check sequential access if required
      if (lesson.completionCriteria?.type === 'sequential' && lesson.order > 1) {
        const sequentialCheck = await this.checkSequentialAccess(
          userId,
          courseId,
          section,
          lesson,
          progress
        );

        if (!sequentialCheck.hasAccess) {
          return sequentialCheck;
        }
      }

      return {
        hasAccess: true,
        requirementsUnmet: [],
        recommendations: this.generateLearningRecommendations(lesson, progress)
      };
    } catch (error) {
      logger.error('Failed to check lesson access:', { userId, courseId, sectionId, lessonId, error });
      return {
        hasAccess: false,
        reason: 'System error checking access',
        requirementsUnmet: ['system_error'],
        recommendations: ['Please try again later']
      };
    }
  }

  // Check if user has access to a specific section
  async checkSectionAccess(
    userId: string,
    courseId: string,
    sectionId: string
  ): Promise<AccessResult> {
    try {
      const [course, progress] = await Promise.all([
        courseModel.findById(courseId),
        progressModel.findByUserAndCourse(userId, courseId)
      ]);

      if (!course || !progress) {
        return {
          hasAccess: false,
          reason: 'Course or progress not found',
          requirementsUnmet: ['course_enrollment'],
          recommendations: ['Please enroll in the course first']
        };
      }

      const section = course.sections.find(s => s.id === sectionId);
      if (!section) {
        return {
          hasAccess: false,
          reason: 'Section not found',
          requirementsUnmet: ['section_exists'],
          recommendations: ['Contact support if this error persists']
        };
      }

      // Check section prerequisites
      const prerequisiteCheck = await this.checkPrerequisites(
        userId,
        courseId,
        section.prerequisites || [],
        'section'
      );

      if (!prerequisiteCheck.hasAccess) {
        return prerequisiteCheck;
      }

      // Check unlock conditions
      const unlockCheck = await this.checkUnlockConditions(
        userId,
        courseId,
        section.unlockConditions || [],
        progress
      );

      if (!unlockCheck.hasAccess) {
        return unlockCheck;
      }

      // Check if section is published
      if (!section.isPublished) {
        return {
          hasAccess: false,
          reason: 'Section not yet published',
          requirementsUnmet: ['section_published'],
          recommendations: ['This section will be available once published by the instructor']
        };
      }

      // Check schedule if available
      if (section.schedule) {
        const scheduleCheck = this.checkScheduleAccess(section.schedule);
        if (!scheduleCheck.hasAccess) {
          return scheduleCheck;
        }
      }

      return {
        hasAccess: true,
        requirementsUnmet: [],
        recommendations: this.generateSectionRecommendations(section, progress)
      };
    } catch (error) {
      logger.error('Failed to check section access:', { userId, courseId, sectionId, error });
      return {
        hasAccess: false,
        reason: 'System error checking access',
        requirementsUnmet: ['system_error'],
        recommendations: ['Please try again later']
      };
    }
  }

  // Generate adaptive learning path for user
  async generateAdaptivePath(
    userId: string,
    courseId: string,
    preferences: {
      difficulty?: 'easy' | 'medium' | 'hard';
      learningStyle?: 'visual' | 'auditory' | 'kinesthetic' | 'reading';
      pacePreference?: 'slow' | 'normal' | 'fast';
      timeAvailable?: number; // minutes per day
    } = {}
  ): Promise<LearningPath> {
    try {
      const [course, progress] = await Promise.all([
        courseModel.findById(courseId),
        progressModel.findByUserAndCourse(userId, courseId)
      ]);

      if (!course || !progress) {
        throw new Error('Course or progress not found');
      }

      // Analyze user's learning patterns
      const learningAnalysis = await this.analyzeLearningPatterns(userId, courseId, progress);

      // Generate ordered content path
      const contentPath = await this.generateContentPath(
        course,
        progress,
        preferences,
        learningAnalysis
      );

      // Calculate estimated duration
      const estimatedDuration = this.calculatePathDuration(contentPath, preferences);

      const adaptivePath: LearningPath = {
        id: `path_${userId}_${courseId}_${Date.now()}`,
        courseId,
        userId,
        path: contentPath,
        isAdaptive: true,
        difficulty: preferences.difficulty || learningAnalysis.recommendedDifficulty,
        estimatedDuration,
        completionRate: 0,
        customizations: {
          preferences,
          learningAnalysis,
          generatedAt: new Date().toISOString()
        }
      };

      logger.info('Adaptive learning path generated:', {
        userId,
        courseId,
        pathLength: contentPath.length,
        difficulty: adaptivePath.difficulty,
        estimatedDuration
      });

      return adaptivePath;
    } catch (error) {
      logger.error('Failed to generate adaptive path:', { userId, courseId, error });
      throw error;
    }
  }

  // Get next recommended content for user
  async getNextRecommendedContent(
    userId: string,
    courseId: string
  ): Promise<{
    contentType: 'lesson' | 'section' | 'assessment' | 'review';
    contentId: string;
    title: string;
    reason: string;
    priority: 'low' | 'medium' | 'high';
    estimatedTime: number;
    prerequisites?: string[];
  } | null> {
    try {
      const [course, progress] = await Promise.all([
        courseModel.findById(courseId),
        progressModel.findByUserAndCourse(userId, courseId)
      ]);

      if (!course || !progress) {
        return null;
      }

      // Check for incomplete assessments with deadlines
      const urgentAssessments = await this.findUrgentAssessments(course, progress);
      if (urgentAssessments.length > 0) {
        return {
          contentType: 'assessment',
          contentId: urgentAssessments[0].id,
          title: urgentAssessments[0].title,
          reason: 'Assessment deadline approaching',
          priority: 'high',
          estimatedTime: urgentAssessments[0].estimatedTime,
          prerequisites: urgentAssessments[0].prerequisites
        };
      }

      // Check for sequential next lesson
      const nextLesson = await this.findNextSequentialLesson(course, progress);
      if (nextLesson) {
        return {
          contentType: 'lesson',
          contentId: nextLesson.id,
          title: nextLesson.title,
          reason: 'Next lesson in sequence',
          priority: 'medium',
          estimatedTime: nextLesson.estimatedDuration,
          prerequisites: nextLesson.prerequisites
        };
      }

      // Check for review opportunities
      const reviewContent = await this.findReviewContent(course, progress);
      if (reviewContent) {
        return {
          contentType: 'review',
          contentId: reviewContent.id,
          title: reviewContent.title,
          reason: 'Review recommended based on performance',
          priority: 'low',
          estimatedTime: reviewContent.estimatedTime,
          prerequisites: reviewContent.prerequisites
        };
      }

      return null;
    } catch (error) {
      logger.error('Failed to get next recommended content:', { userId, courseId, error });
      return null;
    }
  }

  // Check prerequisites for content
  private async checkPrerequisites(
    userId: string,
    courseId: string,
    prerequisites: string[],
    contentType: 'lesson' | 'section' | 'course'
  ): Promise<AccessResult> {
    if (prerequisites.length === 0) {
      return {
        hasAccess: true,
        requirementsUnmet: [],
        recommendations: []
      };
    }

    try {
      const progress = await progressModel.findByUserAndCourse(userId, courseId);
      if (!progress) {
        return {
          hasAccess: false,
          reason: 'Progress not found',
          requirementsUnmet: ['progress_exists'],
          recommendations: ['Please ensure you are enrolled in the course']
        };
      }

      const unmetPrerequisites = [];
      const recommendations = [];

      for (const prerequisiteId of prerequisites) {
        const isCompleted = contentType === 'lesson' 
          ? progress.completedLessons.includes(prerequisiteId)
          : progress.completedSections.includes(prerequisiteId);

        if (!isCompleted) {
          unmetPrerequisites.push(prerequisiteId);
          recommendations.push(`Complete prerequisite: ${prerequisiteId}`);
        }
      }

      if (unmetPrerequisites.length > 0) {
        return {
          hasAccess: false,
          reason: 'Prerequisites not met',
          requirementsUnmet: unmetPrerequisites,
          recommendations
        };
      }

      return {
        hasAccess: true,
        requirementsUnmet: [],
        recommendations: []
      };
    } catch (error) {
      logger.error('Failed to check prerequisites:', { userId, courseId, prerequisites, error });
      return {
        hasAccess: false,
        reason: 'Error checking prerequisites',
        requirementsUnmet: ['system_error'],
        recommendations: ['Please try again later']
      };
    }
  }

  // Check unlock conditions
  private async checkUnlockConditions(
    userId: string,
    courseId: string,
    unlockConditions: any[],
    progress: Progress
  ): Promise<AccessResult> {
    if (unlockConditions.length === 0) {
      return {
        hasAccess: true,
        requirementsUnmet: [],
        recommendations: []
      };
    }

    const unmetConditions = [];
    const recommendations = [];

    for (const condition of unlockConditions) {
      const isConditionMet = await this.evaluateUnlockCondition(condition, userId, courseId, progress);
      
      if (!isConditionMet) {
        unmetConditions.push(condition.type);
        recommendations.push(this.getConditionRecommendation(condition));
      }
    }

    if (unmetConditions.length > 0) {
      return {
        hasAccess: false,
        reason: 'Unlock conditions not met',
        requirementsUnmet: unmetConditions,
        recommendations
      };
    }

    return {
      hasAccess: true,
      requirementsUnmet: [],
      recommendations: []
    };
  }

  // Check sequential access
  private async checkSequentialAccess(
    userId: string,
    courseId: string,
    section: CourseSection,
    lesson: CourseLesson,
    progress: Progress
  ): Promise<AccessResult> {
    try {
      // Find previous lesson in sequence
      const previousLesson = section.lessons.find(l => l.order === lesson.order - 1);
      
      if (!previousLesson) {
        return {
          hasAccess: true,
          requirementsUnmet: [],
          recommendations: []
        };
      }

      // Check if previous lesson is completed
      const isPreviousCompleted = progress.completedLessons.includes(previousLesson.id);
      
      if (!isPreviousCompleted) {
        return {
          hasAccess: false,
          reason: 'Sequential access required',
          requirementsUnmet: [`lesson_${previousLesson.id}`],
          recommendations: [`Complete "${previousLesson.title}" first`]
        };
      }

      return {
        hasAccess: true,
        requirementsUnmet: [],
        recommendations: []
      };
    } catch (error) {
      logger.error('Failed to check sequential access:', { userId, courseId, lessonId: lesson.id, error });
      return {
        hasAccess: false,
        reason: 'Error checking sequential access',
        requirementsUnmet: ['system_error'],
        recommendations: ['Please try again later']
      };
    }
  }

  // Check schedule access
  private checkScheduleAccess(schedule: any): AccessResult {
    const now = new Date();
    
    if (schedule.availableFrom && now < new Date(schedule.availableFrom)) {
      return {
        hasAccess: false,
        reason: 'Content not yet available',
        requirementsUnmet: ['schedule_available_from'],
        recommendations: [`Available from ${new Date(schedule.availableFrom).toLocaleDateString()}`],
        estimatedUnlockTime: schedule.availableFrom
      };
    }

    if (schedule.availableUntil && now > new Date(schedule.availableUntil)) {
      return {
        hasAccess: false,
        reason: 'Content no longer available',
        requirementsUnmet: ['schedule_available_until'],
        recommendations: ['This content has expired']
      };
    }

    return {
      hasAccess: true,
      requirementsUnmet: [],
      recommendations: []
    };
  }

  // Helper methods
  private async evaluateUnlockCondition(condition: any, userId: string, courseId: string, progress: Progress): Promise<boolean> {
    switch (condition.type) {
      case 'completion':
        return progress.overallProgress >= condition.target;
      case 'grade':
        const quizScores = Object.values(progress.quizScores);
        const avgScore = quizScores.reduce((sum, quiz) => sum + quiz.bestPercentage, 0) / quizScores.length;
        return avgScore >= condition.target;
      case 'time':
        return progress.timeSpent >= condition.target;
      case 'date':
        return new Date() >= new Date(condition.target);
      default:
        return true;
    }
  }

  private getConditionRecommendation(condition: any): string {
    switch (condition.type) {
      case 'completion':
        return `Complete ${condition.target}% of the course`;
      case 'grade':
        return `Achieve at least ${condition.target}% average on assessments`;
      case 'time':
        return `Spend at least ${Math.round(condition.target / 60)} minutes studying`;
      case 'date':
        return `Available from ${new Date(condition.target).toLocaleDateString()}`;
      default:
        return 'Meet the unlock condition';
    }
  }

  private generateLearningRecommendations(lesson: CourseLesson, progress: Progress): string[] {
    const recommendations = [];

    // Based on lesson type
    if (lesson.type === 'video' && lesson.estimatedDuration > 30) {
      recommendations.push('Consider taking notes during this longer video lesson');
    }

    if (lesson.quiz) {
      recommendations.push('Review the lesson material before attempting the quiz');
    }

    // Based on user progress
    if (progress.engagement.streakDays < 3) {
      recommendations.push('Try to maintain a consistent study schedule');
    }

    return recommendations;
  }

  private generateSectionRecommendations(section: CourseSection, progress: Progress): string[] {
    const recommendations = [];

    if (section.estimatedDuration > 3600) { // More than 1 hour
      recommendations.push('This section may take multiple study sessions to complete');
    }

    if (section.moduleQuiz) {
      recommendations.push('Complete all lessons before attempting the module quiz');
    }

    return recommendations;
  }

  private async analyzeLearningPatterns(userId: string, courseId: string, progress: Progress): Promise<any> {
    // Analyze user's learning patterns and preferences
    return {
      recommendedDifficulty: 'medium',
      strongAreas: [],
      weakAreas: [],
      preferredContentTypes: ['video', 'text'],
      averageSessionLength: progress.engagement.averageSessionLength,
      completionVelocity: progress.engagement.completionVelocity
    };
  }

  private async generateContentPath(
    course: Course,
    progress: Progress,
    preferences: any,
    learningAnalysis: any
  ): Promise<string[]> {
    const contentPath = [];

    // Add sections and lessons in optimal order
    for (const section of course.sections.sort((a, b) => a.order - b.order)) {
      if (section.isPublished) {
        contentPath.push(`section_${section.id}`);
        
        for (const lesson of section.lessons.sort((a, b) => a.order - b.order)) {
          if (lesson.isPublished) {
            contentPath.push(`lesson_${lesson.id}`);
          }
        }

        if (section.moduleQuiz) {
          contentPath.push(`quiz_${section.moduleQuiz.id}`);
        }
      }
    }

    return contentPath;
  }

  private calculatePathDuration(contentPath: string[], preferences: any): number {
    // Calculate estimated duration based on content and user preferences
    return contentPath.length * 30; // Simplified: 30 minutes per item
  }

  private async findUrgentAssessments(course: Course, progress: Progress): Promise<any[]> {
    // Find assessments with approaching deadlines
    return [];
  }

  private async findNextSequentialLesson(course: Course, progress: Progress): Promise<CourseLesson | null> {
    // Find next lesson in sequence
    for (const section of course.sections.sort((a, b) => a.order - b.order)) {
      for (const lesson of section.lessons.sort((a, b) => a.order - b.order)) {
        if (!progress.completedLessons.includes(lesson.id) && lesson.isPublished) {
          return lesson;
        }
      }
    }
    return null;
  }

  private async findReviewContent(course: Course, progress: Progress): Promise<any | null> {
    // Find content that should be reviewed
    return null;
  }
}

export const moduleAccessControlModel = new ModuleAccessControlModel(); 