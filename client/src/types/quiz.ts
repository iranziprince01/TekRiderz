// JSON-based Quiz System Types

export interface QuizQuestion {
  id: string;
  type: 'multiple-choice' | 'true-false' | 'short-answer' | 'essay' | 'matching';
  question: string;
  points: number;
  required: boolean;
  
  // Multiple choice / True-False options
  options?: {
    id: string;
    text: string;
    isCorrect: boolean;
    explanation?: string;
  }[];
  
  // Matching questions
  leftItems?: string[];
  rightItems?: string[];
  correctMatches?: Record<string, string>;
  
  // Answer validation
  correctAnswer?: string | string[];
  explanation?: string;
  hints?: string[];
  
  // Media support
  image?: string;
  video?: string;
  audio?: string;
}

export interface QuizSettings {
  timeLimit?: number; // minutes
  maxAttempts: number;
  passingScore: number; // percentage
  showCorrectAnswers: boolean;
  showScoreImmediately: boolean;
  randomizeQuestions: boolean;
  randomizeOptions: boolean;
  allowReview: boolean;
  requireSequential: boolean;
}

export interface QuizData {
  id: string;
  courseId: string;
  sectionId?: string;
  title: string;
  description?: string;
  instructions?: string;
  questions: QuizQuestion[];
  settings: QuizSettings;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  version: number;
  tags?: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedDuration: number; // minutes
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  userId: string;
  courseId: string;
  
  // Attempt details
  startedAt: string;
  submittedAt?: string;
  timeSpent: number; // seconds
  attemptNumber: number;
  
  // Answers and scoring
  answers: Record<string, any>; // questionId -> answer
  score: number; // percentage
  pointsEarned: number;
  totalPoints: number;
  passed: boolean;
  
  // Progress tracking
  currentQuestionIndex: number;
  questionsAnswered: string[];
  isCompleted: boolean;
  

}

export interface QuizProgress {
  userId: string;
  courseId: string;
  quizId: string;
  
  // Overall progress
  totalAttempts: number;
  bestScore: number;
  averageScore: number;
  passed: boolean;
  completedAt?: string;
  
  // Attempt history
  attempts: QuizAttempt[];
  
  // Learning analytics
  timeSpentTotal: number;
  difficultQuestions: string[]; // questionIds that were frequently wrong
  strengthAreas: string[]; // topics/tags where user excels
  improvementAreas: string[]; // topics/tags needing work
}



// Quiz grading and feedback
export interface QuizFeedback {
  overallFeedback: string;
  questionFeedback: Record<string, {
    correct: boolean;
    userAnswer: any;
    correctAnswer: any;
    explanation?: string;
    points: number;
  }>;
  suggestions: string[];
  nextSteps: string[];
}

export interface QuizAnalytics {
  quizId: string;
  courseId: string;
  
  // Performance metrics
  averageScore: number;
  passRate: number;
  averageTimeSpent: number;
  completionRate: number;
  
  // Question analytics
  questionDifficulty: Record<string, number>; // questionId -> difficulty (0-1)
  commonWrongAnswers: Record<string, string[]>; // questionId -> wrong answers
  
  // User insights
  strugglingStudents: string[]; // userIds
  topPerformers: string[]; // userIds
  
  // Usage data
  totalAttempts: number;
  uniqueUsers: number;
  peakUsageHours: number[];
} 