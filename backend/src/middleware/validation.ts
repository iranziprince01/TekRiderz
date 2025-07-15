import { Request, Response, NextFunction } from 'express';
import { validationResult, FieldValidationError } from 'express-validator';
import { AuthErrorUtil, AuthErrorType } from '../utils/authErrors';
import { body } from 'express-validator';

// Enhanced validation middleware with user-friendly error messages
export const validate = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const validationErrors = errors.array();
    
    // Check for specific error types to provide better messages
    if (validationErrors.length === 0) {
      return next(AuthErrorUtil.createError(AuthErrorType.VALIDATION_ERROR));
    }
    
    const firstError = validationErrors[0];
    if (!firstError) {
      return next(AuthErrorUtil.createError(AuthErrorType.VALIDATION_ERROR));
    }
    
    const errorMessage = firstError.msg as string;
    
    // Safely get field name for FieldValidationError
    const field = (firstError as FieldValidationError).path || 'unknown';
    
    // Map specific validation errors to our error types
    let errorType = AuthErrorType.VALIDATION_ERROR;
    let customMessage = errorMessage;
    
    // Password validation errors
    if (field === 'password') {
      errorType = AuthErrorType.WEAK_PASSWORD;
      customMessage = 'Password doesn\'t meet security requirements.';
    }
    
    // Email validation errors
    else if (field === 'email') {
      if (errorMessage.toLowerCase().includes('email')) {
        errorType = AuthErrorType.INVALID_EMAIL_FORMAT;
        customMessage = 'Please enter a valid email address.';
      } else if (errorMessage.toLowerCase().includes('temporary')) {
        errorType = AuthErrorType.TEMP_EMAIL_BLOCKED;
        customMessage = 'Temporary email addresses are not allowed.';
      }
    }
    
    // Name validation errors
    else if (field === 'name') {
      errorType = AuthErrorType.INVALID_NAME;
      customMessage = 'Please enter a valid name.';
    }
    
    // Role validation errors
    else if (field === 'role') {
      errorType = AuthErrorType.INVALID_ROLE;
      customMessage = 'Please select a valid role.';
    }
    
    // OTP validation errors
    else if (field === 'otp') {
      if (errorMessage.toLowerCase().includes('6 digits')) {
        errorType = AuthErrorType.OTP_REQUIRED;
        customMessage = 'Please enter the 6-digit verification code.';
      } else if (errorMessage.toLowerCase().includes('invalid')) {
        errorType = AuthErrorType.OTP_INVALID;
        customMessage = 'Invalid verification code.';
      }
    }
    
    // Required field errors
    else if (errorMessage.toLowerCase().includes('required') || 
             errorMessage.toLowerCase().includes('empty')) {
      errorType = AuthErrorType.REQUIRED_FIELDS_MISSING;
      customMessage = 'Please fill in all required fields.';
    }
    
    // Create detailed error information for frontend
    const errorDetails = {
      field,
      message: customMessage,
      originalMessage: errorMessage,
      value: (firstError as FieldValidationError).value || undefined,
      allErrors: validationErrors.map(err => ({
        field: (err as FieldValidationError).path || 'unknown',
        message: err.msg,
        value: (err as FieldValidationError).value || undefined,
      }))
    };
    
    const error = AuthErrorUtil.createError(errorType, customMessage);
    (error as any).validationDetails = errorDetails;
    
    return next(error);
  }

  next();
};

// Quiz validation middleware
export const validateQuiz = (req: Request, res: Response, next: NextFunction): void => {
  const { title, description, questions, settings } = req.body;
  
  const errors: string[] = [];
  
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    errors.push('Quiz title is required');
  }
  
  if (!description || typeof description !== 'string' || description.trim().length === 0) {
    errors.push('Quiz description is required');
  }
  
  if (!questions || !Array.isArray(questions) || questions.length === 0) {
    errors.push('Quiz must have at least one question');
  }
  
  if (questions && Array.isArray(questions)) {
    questions.forEach((question, index) => {
      if (!question.questionText || typeof question.questionText !== 'string') {
        errors.push(`Question ${index + 1} must have question text`);
      }
      
      if (!question.type || !['multiple-choice', 'true-false', 'fill-blank', 'essay', 'code', 'matching', 'drag-drop'].includes(question.type)) {
        errors.push(`Question ${index + 1} must have a valid type`);
      }
      
      if (!question.points || typeof question.points !== 'number' || question.points <= 0) {
        errors.push(`Question ${index + 1} must have valid points`);
      }
    });
  }
  
  if (settings) {
    if (settings.timeLimit && (typeof settings.timeLimit !== 'number' || settings.timeLimit <= 0)) {
      errors.push('Time limit must be a positive number');
    }
    
    if (settings.attempts && (typeof settings.attempts !== 'number' || settings.attempts <= 0)) {
      errors.push('Number of attempts must be a positive number');
    }
    
    if (settings.passingScore && (typeof settings.passingScore !== 'number' || settings.passingScore < 0 || settings.passingScore > 100)) {
      errors.push('Passing score must be between 0 and 100');
    }
  }
  
  if (errors.length > 0) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      errors
    });
    return;
  }
  
  next();
};

// Quiz answer validation middleware
export const validateQuizAnswer = (req: Request, res: Response, next: NextFunction): void => {
  const { questionId, answer } = req.body;
  
  const errors: string[] = [];
  
  if (!questionId || typeof questionId !== 'string') {
    errors.push('Question ID is required');
  }
  
  if (answer === undefined || answer === null) {
    errors.push('Answer is required');
  }
  
  if (errors.length > 0) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      errors
    });
    return;
  }
  
  next();
};

// Sync validation middleware for batch operations
export const validateSync = [
  body('actions')
    .isArray({ min: 1, max: 100 })
    .withMessage('Actions must be an array with 1-100 items'),
  
  body('actions.*.id')
    .isString()
    .notEmpty()
    .withMessage('Each action must have a valid ID'),
  
  body('actions.*.type')
    .isIn(['quiz_attempt', 'module_completion', 'progress_update', 'user_data', 'course_enrollment'])
    .withMessage('Invalid action type'),
  
  body('actions.*.data')
    .isObject()
    .withMessage('Action data must be an object'),
  
  body('actions.*.timestamp')
    .isNumeric()
    .withMessage('Timestamp must be a number'),
  
  body('clientId')
    .isString()
    .notEmpty()
    .withMessage('Client ID is required'),
  
  body('lastSyncTimestamp')
    .optional()
    .isNumeric()
    .withMessage('Last sync timestamp must be a number'),
  
  body('deviceInfo')
    .optional()
    .isObject()
    .withMessage('Device info must be an object'),
  
  validate // Re-using the existing validate function for error handling
];

// Quiz attempt validation for sync
export const validateQuizAttemptSync = [
  body('data.assessmentId')
    .isString()
    .notEmpty()
    .withMessage('Assessment ID is required'),
  
  body('data.answers')
    .isArray()
    .withMessage('Answers must be an array'),
  
  body('data.score')
    .isNumeric()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Score must be between 0 and 100'),
  
  body('data.completedAt')
    .isISO8601()
    .withMessage('Completed at must be a valid date'),
  
  validate // Re-using the existing validate function for error handling
];

// Progress update validation for sync
export const validateProgressSync = [
  body('data.courseId')
    .isString()
    .notEmpty()
    .withMessage('Course ID is required'),
  
  body('data.progressData')
    .optional()
    .isObject()
    .withMessage('Progress data must be an object'),
  
  body('data.lastAccessedAt')
    .optional()
    .isISO8601()
    .withMessage('Last accessed at must be a valid date'),
  
  validate // Re-using the existing validate function for error handling
];

// Module completion validation for sync
export const validateModuleCompletionSync = [
  body('data.courseId')
    .isString()
    .notEmpty()
    .withMessage('Course ID is required'),
  
  body('data.moduleId')
    .isString()
    .notEmpty()
    .withMessage('Module ID is required'),
  
  body('data.completedAt')
    .isISO8601()
    .withMessage('Completed at must be a valid date'),
  
  body('data.completionData')
    .optional()
    .isObject()
    .withMessage('Completion data must be an object'),
  
  validate // Re-using the existing validate function for error handling
];

export default validate; 