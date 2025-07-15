import { Request, Response, NextFunction } from 'express';
import { validationResult, FieldValidationError } from 'express-validator';
import { AuthErrorUtil, AuthErrorType } from '../utils/authErrors';

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

export default validate; 