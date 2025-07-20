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

// Upload PDF to Firebase Storage
router.post('/upload', authenticate, pdfUpload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        error: 'No PDF file provided'
      });
      return;
    }

    const { courseId } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
      return;
    }

    logger.info('Firebase PDF upload request:', {
      fileName: req.file.originalname,
      size: req.file.size,
      userId,
      courseId
    });

    // Upload to Firebase Storage
    const result = await firebasePdfService.uploadPdf(
      req.file.buffer,
      req.file.originalname,
      userId,
      courseId
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

// List PDFs for user or course
router.get('/list', authenticate, async (req: Request, res: Response) => {
  try {
    const { courseId } = req.query;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
      return;
    }

    logger.info('Listing Firebase PDFs:', {
      userId,
      courseId: courseId as string
    });

    // List PDFs
    const result = await firebasePdfService.listPdfs(
      courseId ? undefined : userId,
      courseId as string
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
    logger.error('Failed to list PDFs:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list PDFs'
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