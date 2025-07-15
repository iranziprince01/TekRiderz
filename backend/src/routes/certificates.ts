import { Router, Request, Response } from 'express';
import { certificateService } from '../services/certificateService';
import { certificateModel } from '../models/Certificate';
import { certificatePdfGenerator } from '../services/certificatePdfGenerator';
import { authenticate, authorize } from '../middleware/auth';
import { logger } from '../utils/logger';
import path from 'path';
import fs from 'fs/promises';

const router = Router();

// Get user's certificates
router.get('/my-certificates', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const certificates = await certificateService.getUserCertificates(req.user.id);

    logger.info('User certificates retrieved', {
      userId: req.user.id,
      certificateCount: certificates.length
    });

    return res.json({
      success: true,
      data: {
        certificates,
        total: certificates.length,
      },
    });
  } catch (error) {
    logger.error('Failed to get user certificates:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve certificates',
    });
  }
});

// Get specific certificate details
router.get('/:certificateId', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const { certificateId } = req.params;
    
    if (!certificateId) {
      return res.status(400).json({
        success: false,
        error: 'Certificate ID is required',
      });
    }

    const certificate = await certificateService.getCertificateById(certificateId);

    if (!certificate) {
      return res.status(404).json({
        success: false,
        error: 'Certificate not found',
      });
    }

    // Check if user owns the certificate (or is admin/instructor)
    const hasAccess = 
      certificate.userId === req.user.id || 
      req.user.role === 'admin' ||
      (req.user.role === 'tutor' && certificate.instructorName === req.user.name);

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    return res.json({
      success: true,
      data: { certificate },
    });
  } catch (error) {
    logger.error('Failed to get certificate:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve certificate',
    });
  }
});

// Download certificate PDF
router.get('/:certificateId/download', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const { certificateId } = req.params;
    
    if (!certificateId) {
      return res.status(400).json({
        success: false,
        error: 'Certificate ID is required',
      });
    }

    const certificate = await certificateService.getCertificateById(certificateId);

    if (!certificate) {
      return res.status(404).json({
        success: false,
        error: 'Certificate not found',
      });
    }

    // Check if user owns the certificate (or is admin/instructor)
    const hasAccess = 
      certificate.userId === req.user.id || 
      req.user.role === 'admin' ||
      (req.user.role === 'tutor' && certificate.instructorName === req.user.name);

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    // Get PDF file path
    const pdfPath = certificatePdfGenerator.getCertificateFilePath(certificate.certificateNumber);

    // Check if PDF file exists
    try {
      await fs.access(pdfPath);
    } catch {
      return res.status(404).json({
        success: false,
        error: 'Certificate PDF not found',
      });
    }

    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${certificate.pdfFilename}"`);

    // Send PDF file
    return res.sendFile(pdfPath);

  } catch (error) {
    logger.error('Failed to download certificate PDF:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to download certificate',
    });
  }
});

// View certificate (simplified for graduation project)
router.get('/:certificateId/view', async (req: Request, res: Response) => {
  try {
    const { certificateId } = req.params;
    
    if (!certificateId) {
      return res.status(400).json({
        success: false,
        error: 'Certificate ID is required',
      });
    }

    const certificate = await certificateService.getCertificateById(certificateId);

    if (!certificate) {
      return res.status(404).json({
        success: false,
        error: 'Certificate not found',
      });
    }

    // Return certificate details for viewing
    return res.json({
      success: true,
      data: {
        certificate: {
          certificateNumber: certificate.certificateNumber,
          learnerName: certificate.learnerName,
          courseName: certificate.courseName,
          instructorName: certificate.instructorName,
          completedAt: certificate.completedAt,
          issuedAt: certificate.issuedAt,
          grade: certificate.certificateData.grade,
          finalGrade: certificate.finalGrade,
          achievements: certificate.certificateData.achievements,
          status: certificate.status,
          templateType: certificate.templateType,
          downloadUrl: `/api/v1/certificates/${certificateId}/download`,
          pdfUrl: certificate.pdfUrl,
          fileSize: certificate.fileSize
        }
      },
    });
  } catch (error) {
    logger.error('Failed to view certificate:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to view certificate',
    });
  }
});

// Verify certificate (public endpoint)
router.get('/verify/:certificateId', async (req: Request, res: Response) => {
  try {
    const { certificateId } = req.params;
    const { cert: certificateNumber } = req.query;

    if (!certificateId) {
      return res.status(400).json({
        success: false,
        error: 'Certificate ID is required',
      });
    }

    const verification = await certificateService.verifyCertificate(
      certificateId, 
      certificateNumber as string
    );

    return res.json({
      success: true,
      data: verification,
    });
  } catch (error) {
    logger.error('Certificate verification failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Verification failed',
    });
  }
});

// Generate certificate manually (admin/instructor only)
router.post('/generate', authenticate, authorize('admin', 'tutor'), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const { userId, courseId, enrollmentId } = req.body;

    if (!userId || !courseId || !enrollmentId) {
      return res.status(400).json({
        success: false,
        error: 'userId, courseId, and enrollmentId are required',
      });
    }

    // Generate certificate
    const certificate = await certificateService.generateCertificateOnCompletion(
      userId,
      courseId,
      enrollmentId
    );

    if (!certificate) {
      return res.status(400).json({
        success: false,
        error: 'Failed to generate certificate. Check if enrollment is completed.',
      });
    }

    logger.info('Certificate generated manually', {
      certificateId: certificate._id,
      generatedBy: req.user.id,
      userId,
      courseId
    });

    return res.status(201).json({
      success: true,
      message: 'Certificate generated successfully',
      data: { certificate },
    });
  } catch (error) {
    logger.error('Manual certificate generation failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate certificate',
    });
  }
});

// Admin: Get all certificates with filtering
router.get('/admin/all', authenticate, authorize('admin'), async (req: Request, res: Response) => {
  try {
    const {
      userId,
      courseId,
      status,
      templateType,
      startDate,
      endDate,
      limit = '20',
      offset = '0'
    } = req.query;

    const filters = {
      userId: userId as string,
      courseId: courseId as string,
      status: status as string,
      templateType: templateType as string,
      startDate: startDate as string,
      endDate: endDate as string,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    };

    const result = await certificateModel.searchCertificates(filters);

    return res.json({
      success: true,
      data: {
        certificates: result.certificates,
        total: result.total,
        filters,
      },
    });
  } catch (error) {
    logger.error('Failed to get admin certificates:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve certificates',
    });
  }
});

// Admin: Revoke certificate
router.post('/:certificateId/revoke', authenticate, authorize('admin'), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const { certificateId } = req.params;
    const { reason } = req.body;

    if (!certificateId) {
      return res.status(400).json({
        success: false,
        error: 'Certificate ID is required',
      });
    }

    if (!reason) {
      return res.status(400).json({
        success: false,
        error: 'Revocation reason is required',
      });
    }

    const revokedCertificate = await certificateModel.revokeCertificate(
      certificateId,
      reason,
      req.user.id
    );

    logger.info('Certificate revoked by admin', {
      certificateId,
      revokedBy: req.user.id,
      reason
    });

    return res.json({
      success: true,
      message: 'Certificate revoked successfully',
      data: { certificate: revokedCertificate },
    });
  } catch (error) {
    logger.error('Failed to revoke certificate:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to revoke certificate',
    });
  }
});

// Admin: Get certificate statistics
router.get('/admin/stats', authenticate, authorize('admin'), async (req: Request, res: Response) => {
  try {
    const stats = await certificateService.getCertificateStats();

    return res.json({
      success: true,
      data: { stats },
    });
  } catch (error) {
    logger.error('Failed to get certificate statistics:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve certificate statistics',
    });
  }
});

// Get certificates for a course (instructor only)
router.get('/course/:courseId', authenticate, authorize('tutor', 'admin'), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const { courseId } = req.params;

    if (!courseId) {
      return res.status(400).json({
        success: false,
        error: 'Course ID is required',
      });
    }

    const certificates = await certificateModel.findByCourseId(courseId);

    return res.json({
      success: true,
      data: {
        certificates,
        total: certificates.length,
        courseId,
      },
    });
  } catch (error) {
    logger.error('Failed to get course certificates:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve course certificates',
    });
  }
});

export { router as certificateRoutes }; 