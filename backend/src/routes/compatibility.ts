import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// Compatibility layer to ensure smooth integration between robust backend and existing frontend

// Middleware to normalize course data format for frontend compatibility
export const normalizeCourseResponse = (req: Request, res: Response, next: NextFunction) => {
  const originalSend = res.json;
  
  res.json = function(data: any) {
    if (data && data.success && data.data) {
      // Normalize course data structure for frontend
      if (data.data.course) {
        data.data.course = normalizeForFrontend(data.data.course);
      } else if (data.data.courses && Array.isArray(data.data.courses)) {
        data.data.courses = data.data.courses.map(normalizeForFrontend);
      } else if (data.data.draft && data.data.draft.courseData) {
        // For draft responses, ensure courseData is properly formatted
        data.data.draft.courseData = normalizeForFrontend(data.data.draft.courseData);
      }
    }
    
    return originalSend.call(this, data);
  };
  
  next();
};

// Normalize course object for frontend compatibility
function normalizeForFrontend(course: any): any {
  if (!course) return course;
  
  return {
    // Ensure ID consistency - frontend expects both id and _id
    id: course.id || course._id,
    _id: course._id || course.id,
    
    // Core course fields
    title: course.title || '',
    description: course.description || '',
    shortDescription: course.shortDescription || course.description?.substring(0, 100) || '',
    category: course.category || 'general',
    level: course.level || 'beginner',
    status: course.status || 'draft',
    
    // Instructor information
    instructorId: course.instructorId || course.authorId,
    instructorName: course.instructorName || course.authorName || 'Unknown Instructor',
    instructorEmail: course.instructorEmail,
    
    // Content structure
    sections: course.sections || [],
    totalLessons: course.totalLessons || 0,
    totalDuration: course.totalDuration || 0,
    
    // Media
    thumbnail: course.thumbnail,
    previewVideo: course.previewVideo,
    
    // Metadata
    tags: course.tags || [],
    requirements: course.requirements || [],
    learningObjectives: course.learningObjectives || [],
    targetAudience: course.targetAudience || '',
    language: course.language || 'en',
    
    // Metrics for admin dashboard
    enrollments: course.enrollmentCount || course.enrollments || 0,
    enrollmentCount: course.enrollmentCount || course.enrollments || 0,
    rating: course.rating?.average || 0,
    totalRatings: course.rating?.count || 0,
    
    // Workflow and timestamps
    createdAt: course.createdAt,
    updatedAt: course.updatedAt,
    submittedAt: course.submittedAt,
    publishedAt: course.publishedAt,
    approvedAt: course.approvedAt,
    rejectedAt: course.rejectedAt,
    rejectionReason: course.rejectionReason,
    
    // Quality metrics (simplified for frontend)
    qualityScore: course.qualityScore || course.validationResult?.score || 0,
    validationResult: course.validationResult,
    approvalFeedback: course.approvalFeedback,
    workflowHistory: course.workflowHistory || [],
    
    // Flags
    isActive: course.isActive !== undefined ? course.isActive : true,
    
    // Additional fields that frontend might use
    duration: course.totalDuration || course.duration || 0,
    students: course.enrollmentCount || course.enrollments || 0,
    price: course.price || 0,
    currency: course.currency || 'USD'
  };
}

// Middleware to ensure proper error handling for frontend
export const frontendErrorHandler = (error: any, req: Request, res: Response, next: NextFunction) => {
  logger.error('Frontend compatibility error:', { error, path: req.path, method: req.method });
  
  // Convert backend errors to frontend-friendly format
  const errorResponse = {
    success: false,
    error: error.message || 'An unexpected error occurred',
    details: process.env.NODE_ENV === 'development' ? error.stack : undefined
  };
  
  // Set appropriate status code
  const statusCode = error.statusCode || error.status || 500;
  
  res.status(statusCode).json(errorResponse);
};

// Middleware to handle FormData to JSON conversion for course creation
export const handleCourseFormData = (req: Request, res: Response, next: NextFunction) => {
  try {
    // If sections is a string (from FormData), parse it
    if (req.body.sections && typeof req.body.sections === 'string') {
      try {
        req.body.sections = JSON.parse(req.body.sections);
      } catch (parseError) {
        logger.warn('Failed to parse sections JSON:', parseError);
        req.body.sections = [];
      }
    }
    
    // Parse other JSON fields that come as strings from FormData
    const jsonFields = ['tags', 'requirements', 'learningObjectives', 'contentFlags', 'finalAssessment'];
    jsonFields.forEach(field => {
      if (req.body[field] && typeof req.body[field] === 'string') {
        try {
          req.body[field] = JSON.parse(req.body[field]);
        } catch (parseError) {
          logger.warn(`Failed to parse ${field} JSON:`, parseError);
          req.body[field] = field === 'tags' || field === 'requirements' || field === 'learningObjectives' ? [] : {};
        }
      }
    });
    
    // Ensure required defaults for course creation
    req.body.type = 'course';
    req.body.status = req.body.status || 'draft';
    req.body.price = req.body.price || 0;
    req.body.currency = req.body.currency || 'USD';
    
    // Convert numeric fields
    if (req.body.totalLessons) req.body.totalLessons = parseInt(req.body.totalLessons);
    if (req.body.totalDuration) req.body.totalDuration = parseInt(req.body.totalDuration);
    
    next();
  } catch (error) {
    logger.error('Failed to process course form data:', error);
    next(error);
  }
};

// Compatibility shim for draft system integration
export const draftCompatibilityShim = async (req: Request, res: Response, next: NextFunction) => {
  // If the request is for course creation and we want to use the draft system
  if (req.method === 'POST' && req.path === '/courses' && req.body.useDraftSystem === 'true') {
    try {
      // Redirect to draft creation instead
      const { courseDraftModel } = await import('../models/CourseDraft');
      
      const draft = await courseDraftModel.createDraft(
        req.user!.id,
        req.user!.name || req.user!.email || 'Unknown User',
        req.body,
        {
          draftName: req.body.title || `Draft - ${new Date().toLocaleDateString()}`,
          isAutoSave: false
        }
      );
      
      // Return in the same format as regular course creation
      return res.json({
        success: true,
        data: {
          course: normalizeForFrontend(draft.courseData),
          draft: draft,
          message: 'Course draft created successfully'
        }
      });
    } catch (error) {
      logger.error('Draft compatibility shim failed:', error);
      return next(error);
    }
  } else {
    return next();
  }
};

// Middleware to add validation hints for better user experience
export const addValidationHints = (req: Request, res: Response, next: NextFunction) => {
  const originalSend = res.json;
  
  res.json = function(data: any) {
    // Add helpful validation hints to course responses
    if (data && data.success && data.data && data.data.course) {
      const course = data.data.course;
      const hints = [];
      
      // Simple validation hints for frontend
      if (!course.thumbnail) {
        hints.push('Add a course thumbnail to improve discoverability');
      }
      if (!course.sections || course.sections.length === 0) {
        hints.push('Add course sections and lessons');
      }
      if (!course.tags || course.tags.length < 3) {
        hints.push('Add more tags to help learners find your course');
      }
      if (!course.learningObjectives || course.learningObjectives.length < 3) {
        hints.push('Add learning objectives to clarify what students will learn');
      }
      
      if (hints.length > 0) {
        data.data.validationHints = hints;
      }
    }
    
    return originalSend.call(this, data);
  };
  
  next();
};

// Simple progress tracking compatibility
export const progressCompatibility = (req: Request, res: Response, next: NextFunction) => {
  // Ensure progress responses are in expected format
  const originalSend = res.json;
  
  res.json = function(data: any) {
    if (data && data.success && data.data && req.path.includes('progress')) {
      // Normalize progress data for frontend
      if (data.data.progress) {
        data.data.progress = {
          ...data.data.progress,
          overallProgress: data.data.progress.overallProgress || 0,
          completedLessons: data.data.progress.completedLessons || [],
          timeSpent: data.data.progress.timeSpent || 0,
          lastActiveAt: data.data.progress.lastActiveAt || new Date().toISOString()
        };
      }
    }
    
    return originalSend.call(this, data);
  };
  
  next();
}; 