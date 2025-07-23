import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { certificateService } from '../services/certificateService';
import { courseModel } from '../models/Course';
import { userModel } from '../models/User';
import { enrollmentModel } from '../models/Enrollment';
import { logger } from '../utils/logger';
import { authenticate } from '../middleware/auth';

const router = Router();

// Validation middleware
const validate = (req: Request, res: Response, next: Function) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
  }
  return next();
};

// Get certificate templates
router.get('/templates', async (req: Request, res: Response): Promise<void> => {
  try {
    const templates = certificateService.getTemplates();
    
    res.json({
      success: true,
      data: templates
    });
  } catch (error) {
    logger.error('Failed to get certificate templates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get certificate templates'
    });
  }
});

// Generate certificate for completed course
router.post('/generate/:courseId', 
  authenticate,
  [
    param('courseId').isString().notEmpty().withMessage('Course ID is required'),
    body('templateId').optional().isString().withMessage('Template ID must be a string'),
    validate
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const courseId = req.params.courseId;
      const { templateId = 'modern-blue' } = req.body;
      const userId = (req as any).user.id;

      if (!courseId) {
        res.status(400).json({
          success: false,
          error: 'Course ID is required'
        });
        return;
      }

      // Check if user is enrolled and completed the course
      const enrollment = await enrollmentModel.findByUserAndCourse(userId, courseId);
      if (!enrollment) {
        res.status(404).json({
          success: false,
          error: 'Enrollment not found'
        });
        return;
      }

      if (enrollment.status !== 'completed') {
        res.status(400).json({
          success: false,
          error: 'Course must be completed to generate certificate'
        });
        return;
      }

      // Get course and user data
      const course = await courseModel.findById(courseId);
      if (!course) {
        res.status(404).json({
          success: false,
          error: 'Course not found'
        });
        return;
      }

      const [student, instructor] = await Promise.all([
        userModel.findById(userId),
        userModel.findById(course.instructorId)
      ]);

      if (!course || !student || !instructor) {
        res.status(404).json({
          success: false,
          error: 'Course, student, or instructor not found'
        });
        return;
      }

      // Create certificate data
      const certificateData = certificateService.createCertificateData(
        enrollment,
        course,
        student,
        instructor
      );

      // Generate certificate
      const { buffer, filename } = await certificateService.generateCertificate(
        certificateData,
        templateId
      );

      logger.info('Certificate generated successfully:', {
        userId,
        courseId,
        certificateId: certificateData.certificateId,
        filename
      });

      // Set response headers for file download
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', buffer.length);

      res.json({
        success: true,
        message: 'Certificate generated successfully',
        data: {
          certificateId: certificateData.certificateId,
          filename,
          downloadUrl: `/api/v1/certificates/download/${certificateData.certificateId}`,
          verifyUrl: `/api/v1/certificates/verify/${certificateData.certificateId}`
        }
      });
    } catch (error) {
      logger.error('Failed to generate certificate:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate certificate'
      });
    }
  }
);

// Download certificate
router.get('/download/:certificateId', async (req: Request, res: Response): Promise<void> => {
  try {
    const certificateId = req.params.certificateId;

    if (!certificateId) {
      res.status(400).json({
        success: false,
        error: 'Certificate ID is required'
      });
      return;
    }

    // Verify certificate exists
    const verification = await certificateService.verifyCertificate(certificateId);
    if (!verification.isValid) {
      res.status(404).json({
        success: false,
        error: 'Certificate not found or invalid'
      });
      return;
    }

    // In a real implementation, you would retrieve the certificate file
    // For now, we'll return a placeholder
    res.json({
      success: true,
      message: 'Certificate download endpoint',
      data: {
        certificateId,
        downloadUrl: `/certificates/${certificateId}.png`
      }
    });
  } catch (error) {
    logger.error('Failed to download certificate:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to download certificate'
    });
  }
});

// Verify certificate
router.get('/verify/:certificateId', async (req: Request, res: Response): Promise<void> => {
  try {
    const certificateId = req.params.certificateId;

    if (!certificateId) {
      res.status(400).json({
        success: false,
        error: 'Certificate ID is required'
      });
      return;
    }

    const verification = await certificateService.verifyCertificate(certificateId);

    res.json({
      success: true,
      data: {
        certificateId,
        isValid: verification.isValid,
        certificateData: verification.certificateData,
        verifiedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Failed to verify certificate:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify certificate'
    });
  }
});

// Get user's certificates
router.get('/user/:userId', 
  authenticate,
  [
    param('userId').isString().notEmpty().withMessage('User ID is required'),
    validate
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.params.userId;
      const requestingUser = (req as any).user;

      if (!userId) {
        res.status(400).json({
          success: false,
          error: 'User ID is required'
        });
        return;
      }

      // Check if user is requesting their own certificates or is admin
      if (requestingUser.id !== userId && requestingUser.role !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'Unauthorized access to certificates'
        });
        return;
      }

      // Get user's completed enrollments
      const enrollments = await enrollmentModel.getUserEnrollments(userId, { status: 'completed' });
      
      const certificates = await Promise.all(
        enrollments.enrollments.map(async (enrollment) => {
          const course = await courseModel.findById(enrollment.courseId);
          if (!course) return null;

          const certificateId = certificateService.generateCertificateId(userId, course.id);
          
          return {
            certificateId,
            courseId: course.id,
            courseTitle: course.title,
            completedAt: enrollment.completedAt,
            progress: enrollment.progress,
            downloadUrl: `/api/v1/certificates/download/${certificateId}`,
            verifyUrl: `/api/v1/certificates/verify/${certificateId}`
          };
        })
      );

      const validCertificates = certificates.filter(cert => cert !== null);

      res.json({
        success: true,
        data: {
          userId,
          certificates: validCertificates,
          totalCertificates: validCertificates.length
        }
      });
    } catch (error) {
      logger.error('Failed to get user certificates:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get user certificates'
      });
    }
  }
);

// Admin: Get all certificates
router.get('/admin/all', 
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = (req as any).user;
      
      if (user.role !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'Admin access required'
        });
        return;
      }

      // Get all completed enrollments
      const enrollmentsResult = await enrollmentModel.findAll();
      const completedEnrollments = enrollmentsResult.docs.filter(enrollment => enrollment.status === 'completed');
      
      const certificates = await Promise.all(
        completedEnrollments.map(async (enrollment: any) => {
          const [course, student] = await Promise.all([
            courseModel.findById(enrollment.courseId),
            userModel.findById(enrollment.userId)
          ]);

          if (!course || !student) return null;

          const certificateId = certificateService.generateCertificateId(
            enrollment.userId, 
            enrollment.courseId
          );

          return {
            certificateId,
            courseId: course.id,
            courseTitle: course.title,
            studentId: student.id,
            studentName: student.name,
            completedAt: enrollment.completedAt,
            progress: enrollment.progress
          };
        })
      );

      const validCertificates = certificates.filter((cert: any) => cert !== null);

      res.json({
        success: true,
        data: {
          certificates: validCertificates,
          totalCertificates: validCertificates.length
        }
      });
    } catch (error) {
      logger.error('Failed to get all certificates:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get all certificates'
      });
    }
  }
);

export { router as certificateRoutes }; 