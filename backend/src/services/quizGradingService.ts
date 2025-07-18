import { logger } from '../utils/logger';
import { QuizQuestion } from '../types';

export interface QuizAnswer {
  questionId: string;
  answer: string | string[] | number;
  timeSpent?: number;
  hintsUsed?: number;
  confidence?: number;
}

export interface GradingResult {
  questionId: string;
  userAnswer: string | string[] | number;
  correctAnswer?: string | string[] | number;
  isCorrect: boolean;
  points: number;
  maxPoints: number;
  feedback: string;
  explanation?: string;
  questionType: string;
  timeSpent: number;
}

export interface QuizGradingSummary {
  totalQuestions: number;
  correctAnswers: number;
  percentage: number;
  totalPoints: number;
  maxPossiblePoints: number;
  passed: boolean;
  passingScore: number;
  letterGrade: string;
  feedback: {
    overall: string;
    performance: string;
    suggestions: string[];
  };
}

export interface QuizGradingResponse {
  results: GradingResult[];
  summary: QuizGradingSummary;
}

/**
 * Enhanced Quiz Grading Service - Simplified and reliable
 */
export class QuizGradingService {
  private static instance: QuizGradingService;

  public static getInstance(): QuizGradingService {
    if (!this.instance) {
      this.instance = new QuizGradingService();
    }
    return this.instance;
  }

  /**
   * Grade a complete quiz with preset correct answers
   */
  public async gradeQuiz(
    questions: QuizQuestion[],
    answers: QuizAnswer[],
    quizSettings: {
      passingScore?: number;
      showCorrectAnswers?: boolean;
      timeLimit?: number;
    } = {}
  ): Promise<QuizGradingResponse> {
    try {
      const { passingScore = 70, showCorrectAnswers = true } = quizSettings;

      // Create question map for efficient lookup
      const questionMap = new Map<string, QuizQuestion>();
      questions.forEach(q => questionMap.set(q.id, q));

      // Grade each answer using preset correct answers
      const results: GradingResult[] = [];
      let totalTimeSpent = 0;

      for (const answer of answers) {
        const question = questionMap.get(answer.questionId);
        if (!question) {
          logger.warn('Question not found during grading:', { questionId: answer.questionId });
          continue;
        }

        const result = this.gradeQuestion(question, answer, { showCorrectAnswers });
        results.push(result);
        totalTimeSpent += result.timeSpent;
      }

      // Calculate summary statistics
      const summary = this.calculateSummary(results, passingScore, totalTimeSpent);

      logger.info('Quiz auto-grading completed:', {
        totalQuestions: questions.length,
        answersGraded: results.length,
        percentage: summary.percentage,
        passed: summary.passed,
        totalTimeSpent
      });

      return { results, summary };
    } catch (error) {
      logger.error('Quiz grading failed:', error);
      throw new Error('Failed to grade quiz');
    }
  }

  /**
   * Grade a single question using preset correct answer
   */
  private gradeQuestion(
    question: QuizQuestion,
    answer: QuizAnswer,
    options: { showCorrectAnswers?: boolean } = {}
  ): GradingResult {
    const { showCorrectAnswers = true } = options;
    const maxPoints = question.points || 1;
    const timeSpent = answer.timeSpent || 0;

    let isCorrect = false;
    let points = 0;
    let feedback = '';

    // Grade based on question type using preset correct answers
    switch (question.type) {
      case 'multiple-choice':
        isCorrect = this.gradeMultipleChoice(question, answer);
        break;

      case 'true-false':
        isCorrect = this.gradeTrueFalse(question, answer);
        break;

      case 'multiple-select':
        isCorrect = this.gradeMultipleSelect(question, answer);
        break;

      case 'fill-blank':
        isCorrect = this.gradeFillBlank(question, answer);
        break;

      case 'essay':
        // Essays require manual grading - give full points for now
        isCorrect = true;
        feedback = 'Essay submitted successfully. Manual review required.';
        break;

      default:
        logger.warn('Unknown question type:', { type: question.type });
        feedback = 'Question type not supported for auto-grading';
    }

    // Calculate points and feedback
    points = isCorrect ? maxPoints : 0;
    
    if (!feedback) {
      if (isCorrect) {
        feedback = 'Correct! Well done.';
      } else {
        feedback = 'Incorrect. Please review the material.';
      }
    }

    // Apply hint penalty if hints were used
    if (answer.hintsUsed && answer.hintsUsed > 0 && points > 0) {
      const hintPenalty = Math.min(0.1 * answer.hintsUsed, 0.3); // Max 30% penalty
      points = Math.max(0, points * (1 - hintPenalty));
      feedback += ` (Hint penalty applied: -${Math.round(hintPenalty * 100)}%)`;
    }

    const result: GradingResult = {
      questionId: question.id,
      userAnswer: answer.answer,
      isCorrect,
      points: Math.round(points * 100) / 100,
      maxPoints,
      feedback,
      questionType: question.type,
      timeSpent
    };

    // Add correct answer and explanation if configured
    if (showCorrectAnswers && question.correctAnswer !== undefined) {
      result.correctAnswer = question.correctAnswer;
    }

    if (showCorrectAnswers && question.explanation) {
      result.explanation = question.explanation;
    }

    return result;
  }

  /**
   * Grade multiple choice question
   */
  private gradeMultipleChoice(question: QuizQuestion, answer: QuizAnswer): boolean {
    const userAnswer = String(answer.answer).trim();
    
    // Method 1: Check if correctAnswer is directly provided
    if (question.correctAnswer !== undefined && question.correctAnswer !== null) {
      const correctAnswer = String(question.correctAnswer).trim();
      return userAnswer === correctAnswer;
    }
    
    // Method 2: Look for options with isCorrect property (for enhanced quiz questions)
    if (question.options && Array.isArray(question.options)) {
      // Handle both string[] and object[] formats
      for (const option of question.options) {
        if (typeof option === 'object' && option !== null) {
          // Object format with isCorrect property
          const optionObj = option as any;
          if (optionObj.isCorrect === true) {
            const optionId = String(optionObj.id || optionObj.value || optionObj.text || '').trim();
            return userAnswer === optionId;
          }
        }
      }
    }
    
    // Method 3: Legacy support - if no explicit correct answer found, log warning
    logger.warn('Multiple choice question missing correct answer format:', {
      questionId: question.id,
      hasCorrectAnswer: !!question.correctAnswer,
      hasOptions: !!question.options,
      optionsCount: question.options?.length || 0,
      userAnswer
    });
    
    return false;
  }

  /**
   * Grade true/false question
   */
  private gradeTrueFalse(question: QuizQuestion, answer: QuizAnswer): boolean {
    const userAnswer = String(answer.answer).toLowerCase().trim();
    const correctAnswer = String(question.correctAnswer).toLowerCase().trim();
    return userAnswer === correctAnswer;
  }

  /**
   * Grade multiple select question
   */
  private gradeMultipleSelect(question: QuizQuestion, answer: QuizAnswer): boolean {
    if (!Array.isArray(answer.answer)) {
      return false;
    }

    const userAnswers = answer.answer.map(a => String(a)).sort();
    
    // Method 1: Check if correctAnswer is directly provided as array
    if (Array.isArray(question.correctAnswer)) {
      const correctAnswers = question.correctAnswer.map(a => String(a)).sort();
      return JSON.stringify(userAnswers) === JSON.stringify(correctAnswers);
    }
    
    // Method 2: Extract correct answers from options with isCorrect property
    if (question.options && Array.isArray(question.options)) {
      const correctAnswers: string[] = [];
      
      for (const option of question.options) {
        if (typeof option === 'object' && option !== null) {
          const optionObj = option as any;
          if (optionObj.isCorrect === true) {
            const optionId = String(optionObj.id || optionObj.value || optionObj.text || '').trim();
            correctAnswers.push(optionId);
          }
        }
      }
      
      if (correctAnswers.length > 0) {
        correctAnswers.sort();
        return JSON.stringify(userAnswers) === JSON.stringify(correctAnswers);
      }
    }
    
    logger.warn('Multiple select question missing correct answer format:', {
      questionId: question.id,
      hasCorrectAnswer: !!question.correctAnswer,
      isCorrectAnswerArray: Array.isArray(question.correctAnswer),
      hasOptions: !!question.options,
      userAnswers
    });
    
    return false;
  }

  /**
   * Grade fill-in-the-blank question
   */
  private gradeFillBlank(question: QuizQuestion, answer: QuizAnswer): boolean {
    const userAnswer = String(answer.answer).toLowerCase().trim();
    
    // Handle multiple correct answers
    const correctAnswers = Array.isArray(question.correctAnswer) 
      ? question.correctAnswer.map(a => String(a).toLowerCase().trim())
      : [String(question.correctAnswer).toLowerCase().trim()];

    return correctAnswers.includes(userAnswer);
  }

  /**
   * Calculate quiz summary statistics
   */
  private calculateSummary(
    results: GradingResult[], 
    passingScore: number, 
    totalTimeSpent: number
  ): QuizGradingSummary {
    const totalQuestions = results.length;
    const correctAnswers = results.filter(r => r.isCorrect).length;
    const totalPoints = results.reduce((sum, r) => sum + r.points, 0);
    const maxPossiblePoints = results.reduce((sum, r) => sum + r.maxPoints, 0);
    
    const percentage = maxPossiblePoints > 0 ? Math.round((totalPoints / maxPossiblePoints) * 100) : 0;
    const passed = percentage >= passingScore;
    const letterGrade = this.getLetterGrade(percentage);

    // Generate feedback
    const feedback = this.generateFeedback(percentage, passed, correctAnswers, totalQuestions);

    return {
      totalQuestions,
      correctAnswers,
      percentage,
      totalPoints: Math.round(totalPoints * 100) / 100,
      maxPossiblePoints,
      passed,
      passingScore,
      letterGrade,
      feedback
    };
  }

  /**
   * Get letter grade from percentage
   */
  private getLetterGrade(percentage: number): string {
    if (percentage >= 90) return 'A';
    if (percentage >= 80) return 'B';
    if (percentage >= 70) return 'C';
    if (percentage >= 60) return 'D';
    return 'F';
  }

  /**
   * Generate personalized feedback
   */
  private generateFeedback(
    percentage: number, 
    passed: boolean, 
    correctAnswers: number, 
    totalQuestions: number
  ) {
    let overall = '';
    let performance = '';
    const suggestions: string[] = [];

    if (percentage >= 90) {
      overall = 'Excellent work! You have a strong understanding of the material.';
      performance = 'Outstanding performance';
      suggestions.push('Consider helping other students or exploring advanced topics.');
    } else if (percentage >= 80) {
      overall = 'Great job! You have a good grasp of the concepts.';
      performance = 'Good performance';
      suggestions.push('Review any incorrect answers to strengthen your understanding.');
    } else if (percentage >= 70) {
      overall = 'Good work! You passed, but there\'s room for improvement.';
      performance = 'Satisfactory performance';
      suggestions.push('Review the material and retake the quiz if allowed.');
    } else if (percentage >= 60) {
      overall = 'You need to review the material more thoroughly.';
      performance = 'Below expectations';
      suggestions.push('Go back to the course content and study the concepts again.');
      suggestions.push('Consider asking for help or clarification.');
    } else {
      overall = 'You need significant review of the material before retaking.';
      performance = 'Needs improvement';
      suggestions.push('Review all course materials thoroughly.');
      suggestions.push('Consider additional study resources or tutoring.');
      suggestions.push('Retake the quiz after studying.');
    }

    return { overall, performance, suggestions };
  }
}

// Export singleton instance
export const quizGradingService = QuizGradingService.getInstance(); 