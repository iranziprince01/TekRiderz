import { DocumentScope, MaybeDocument, DocumentBulkResponse } from 'nano';
import { BaseDocument } from '../types';
import { logger } from '../utils/logger';

export abstract class BaseModel<T extends BaseDocument & MaybeDocument> {
  protected db: DocumentScope<any>;
  protected dbName: string;
  protected docType: string;

  constructor(databaseName: string, docType: string) {
    // Import databases dynamically to avoid circular dependency
    const { databases } = require('../config/database');
    this.db = (databases as any)[databaseName];
    this.dbName = databaseName;
    this.docType = docType;
  }

  // Generate a unique ID for documents
  protected generateId(): string {
    return `${this.docType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Create a new document
  async create(data: Omit<T, '_id' | '_rev' | 'createdAt' | 'updatedAt'>): Promise<T> {
    try {
      const now = new Date().toISOString();
      const generatedId = this.generateId();
      
      console.log(`Creating ${this.docType} with generated ID:`, generatedId);
      
      const doc = {
        ...data,
        _id: generatedId,
        createdAt: now,
        updatedAt: now,
      } as T;

      const result = await this.db.insert(doc);
      
      console.log(`CouchDB result for ${this.docType}:`, {
        generatedId,
        couchDbId: result.id,
        success: result.ok
      });
      
      return {
        ...doc,
        _id: result.id || generatedId, // Use CouchDB ID if available, fallback to generated
        _rev: result.rev,
      } as T;
    } catch (error) {
      logger.error(`Failed to create ${this.docType}:`, error);
      throw error;
    }
  }

  // Find document by ID
  async findById(id: string): Promise<T | null> {
    try {
      console.log(`Looking for ${this.docType} with ID:`, id);
      const doc = await this.db.get(id);
      console.log(`Found ${this.docType}:`, {
        id: doc._id,
        type: doc.type,
        title: doc.title || 'No title'
      });
      return doc as T;
    } catch (error: any) {
      if (error.statusCode === 404) {
        console.log(`${this.docType} not found with ID:`, id);
        return null;
      }
      logger.error(`Failed to find ${this.docType} by ID:`, error);
      throw error;
    }
  }

  // Update document
  async update(id: string, data: Partial<T>): Promise<T> {
    try {
      const existingDoc = await this.findById(id);
      if (!existingDoc) {
        throw new Error(`${this.docType} not found`);
      }

      const updatedDoc = {
        ...existingDoc,
        ...data,
        updatedAt: new Date().toISOString(),
      } as T;

      const result = await this.db.insert(updatedDoc);
      
      return {
        ...updatedDoc,
        _rev: result.rev,
      } as T;
    } catch (error) {
      logger.error(`Failed to update ${this.docType}:`, error);
      throw error;
    }
  }

  // Delete document
  async delete(id: string): Promise<boolean> {
    try {
      const doc = await this.findById(id);
      if (!doc) {
        return false;
      }

      await this.db.destroy(id, (doc as any)._rev);
      return true;
    } catch (error) {
      logger.error(`Failed to delete ${this.docType}:`, error);
      throw error;
    }
  }

  // Find documents by view
  async findByView(
    designDoc: string,
    viewName: string,
    options: {
      key?: any;
      keys?: any[];
      startkey?: any;
      endkey?: any;
      limit?: number;
      skip?: number;
      descending?: boolean;
      include_docs?: boolean;
    } = {}
  ): Promise<{ docs: T[]; total: number }> {
    try {
      const viewOptions = {
        include_docs: true,
        ...options,
      };

      const result = await this.db.view(designDoc, viewName, viewOptions);
      
      const docs = result.rows.map(row => row.doc as T).filter(doc => doc !== null);
      
      return {
        docs,
        total: result.total_rows || docs.length,
      };
    } catch (error) {
      logger.error(`Failed to query ${this.docType} by view:`, error);
      throw error;
    }
  }

  // Find all documents with pagination
  async findAll(options: {
    limit?: number;
    skip?: number;
    descending?: boolean;
  } = {}): Promise<{ docs: T[]; total: number }> {
    try {
      const result = await this.db.list({
        include_docs: true,
        limit: options.limit || 50,
        skip: options.skip || 0,
        descending: options.descending || false,
      });

      const docs = result.rows
        .map(row => row.doc as T)
        .filter(doc => doc && (doc as any).type === this.docType);

      return {
        docs,
        total: result.total_rows || docs.length,
      };
    } catch (error) {
      logger.error(`Failed to find all ${this.docType}:`, error);
      throw error;
    }
  }

  // Bulk operations
  async bulkCreate(docs: Omit<T, '_id' | '_rev' | 'createdAt' | 'updatedAt'>[]): Promise<T[]> {
    try {
      const now = new Date().toISOString();
      const bulkDocs = docs.map(doc => ({
        ...doc,
        _id: this.generateId(),
        createdAt: now,
        updatedAt: now,
      })) as T[];

      const result = await this.db.bulk({ docs: bulkDocs });
      
      // Update documents with their new _rev values
      result.forEach((res: any, index) => {
        if (res.ok) {
          (bulkDocs[index] as any)._rev = res.rev;
        }
      });

      return bulkDocs;
    } catch (error) {
      logger.error(`Failed to bulk create ${this.docType}:`, error);
      throw error;
    }
  }

  // Search documents (basic text search)
  async search(searchTerm: string, options: {
    limit?: number;
    skip?: number;
  } = {}): Promise<{ docs: T[]; total: number }> {
    try {
      // This is a basic implementation - in production, you might want to use 
      // CouchDB's full-text search capabilities or external search engine
      const allDocs = await this.findAll({
        limit: options.limit || 50,
        skip: options.skip || 0,
      });

      const searchResults = allDocs.docs.filter(doc => {
        const docString = JSON.stringify(doc).toLowerCase();
        return docString.includes(searchTerm.toLowerCase());
      });

      return {
        docs: searchResults,
        total: searchResults.length,
      };
    } catch (error) {
      logger.error(`Failed to search ${this.docType}:`, error);
      throw error;
    }
  }

  // Count documents
  async count(): Promise<number> {
    try {
      const info = await this.db.info();
      return info.doc_count;
    } catch (error) {
      logger.error(`Failed to count ${this.docType}:`, error);
      throw error;
    }
  }
} 