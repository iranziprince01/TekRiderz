import { BaseModel } from './BaseModel';
import { BaseDocument } from '../types';
import { logger } from '../utils/logger';

export interface Certificate extends BaseDocument {
  type: 'certificate';
  certificateId: string;
  userId: string;
  courseId: string;
  studentName: string;
  courseTitle: string;
  completionDate: string;
  grade: number;
  status: 'valid' | 'revoked' | 'expired';
  downloadUrl?: string;
  verifyUrl?: string;
  filePath?: string;
  metadata?: {
    generatedAt: string;
    generatedBy: string;
    template: string;
    version: string;
  };
}

export class CertificateModel extends BaseModel<Certificate> {
  constructor() {
    super('certificates', 'certificate');
  }

  /**
   * Create a new certificate record
   */
  async createCertificate(certificateData: Omit<Certificate, '_id' | '_rev' | 'type'>): Promise<Certificate> {
    try {
      const certificate: Certificate = {
        ...certificateData,
        type: 'certificate',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const result = await this.db.insert(certificate);
      
      logger.info('Certificate created successfully:', {
        certificateId: certificate.certificateId,
        userId: certificate.userId,
        courseId: certificate.courseId
      });

      return {
        ...certificate,
        _id: result.id!,
        _rev: result.rev!
      };
    } catch (error) {
      logger.error('Failed to create certificate:', error);
      throw error;
    }
  }

  /**
   * Get certificate by certificate ID
   */
  async getByCertificateId(certificateId: string): Promise<Certificate | null> {
    try {
      const result = await this.db.view('certificates', 'by_certificate_id', {
        key: certificateId,
        include_docs: true
      });

      if (result.rows.length === 0 || !result.rows[0]?.doc) {
        return null;
      }

      return result.rows[0].doc as Certificate;
    } catch (error) {
      logger.error('Failed to get certificate by ID:', error);
      return null;
    }
  }

  /**
   * Get all certificates for a user
   */
  async getByUserId(userId: string): Promise<Certificate[]> {
    try {
      const result = await this.db.view('certificates', 'by_user', {
        key: userId,
        include_docs: true
      });

      return result.rows.map(row => row.doc as Certificate);
    } catch (error) {
      logger.error('Failed to get certificates by user:', error);
      return [];
    }
  }

  /**
   * Get all certificates for a course
   */
  async getByCourseId(courseId: string): Promise<Certificate[]> {
    try {
      const result = await this.db.view('certificates', 'by_course', {
        key: courseId,
        include_docs: true
      });

      return result.rows.map(row => row.doc as Certificate);
    } catch (error) {
      logger.error('Failed to get certificates by course:', error);
      return [];
    }
  }

  /**
   * Get valid certificates for a user-course combination
   */
  async getValidCertificate(userId: string, courseId: string): Promise<Certificate | null> {
    try {
      const result = await this.db.view('certificates', 'valid_certificates', {
        key: [userId, courseId],
        include_docs: true
      });

      if (result.rows.length === 0 || !result.rows[0]?.doc) {
        return null;
      }

      return result.rows[0].doc as Certificate;
    } catch (error) {
      logger.error('Failed to get valid certificate:', error);
      return null;
    }
  }

  /**
   * Update certificate status
   */
  async updateStatus(certificateId: string, status: 'valid' | 'revoked' | 'expired'): Promise<boolean> {
    try {
      const certificate = await this.getByCertificateId(certificateId);
      if (!certificate) {
        return false;
      }

      const updatedCertificate: Certificate = {
        ...certificate,
        status,
        updatedAt: new Date().toISOString()
      };

      await this.db.insert(updatedCertificate);
      
      logger.info('Certificate status updated:', {
        certificateId,
        status
      });

      return true;
    } catch (error) {
      logger.error('Failed to update certificate status:', error);
      return false;
    }
  }

  /**
   * Update certificate URLs
   */
  async updateUrls(certificateId: string, downloadUrl: string, verifyUrl: string): Promise<boolean> {
    try {
      const certificate = await this.getByCertificateId(certificateId);
      if (!certificate) {
        return false;
      }

      const updatedCertificate: Certificate = {
        ...certificate,
        downloadUrl,
        verifyUrl,
        updatedAt: new Date().toISOString()
      };

      await this.db.insert(updatedCertificate);
      
      logger.info('Certificate URLs updated:', {
        certificateId,
        downloadUrl,
        verifyUrl
      });

      return true;
    } catch (error) {
      logger.error('Failed to update certificate URLs:', error);
      return false;
    }
  }

  /**
   * Get all certificates (admin function)
   */
  async getAllCertificates(): Promise<Certificate[]> {
    try {
      const result = await this.db.view('certificates', 'by_user', {
        include_docs: true
      });

      return result.rows.map(row => row.doc as Certificate);
    } catch (error) {
      logger.error('Failed to get all certificates:', error);
      return [];
    }
  }

  /**
   * Delete certificate (admin function)
   */
  async deleteCertificate(certificateId: string): Promise<boolean> {
    try {
      const certificate = await this.getByCertificateId(certificateId);
      if (!certificate) {
        return false;
      }

      await this.db.destroy(certificate._id!, certificate._rev!);
      
      logger.info('Certificate deleted:', {
        certificateId
      });

      return true;
    } catch (error) {
      logger.error('Failed to delete certificate:', error);
      return false;
    }
  }
}

export const certificateModel = new CertificateModel(); 