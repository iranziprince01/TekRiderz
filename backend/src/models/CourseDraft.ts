import { BaseModel } from './BaseModel';
import { BaseDocument } from '../types';
import { logger } from '../utils/logger';
import { databases } from '../config/database';

interface CourseDraft extends BaseDocument {
  type: 'course_draft';
  id: string;
  authorId: string;
  authorName: string;
  courseId?: string; // Linked to actual course when published
  
  // Draft metadata
  draftName: string;
  isAutoSave: boolean;
  lastSavedAt: string;
  version: number;
  parentDraftId?: string; // For versioning
  
  // Course content
  courseData: {
    title: string;
    shortDescription: string;
    description: string;
    category: string;
    level: 'beginner' | 'intermediate' | 'advanced';
    language: string;
    price: number;
    currency: string;
    
    // Media
    thumbnail?: string;
    thumbnailFileId?: string;
    previewVideo?: string;
    previewVideoFileId?: string;
    
    // Content structure
    tags: string[];
    requirements: string[];
    learningObjectives: string[];
    targetAudience: string;
    sections: any[];
    finalAssessment?: any;
    
    // Metadata
    totalDuration: number;
    totalLessons: number;
    contentFlags: {
      hasVideo: boolean;
      hasQuizzes: boolean;
      hasAssignments: boolean;
      hasCertificate: boolean;
      hasPrerequisites: boolean;
      isAccessible: boolean;
    };
    
    // Quality metrics
    completionPercentage: number;
    validationScore: number;
    readinessScore: number;
  };
  
  // Collaboration
  collaborators: {
    userId: string;
    userName: string;
    role: 'co-author' | 'reviewer' | 'editor';
    permissions: string[];
    addedAt: string;
  }[];
  
  // Workflow status
  status: 'draft' | 'in_review' | 'pending_approval' | 'approved' | 'rejected' | 'published';
  workflowStage: string;
  approvalChain: {
    userId: string;
    userName: string;
    action: 'pending' | 'approved' | 'rejected' | 'reviewed';
    timestamp?: string;
    feedback?: string;
  }[];
  
  // Auto-save metadata
  autoSaveHistory: {
    timestamp: string;
    changes: string[];
    sessionId: string;
    clientInfo: any;
  }[];
  
  // Validation and quality
  validationResults: {
    errors: { field: string; message: string; severity: 'error' | 'warning' | 'info' }[];
    warnings: { field: string; message: string; suggestion?: string }[];
    suggestions: { category: string; message: string; priority: 'high' | 'medium' | 'low' }[];
    score: number;
    lastChecked: string;
  };
  
  // Analytics
  analytics: {
    editSessions: number;
    totalEditTime: number;
    sectionsCreated: number;
    lessonsCreated: number;
    quizzesCreated: number;
    filesUploaded: number;
    collaboratorsInvited: number;
    lastActivity: string;
  };
}

interface DraftSession {
  sessionId: string;
  userId: string;
  draftId: string;
  startedAt: string;
  lastActivity: string;
  isActive: boolean;
  clientInfo: {
    userAgent: string;
    ipAddress: string;
    platform: string;
  };
  changes: {
    timestamp: string;
    action: string;
    field: string;
    oldValue: any;
    newValue: any;
  }[];
}

export class CourseDraftModel extends BaseModel<CourseDraft> {
  constructor() {
    super('courses', 'course_draft');
  }

  // Create a new course draft
  async createDraft(
    authorId: string,
    authorName: string,
    initialData: Partial<CourseDraft['courseData']> = {},
    options: {
      draftName?: string;
      isAutoSave?: boolean;
      templateId?: string;
    } = {}
  ): Promise<CourseDraft> {
    try {
      const draftData: Omit<CourseDraft, '_id' | '_rev' | 'createdAt' | 'updatedAt'> = {
        type: 'course_draft',
        id: this.generateId(),
        authorId,
        authorName,
        draftName: options.draftName || `Draft - ${new Date().toLocaleDateString()}`,
        isAutoSave: options.isAutoSave || false,
        lastSavedAt: new Date().toISOString(),
        version: 1,
        
        courseData: {
          title: initialData.title || '',
          shortDescription: initialData.shortDescription || '',
          description: initialData.description || '',
          category: initialData.category || 'programming',
          level: initialData.level || 'beginner',
          language: initialData.language || 'en',
          price: initialData.price || 0,
          currency: initialData.currency || 'USD',
          
          tags: initialData.tags || [],
          requirements: initialData.requirements || [],
          learningObjectives: initialData.learningObjectives || [],
          targetAudience: initialData.targetAudience || '',
          sections: initialData.sections || [],
          
          totalDuration: initialData.totalDuration || 0,
          totalLessons: initialData.totalLessons || 0,
          contentFlags: initialData.contentFlags || {
            hasVideo: false,
            hasQuizzes: false,
            hasAssignments: false,
            hasCertificate: false,
            hasPrerequisites: false,
            isAccessible: false
          },
          
          completionPercentage: 0,
          validationScore: 0,
          readinessScore: 0
        },
        
        collaborators: [],
        status: 'draft',
        workflowStage: 'creation',
        approvalChain: [],
        autoSaveHistory: [],
        
        validationResults: {
          errors: [],
          warnings: [],
          suggestions: [],
          score: 0,
          lastChecked: new Date().toISOString()
        },
        
        analytics: {
          editSessions: 0,
          totalEditTime: 0,
          sectionsCreated: 0,
          lessonsCreated: 0,
          quizzesCreated: 0,
          filesUploaded: 0,
          collaboratorsInvited: 0,
          lastActivity: new Date().toISOString()
        }
      };

      // If template is specified, load template data
      if (options.templateId) {
        try {
          const template = await this.loadTemplate(options.templateId);
          if (template) {
            draftData.courseData = { ...draftData.courseData, ...template.courseData };
            draftData.draftName = `${template.name} - ${new Date().toLocaleDateString()}`;
          }
        } catch (error) {
          logger.warn('Failed to load template:', { templateId: options.templateId, error });
        }
      }

      const draft = await this.create(draftData);
      
      logger.info('Course draft created:', {
        draftId: draft._id,
        authorId,
        draftName: draft.draftName,
        templateUsed: !!options.templateId
      });

      return draft;
    } catch (error) {
      logger.error('Failed to create course draft:', { authorId, authorName, error });
      throw error;
    }
  }

  // Auto-save draft with smart change detection
  async autoSaveDraft(
    draftId: string,
    userId: string,
    updates: Partial<CourseDraft['courseData']>,
    sessionId: string,
    clientInfo?: any
  ): Promise<{
    success: boolean;
    conflictDetected: boolean;
    lastSavedAt: string;
    version: number;
  }> {
    try {
      const draft = await this.findById(draftId);
      if (!draft) {
        throw new Error('Draft not found');
      }

      // Check if user has permission to edit
      if (draft.authorId !== userId && !this.hasEditPermission(draft, userId)) {
        throw new Error('Permission denied');
      }

      // Detect changes
      const changes = this.detectChanges(draft.courseData, updates);
      if (changes.length === 0) {
        return {
          success: true,
          conflictDetected: false,
          lastSavedAt: draft.lastSavedAt,
          version: draft.version
        };
      }

      // Check for conflicts (if another user saved recently)
      const conflictDetected = await this.checkForConflicts(draftId, draft.lastSavedAt);

      // Update draft with changes
      const updatedCourseData = { ...draft.courseData, ...updates };
      const autoSaveEntry = {
        timestamp: new Date().toISOString(),
        changes: changes.map(c => c.field),
        sessionId,
        clientInfo: clientInfo || {}
      };

      // Calculate quality metrics
      const qualityMetrics = this.calculateQualityMetrics(updatedCourseData);

      const updatedDraft = await this.update(draftId, {
        courseData: {
          ...updatedCourseData,
          ...qualityMetrics
        },
        lastSavedAt: new Date().toISOString(),
        version: draft.version + (conflictDetected ? 0 : 1),
        autoSaveHistory: [...draft.autoSaveHistory.slice(-19), autoSaveEntry], // Keep last 20
        'analytics.lastActivity': new Date().toISOString()
      } as Partial<CourseDraft>);

      logger.debug('Draft auto-saved:', {
        draftId,
        userId,
        changesCount: changes.length,
        conflictDetected,
        version: updatedDraft?.version || draft.version
      });

      return {
        success: true,
        conflictDetected,
        lastSavedAt: updatedDraft?.lastSavedAt || new Date().toISOString(),
        version: updatedDraft?.version || draft.version + 1
      };
    } catch (error) {
      logger.error('Failed to auto-save draft:', { draftId, userId, error });
      return {
        success: false,
        conflictDetected: false,
        lastSavedAt: new Date().toISOString(),
        version: 0
      };
    }
  }

  // Get user's drafts with filtering and sorting
  async getUserDrafts(
    userId: string,
    options: {
      includeCollaborations?: boolean;
      status?: string;
      sortBy?: 'lastSaved' | 'created' | 'title' | 'status';
      sortOrder?: 'asc' | 'desc';
      limit?: number;
      skip?: number;
    } = {}
  ): Promise<{
    drafts: CourseDraft[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      // Get drafts authored by user
      const authoredResult = await databases.courses.view('course_drafts', 'by_author', {
        key: userId,
        include_docs: true,
        limit: options.limit || 50,
        skip: options.skip || 0,
      });

      let drafts = authoredResult.rows.map(row => row.doc as CourseDraft);

      // Include collaborative drafts if requested
      if (options.includeCollaborations) {
        const collaborativeResult = await databases.courses.view('course_drafts', 'by_collaborator', {
          key: userId,
          include_docs: true,
        });
        
        const collaborativeDrafts = collaborativeResult.rows.map(row => row.doc as CourseDraft);
        drafts = [...drafts, ...collaborativeDrafts];
      }

      // Apply filters
      if (options.status) {
        drafts = drafts.filter(draft => draft.status === options.status);
      }

      // Apply sorting
      drafts.sort((a, b) => {
        let aValue: any, bValue: any;
        
        switch (options.sortBy) {
          case 'lastSaved':
            aValue = new Date(a.lastSavedAt);
            bValue = new Date(b.lastSavedAt);
            break;
          case 'created':
            aValue = new Date(a.createdAt);
            bValue = new Date(b.createdAt);
            break;
          case 'title':
            aValue = a.courseData.title.toLowerCase();
            bValue = b.courseData.title.toLowerCase();
            break;
          case 'status':
            aValue = a.status;
            bValue = b.status;
            break;
          default:
            aValue = new Date(a.lastSavedAt);
            bValue = new Date(b.lastSavedAt);
        }

        if (options.sortOrder === 'asc') {
          return aValue > bValue ? 1 : -1;
        } else {
          return aValue < bValue ? 1 : -1;
        }
      });

      const total = drafts.length;
      const limit = options.limit || 50;
      const skip = options.skip || 0;
      
      // Apply pagination
      drafts = drafts.slice(skip, skip + limit);

      return {
        drafts,
        total,
        hasMore: skip + limit < total
      };
    } catch (error) {
      logger.error('Failed to get user drafts:', { userId, options, error });
      return { drafts: [], total: 0, hasMore: false };
    }
  }

  // Validate draft and provide suggestions
  async validateDraft(draftId: string): Promise<CourseDraft['validationResults']> {
    try {
      const draft = await this.findById(draftId);
      if (!draft) {
        throw new Error('Draft not found');
      }

      const errors: any[] = [];
      const warnings: any[] = [];
      const suggestions: any[] = [];

      const { courseData } = draft;

      // Required field validation
      if (!courseData.title || courseData.title.trim().length < 3) {
        errors.push({
          field: 'title',
          message: 'Course title is required and must be at least 3 characters',
          severity: 'error'
        });
      }

      if (!courseData.shortDescription || courseData.shortDescription.trim().length < 20) {
        errors.push({
          field: 'shortDescription',
          message: 'Short description is required and must be at least 20 characters',
          severity: 'error'
        });
      }

      if (!courseData.description || courseData.description.trim().length < 100) {
        errors.push({
          field: 'description',
          message: 'Description is required and must be at least 100 characters',
          severity: 'error'
        });
      }

      // Content validation
      if (courseData.sections.length === 0) {
        errors.push({
          field: 'sections',
          message: 'At least one section is required',
          severity: 'error'
        });
      } else {
        // Check sections for completeness
        courseData.sections.forEach((section, index) => {
          if (!section.title) {
            errors.push({
              field: `sections[${index}].title`,
              message: `Section ${index + 1} requires a title`,
              severity: 'error'
            });
          }

          if (!section.lessons || section.lessons.length === 0) {
            warnings.push({
              field: `sections[${index}].lessons`,
              message: `Section ${index + 1} has no lessons`,
              suggestion: 'Add at least one lesson to make this section meaningful'
            });
          }
        });
      }

      // Quality suggestions
      if (courseData.tags.length < 3) {
        suggestions.push({
          category: 'discoverability',
          message: 'Add more tags to improve course discoverability',
          priority: 'medium'
        });
      }

      if (courseData.learningObjectives.length < 3) {
        suggestions.push({
          category: 'pedagogy',
          message: 'Add more learning objectives to clarify course outcomes',
          priority: 'high'
        });
      }

      if (!courseData.thumbnail) {
        suggestions.push({
          category: 'marketing',
          message: 'Add a course thumbnail to attract more learners',
          priority: 'high'
        });
      }

      // Calculate validation score
      const maxScore = 100;
      const errorPenalty = errors.length * 15;
      const warningPenalty = warnings.length * 5;
      const score = Math.max(0, maxScore - errorPenalty - warningPenalty);

      const validationResults = {
        errors,
        warnings,
        suggestions,
        score,
        lastChecked: new Date().toISOString()
      };

      // Update draft with validation results
      await this.update(draftId, {
        validationResults
      } as Partial<CourseDraft>);

      logger.info('Draft validated:', {
        draftId,
        errorsCount: errors.length,
        warningsCount: warnings.length,
        suggestionsCount: suggestions.length,
        score
      });

      return validationResults;
    } catch (error) {
      logger.error('Failed to validate draft:', { draftId, error });
      throw error;
    }
  }

  // Convert draft to published course
  async publishDraft(draftId: string, publishedBy: string): Promise<{ courseId: string; success: boolean }> {
    try {
      const draft = await this.findById(draftId);
      if (!draft) {
        throw new Error('Draft not found');
      }

      // Validate draft before publishing
      const validation = await this.validateDraft(draftId);
      if (validation.errors.length > 0) {
        throw new Error(`Cannot publish draft with validation errors: ${validation.errors.map(e => e.message).join(', ')}`);
      }

      // Import course model to create the actual course
      const { courseModel } = await import('./Course');
      
      // Prepare course data for creation with required defaults
      const courseData = {
        ...draft.courseData,
        instructorId: draft.authorId,
        instructorName: draft.authorName,
        status: 'pending' as any, // Will go through approval process
        type: 'course' as const,
        // Fix category and language types
        category: (draft.courseData.category || 'programming') as any,
        language: (draft.courseData.language || 'en') as any,
        // Add missing required fields with defaults
        id: `course_${Date.now()}`,
        version: '1.0.0',
        isCurrentVersion: true,
        qualityScore: 0,
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
        },
        contentFlags: {
          hasVideo: false,
          hasQuizzes: false,
          hasAssignments: false,
          hasCertificate: false,
          hasPrerequisites: false,
          isAccessible: true
        },
        // Additional required defaults
        workflowHistory: [],
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
            certificateEarnedRate: 0
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
          metaTitle: draft.courseData.title || '',
          metaDescription: draft.courseData.description?.substring(0, 150) || '',
          keywords: [],
          slug: draft.courseData.title?.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || ''
        }
      };

      // Create the actual course
      const course = await courseModel.create(courseData);

      // Update draft to link to published course
      await this.update(draftId, {
        courseId: course._id,
        status: 'published',
        workflowStage: 'published'
      } as Partial<CourseDraft>);

      logger.info('Draft published as course:', {
        draftId,
        courseId: course._id,
        publishedBy,
        title: courseData.title
      });

      return {
        courseId: course._id!,
        success: true
      };
    } catch (error) {
      logger.error('Failed to publish draft:', { draftId, publishedBy, error });
      throw error;
    }
  }

  // Helper methods
  private hasEditPermission(draft: CourseDraft, userId: string): boolean {
    if (draft.authorId === userId) return true;
    
    const collaborator = draft.collaborators.find(c => c.userId === userId);
    return collaborator ? collaborator.permissions.includes('edit') : false;
  }

  private detectChanges(oldData: any, newData: any): Array<{ field: string; oldValue: any; newValue: any }> {
    const changes: Array<{ field: string; oldValue: any; newValue: any }> = [];
    
    const compareObjects = (old: any, updated: any, prefix = '') => {
      Object.keys(updated).forEach(key => {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        
        if (old[key] !== updated[key]) {
          if (typeof updated[key] === 'object' && updated[key] !== null && !Array.isArray(updated[key])) {
            compareObjects(old[key] || {}, updated[key], fullKey);
          } else {
            changes.push({
              field: fullKey,
              oldValue: old[key],
              newValue: updated[key]
            });
          }
        }
      });
    };

    compareObjects(oldData, newData);
    return changes;
  }

  private async checkForConflicts(draftId: string, lastKnownSave: string): Promise<boolean> {
    try {
      const currentDraft = await this.findById(draftId);
      if (!currentDraft) return false;
      
      return new Date(currentDraft.lastSavedAt) > new Date(lastKnownSave);
    } catch (error) {
      return false;
    }
  }

  private calculateQualityMetrics(courseData: any): { completionPercentage: number; readinessScore: number } {
    let completedFields = 0;
    const totalFields = 10; // Adjust based on required fields

    // Check completion
    if (courseData.title) completedFields++;
    if (courseData.shortDescription) completedFields++;
    if (courseData.description) completedFields++;
    if (courseData.thumbnail) completedFields++;
    if (courseData.tags.length > 0) completedFields++;
    if (courseData.learningObjectives.length > 0) completedFields++;
    if (courseData.sections.length > 0) completedFields++;
    if (courseData.category) completedFields++;
    if (courseData.level) completedFields++;
    if (courseData.targetAudience) completedFields++;

    const completionPercentage = Math.round((completedFields / totalFields) * 100);
    
    // Calculate readiness score (more sophisticated)
    let readinessScore = completionPercentage;
    
    // Bonus for quality content
    if (courseData.sections.length >= 3) readinessScore += 5;
    if (courseData.tags.length >= 5) readinessScore += 3;
    if (courseData.learningObjectives.length >= 5) readinessScore += 5;
    
    return {
      completionPercentage,
      readinessScore: Math.min(100, readinessScore)
    };
  }

  private async loadTemplate(templateId: string): Promise<any> {
    // This would load a course template
    // For now, return null as templates aren't implemented yet
    return null;
  }
}

export const courseDraftModel = new CourseDraftModel(); 