import { Router, Request, Response } from 'express';
import path from 'path';
import { authenticate, authorize } from '../middleware/auth';
import { 
  uploadThumbnail, 
  uploadVideo, 
  uploadDocument,
  uploadMaterial,
  uploadLessonMaterials,
  handleUploadError 
} from '../middleware/fileUpload';
import { fileService } from '../services/fileService';
import { logger } from '../utils/logger';

const router = Router();

// Upload course thumbnail
router.post('/thumbnail', authenticate, authorize('tutor', 'admin'), uploadThumbnail, handleUploadError, async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded',
      });
    }

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    // Get course ID from request body or params
    const courseId = req.body.courseId || req.params.courseId || 'temp';

    // Use file service to handle upload
    const result = await fileService.handleFileUpload(
      req.file,
      'thumbnail',
      {
        entityType: 'course',
        entityId: courseId,
        uploadedBy: req.user.id,
      }
    );

    logger.info('Thumbnail uploaded successfully', { 
      fileId: result.file._id,
      filename: result.file.filename,
      userId: req.user.id,
      courseId,
      url: result.url
    });

    return res.json({
      success: true,
      message: 'Thumbnail uploaded successfully',
      data: {
        fileId: result.file._id,
        filename: result.file.filename,
        originalName: result.file.originalName,
        size: result.file.size,
        mimetype: result.file.mimetype,
        url: result.url,
        type: result.file.fileType,
        metadata: result.file.metadata,
      },
    });
  } catch (error) {
    logger.error('Failed to upload thumbnail:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to upload thumbnail',
    });
  }
});

// Upload course video
router.post('/video', authenticate, authorize('tutor', 'admin'), uploadVideo, handleUploadError, async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded',
      });
    }

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    // Get course ID from request body or params
    const courseId = req.body.courseId || req.params.courseId || 'temp';

    // Use file service to handle upload
    const result = await fileService.handleFileUpload(
      req.file,
      'video',
      {
        entityType: 'course',
        entityId: courseId,
        uploadedBy: req.user.id,
      }
    );

    logger.info('Video uploaded successfully', { 
      fileId: result.file._id,
      filename: result.file.filename,
      userId: req.user.id,
      courseId,
      url: result.url
    });

    return res.json({
      success: true,
      message: 'Video uploaded successfully',
      data: {
        fileId: result.file._id,
        filename: result.file.filename,
        originalName: result.file.originalName,
        size: result.file.size,
        mimetype: result.file.mimetype,
        url: result.url,
        type: result.file.fileType,
        metadata: result.file.metadata,
      },
    });
  } catch (error) {
    logger.error('Failed to upload video:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to upload video',
    });
  }
});

// Upload document
router.post('/document', authenticate, authorize('tutor', 'admin'), uploadDocument, handleUploadError, async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded',
      });
    }

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    // Get entity info from request body
    const entityType = req.body.entityType || 'course';
    const entityId = req.body.entityId || req.body.courseId || 'temp';

    // Use file service to handle upload
    const result = await fileService.handleFileUpload(
      req.file,
      'document',
      {
        entityType: entityType as 'course' | 'user' | 'lesson',
        entityId: entityId,
        uploadedBy: req.user.id,
      }
    );

    logger.info('Document uploaded successfully', { 
      fileId: result.file._id,
      filename: result.file.filename,
      userId: req.user.id,
      entityType,
      entityId,
      url: result.url
    });

    return res.json({
      success: true,
      message: 'Document uploaded successfully',
      data: {
        fileId: result.file._id,
        filename: result.file.filename,
        originalName: result.file.originalName,
        size: result.file.size,
        mimetype: result.file.mimetype,
        url: result.url,
        type: result.file.fileType,
        metadata: result.file.metadata,
      },
    });
  } catch (error) {
    logger.error('Failed to upload document:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to upload document',
    });
  }
});

// Upload lesson material
router.post('/material', authenticate, authorize('tutor', 'admin'), uploadMaterial, handleUploadError, async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded',
      });
    }

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    // Get lesson ID from request body or params
    const lessonId = req.body.lessonId || req.params.lessonId || 'temp';

    // Use file service to handle upload
    const result = await fileService.handleFileUpload(
      req.file,
      'material',
      {
        entityType: 'lesson',
        entityId: lessonId,
        uploadedBy: req.user.id,
      }
    );

    logger.info('Lesson material uploaded successfully', { 
      fileId: result.file._id,
      filename: result.file.filename,
      userId: req.user.id,
      lessonId,
      url: result.url
    });

    return res.json({
      success: true,
      message: 'Lesson material uploaded successfully',
      data: {
        fileId: result.file._id,
        filename: result.file.filename,
        originalName: result.file.originalName,
        size: result.file.size,
        mimetype: result.file.mimetype,
        url: result.url,
        type: result.file.fileType,
        metadata: result.file.metadata,
      },
    });
  } catch (error) {
    logger.error('Failed to upload lesson material:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to upload lesson material',
    });
  }
});

// Upload multiple lesson materials
router.post('/materials', authenticate, authorize('tutor', 'admin'), uploadLessonMaterials, handleUploadError, async (req: Request, res: Response) => {
  try {
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded',
      });
    }

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    // Get lesson ID from request body or params
    const lessonId = req.body.lessonId || req.params.lessonId || 'temp';

    // Process each file
    const uploadResults = [];
    for (const file of req.files) {
      try {
        const result = await fileService.handleFileUpload(
          file,
          'material',
          {
            entityType: 'lesson',
            entityId: lessonId,
            uploadedBy: req.user.id,
          }
        );
        uploadResults.push(result);
      } catch (error) {
        logger.error('Failed to upload one of the materials:', error);
        // Continue with other files
      }
    }

    logger.info('Lesson materials uploaded successfully', { 
      count: uploadResults.length,
      userId: req.user.id,
      lessonId
    });

    return res.json({
      success: true,
      message: `${uploadResults.length} lesson materials uploaded successfully`,
      data: {
        files: uploadResults.map(result => ({
          fileId: result.file._id,
          filename: result.file.filename,
          originalName: result.file.originalName,
          size: result.file.size,
          mimetype: result.file.mimetype,
          url: result.url,
          type: result.file.fileType,
          metadata: result.file.metadata,
        })),
      },
    });
  } catch (error) {
    logger.error('Failed to upload lesson materials:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to upload lesson materials',
    });
  }
});

// Get file by ID
router.get('/file/:fileId', authenticate, async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;
    
    if (!fileId) {
      return res.status(400).json({
        success: false,
        error: 'File ID is required',
      });
    }

    const file = await fileService.getFile(fileId);
    
    if (!file) {
      return res.status(404).json({
        success: false,
        error: 'File not found',
      });
    }

    return res.json({
      success: true,
      data: {
        fileId: file._id,
        filename: file.filename,
        originalName: file.originalName,
        size: file.size,
        mimetype: file.mimetype,
        url: file.url,
        type: file.fileType,
        metadata: file.metadata,
        uploadedAt: file.uploadedAt,
        entityType: file.entityType,
        entityId: file.entityId,
      },
    });
  } catch (error) {
    logger.error('Failed to get file info:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get file info',
    });
  }
});

// Get files by entity
router.get('/entity/:entityType/:entityId', authenticate, async (req: Request, res: Response) => {
  try {
    const { entityType, entityId } = req.params;
    
    if (!entityType || !entityId) {
      return res.status(400).json({
        success: false,
        error: 'Entity type and ID are required',
      });
    }

    const files = await fileService.getFilesByEntity(entityType, entityId);
    
    return res.json({
      success: true,
      data: files.map(file => ({
        fileId: file._id,
        filename: file.filename,
        originalName: file.originalName,
        size: file.size,
        mimetype: file.mimetype,
        url: file.url,
        type: file.fileType,
        metadata: file.metadata,
        uploadedAt: file.uploadedAt,
      })),
    });
  } catch (error) {
    logger.error('Failed to get entity files:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get entity files',
    });
  }
});

// Delete file
router.delete('/file/:fileId', authenticate, async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;
    
    if (!fileId) {
      return res.status(400).json({
        success: false,
        error: 'File ID is required',
      });
    }

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    // Get file info to check ownership
    const file = await fileService.getFile(fileId);
    if (!file) {
      return res.status(404).json({
        success: false,
        error: 'File not found',
      });
    }

    // Check if user has permission to delete (owner or admin)
    if (file.uploadedBy !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to delete this file',
      });
    }

    const deleted = await fileService.deleteFile(fileId);
    
    if (!deleted) {
      return res.status(500).json({
        success: false,
        error: 'Failed to delete file',
      });
    }

    logger.info('File deleted successfully', { 
      fileId,
      filename: file.filename,
      deletedBy: req.user.id 
    });

    return res.json({
      success: true,
      message: 'File deleted successfully',
    });
  } catch (error) {
    logger.error('Failed to delete file:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete file',
    });
  }
});

// Get storage statistics (admin only)
router.get('/stats', authenticate, authorize('admin'), async (req: Request, res: Response) => {
  try {
    const stats = await fileService.getStorageStats();
    
    return res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Failed to get storage stats:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get storage statistics',
    });
  }
});

// Debug endpoint to verify file storage and retrieval
router.get('/debug/course/:courseId', authenticate, async (req: Request, res: Response) => {
  try {
    const { courseId } = req.params;
    
    if (!courseId) {
      return res.status(400).json({
        success: false,
        error: 'Course ID is required',
      });
    }

    // Get all files associated with this course
    const courseFiles = await fileService.getFilesByEntity('course', courseId);
    
    // Get the course data
    const courseModel = require('../models/Course').courseModel;
    let course = null;
    try {
      course = await courseModel.findById(courseId);
    } catch (error) {
      logger.warn('Course not found:', { courseId, error });
    }

    return res.json({
      success: true,
      debug: {
        courseId,
        course: course ? {
          title: course.title,
          thumbnail: course.thumbnail,
          previewVideo: course.previewVideo,
          sectionsCount: course.sections?.length || 0,
          status: course.status
        } : null,
        files: courseFiles.map(file => ({
          fileId: file._id,
          filename: file.filename,
          originalName: file.originalName,
          fileType: file.fileType,
          url: file.url,
          entityType: file.entityType,
          entityId: file.entityId,
          uploadedAt: file.uploadedAt,
          isActive: file.isActive
        })),
        fileCount: courseFiles.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Failed to get debug info:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get debug info',
    });
  }
});

export { router as fileUploadRoutes };