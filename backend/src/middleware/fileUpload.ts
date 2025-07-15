import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config/config';

// Define storage configuration
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      let uploadPath = '';
      
      if (file.fieldname === 'thumbnail') {
        uploadPath = path.join(__dirname, '../../uploads/courses/thumbnails');
      } else if (file.fieldname === 'video') {
        uploadPath = path.join(__dirname, '../../uploads/courses/videos');
      } else if (file.fieldname === 'avatar') {
        uploadPath = path.join(__dirname, '../../uploads/users/avatars');
      } else if (file.fieldname === 'document') {
        uploadPath = path.join(__dirname, '../../uploads/documents');
      } else if (file.fieldname === 'material') {
        uploadPath = path.join(__dirname, '../../uploads/lessons/materials');
      } else {
        return cb(new Error('Invalid file field'), '');
      }

      // Ensure directory exists
      await fs.mkdir(uploadPath, { recursive: true });
      cb(null, uploadPath);
    } catch (error) {
      cb(error as Error, '');
    }
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const fileExtension = path.extname(file.originalname);
    const filename = `${timestamp}-${randomStr}${fileExtension}`;
    cb(null, filename);
  }
});

// File filter function
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.fieldname === 'thumbnail') {
    // Allow only image files for thumbnails
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed for thumbnails'));
    }
  } else if (file.fieldname === 'video') {
    // Allow only video files
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'));
    }
  } else if (file.fieldname === 'avatar') {
    // Allow only image files for avatars
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed for avatars'));
    }
  } else if (file.fieldname === 'document') {
    // Allow common document formats
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, Word, PowerPoint, Excel, and text files are allowed for documents'));
    }
  } else if (file.fieldname === 'material') {
    // Allow documents and images for lesson materials
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only documents and images are allowed for lesson materials'));
    }
  } else {
    cb(new Error('Invalid file field'));
  }
};

// Configure multer
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit for videos, documents
  },
});

// Middleware for course media upload
export const uploadCourseMedia = upload.fields([
  { name: 'thumbnail', maxCount: 1 },
  { name: 'video', maxCount: 1 }
]);

// Middleware for single file uploads
export const uploadThumbnail = upload.single('thumbnail');
export const uploadVideo = upload.single('video');
export const uploadDocument = upload.single('document');
export const uploadMaterial = upload.single('material');

// Middleware for avatar uploads
export const uploadAvatar = upload.single('avatar');

// Middleware for lesson materials (multiple files)
export const uploadLessonMaterials = upload.array('materials', 10);

// Error handling middleware
export const handleUploadError = (error: any, req: Request, res: Response, next: NextFunction): void => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({
        success: false,
        error: 'File size too large. Maximum size is 100MB.',
      });
      return;
    }
    res.status(400).json({
      success: false,
      error: `Upload error: ${error.message}`,
    });
    return;
  } else if (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
    return;
  }
  next();
};

// Helper function to get file URL
export const getFileUrl = (filename: string, type: 'thumbnail' | 'video' | 'document' | 'material' | 'avatar'): string => {
  const baseUrl = config.server.baseUrl;
  let subPath = '';
  
  switch (type) {
    case 'thumbnail':
      subPath = 'courses/thumbnails';
      break;
    case 'video':
      subPath = 'courses/videos';
      break;
    case 'document':
      subPath = 'documents';
      break;
    case 'material':
      subPath = 'lessons/materials';
      break;
    case 'avatar':
      subPath = 'users/avatars';
      break;
  }
  
  return `${baseUrl}/uploads/${subPath}/${filename}`;
};

// Helper function to delete file
export const deleteFile = async (filename: string, type: 'thumbnail' | 'video' | 'document' | 'material' | 'avatar'): Promise<void> => {
  try {
    let subPath = '';
    
    switch (type) {
      case 'thumbnail':
        subPath = 'courses/thumbnails';
        break;
      case 'video':
        subPath = 'courses/videos';
        break;
      case 'document':
        subPath = 'documents';
        break;
      case 'material':
        subPath = 'lessons/materials';
        break;
      case 'avatar':
        subPath = 'users/avatars';
        break;
    }
    
    const filePath = path.join(__dirname, `../../uploads/${subPath}`, filename);
    await fs.unlink(filePath);
  } catch (error) {
    console.error(`Failed to delete ${type} file:`, error);
  }
}; 