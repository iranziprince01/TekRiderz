/**
 * Quiz Attempt Manager
 * Manages quiz attempts, grades, and attempt limits for learners
 */

export interface QuizAttempt {
  id: string;
  quizId: string;
  courseId: string;
  attemptNumber: number;
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  answers: Array<{
    questionId: string;
    answer: string | string[];
    timeSpent: number;
    hintsUsed: number;
    confidence: number;
  }>;
  timeSpent: number;
  completedAt: string;
  gradeSaved: boolean;
}

export interface QuizAttemptData {
  attempts: QuizAttempt[];
  bestScore: number;
  bestAttempt: QuizAttempt | null;
  totalAttempts: number;
  canTakeQuiz: boolean;
  maxAttemptsReached: boolean;
  highestGrade: number;
  courseProgress: number;
}

/**
 * Get quiz attempt data for a specific quiz
 */
export const getQuizAttemptData = async (
  courseId: string, 
  quizId: string
): Promise<QuizAttemptData> => {
  try {
    // Get attempts from localStorage first
    const attemptsKey = `quiz_attempts_${courseId}_${quizId}`;
    const storedAttempts = localStorage.getItem(attemptsKey);
    
    let attempts: QuizAttempt[] = [];
    if (storedAttempts) {
      attempts = JSON.parse(storedAttempts);
    }

    // Sort attempts by completion date (newest first)
    attempts.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());

    const totalAttempts = attempts.length;
    const maxAttempts = 3; // Fixed at 3 attempts
    const canTakeQuiz = totalAttempts < maxAttempts;
    const maxAttemptsReached = totalAttempts >= maxAttempts;

    // Find best score and attempt
    let bestScore = 0;
    let bestAttempt: QuizAttempt | null = null;
    let highestGrade = 0;

    attempts.forEach(attempt => {
      if (attempt.percentage > bestScore) {
        bestScore = attempt.percentage;
        bestAttempt = attempt;
      }
      if (attempt.percentage > highestGrade) {
        highestGrade = attempt.percentage;
      }
    });

    // Calculate course progress based on quiz completion (using 50% as default passing score)
    const courseProgress = bestScore >= 50 ? 100 : Math.min(bestScore, 99);

    return {
      attempts,
      bestScore,
      bestAttempt,
      totalAttempts,
      canTakeQuiz,
      maxAttemptsReached,
      highestGrade,
      courseProgress
    };
  } catch (error) {
    console.error('Error getting quiz attempt data:', error);
    return {
      attempts: [],
      bestScore: 0,
      bestAttempt: null,
      totalAttempts: 0,
      canTakeQuiz: true,
      maxAttemptsReached: false,
      highestGrade: 0,
      courseProgress: 0
    };
  }
};

/**
 * Save a new quiz attempt
 */
export const saveQuizAttempt = async (
  courseId: string,
  quizId: string,
  attemptData: {
    score: number;
    maxScore: number;
    percentage: number;
    passed: boolean;
    answers: Array<{
      questionId: string;
      answer: string | string[];
      timeSpent: number;
      hintsUsed: number;
      confidence: number;
    }>;
    timeSpent: number;
    gradeSaved: boolean;
  }
): Promise<QuizAttempt> => {
  try {
    const attemptsKey = `quiz_attempts_${courseId}_${quizId}`;
    const storedAttempts = localStorage.getItem(attemptsKey);
    
    let attempts: QuizAttempt[] = [];
    if (storedAttempts) {
      attempts = JSON.parse(storedAttempts);
    }

    const newAttempt: QuizAttempt = {
      id: `attempt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      quizId,
      courseId,
      attemptNumber: attempts.length + 1,
      ...attemptData,
      completedAt: new Date().toISOString()
    };

    attempts.push(newAttempt);

    // Save to localStorage
    localStorage.setItem(attemptsKey, JSON.stringify(attempts));

    // Also save to a course-wide attempts registry
    const courseAttemptsKey = `course_attempts_${courseId}`;
    const courseAttempts = JSON.parse(localStorage.getItem(courseAttemptsKey) || '[]');
    courseAttempts.push({
      quizId,
      attemptId: newAttempt.id,
      completedAt: newAttempt.completedAt,
      percentage: newAttempt.percentage
    });
    localStorage.setItem(courseAttemptsKey, JSON.stringify(courseAttempts));

    console.log(`✅ Quiz attempt saved: ${newAttempt.attemptNumber}/${3} - Score: ${newAttempt.percentage}%`);

    return newAttempt;
  } catch (error) {
    console.error('Error saving quiz attempt:', error);
    throw error;
  }
};

/**
 * Check if learner can take a quiz (attempt limit check)
 */
export const canTakeQuiz = async (
  courseId: string,
  quizId: string
): Promise<{ canTake: boolean; reason?: string; attemptsLeft: number }> => {
  try {
    const attemptData = await getQuizAttemptData(courseId, quizId);
    
    if (attemptData.maxAttemptsReached) {
      return {
        canTake: false,
        reason: 'Maximum attempts (3) reached for this quiz',
        attemptsLeft: 0
      };
    }

    return {
      canTake: true,
      attemptsLeft: 3 - attemptData.totalAttempts
    };
  } catch (error) {
    console.error('Error checking quiz access:', error);
    return {
      canTake: true,
      attemptsLeft: 3
    };
  }
};

/**
 * Get the highest grade from all attempts
 */
export const getHighestGrade = async (
  courseId: string,
  quizId: string
): Promise<number> => {
  try {
    const attemptData = await getQuizAttemptData(courseId, quizId);
    return attemptData.highestGrade;
  } catch (error) {
    console.error('Error getting highest grade:', error);
    return 0;
  }
};

/**
 * Mark quiz as completed (for course progress)
 */
export const markQuizCompleted = async (
  courseId: string,
  quizId: string
): Promise<void> => {
  try {
    const completedQuizzesKey = `completed_quizzes_${courseId}`;
    const completedQuizzes = JSON.parse(localStorage.getItem(completedQuizzesKey) || '[]');
    
    if (!completedQuizzes.includes(quizId)) {
      completedQuizzes.push(quizId);
      localStorage.setItem(completedQuizzesKey, JSON.stringify(completedQuizzes));
    }

    // Update course progress
    const courseProgressKey = `course_progress_${courseId}`;
    const courseProgress = JSON.parse(localStorage.getItem(courseProgressKey) || '{}');
    
    if (!courseProgress.quizzes) {
      courseProgress.quizzes = [];
    }
    
    if (!courseProgress.quizzes.includes(quizId)) {
      courseProgress.quizzes.push(quizId);
      courseProgress.lastUpdated = new Date().toISOString();
      localStorage.setItem(courseProgressKey, JSON.stringify(courseProgress));
    }

    console.log(`✅ Quiz marked as completed: ${quizId}`);
  } catch (error) {
    console.error('Error marking quiz as completed:', error);
  }
};

/**
 * Get course completion status based on quiz attempts
 */
export const getCourseCompletionStatus = async (
  courseId: string
): Promise<{
  completed: boolean;
  progress: number;
  totalQuizzes: number;
  completedQuizzes: number;
  averageScore: number;
}> => {
  try {
    const courseProgressKey = `course_progress_${courseId}`;
    const courseProgress = JSON.parse(localStorage.getItem(courseProgressKey) || '{}');
    
    const completedQuizzes = courseProgress.quizzes || [];
    const totalQuizzes = courseProgress.totalQuizzes || 0;
    
    // Calculate average score from all quiz attempts
    let totalScore = 0;
    let totalAttempts = 0;
    
    for (const quizId of completedQuizzes) {
      const attemptData = await getQuizAttemptData(courseId, quizId);
      if (attemptData.highestGrade > 0) {
        totalScore += attemptData.highestGrade;
        totalAttempts++;
      }
    }
    
    const averageScore = totalAttempts > 0 ? totalScore / totalAttempts : 0;
    const progress = totalQuizzes > 0 ? (completedQuizzes.length / totalQuizzes) * 100 : 0;
    const completed = progress >= 100 && averageScore >= 50;

    return {
      completed,
      progress,
      totalQuizzes,
      completedQuizzes: completedQuizzes.length,
      averageScore
    };
  } catch (error) {
    console.error('Error getting course completion status:', error);
    return {
      completed: false,
      progress: 0,
      totalQuizzes: 0,
      completedQuizzes: 0,
      averageScore: 0
    };
  }
};

/**
 * Clear all quiz attempts (for testing/reset purposes)
 */
export const clearQuizAttempts = async (
  courseId: string,
  quizId?: string
): Promise<void> => {
  try {
    if (quizId) {
      // Clear specific quiz attempts
      const attemptsKey = `quiz_attempts_${courseId}_${quizId}`;
      localStorage.removeItem(attemptsKey);
      console.log(`✅ Cleared attempts for quiz: ${quizId}`);
    } else {
      // Clear all quiz attempts for the course
      const keys = Object.keys(localStorage);
      const quizKeys = keys.filter(key => key.startsWith(`quiz_attempts_${courseId}_`));
      
      quizKeys.forEach(key => localStorage.removeItem(key));
      console.log(`✅ Cleared all quiz attempts for course: ${courseId}`);
    }
  } catch (error) {
    console.error('Error clearing quiz attempts:', error);
  }
};

/**
 * Get attempt statistics for a quiz
 */
export const getQuizAttemptStats = async (
  courseId: string,
  quizId: string
): Promise<{
  totalAttempts: number;
  bestScore: number;
  averageScore: number;
  passedAttempts: number;
  failedAttempts: number;
  attemptsLeft: number;
  lastAttemptDate?: string;
}> => {
  try {
    const attemptData = await getQuizAttemptData(courseId, quizId);
    
    let totalScore = 0;
    let passedAttempts = 0;
    let failedAttempts = 0;
    
    attemptData.attempts.forEach(attempt => {
      totalScore += attempt.percentage;
      if (attempt.passed) {
        passedAttempts++;
      } else {
        failedAttempts++;
      }
    });
    
    const averageScore = attemptData.totalAttempts > 0 ? totalScore / attemptData.totalAttempts : 0;
    const lastAttemptDate = attemptData.attempts.length > 0 ? attemptData.attempts[0].completedAt : undefined;
    
    return {
      totalAttempts: attemptData.totalAttempts,
      bestScore: attemptData.bestScore,
      averageScore,
      passedAttempts,
      failedAttempts,
      attemptsLeft: 3 - attemptData.totalAttempts,
      lastAttemptDate
    };
  } catch (error) {
    console.error('Error getting quiz attempt stats:', error);
    return {
      totalAttempts: 0,
      bestScore: 0,
      averageScore: 0,
      passedAttempts: 0,
      failedAttempts: 0,
      attemptsLeft: 3
    };
  }
}; 