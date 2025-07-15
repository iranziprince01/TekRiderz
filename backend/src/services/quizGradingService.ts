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
  partialCredit: number;
  feedback: string;
  explanation?: string | undefined;
  questionType: string;
  timeSpent: number;
  difficultyLevel: 'easy' | 'medium' | 'hard';
  hints: string[];
  hintsUsed: number;
}

export interface QuizGradingResponse {
  results: GradingResult[];
  summary: {
    totalQuestions: number;
    correctAnswers: number;
    partiallyCorrect: number;
    incorrectAnswers: number;
    totalPoints: number;
    maxPossiblePoints: number;
    percentage: number;
    letterGrade: string;
    passed: boolean;
    passingScore: number;
    timeSpent: number;
    averageTimePerQuestion: number;
    difficultyAnalysis: {
      easy: { correct: number; total: number; percentage: number };
      medium: { correct: number; total: number; percentage: number };
      hard: { correct: number; total: number; percentage: number };
    };
    feedback: {
      overall: string;
      strengths: string[];
      improvements: string[];
      recommendations: string[];
    };
  };
}

export class QuizGradingService {
  private static instance: QuizGradingService;

  public static getInstance(): QuizGradingService {
    if (!QuizGradingService.instance) {
      QuizGradingService.instance = new QuizGradingService();
    }
    return QuizGradingService.instance;
  }

  /**
   * Grade a complete quiz submission
   */
  public async gradeQuiz(
    questions: QuizQuestion[],
    answers: QuizAnswer[],
    quizSettings: {
      passingScore?: number;
      showCorrectAnswers?: boolean;
      partialCreditEnabled?: boolean;
      timeLimit?: number;
    } = {}
  ): Promise<QuizGradingResponse> {
    try {
      const {
        passingScore = 70,
        showCorrectAnswers = true,
        partialCreditEnabled = false,
        timeLimit = 0
      } = quizSettings;

      // Create question map for efficient lookup
      const questionMap = new Map<string, QuizQuestion>();
      questions.forEach(q => questionMap.set(q.id, q));

      // Grade each answer
      const results: GradingResult[] = [];
      let totalTimeSpent = 0;

      for (const answer of answers) {
        const question = questionMap.get(answer.questionId);
        if (!question) {
          logger.warn('Question not found during grading:', { questionId: answer.questionId });
          continue;
        }

        const result = await this.gradeQuestion(question, answer, {
          showCorrectAnswers,
          partialCreditEnabled
        });
        results.push(result);
        totalTimeSpent += result.timeSpent;
      }

      // Calculate summary statistics
      const summary = this.calculateSummary(results, passingScore, totalTimeSpent);

      logger.info('Quiz grading completed:', {
        totalQuestions: questions.length,
        answersGraded: results.length,
        percentage: summary.percentage,
        passed: summary.passed,
        totalTimeSpent
      });

      return {
        results,
        summary
      };
    } catch (error) {
      logger.error('Quiz grading failed:', error);
      throw new Error('Failed to grade quiz');
    }
  }

  /**
   * Grade a single question
   */
  private async gradeQuestion(
    question: QuizQuestion,
    answer: QuizAnswer,
    options: {
      showCorrectAnswers?: boolean;
      partialCreditEnabled?: boolean;
    } = {}
  ): Promise<GradingResult> {
    const {
      showCorrectAnswers = true,
      partialCreditEnabled = false
    } = options;

    const maxPoints = question.points || 1;
    const difficultyLevel = this.getDifficultyLevel(question);
    const timeSpent = answer.timeSpent || 0;
    const hintsUsed = answer.hintsUsed || 0;

    let isCorrect = false;
    let points = 0;
    let partialCredit = 0;
    let feedback = '';

    // Grade based on question type
    switch (question.type) {
      case 'multiple-choice':
        ({ isCorrect, points, partialCredit, feedback } = this.gradeMultipleChoice(
          question, answer, maxPoints, partialCreditEnabled
        ));
        break;

      case 'true-false':
        ({ isCorrect, points, partialCredit, feedback } = this.gradeTrueFalse(
          question, answer, maxPoints
        ));
        break;

      case 'multiple-select':
        ({ isCorrect, points, partialCredit, feedback } = this.gradeMultipleSelect(
          question, answer, maxPoints, partialCreditEnabled
        ));
        break;

      case 'fill-blank':
        ({ isCorrect, points, partialCredit, feedback } = this.gradeFillBlank(
          question, answer, maxPoints, partialCreditEnabled
        ));
        break;

      case 'essay':
        ({ isCorrect, points, partialCredit, feedback } = this.gradeEssay(
          question, answer, maxPoints
        ));
        break;

      case 'matching':
        ({ isCorrect, points, partialCredit, feedback } = this.gradeMatching(
          question, answer, maxPoints, partialCreditEnabled
        ));
        break;

      case 'drag-drop':
        ({ isCorrect, points, partialCredit, feedback } = this.gradeDragDrop(
          question, answer, maxPoints, partialCreditEnabled
        ));
        break;

      default:
        logger.warn('Unknown question type:', { type: question.type });
        feedback = 'Unknown question type';
    }

    // Apply hint penalty
    if (hintsUsed > 0 && points > 0) {
      const hintPenalty = Math.min(0.2 * hintsUsed, 0.5); // Max 50% penalty
      points = Math.max(0, points * (1 - hintPenalty));
      partialCredit = Math.max(0, partialCredit * (1 - hintPenalty));
    }

    const result: GradingResult = {
      questionId: question.id,
      userAnswer: answer.answer,
      isCorrect,
      points: Math.round(points * 100) / 100,
      maxPoints,
      partialCredit: Math.round(partialCredit * 100) / 100,
      feedback,
      questionType: question.type,
      timeSpent,
      difficultyLevel,
      hints: question.hints || [],
      hintsUsed
    };

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
  private gradeMultipleChoice(
    question: QuizQuestion,
    answer: QuizAnswer,
    maxPoints: number,
    partialCreditEnabled: boolean
  ): { isCorrect: boolean; points: number; partialCredit: number; feedback: string } {
    const userAnswer = String(answer.answer);
    const correctAnswer = String(question.correctAnswer);
    const isCorrect = userAnswer === correctAnswer;

    let points = isCorrect ? maxPoints : 0;
    let partialCredit = 0;
    let feedback = '';

    if (isCorrect) {
      feedback = 'Correct! Well done.';
    } else {
      feedback = `Incorrect. The correct answer is option ${correctAnswer}.`;
    }

    return { isCorrect, points, partialCredit, feedback };
  }

  /**
   * Grade true/false question
   */
  private gradeTrueFalse(
    question: QuizQuestion,
    answer: QuizAnswer,
    maxPoints: number
  ): { isCorrect: boolean; points: number; partialCredit: number; feedback: string } {
    const userAnswer = String(answer.answer).toLowerCase();
    const correctAnswer = String(question.correctAnswer).toLowerCase();
    const isCorrect = userAnswer === correctAnswer;

    let points = isCorrect ? maxPoints : 0;
    let partialCredit = 0;
    let feedback = '';

    if (isCorrect) {
      feedback = 'Correct!';
    } else {
      feedback = `Incorrect. The correct answer is ${correctAnswer}.`;
    }

    return { isCorrect, points, partialCredit, feedback };
  }

  /**
   * Grade multiple select question
   */
  private gradeMultipleSelect(
    question: QuizQuestion,
    answer: QuizAnswer,
    maxPoints: number,
    partialCreditEnabled: boolean
  ): { isCorrect: boolean; points: number; partialCredit: number; feedback: string } {
    const userAnswers = Array.isArray(answer.answer) ? answer.answer : [answer.answer];
    const correctAnswers = Array.isArray(question.correctAnswer) ? question.correctAnswer : [question.correctAnswer];

    const userSet = new Set(userAnswers.map(a => String(a)));
    const correctSet = new Set(correctAnswers.map(a => String(a)));

    // Check if completely correct
    const isCorrect = userSet.size === correctSet.size && 
                     [...userSet].every(a => correctSet.has(a));

    let points = 0;
    let partialCredit = 0;
    let feedback = '';

    if (isCorrect) {
      points = maxPoints;
      feedback = 'Correct! All selections are accurate.';
    } else if (partialCreditEnabled) {
      // Calculate partial credit
      const correctSelections = [...userSet].filter(a => correctSet.has(a)).length;
      const incorrectSelections = userSet.size - correctSelections;
      const missedSelections = correctSet.size - correctSelections;

      // Award partial credit based on correct selections minus penalty for wrong ones
      const partialScore = Math.max(0, (correctSelections - incorrectSelections * 0.5) / correctSet.size);
      partialCredit = partialScore * maxPoints;
      points = partialCredit;

      feedback = `Partially correct. You selected ${correctSelections} out of ${correctSet.size} correct options.`;
    } else {
      feedback = `Incorrect. Please select all correct options.`;
    }

    return { isCorrect, points, partialCredit, feedback };
  }

  /**
   * Grade fill-in-the-blank question
   */
  private gradeFillBlank(
    question: QuizQuestion,
    answer: QuizAnswer,
    maxPoints: number,
    partialCreditEnabled: boolean
  ): { isCorrect: boolean; points: number; partialCredit: number; feedback: string } {
    const userAnswer = String(answer.answer).toLowerCase().trim();
    const correctAnswers = Array.isArray(question.correctAnswer) 
      ? question.correctAnswer.map(a => String(a).toLowerCase().trim())
      : [String(question.correctAnswer).toLowerCase().trim()];

    const isCorrect = correctAnswers.includes(userAnswer);

    let points = 0;
    let partialCredit = 0;
    let feedback = '';

    if (isCorrect) {
      points = maxPoints;
      feedback = 'Correct!';
    } else if (partialCreditEnabled) {
      // Check for partial matches using string similarity
      const similarities = correctAnswers.map(correct => 
        this.calculateStringSimilarity(userAnswer, correct)
      );
      const bestSimilarity = Math.max(...similarities);

      if (bestSimilarity > 0.7) {
        partialCredit = bestSimilarity * maxPoints;
        points = partialCredit;
        feedback = `Partially correct. Your answer is close to the expected answer.`;
      } else {
        feedback = `Incorrect. Expected answer: ${correctAnswers[0]}`;
      }
    } else {
      feedback = `Incorrect. Expected answer: ${correctAnswers[0]}`;
    }

    return { isCorrect, points, partialCredit, feedback };
  }

  /**
   * Grade essay question (placeholder for manual grading)
   */
  private gradeEssay(
    question: QuizQuestion,
    answer: QuizAnswer,
    maxPoints: number
  ): { isCorrect: boolean; points: number; partialCredit: number; feedback: string } {
    const userAnswer = String(answer.answer).trim();
    const hasContent = userAnswer.length > 10; // Minimum content check

    let points = 0;
    let partialCredit = 0;
    let feedback = '';

    if (hasContent) {
      points = maxPoints; // Give full credit for submission, manual grading required
      feedback = 'Essay submitted successfully. Manual grading required.';
    } else {
      feedback = 'Essay answer is too short or missing.';
    }

    return { isCorrect: hasContent, points, partialCredit, feedback };
  }

  /**
   * Grade matching question
   */
  private gradeMatching(
    question: QuizQuestion,
    answer: QuizAnswer,
    maxPoints: number,
    partialCreditEnabled: boolean
  ): { isCorrect: boolean; points: number; partialCredit: number; feedback: string } {
    // Placeholder implementation - would need specific matching logic
    const isCorrect = JSON.stringify(answer.answer) === JSON.stringify(question.correctAnswer);
    
    let points = isCorrect ? maxPoints : 0;
    let partialCredit = 0;
    let feedback = isCorrect ? 'All matches correct!' : 'Some matches are incorrect.';

    return { isCorrect, points, partialCredit, feedback };
  }

  /**
   * Grade drag-and-drop question
   */
  private gradeDragDrop(
    question: QuizQuestion,
    answer: QuizAnswer,
    maxPoints: number,
    partialCreditEnabled: boolean
  ): { isCorrect: boolean; points: number; partialCredit: number; feedback: string } {
    // Placeholder implementation - would need specific drag-drop logic
    const isCorrect = JSON.stringify(answer.answer) === JSON.stringify(question.correctAnswer);
    
    let points = isCorrect ? maxPoints : 0;
    let partialCredit = 0;
    let feedback = isCorrect ? 'All items placed correctly!' : 'Some items are incorrectly placed.';

    return { isCorrect, points, partialCredit, feedback };
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(
    results: GradingResult[],
    passingScore: number,
    totalTimeSpent: number
  ): QuizGradingResponse['summary'] {
    const totalQuestions = results.length;
    const correctAnswers = results.filter(r => r.isCorrect).length;
    const partiallyCorrect = results.filter(r => r.partialCredit > 0 && !r.isCorrect).length;
    const incorrectAnswers = totalQuestions - correctAnswers - partiallyCorrect;

    const totalPoints = results.reduce((sum, r) => sum + r.points, 0);
    const maxPossiblePoints = results.reduce((sum, r) => sum + r.maxPoints, 0);
    const percentage = maxPossiblePoints > 0 ? Math.round((totalPoints / maxPossiblePoints) * 100) : 0;
    const letterGrade = this.calculateLetterGrade(percentage);
    const passed = percentage >= passingScore;
    const averageTimePerQuestion = totalQuestions > 0 ? totalTimeSpent / totalQuestions : 0;

    // Difficulty analysis
    const difficultyAnalysis = this.analyzeDifficultyPerformance(results);

    // Generate feedback
    const feedback = this.generateFeedback(results, percentage, passed, passingScore);

    return {
      totalQuestions,
      correctAnswers,
      partiallyCorrect,
      incorrectAnswers,
      totalPoints: Math.round(totalPoints * 100) / 100,
      maxPossiblePoints,
      percentage,
      letterGrade,
      passed,
      passingScore,
      timeSpent: totalTimeSpent,
      averageTimePerQuestion: Math.round(averageTimePerQuestion),
      difficultyAnalysis,
      feedback
    };
  }

  /**
   * Get difficulty level from question
   */
  private getDifficultyLevel(question: QuizQuestion): 'easy' | 'medium' | 'hard' {
    // Default to medium if not specified
    return (question as any).difficulty || 'medium';
  }

  /**
   * Calculate string similarity (simple implementation)
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(0));
    
    for (let i = 0; i <= str1.length; i++) {
      matrix[0]![i] = i;
    }
    for (let j = 0; j <= str2.length; j++) {
      matrix[j]![0] = j;
    }
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j]![i] = Math.min(
          matrix[j]![i - 1]! + 1,     // deletion
          matrix[j - 1]![i]! + 1,     // insertion
          matrix[j - 1]![i - 1]! + indicator // substitution
        );
      }
    }
    
    return matrix[str2.length]![str1.length]!;
  }

  /**
   * Calculate letter grade
   */
  private calculateLetterGrade(percentage: number): string {
    if (percentage >= 97) return 'A+';
    if (percentage >= 93) return 'A';
    if (percentage >= 90) return 'A-';
    if (percentage >= 87) return 'B+';
    if (percentage >= 83) return 'B';
    if (percentage >= 80) return 'B-';
    if (percentage >= 77) return 'C+';
    if (percentage >= 73) return 'C';
    if (percentage >= 70) return 'C-';
    if (percentage >= 67) return 'D+';
    if (percentage >= 63) return 'D';
    if (percentage >= 60) return 'D-';
    return 'F';
  }

  /**
   * Analyze performance by difficulty level
   */
  private analyzeDifficultyPerformance(results: GradingResult[]) {
    const levels = ['easy', 'medium', 'hard'] as const;
    const analysis: any = {};

    for (const level of levels) {
      const levelResults = results.filter(r => r.difficultyLevel === level);
      const correct = levelResults.filter(r => r.isCorrect).length;
      const total = levelResults.length;
      const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;

      analysis[level] = { correct, total, percentage };
    }

    return analysis;
  }

  /**
   * Generate comprehensive feedback
   */
  private generateFeedback(
    results: GradingResult[],
    percentage: number,
    passed: boolean,
    passingScore: number
  ) {
    const strengths: string[] = [];
    const improvements: string[] = [];
    const recommendations: string[] = [];

    // Overall performance feedback
    let overall = '';
    if (passed) {
      if (percentage >= 90) {
        overall = 'Excellent work! You have demonstrated mastery of the material.';
      } else if (percentage >= 80) {
        overall = 'Good job! You passed with a solid understanding.';
      } else {
        overall = 'You passed! Consider reviewing some areas for better retention.';
      }
    } else {
      overall = `You scored ${percentage}%. You need ${passingScore}% to pass. Don't give up!`;
    }

    // Analyze performance patterns
    const correctAnswers = results.filter(r => r.isCorrect);
    const incorrectAnswers = results.filter(r => !r.isCorrect);

    if (correctAnswers.length > 0) {
      strengths.push(`Strong performance on ${correctAnswers.length} questions`);
    }

    if (incorrectAnswers.length > 0) {
      improvements.push(`Review areas covered in ${incorrectAnswers.length} questions`);
    }

    // Time-based feedback
    const avgTime = results.reduce((sum, r) => sum + r.timeSpent, 0) / results.length;
    if (avgTime > 0) {
      if (avgTime < 30) {
        recommendations.push('Consider spending more time reading questions carefully');
      } else if (avgTime > 120) {
        recommendations.push('Practice time management for quizzes');
      }
    }

    // Difficulty-based recommendations
    const hardQuestions = results.filter(r => r.difficultyLevel === 'hard');
    const hardCorrect = hardQuestions.filter(r => r.isCorrect).length;
    
    if (hardQuestions.length > 0) {
      const hardPercentage = (hardCorrect / hardQuestions.length) * 100;
      if (hardPercentage < 50) {
        recommendations.push('Focus on challenging concepts for deeper understanding');
      }
    }

    return {
      overall,
      strengths,
      improvements,
      recommendations
    };
  }
}

export const quizGradingService = QuizGradingService.getInstance(); 