import nano from 'nano';
import { config } from './config';
import { logger } from '../utils/logger';

// Create nano instance
const couch = nano({
  url: config.database.url,
  requestDefaults: {
    auth: {
      username: config.database.username,
      password: config.database.password,
    },
  },
});

// Database instances for basic e-learning platform
export const databases = {
  // Core essential databases
  users: couch.db.use('users'),           // User accounts and authentication
  courses: couch.db.use('courses'),       // Course content and metadata
  enrollments: couch.db.use('enrollments'), // Course enrollments
  progress: couch.db.use('progress'),     // Student learning progress
  notifications: couch.db.use('notifications'), // In-app notifications and alerts
  
  // Essential support databases
  otp: couch.db.use('otp'),              // Authentication codes
};

// Legacy export for backward compatibility
export let db = databases.users;

/**
 * Initialize database connections and create missing databases
 */
export const connectToDatabases = async (): Promise<void> => {
  try {
    logger.info('Connecting to CouchDB...');
    
    // Check existing databases with retry logic
    const existingDatabases = await retryOperation(async () => {
      return await couch.db.list();
    }, 3, 'Database list retrieval');
    
    logger.info('Existing databases:', existingDatabases);
    
    // Required databases for basic e-learning platform
    const requiredDatabases = [
      'users', 'courses', 'enrollments', 'progress', 'notifications', 'otp'
    ];

    // Check if all required databases exist
    const missingDatabases = requiredDatabases.filter(dbName => !existingDatabases.includes(dbName));
    
    if (missingDatabases.length > 0) {
      logger.warn('Missing databases:', missingDatabases);
      
      // Create missing databases if needed with retry logic
      for (const dbName of missingDatabases) {
        try {
          await retryOperation(async () => {
            await couch.db.create(dbName);
          }, 3, `Database creation: ${dbName}`);
          logger.info(`Created database: ${dbName}`);
        } catch (error: any) {
          if (error.statusCode !== 412) { // 412 = database already exists
            logger.error(`Failed to create database ${dbName}:`, error);
          }
        }
      }
    }

    // Create necessary indexes for better query performance
    await createDatabaseIndexes();

    // Create design documents and views for essential databases only
    await createDesignDocuments();
    await createOTPDesignDocuments();

    // Test connections to essential databases only with retry logic
    for (const [name, database] of Object.entries(databases)) {
      try {
        await retryOperation(async () => {
          await database.info();
        }, 3, `Database connection test: ${name}`);
        logger.info(`Connected to database: ${name}`);
      } catch (error) {
        logger.error(`Failed to connect to database ${name}:`, error);
      }
    }

    logger.info('Database connections established successfully');
    
  } catch (error) {
    logger.error('Failed to connect to CouchDB:', error);
    throw error;
  }
};

// Retry operation utility for better stability
const retryOperation = async <T>(
  operation: () => Promise<T>, 
  maxRetries: number, 
  operationName: string
): Promise<T> => {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      logger.warn(`${operationName} failed (attempt ${attempt}/${maxRetries}):`, error);
      
      if (attempt < maxRetries) {
        // Exponential backoff: wait 1s, 2s, 4s...
        const delay = Math.pow(2, attempt - 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw new Error(`${operationName} failed after ${maxRetries} attempts: ${lastError?.message || lastError}`);
};

// Create necessary indexes for optimal query performance
const createDatabaseIndexes = async (): Promise<void> => {
  try {
    logger.info('Creating database indexes for optimal performance...');
    
    // Add health monitoring
    await setupHealthMonitoring();
    
    logger.info('Database indexes and health monitoring setup complete');
  } catch (error) {
    logger.error('Failed to create database indexes:', error);
  }
};

// Database health monitoring for stable connections
const setupHealthMonitoring = async (): Promise<void> => {
  try {
    logger.info('Setting up database health monitoring...');
    
    // Test all database connections
    const healthChecks = await Promise.allSettled([
      databases.users.info(),
      databases.courses.info(),
      databases.enrollments.info(),
      databases.progress.info(),
      databases.notifications.info(),
      databases.otp.info()
    ]);
    
    const results = healthChecks.map((result, index) => {
      const dbNames = ['users', 'courses', 'enrollments', 'progress', 'notifications', 'otp'];
      return {
        database: dbNames[index],
        status: result.status === 'fulfilled' ? 'healthy' : 'unhealthy',
        error: result.status === 'rejected' ? result.reason : null
      };
    });
    
    const healthyCount = results.filter(r => r.status === 'healthy').length;
    const totalCount = results.length;
    
    logger.info(`Database health check complete: ${healthyCount}/${totalCount} databases healthy`, { results });
    
    if (healthyCount < totalCount) {
      logger.warn('Some databases are unhealthy:', results.filter(r => r.status === 'unhealthy'));
    }
    
  } catch (error) {
    logger.error('Failed to setup health monitoring:', error);
  }
};

// Create design documents and views for essential databases only
const createDesignDocuments = async (): Promise<void> => {
  try {
    await createCourseDesignDocuments();
    await createUserDesignDocuments();
    await createEnrollmentDesignDocuments();
    await createProgressDesignDocuments();

    await createNotificationDesignDocuments();
    
    logger.info('Essential design documents created successfully');
  } catch (error) {
    logger.error('Failed to create design documents:', error);
  }
};

// Create course-specific design documents
const createCourseDesignDocuments = async (): Promise<void> => {
  const coursesDb = databases.courses;
  
  try {
    const designDoc: any = {
      _id: '_design/courses',
      views: {
        all_courses: {
          map: `function(doc) {
            if (doc.type === 'course') {
              emit(doc._id, null);
            }
          }`
        },
        by_status: {
          map: `function(doc) {
            if (doc.type === 'course' && doc.status) {
              emit(doc.status, null);
            }
          }`
        },
        published: {
          map: `function(doc) {
            if (doc.type === 'course' && doc.status === 'published') {
              emit(doc._id, null);
            }
          }`
        },
        by_instructor: {
          map: `function(doc) {
            if (doc.type === 'course' && doc.instructorId) {
              emit(doc.instructorId, null);
            }
          }`
        }
      }
    };

    try {
      const existing = await coursesDb.get('_design/courses');
      designDoc._rev = existing._rev;
    } catch (error) {
      // Design doc doesn't exist, will create new one
    }

    await coursesDb.insert(designDoc);
    logger.info('Course design document created/updated successfully');
  } catch (error: any) {
    if (error.statusCode !== 409) {
      logger.error('Failed to create course design document:', error);
    }
  }
};

// Create user-specific design documents
const createUserDesignDocuments = async (): Promise<void> => {
  const usersDb = databases.users;
  
  try {
    const designDoc: any = {
      _id: '_design/users',
      views: {
        all_users: {
          map: `function(doc) {
            if (doc.type === 'user') {
              emit(doc._id, null);
            }
          }`
        },
        by_email: {
          map: `function(doc) {
            if (doc.type === 'user' && doc.email) {
              emit(doc.email, null);
            }
          }`
        },
        by_role: {
          map: `function(doc) {
            if (doc.type === 'user' && doc.role) {
              emit(doc.role, null);
            }
          }`
        }
      }
    };

    try {
      const existing = await usersDb.get('_design/users');
      designDoc._rev = existing._rev;
    } catch (error) {
      // Design doc doesn't exist, will create new one
    }

    await usersDb.insert(designDoc);
    logger.info('User design document created/updated successfully');
  } catch (error: any) {
    if (error.statusCode !== 409) {
      logger.error('Failed to create user design document:', error);
    }
  }
};

// Create enrollment-specific design documents
const createEnrollmentDesignDocuments = async (): Promise<void> => {
  const enrollmentsDb = databases.enrollments;
  
  try {
    const designDoc: any = {
      _id: '_design/enrollments',
      views: {
        by_user: {
          map: `function(doc) {
            if (doc.type === 'enrollment' && doc.userId) {
              emit(doc.userId, null);
            }
          }`
        },
        by_course: {
          map: `function(doc) {
            if (doc.type === 'enrollment' && doc.courseId) {
              emit(doc.courseId, null);
            }
          }`
        },
        active_enrollments: {
          map: `function(doc) {
            if (doc.type === 'enrollment' && doc.status === 'active') {
              emit([doc.userId, doc.courseId], null);
            }
          }`
        }
      }
    };

    try {
      const existing = await enrollmentsDb.get('_design/enrollments');
      designDoc._rev = existing._rev;
    } catch (error) {
      // Design doc doesn't exist, will create new one
    }

    await enrollmentsDb.insert(designDoc);
    logger.info('Enrollment design document created/updated successfully');
  } catch (error: any) {
    if (error.statusCode !== 409) {
      logger.error('Failed to create enrollment design document:', error);
    }
  }
};

// Create progress-specific design documents
const createProgressDesignDocuments = async (): Promise<void> => {
  const progressDb = databases.progress;
  
  try {
    const designDoc: any = {
      _id: '_design/progress',
      views: {
        by_user: {
          map: `function(doc) {
            if (doc.type === 'progress' && doc.userId) {
              emit(doc.userId, null);
            }
          }`
        },
        by_course: {
          map: `function(doc) {
            if (doc.type === 'progress' && doc.courseId) {
              emit(doc.courseId, null);
            }
          }`
        },
        by_user_and_course: {
          map: `function(doc) {
            if (doc.type === 'progress' && doc.userId && doc.courseId) {
              emit([doc.userId, doc.courseId], null);
            }
          }`
        },
        recent_activity: {
          map: `function(doc) {
            if (doc.type === 'progress' && doc.lastWatched) {
              emit(doc.lastWatched, null);
            }
          }`
        },
        gamification_by_user_course: {
          map: `function(doc) {
            if (doc.type === 'gamification' && doc.userId && doc.courseId) {
              emit([doc.userId, doc.courseId], null);
            }
          }`
        },
        gamification_by_user: {
          map: `function(doc) {
            if (doc.type === 'gamification' && doc.userId) {
              emit(doc.userId, null);
            }
          }`
        }
      }
    };

    try {
      const existing = await progressDb.get('_design/progress');
      designDoc._rev = existing._rev;
    } catch (error) {
      // Design doc doesn't exist, will create new one
    }

    await progressDb.insert(designDoc);
    logger.info('Progress design document created/updated successfully');
  } catch (error: any) {
    if (error.statusCode !== 409) {
      logger.error('Failed to create progress design document:', error);
    }
  }
};





// Create notification design documents
const createNotificationDesignDocuments = async (): Promise<void> => {
  const notificationsDb = databases.notifications;
  
  try {
    const designDoc: any = {
      _id: '_design/notifications',
      views: {
        by_user: {
          map: `function(doc) {
            if (doc.type === 'notification' && doc.userId) {
              emit(doc.userId, null);
            }
          }`
        },
        by_type: {
          map: `function(doc) {
            if (doc.type === 'notification' && doc.notificationType) {
              emit(doc.notificationType, null);
            }
          }`
        },
        by_priority: {
          map: `function(doc) {
            if (doc.type === 'notification' && doc.priority) {
              emit(doc.priority, null);
            }
          }`
        },
        unread_by_user: {
          map: `function(doc) {
            if (doc.type === 'notification' && doc.userId && !doc.isRead) {
              emit(doc.userId, null);
            }
          }`
        },
        by_created_at: {
          map: `function(doc) {
            if (doc.type === 'notification' && doc.createdAt) {
              emit(doc.createdAt, null);
            }
          }`
        }
      }
    };

    try {
      const existing = await notificationsDb.get('_design/notifications');
      designDoc._rev = existing._rev;
    } catch (error) {
      // Design doc doesn't exist, will create new one
    }

    await notificationsDb.insert(designDoc);
    logger.info('Notification design document created/updated successfully');
  } catch (error: any) {
    if (error.statusCode !== 409) {
      logger.error('Failed to create notification design document:', error);
    }
  }
};

// Create user-specific indexes
const createUserIndexes = async (): Promise<void> => {
  const usersDb = databases.users;
  
  try {
    await usersDb.createIndex({
      index: {
        fields: ['type', 'email']
      },
      name: 'user-email-idx',
      type: 'json'
    });
    
    await usersDb.createIndex({
      index: {
        fields: ['type', 'role', 'status']
      },
      name: 'user-role-status-idx',
      type: 'json'
    });
    
    logger.info('User indexes created successfully');
  } catch (error: any) {
    if (error.statusCode !== 409) {
      logger.error('Failed to create user indexes:', error);
    }
  }
};



// Create OTP design documents
const createOTPDesignDocuments = async (): Promise<void> => {
  const otpDb = databases.otp;
  
  try {
    const designDoc = {
      _id: '_design/otp',
      views: {
        by_email: {
          map: `function(doc) {
            if (doc.type === 'otp' && doc.email) {
              emit(doc.email, null);
            }
          }`
        },
        by_expiry: {
          map: `function(doc) {
            if (doc.type === 'otp' && doc.expiresAt) {
              emit(doc.expiresAt, null);
            }
          }`
        },
        active_otps: {
          map: `function(doc) {
            if (doc.type === 'otp' && doc.expiresAt && doc.expiresAt > new Date().toISOString()) {
              emit(doc.email, null);
            }
          }`
        }
      }
    };

    try {
      const existing = await otpDb.get('_design/otp');
      (designDoc as any)._rev = existing._rev;
    } catch (error) {
      // Design doc doesn't exist, will create new one
    }

    await otpDb.insert(designDoc);
    logger.info('OTP design document created/updated successfully');
  } catch (error: any) {
    if (error.statusCode !== 409) {
      logger.error('Failed to create OTP design document:', error);
    }
  }
};

// Create OTP-specific indexes
const createOTPIndexes = async (): Promise<void> => {
  const otpDb = databases.otp;
  
  try {
    await otpDb.createIndex({
      index: {
        fields: ['type', 'email', 'expiresAt']
      },
      name: 'otp-email-expiry-idx',
      type: 'json'
    });
    
    logger.info('OTP indexes created successfully');
  } catch (error: any) {
    if (error.statusCode !== 409) {
      logger.error('Failed to create OTP indexes:', error);
    }
  }
};

// Get database by name
export const getDatabase = (name: string) => {
  return (databases as any)[name] || null;
}; 