/**
 * Quiz Settings Utilities
 * Provides consistent handling of quiz settings and passing score defaults
 */

export interface QuizSettings {
  maxAttempts: number;
  passingScore: number;
  showCorrectAnswers: boolean;
  showScoreImmediately: boolean;
  timeLimit?: number;
  randomizeQuestions?: boolean;
  randomizeOptions?: boolean;
  allowReview?: boolean;
  requireSequential?: boolean;
}

/**
 * Default quiz settings
 */
export const DEFAULT_QUIZ_SETTINGS: QuizSettings = {
  maxAttempts: 3,
  passingScore: 50, // Changed from 70 to 50
  showCorrectAnswers: true,
  showScoreImmediately: true,
  timeLimit: 0, // 0 means no time limit
  randomizeQuestions: false,
  randomizeOptions: false,
  allowReview: true,
  requireSequential: false
};

/**
 * Get passing score with proper fallback handling
 * This function properly handles 0 as a valid passing score
 */
export const getPassingScore = (passingScore?: number | null): number => {
  if (passingScore !== undefined && passingScore !== null) {
    return passingScore;
  }
  return DEFAULT_QUIZ_SETTINGS.passingScore;
};

/**
 * Merge quiz settings with defaults
 */
export const mergeQuizSettings = (settings?: Partial<QuizSettings>): QuizSettings => {
  return {
    ...DEFAULT_QUIZ_SETTINGS,
    ...settings,
    passingScore: getPassingScore(settings?.passingScore)
  };
};

/**
 * Validate quiz settings
 */
export const validateQuizSettings = (settings: QuizSettings): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (settings.passingScore < 0 || settings.passingScore > 100) {
    errors.push('Passing score must be between 0 and 100');
  }

  if (settings.maxAttempts < 1 || settings.maxAttempts > 10) {
    errors.push('Max attempts must be between 1 and 10');
  }

  if (settings.timeLimit && settings.timeLimit < 0) {
    errors.push('Time limit must be 0 (no limit) or a positive number');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Check if a score passes based on passing score
 */
export const isPassingScore = (score: number, passingScore?: number): boolean => {
  const requiredScore = getPassingScore(passingScore);
  return score >= requiredScore;
};

/**
 * Get passing score display text
 */
export const getPassingScoreText = (passingScore?: number): string => {
  const score = getPassingScore(passingScore);
  return `${score}% to pass`;
};

/**
 * Get grade letter based on percentage
 */
export const getGradeLetter = (percentage: number): string => {
  if (percentage >= 90) return 'A';
  if (percentage >= 80) return 'B';
  if (percentage >= 70) return 'C';
  if (percentage >= 60) return 'D';
  return 'F';
};

/**
 * Get grade description based on percentage
 */
export const getGradeDescription = (percentage: number): string => {
  if (percentage >= 90) return 'Excellent';
  if (percentage >= 80) return 'Good';
  if (percentage >= 70) return 'Satisfactory';
  if (percentage >= 60) return 'Needs Improvement';
  return 'Failing';
}; 