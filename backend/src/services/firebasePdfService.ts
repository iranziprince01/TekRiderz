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
   * Upload PDF to Firebase Storage
   */
  async uploadPdf(
    fileBuffer: Buffer,
    fileName: string,
    userId: string,
    courseId?: string
  ): Promise<FirebasePdfUploadResult> {
    try {
      if (!this.bucketName) {
        throw new Error('Firebase Storage bucket not configured');
      }

      // Check if bucket is available
      if (!bucket) {
        throw new Error('Firebase Storage bucket is not initialized. Please check Firebase configuration.');
      }

      // Create unique file path
      const timestamp = Date.now();
      const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = courseId 
        ? `${this.pdfFolder}/courses/${courseId}/${userId}_${timestamp}_${sanitizedFileName}`
        : `${this.pdfFolder}/users/${userId}/${timestamp}_${sanitizedFileName}`;

      // Create file reference
      const file = bucket.file(filePath);

      // Upload file with metadata
      await file.save(fileBuffer, {
        metadata: {
          contentType: 'application/pdf',
          metadata: {
            uploadedBy: userId,
            courseId: courseId || '',
            originalName: fileName,
            uploadedAt: new Date().toISOString()
          }
        },
        public: true // Make file publicly accessible
      });

      // Get public URL
      const publicUrl = `https://storage.googleapis.com/${this.bucketName}/${filePath}`;

      logger.info('PDF uploaded to Firebase Storage successfully', {
        fileName,
        filePath,
        userId,
        courseId,
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
   * List PDFs for a user or course
   */
  async listPdfs(
    userId?: string,
    courseId?: string
  ): Promise<{ success: boolean; files?: any[]; error?: string }> {
    try {
      if (!this.bucketName) {
        throw new Error('Firebase Storage bucket not configured');
      }

      // Check if bucket is available
      if (!bucket) {
        throw new Error('Firebase Storage bucket is not initialized. Please check Firebase configuration.');
      }

      let prefix = this.pdfFolder;
      if (courseId) {
        prefix += `/courses/${courseId}/`;
      } else if (userId) {
        prefix += `/users/${userId}/`;
      }

      const [files] = await bucket.getFiles({ prefix });

      const pdfFiles = files
        .filter((file: any) => file.metadata?.contentType === 'application/pdf')
        .map((file: any) => ({
          name: file.name,
          size: file.metadata?.size,
          uploadedAt: file.metadata?.timeCreated,
          url: `https://storage.googleapis.com/${this.bucketName}/${file.name}`,
          metadata: file.metadata?.metadata
        }));

      return {
        success: true,
        files: pdfFiles
      };

    } catch (error) {
      logger.error('Failed to list PDFs:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list PDFs'
      };
    }
  }
}

export const firebasePdfService = new FirebasePdfService(); 