/**
 * Firebase PDF Storage Routes
 * 
 * This module handles PDF operations for course module materials.
 * Only tutors upload PDFs (lecture notes, module materials).
 * Learners download PDFs from the course module pages.
 * 
 * PDFs are organized by course and module:
 * - Module PDFs: pdfs/courses/{courseId}/modules/{moduleId}/{tutorId}_{timestamp}_{filename}.pdf
 * 
 * Benefits of Firebase Storage for PDFs:
 * - Clean, organized URLs: https://storage.googleapis.com/bucket/pdfs/courses/123/modules/456/file.pdf
 * - Scalable and cost-effective
 * - CDN delivery for fast access
 * - Built-in security and access controls
 * - No long URLs like Cloudinary
 * - Clear separation: tutors upload, learners download
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';
import multer from 'multer';
import { firebasePdfService } from '../services/firebasePdfService';

const router = Router();

// Configure multer for PDF uploads
const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

// Upload PDF to Firebase Storage (Tutors only)
router.post('/upload', authenticate, pdfUpload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        error: 'No PDF file provided'
      });
      return;
    }

    const { courseId, moduleId } = req.body;
    const tutorId = req.user?.id;

    if (!tutorId) {
      res.status(401).json({
        success: false,
        error: 'Tutor not authenticated'
      });
      return;
    }

    if (!courseId || !moduleId) {
      res.status(400).json({
        success: false,
        error: 'Course ID and Module ID are required'
      });
      return;
    }

    logger.info('Firebase PDF upload request:', {
      fileName: req.file.originalname,
      size: req.file.size,
      tutorId,
      courseId,
      moduleId
    });

    // Upload to Firebase Storage
    const result = await firebasePdfService.uploadPdf(
      req.file.buffer,
      req.file.originalname,
      tutorId,
      courseId,
      moduleId
    );

    if (result.success) {
      res.json({
        success: true,
        data: {
          url: result.url,
          fileName: result.fileName,
          filePath: result.filePath,
          metadata: result.metadata
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    logger.error('Firebase PDF upload failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed'
    });
  }
});

// Generate signed download URL
router.post('/download-url', authenticate, async (req: Request, res: Response) => {
  try {
    const { filePath, expiresIn = 3600 } = req.body;
    const userId = req.user?.id;

    if (!filePath) {
      res.status(400).json({
        success: false,
        error: 'File path is required'
      });
      return;
    }

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
      return;
    }

    logger.info('Generating Firebase PDF download URL:', {
      filePath,
      userId,
      expiresIn
    });

    // Generate signed URL
    const result = await firebasePdfService.generateDownloadUrl(filePath, expiresIn);

    if (result.success) {
      res.json({
        success: true,
        data: {
          url: result.url,
          expiresAt: result.expiresAt
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    logger.error('Failed to generate download URL:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate download URL'
    });
  }
});

// List PDFs for a specific module (for learners to download)
router.get('/list-module', authenticate, async (req: Request, res: Response) => {
  try {
    const { courseId, moduleId } = req.query;

    if (!courseId || !moduleId) {
      res.status(400).json({
        success: false,
        error: 'Course ID and Module ID are required'
      });
      return;
    }

    logger.info('Listing module PDFs:', {
      courseId: courseId as string,
      moduleId: moduleId as string
    });

    // List PDFs for specific module
    const result = await firebasePdfService.listModulePdfs(
      courseId as string,
      moduleId as string
    );

    if (result.success) {
      res.json({
        success: true,
        data: {
          files: result.files
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    logger.error('Failed to list module PDFs:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list module PDFs'
    });
  }
});

// List PDFs for a course (for tutors to manage)
router.get('/list-course', authenticate, async (req: Request, res: Response) => {
  try {
    const { courseId } = req.query;

    if (!courseId) {
      res.status(400).json({
        success: false,
        error: 'Course ID is required'
      });
      return;
    }

    logger.info('Listing course PDFs:', {
      courseId: courseId as string
    });

    // List all PDFs for a course
    const result = await firebasePdfService.listCoursePdfs(courseId as string);

    if (result.success) {
      res.json({
        success: true,
        data: {
          files: result.files
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    logger.error('Failed to list course PDFs:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list course PDFs'
    });
  }
});

// Delete PDF
router.delete('/delete', authenticate, async (req: Request, res: Response) => {
  try {
    const { filePath } = req.body;
    const userId = req.user?.id;

    if (!filePath) {
      res.status(400).json({
        success: false,
        error: 'File path is required'
      });
      return;
    }

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
      return;
    }

    logger.info('Deleting Firebase PDF:', {
      filePath,
      userId
    });

    // Delete PDF
    const result = await firebasePdfService.deletePdf(filePath);

    if (result.success) {
      res.json({
        success: true,
        message: 'PDF deleted successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    logger.error('Failed to delete PDF:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete PDF'
    });
  }
});

export default router; 