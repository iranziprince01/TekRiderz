/**
 * Course Validation Utilities
 * Provides consistent validation logic for course creation and submission
 */

export interface CourseValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface CourseValidationResult {
  isValid: boolean;
  errors: CourseValidationError[];
  warnings: CourseValidationError[];
}

export interface CourseModule {
  id: string;
  title: string;
  description: string;
  order: number;
  content: {
    videoProvider: string;
    videoUrl: string;
  };
  quiz?: any;
  estimatedDuration: number;
}

export interface CourseData {
  title: string;
  description: string;
  category: string;
  level: string;
  language?: string;
  thumbnail: string;
  modules: CourseModule[];
  tags?: string[];
  requirements?: string[];
  learningObjectives?: string[];
  targetAudience?: string;
  finalAssessment?: any;
}

/**
 * Validate course data for draft saving
 */
export function validateCourseDraft(courseData: CourseData): CourseValidationResult {
  const errors: CourseValidationError[] = [];
  const warnings: CourseValidationError[] = [];

  // Basic required fields for draft
  if (!courseData.title.trim()) {
    errors.push({
      field: 'title',
      message: 'Course title is required',
      severity: 'error'
    });
  } else if (courseData.title.trim().length < 3) {
    errors.push({
      field: 'title',
      message: 'Course title must be at least 3 characters long',
      severity: 'error'
    });
  }

  if (!courseData.description.trim()) {
    errors.push({
      field: 'description',
      message: 'Course description is required',
      severity: 'error'
    });
  } else if (courseData.description.trim().length < 20) {
    warnings.push({
      field: 'description',
      message: 'Course description should be at least 20 characters for better quality',
      severity: 'warning'
    });
  }

  if (!courseData.category) {
    errors.push({
      field: 'category',
      message: 'Course category is required',
      severity: 'error'
    });
  }

  if (!courseData.level) {
    errors.push({
      field: 'level',
      message: 'Course level is required',
      severity: 'error'
    });
  }

  // Thumbnail validation for drafts (warning only)
  if (!courseData.thumbnail) {
    warnings.push({
      field: 'thumbnail',
      message: 'Adding a thumbnail will make your course more attractive',
      severity: 'warning'
    });
  } else if (!isValidThumbnailUrl(courseData.thumbnail)) {
    errors.push({
      field: 'thumbnail',
      message: 'Thumbnail must be a valid image URL',
      severity: 'error'
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate course data for submission
 */
export function validateCourseSubmission(courseData: CourseData): CourseValidationResult {
  const errors: CourseValidationError[] = [];
  const warnings: CourseValidationError[] = [];

  // Safety check: Ensure courseData exists
  if (!courseData) {
    errors.push({
      field: 'courseData',
      message: 'Course data is required',
      severity: 'error'
    });
    return { isValid: false, errors, warnings };
  }

  try {
    // All draft validations must pass
    const draftValidation = validateCourseDraft(courseData);
    errors.push(...draftValidation.errors);

    // Additional requirements for submission
    if (!courseData.description?.trim() || courseData.description.trim().length < 20) {
      errors.push({
        field: 'description',
        message: 'Course description must be at least 20 characters for submission',
        severity: 'error'
      });
    }

    // Thumbnail is recommended for submission but not required
    if (!courseData.thumbnail) {
      warnings.push({
        field: 'thumbnail',
        message: 'Adding a thumbnail will make your course more attractive',
        severity: 'warning'
      });
    }

    // Modules validation with enhanced safety checks
    if (!courseData.modules || !Array.isArray(courseData.modules) || courseData.modules.length === 0) {
      errors.push({
        field: 'modules',
        message: 'At least one course module is required for submission',
        severity: 'error'
      });
    } else {
      courseData.modules.forEach((module, index) => {
        // Safety check for module existence
        if (!module) {
          errors.push({
            field: `modules.${index}`,
            message: `Module ${index + 1}: Module data is missing`,
            severity: 'error'
          });
          return;
        }

        const modulePrefix = `Module ${index + 1}`;
        
        if (!module.title?.trim()) {
          errors.push({
            field: `modules.${index}.title`,
            message: `${modulePrefix}: Title is required`,
            severity: 'error'
          });
        }
        
        if (!module.description?.trim()) {
          errors.push({
            field: `modules.${index}.description`,
            message: `${modulePrefix}: Description is required`,
            severity: 'error'
          });
        }
        
        // Enhanced content validation with safety checks
        if (!module.content) {
          errors.push({
            field: `modules.${index}.content`,
            message: `${modulePrefix}: Content is required`,
            severity: 'error'
          });
        } else if (!module.content.videoUrl?.trim()) {
          errors.push({
            field: `modules.${index}.videoUrl`,
            message: `${modulePrefix}: Video URL is required`,
            severity: 'error'
          });
        } else {
          try {
            if (!isValidVideoUrl(module.content.videoUrl)) {
              warnings.push({
                field: `modules.${index}.videoUrl`,
                message: `${modulePrefix}: Please verify that the video URL is valid`,
                severity: 'warning'
              });
            }
          } catch (urlValidationError) {
            console.warn(`Video URL validation error for module ${index + 1}:`, urlValidationError);
            warnings.push({
              field: `modules.${index}.videoUrl`,
              message: `${modulePrefix}: Please check the video URL format`,
              severity: 'warning'
            });
          }
        }

        if (!module.estimatedDuration || module.estimatedDuration < 1) {
          warnings.push({
            field: `modules.${index}.duration`,
            message: `${modulePrefix}: Consider setting an estimated duration`,
            severity: 'warning'
          });
        }
      });
    }

  } catch (validationError: any) {
    console.error('Error during course validation:', validationError);
    errors.push({
      field: 'validation',
      message: `Validation process failed: ${validationError.message || 'Unknown error'}`,
      severity: 'error'
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate thumbnail URL
 */
export function isValidThumbnailUrl(url: string): boolean {
  if (!url) return false;
  
  // Base64 images are valid
  if (url.startsWith('data:image/')) {
    return /^data:image\/(png|jpg|jpeg|gif|webp|bmp);base64,/.test(url);
  }
  
  // HTTP(S) URLs are valid
  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
  
  // Relative paths are valid
  if (url.startsWith('/')) {
    return url.length > 1 && !url.includes('..') && /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(url);
  }
  
  return false;
}

/**
 * Validate video URL (YouTube, Vimeo, etc.)
 */
export function isValidVideoUrl(url: string): boolean {
  if (!url) return false;
  
  const youtubePattern = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)[\w-]+/;
  const vimeoPattern = /^(https?:\/\/)?(www\.)?vimeo\.com\/\d+/;
  const directVideoPattern = /^https?:\/\/.*\.(mp4|webm|ogg|avi|mov)(\?.*)?$/i;
  
  return youtubePattern.test(url) || vimeoPattern.test(url) || directVideoPattern.test(url);
}

/**
 * Format validation errors for display
 */
export function formatValidationErrors(result: CourseValidationResult): string {
  // Only show errors, not warnings, to make submission easier
  if (!result || !result.errors || result.errors.length === 0) {
    return '';
  }
  
  const errorMessages = result.errors.map(error => {
    if (typeof error === 'string') return error;
    if (error && typeof error === 'object' && error.message) return error.message;
    return 'Validation error';
  });
  
  return errorMessages.join('\n') || 'Validation failed';
}

/**
 * Create a properly structured course payload for the backend
 */
export function createCoursePayload(courseData: CourseData, user: any, status: 'draft' | 'submitted' = 'draft') {
  return {
    // Basic course information
    title: courseData.title.trim(),
    description: courseData.description.trim(),
    shortDescription: courseData.description.trim().substring(0, 150) + (courseData.description.length > 150 ? '...' : ''),
    category: courseData.category,
    level: courseData.level,
    language: courseData.language || 'en',
    status,
    
    // Instructor information
    instructorId: user?.id,
    instructorName: user?.name || user?.email || 'Unknown Instructor',
    
    // Media and visual content
    thumbnail: courseData.thumbnail || '',
    previewVideo: '',
    
    // Course structure and content
    tags: courseData.tags || [],
    requirements: courseData.requirements || [],
    learningObjectives: courseData.learningObjectives || [],
    targetAudience: courseData.targetAudience || '',
    
    // Convert modules to sections format expected by backend
    sections: courseData.modules?.map((module, index) => ({
      id: module.id,
      title: module.title,
      description: module.description,
      order: index,
      estimatedDuration: module.estimatedDuration || 0,
      learningObjectives: [],
      isPublished: status === 'submitted',
      lessons: [{
        id: `${module.id}_lesson`,
        title: module.title,
        description: module.description,
        type: 'video' as const,
        order: 0,
        content: {
          videoProvider: module.content?.videoProvider || 'youtube',
          videoUrl: module.content?.videoUrl || '',
          duration: module.estimatedDuration || 0
        },
        quiz: module.quiz ? {
          id: module.quiz.id,
          title: module.quiz.title,
          description: module.quiz.description,
          questions: module.quiz.questions || [],
          settings: module.quiz.settings
        } : undefined,
        estimatedDuration: module.estimatedDuration || 0,
        isPublished: status === 'submitted'
      }],
      moduleQuiz: undefined
    })) || [],
    
    // Calculated fields
    totalDuration: courseData.modules?.reduce((total, module) => total + (module.estimatedDuration || 0), 0) || 0,
    totalLessons: courseData.modules?.length || 0,
    
    // Pricing (always free)
    price: 0,
    currency: 'USD',
    
    // Final assessment
    finalAssessment: courseData.finalAssessment || undefined,
    
    // Metadata
    type: 'course' as const,
    enrollmentCount: 0,
    rating: { average: 0, count: 0 },
    
    // Timestamps
    ...(status === 'submitted' && { submittedAt: new Date().toISOString() }),
    updatedAt: new Date().toISOString()
  };
} 