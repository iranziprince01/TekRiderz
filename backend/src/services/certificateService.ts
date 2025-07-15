import { certificateModel } from '../models/Certificate';
import { userModel } from '../models/User';
import { courseModel } from '../models/Course';
import { enrollmentModel } from '../models/Enrollment';
import { progressModel } from '../models/Progress';
import { certificatePdfGenerator } from './certificatePdfGenerator';
import { logger } from '../utils/logger';
import { 
  Certificate, 
  User, 
  Course, 
  Enrollment,
  Progress 
} from '../types';

export class CertificateService {
  
  /**
   * Auto-generate certificate when course is completed
   */
  async generateCertificateOnCompletion(
    userId: string, 
    courseId: string, 
    enrollmentId: string
  ): Promise<Certificate | null> {
    try {
      logger.info('Starting certificate generation', { userId, courseId, enrollmentId });

      // Check if certificate already exists
      const existingCertificate = await certificateModel.findByEnrollmentId(enrollmentId);
      if (existingCertificate) {
        logger.info('Certificate already exists', { 
          certificateId: existingCertificate._id,
          enrollmentId 
        });
        return existingCertificate;
      }

      // Get required data
      const [user, course, enrollment, progress] = await Promise.all([
        userModel.findById(userId),
        courseModel.findById(courseId),
        enrollmentModel.findById(enrollmentId),
        progressModel.findByUserAndCourse(userId, courseId)
      ]);

      if (!user || !course || !enrollment) {
        logger.error('Missing required data for certificate generation', {
          hasUser: !!user,
          hasCourse: !!course,
          hasEnrollment: !!enrollment,
          userId,
          courseId,
          enrollmentId
        });
        return null;
      }

      // Verify enrollment is completed
      if (enrollment.status !== 'completed' || enrollment.progress < 100) {
        logger.warn('Enrollment not completed, skipping certificate generation', {
          status: enrollment.status,
          progress: enrollment.progress,
          enrollmentId
        });
        return null;
      }

      // Calculate final grade and determine template
      const finalGrade = this.calculateFinalGrade(progress, enrollment);
      const templateType = this.selectTemplateType(finalGrade);

      // Generate certificate data
      const certificateData = this.createCertificateData(
        user, 
        course,
        enrollment, 
        templateType, 
        finalGrade
      );

      // Create certificate record
      const certificate = await certificateModel.create(certificateData);

      // Generate actual PDF certificate
      try {
        const { filePath, fileSize } = await certificatePdfGenerator.generateCertificatePdf(certificate);
        
        // Generate certificate URL
        const certificateUrl = this.generateCertificateUrl(certificate);

        // Update certificate with PDF details
        const updatedCertificate = await certificateModel.update(certificate._id!, {
          pdfUrl: certificateUrl,
          pdfFilename: `certificate_${certificate.certificateNumber}.pdf`,
          fileSize
        });

        // Update enrollment with certificate reference
        await enrollmentModel.update(enrollmentId, {
          certificate: {
            id: certificate._id!,
            issuedAt: certificate.issuedAt,
            url: certificateUrl
          }
        });

        logger.info('Certificate PDF generated and stored', {
          certificateId: certificate._id,
          filePath,
          fileSize,
          certificateNumber: certificate.certificateNumber
        });

        return updatedCertificate;

      } catch (pdfError) {
        logger.error('Failed to generate PDF for certificate', {
          certificateId: certificate._id,
          error: pdfError
        });

        // Still return certificate record even if PDF generation fails
        const certificateUrl = this.generateCertificateUrl(certificate);
        const updatedCertificate = await certificateModel.update(certificate._id!, {
          pdfUrl: certificateUrl,
          pdfFilename: `certificate_${certificate.certificateNumber}.pdf`,
          fileSize: 0 // Indicates PDF generation failed
        });

        // Update enrollment with certificate reference
        await enrollmentModel.update(enrollmentId, {
          certificate: {
            id: certificate._id!,
            issuedAt: certificate.issuedAt,
            url: certificateUrl
          }
        });

        logger.info('Certificate generated successfully (PDF failed)', {
          certificateId: certificate._id,
          certificateNumber: certificate.certificateNumber,
          userId,
          courseId,
          templateType,
          finalGrade
        });

        return updatedCertificate;
      }

    } catch (error) {
      logger.error('Failed to generate certificate', { userId, courseId, enrollmentId, error });
      return null;
    }
  }

  /**
   * Calculate final grade from progress and enrollment data
   */
  private calculateFinalGrade(progress: Progress | null, enrollment: Enrollment): number {
    if (!progress) {
      return Math.round(enrollment.progress);
    }

    // Calculate grade based on quiz scores and completion
    let totalPoints = 0;
    let maxPoints = 0;

    // Include quiz scores
    Object.values(progress.quizScores || {}).forEach(quizScore => {
      if (quizScore.bestScore !== undefined && quizScore.bestPercentage !== undefined) {
        totalPoints += quizScore.bestPercentage;
        maxPoints += 100;
      }
    });

    // If no quizzes, use progress percentage
    if (maxPoints === 0) {
      return Math.round(enrollment.progress);
    }

    // Calculate weighted average (quiz scores 70%, completion 30%)
    const quizAverage = (totalPoints / maxPoints) * 100;
    const finalGrade = (quizAverage * 0.7) + (enrollment.progress * 0.3);

    return Math.round(Math.min(100, Math.max(0, finalGrade)));
  }

  /**
   * Select template type based on grade
   */
  private selectTemplateType(grade: number): 'completion' | 'achievement' | 'excellence' {
    if (grade >= 98) return 'excellence';
    if (grade >= 90) return 'achievement';
    return 'completion';
  }

  /**
   * Create certificate data object
   */
  private createCertificateData(
    user: User,
    course: Course,
    enrollment: Enrollment,
    templateType: 'completion' | 'achievement' | 'excellence',
    finalGrade: number
  ): Omit<Certificate, '_id' | '_rev' | 'createdAt' | 'updatedAt'> {
    const certificateNumber = certificateModel.generateCertificateNumber();
    const issuedAt = new Date().toISOString();
    const completedAt = enrollment.completedAt || issuedAt;
    
    // Generate verification code
    const tempId = `cert_${Date.now()}`;
    const verificationCode = certificateModel.generateVerificationCode(tempId, certificateNumber);
    
    // Determine grade letter
    const gradeLetter = this.getGradeLetter(finalGrade);
    
    // Extract skills from course learning objectives
    const skills = course.learningObjectives || [];
    
    // Generate achievements based on performance
    const achievements = this.generateAchievements(finalGrade, templateType);

    const certificateData: Omit<Certificate, '_id' | '_rev' | 'createdAt' | 'updatedAt'> = {
      type: 'certificate',
      id: tempId,
      userId: user.id,
      courseId: course.id,
      enrollmentId: enrollment._id!,
      certificateNumber,
      templateType,
      status: 'active',
      
      // Course and user information
      courseName: course.title,
      courseDescription: course.description,
      instructorName: course.instructorName,
      learnerName: user.name,
      learnerEmail: user.email,
      
      // Completion details
      completedAt,
      issuedAt,
      totalDuration: course.totalDuration,
      finalGrade,
      
      // Certificate details
      certificateData: {
        template: templateType,
        grade: gradeLetter,
        skills,
        achievements,
        verificationCode
      },
      
      // File information (to be updated)
      pdfUrl: '',
      pdfFilename: '',
      fileSize: 0,
      
      // Verification and security
      digitalSignature: '', // Will be generated after creation
      verificationUrl: verificationCode,
      isVerified: true,
      
      // Metadata
      generatedBy: 'system',
      language: user.preferences?.language || 'en',
      
      // Validity
      isRevoked: false,
    };

    // Generate digital signature
    certificateData.digitalSignature = certificateModel.generateDigitalSignature(certificateData);

    return certificateData;
  }

  /**
   * Get grade letter from percentage
   */
  private getGradeLetter(percentage: number): 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'Pass' {
    if (percentage >= 98) return 'A+';
    if (percentage >= 90) return 'A';
    if (percentage >= 85) return 'B+';
    if (percentage >= 80) return 'B';
    if (percentage >= 75) return 'C+';
    if (percentage >= 70) return 'C';
    return 'Pass';
  }

  /**
   * Generate achievements based on performance
   */
  private generateAchievements(grade: number, templateType: string): string[] {
    const achievements: string[] = [];

    if (grade >= 98) {
      achievements.push('Perfect Score Achievement');
    } else if (grade >= 95) {
      achievements.push('Excellence in Learning');
    } else if (grade >= 90) {
      achievements.push('Outstanding Performance');
    } else if (grade >= 85) {
      achievements.push('High Achievement');
    }

    if (templateType === 'excellence') {
      achievements.push('Distinguished Learner');
    } else if (templateType === 'achievement') {
      achievements.push('Dedicated Student');
    }

    achievements.push('Course Completion Certificate');

    return achievements;
  }

  /**
   * Generate certificate URL for PDF access
   */
  private generateCertificateUrl(certificate: Certificate): string {
    const baseUrl = process.env.API_URL || 'http://localhost:3000';
    return `${baseUrl}/uploads/certificates/certificate_${certificate.certificateNumber}.pdf`;
  }

  /**
   * Get certificate by ID
   */
  async getCertificateById(certificateId: string): Promise<Certificate | null> {
    try {
      return await certificateModel.findById(certificateId);
    } catch (error) {
      logger.error('Failed to get certificate by ID', { certificateId, error });
      return null;
    }
  }

  /**
   * Verify certificate authenticity
   */
  async verifyCertificate(certificateId: string, certificateNumber?: string) {
    try {
      return await certificateModel.verifyCertificate(certificateId, certificateNumber);
    } catch (error) {
      logger.error('Certificate verification failed', { certificateId, error });
      return {
        isValid: false,
        errors: ['Verification failed due to system error']
      };
    }
  }

  /**
   * Get user certificates
   */
  async getUserCertificates(userId: string): Promise<Certificate[]> {
    try {
      return await certificateModel.findByUserId(userId);
    } catch (error) {
      logger.error('Failed to get user certificates', { userId, error });
      return [];
    }
  }

  /**
   * Get certificate statistics
   */
  async getCertificateStats() {
    try {
      return await certificateModel.getCertificateStats();
    } catch (error) {
      logger.error('Failed to get certificate statistics', { error });
      throw error;
    }
  }
}

export const certificateService = new CertificateService(); 