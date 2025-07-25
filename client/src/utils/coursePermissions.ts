interface User {
  id: string;
  role: 'admin' | 'tutor' | 'learner';
  [key: string]: any;
}

interface Course {
  id: string;
  instructorId?: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'published';
  [key: string]: any;
}

export interface CoursePermissions {
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canSubmitForReview: boolean;
  canApprove: boolean;
  canReject: boolean;
  canPublish: boolean;
  canManageContent: boolean;
  canTakeQuizzes: boolean;
  canWatchVideos: boolean;
  canViewGrades: boolean;
}

export const getCoursePermissions = (user: User | null, course: Course): CoursePermissions => {
  // Default permissions for unauthenticated users
  if (!user) {
    return {
      canView: false,
      canEdit: false,
      canDelete: false,
      canSubmitForReview: false,
      canApprove: false,
      canReject: false,
      canPublish: false,
      canManageContent: false,
      canTakeQuizzes: false,
      canWatchVideos: false,
      canViewGrades: false,
    };
  }

  const isAdmin = user.role === 'admin';
  const isTutor = user.role === 'tutor';
  const isLearner = user.role === 'learner';
  const isCourseOwner = isTutor && course.instructorId === user.id;

  // Admin permissions - full access to all submitted and published courses
  if (isAdmin) {
    const canAccessCourse = ['submitted', 'approved', 'published'].includes(course.status);
    return {
      canView: canAccessCourse,
      canEdit: canAccessCourse,
      canDelete: canAccessCourse,
      canSubmitForReview: false, // Admins don't submit courses
      canApprove: course.status === 'submitted',
      canReject: course.status === 'submitted',
      canPublish: course.status === 'approved',

      canManageContent: canAccessCourse,
      canTakeQuizzes: false, // Admins don't take quizzes
      canWatchVideos: canAccessCourse,
      canViewGrades: canAccessCourse,
    };
  }

  // Tutor permissions - complete permissions only on their own courses
  if (isTutor) {
    if (isCourseOwner) {
      return {
        canView: true,
        canEdit: ['draft', 'rejected', 'approved', 'published'].includes(course.status), // ✅ Allow editing approved/published courses
        canDelete: course.status === 'draft',
        canSubmitForReview: ['draft', 'rejected'].includes(course.status),
        canApprove: false,
        canReject: false,
        canPublish: false, // ✅ No longer needed - courses auto-publish after admin approval
        canManageContent: ['draft', 'rejected', 'approved', 'published'].includes(course.status), // ✅ Allow content management
        canTakeQuizzes: true, // Course owners can always access their quizzes for testing/management
        canWatchVideos: true,
        canViewGrades: true,
      };
    } else {
      // Tutor accessing other courses - same as learner
      return {
        canView: course.status === 'published',
        canEdit: false,
        canDelete: false,
        canSubmitForReview: false,
        canApprove: false,
        canReject: false,
        canPublish: false,
        canManageContent: false,
        canTakeQuizzes: course.status === 'published',
        canWatchVideos: course.status === 'published',
        canViewGrades: course.status === 'published',
      };
    }
  }

  // Learner permissions - can only learn and interact with published courses
  if (isLearner) {
    return {
      canView: course.status === 'published',
      canEdit: false,
      canDelete: false,
      canSubmitForReview: false,
      canApprove: false,
      canReject: false,
      canPublish: false,
      canManageContent: false,
      canTakeQuizzes: course.status === 'published',
      canWatchVideos: course.status === 'published',
      canViewGrades: course.status === 'published',
    };
  }

  // Default fallback
  return {
    canView: false,
    canEdit: false,
    canDelete: false,
    canSubmitForReview: false,
    canApprove: false,
    canReject: false,
    canPublish: false,
    canManageContent: false,
    canTakeQuizzes: false,
    canWatchVideos: false,
    canViewGrades: false,
  };
};

export const getAvailableTabs = (permissions: CoursePermissions): Array<{
  id: string;
  label: string;
  icon: string;
  available: boolean;
}> => {
  return [
    {
      id: 'home',
      label: 'Overview',
      icon: 'BookOpen',
      available: permissions.canView,
    },
    {
      id: 'modules',
      label: 'Modules',
      icon: 'PlayCircle',
      available: permissions.canWatchVideos || permissions.canManageContent,
    },
    {
      id: 'assessments',
      label: 'Assessments',
      icon: 'Award',
      available: permissions.canTakeQuizzes || permissions.canManageContent,
    },
    {
      id: 'grades',
      label: 'Grades',
      icon: 'BarChart3',
      available: permissions.canViewGrades,
    },

  ];
};

export const canAccessCourse = (user: User | null, course: Course): boolean => {
  const permissions = getCoursePermissions(user, course);
  return permissions.canView;
};

export const getPermissionMessage = (user: User | null, course: Course): string => {
  if (!user) {
    return 'You need to be logged in to access this course.';
  }

  const isAdmin = user.role === 'admin';
  const isTutor = user.role === 'tutor';
  const isLearner = user.role === 'learner';
  const isCourseOwner = isTutor && course.instructorId === user.id;

  if (isAdmin) {
    if (!['submitted', 'approved', 'published'].includes(course.status)) {
      return 'This course is not yet available for admin review.';
    }
  }

  if (isTutor && !isCourseOwner) {
    if (course.status !== 'published') {
      return 'This course is not yet published for learning.';
    }
  }

  if (isLearner) {
    if (course.status !== 'published') {
      return 'This course is not yet published for learning.';
    }
  }

  return 'You have access to this course.';
}; 