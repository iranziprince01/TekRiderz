import { BaseModel } from './BaseModel';
import { OTP } from '../types';
import { logger } from '../utils/logger';
import { databases } from '../config/database';

export class OTPModel extends BaseModel<OTP> {
  private maxRetries = 3;
  private retryDelay = 1000; // 1 second

  constructor() {
    super('otp', 'otp'); // Use dedicated OTP database
  }

  // Retry wrapper for database operations
  private async withRetry<T>(operation: () => Promise<T>, operationName: string): Promise<T> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        logger.warn(`Database operation failed (attempt ${attempt}/${this.maxRetries})`, {
          operation: operationName,
          attempt,
          error: (error as Error)?.message
        });
        
        if (attempt < this.maxRetries) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
        }
      }
    }
    
    throw lastError;
  }

  // Check database health before operations
  private async checkDatabaseHealth(): Promise<boolean> {
    try {
      await databases.otp.info();
      return true;
    } catch (error) {
      logger.error('OTP database health check failed', error);
      return false;
    }
  }

  // Find OTP by email using direct query with retry logic
  async findByEmail(email: string): Promise<OTP[]> {
    if (!(await this.checkDatabaseHealth())) {
      logger.error('Database unhealthy, aborting OTP search', { email });
      return [];
    }

    return this.withRetry(async () => {
      try {
        // Use direct database query instead of views
        const selector = {
          type: 'otp',
          email: email
        };

        const result = await databases.otp.find({
          selector,
          sort: [{ createdAt: 'desc' }],
          limit: 10
        });

        return result.docs as OTP[];
      } catch (error) {
        logger.error('Failed to find OTPs by email', { email, error });
        // Fallback to direct document retrieval
        try {
          const allDocs = await databases.otp.list({
            include_docs: true,
            startkey: 'otp_',
            endkey: 'otp_\ufff0'
          });

          const otps = allDocs.rows
            .map((row: any) => row.doc)
            .filter((doc: any) => doc && doc.type === 'otp' && doc.email === email) as OTP[];

          return otps.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        } catch (fallbackError) {
          logger.error('Fallback OTP search also failed', { email, fallbackError });
          return [];
        }
      }
    }, `findByEmail:${email}`);
  }

  // Create new OTP with proper document structure and retry logic
  async create(data: Omit<OTP, '_id' | '_rev' | 'createdAt' | 'updatedAt'>): Promise<OTP> {
    if (!(await this.checkDatabaseHealth())) {
      throw new Error('Database is unhealthy, cannot create OTP');
    }

    return this.withRetry(async () => {
      try {
        const now = new Date().toISOString();
        const otpData = {
          ...data,
          _id: data.id, // Use the generated ID as document ID
          type: 'otp' as const,
          attempts: 0,
          verified: false,
          createdAt: now,
          updatedAt: now,
        };

        logger.info('Creating OTP document', { 
          id: otpData._id, 
          email: otpData.email, 
          purpose: otpData.purpose,
          expiresAt: otpData.expiresAt 
        });

        const result = await databases.otp.insert(otpData);
        
        const createdOTP = {
          ...otpData,
          _rev: result.rev,
        };

        logger.info('OTP document created successfully', { 
          id: createdOTP._id, 
          rev: createdOTP._rev 
        });

        return createdOTP;
      } catch (error) {
        logger.error('Failed to create OTP:', { data, error });
        throw error;
      }
    }, `createOTP:${data.email}`);
  }

  // Find OTP by email and purpose with robust search and retry logic
  async findByEmailAndPurpose(email: string, purpose: string): Promise<OTP | null> {
    if (!(await this.checkDatabaseHealth())) {
      logger.error('Database unhealthy, aborting OTP search', { email, purpose });
      return null;
    }

    return this.withRetry(async () => {
      try {
        logger.info('Searching for OTP', { email, purpose });

        // First try with direct query
        try {
          const selector = {
            type: 'otp',
            email: email,
            purpose: purpose,
            verified: false
          };

          const result = await databases.otp.find({
            selector,
            sort: [{ createdAt: 'desc' }],
            limit: 1
          });

          if (result.docs && result.docs.length > 0) {
            const otp = result.docs[0] as OTP;
            logger.info('Found OTP via direct query', { otpId: otp._id, email, purpose });
            
            // Check if not expired
            if (new Date(otp.expiresAt) > new Date()) {
              return otp;
            } else {
              logger.info('OTP found but expired', { otpId: otp._id, expiresAt: otp.expiresAt });
            }
          }
        } catch (queryError) {
          logger.warn('Direct query failed, trying fallback', { queryError });
        }

        // Fallback: Get all OTPs for this email
        const allOTPs = await this.findByEmail(email);
        logger.info('Found OTPs via fallback', { count: allOTPs.length, email });

        // Find the most recent valid OTP for this purpose
        const validOTP = allOTPs
          .filter(otp => {
            const isCorrectPurpose = otp.purpose === purpose;
            const isNotVerified = !otp.verified;
            const isNotExpired = new Date(otp.expiresAt) > new Date();
            
            logger.debug('Filtering OTP', {
              otpId: otp._id,
              purpose: otp.purpose,
              verified: otp.verified,
              expiresAt: otp.expiresAt,
              isCorrectPurpose,
              isNotVerified,
              isNotExpired
            });

            return isCorrectPurpose && isNotVerified && isNotExpired;
          })
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

        if (validOTP) {
          logger.info('Found valid OTP', { otpId: validOTP._id, email, purpose });
        } else {
          logger.warn('No valid OTP found', { email, purpose, totalOTPs: allOTPs.length });
        }

        return validOTP || null;
      } catch (error) {
        logger.error('Failed to find OTP by email and purpose', { email, purpose, error });
        return null;
      }
    }, `findByEmailAndPurpose:${email}:${purpose}`);
  }

  // Verify OTP by ID and code with detailed logging and retry logic
  async verifyOTP(otpId: string, code: string): Promise<{ success: boolean; message: string }> {
    if (!(await this.checkDatabaseHealth())) {
      logger.error('Database unhealthy, aborting OTP verification', { otpId });
      return { success: false, message: 'Service temporarily unavailable' };
    }

    return this.withRetry(async () => {
      try {
        logger.info('Verifying OTP', { otpId, codeLength: code?.length });

        const otp = await this.findById(otpId);
        
        if (!otp) {
          logger.warn('OTP not found during verification', { otpId });
          return { success: false, message: 'OTP not found' };
        }

        logger.info('OTP found for verification', { 
          otpId: otp._id,
          email: otp.email,
          purpose: otp.purpose,
          verified: otp.verified,
          attempts: otp.attempts,
          expiresAt: otp.expiresAt,
          storedCode: otp.code,
          providedCode: code
        });

        if (otp.verified) {
          logger.warn('OTP already verified', { otpId });
          return { success: false, message: 'OTP already used' };
        }

        if (new Date(otp.expiresAt) < new Date()) {
          logger.warn('OTP expired', { otpId, expiresAt: otp.expiresAt, now: new Date().toISOString() });
          return { success: false, message: 'OTP has expired' };
        }

        if (otp.attempts >= 3) {
          logger.warn('Too many OTP attempts', { otpId, attempts: otp.attempts });
          return { success: false, message: 'Too many attempts' };
        }

        if (otp.code !== code) {
          logger.warn('Invalid OTP code', { 
            otpId, 
            expectedCode: otp.code, 
            providedCode: code,
            match: otp.code === code
          });
          
          // Increment attempts with retry
          try {
            await this.withRetry(async () => {
              await this.update(otpId, {
                attempts: otp.attempts + 1,
                updatedAt: new Date().toISOString()
              } as Partial<OTP>);
            }, `incrementAttempts:${otpId}`);
          } catch (updateError) {
            logger.error('Failed to increment OTP attempts', { otpId, updateError });
          }
          
          return { success: false, message: 'Invalid OTP code' };
        }

        // Mark as verified with retry
        await this.withRetry(async () => {
          await this.update(otpId, {
            verified: true,
            verifiedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          } as Partial<OTP>);
        }, `markVerified:${otpId}`);

        logger.info('OTP verified successfully', { otpId, email: otp.email });
        return { success: true, message: 'OTP verified successfully' };
      } catch (error) {
        logger.error('Failed to verify OTP', { otpId, error });
        return { success: false, message: 'Verification failed' };
      }
    }, `verifyOTP:${otpId}`);
  }

  // Invalidate all OTPs for email and purpose
  async invalidateOTPs(email: string, purpose: string): Promise<void> {
    try {
      const otps = await this.findByEmail(email);
      
      const otpsToInvalidate = otps.filter(otp => 
        otp.purpose === purpose && !otp.verified
      );

      let invalidatedCount = 0;
      for (const otp of otpsToInvalidate) {
        try {
          await this.update(otp._id!, {
            verified: true,
            verifiedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          } as Partial<OTP>);
          invalidatedCount++;
        } catch (error) {
          logger.warn('Failed to invalidate OTP', { otpId: otp._id, error });
        }
      }

      logger.info(`Invalidated ${invalidatedCount} OTPs for ${email}:${purpose}`);
    } catch (error) {
      logger.error('Failed to invalidate OTPs', { email, purpose, error });
      throw error;
    }
  }

  // Get recent OTPs for rate limiting
  async getRecentOTPs(email: string, hours: number = 1): Promise<OTP[]> {
    try {
      const otps = await this.findByEmail(email);
      const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
      
      return otps.filter(otp => 
        new Date(otp.createdAt) > cutoffTime
      );
    } catch (error) {
      logger.error('Failed to get recent OTPs', { email, hours, error });
      return [];
    }
  }

  // Enhanced find by ID with logging
  async findById(id: string): Promise<OTP | null> {
    try {
      logger.debug('Looking up OTP by ID', { id });
      
      const doc = await databases.otp.get(id) as any;
      
      if (doc && doc.type === 'otp') {
        logger.debug('OTP found by ID', { id, email: doc.email, purpose: doc.purpose });
        return doc as OTP;
      }
      
      logger.debug('Document found but not an OTP', { id, type: doc?.type });
      return null;
    } catch (error: any) {
      if (error?.statusCode === 404) {
        logger.debug('OTP not found by ID', { id });
        return null;
      }
      logger.error('Error finding OTP by ID', { id, error });
      throw error;
    }
  }

  // Clean up expired OTPs
  async cleanupExpired(): Promise<number> {
    try {
      const selector = {
        type: 'otp',
        expiresAt: { $lt: new Date().toISOString() }
      };

      const result = await databases.otp.find({
        selector,
        limit: 100
      });

      let deletedCount = 0;
      for (const otp of result.docs) {
        try {
          await this.delete(otp._id!);
          deletedCount++;
        } catch (error) {
          logger.warn('Failed to delete expired OTP', { otpId: otp._id, error });
        }
      }

      if (deletedCount > 0) {
        logger.info(`Cleaned up ${deletedCount} expired OTPs`);
      }
      
      return deletedCount;
    } catch (error) {
      logger.error('Failed to cleanup expired OTPs', error);
      return 0;
    }
  }
}

export const otpModel = new OTPModel();
export default otpModel; 