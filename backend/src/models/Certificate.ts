import { BaseModel } from './BaseModel';
import { Certificate } from '../types';
import { databases } from '../config/database';
import { logger } from '../utils/logger';
import crypto from 'crypto';

export class CertificateModel extends BaseModel<Certificate> {
  constructor() {
    super('certificates', 'certificate');
  }

  // Generate unique certificate number
  generateCertificateNumber(): string {
    const year = new Date().getFullYear();
    const timestamp = Date.now().toString().slice(-6); // Last 6 digits of timestamp
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `CERT-${year}-${timestamp}-${random}`;
  }

  // Generate digital signature for verification
  generateDigitalSignature(certificate: Partial<Certificate>): string {
    const data = `${certificate.certificateNumber}-${certificate.userId}-${certificate.courseId}-${certificate.completedAt}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  // Generate verification code for QR code
  generateVerificationCode(certificateId: string, certificateNumber: string): string {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return `${baseUrl}/verify-certificate/${certificateId}?cert=${certificateNumber}`;
  }

  // Create certificate with proper validation
  async create(certificateData: Omit<Certificate, '_id' | '_rev' | 'createdAt' | 'updatedAt'>): Promise<Certificate> {
    try {
      const certificateWithDefaults = {
        ...certificateData,
        type: 'certificate' as const,
        status: certificateData.status || 'active',
        isVerified: true,
        isRevoked: false,
        generatedBy: certificateData.generatedBy || 'system',
        language: certificateData.language || 'en',
      };

      const certificate = await super.create(certificateWithDefaults);
      
      logger.info('Certificate created successfully', {
        certificateId: certificate._id,
        certificateNumber: certificate.certificateNumber,
        userId: certificate.userId,
        courseId: certificate.courseId
      });

      return certificate;
    } catch (error) {
      logger.error('Failed to create certificate:', error);
      throw error;
    }
  }

  // Find certificate by certificate number
  async findByCertificateNumber(certificateNumber: string): Promise<Certificate | null> {
    try {
      const result = await this.findByView('certificates', 'by_certificate_number', {
        key: certificateNumber,
      });

      if (result.docs.length === 0) {
        return null;
      }

      return result.docs[0] || null;
    } catch (error) {
      logger.error('Failed to find certificate by number:', { certificateNumber, error });
      return null;
    }
  }

  // Find certificates by user ID
  async findByUserId(userId: string): Promise<Certificate[]> {
    try {
      const result = await this.findByView('certificates', 'by_user', {
        key: userId,
      });

      return result.docs;
    } catch (error) {
      logger.error('Failed to find certificates by user:', { userId, error });
      return [];
    }
  }

  // Find certificate by enrollment ID
  async findByEnrollmentId(enrollmentId: string): Promise<Certificate | null> {
    try {
      const result = await this.findByView('certificates', 'by_enrollment', {
        key: enrollmentId,
      });

      if (result.docs.length === 0) {
        return null;
      }

      return result.docs[0] || null;
    } catch (error) {
      logger.error('Failed to find certificate by enrollment:', { enrollmentId, error });
      return null;
    }
  }

  // Get certificates by course ID
  async findByCourseId(courseId: string): Promise<Certificate[]> {
    try {
      const result = await this.findByView('certificates', 'by_course', {
        key: courseId,
      });

      return result.docs;
    } catch (error) {
      logger.error('Failed to find certificates by course:', { courseId, error });
      return [];
    }
  }

  // Verify certificate authenticity
  async verifyCertificate(certificateId: string, certificateNumber?: string): Promise<{
    isValid: boolean;
    certificate?: Certificate | undefined;
    errors: string[];
  }> {
    try {
      const errors: string[] = [];
      
      // Find certificate by ID
      const certificate = await this.findById(certificateId);
      if (!certificate) {
        errors.push('Certificate not found');
        return { isValid: false, errors };
      }

      // Check certificate number if provided
      if (certificateNumber && certificate.certificateNumber !== certificateNumber) {
        errors.push('Certificate number mismatch');
      }

      // Check if certificate is revoked
      if (certificate.isRevoked) {
        errors.push('Certificate has been revoked');
      }

      // Check if certificate is expired
      if (certificate.expiresAt) {
        const expiryDate = new Date(certificate.expiresAt);
        if (expiryDate < new Date()) {
          errors.push('Certificate has expired');
        }
      }

      // Verify digital signature
      const expectedSignature = this.generateDigitalSignature(certificate);
      if (certificate.digitalSignature !== expectedSignature) {
        errors.push('Digital signature is invalid');
      }

      // Check certificate status
      if (certificate.status !== 'active') {
        errors.push(`Certificate status is ${certificate.status}`);
      }

      const isValid = errors.length === 0;
      
      logger.info('Certificate verification completed', {
        certificateId,
        certificateNumber: certificate.certificateNumber,
        isValid,
        errors
      });

      return {
        isValid,
        certificate: isValid ? certificate : undefined,
        errors
      };
    } catch (error) {
      logger.error('Certificate verification failed:', { certificateId, error });
      return {
        isValid: false,
        errors: ['Verification failed due to system error']
      };
    }
  }

  // Revoke certificate
  async revokeCertificate(
    certificateId: string, 
    reason: string, 
    revokedBy: string
  ): Promise<Certificate> {
    try {
      const updateData: Partial<Certificate> = {
        isRevoked: true,
        status: 'revoked',
        revokedAt: new Date().toISOString(),
        revokedReason: reason,
        revokedBy: revokedBy,
      };

      const updatedCertificate = await this.update(certificateId, updateData);
      
      logger.info('Certificate revoked', {
        certificateId,
        certificateNumber: updatedCertificate.certificateNumber,
        reason,
        revokedBy
      });

      return updatedCertificate;
    } catch (error) {
      logger.error('Failed to revoke certificate:', { certificateId, error });
      throw error;
    }
  }

  // Get certificate statistics
  async getCertificateStats(): Promise<{
    total: number;
    active: number;
    revoked: number;
    expired: number;
    byTemplate: Record<string, number>;
    byMonth: Record<string, number>;
  }> {
    try {
      const allCertificates = await this.findAll({ limit: 10000 });
      const certificates = allCertificates.docs;
      
      const stats = {
        total: certificates.length,
        active: 0,
        revoked: 0,
        expired: 0,
        byTemplate: {} as Record<string, number>,
        byMonth: {} as Record<string, number>,
      };

      const now = new Date();

      certificates.forEach(cert => {
        // Count by status
        if (cert.isRevoked) {
          stats.revoked++;
        } else if (cert.expiresAt && new Date(cert.expiresAt) < now) {
          stats.expired++;
        } else {
          stats.active++;
        }

        // Count by template
        const template = cert.certificateData.template;
        stats.byTemplate[template] = (stats.byTemplate[template] || 0) + 1;

        // Count by month
        const monthKey = cert.issuedAt.substring(0, 7); // YYYY-MM
        stats.byMonth[monthKey] = (stats.byMonth[monthKey] || 0) + 1;
      });

      return stats;
    } catch (error) {
      logger.error('Failed to get certificate statistics:', error);
      throw error;
    }
  }

  // Search certificates with filters
  async searchCertificates(filters: {
    userId?: string;
    courseId?: string;
    status?: string;
    templateType?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    certificates: Certificate[];
    total: number;
  }> {
    try {
      let certificates = await this.findAll({ limit: 10000 });
      let results = certificates.docs;

      // Apply filters
      if (filters.userId) {
        results = results.filter(cert => cert.userId === filters.userId);
      }

      if (filters.courseId) {
        results = results.filter(cert => cert.courseId === filters.courseId);
      }

      if (filters.status) {
        results = results.filter(cert => cert.status === filters.status);
      }

      if (filters.templateType) {
        results = results.filter(cert => cert.templateType === filters.templateType);
      }

      if (filters.startDate) {
        const startDate = new Date(filters.startDate);
        results = results.filter(cert => new Date(cert.issuedAt) >= startDate);
      }

      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        results = results.filter(cert => new Date(cert.issuedAt) <= endDate);
      }

      // Sort by issue date (newest first)
      results.sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime());

      const total = results.length;

      // Apply pagination
      const offset = filters.offset || 0;
      const limit = filters.limit || 20;
      results = results.slice(offset, offset + limit);

      return {
        certificates: results,
        total
      };
    } catch (error) {
      logger.error('Failed to search certificates:', { filters, error });
      throw error;
    }
  }
}

export const certificateModel = new CertificateModel(); 