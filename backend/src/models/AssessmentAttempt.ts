import { BaseModel } from './BaseModel';
import { AssessmentAttempt } from '../types';
import { logger } from '../utils/logger';
import { databases } from '../config/database';
import { assessmentModel } from './Assessment';

export class AssessmentAttemptModel extends BaseModel<AssessmentAttempt> {
  constructor() {
    super('assessment_attempts', 'assessment_attempt');
  }

  // Create assessment attempt with proper validation
  async create(attemptData: Omit<AssessmentAttempt, '_id' | '_rev' | 'createdAt' | 'updatedAt'>): Promise<AssessmentAttempt> {
    try {
      const attemptWithDefaults = {
        ...attemptData,
        type: 'assessment_attempt' as const,
        attemptNumber: attemptData.attemptNumber || 1,
        status: attemptData.status || 'in_progress',
        answers: attemptData.answers || [],
        timeSpent: attemptData.timeSpent || 0,
        proctoring: attemptData.proctoring || {
          sessionId: `session_${Date.now()}`,
          recordings: [],
          violations: [],
          flagged: false
        },
        metadata: attemptData.metadata || {}
      };

      return await super.create(attemptWithDefaults);
    } catch (error) {
      logger.error('Failed to create assessment attempt:', error);
      throw error;
    }
  }

  // Start a new assessment attempt
  async startAttempt(
    assessmentId: string, 
    userId: string, 
    metadata?: any
  ): Promise<{
    attempt: AssessmentAttempt;
    assessmentData: any;
    timeLimit: number;
    maxAttempts: number;
    attemptNumber: number;
  }> {
    try {
      // Get assessment details
      const assessment = await assessmentModel.findById(assessmentId);
      if (!assessment) {
        throw new Error('Assessment not found');
      }

      // Check if user has reached max attempts
      const previousAttempts = await this.getUserAttempts(userId, assessmentId);
      const attemptNumber = previousAttempts.length + 1;

      if (attemptNumber > assessment.settings.maxAttempts) {
        throw new Error(`Maximum attempts (${assessment.settings.maxAttempts}) exceeded`);
      }

      // Check if assessment is available
      if (assessment.availability?.startDate && new Date() < new Date(assessment.availability.startDate)) {
        throw new Error('Assessment not yet available');
      }

      if (assessment.availability?.endDate && new Date() > new Date(assessment.availability.endDate)) {
        throw new Error('Assessment deadline has passed');
      }

      // Create new attempt
      const attempt = await this.create({
        type: 'assessment_attempt',
        id: this.generateId(),
        assessmentId,
        userId,
        attemptNumber,
        startTime: new Date().toISOString(),
        timeSpent: 0,
        answers: [],
        status: 'in_progress',
        proctoring: {
          sessionId: `session_${userId}_${assessmentId}_${Date.now()}`,
          recordings: [],
          violations: [],
          flagged: false
        },
        grading: {
          score: 0,
          maxScore: assessment.questions.reduce((sum, q) => sum + q.points, 0),
          percentage: 0,
          gradeBreakdown: [],
          autoGraded: true
        },
        metadata: {
          ...metadata,
          browserFingerprint: metadata?.browserFingerprint,
          ipAddress: metadata?.ipAddress,
          userAgent: metadata?.userAgent,
          startedAt: new Date().toISOString()
        }
      });

      // Prepare assessment data (without correct answers for security)
      const assessmentData = {
        ...assessment,
        questions: assessment.questions.map(q => ({
          ...q,
          correctAnswer: undefined, // Remove correct answers from client
          explanation: undefined    // Hide explanations until after submission
        }))
      };

      logger.info('Assessment attempt started:', {
        attemptId: attempt._id,
        assessmentId,
        userId,
        attemptNumber
      });

      return {
        attempt,
        assessmentData,
        timeLimit: assessment.settings.timeLimit,
        maxAttempts: assessment.settings.maxAttempts,
        attemptNumber
      };
    } catch (error) {
      logger.error('Failed to start assessment attempt:', { assessmentId, userId, error });
      throw error;
    }
  }

  // Submit assessment attempt for grading
  async submitAttempt(attemptId: string, answers: any[], metadata?: any): Promise<{
    attempt: AssessmentAttempt;
    gradeResult: any;
    passed: boolean;
    canRetake: boolean;
  }> {
    try {
      const attempt = await this.findById(attemptId);
      if (!attempt) {
        throw new Error('Assessment attempt not found');
      }

      if (attempt.status !== 'in_progress') {
        throw new Error('Cannot submit: attempt not in progress');
      }

      // Calculate time spent
      const startTime = new Date(attempt.startTime);
      const endTime = new Date();
      const timeSpent = Math.round((endTime.getTime() - startTime.getTime()) / 1000);

      // Update attempt with answers
      const updatedAttempt = await this.update(attemptId, {
        answers,
        endTime: endTime.toISOString(),
        timeSpent,
        status: 'submitted',
        metadata: {
          ...attempt.metadata,
          ...metadata,
          submittedAt: endTime.toISOString()
        }
      } as Partial<AssessmentAttempt>);

      // Auto-grade the attempt
      const gradeResult = await assessmentModel.autoGradeAttempt(attempt.assessmentId, {
        ...updatedAttempt,
        answers
      });

      // Update attempt with grading results
      const gradedAttempt = await this.update(attemptId, {
        status: 'graded',
        grading: {
          score: gradeResult.score,
          maxScore: gradeResult.maxScore,
          percentage: gradeResult.percentage,
          gradeBreakdown: gradeResult.gradeBreakdown,
          feedback: gradeResult.feedback,
          gradedAt: new Date().toISOString(),
          autoGraded: true
        }
      } as Partial<AssessmentAttempt>);

      // Update assessment analytics
      await assessmentModel.updateAnalytics(attempt.assessmentId, gradedAttempt!, gradeResult);

      // Check if user can retake
      const assessment = await assessmentModel.findById(attempt.assessmentId);
      const userAttempts = await this.getUserAttempts(attempt.userId, attempt.assessmentId);
      const canRetake = assessment ? userAttempts.length < assessment.settings.maxAttempts && !gradeResult.passed : false;

      logger.info('Assessment attempt submitted and graded:', {
        attemptId,
        userId: attempt.userId,
        score: gradeResult.percentage,
        passed: gradeResult.passed,
        timeSpent
      });

      return {
        attempt: gradedAttempt!,
        gradeResult,
        passed: gradeResult.passed,
        canRetake
      };
    } catch (error) {
      logger.error('Failed to submit assessment attempt:', { attemptId, error });
      throw error;
    }
  }

  // Get user's attempts for a specific assessment
  async getUserAttempts(userId: string, assessmentId: string): Promise<AssessmentAttempt[]> {
    try {
      const result = await databases.assessments.view('assessment_attempts', 'by_user_assessment', {
        key: [userId, assessmentId],
        include_docs: true,
      });

      return result.rows.map((row: any) => row.doc as AssessmentAttempt).sort((a: AssessmentAttempt, b: AssessmentAttempt) => 
        new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      );
    } catch (error) {
      logger.error('Failed to get user attempts:', { userId, assessmentId, error });
      return [];
    }
  }

  // Get user's best attempt for an assessment
  async getUserBestAttempt(userId: string, assessmentId: string): Promise<AssessmentAttempt | null> {
    try {
      const attempts = await this.getUserAttempts(userId, assessmentId);
      if (attempts.length === 0) return null;

      // Find highest scoring attempt
      return attempts.reduce((best, current) => {
        const bestScore = best.grading?.percentage || 0;
        const currentScore = current.grading?.percentage || 0;
        return currentScore > bestScore ? current : best;
      });
    } catch (error) {
      logger.error('Failed to get user best attempt:', { userId, assessmentId, error });
      return null;
    }
  }

  // Record proctoring violation
  async recordViolation(
    attemptId: string, 
    violation: {
      type: string;
      timestamp: string;
      severity: 'low' | 'medium' | 'high';
      description: string;
      evidence?: string;
    }
  ): Promise<void> {
    try {
      const attempt = await this.findById(attemptId);
      if (!attempt) return;

      const updatedViolations = [...(attempt.proctoring?.violations || []), violation];
      const shouldFlag = this.shouldFlagAttempt(updatedViolations);

      await this.update(attemptId, {
        proctoring: {
          ...attempt.proctoring,
          violations: updatedViolations,
          flagged: shouldFlag
        }
      } as Partial<AssessmentAttempt>);

      logger.warn('Proctoring violation recorded:', {
        attemptId,
        violationType: violation.type,
        severity: violation.severity,
        flagged: shouldFlag
      });
    } catch (error) {
      logger.error('Failed to record violation:', { attemptId, violation, error });
    }
  }

  // Determine if attempt should be flagged based on violations
  private shouldFlagAttempt(violations: any[]): boolean {
    const highSeverityCount = violations.filter(v => v.severity === 'high').length;
    const mediumSeverityCount = violations.filter(v => v.severity === 'medium').length;
    const totalViolations = violations.length;

    // Flag if: 1+ high severity, 3+ medium severity, or 5+ total violations
    return highSeverityCount >= 1 || mediumSeverityCount >= 3 || totalViolations >= 5;
  }

  // Get assessment attempt statistics
  async getAttemptStatistics(assessmentId: string): Promise<{
    totalAttempts: number;
    averageScore: number;
    averageTime: number;
    passRate: number;
    flaggedAttempts: number;
    difficultyAnalysis: any[];
    recentAttempts: AssessmentAttempt[];
  }> {
    try {
      const result = await databases.assessments.view('assessment_attempts', 'by_assessment', {
        key: assessmentId,
        include_docs: true,
      });

      const attempts = result.rows.map((row: any) => row.doc as AssessmentAttempt);
      const completedAttempts = attempts.filter((a: AssessmentAttempt) => a.status === 'graded' || a.status === 'completed');

      if (completedAttempts.length === 0) {
        return {
          totalAttempts: 0,
          averageScore: 0,
          averageTime: 0,
          passRate: 0,
          flaggedAttempts: 0,
          difficultyAnalysis: [],
          recentAttempts: []
        };
      }

      // Calculate statistics
      const totalAttempts = completedAttempts.length;
      const averageScore = completedAttempts.reduce((sum: number, a: AssessmentAttempt) => sum + (a.grading?.percentage || 0), 0) / totalAttempts;
      const averageTime = completedAttempts.reduce((sum: number, a: AssessmentAttempt) => sum + (a.timeSpent || 0), 0) / totalAttempts;
      const passedAttempts = completedAttempts.filter((a: AssessmentAttempt) => (a.grading?.percentage || 0) >= 70).length;
      const passRate = (passedAttempts / totalAttempts) * 100;
      const flaggedAttempts = attempts.filter((a: AssessmentAttempt) => a.proctoring?.flagged).length;

      // Get recent attempts (last 10)
      const recentAttempts = attempts
        .sort((a: AssessmentAttempt, b: AssessmentAttempt) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
        .slice(0, 10);

      return {
        totalAttempts,
        averageScore: Math.round(averageScore * 100) / 100,
        averageTime: Math.round(averageTime),
        passRate: Math.round(passRate * 100) / 100,
        flaggedAttempts,
        difficultyAnalysis: [], // Would be calculated from question-level data
        recentAttempts
      };
    } catch (error) {
      logger.error('Failed to get attempt statistics:', { assessmentId, error });
      throw error;
    }
  }

  // Auto-save attempt progress (for longer assessments)
  async autoSaveProgress(attemptId: string, answers: any[], currentTime?: string): Promise<void> {
    try {
      const attempt = await this.findById(attemptId);
      if (!attempt || attempt.status !== 'in_progress') return;

      // Calculate current time spent
      const startTime = new Date(attempt.startTime);
      const now = new Date(currentTime || new Date().toISOString());
      const timeSpent = Math.round((now.getTime() - startTime.getTime()) / 1000);

      await this.update(attemptId, {
        answers,
        timeSpent,
        metadata: {
          ...attempt.metadata,
          lastAutoSave: now.toISOString(),
          autoSaveCount: (attempt.metadata?.autoSaveCount || 0) + 1
        }
      } as Partial<AssessmentAttempt>);

      logger.debug('Assessment progress auto-saved:', { attemptId, answersCount: answers.length, timeSpent });
    } catch (error) {
      logger.error('Failed to auto-save progress:', { attemptId, error });
    }
  }

  // Resume previous attempt (if allowed)
  async resumeAttempt(userId: string, assessmentId: string): Promise<AssessmentAttempt | null> {
    try {
      const attempts = await this.getUserAttempts(userId, assessmentId);
      const inProgressAttempt = attempts.find(a => a.status === 'in_progress');

      if (!inProgressAttempt) return null;

      // Check if attempt has timed out
      const assessment = await assessmentModel.findById(assessmentId);
      if (assessment) {
        const startTime = new Date(inProgressAttempt.startTime);
        const now = new Date();
        const timeElapsed = (now.getTime() - startTime.getTime()) / 1000 / 60; // minutes

        if (timeElapsed > assessment.settings.timeLimit) {
          // Auto-submit timed out attempt
          await this.update(inProgressAttempt._id!, {
            status: 'failed',
            endTime: now.toISOString(),
            timeSpent: assessment.settings.timeLimit * 60
          } as Partial<AssessmentAttempt>);

          return null;
        }
      }

      logger.info('Assessment attempt resumed:', {
        attemptId: inProgressAttempt._id,
        userId,
        timeElapsed: (new Date().getTime() - new Date(inProgressAttempt.startTime).getTime()) / 1000
      });

      return inProgressAttempt;
    } catch (error) {
      logger.error('Failed to resume attempt:', { userId, assessmentId, error });
      return null;
    }
  }
}

export const assessmentAttemptModel = new AssessmentAttemptModel(); 