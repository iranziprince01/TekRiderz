import { fileModel } from '../models/File';
import { FileMetadata } from '../types';
import { logger } from '../utils/logger';
import { config } from '../config/config';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';

export interface FileServiceOptions {
  entityType: 'course' | 'user' | 'lesson';
  entityId: string;
  uploadedBy: string;
}

export interface FileUploadResult {
  file: FileMetadata;
  url: string;
}

export class FileService {
  private baseUploadPath: string;

  constructor() {
    this.baseUploadPath = path.join(__dirname, '../../uploads');
    this.ensureUploadDirectories();
  }

  /**
   * Ensure upload directories exist
   */
  private async ensureUploadDirectories(): Promise<void> {
    const directories = [
      'courses/thumbnails',
      'courses/videos',
      'courses/materials',  // Additional materials for courses
      'users/avatars',
      'users/documents',    // User-specific documents
      'lessons/materials',
      'lessons/documents',
      'lessons/videos',     // Lesson-specific videos
      'documents',
      'images',
      'temp',              // Temporary upload directory
      'archive'            // Archive old files
    ];

    for (const dir of directories) {
      const fullPath = path.join(this.baseUploadPath, dir);
      try {
        await fs.mkdir(fullPath, { recursive: true });
      } catch (error) {
        logger.error(`Failed to create directory ${fullPath}:`, error);
      }
    }
  }

  /**
   * Handle file upload and store metadata in CouchDB
   */
  async handleFileUpload(
    file: Express.Multer.File,
    fileType: 'thumbnail' | 'video' | 'document' | 'image' | 'material',
    options: FileServiceOptions
  ): Promise<FileUploadResult> {
    try {
      // Generate checksum for file integrity
      const checksum = await this.generateChecksum(file.path);

      // Get file URL
      const url = this.getFileUrl(file.filename, fileType, options.entityType);

      // Process image if it's a thumbnail or image
      let processedMetadata = {};
      if (fileType === 'thumbnail' || fileType === 'image') {
        processedMetadata = await this.processImage(file.path);
      } else if (fileType === 'video') {
        processedMetadata = await this.getVideoMetadata(file.path);
      } else if (fileType === 'document' || fileType === 'material') {
        processedMetadata = await this.getDocumentMetadata(file.path, file.mimetype);
      }

      // Create file record in CouchDB
      const fileRecord = await fileModel.createFile({
        filename: file.filename,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        path: file.path,
        url,
        fileType: fileType,
        entityType: options.entityType,
        entityId: options.entityId,
        uploadedBy: options.uploadedBy,
        uploadedAt: new Date().toISOString(),
        checksum,
        metadata: processedMetadata,
        isActive: true
      });

      logger.info('File uploaded and stored successfully', {
        fileId: fileRecord._id,
        filename: file.filename,
        type: fileType,
        entityType: options.entityType,
        entityId: options.entityId
      });

      return {
        file: fileRecord,
        url
      };
    } catch (error) {
      logger.error('Failed to handle file upload:', error);
      
      // Clean up uploaded file if database operation failed
      try {
        await fs.unlink(file.path);
      } catch (cleanupError) {
        logger.warn('Failed to cleanup uploaded file:', cleanupError);
      }
      
      throw new Error('Failed to process file upload');
    }
  }

  /**
   * Get file URL
   */
  getFileUrl(filename: string, fileType: 'thumbnail' | 'video' | 'document' | 'image' | 'material', entityType?: string): string {
    const baseUrl = config.server.baseUrl;
    let subPath = '';

    switch (fileType) {
      case 'thumbnail':
        subPath = 'courses/thumbnails';
        break;
      case 'video':
        // Support videos in different contexts
        if (entityType === 'lesson') {
          subPath = 'lessons/videos';
        } else {
          subPath = 'courses/videos';
        }
        break;
      case 'image':
        subPath = 'users/avatars';
        break;
      case 'document':
        // Support documents in different contexts
        if (entityType === 'user') {
          subPath = 'users/documents';
        } else if (entityType === 'lesson') {
          subPath = 'lessons/documents';
        } else {
          subPath = 'documents';
        }
        break;
      case 'material':
        // Support materials in different contexts
        if (entityType === 'course') {
          subPath = 'courses/materials';
        } else {
          subPath = 'lessons/materials';
        }
        break;
    }

    return `${baseUrl}/uploads/${subPath}/${filename}`;
  }

  /**
   * Get file by ID
   */
  async getFile(fileId: string): Promise<FileMetadata | null> {
    try {
      return await fileModel.findById(fileId);
    } catch (error) {
      logger.error('Failed to get file:', error);
      return null;
    }
  }

  /**
   * Get files by entity
   */
  async getFilesByEntity(entityType: string, entityId: string): Promise<FileMetadata[]> {
    try {
      return await fileModel.getByEntity(entityType, entityId);
    } catch (error) {
      logger.error('Failed to get files by entity:', error);
      return [];
    }
  }

  /**
   * Update file metadata
   */
  async updateFile(fileId: string, updates: Partial<FileMetadata>): Promise<FileMetadata | null> {
    try {
      return await fileModel.updateFile(fileId, updates);
    } catch (error) {
      logger.error('Failed to update file:', error);
      return null;
    }
  }

  /**
   * Delete file
   */
  async deleteFile(fileId: string): Promise<boolean> {
    try {
      const file = await fileModel.findById(fileId);
      if (!file) {
        return false;
      }

      // Delete physical file
      try {
        await fs.unlink(file.path);
      } catch (error) {
        logger.warn('Failed to delete physical file:', error);
      }

      // Delete database record
      await fileModel.deleteFile(fileId);

      logger.info('File deleted successfully', { fileId, filename: file.filename });
      return true;
    } catch (error) {
      logger.error('Failed to delete file:', error);
      return false;
    }
  }

  /**
   * Generate file checksum
   */
  private async generateChecksum(filePath: string): Promise<string> {
    try {
      const fileBuffer = await fs.readFile(filePath);
      return crypto.createHash('sha256').update(fileBuffer).digest('hex');
    } catch (error) {
      logger.error('Failed to generate checksum:', error);
      return '';
    }
  }

  /**
   * Process image (resize, optimize)
   */
  private async processImage(imagePath: string): Promise<{ width: number; height: number }> {
    try {
      const image = sharp(imagePath);
      const metadata = await image.metadata();
      
      // Create optimized version for different file types
      if (metadata.width && metadata.width > 1920) {
        // For large images, create an optimized version
        const optimizedPath = imagePath.replace(/(\.[^.]+)$/, '_optimized$1');
        
        await image
          .resize(1920, null, { withoutEnlargement: true })
          .jpeg({ quality: 85, progressive: true })
          .toFile(optimizedPath);
        
        // Replace original with optimized version
        await fs.rename(optimizedPath, imagePath);
      } else if (metadata.format === 'png' && metadata.width && metadata.width > 800) {
        // Optimize PNG files
        const optimizedPath = imagePath.replace(/(\.[^.]+)$/, '_optimized$1');
        
        await image
          .png({ quality: 90, compressionLevel: 9 })
          .toFile(optimizedPath);
        
        // Replace original with optimized version
        await fs.rename(optimizedPath, imagePath);
      }

      // Create thumbnail for images that don't have one
      if (metadata.width && metadata.width > 400) {
        const thumbnailPath = imagePath.replace(/(\.[^.]+)$/, '_thumb$1');
        
        await image
          .resize(400, 300, { 
            fit: 'cover',
            position: 'center',
            withoutEnlargement: false
          })
          .jpeg({ quality: 80 })
          .toFile(thumbnailPath);
        
        logger.info('Thumbnail created:', { originalPath: imagePath, thumbnailPath });
      }

      return {
        width: metadata.width || 0,
        height: metadata.height || 0
      };
    } catch (error) {
      logger.error('Failed to process image:', error);
      return { width: 0, height: 0 };
    }
  }

  /**
   * Get video metadata
   */
  private async getVideoMetadata(videoPath: string): Promise<{ duration?: number; bitrate?: number }> {
    try {
      // This is a placeholder - in a real implementation, you'd use a library like ffprobe
      // For now, we'll return empty metadata
      return {};
    } catch (error) {
      logger.error('Failed to get video metadata:', error);
      return {};
    }
  }

  /**
   * Get document metadata
   */
  private async getDocumentMetadata(documentPath: string, mimetype: string): Promise<{ pages?: number; [key: string]: any }> {
    try {
      const stats = await fs.stat(documentPath);
      const metadata: any = {
        fileSize: stats.size,
        lastModified: stats.mtime.toISOString(),
        mimetype
      };

      // Add specific metadata based on file type
      if (mimetype === 'application/pdf') {
        // In a real implementation, you'd use a PDF library to get page count
        metadata.type = 'pdf';
      } else if (mimetype.includes('word') || mimetype.includes('document')) {
        metadata.type = 'document';
      } else if (mimetype.includes('presentation')) {
        metadata.type = 'presentation';
      } else if (mimetype.includes('spreadsheet')) {
        metadata.type = 'spreadsheet';
      }

      return metadata;
    } catch (error) {
      logger.error('Failed to get document metadata:', error);
      return {};
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats() {
    return await fileModel.getStorageStats();
  }

  /**
   * Clean up temporary files older than 24 hours
   */
  async cleanupTempFiles(): Promise<void> {
    try {
      const tempPath = path.join(this.baseUploadPath, 'temp');
      const files = await fs.readdir(tempPath);
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      for (const file of files) {
        const filePath = path.join(tempPath, file);
        const stats = await fs.stat(filePath);
        
        if (now - stats.mtime.getTime() > maxAge) {
          await fs.unlink(filePath);
          logger.info(`Cleaned up temp file: ${file}`);
        }
      }
    } catch (error) {
      logger.error('Failed to cleanup temp files:', error);
    }
  }

  /**
   * Get disk usage statistics for uploads directory
   */
  async getDiskUsage(): Promise<{ totalSize: number; fileCount: number }> {
    try {
      let totalSize = 0;
      let fileCount = 0;

      const calculateDirSize = async (dirPath: string): Promise<void> => {
        const items = await fs.readdir(dirPath);
        
        for (const item of items) {
          const itemPath = path.join(dirPath, item);
          const stats = await fs.stat(itemPath);
          
          if (stats.isDirectory()) {
            await calculateDirSize(itemPath);
          } else {
            totalSize += stats.size;
            fileCount++;
          }
        }
      };

      await calculateDirSize(this.baseUploadPath);
      return { totalSize, fileCount };
    } catch (error) {
      logger.error('Failed to calculate disk usage:', error);
      return { totalSize: 0, fileCount: 0 };
    }
  }
}

// Export singleton instance
export const fileService = new FileService(); 