// Base document interface for CouchDB
export interface BaseDocument {
  _id?: string;
  _rev?: string;
  type: string;
  createdAt: string;
  updatedAt: string;
}

// User types
export type UserRole = 'admin' | 'tutor' | 'learner';
export type UserStatus = 'active' | 'inactive' | 'suspended' | 'pending';

export interface User extends BaseDocument {
  type: 'user';
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  status: UserStatus;
  avatar?: string;
  verified: boolean;
  lastLogin?: string;
  profile: {
    bio?: string;
    expertise?: string[];
    location?: string;
    website?: string;
    socialMedia?: {
      twitter?: string;
      linkedin?: string;
      github?: string;
    };
  };
  preferences: {
    language: 'en' | 'rw';
    notifications: {
      email: boolean;
      push: boolean;
      marketing: boolean;
    };
    accessibility: {
      highContrast: boolean;
      largeText: boolean;
      screenReader: boolean;
      reducedMotion: boolean;
    };
  };
  refreshTokens: string[];
}

// Course types
export type CourseLevel = 'beginner' | 'intermediate' | 'advanced';
export type CourseStatus = 'draft' | 'pending' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'published' | 'archived' | 'suspended';
export type CourseCategory = 
  | 'programming' 
  | 'design' 
  | 'business-tech' 
  | 'general-it';

// Course workflow and audit types
export type CourseWorkflowAction = 
  | 'create' 
  | 'update' 
  | 'submit' 
  | 'review' 
  | 'approve' 
  | 'reject' 
  | 'publish' 
  | 'archive' 
  | 'suspend' 
  | 'restore';

export interface CourseWorkflowHistory {
  id: string;
  action: CourseWorkflowAction;
  fromStatus: CourseStatus;
  toStatus: CourseStatus;
  performedBy: string;
  performedByRole: UserRole;
  timestamp: string;
  reason?: string;
  notes?: string;
  changes?: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
}

export interface CourseValidationResult {
  isValid: boolean;
  errors: {
    field: string;
    message: string;
    severity: 'error' | 'warning' | 'info';
  }[];
  warnings: {
    field: string;
    message: string;
    suggestion?: string;
  }[];
  score: number; // 0-100 quality score
}

export interface CourseApprovalFeedback {
  id: string;
  reviewerId: string;
  reviewerName: string;
  status: 'approved' | 'rejected' | 'needs_revision';
  overallScore: number; // 0-100
  criteria: {
    contentQuality: number;
    technicalQuality: number;
    marketability: number;
    accessibility: number;
    engagement: number;
  };
  feedback: {
    strengths: string[];
    improvements: string[];
    requirements: string[];
  };
  detailedComments: {
    section: string;
    comment: string;
    severity: 'critical' | 'important' | 'minor';
  }[];
  reviewedAt: string;
  estimatedRevisionTime?: string;
}

export interface CourseVersion {
  id: string;
  version: string; // semver format: 1.0.0
  courseId: string;
  snapshot: Partial<Course>;
  changes: string[];
  createdBy: string;
  createdAt: string;
  publishedAt?: string;
  isCurrentVersion: boolean;
  rollbackAvailable: boolean;
}

export interface CourseMetrics {
  views: number;
  completionRate: number;
  avgTimeToComplete: number;
  dropoffPoints: {
    sectionId: string;
    lessonId: string;
    percentage: number;
  }[];
  engagement: {
    avgSessionDuration: number;
    returnRate: number;
    discussionPosts: number;
  };
  performance: {
    avgQuizScore: number;
    assignmentSubmissionRate: number;

  };
}

// Enhanced Quiz and Assessment Types
export interface QuizQuestion {
  id: string;
  questionText: string;
  type: 'multiple-choice' | 'true-false' | 'multiple-select' | 'fill-blank' | 'essay' | 'code' | 'matching' | 'drag-drop';
  options?: string[];
  correctAnswer?: number | string | string[];
  explanation?: string;
  points: number;
  timeLimit?: number; // in seconds
  hints?: string[];
  media?: {
    type: 'image' | 'video' | 'audio';
    url: string;
    caption?: string;
  };
  codeTemplate?: string; // for coding questions
  expectedOutput?: string; // for coding questions
  testCases?: {
    input: string;
    expectedOutput: string;
    points: number;
  }[];
  rubric?: {
    criteria: string;
    points: number;
    levels: {
      level: string;
      description: string;
      points: number;
    }[];
  }[];
}

export interface ModuleQuiz {
  id: string;
  title: string;
  description: string;
  instructions: string;
  questions: QuizQuestion[];
  settings: {
    timeLimit: number; // in minutes
    attempts: number;
    passingScore: number; // percentage
    shuffleQuestions: boolean;
    shuffleOptions: boolean;
    showResultsImmediately: boolean;
    showCorrectAnswers: boolean;
    allowReview: boolean;
    requireSequential: boolean;
  };
  proctoring?: {
    enabled: boolean;
    webcamRequired: boolean;
    screenRecording: boolean;
    tabSwitchDetection: boolean;
    copyPasteBlocking: boolean;
    aiMonitoring: boolean;
  };
  grading: {
    autoGrade: boolean;
    gradingMethod: 'highest' | 'average' | 'latest';
    feedbackEnabled: boolean;
    detailedFeedback: boolean;
  };
  availability: {
    availableFrom?: string;
    availableUntil?: string;
    unlockConditions?: string[];
  };
}

export interface AssignmentSubmission {
  id: string;
  userId: string;
  assignmentId: string;
  submissionType: 'text' | 'file' | 'code' | 'link';
  content: string;
  attachments?: string[];
  submittedAt: string;
  grade?: number;
  feedback?: string;
  rubricScores?: {
    criteriaId: string;
    score: number;
    feedback?: string;
  }[];
  status: 'submitted' | 'graded' | 'returned' | 'resubmitted';
  plagiarismCheck?: {
    score: number;
    matches: string[];
    report: string;
  };
}

export interface ModuleAssignment {
  id: string;
  title: string;
  description: string;
  instructions: string;
  type: 'essay' | 'project' | 'code' | 'presentation' | 'peer-review';
  submissionFormat: 'text' | 'file' | 'code' | 'link';
  maxFileSize?: number;
  allowedFileTypes?: string[];
  maxPoints: number;
  dueDate?: string;
  allowLateSubmission: boolean;
  latePenalty?: number;
  rubric?: {
    id: string;
    name: string;
    criteria: {
      id: string;
      name: string;
      description: string;
      points: number;
      levels: {
        level: string;
        description: string;
        points: number;
      }[];
    }[];
  };
  peerReview?: {
    enabled: boolean;
    reviewersPerSubmission: number;
    reviewDeadline: string;
    anonymousReview: boolean;
  };
  plagiarismDetection: boolean;
  autoGrading?: {
    enabled: boolean;
    testCases?: {
      input: string;
      expectedOutput: string;
      points: number;
    }[];
  };
}

// Enhanced CourseLesson with comprehensive features
export interface CourseLesson {
  id: string;
  title: string;
  description: string;
  type: 'video' | 'text' | 'interactive' | 'document' | 'quiz' | 'assignment' | 'discussion' | 'webinar';
  content: {
    // Video content
    videoUrl?: string;
    videoId?: string;
    videoProvider?: 'youtube' | 'vimeo' | 'custom';
    videoQualities?: {
      quality: string;
      url: string;
      size: number;
    }[];
    duration?: number; // in seconds
    thumbnail?: string;
    chapters?: {
      id: string;
      title: string;
      startTime: number;
      endTime: number;
      thumbnail?: string;
    }[];
    
    // Text content
    textContent?: string;
    richContent?: any; // Rich text editor content
    
    // Interactive content
    interactiveElements?: {
      type: 'hotspot' | 'quiz' | 'simulation' | 'code-editor';
      config: any;
      position?: {
        x: number;
        y: number;
        timestamp?: number;
      };
    }[];
    
    // Document content
    documentUrl?: string;
    documentType?: 'pdf' | 'doc' | 'ppt' | 'xlsx';
    
    // Resources and attachments
    resources?: {
      id: string;
      title: string;
      type: 'pdf' | 'doc' | 'link' | 'image' | 'video' | 'audio';
      url: string;
      size?: number;
      description?: string;
      downloadable: boolean;
    }[];
    
    // Accessibility
    transcription?: string;
    captions?: {
      language: string;
      url: string;
      default?: boolean;
    }[];
    audioDescription?: string;
    
    // Notes and annotations
    allowNotes: boolean;
    allowHighlights: boolean;
    allowBookmarks: boolean;
  };
  
  // Lesson configuration
  order: number;
  isPublished: boolean;
  isPreview: boolean; // Can be accessed without enrollment
  isRequired: boolean;
  estimatedDuration: number; // in minutes
  
  // Prerequisites and dependencies
  prerequisites?: string[]; // lesson IDs
  completionCriteria: {
    type: 'time' | 'interaction' | 'quiz' | 'assignment' | 'manual';
    threshold?: number; // percentage or time
    requiredActions?: string[];
  };
  
  // Learning objectives
  learningObjectives?: string[];
  
  // Assessments
  quiz?: ModuleQuiz;
  assignment?: ModuleAssignment;
  
  // Accessibility and compliance
  accessibility: {
    hasTranscription: boolean;
    hasCaptions: boolean;
    hasAudioDescription: boolean;
    keyboardNavigable: boolean;
    screenReaderOptimized: boolean;
    alternativeFormats?: string[];
  };
  
  // Analytics and tracking
  analytics: {
    trackVideoProgress: boolean;
    trackInteractions: boolean;
    trackTimeSpent: boolean;
    heatmapEnabled: boolean;
  };
  
  // Gamification
  points?: number;
  badges?: string[];
  achievements?: string[];
}

// Enhanced CourseSection (Module) with better organization
export interface CourseSection {
  id: string;
  title: string;
  description: string;
  shortDescription?: string;
  
  // Module content
  lessons: CourseLesson[];
  
  // Module configuration
  order: number;
  isPublished: boolean;
  isRequired: boolean;
  estimatedDuration: number; // in seconds
  
  // Prerequisites
  prerequisites?: string[]; // section IDs
  unlockConditions?: {
    type: 'completion' | 'grade' | 'time' | 'date';
    target: string | number;
    operator: 'gte' | 'lte' | 'eq';
  }[];
  
  // Learning objectives
  learningObjectives: string[];
  
  // Module-level assessments
  moduleQuiz?: ModuleQuiz;
  moduleAssignment?: ModuleAssignment;
  
  // Progress tracking
  completionCriteria: {
    type: 'all_lessons' | 'percentage' | 'time' | 'assessment';
    threshold?: number;
    requiredAssessments?: string[];
  };
  
  // Accessibility
  accessibility: {
    hasAlternativeFormats: boolean;
    supportedFormats: string[];
    hasAccessibilityNotes: boolean;
    accessibilityNotes?: string;
  };
  
  // Scheduling
  schedule?: {
    availableFrom?: string;
    availableUntil?: string;
    recommendedPace?: string;
    deadlines?: {
      type: 'soft' | 'hard';
      date: string;
      description: string;
    }[];
  };
  
  // Resources
  resources?: {
    id: string;
    title: string;
    type: 'reading' | 'video' | 'tool' | 'reference' | 'template';
    url: string;
    description?: string;
    required: boolean;
  }[];
  
  // Discussion and collaboration
  discussion?: {
    enabled: boolean;
    moderationRequired: boolean;
    allowPeerInteraction: boolean;
    allowInstructorQA: boolean;
  };
}

export interface Course extends BaseDocument {
  type: 'course';
  id: string;
  title: string;
  description: string;
  shortDescription: string;
  instructorId: string;
  instructorName: string;
  category: CourseCategory;
  level: CourseLevel;
  status: CourseStatus;
  price: number;
  currency: string;
  language: 'en' | 'rw';
  thumbnail?: string;
  previewVideo?: string;
  tags: string[];
  requirements: string[];
  learningObjectives: string[];
  targetAudience: string;
  sections: CourseSection[];
  totalDuration: number; // in seconds
  totalLessons: number;
  
  // Final assessment
  finalAssessment?: {
    id: string;
    title: string;
    description: string;
    instructions: string;
    questions: QuizQuestion[];
    settings: {
      timeLimit: number;
      attempts: number;
      passingScore: number;
      shuffleQuestions: boolean;
      shuffleOptions: boolean;
      showResultsImmediately: boolean;
      showCorrectAnswers: boolean;
      allowReview: boolean;
      requireSequential: boolean;
    };
    grading: {
      autoGrade: boolean;
      gradingMethod: 'highest' | 'average' | 'latest';
      feedbackEnabled: boolean;
      detailedFeedback: boolean;
    };
  };
  
  // Workflow timestamps
  publishedAt?: string;
  submittedAt?: string;
  reviewStartedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  archivedAt?: string;
  suspendedAt?: string;
  
  // Approval and feedback
  approvalFeedback?: CourseApprovalFeedback;
  rejectionReason?: string;
  revisionNotes?: string;
  
  // Versioning
  version: string;
  isCurrentVersion: boolean;
  previousVersionId?: string;
  
  // Validation and quality
  validationResult?: CourseValidationResult;
  qualityScore: number; // 0-100
  
  // Workflow tracking
  workflowHistory: CourseWorkflowHistory[];
  
  // Content flags
  contentFlags: {
    hasVideo: boolean;
    hasQuizzes: boolean;
    hasAssignments: boolean;

    hasPrerequisites: boolean;
    isAccessible: boolean;
  };
  
  // Metrics and analytics
  metrics: CourseMetrics;
  
  // Rating and reviews
  rating: {
    average: number;
    count: number;
    distribution: {
      5: number;
      4: number;
      3: number;
      2: number;
      1: number;
    };
  };
  
  // Business metrics
  enrollmentCount: number;
  completionCount: number;
  revenue: number;
  
  // Marketing and SEO
  seo: {
    metaTitle?: string;
    metaDescription?: string;
    keywords?: string[];
    slug?: string;
  };
  
  // Accessibility and compliance
  accessibility: {
    compliantWith: string[]; // e.g., ['WCAG2.1', 'Section508']
    hasTranscriptions: boolean;
    hasCaptions: boolean;
    hasAudioDescriptions: boolean;
    keyboardNavigable: boolean;
    screenReaderOptimized: boolean;
  };
  
  // Scheduling and availability
  schedule: {
    availableFrom?: string;
    availableUntil?: string;
    enrollmentDeadline?: string;
    cohortBased: boolean;
    startDate?: string;
    endDate?: string;
  };
}

// Enrollment types
export type EnrollmentStatus = 'active' | 'completed' | 'suspended' | 'refunded';

export interface Enrollment extends BaseDocument {
  type: 'enrollment';
  id: string;
  userId: string;
  courseId: string;
  status: EnrollmentStatus;
  enrolledAt: string;
  completedAt?: string;
  progress: number; // 0-100
  lastAccessedAt?: string;
  paymentId?: string;
  refundId?: string;

  isReadOnly?: boolean; // For completed courses
  completionMetadata?: {
    completedAt: string;
    finalProgress: number;
    completionType: 'automatic' | 'manual';
    canRetake: boolean;

    completionMethod: 'progress_based' | 'exam_based';
  };
}

// Enhanced Progress tracking with module support
export interface Progress extends BaseDocument {
  type: 'progress';
  id: string;
  userId: string;
  courseId: string;
  completedLessons: string[];
  completedSections: string[];
  currentLesson?: string;
  currentSection?: string;
  timeSpent: number; // in seconds
  lastWatched?: string;
  overallProgress: number; // 0-100
  
  // Section-level progress
  sectionProgress: {
    [sectionId: string]: {
      completedLessons: string[];
      progress: number; // 0-100
      timeSpent: number;
      startedAt: string;
      completedAt?: string;
      quizScore?: number;
      assignmentGrade?: number;
    };
  };
  
  // Lesson-level progress
  lessonProgress: {
    [lessonId: string]: {
      startedAt: string;
      completedAt?: string;
      timeSpent: number;
      lastPosition?: number; // for videos
      interactions: {
        type: string;
        timestamp: string;
        data: any;
      }[];
      notes: {
        id: string;
        timestamp: number;
        content: string;
        createdAt: string;
      }[];
      bookmarks: {
        id: string;
        timestamp: number;
        title: string;
        createdAt: string;
      }[];
    };
  };
  
  // Quiz tracking
  quizScores: {
    [quizId: string]: {
      attempts: {
        id: string;
        score: number;
        maxScore: number;
        percentage: number;
        startedAt: string;
        completedAt: string;
        timeSpent: number;
        answers: {
          questionId: string;
          answer: any;
          correct: boolean;
          points: number;
          timeSpent: number;
        }[];
      }[];
      bestScore: number;
      bestPercentage: number;
      totalAttempts: number;
      passed: boolean;
  
    };
  };
  
  // Assignment tracking
  assignments: {
    [assignmentId: string]: {
      submissions: {
        id: string;
        submittedAt: string;
        grade?: number;
        feedback?: string;
        status: 'submitted' | 'graded' | 'returned' | 'resubmitted';
        rubricScores?: {
          criteriaId: string;
          score: number;
          feedback?: string;
        }[];
      }[];
      currentGrade?: number;
      passed: boolean;
      requiresResubmission: boolean;
    };
  };
  
  // Engagement metrics
  engagement: {
    sessionCount: number;
    averageSessionLength: number;
    longestSession: number;
    totalActiveTime: number;
    lastActiveAt: string;
    streakDays: number;
    completionVelocity: number; // lessons per day
    interactionRate: number; // interactions per lesson
  };
  
  // Achievement tracking
  achievements: {
    earnedAchievements: string[];
    progressTowardsAchievements: {
      [achievementId: string]: {
        progress: number;
        target: number;
        unlocked: boolean;
        unlockedAt?: string;
      };
    };
  };
}

// OTP types
export interface OTP extends BaseDocument {
  type: 'otp';
  id: string;
  email: string;
  code: string;
  purpose: 'signup' | 'password-reset' | 'email-verification';
  expiresAt: string;
  attempts: number;
  verified: boolean;
  verifiedAt?: string;
}

// Review types
export interface Review extends BaseDocument {
  type: 'review';
  id: string;
  courseId: string;
  userId: string;
  rating: number; // 1-5
  comment: string;
  helpful: number;
  reported: boolean;
  response?: {
    text: string;
    respondedAt: string;
    respondedBy: string;
  };
}

// Achievement types
export type AchievementType = 'milestone' | 'streak' | 'completion' | 'skill' | 'community';

export interface Achievement extends BaseDocument {
  type: 'achievement';
  id: string;
  name: string;
  description: string;
  icon: string;
  category: AchievementType;
  points: number;
  requirements: {
    type: string;
    target: number;
    criteria: any;
  };
  isActive: boolean;
}

export interface UserAchievement extends BaseDocument {
  type: 'user_achievement';
  id: string;
  userId: string;
  achievementId: string;
  unlockedAt: string;
  progress: number;
  isCompleted: boolean;
}

// Notification types
export type NotificationType = 
  | 'info' 
  | 'success' 
  | 'warning' 
  | 'error'
  | 'course_enrollment'
  | 'course_completion'
  | 'assignment_reminder'
  | 'course_announcement'
  | 'discussion_reply'
  | 'question_answered'
  | 'system_update'
  | 'welcome_email'
  | 'achievement_unlocked'

  | 'payment_received'
  | 'grade_posted'
  | 'message_received'
  | 'forum_post'
  | 'assignment_due'
  | 'course_deadline'
  | 'maintenance_notice';

export type NotificationCategory = 'course' | 'achievement' | 'system' | 'marketing' | 'reminder';

export interface Notification extends BaseDocument {
  type: 'notification';
  id: string;
  userId: string;
  title: string;
  message: string;
  category: NotificationCategory;
  notificationType: NotificationType;
  read: boolean;
  readAt?: string;
  actionUrl?: string;
  actionText?: string;
  expiresAt?: string;
}

// Payment types
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded' | 'cancelled';
export type PaymentMethod = 'credit_card' | 'paypal' | 'mobile_money' | 'bank_transfer';

export interface Payment extends BaseDocument {
  type: 'payment';
  id: string;
  userId: string;
  courseId: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  transactionId?: string;
  gatewayResponse?: any;
  failureReason?: string;
  refundAmount?: number;
  refundedAt?: string;
}

// Analytics types
export interface Analytics extends BaseDocument {
  type: 'analytics';
  id: string;
  entityType: 'user' | 'course' | 'system';
  entityId: string;
  event: string;
  data: any;
  timestamp: string;
  sessionId?: string;
  userAgent?: string;
  ipAddress?: string;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  errors?: any[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// Request types
export interface PaginationQuery {
  page?: string;
  limit?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface SearchQuery extends PaginationQuery {
  search?: string;
  category?: string;
  level?: string;
  status?: string;
  role?: string;
}

// JWT Payload types
export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  userId: string;
  tokenId: string;
  iat: number;
  exp?: number;
}

// Email types
export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: any[];
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}



// PWA types
export interface SyncData {
  type: 'course-progress' | 'user-data' | 'offline-actions';
  data: any;
  timestamp: string;
  userId: string;
}

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface PushNotification {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: any;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
}

// Analytics Types
export interface AnalyticsData {
  userBehavior: {
    dailyActiveUsers: {
      date: string;
      count: number;
    }[];
    sessionDuration: {
      range: string;
      count: number;
    }[];
    deviceBreakdown: {
      device: string;
      percentage: number;
      count: number;
    }[];
    peakHours: {
      hour: number;
      activity: number;
    }[];
    geographicData: {
      country: string;
      users: number;
      sessions: number;
    }[];
  };
  coursePerformance: {
    topCourses: {
      id: string;
      title: string;
      enrollments: number;
      completions: number;
      rating: number;
    }[];
    categoryDistribution: {
      category: string;
      count: number;
      percentage: number;
    }[];
    completionTrends: {
      month: string;
      completions: number;
      enrollments: number;
      rate: number;
    }[];
  };
  businessIntelligence: {
    revenue: {
      total: number;
      growth: number;
      forecast: number;
    };
    userGrowth: {
      total: number;
      growth: number;
      churnRate: number;
    };
    engagement: {
      avgSessionTime: number;
      returnRate: number;
      activeUsers: number;
    };
  };
}

// Content Management Types
export interface ContentVersion extends BaseDocument {
  type: 'content_version';
  id: string;
  contentId: string;
  version: string;
  title: string;
  description: string;
  author: string;
  changes: {
    type: 'created' | 'updated' | 'deleted';
    description: string;
    diff?: string;
  };
  snapshot: any;
  isPublished: boolean;
  publishedAt?: string;
  rollbackAvailable: boolean;
}

export interface ContentTemplate extends BaseDocument {
  type: 'content_template';
  id: string;
  name: string;
  description: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  template: any;
  previewImage?: string;
  tags: string[];
  usageCount: number;
  rating: number;
  author: string;
  isPublic: boolean;
  isVerified: boolean;
}

export interface ContentLibraryItem extends BaseDocument {
  type: 'library_item';
  id: string;
  title: string;
  description: string;
  contentType: 'video' | 'document' | 'image' | 'audio' | 'interactive';
  url: string;
  metadata: {
    size: number;
    duration?: number;
    dimensions?: {
      width: number;
      height: number;
    };
    fileType?: string;
    language?: string;
    tags: string[];
    category: string;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
  };
  usage: {
    timesUsed: number;
    courses: string[];
    lastUsed: string;
  };
  permissions: {
    public: boolean;
    shareableLink: boolean;
    downloadable: boolean;
    editableBy: string[];
  };
  status: 'active' | 'archived' | 'processing' | 'failed';
  createdBy: string;
  approvedBy?: string;
  approvalStatus: 'pending' | 'approved' | 'rejected';
}

export interface CollaborativeSession extends BaseDocument {
  type: 'collaborative_session';
  id: string;
  contentId: string;
  courseId: string;
  participants: {
    userId: string;
    role: 'editor' | 'viewer' | 'commenter';
    joinedAt: string;
    lastActive: string;
    isActive: boolean;
  }[];
  status: 'active' | 'paused' | 'ended';
  sessionType: 'editing' | 'review' | 'discussion';
  startedAt: string;
  endedAt?: string;
  changes: {
    userId: string;
    action: string;
    timestamp: string;
    data: any;
  }[];
  permissions: {
    allowAnonymous: boolean;
    requireApproval: boolean;
    maxParticipants: number;
  };
}

// Mobile Optimization Types
export interface MobileDevice extends BaseDocument {
  type: 'mobile_device';
  id: string;
  userId: string;
  deviceId: string;
  deviceType: 'ios' | 'android' | 'web';
  deviceModel: string;
  osVersion: string;
  appVersion: string;
  registeredAt: string;
  lastSync: string;
  isActive: boolean;
  pushToken?: string;
  settings: {
    offlineMode: boolean;
    dataSync: boolean;
    pushNotifications: boolean;
    downloadQuality: 'low' | 'medium' | 'high';
    autoDownload: boolean;
    wifiOnly: boolean;
  };
  capabilities: {
    storage: number;
    maxDownloadSize: number;
    supportedFormats: string[];
    hasCamera: boolean;
    hasMicrophone: boolean;
    hasGPS: boolean;
  };
  usage: {
    totalDownloads: number;
    storageUsed: number;
    lastActive: string;
    sessionCount: number;
    totalTime: number;
  };
}

export interface MobileOptimizedContent extends BaseDocument {
  type: 'mobile_optimized_content';
  id: string;
  originalContentId: string;
  contentType: 'video' | 'document' | 'image' | 'audio';
  optimizations: {
    resolution: string;
    bitrate: number;
    format: string;
    size: number;
    quality: 'low' | 'medium' | 'high';
  };
  url: string;
  downloadUrl: string;
  metadata: {
    originalSize: number;
    optimizedSize: number;
    compressionRatio: number;
    processingTime: number;
    algorithm: string;
  };
  status: 'processing' | 'ready' | 'failed';
  createdAt: string;
  expiresAt?: string;
  downloadCount: number;
  isPublic: boolean;
}

export interface MobileSession extends BaseDocument {
  type: 'mobile_session';
  id: string;
  userId: string;
  deviceId: string;
  courseId: string;
  sessionType: 'online' | 'offline' | 'sync';
  startedAt: string;
  endedAt?: string;
  duration: number;
  activities: {
    type: 'video_watch' | 'quiz_take' | 'assignment_work' | 'discussion_read';
    contentId: string;
    timeSpent: number;
    progress: number;
    timestamp: string;
  }[];
  metrics: {
    dataUsage: number;
    batteryUsage: number;
    networkType: string;
    connectionQuality: 'excellent' | 'good' | 'poor' | 'offline';
  };
  syncStatus: {
    pending: boolean;
    lastSync: string;
    retryCount: number;
    errorMessage?: string;
  };
}

// Security Types
export interface SecurityEvent extends BaseDocument {
  type: 'security_event';
  id: string;
  userId?: string;
  eventType: 'login' | 'logout' | 'failed_login' | 'password_change' | 'suspicious_activity' | 'account_locked' | 'data_access';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  metadata: {
    ipAddress: string;
    userAgent: string;
    location?: string;
    deviceFingerprint?: string;
    sessionId?: string;
    [key: string]: any;
  };
  timestamp: string;
  resolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  notes?: string;
}

export interface AuditLog extends BaseDocument {
  type: 'audit_log';
  id: string;
  timestamp: string;
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  changes: any;
  metadata: {
    ip_address: string;
    user_agent: string;
    session_id: string;
    request_id: string;
  };
  risk_assessment: {
    score: number;
    factors: string[];
    automated_response: boolean;
  };
  compliance: {
    gdpr: boolean;
    ccpa: boolean;
    retention_period: number;
    data_classification: string;
  };
}

export interface DataProtectionRecord extends BaseDocument {
  type: 'data_protection_record';
  id: string;
  userId: string;
  dataType: 'personal' | 'sensitive' | 'financial' | 'biometric';
  action: 'collect' | 'process' | 'store' | 'transfer' | 'delete';
  purpose: string;
  legalBasis: string;
  consentId?: string;
  retentionPeriod: number;
  encrypted: boolean;
  pseudonymized: boolean;
  transferredTo?: string;
  deletedAt?: string;
  complianceStatus: 'compliant' | 'non_compliant' | 'under_review';
}

export interface DataSubjectRequest extends BaseDocument {
  type: 'data_subject_request';
  id: string;
  userId: string;
  requestType: 'access' | 'rectification' | 'erasure' | 'portability' | 'restriction' | 'objection';
  status: 'pending' | 'in_progress' | 'completed' | 'rejected';
  requestedAt: string;
  completedAt?: string;
  response?: string;
  attachments?: string[];
  verificationMethod: 'email' | 'sms' | 'document' | 'biometric';
  verifiedAt?: string;
  processingNotes?: string;
}

export interface ComplianceReport extends BaseDocument {
  type: 'compliance_report';
  id: string;
  reportType: 'gdpr' | 'ccpa' | 'security' | 'data_breach';
  period: {
    start: string;
    end: string;
  };
  metrics: {
    totalRequests: number;
    completedRequests: number;
    pendingRequests: number;
    breaches: number;
    complianceScore: number;
  };
  findings: {
    type: 'violation' | 'risk' | 'recommendation';
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    remediation?: string;
  }[];
  generatedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  published: boolean;
}

// Message and Communication types
// Assessment Types
export interface AssessmentAttempt extends BaseDocument {
  type: 'assessment_attempt';
  id: string;
  assessmentId: string;
  userId: string;
  attemptNumber: number;
  startTime: string;
  endTime?: string;
  timeSpent: number;
  answers: {
    questionId: string;
    answer: any;
    timeSpent: number;
    flagged?: boolean;
    confidence?: number;
  }[];
  proctoring: {
    sessionId: string;
    recordings: {
      type: 'video' | 'audio' | 'screen';
      url: string;
      startTime: string;
      endTime: string;
    }[];
    violations: {
      type: string;
      timestamp: string;
      severity: 'low' | 'medium' | 'high';
      description: string;
      evidence?: string;
    }[];
    flagged: boolean;
  };
  grading: {
    score: number;
    maxScore: number;
    percentage: number;
    gradeBreakdown: {
      questionId: string;
      score: number;
      maxScore: number;
      feedback?: string;
    }[];
    feedback?: string;
    gradedAt?: string;
    gradedBy?: string;
    autoGraded: boolean;
  };
  status: 'in_progress' | 'completed' | 'submitted' | 'graded' | 'failed';
  metadata: {
    browserFingerprint?: string;
    ipAddress?: string;
    userAgent?: string;
    screenResolution?: string;
    timezone?: string;
    deviceType?: string;
    operatingSystem?: string;
    [key: string]: any;
  };
}

export interface AdvancedAssessment extends BaseDocument {
  type: 'assessment';
  id: string;
  courseId: string;
  creatorId: string;
  title: string;
  description: string;
  instructions: string;
  questions: any[];
  settings: {
    timeLimit: number;
    maxAttempts: number;
    passingScore: number;
    shuffleQuestions: boolean;
    shuffleAnswers: boolean;
    showResults: boolean;
    showCorrectAnswers: boolean;
    allowReview: boolean;

    requireSequential: boolean;
    lockdownBrowser: boolean;
    preventCopyPaste: boolean;
    fullScreenMode: boolean;
  };
  proctoring: {
    enabled: boolean;
    webcamRequired: boolean;
    microphoneRequired: boolean;
    screenRecording: boolean;
    tabSwitchDetection: boolean;
    copyPasteDetection: boolean;
    keystrokeAnalysis: boolean;
    aiMonitoring: boolean;
    humanReview: boolean;
    tolerance: 'strict' | 'moderate' | 'lenient';
  };
  grading: {
    autoGrade: boolean;
    method: 'weighted' | 'equal' | 'custom';
    passingGrade: number;
    gradingRubric?: string;
    partialCredit: boolean;
    negativeMarking: boolean;
    penaltyPercentage: number;
  };
  availability: {
    startDate: string;
    endDate: string;
    unlockConditions: string[];
    prerequisites: string[];
    allowLateSubmission: boolean;
    latePenalty: number;
  };
  analytics: {
    totalAttempts: number;
    avgScore: number;
    avgTimeSpent: number;
    completionRate: number;
    flaggedAttempts: number;
    difficultyAnalysis: {
      questionId: string;
      difficulty: number;
      discrimination: number;
      averageTime: number;
    }[];
  };
  security: {
    encryptionEnabled: boolean;
    watermark: boolean;
    printDisabled: boolean;
    rightClickDisabled: boolean;
    keyboardShortcutsDisabled: boolean;
    developerToolsBlocked: boolean;
  };
}

export type MessageType = 'text' | 'announcement' | 'question' | 'answer' | 'discussion' | 'direct' | 'system';
export type MessageStatus = 'sent' | 'delivered' | 'read' | 'failed';

export interface MessageReaction {
  userId: string;
  emoji: string;
  createdAt: string;
}

export interface MessageReadBy {
  userId: string;
  readAt: string;
}

export interface MessageAttachment {
  id: string;
  type: 'image' | 'document' | 'video' | 'audio' | 'link';
  url: string;
  filename: string;
  size: number;
  mimetype?: string;
}

export interface MessageEditHistory {
  previousContent: string;
  editedAt: string;
  editedBy: string;
}

export interface Message extends BaseDocument {
  type: 'message';
  id: string;
  conversationId: string;
  courseId?: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  content: string;
  messageType: MessageType;
  status: MessageStatus;
  parentMessageId?: string; // For threaded conversations
  threadCount: number;
  readBy: MessageReadBy[];
  reactions: MessageReaction[];
  attachments: MessageAttachment[];
  isEdited: boolean;
  isDeleted: boolean;
  deletedAt?: string;
  deletedBy?: string;
  editHistory: MessageEditHistory[];
  metadata?: {
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    tags?: string[];
    mentions?: string[];
    isAnnouncement?: boolean;
    isPinned?: boolean;
    isThreadStarter?: boolean;
    questionTitle?: string;
    votes?: number;
    title?: string;
    threadTitle?: string;
    [key: string]: any; // Allow additional properties
  };
}



// Express Request extensions
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
} 