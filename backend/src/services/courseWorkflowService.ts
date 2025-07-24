import { courseModel } from '../models/Course';
import { userModel } from '../models/User';
import { emailService } from './emailService';
import { logger } from '../utils/logger';
import { config } from '../config/config';
import { 
  Course, 
  CourseStatus, 
  CourseWorkflowAction, 
  CourseWorkflowHistory, 
  CourseValidationResult, 
  CourseApprovalFeedback,
  CourseVersion,
  User,
  UserRole
} from '../types';
import { v4 as uuidv4 } from 'uuid';

export class CourseWorkflowService {
  
  // Valid state transitions for course workflow
  private static readonly VALID_TRANSITIONS: Record<CourseStatus, CourseStatus[]> = {
    draft: ['pending', 'submitted'], // Allow direct submission to pending
    pending: ['approved', 'rejected', 'draft'], // Simple pending to approval flow
    submitted: ['under_review', 'draft', 'approved', 'rejected'], // Legacy support
    under_review: ['approved', 'rejected'],
    approved: ['published', 'rejected'],
    rejected: ['draft', 'pending'],
    published: ['archived', 'suspended'],
    archived: ['published'],
    suspended: ['published', 'archived']
  };

  /**
   * Create a new course with proper initialization
   */
  async createCourse(courseData: Partial<Course>, createdBy: User): Promise<Course> {
    try {
      // Initialize course with default values
      const initializedCourse = await this.initializeCourse(courseData, createdBy);
      
      // Validate course content
      const validationResult = await this.validateCourseContent(initializedCourse);
      initializedCourse.validationResult = validationResult;
      initializedCourse.qualityScore = validationResult.score;
      
      // Create the course
      const course = await courseModel.create(initializedCourse);
      
      // Log workflow action
      await this.logWorkflowAction(course, 'create', 'draft', 'draft', createdBy);
      
      logger.info('Course created successfully', {
        courseId: course._id,
        title: course.title,
        instructorId: course.instructorId,
        status: course.status
      });
      
      return course;
    } catch (error) {
      logger.error('Failed to create course:', error);
      throw error;
    }
  }

  /**
   * Submit course for approval
   */
  async submitCourse(courseId: string, submittedBy: User): Promise<Course> {
    try {
      const course = await courseModel.findById(courseId);
      if (!course) {
        throw new Error('Course not found');
      }

      // Check permissions
      if (submittedBy.role !== 'admin' && course.instructorId !== submittedBy.id) {
        throw new Error('Unauthorized: You can only submit your own courses');
      }

      // Validate state transition
      if (!this.isValidTransition(course.status, 'submitted')) {
        throw new Error(`Invalid state transition from ${course.status} to submitted`);
      }

      // Validate course content before submission
      const validationResult = await this.validateCourseContent(course);
      
      if (!validationResult.isValid) {
        throw new Error(`Course validation failed: ${validationResult.errors.map(e => e.message).join(', ')}`);
      }

      // NORMAL APPROVAL WORKFLOW: All courses require manual admin approval
      // Update course status
      const updatedCourse = await this.transitionCourseStatus(
        courseId,
        'submitted',
        'submit',
        submittedBy,
        'Course submitted for approval'
      );

      // Notify admins about new submission
      await this.notifyAdminsOfSubmission(updatedCourse);

      logger.info('Course submitted for approval', {
        courseId,
        title: course.title,
        submittedBy: submittedBy.id
      });

      return updatedCourse;
    } catch (error) {
      logger.error('Failed to submit course:', error);
      throw error;
    }
  }

  /**
   * Start review process (admin only)
   */
  async startReview(courseId: string, reviewedBy: User): Promise<Course> {
    try {
      if (reviewedBy.role !== 'admin') {
        throw new Error('Unauthorized: Only admins can start course reviews');
      }

      const course = await courseModel.findById(courseId);
      if (!course) {
        throw new Error('Course not found');
      }

      if (!this.isValidTransition(course.status, 'under_review')) {
        throw new Error(`Invalid state transition from ${course.status} to under_review`);
      }

      const updatedCourse = await this.transitionCourseStatus(
        courseId,
        'under_review',
        'review',
        reviewedBy,
        'Course review started'
      );

      // Notify instructor that review has started
      await this.notifyInstructorOfReviewStart(updatedCourse);

      logger.info('Course review started', {
        courseId,
        reviewedBy: reviewedBy.id
      });

      return updatedCourse;
    } catch (error) {
      logger.error('Failed to start course review:', error);
      throw error;
    }
  }

  /**
   * Approve course (admin only) - with auto-publish
   */
  async approveCourse(
    courseId: string,
    approvedBy: User,
    feedback: Partial<CourseApprovalFeedback>
  ): Promise<Course> {
    try {
      if (approvedBy.role !== 'admin') {
        throw new Error('Unauthorized: Only admins can approve courses');
      }

      const course = await courseModel.findById(courseId);
      if (!course) {
        throw new Error('Course not found');
      }

      if (!this.isValidTransition(course.status, 'approved')) {
        throw new Error(`Invalid state transition from ${course.status} to approved`);
      }

      // Create approval feedback
      const approvalFeedback: CourseApprovalFeedback = {
        id: uuidv4(),
        reviewerId: approvedBy.id,
        reviewerName: approvedBy.name,
        status: 'approved',
        overallScore: feedback.overallScore || 85,
        criteria: feedback.criteria || {
          contentQuality: 85,
          technicalQuality: 85,
          marketability: 85,
          accessibility: 85,
          engagement: 85
        },
        feedback: feedback.feedback || {
          strengths: ['Well-structured content'],
          improvements: [],
          requirements: []
        },
        detailedComments: feedback.detailedComments || [],
        reviewedAt: new Date().toISOString(),
        estimatedRevisionTime: feedback.estimatedRevisionTime || '1 week'
      };

      // Update course with approval and auto-publish
      const updatedCourse = await courseModel.update(courseId, {
        status: 'published', // Auto-publish after approval
        approvedAt: new Date().toISOString(),
        publishedAt: new Date().toISOString(), // Set published timestamp
        approvalFeedback,
        qualityScore: approvalFeedback.overallScore
      });

      // Log workflow action for approval
      await this.logWorkflowAction(
        updatedCourse,
        'approve',
        course.status,
        'approved',
        approvedBy,
        'Course approved and auto-published'
      );

      // Log workflow action for publishing
      await this.logWorkflowAction(
        updatedCourse,
        'publish',
        'approved',
        'published',
        approvedBy,
        'Course auto-published after approval'
      );

      // Notify instructor of approval and auto-publishing
      await this.notifyInstructorOfApproval(updatedCourse, approvalFeedback);

      logger.info('Course approved and auto-published', {
        courseId,
        approvedBy: approvedBy.id,
        overallScore: approvalFeedback.overallScore
      });

      return updatedCourse;
    } catch (error) {
      logger.error('Failed to approve course:', error);
      throw error;
    }
  }

  /**
   * Reject course (admin only)
   */
  async rejectCourse(
    courseId: string,
    rejectedBy: User,
    feedback: Partial<CourseApprovalFeedback>,
    rejectionReason: string
  ): Promise<Course> {
    try {
      if (rejectedBy.role !== 'admin') {
        throw new Error('Unauthorized: Only admins can reject courses');
      }

      const course = await courseModel.findById(courseId);
      if (!course) {
        throw new Error('Course not found');
      }

      if (!this.isValidTransition(course.status, 'rejected')) {
        throw new Error(`Invalid state transition from ${course.status} to rejected`);
      }

      // Create rejection feedback
      const rejectionFeedback: CourseApprovalFeedback = {
        id: uuidv4(),
        reviewerId: rejectedBy.id,
        reviewerName: rejectedBy.name,
        status: 'rejected',
        overallScore: feedback.overallScore || 40,
        criteria: feedback.criteria || {
          contentQuality: 40,
          technicalQuality: 40,
          marketability: 40,
          accessibility: 40,
          engagement: 40
        },
        feedback: feedback.feedback || {
          strengths: [],
          improvements: ['Needs significant improvement'],
          requirements: ['Address all critical issues']
        },
        detailedComments: feedback.detailedComments || [],
        reviewedAt: new Date().toISOString(),
        estimatedRevisionTime: feedback.estimatedRevisionTime || '1-2 weeks'
      };

      // Update course with rejection
      const updatedCourse = await this.transitionCourseStatus(
        courseId,
        'rejected',
        'reject',
        rejectedBy,
        rejectionReason
      );

      // Update with detailed feedback
      await courseModel.update(courseId, {
        rejectionReason,
        approvalFeedback: rejectionFeedback,
        qualityScore: rejectionFeedback.overallScore
      });

      const finalCourse = await courseModel.findById(courseId);

      // Notify instructor of rejection
      await this.notifyInstructorOfRejection(finalCourse!, rejectionFeedback, rejectionReason);

      logger.info('Course rejected', {
        courseId,
        rejectedBy: rejectedBy.id,
        reason: rejectionReason
      });

      return finalCourse!;
    } catch (error) {
      logger.error('Failed to reject course:', error);
      throw error;
    }
  }

  /**
   * Publish course (admin only or auto after approval)
   */
  async publishCourse(courseId: string, publishedBy: User): Promise<Course> {
    try {
      const course = await courseModel.findById(courseId);
      if (!course) {
        throw new Error('Course not found');
      }

      if (!this.isValidTransition(course.status, 'published')) {
        throw new Error(`Invalid state transition from ${course.status} to published`);
      }

      // Create a version snapshot before publishing
      await this.createVersionSnapshot(course, publishedBy);

      // Update course status
      const updatedCourse = await this.transitionCourseStatus(
        courseId,
        'published',
        'publish',
        publishedBy,
        'Course published and available to learners'
      );

      logger.info('Course published', {
        courseId,
        publishedBy: publishedBy.id
      });

      return updatedCourse;
    } catch (error) {
      logger.error('Failed to publish course:', error);
      throw error;
    }
  }

  /**
   * Archive course
   */
  async archiveCourse(courseId: string, archivedBy: User, reason: string): Promise<Course> {
    try {
      const course = await courseModel.findById(courseId);
      if (!course) {
        throw new Error('Course not found');
      }

      // Check permissions
      if (archivedBy.role !== 'admin' && course.instructorId !== archivedBy.id) {
        throw new Error('Unauthorized: You can only archive your own courses');
      }

      if (!this.isValidTransition(course.status, 'archived')) {
        throw new Error(`Invalid state transition from ${course.status} to archived`);
      }

      const updatedCourse = await this.transitionCourseStatus(
        courseId,
        'archived',
        'archive',
        archivedBy,
        reason
      );

      logger.info('Course archived', {
        courseId,
        archivedBy: archivedBy.id,
        reason
      });

      return updatedCourse;
    } catch (error) {
      logger.error('Failed to archive course:', error);
      throw error;
    }
  }

  /**
   * Get all submitted courses for admin review
   */
  async getSubmittedCourses(options: {
    page?: number;
    limit?: number;
    sortBy?: 'submittedAt' | 'title' | 'qualityScore';
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<{
    courses: Course[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    try {
      const result = await courseModel.findCourses({
        status: 'submitted',
        page: options.page || 1,
        limit: options.limit || 10,
        sortBy: options.sortBy || 'submittedAt',
        sortOrder: options.sortOrder || 'desc'
      });

      // Enrich with instructor information
      const enrichedCourses = await Promise.all(
        result.courses.map(async (course) => {
          try {
            const instructor = await userModel.findById(course.instructorId);
            return {
              ...course,
              instructorName: instructor?.name || 'Unknown',
              instructorEmail: instructor?.email || 'Unknown'
            };
          } catch (error) {
            logger.warn('Failed to fetch instructor info for course:', { courseId: course._id, error });
            return course;
          }
        })
      );

      return {
        courses: enrichedCourses,
        pagination: result.pagination
      };
    } catch (error) {
      logger.error('Failed to get submitted courses:', error);
      throw error;
    }
  }

  /**
   * Get courses under review
   */
  async getCoursesUnderReview(): Promise<Course[]> {
    try {
      const result = await courseModel.findCourses({
        status: 'under_review',
        limit: 100
      });

      return result.courses;
    } catch (error) {
      logger.error('Failed to get courses under review:', error);
      throw error;
    }
  }

  /**
   * Validate course content
   */
  private async validateCourseContent(course: Partial<Course>): Promise<CourseValidationResult> {
    const errors: CourseValidationResult['errors'] = [];
    const warnings: CourseValidationResult['warnings'] = [];
    let score = 100;

    // Basic validation
    if (!course.title || course.title.trim().length < 3) {
      errors.push({
        field: 'title',
        message: 'Title must be at least 3 characters long',
        severity: 'error'
      });
      score -= 20;
    }

    if (!course.description || course.description.trim().length < 20) {
      errors.push({
        field: 'description',
        message: 'Description must be at least 20 characters long',
        severity: 'error'
      });
      score -= 15;
    }

    if (!course.category) {
      errors.push({
        field: 'category',
        message: 'Category is required',
        severity: 'error'
      });
      score -= 10;
    }

    if (!course.level) {
      errors.push({
        field: 'level',
        message: 'Level is required',
        severity: 'error'
      });
      score -= 10;
    }

    // Content validation
    if (!course.sections || course.sections.length === 0) {
      errors.push({
        field: 'sections',
        message: 'Course must have at least one section',
        severity: 'error'
      });
      score -= 25;
    } else {
      // Validate sections
      const totalLessons = course.sections.reduce((sum, section) => sum + section.lessons.length, 0);
      if (totalLessons < 3) {
        warnings.push({
          field: 'sections',
          message: 'Course should have at least 3 lessons for better learning outcomes',
          suggestion: 'Add more lessons or combine existing content'
        });
        score -= 5;
      }

      // Check for video content
      const hasVideo = course.sections.some(section => 
        section.lessons.some(lesson => lesson.type === 'video' && lesson.content.videoUrl)
      );
      if (!hasVideo) {
        warnings.push({
          field: 'content',
          message: 'Course without video content may have lower engagement',
          suggestion: 'Consider adding video lessons'
        });
        score -= 10;
      }

      // Check for assessments
      const hasAssessments = course.sections.some(section => 
        section.lessons.some(lesson => lesson.type === 'quiz' || lesson.type === 'assignment')
      );
      if (!hasAssessments) {
        warnings.push({
          field: 'assessments',
          message: 'Course should include quizzes or assignments',
          suggestion: 'Add assessments to validate learning'
        });
        score -= 10;
      }
    }

    // Learning objectives validation - removed to simplify submission

    // Accessibility validation
    if (course.sections) {
      const hasAccessibilityFeatures = course.sections.some(section =>
        section.lessons.some(lesson => 
          lesson.accessibility?.hasTranscription || lesson.accessibility?.hasCaptions
        )
      );
      if (!hasAccessibilityFeatures) {
        warnings.push({
          field: 'accessibility',
          message: 'Consider adding accessibility features like captions or transcriptions',
          suggestion: 'Improve accessibility to reach more learners'
        });
        score -= 5;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      score: Math.max(0, score)
    };
  }

  /**
   * Initialize course with default values
   */
  private async initializeCourse(courseData: Partial<Course>, createdBy: User): Promise<Omit<Course, '_id' | '_rev' | 'createdAt' | 'updatedAt'>> {
    const now = new Date().toISOString();
    
    return {
      type: 'course',
      id: uuidv4(),
      title: courseData.title || '',
      description: courseData.description || '',
      shortDescription: courseData.shortDescription || '',
      instructorId: createdBy.id,
      instructorName: createdBy.name,
      category: courseData.category || 'general-it',
      level: courseData.level || 'beginner',
      status: 'draft',
      price: courseData.price || 0,
      currency: courseData.currency || 'USD',
      language: courseData.language || 'en',
      thumbnail: courseData.thumbnail || '',
      previewVideo: courseData.previewVideo || '',
      tags: courseData.tags || [],
      requirements: courseData.requirements || [],
      learningObjectives: courseData.learningObjectives || [],
      targetAudience: courseData.targetAudience || '',
      sections: courseData.sections || [],
      totalDuration: courseData.totalDuration || 0,
      totalLessons: courseData.totalLessons || 0,
      version: '1.0.0',
      isCurrentVersion: true,
      qualityScore: 0,
      workflowHistory: [],
      contentFlags: {
        hasVideo: false,
        hasQuizzes: false,
        hasAssignments: false,

        hasPrerequisites: false,
        isAccessible: false
      },
      metrics: {
        views: 0,
        completionRate: 0,
        avgTimeToComplete: 0,
        dropoffPoints: [],
        engagement: {
          avgSessionDuration: 0,
          returnRate: 0,
          discussionPosts: 0
        },
        performance: {
          avgQuizScore: 0,
          assignmentSubmissionRate: 0,
  
        }
      },
      rating: {
        average: 0,
        count: 0,
        distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
      },
      enrollmentCount: 0,
      completionCount: 0,
      revenue: 0,
      seo: {
        metaTitle: courseData.title || 'Untitled Course',
        metaDescription: courseData.shortDescription || 'No description available',
        keywords: courseData.tags || [],
        slug: courseData.title?.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'untitled-course'
      },
      accessibility: {
        compliantWith: [],
        hasTranscriptions: false,
        hasCaptions: false,
        hasAudioDescriptions: false,
        keyboardNavigable: false,
        screenReaderOptimized: false
      },
      schedule: {
        cohortBased: false
      }
    };
  }

  /**
   * Check if state transition is valid
   */
  private isValidTransition(from: CourseStatus, to: CourseStatus): boolean {
    const allowedTransitions = CourseWorkflowService.VALID_TRANSITIONS[from] || [];
    return allowedTransitions.includes(to);
  }

  /**
   * Transition course status with logging
   */
  private async transitionCourseStatus(
    courseId: string,
    newStatus: CourseStatus,
    action: CourseWorkflowAction,
    performedBy: User,
    reason?: string
  ): Promise<Course> {
    const course = await courseModel.findById(courseId);
    if (!course) {
      throw new Error('Course not found');
    }

    const oldStatus = course.status;
    const timestampField = this.getTimestampField(newStatus);
    const updateData: Partial<Course> = {
      status: newStatus,
      [timestampField]: new Date().toISOString()
    };

    const updatedCourse = await courseModel.update(courseId, updateData);
    
    // Log the workflow action
    await this.logWorkflowAction(updatedCourse, action, oldStatus, newStatus, performedBy, reason);

    return updatedCourse;
  }

  /**
   * Log workflow action
   */
  private async logWorkflowAction(
    course: Course,
    action: CourseWorkflowAction,
    fromStatus: CourseStatus,
    toStatus: CourseStatus,
    performedBy: User,
    reason?: string
  ): Promise<void> {
    const workflowEntry: CourseWorkflowHistory = {
      id: uuidv4(),
      action,
      fromStatus,
      toStatus,
      performedBy: performedBy.id,
      performedByRole: performedBy.role,
      timestamp: new Date().toISOString(),
      reason: reason || 'No reason provided',
      notes: reason || 'No notes provided'
    };

    const currentHistory = course.workflowHistory || [];
    currentHistory.push(workflowEntry);

    await courseModel.update(course._id!, {
      workflowHistory: currentHistory
    });
  }

  /**
   * Create version snapshot
   */
  private async createVersionSnapshot(course: Course, createdBy: User): Promise<CourseVersion> {
    const version: CourseVersion = {
      id: uuidv4(),
      version: course.version,
      courseId: course._id!,
      snapshot: { ...course },
      changes: ['Initial version'],
      createdBy: createdBy.id,
      createdAt: new Date().toISOString(),
      publishedAt: new Date().toISOString(),
      isCurrentVersion: true,
      rollbackAvailable: false
    };

    // In a real implementation, you would store this in a versions collection
    logger.info('Version snapshot created', { courseId: course._id, version: version.version });
    
    return version;
  }

  /**
   * Get appropriate timestamp field for status
   */
  private getTimestampField(status: CourseStatus): string {
    const statusToField: Record<CourseStatus, string> = {
      draft: 'createdAt',
      pending: 'submittedAt',
      submitted: 'submittedAt',
      under_review: 'reviewStartedAt',
      approved: 'approvedAt',
      rejected: 'rejectedAt',
      published: 'publishedAt',
      archived: 'archivedAt',
      suspended: 'suspendedAt'
    };

    return statusToField[status] || 'updatedAt';
  }

  /**
   * Notification methods
   */
  private async notifyAdminsOfSubmission(course: Course): Promise<void> {
    try {
      const admins = await userModel.findAll({ limit: 100 });
      const adminUsers = admins.docs.filter(user => user.role === 'admin');

      for (const admin of adminUsers) {
        await emailService.sendCourseSubmissionNotification(admin.email, course);
      }
    } catch (error) {
      logger.error('Failed to notify admins of course submission:', error);
    }
  }

  private async notifyInstructorOfReviewStart(course: Course): Promise<void> {
    try {
      const instructor = await userModel.findById(course.instructorId);
      if (instructor) {
        await emailService.sendCourseReviewStartNotification(instructor.email, course);
      }
    } catch (error) {
      logger.error('Failed to notify instructor of review start:', error);
    }
  }

  private async notifyInstructorOfApproval(course: Course, feedback: CourseApprovalFeedback): Promise<void> {
    try {
      const instructor = await userModel.findById(course.instructorId);
      if (instructor) {
        await emailService.sendCourseApprovalEmail(instructor.email, course.title, course._id!, true, undefined, feedback);
      }
    } catch (error) {
      logger.error('Failed to notify instructor of approval:', error);
    }
  }

  private async notifyInstructorOfRejection(course: Course, feedback: CourseApprovalFeedback, reason: string): Promise<void> {
    try {
      const instructor = await userModel.findById(course.instructorId);
      if (instructor) {
        await emailService.sendCourseApprovalEmail(instructor.email, course.title, course._id!, false, reason, feedback);
      }
    } catch (error) {
      logger.error('Failed to notify instructor of rejection:', error);
    }
  }
}

export const courseWorkflowService = new CourseWorkflowService(); 