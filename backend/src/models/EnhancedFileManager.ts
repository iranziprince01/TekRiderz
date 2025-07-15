import { BaseModel } from './BaseModel';
import { FileMetadata } from '../types';
import { logger } from '../utils/logger';
import { fileModel } from './File';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';

interface FileUploadSession {
  sessionId: string;
  userId: string;
  entityType: 'course' | 'lesson' | 'draft';
  entityId: string;
  totalFiles: number;
  uploadedFiles: number;
  failedFiles: number;
  totalSize: number;
  uploadedSize: number;
  startedAt: string;
  completedAt?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  files: {
    fileId: string;
    filename: string;
    size: number;
    type: string;
    status: 'pending' | 'uploading' | 'processing' | 'completed' | 'failed';
    progress: number;
    uploadedAt?: string;
    error?: string;
  }[];
}

interface FileValidationRule {
  fileType: string;
  maxSize: number; // in bytes
  allowedMimeTypes: string[];
  allowedExtensions: string[];
  requireDimensions?: {
    minWidth?: number;
    minHeight?: number;
    maxWidth?: number;
    maxHeight?: number;
    aspectRatio?: string;
  };
  requireDuration?: {
    minDuration?: number; // in seconds
    maxDuration?: number;
  };
  customValidators?: Array<(file: any) => Promise<{ valid: boolean; error?: string }>>;
}

interface FileOptimization {
  enabled: boolean;
  imageOptimization: {
    quality: number;
    format: 'webp' | 'jpeg' | 'png';
    sizes: { width: number; height: number; suffix: string }[];
  };
  videoOptimization: {
    quality: 'low' | 'medium' | 'high';
    formats: ('mp4' | 'webm')[];
    generateThumbnails: boolean;
    generatePreview: boolean;
  };
}

export class EnhancedFileManagerModel extends BaseModel<any> {
  private validationRules: Map<string, FileValidationRule> = new Map();
  private uploadSessions: Map<string, FileUploadSession> = new Map();

  constructor() {
    super('files', 'file_session');
    this.initializeValidationRules();
  }

  // Initialize file validation rules for different content types
  private initializeValidationRules(): void {
    // Course thumbnail validation
    this.validationRules.set('course_thumbnail', {
      fileType: 'thumbnail',
      maxSize: 5 * 1024 * 1024, // 5MB
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
      allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
      requireDimensions: {
        minWidth: 800,
        minHeight: 600,
        maxWidth: 2000,
        maxHeight: 1500,
        aspectRatio: '4:3'
      }
    });

    // Course video validation
    this.validationRules.set('course_video', {
      fileType: 'video',
      maxSize: 500 * 1024 * 1024, // 500MB
      allowedMimeTypes: ['video/mp4', 'video/webm', 'video/quicktime'],
      allowedExtensions: ['.mp4', '.webm', '.mov'],
      requireDuration: {
        minDuration: 30, // 30 seconds minimum
        maxDuration: 3600 // 1 hour maximum
      }
    });

    // Document validation
    this.validationRules.set('course_document', {
      fileType: 'document',
      maxSize: 50 * 1024 * 1024, // 50MB
      allowedMimeTypes: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain'
      ],
      allowedExtensions: ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.txt']
    });

    // Material validation (broader than documents)
    this.validationRules.set('course_material', {
      fileType: 'material',
      maxSize: 100 * 1024 * 1024, // 100MB
      allowedMimeTypes: [
        'application/pdf',
        'application/zip',
        'application/x-zip-compressed',
        'text/plain',
        'image/jpeg',
        'image/png',
        'audio/mpeg',
        'audio/wav'
      ],
      allowedExtensions: ['.pdf', '.zip', '.txt', '.jpg', '.jpeg', '.png', '.mp3', '.wav']
    });
  }

  // Start a new file upload session
  async startUploadSession(
    userId: string,
    entityType: 'course' | 'lesson' | 'draft',
    entityId: string,
    files: Array<{
      filename: string;
      size: number;
      type: string;
      contentType: string;
    }>
  ): Promise<{
    sessionId: string;
    validFiles: any[];
    rejectedFiles: any[];
    totalSize: number;
  }> {
    try {
      const sessionId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const validFiles = [];
      const rejectedFiles = [];
      let totalSize = 0;

      // Validate each file
      for (const file of files) {
        const validationResult = await this.validateFile(file, entityType);
        
        if (validationResult.valid) {
          validFiles.push({
            fileId: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            filename: file.filename,
            size: file.size,
            type: file.type,
            contentType: file.contentType,
            status: 'pending',
            progress: 0
          });
          totalSize += file.size;
        } else {
          rejectedFiles.push({
            filename: file.filename,
            reason: validationResult.error,
            size: file.size
          });
        }
      }

      // Create upload session
      const session: FileUploadSession = {
        sessionId,
        userId,
        entityType,
        entityId,
        totalFiles: validFiles.length,
        uploadedFiles: 0,
        failedFiles: 0,
        totalSize,
        uploadedSize: 0,
        startedAt: new Date().toISOString(),
        status: 'pending',
        files: validFiles
      };

      this.uploadSessions.set(sessionId, session);

      logger.info('Upload session started:', {
        sessionId,
        userId,
        entityType,
        entityId,
        validFiles: validFiles.length,
        rejectedFiles: rejectedFiles.length,
        totalSize
      });

      return {
        sessionId,
        validFiles,
        rejectedFiles,
        totalSize
      };
    } catch (error) {
      logger.error('Failed to start upload session:', { userId, entityType, entityId, error });
      throw error;
    }
  }

  // Upload a single file within a session
  async uploadFile(
    sessionId: string,
    fileId: string,
    fileBuffer: Buffer,
    metadata: {
      filename: string;
      mimetype: string;
      size: number;
    },
    onProgress?: (progress: number) => void
  ): Promise<{
    success: boolean;
    fileData?: FileMetadata;
    error?: string;
  }> {
    try {
      const session = this.uploadSessions.get(sessionId);
      if (!session) {
        throw new Error('Upload session not found');
      }

      const fileInfo = session.files.find(f => f.fileId === fileId);
      if (!fileInfo) {
        throw new Error('File not found in session');
      }

      // Update file status
      fileInfo.status = 'uploading';
      this.updateSessionProgress(sessionId);

      // Validate file content
      const contentValidation = await this.validateFileContent(fileBuffer, metadata);
      if (!contentValidation.valid) {
        fileInfo.status = 'failed';
        fileInfo.error = contentValidation.error;
        session.failedFiles++;
        this.updateSessionProgress(sessionId);
        
        return {
          success: false,
          error: contentValidation.error
        };
      }

      // Process and optimize file
      fileInfo.status = 'processing';
      const processedFile = await this.processFile(fileBuffer, metadata, session.entityType);

      // Save file using the existing file model
      const fileData = await fileModel.create({
        type: 'file',
        id: fileId,
        filename: metadata.filename,
        originalName: metadata.filename,
        mimetype: metadata.mimetype,
        size: metadata.size,
        path: processedFile.path,
        url: processedFile.url,
        fileType: this.determineFileType(metadata.mimetype),
        entityType: session.entityType,
        entityId: session.entityId,
        uploadedBy: session.userId,
        uploadedAt: new Date().toISOString(),
        checksum: processedFile.checksum,
        metadata: processedFile.metadata || {},
        isActive: true,
        tags: []
      });

      // Update session progress
      fileInfo.status = 'completed';
      fileInfo.uploadedAt = new Date().toISOString();
      session.uploadedFiles++;
      session.uploadedSize += metadata.size;
      
      this.updateSessionProgress(sessionId);

      logger.info('File uploaded successfully:', {
        sessionId,
        fileId,
        filename: metadata.filename,
        size: metadata.size
      });

      return {
        success: true,
        fileData
      };
    } catch (error) {
      // Update file status on error
      const session = this.uploadSessions.get(sessionId);
      if (session) {
        const fileInfo = session.files.find(f => f.fileId === fileId);
        if (fileInfo) {
          fileInfo.status = 'failed';
          fileInfo.error = error instanceof Error ? error.message : 'Upload failed';
          session.failedFiles++;
          this.updateSessionProgress(sessionId);
        }
      }

      logger.error('File upload failed:', { sessionId, fileId, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      };
    }
  }

  // Get upload session status
  async getUploadSessionStatus(sessionId: string): Promise<FileUploadSession | null> {
    return this.uploadSessions.get(sessionId) || null;
  }

  // Batch upload multiple files
  async batchUploadFiles(
    userId: string,
    entityType: 'course' | 'lesson' | 'draft',
    entityId: string,
    files: Array<{
      filename: string;
      buffer: Buffer;
      mimetype: string;
      size: number;
    }>,
    onProgress?: (sessionProgress: {
      sessionId: string;
      totalFiles: number;
      completedFiles: number;
      failedFiles: number;
      overallProgress: number;
    }) => void
  ): Promise<{
    sessionId: string;
    results: Array<{
      filename: string;
      success: boolean;
      fileData?: FileMetadata;
      error?: string;
    }>;
  }> {
    try {
      // Start upload session
      const sessionResult = await this.startUploadSession(
        userId,
        entityType,
        entityId,
        files.map(f => ({
          filename: f.filename,
          size: f.size,
          type: this.determineFileType(f.mimetype),
          contentType: f.mimetype
        }))
      );

      const results = [];

      // Upload files concurrently (max 3 at a time)
      const concurrencyLimit = 3;
      const semaphore = new Array(concurrencyLimit).fill(null);
      
      for (let i = 0; i < sessionResult.validFiles.length; i += concurrencyLimit) {
        const batch = sessionResult.validFiles.slice(i, i + concurrencyLimit);
        
        const batchPromises = batch.map(async (validFile, batchIndex) => {
          const originalFile = files.find(f => f.filename === validFile.filename);
          if (!originalFile) {
            return {
              filename: validFile.filename,
              success: false,
              error: 'Original file not found'
            };
          }

          const uploadResult = await this.uploadFile(
            sessionResult.sessionId,
            validFile.fileId,
            originalFile.buffer,
            {
              filename: originalFile.filename,
              mimetype: originalFile.mimetype,
              size: originalFile.size
            }
          );

          return {
            filename: originalFile.filename,
            success: uploadResult.success,
            fileData: uploadResult.fileData,
            error: uploadResult.error
          };
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        // Update progress
        if (onProgress) {
          const session = this.uploadSessions.get(sessionResult.sessionId);
          if (session) {
            onProgress({
              sessionId: sessionResult.sessionId,
              totalFiles: session.totalFiles,
              completedFiles: session.uploadedFiles,
              failedFiles: session.failedFiles,
              overallProgress: Math.round((session.uploadedFiles / session.totalFiles) * 100)
            });
          }
        }
      }

      // Mark session as completed
      const session = this.uploadSessions.get(sessionResult.sessionId);
      if (session) {
        session.status = session.failedFiles > 0 ? 'completed' : 'completed';
        session.completedAt = new Date().toISOString();
      }

      logger.info('Batch upload completed:', {
        sessionId: sessionResult.sessionId,
        totalFiles: results.length,
        successfulFiles: results.filter(r => r.success).length,
        failedFiles: results.filter(r => !r.success).length
      });

      return {
        sessionId: sessionResult.sessionId,
        results
      };
    } catch (error) {
      logger.error('Batch upload failed:', { userId, entityType, entityId, error });
      throw error;
    }
  }

  // Optimize files for web delivery
  async optimizeFile(
    fileId: string,
    optimization: FileOptimization
  ): Promise<{
    original: FileMetadata;
    optimized: FileMetadata[];
  }> {
    try {
      const originalFile = await fileModel.findById(fileId);
      if (!originalFile) {
        throw new Error('File not found');
      }

      const optimizedFiles = [];

      if (originalFile.mimetype.startsWith('image/') && optimization.imageOptimization) {
        // Image optimization would go here
        // This is a placeholder for actual image processing
        optimizedFiles.push({
          ...originalFile,
          id: `${fileId}_optimized`,
          filename: `optimized_${originalFile.filename}`,
          metadata: {
            ...originalFile.metadata,
            isOptimized: true,
            originalFileId: fileId
          }
        });
      }

      if (originalFile.mimetype.startsWith('video/') && optimization.videoOptimization) {
        // Video optimization would go here
        // This is a placeholder for actual video processing
        optimizedFiles.push({
          ...originalFile,
          id: `${fileId}_optimized`,
          filename: `optimized_${originalFile.filename}`,
          metadata: {
            ...originalFile.metadata,
            isOptimized: true,
            originalFileId: fileId
          }
        });
      }

      return {
        original: originalFile,
        optimized: optimizedFiles
      };
    } catch (error) {
      logger.error('File optimization failed:', { fileId, error });
      throw error;
    }
  }

  // Clean up orphaned files
  async cleanupOrphanedFiles(): Promise<{
    deletedFiles: number;
    freedSpace: number;
  }> {
    try {
      // Find files not linked to any entity
      const allFiles = await fileModel.getAll();
      const orphanedFiles = allFiles.filter(file => 
        !file.entityId || file.entityId === 'pending'
      );

      let deletedFiles = 0;
      let freedSpace = 0;

      for (const file of orphanedFiles) {
        // Check if file is older than 24 hours
        const fileAge = Date.now() - new Date(file.uploadedAt).getTime();
        const oneDayInMs = 24 * 60 * 60 * 1000;

        if (fileAge > oneDayInMs) {
          try {
            await fileModel.delete(file._id!);
            deletedFiles++;
            freedSpace += file.size;
          } catch (error) {
            logger.warn('Failed to delete orphaned file:', { fileId: file._id, error });
          }
        }
      }

      logger.info('Orphaned files cleanup completed:', {
        deletedFiles,
        freedSpace,
        freedSpaceMB: Math.round(freedSpace / 1024 / 1024)
      });

      return { deletedFiles, freedSpace };
    } catch (error) {
      logger.error('Failed to cleanup orphaned files:', error);
      throw error;
    }
  }

  // Private helper methods
  private async validateFile(
    file: { filename: string; size: number; type: string; contentType: string },
    entityType: string
  ): Promise<{ valid: boolean; error?: string }> {
    const ruleKey = `${entityType}_${file.type}`;
    const rule = this.validationRules.get(ruleKey);

    if (!rule) {
      return { valid: false, error: `No validation rules found for ${ruleKey}` };
    }

    // Check file size
    if (file.size > rule.maxSize) {
      return {
        valid: false,
        error: `File size (${Math.round(file.size / 1024 / 1024)}MB) exceeds maximum allowed size (${Math.round(rule.maxSize / 1024 / 1024)}MB)`
      };
    }

    // Check MIME type
    if (!rule.allowedMimeTypes.includes(file.contentType)) {
      return {
        valid: false,
        error: `File type '${file.contentType}' is not allowed. Allowed types: ${rule.allowedMimeTypes.join(', ')}`
      };
    }

    // Check file extension
    const extension = path.extname(file.filename).toLowerCase();
    if (!rule.allowedExtensions.includes(extension)) {
      return {
        valid: false,
        error: `File extension '${extension}' is not allowed. Allowed extensions: ${rule.allowedExtensions.join(', ')}`
      };
    }

    return { valid: true };
  }

  private async validateFileContent(
    buffer: Buffer,
    metadata: { filename: string; mimetype: string; size: number }
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      // Basic file header validation
      const fileSignature = buffer.slice(0, 16).toString('hex');
      
      // Check for common file format signatures
      const signatures = {
        'image/jpeg': ['ffd8ff'],
        'image/png': ['89504e47'],
        'image/webp': ['52494646'],
        'video/mp4': ['00000018667479', '00000020667479'],
        'application/pdf': ['255044462d']
      };

      const expectedSignatures = signatures[metadata.mimetype as keyof typeof signatures];
      if (expectedSignatures) {
        const isValid = expectedSignatures.some(sig => fileSignature.startsWith(sig));
        if (!isValid) {
          return {
            valid: false,
            error: 'File content does not match declared file type'
          };
        }
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: 'Failed to validate file content'
      };
    }
  }

  private async processFile(
    buffer: Buffer,
    metadata: { filename: string; mimetype: string; size: number },
    entityType: string
  ): Promise<{
    path: string;
    url: string;
    checksum: string;
    metadata?: any;
  }> {
    try {
      // Generate checksum
      const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
      
      // Determine file path
      const timestamp = Date.now();
      const safeFilename = metadata.filename.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = path.join('uploads', entityType, timestamp.toString(), safeFilename);
      
      // Ensure directory exists
      const dirPath = path.dirname(filePath);
      await fs.mkdir(dirPath, { recursive: true });
      
      // Save file
      await fs.writeFile(filePath, buffer);
      
      // Generate URL (this would be your actual file serving URL)
      const url = `/api/v1/files/${path.basename(filePath)}`;

      // Extract metadata based on file type
      const extractedMetadata: any = {
        checksum,
        uploadTimestamp: timestamp
      };

      if (metadata.mimetype.startsWith('image/')) {
        // Add image metadata extraction here
        extractedMetadata.type = 'image';
      } else if (metadata.mimetype.startsWith('video/')) {
        // Add video metadata extraction here
        extractedMetadata.type = 'video';
      }

      return {
        path: filePath,
        url,
        checksum,
        metadata: extractedMetadata
      };
    } catch (error) {
      logger.error('File processing failed:', { filename: metadata.filename, error });
      throw error;
    }
  }

  private determineFileType(mimetype: string): 'thumbnail' | 'video' | 'document' | 'image' | 'material' {
    if (mimetype.startsWith('image/')) {
      return 'thumbnail'; // or 'image' depending on context
    } else if (mimetype.startsWith('video/')) {
      return 'video';
    } else if (mimetype === 'application/pdf' || mimetype.includes('document') || mimetype.includes('presentation')) {
      return 'document';
    } else {
      return 'material';
    }
  }

  private updateSessionProgress(sessionId: string): void {
    const session = this.uploadSessions.get(sessionId);
    if (!session) return;

    const completedFiles = session.files.filter(f => f.status === 'completed').length;
    const failedFiles = session.files.filter(f => f.status === 'failed').length;
    
    if (completedFiles + failedFiles === session.totalFiles) {
      session.status = failedFiles > 0 ? 'completed' : 'completed';
      session.completedAt = new Date().toISOString();
    } else if (completedFiles > 0 || failedFiles > 0) {
      session.status = 'in_progress';
    }
  }
}

export const enhancedFileManagerModel = new EnhancedFileManagerModel(); 