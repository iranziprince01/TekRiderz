import { BaseModel } from './BaseModel';
import { FileMetadata } from '../types';
import { logger } from '../utils/logger';
import { databases } from '../config/database';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

export class FileModel extends BaseModel<FileMetadata> {
  constructor() {
    super('files', 'file');
  }

  /**
   * Create a new file record
   */
  async createFile(fileData: Omit<FileMetadata, '_id' | '_rev' | 'type' | 'createdAt' | 'updatedAt'>): Promise<FileMetadata> {
    try {
      const file: Omit<FileMetadata, '_id' | '_rev'> = {
        ...fileData,
        type: 'file',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isActive: true
      };

      const result = await this.db.insert(file);
      
      return {
        ...file,
        _id: result.id,
        _rev: result.rev
      } as FileMetadata;
    } catch (error) {
      logger.error('Failed to create file record:', error);
      throw new Error('Failed to create file record');
    }
  }

  /**
   * Get file by filename
   */
  async getByFilename(filename: string): Promise<FileMetadata | null> {
    try {
      const result = await this.db.find({
        selector: {
          type: 'file',
          filename,
          isActive: true
        },
        limit: 1
      });

      return result.docs.length > 0 ? result.docs[0] as FileMetadata : null;
    } catch (error) {
      logger.error('Failed to get file by filename:', error);
      return null;
    }
  }

  /**
   * Get files by entity
   */
  async getByEntity(entityType: string, entityId: string): Promise<FileMetadata[]> {
    try {
      const result = await this.db.find({
        selector: {
          type: 'file',
          entityType,
          entityId,
          isActive: true
        }
        // Remove sort to avoid index requirement for now
        // sort: [{ uploadedAt: 'desc' }]
      });

      // Sort in memory for now
      const files = result.docs as FileMetadata[];
      return files.sort((a, b) => {
        const dateA = new Date(a.uploadedAt || a.createdAt);
        const dateB = new Date(b.uploadedAt || b.createdAt);
        return dateB.getTime() - dateA.getTime();
      });
    } catch (error) {
      logger.error('Failed to get files by entity:', error);
      return [];
    }
  }

  /**
   * Get files by file type
   */
  async getByFileType(fileType: 'thumbnail' | 'video' | 'document' | 'image'): Promise<FileMetadata[]> {
    try {
      const result = await this.db.find({
        selector: {
          type: 'file',
          fileType: fileType,
          isActive: true
        }
        // Remove sort to avoid index requirement for now
        // sort: [{ uploadedAt: 'desc' }]
      });

      // Sort in memory for now
      const files = result.docs as FileMetadata[];
      return files.sort((a, b) => {
        const dateA = new Date(a.uploadedAt || a.createdAt);
        const dateB = new Date(b.uploadedAt || b.createdAt);
        return dateB.getTime() - dateA.getTime();
      });
    } catch (error) {
      logger.error('Failed to get files by type:', error);
      return [];
    }
  }

  /**
   * Update file metadata
   */
  async updateFile(id: string, updates: Partial<FileMetadata>): Promise<FileMetadata> {
    try {
      const existingFile = await this.findById(id);
      if (!existingFile) {
        throw new Error('File not found');
      }

      const updatedFile = {
        ...existingFile,
        ...updates,
        updatedAt: new Date().toISOString()
      };

      const result = await this.db.insert(updatedFile);
      
      return {
        ...updatedFile,
        _rev: result.rev
      };
    } catch (error) {
      logger.error('Failed to update file:', error);
      throw new Error('Failed to update file');
    }
  }

  /**
   * Soft delete file (mark as inactive)
   */
  async deleteFile(id: string): Promise<boolean> {
    try {
      const file = await this.findById(id);
      if (!file) {
        return false;
      }

      await this.updateFile(id, { isActive: false });
      return true;
    } catch (error) {
      logger.error('Failed to delete file:', error);
      return false;
    }
  }

  /**
   * Hard delete file (remove from database and filesystem)
   */
  async hardDeleteFile(id: string): Promise<boolean> {
    try {
      const file = await this.findById(id);
      if (!file) {
        return false;
      }

      // Delete physical file
      try {
        await fs.unlink(file.path);
      } catch (fsError) {
        logger.warn('Failed to delete physical file:', fsError);
        // Continue with database deletion even if file doesn't exist
      }

      // Delete from database
      if (file._id && file._rev) {
        await this.db.destroy(file._id, file._rev);
      }
      return true;
    } catch (error) {
      logger.error('Failed to hard delete file:', error);
      return false;
    }
  }

  /**
   * Generate file checksum
   */
  async generateChecksum(filePath: string): Promise<string> {
    try {
      const fileBuffer = await fs.readFile(filePath);
      return crypto.createHash('md5').update(fileBuffer).digest('hex');
    } catch (error) {
      logger.error('Failed to generate checksum:', error);
      throw new Error('Failed to generate file checksum');
    }
  }

  /**
   * Verify file integrity
   */
  async verifyFileIntegrity(file: FileMetadata): Promise<boolean> {
    try {
      if (!file.checksum) {
        return true; // No checksum to verify
      }

      const currentChecksum = await this.generateChecksum(file.path);
      return currentChecksum === file.checksum;
    } catch (error) {
      logger.error('Failed to verify file integrity:', error);
      return false;
    }
  }

  /**
   * Clean up orphaned files (files not referenced by any entity)
   */
  async cleanupOrphanedFiles(): Promise<number> {
    try {
      const allFiles = await this.db.find({
        selector: {
          type: 'file',
          isActive: true
        }
      });

      let cleanedCount = 0;

      for (const file of allFiles.docs as FileMetadata[]) {
        // Check if the entity still exists
        const entityDb = databases[file.entityType + 's' as keyof typeof databases];
        if (entityDb) {
          try {
            await entityDb.get(file.entityId);
          } catch (error: any) {
            if (error.statusCode === 404) {
              // Entity doesn't exist, mark file as inactive
              if (file._id) {
                await this.deleteFile(file._id);
                cleanedCount++;
              }
            }
          }
        }
      }

      logger.info(`Cleaned up ${cleanedCount} orphaned files`);
      return cleanedCount;
    } catch (error) {
      logger.error('Failed to cleanup orphaned files:', error);
      return 0;
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    byType: Record<string, { count: number; size: number }>;
    byEntity: Record<string, { count: number; size: number }>;
  }> {
    try {
      const result = await this.db.find({
        selector: {
          type: 'file',
          isActive: true
        }
      });

      const files = result.docs as FileMetadata[];
      const totalFiles = files.length;
      const totalSize = files.reduce((sum, file) => sum + file.size, 0);

      const byType: Record<string, { count: number; size: number }> = {};
      const byEntity: Record<string, { count: number; size: number }> = {};

      files.forEach(file => {
        // By file type
        const fileType = file.fileType || 'unknown';
        if (!byType[fileType]) {
          byType[fileType] = { count: 0, size: 0 };
        }
        byType[fileType].count++;
        byType[fileType].size += file.size;

        // By entity type
        if (!byEntity[file.entityType]) {
          byEntity[file.entityType] = { count: 0, size: 0 };
        }
        const entityStats = byEntity[file.entityType];
        if (entityStats) {
          entityStats.count++;
          entityStats.size += file.size;
        }
      });

      return {
        totalFiles,
        totalSize,
        byType,
        byEntity
      };
    } catch (error) {
      logger.error('Failed to get storage stats:', error);
      throw new Error('Failed to get storage statistics');
    }
  }

  /**
   * Search files with filters
   */
  async searchFiles(options: {
    searchTerm?: string;
    entityType?: string;
    fileType?: 'thumbnail' | 'video' | 'document' | 'image';
    limit?: number;
  } = {}): Promise<FileMetadata[]> {
    try {
      const selector: any = {
        type: 'file',
        isActive: true
      };

      if (options.entityType) {
        selector.entityType = options.entityType;
      }

      if (options.fileType) {
        selector.fileType = options.fileType;
      }

      // For CouchDB, we'll use a simple find and then filter by filename/originalName
      // Note: For production, consider using CouchDB full-text search or Lucene
      const result = await this.db.find({
        selector,
        limit: options.limit || 50
      });

      let files = result.docs as FileMetadata[];

      // Apply text search filter if provided
      if (options.searchTerm) {
        const searchLower = options.searchTerm.toLowerCase();
        files = files.filter(file => 
          file.filename.toLowerCase().includes(searchLower) ||
          file.originalName.toLowerCase().includes(searchLower)
        );
      }

      return files;
    } catch (error) {
      logger.error('Failed to search files:', error);
      return [];
    }
  }
}

export const fileModel = new FileModel(); 