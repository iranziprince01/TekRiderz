/**
 * Firebase PDF Storage Service
 * 
 * This service handles PDF operations for course module materials.
 * Only tutors upload PDFs (lecture notes, module materials).
 * Learners download PDFs from the course module pages.
 * 
 * PDFs are organized by course and module:
 * - Module PDFs: pdfs/courses/{courseId}/modules/{moduleId}/{tutorId}_{timestamp}_{filename}.pdf
 * 
 * Benefits of Firebase Storage for PDFs:
 * - Clean URLs: https://storage.googleapis.com/bucket/pdfs/courses/123/modules/456/file.pdf
 * - Organized by course and module for easy access
 * - Cost-effective for large files
 * - No complex URL structures
 * - Clear separation: tutors upload, learners download
 */

import { bucket } from '../config/firebase';
import { logger } from '../utils/logger';

export interface FirebasePdfUploadResult {
  success: boolean;
  url?: string;
  fileName?: string;
  filePath?: string;
  error?: string;
  metadata?: {
    size: number;
    contentType: string;
    uploadedAt: Date;
  };
}

export interface FirebasePdfDownloadResult {
  success: boolean;
  url?: string;
  error?: string;
  expiresAt?: Date;
}

export class FirebasePdfService {
  private readonly bucketName: string;
  private readonly pdfFolder: string = 'pdfs';

  constructor() {
    this.bucketName = process.env.FIREBASE_STORAGE_BUCKET || '';
    if (!this.bucketName) {
      logger.error('Firebase Storage bucket not configured');
    }
  }

  /**
   * Upload PDF to Firebase Storage (Tutors only)
   */
  async uploadPdf(
    fileBuffer: Buffer,
    fileName: string,
    tutorId: string,
    courseId: string,
    moduleId: string
  ): Promise<FirebasePdfUploadResult> {
    try {
      if (!this.bucketName) {
        throw new Error('Firebase Storage bucket not configured');
      }

      // Check if bucket is available
      if (!bucket) {
        throw new Error('Firebase Storage bucket is not initialized. Please check Firebase configuration.');
      }

      // Validate required parameters for module PDF upload
      if (!courseId || !moduleId) {
        throw new Error('Course ID and Module ID are required for PDF upload');
      }

      // Create unique file path for module PDFs
      const timestamp = Date.now();
      const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `${this.pdfFolder}/courses/${courseId}/modules/${moduleId}/${tutorId}_${timestamp}_${sanitizedFileName}`;

      // Create file reference
      const file = bucket.file(filePath);

      // Upload file with metadata
      await file.save(fileBuffer, {
        metadata: {
          contentType: 'application/pdf',
          metadata: {
            uploadedBy: tutorId,
            courseId: courseId,
            moduleId: moduleId,
            originalName: fileName,
            uploadedAt: new Date().toISOString(),
            uploadedByRole: 'tutor'
          }
        },
        public: true // Make file publicly accessible for learners
      });

      // Get public URL
      const publicUrl = `https://storage.googleapis.com/${this.bucketName}/${filePath}`;

      logger.info('Module PDF uploaded to Firebase Storage successfully', {
        fileName,
        filePath,
        tutorId,
        courseId,
        moduleId,
        size: fileBuffer.length
      });

      return {
        success: true,
        url: publicUrl,
        fileName: sanitizedFileName,
        filePath,
        metadata: {
          size: fileBuffer.length,
          contentType: 'application/pdf',
          uploadedAt: new Date()
        }
      };

    } catch (error) {
      logger.error('Failed to upload PDF to Firebase Storage:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      };
    }
  }

  /**
   * Generate signed URL for PDF download
   */
  async generateDownloadUrl(
    filePath: string,
    expiresIn: number = 3600 // 1 hour default
  ): Promise<FirebasePdfDownloadResult> {
    try {
      if (!this.bucketName) {
        throw new Error('Firebase Storage bucket not configured');
      }

      // Check if bucket is available
      if (!bucket) {
        throw new Error('Firebase Storage bucket is not initialized. Please check Firebase configuration.');
      }

      const file = bucket.file(filePath);

      // Check if file exists
      const [exists] = await file.exists();
      if (!exists) {
        throw new Error('File not found');
      }

      // Generate signed URL
      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + (expiresIn * 1000)
      });

      const expiresAt = new Date(Date.now() + (expiresIn * 1000));

      logger.info('Generated signed URL for PDF download', {
        filePath,
        expiresAt
      });

      return {
        success: true,
        url: signedUrl,
        expiresAt
      };

    } catch (error) {
      logger.error('Failed to generate download URL:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate download URL'
      };
    }
  }

  /**
   * Delete PDF from Firebase Storage
   */
  async deletePdf(filePath: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.bucketName) {
        throw new Error('Firebase Storage bucket not configured');
      }

      // Check if bucket is available
      if (!bucket) {
        throw new Error('Firebase Storage bucket is not initialized. Please check Firebase configuration.');
      }

      const file = bucket.file(filePath);
      await file.delete();

      logger.info('PDF deleted from Firebase Storage', { filePath });

      return { success: true };

    } catch (error) {
      logger.error('Failed to delete PDF from Firebase Storage:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Delete failed'
      };
    }
  }

  /**
   * List PDFs for a specific module (for learners to download)
   */
  async listModulePdfs(
    courseId: string,
    moduleId: string
  ): Promise<{ success: boolean; files?: any[]; error?: string }> {
    try {
      if (!this.bucketName) {
        throw new Error('Firebase Storage bucket not configured');
      }

      // Check if bucket is available
      if (!bucket) {
        throw new Error('Firebase Storage bucket is not initialized. Please check Firebase configuration.');
      }

      // List PDFs for specific module
      const prefix = `${this.pdfFolder}/courses/${courseId}/modules/${moduleId}/`;

      const [files] = await bucket.getFiles({ prefix });

      const pdfFiles = files
        .filter((file: any) => file.metadata?.contentType === 'application/pdf')
        .map((file: any) => ({
          name: file.name,
          size: file.metadata?.size,
          uploadedAt: file.metadata?.timeCreated,
          url: `https://storage.googleapis.com/${this.bucketName}/${file.name}`,
          metadata: file.metadata?.metadata,
          tutorId: file.metadata?.metadata?.uploadedBy,
          originalName: file.metadata?.metadata?.originalName
        }));

      return {
        success: true,
        files: pdfFiles
      };

    } catch (error) {
      logger.error('Failed to list module PDFs:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list module PDFs'
      };
    }
  }

  /**
   * List PDFs for a course (for tutors to manage)
   */
  async listCoursePdfs(
    courseId: string
  ): Promise<{ success: boolean; files?: any[]; error?: string }> {
    try {
      if (!this.bucketName) {
        throw new Error('Firebase Storage bucket not configured');
      }

      // Check if bucket is available
      if (!bucket) {
        throw new Error('Firebase Storage bucket is not initialized. Please check Firebase configuration.');
      }

      // List all PDFs for a course
      const prefix = `${this.pdfFolder}/courses/${courseId}/`;

      const [files] = await bucket.getFiles({ prefix });

      const pdfFiles = files
        .filter((file: any) => file.metadata?.contentType === 'application/pdf')
        .map((file: any) => ({
          name: file.name,
          size: file.metadata?.size,
          uploadedAt: file.metadata?.timeCreated,
          url: `https://storage.googleapis.com/${this.bucketName}/${file.name}`,
          metadata: file.metadata?.metadata,
          tutorId: file.metadata?.metadata?.uploadedBy,
          moduleId: file.metadata?.metadata?.moduleId,
          originalName: file.metadata?.metadata?.originalName
        }));

      return {
        success: true,
        files: pdfFiles
      };

    } catch (error) {
      logger.error('Failed to list course PDFs:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list course PDFs'
      };
    }
  }
}

export const firebasePdfService = new FirebasePdfService(); 