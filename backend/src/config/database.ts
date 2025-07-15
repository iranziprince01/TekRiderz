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

// Database instances for basic e-learning platform (9 essential databases)
export const databases = {
  // Core essential databases
  users: couch.db.use('users'),           // User accounts and authentication
  courses: couch.db.use('courses'),       // Course content and metadata
  enrollments: couch.db.use('enrollments'), // Course enrollments
  progress: couch.db.use('progress'),     // Student learning progress
  certificates: couch.db.use('certificates'), // Auto-generated certificates
  analytics: couch.db.use('analytics'),   // Basic platform analytics
  assessments: couch.db.use('assessments'), // Quizzes and assessments
  grades: couch.db.use('grades'),         // Student grades and scores
  
  // Essential support databases
  otp: couch.db.use('otp'),              // Authentication codes
  files: couch.db.use('files'),          // File metadata storage
};

// Legacy export for backward compatibility
export let db = databases.users;

// Database connection
export const connectDB = async (): Promise<void> => {
  try {
    // Check existing databases
    const existingDatabases = await couch.db.list();
    logger.info('Existing databases:', existingDatabases);
    
    // Required databases for basic e-learning platform
    const requiredDatabases = [
      'users', 'courses', 'enrollments', 'progress', 'certificates', 
      'analytics', 'assessments', 'grades', 'otp', 'files'
    ];

    // Note: password_resets and refresh_tokens databases exist but are not used
    // - password_resets: Password reset functionality is handled via OTP in 'otp' database
    // - refresh_tokens: JWT refresh tokens are stored in user documents as arrays

    // Check if all required databases exist
    const missingDatabases = requiredDatabases.filter(dbName => !existingDatabases.includes(dbName));
    
    if (missingDatabases.length > 0) {
      logger.warn('Missing databases:', missingDatabases);
      
      // Create missing databases if needed
      for (const dbName of missingDatabases) {
        try {
          await couch.db.create(dbName);
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

    // Test connections to core databases only
    for (const [name, database] of Object.entries(databases)) {
      try {
        await database.info();
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

// Create necessary indexes for optimal query performance
const createDatabaseIndexes = async (): Promise<void> => {
  try {
    // OTP database indexes
    await createOTPIndexes();
    
    // Users database indexes  
    await createUserIndexes();
    
    // Certificates database indexes
    await createCertificateIndexes();
    
    // Progress database indexes
    await createProgressIndexes();
    
    logger.info('Database indexes created successfully');
  } catch (error) {
    logger.error('Failed to create database indexes:', error);
    // Don't throw - indexes are for performance, not functionality
  }
};

// Create design documents and views for essential databases only
const createDesignDocuments = async (): Promise<void> => {
  try {
    // Create design documents for essential databases
    await createCourseDesignDocuments();
    await createUserDesignDocuments();
    await createEnrollmentDesignDocuments();
    await createProgressDesignDocuments();
    await createCertificateDesignDocuments();
    await createAnalyticsDesignDocuments();
    await createAssessmentDesignDocuments();
    await createGradeDesignDocuments();
    
    logger.info('Essential design documents created successfully');
  } catch (error) {
    logger.error('Failed to create design documents:', error);
  }
};

// Create OTP-specific indexes
const createOTPIndexes = async (): Promise<void> => {
  const otpDb = databases.otp;
  
  try {
    // Index for OTP queries by email and purpose
    await otpDb.createIndex({
      index: {
        fields: ['type', 'email', 'purpose', 'verified', 'createdAt']
      },
      name: 'otp-email-purpose-idx',
      type: 'json'
    });
    
    // Index for OTP queries by email only
    await otpDb.createIndex({
      index: {
        fields: ['type', 'email', 'createdAt']
      },
      name: 'otp-email-idx',
      type: 'json'
    });
    
    // Index for OTP cleanup (expired OTPs)
    await otpDb.createIndex({
      index: {
        fields: ['type', 'expiresAt']
      },
      name: 'otp-expiry-idx',
      type: 'json'
    });
    
    logger.info('OTP indexes created successfully');
  } catch (error: any) {
    if (error.statusCode !== 409) { // 409 = index already exists
      logger.error('Failed to create OTP indexes:', error);
    }
  }
};

// Create user-specific indexes
const createUserIndexes = async (): Promise<void> => {
  const usersDb = databases.users;
  
  try {
    // Index for user queries by email
    await usersDb.createIndex({
      index: {
        fields: ['type', 'email']
      },
      name: 'user-email-idx',
      type: 'json'
    });
    
    // Index for user queries by status
    await usersDb.createIndex({
      index: {
        fields: ['type', 'status', 'verified']
      },
      name: 'user-status-idx',
      type: 'json'
    });
    
    // Index for user queries by role
    await usersDb.createIndex({
      index: {
        fields: ['type', 'role', 'status']
      },
      name: 'user-role-idx',
      type: 'json'
    });
    
    logger.info('User indexes created successfully');
  } catch (error: any) {
    if (error.statusCode !== 409) { // 409 = index already exists
      logger.error('Failed to create user indexes:', error);
    }
  }
};

// Create certificate-specific indexes
const createCertificateIndexes = async (): Promise<void> => {
  const certificatesDb = databases.certificates;
  
  try {
    // Index for certificate queries by user
    await certificatesDb.createIndex({
      index: {
        fields: ['type', 'userId', 'issuedAt']
      },
      name: 'certificate-user-idx',
      type: 'json'
    });
    
    // Index for certificate queries by course
    await certificatesDb.createIndex({
      index: {
        fields: ['type', 'courseId', 'issuedAt']
      },
      name: 'certificate-course-idx',
      type: 'json'
    });
    
    // Index for certificate verification
    await certificatesDb.createIndex({
      index: {
        fields: ['type', 'certificateNumber', 'status']
      },
      name: 'certificate-verification-idx',
      type: 'json'
    });
    
    logger.info('Certificate indexes created successfully');
  } catch (error: any) {
    if (error.statusCode !== 409) { // 409 = index already exists
      logger.error('Failed to create certificate indexes:', error);
    }
  }
};

// Create progress-specific indexes
const createProgressIndexes = async (): Promise<void> => {
  const progressDb = databases.progress;
  
  try {
    // Index for progress queries by user
    await progressDb.createIndex({
      index: {
        fields: ['type', 'userId', 'lastWatched']
      },
      name: 'progress-user-idx',
      type: 'json'
    });
    
    // Index for progress queries by course
    await progressDb.createIndex({
      index: {
        fields: ['type', 'courseId', 'overallProgress']
      },
      name: 'progress-course-idx',
      type: 'json'
    });
    
    // Index for progress queries by user and course
    await progressDb.createIndex({
      index: {
        fields: ['type', 'userId', 'courseId']
      },
      name: 'progress-user-course-idx',
      type: 'json'
    });
    
    logger.info('Progress indexes created successfully');
  } catch (error: any) {
    if (error.statusCode !== 409) { // 409 = index already exists
      logger.error('Failed to create progress indexes:', error);
    }
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
        by_category: {
          map: `function(doc) {
            if (doc.type === 'course' && doc.category) {
              emit(doc.category, null);
            }
          }`
        },
        by_level: {
          map: `function(doc) {
            if (doc.type === 'course' && doc.level) {
              emit(doc.level, null);
            }
          }`
        },
        by_instructor: {
          map: `function(doc) {
            if (doc.type === 'course' && doc.instructorId) {
              emit(doc.instructorId, null);
            }
          }`
        },
        pending_approval: {
          map: `function(doc) {
            if (doc.type === 'course' && doc.status === 'submitted') {
              emit(doc._id, null);
            }
          }`
        }
      }
    };

    // Try to get existing design doc first
    try {
      const existing = await coursesDb.get('_design/courses');
      designDoc._rev = existing._rev;
    } catch (error) {
      // Design doc doesn't exist, will create new one
    }

    await coursesDb.insert(designDoc);
    logger.info('Course design document created/updated successfully');
  } catch (error: any) {
    if (error.statusCode !== 409) { // 409 = conflict (already exists)
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
        },
        by_status: {
          map: `function(doc) {
            if (doc.type === 'user' && doc.status) {
              emit(doc.status, null);
            }
          }`
        },
        verified_users: {
          map: `function(doc) {
            if (doc.type === 'user' && doc.verified === true) {
              emit(doc._id, null);
            }
          }`
        }
      }
    };

    // Try to get existing design doc first
    try {
      const existing = await usersDb.get('_design/users');
      designDoc._rev = existing._rev;
    } catch (error) {
      // Design doc doesn't exist, will create new one
    }

    await usersDb.insert(designDoc);
    logger.info('User design document created/updated successfully');
  } catch (error: any) {
    if (error.statusCode !== 409) { // 409 = conflict (already exists)
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
        all_enrollments: {
          map: `function(doc) {
            if (doc.type === 'enrollment') {
              emit(doc._id, null);
            }
          }`
        },
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
        by_status: {
          map: `function(doc) {
            if (doc.type === 'enrollment' && doc.status) {
              emit(doc.status, null);
            }
          }`
        },
        by_date: {
          map: `function(doc) {
            if (doc.type === 'enrollment' && doc.enrolledAt) {
              emit(doc.enrolledAt, null);
            }
          }`
        },
        recent_enrollments: {
          map: `function(doc) {
            if (doc.type === 'enrollment' && doc.enrolledAt) {
              emit(doc.enrolledAt, null);
            }
          }`
        }
      }
    };

    // Try to get existing design doc first
    try {
      const existing = await enrollmentsDb.get('_design/enrollments');
      designDoc._rev = existing._rev;
    } catch (error) {
      // Design doc doesn't exist, will create new one
    }

    await enrollmentsDb.insert(designDoc);
    logger.info('Enrollment design document created/updated successfully');
  } catch (error: any) {
    if (error.statusCode !== 409) { // 409 = conflict (already exists)
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
        by_user_course: {
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
        }
      }
    };

    // Try to get existing design doc first
    try {
      const existing = await progressDb.get('_design/progress');
      designDoc._rev = existing._rev;
    } catch (error) {
      // Design doc doesn't exist, will create new one
    }

    await progressDb.insert(designDoc);
    logger.info('Progress design document created/updated successfully');
  } catch (error: any) {
    if (error.statusCode !== 409) { // 409 = conflict (already exists)
      logger.error('Failed to create progress design document:', error);
    }
  }
};

// Create certificate-specific design documents
const createCertificateDesignDocuments = async (): Promise<void> => {
  const certificatesDb = databases.certificates;
  
  try {
    const designDoc: any = {
      _id: '_design/certificates',
      views: {
        by_user: {
          map: `function(doc) {
            if (doc.type === 'certificate' && doc.userId) {
              emit(doc.userId, null);
            }
          }`
        },
        by_course: {
          map: `function(doc) {
            if (doc.type === 'certificate' && doc.courseId) {
              emit(doc.courseId, null);
            }
          }`
        },
        by_enrollment: {
          map: `function(doc) {
            if (doc.type === 'certificate' && doc.enrollmentId) {
              emit(doc.enrollmentId, null);
            }
          }`
        },
        by_certificate_number: {
          map: `function(doc) {
            if (doc.type === 'certificate' && doc.certificateNumber) {
              emit(doc.certificateNumber, null);
            }
          }`
        },
        by_status: {
          map: `function(doc) {
            if (doc.type === 'certificate' && doc.status) {
              emit(doc.status, null);
            }
          }`
        },
        recent_certificates: {
          map: `function(doc) {
            if (doc.type === 'certificate' && doc.issuedAt) {
              emit(doc.issuedAt, null);
            }
          }`
        }
      }
    };

    // Try to get existing design doc first
    try {
      const existing = await certificatesDb.get('_design/certificates');
      designDoc._rev = existing._rev;
    } catch (error) {
      // Design doc doesn't exist, will create new one
    }

    await certificatesDb.insert(designDoc);
    logger.info('Certificate design document created/updated successfully');
  } catch (error: any) {
    if (error.statusCode !== 409) { // 409 = conflict (already exists)
      logger.error('Failed to create certificate design document:', error);
    }
  }
};

// Create analytics design documents
const createAnalyticsDesignDocuments = async (): Promise<void> => {
  const analyticsDb = databases.analytics;
  
  try {
    const designDoc: any = {
      _id: '_design/analytics',
      views: {
        by_entity: {
          map: `function(doc) {
            if (doc.type === 'analytics' && doc.entityType && doc.entityId) {
              emit([doc.entityType, doc.entityId], null);
            }
          }`
        },
        by_event: {
          map: `function(doc) {
            if (doc.type === 'analytics' && doc.event) {
              emit(doc.event, null);
            }
          }`
        },
        by_timestamp: {
          map: `function(doc) {
            if (doc.type === 'analytics' && doc.timestamp) {
              emit(doc.timestamp, null);
            }
          }`
        },
        by_user: {
          map: `function(doc) {
            if (doc.type === 'analytics' && doc.userId) {
              emit(doc.userId, null);
            }
          }`
        }
      }
    };

    try {
      const existing = await analyticsDb.get('_design/analytics');
      designDoc._rev = existing._rev;
    } catch (error) {
      // Design doc doesn't exist, will create new one
    }

    await analyticsDb.insert(designDoc);
    logger.info('Analytics design document created/updated successfully');
  } catch (error: any) {
    if (error.statusCode !== 409) {
      logger.error('Failed to create analytics design document:', error);
    }
  }
};

// Create assessment design documents
const createAssessmentDesignDocuments = async (): Promise<void> => {
  const assessmentsDb = databases.assessments;
  
  try {
    const designDoc: any = {
      _id: '_design/assessments',
      views: {
        by_course: {
          map: `function(doc) {
            if (doc.type === 'assessment' && doc.courseId) {
              emit(doc.courseId, null);
            }
          }`
        },
        by_creator: {
          map: `function(doc) {
            if (doc.type === 'assessment' && doc.creatorId) {
              emit(doc.creatorId, null);
            }
          }`
        },
        by_user_attempt: {
          map: `function(doc) {
            if (doc.type === 'assessment_attempt' && doc.userId) {
              emit(doc.userId, null);
            }
          }`
        },
        active_assessments: {
          map: `function(doc) {
            if (doc.type === 'assessment' && doc.settings && doc.settings.isActive) {
              emit(doc._id, null);
            }
          }`
        },
        by_type: {
          map: `function(doc) {
            if (doc.type === 'assessment' && doc.assessmentType) {
              emit(doc.assessmentType, null);
            }
          }`
        }
      }
    };

    try {
      const existing = await assessmentsDb.get('_design/assessments');
      designDoc._rev = existing._rev;
    } catch (error) {
      // Design doc doesn't exist, will create new one
    }

    await assessmentsDb.insert(designDoc);
    logger.info('Assessment design document created/updated successfully');
  } catch (error: any) {
    if (error.statusCode !== 409) {
      logger.error('Failed to create assessment design document:', error);
    }
  }
};

// Create grades design documents
const createGradeDesignDocuments = async (): Promise<void> => {
  const gradesDb = databases.grades;
  
  try {
    const designDoc: any = {
      _id: '_design/grades',
      views: {
        by_user: {
          map: `function(doc) {
            if (doc.type === 'grade' && doc.userId) {
              emit(doc.userId, null);
            }
          }`
        },
        by_course: {
          map: `function(doc) {
            if (doc.type === 'grade' && doc.courseId) {
              emit(doc.courseId, null);
            }
          }`
        },
        by_user_course: {
          map: `function(doc) {
            if (doc.type === 'grade' && doc.userId && doc.courseId) {
              emit([doc.userId, doc.courseId], null);
            }
          }`
        },
        by_assessment: {
          map: `function(doc) {
            if (doc.type === 'grade' && doc.assessmentId) {
              emit(doc.assessmentId, null);
            }
          }`
        },
        passing_grades: {
          map: `function(doc) {
            if (doc.type === 'grade' && doc.passed === true) {
              emit(doc.gradedAt, null);
            }
          }`
        }
      }
    };

    try {
      const existing = await gradesDb.get('_design/grades');
      designDoc._rev = existing._rev;
    } catch (error) {
      // Design doc doesn't exist, will create new one
    }

    await gradesDb.insert(designDoc);
    logger.info('Grades design document created/updated successfully');
  } catch (error: any) {
    if (error.statusCode !== 409) {
      logger.error('Failed to create grades design document:', error);
    }
  }
};

// Get database by name
export const getDatabase = (name: keyof typeof databases) => {
  return databases[name];
};

// Health check function
export const checkDatabaseHealth = async (): Promise<boolean> => {
  try {
    const healthResults = await Promise.all(
      Object.entries(databases).map(async ([name, database]) => {
        try {
          await database.info();
          return { name, healthy: true };
        } catch (error) {
          logger.error(`Database ${name} health check failed:`, error);
          return { name, healthy: false };
        }
      })
    );

    const unhealthyDatabases = healthResults.filter(result => !result.healthy);
    
    if (unhealthyDatabases.length > 0) {
      logger.error('Unhealthy databases:', unhealthyDatabases.map(db => db.name));
      return false;
    }

    logger.info('All databases are healthy');
    return true;
  } catch (error) {
    logger.error('Database health check failed:', error);
    return false;
  }
};

// Cleanup function for expired data
export const cleanupExpiredData = async (): Promise<void> => {
  try {
    // Clean up expired OTPs
    const otpDb = databases.otp;
    const now = new Date();
    
    const expiredOTPs = await otpDb.find({
      selector: {
        type: 'otp',
        expiresAt: { $lt: now.toISOString() }
      },
      limit: 100
    });

    if (expiredOTPs.docs.length > 0) {
      const bulkDeleteDocs = expiredOTPs.docs.map(doc => ({
        ...doc,
        _deleted: true
      }));
      
      await otpDb.bulk({ docs: bulkDeleteDocs });
      logger.info(`Cleaned up ${expiredOTPs.docs.length} expired OTPs`);
    }

    logger.info('Database cleanup completed successfully');
  } catch (error) {
    logger.error('Database cleanup failed:', error);
  }
};

// Database statistics
export const getDatabaseStats = async () => {
  try {
    const stats: Record<string, any> = {};
    
    for (const [name, database] of Object.entries(databases)) {
      try {
        const info = await database.info();
        stats[name] = {
          doc_count: info.doc_count,
          doc_del_count: info.doc_del_count,
          disk_size: info.sizes?.file || 0,
          data_size: info.sizes?.active || 0
        };
      } catch (error) {
        stats[name] = { error: 'Unable to fetch stats' };
      }
    }
    
    return stats;
  } catch (error) {
    logger.error('Failed to get database stats:', error);
    return {};
  }
}; 