import { BaseModel } from './BaseModel';
import { AdvancedAssessment, AssessmentAttempt, QuizQuestion } from '../types';
import { logger } from '../utils/logger';
import { databases } from '../config/database';

export class AssessmentModel extends BaseModel<AdvancedAssessment> {
  constructor() {
    super('assessments', 'assessment');
  }

  // Create assessment with proper validation
  async create(assessmentData: Omit<AdvancedAssessment, '_id' | '_rev' | 'createdAt' | 'updatedAt'>): Promise<AdvancedAssessment> {
    try {
      const assessmentWithDefaults = {
        ...assessmentData,
        type: 'assessment' as const,
        analytics: assessmentData.analytics || {
          totalAttempts: 0,
          avgScore: 0,
          avgTimeSpent: 0,
          completionRate: 0,
          flaggedAttempts: 0,
          difficultyAnalysis: []
        },
        security: assessmentData.security || {
          encryptionEnabled: true,
          watermark: false,
          printDisabled: true,
          rightClickDisabled: true,
          keyboardShortcutsDisabled: true,
          developerToolsBlocked: true
        }
      };

      return await super.create(assessmentWithDefaults);
    } catch (error) {
      logger.error('Failed to create assessment:', error);
      throw error;
    }
  }

  // Get assessments by course
  async findByCourse(courseId: string): Promise<AdvancedAssessment[]> {
    try {
      const result = await databases.assessments.view('assessments', 'by_course', {
        key: courseId,
        include_docs: true,
      });

      return result.rows.map(row => row.doc as AdvancedAssessment);
    } catch (error) {
      logger.error('Failed to find assessments by course:', { courseId, error });
      throw error;
    }
  }

  // Auto-grade assessment attempt
  async autoGradeAttempt(assessmentId: string, attempt: Partial<AssessmentAttempt>): Promise<{
    score: number;
    maxScore: number;
    percentage: number;
    gradeBreakdown: Array<{
      questionId: string;
      score: number;
      maxScore: number;
      feedback?: string;
      correct: boolean;
    }>;
    feedback: string;
    passed: boolean;
  }> {
    try {
      const assessment = await this.findById(assessmentId);
      if (!assessment) {
        throw new Error('Assessment not found');
      }

      const gradeBreakdown: Array<{
        questionId: string;
        score: number;
        maxScore: number;
        feedback?: string;
        correct: boolean;
      }> = [];

      let totalScore = 0;
      let maxTotalScore = 0;

      // Grade each question
      for (const question of assessment.questions) {
        const userAnswer = attempt.answers?.find(a => a.questionId === question.id);
        if (!userAnswer) {
          gradeBreakdown.push({
            questionId: question.id,
            score: 0,
            maxScore: question.points,
            feedback: 'No answer provided',
            correct: false
          });
          maxTotalScore += question.points;
          continue;
        }

        const questionGrade = this.gradeQuestion(question, userAnswer.answer);
        gradeBreakdown.push({
          questionId: question.id,
          score: questionGrade.score,
          maxScore: question.points,
          feedback: questionGrade.feedback,
          correct: questionGrade.correct
        });

        totalScore += questionGrade.score;
        maxTotalScore += question.points;
      }

      const percentage = maxTotalScore > 0 ? Math.round((totalScore / maxTotalScore) * 100) : 0;
      const passed = percentage >= assessment.settings.passingScore;

      // Generate overall feedback
      const feedback = this.generateOverallFeedback(percentage, passed, gradeBreakdown);

      return {
        score: totalScore,
        maxScore: maxTotalScore,
        percentage,
        gradeBreakdown,
        feedback,
        passed
      };
    } catch (error) {
      logger.error('Failed to auto-grade attempt:', { assessmentId, error });
      throw error;
    }
  }

  // Grade individual question
  private gradeQuestion(question: QuizQuestion, userAnswer: any): {
    score: number;
    feedback: string;
    correct: boolean;
  } {
    try {
      switch (question.type) {
        case 'multiple-choice':
          return this.gradeMultipleChoice(question, userAnswer);
        case 'true-false':
          return this.gradeTrueFalse(question, userAnswer);
        case 'fill-blank':
          return this.gradeFillBlank(question, userAnswer);
        case 'matching':
          return this.gradeMatching(question, userAnswer);
        case 'code':
          return this.gradeCode(question, userAnswer);
        default:
          return {
            score: 0,
            feedback: 'Question type not supported for auto-grading',
            correct: false
          };
      }
    } catch (error) {
      logger.error('Failed to grade question:', { questionId: question.id, type: question.type, error });
      return {
        score: 0,
        feedback: 'Error grading question',
        correct: false
      };
    }
  }

  // Grade multiple choice question
  private gradeMultipleChoice(question: QuizQuestion, userAnswer: number | string): {
    score: number;
    feedback: string;
    correct: boolean;
  } {
    const correctAnswer = question.correctAnswer;
    const isCorrect = userAnswer === correctAnswer;
    
    return {
      score: isCorrect ? question.points : 0,
      feedback: isCorrect ? 
        (question.explanation || 'Correct!') : 
        `Incorrect. ${question.explanation || 'The correct answer is: ' + (question.options?.[correctAnswer as number] || correctAnswer)}`,
      correct: isCorrect
    };
  }

  // Grade true/false question
  private gradeTrueFalse(question: QuizQuestion, userAnswer: boolean | string): {
    score: number;
    feedback: string;
    correct: boolean;
  } {
    const correctAnswer = question.correctAnswer;
    const normalizedUserAnswer = typeof userAnswer === 'string' ? 
      userAnswer.toLowerCase() === 'true' : userAnswer;
    const normalizedCorrectAnswer = typeof correctAnswer === 'string' ? 
      correctAnswer.toLowerCase() === 'true' : correctAnswer;
    
    const isCorrect = normalizedUserAnswer === normalizedCorrectAnswer;
    
    return {
      score: isCorrect ? question.points : 0,
      feedback: isCorrect ? 
        (question.explanation || 'Correct!') : 
        `Incorrect. ${question.explanation || 'The correct answer is: ' + correctAnswer}`,
      correct: isCorrect
    };
  }

  // Grade fill-in-the-blank question
  private gradeFillBlank(question: QuizQuestion, userAnswer: string): {
    score: number;
    feedback: string;
    correct: boolean;
  } {
    const correctAnswers = Array.isArray(question.correctAnswer) ? 
      question.correctAnswer as string[] : 
      [question.correctAnswer as string];
    
    const userAnswerNormalized = userAnswer.toLowerCase().trim();
    const isCorrect = correctAnswers.some(answer => 
      answer.toLowerCase().trim() === userAnswerNormalized
    );
    
    return {
      score: isCorrect ? question.points : 0,
      feedback: isCorrect ? 
        (question.explanation || 'Correct!') : 
        `Incorrect. ${question.explanation || 'Accepted answers: ' + correctAnswers.join(', ')}`,
      correct: isCorrect
    };
  }

  // Grade matching question
  private gradeMatching(question: QuizQuestion, userAnswer: { [key: string]: string }): {
    score: number;
    feedback: string;
    correct: boolean;
  } {
    const correctAnswerRaw = question.correctAnswer;
    
    // Type guard to ensure correctAnswer is an object
    if (!correctAnswerRaw || typeof correctAnswerRaw !== 'object' || Array.isArray(correctAnswerRaw)) {
      return {
        score: 0,
        feedback: 'Invalid question configuration for matching type',
        correct: false
      };
    }
    
    const correctMatches = correctAnswerRaw as { [key: string]: string };
    let correctCount = 0;
    let totalCount = Object.keys(correctMatches).length;

    for (const [key, value] of Object.entries(correctMatches)) {
      if (userAnswer[key] === value) {
        correctCount++;
      }
    }

    const percentage = totalCount > 0 ? correctCount / totalCount : 0;
    const score = Math.round(question.points * percentage);
    const isCorrect = percentage === 1;

    return {
      score,
      feedback: isCorrect ? 
        (question.explanation || 'All matches correct!') : 
        `Partially correct: ${correctCount}/${totalCount} matches. ${question.explanation || ''}`,
      correct: isCorrect
    };
  }

  // Grade code question (basic implementation)
  private gradeCode(question: QuizQuestion, userAnswer: string): {
    score: number;
    feedback: string;
    correct: boolean;
  } {
    // This is a simplified implementation
    // In a real system, you'd want to run the code safely and test it
    try {
      if (!question.testCases || question.testCases.length === 0) {
        // No test cases, just check if something was submitted
        return {
          score: userAnswer.trim() ? question.points : 0,
          feedback: userAnswer.trim() ? 
            'Code submitted for manual review' : 
            'No code submitted',
          correct: !!userAnswer.trim()
        };
      }

      // For now, just return that it needs manual review
      // In production, you'd integrate with a code execution service
      return {
        score: 0, // Manual review required
        feedback: 'Code submitted successfully. Manual review required.',
        correct: false // Will be updated after manual review
      };
    } catch (error) {
      return {
        score: 0,
        feedback: 'Error processing code submission',
        correct: false
      };
    }
  }

  // Generate overall feedback
  private generateOverallFeedback(percentage: number, passed: boolean, gradeBreakdown: any[]): string {
    const correctCount = gradeBreakdown.filter(q => q.correct).length;
    const totalCount = gradeBreakdown.length;

    let feedback = `You scored ${percentage}% (${correctCount}/${totalCount} questions correct). `;

    if (passed) {
      if (percentage >= 90) {
        feedback += 'Excellent work! You have a strong understanding of the material.';
      } else if (percentage >= 80) {
        feedback += 'Good job! You have a solid grasp of the concepts.';
      } else {
        feedback += 'You passed! Consider reviewing the topics you missed.';
      }
    } else {
      feedback += `You need ${70}% to pass. Review the material and try again.`;
      
      // Identify weak areas
      const wrongQuestions = gradeBreakdown.filter(q => !q.correct);
      if (wrongQuestions.length > 0) {
        feedback += ` Focus on questions ${wrongQuestions.map(q => gradeBreakdown.indexOf(q) + 1).join(', ')}.`;
      }
    }

    return feedback;
  }

  // Update assessment analytics after attempt
  async updateAnalytics(assessmentId: string, attempt: AssessmentAttempt, gradeResult: any): Promise<void> {
    try {
      const assessment = await this.findById(assessmentId);
      if (!assessment) return;

      const currentAnalytics = assessment.analytics;
      const newAnalytics = {
        totalAttempts: currentAnalytics.totalAttempts + 1,
        avgScore: this.calculateNewAverage(
          currentAnalytics.avgScore,
          currentAnalytics.totalAttempts,
          gradeResult.percentage
        ),
        avgTimeSpent: this.calculateNewAverage(
          currentAnalytics.avgTimeSpent,
          currentAnalytics.totalAttempts,
          attempt.timeSpent || 0
        ),
        completionRate: this.calculateCompletionRate(
          currentAnalytics.totalAttempts + 1,
          attempt.status === 'completed' ? 1 : 0
        ),
        flaggedAttempts: currentAnalytics.flaggedAttempts + (attempt.proctoring?.flagged ? 1 : 0),
        difficultyAnalysis: this.updateDifficultyAnalysis(
          currentAnalytics.difficultyAnalysis,
          gradeResult.gradeBreakdown,
          attempt.answers
        )
      };

      await this.update(assessmentId, { analytics: newAnalytics } as Partial<AdvancedAssessment>);
    } catch (error) {
      logger.error('Failed to update assessment analytics:', { assessmentId, error });
    }
  }

  // Helper methods for analytics calculations
  private calculateNewAverage(currentAvg: number, currentCount: number, newValue: number): number {
    return currentCount === 0 ? newValue : (currentAvg * currentCount + newValue) / (currentCount + 1);
  }

  private calculateCompletionRate(totalAttempts: number, completedCount: number): number {
    return totalAttempts > 0 ? (completedCount / totalAttempts) * 100 : 0;
  }

  private updateDifficultyAnalysis(
    currentAnalysis: any[],
    gradeBreakdown: any[],
    answers: any[]
  ): any[] {
    // Simplified difficulty analysis
    return gradeBreakdown.map((question, index) => {
      const existing = currentAnalysis.find(a => a.questionId === question.questionId) || {
        questionId: question.questionId,
        difficulty: 0,
        discrimination: 0,
        averageTime: 0,
        attempts: 0
      };

      const answer = answers?.find(a => a.questionId === question.questionId);
      const timeSpent = answer?.timeSpent || 0;

      return {
        ...existing,
        difficulty: this.calculateNewAverage(existing.difficulty, existing.attempts, question.correct ? 0 : 1),
        averageTime: this.calculateNewAverage(existing.averageTime, existing.attempts, timeSpent),
        attempts: existing.attempts + 1
      };
    });
  }

  // Get assessment statistics
  async getAssessmentStats(assessmentId: string): Promise<{
    analytics: any;
    recentAttempts: AssessmentAttempt[];
    performanceDistribution: { [range: string]: number };
  }> {
    try {
      const assessment = await this.findById(assessmentId);
      if (!assessment) {
        throw new Error('Assessment not found');
      }

      // Get recent attempts
      const attemptsResult = await databases.assessments.view('assessment_attempts', 'by_assessment', {
        key: assessmentId,
        include_docs: true,
        limit: 10,
        descending: true
      });

      const recentAttempts = attemptsResult.rows.map(row => row.doc as AssessmentAttempt);

      // Calculate performance distribution
      const performanceDistribution = this.calculatePerformanceDistribution(recentAttempts);

      return {
        analytics: assessment.analytics,
        recentAttempts,
        performanceDistribution
      };
    } catch (error) {
      logger.error('Failed to get assessment stats:', { assessmentId, error });
      throw error;
    }
  }

  private calculatePerformanceDistribution(attempts: AssessmentAttempt[]): { [range: string]: number } {
    const distribution = {
      '90-100%': 0,
      '80-89%': 0,
      '70-79%': 0,
      '60-69%': 0,
      'Below 60%': 0
    };

    attempts.forEach(attempt => {
      const percentage = attempt.grading?.percentage || 0;
      if (percentage >= 90) distribution['90-100%']++;
      else if (percentage >= 80) distribution['80-89%']++;
      else if (percentage >= 70) distribution['70-79%']++;
      else if (percentage >= 60) distribution['60-69%']++;
      else distribution['Below 60%']++;
    });

    return distribution;
  }
}

export const assessmentModel = new AssessmentModel(); 