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
  certificates: couch.db.use('certificates'), // Certificate metadata and URLs
  analytics: couch.db.use('analytics'),   // Basic platform analytics
  assessments: couch.db.use('assessments'), // Quizzes and assessments
  grades: couch.db.use('grades'),         // Student grades and scores
  notifications: couch.db.use('notifications'), // In-app notifications and alerts
  
  // Essential support databases
  otp: couch.db.use('otp'),              // Authentication codes
  // files removed - using external services only
};

// Legacy export for backward compatibility
export let db = databases.users;

/**
 * Initialize database connections and create missing databases
 */
export const connectToDatabases = async (): Promise<void> => {
  try {
    logger.info('Connecting to CouchDB...');
    
    // Check existing databases
    const existingDatabases = await couch.db.list();
    logger.info('Existing databases:', existingDatabases);
    
    // Required databases for basic e-learning platform
    const requiredDatabases = [
      'users', 'courses', 'enrollments', 'certificates',
      'analytics', 'assessments', 'grades', 'notifications', 'otp', 'files'
    ];

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

    // Test connections to essential databases only
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
    await createUserIndexes();

    await createOTPIndexes();
    
    logger.info('Database indexes created successfully');
  } catch (error) {
    logger.error('Failed to create database indexes:', error);
    // Don't throw - indexes are for performance, not functionality
  }
};

// Create design documents and views for essential databases only
const createDesignDocuments = async (): Promise<void> => {
  try {
    await createCourseDesignDocuments();
    await createUserDesignDocuments();
    await createEnrollmentDesignDocuments();
    await createProgressDesignDocuments();

    await createAnalyticsDesignDocuments();
    await createAssessmentDesignDocuments();
    await createGradeDesignDocuments();
    await createCertificateDesignDocuments();
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
        by_user: {
          map: `function(doc) {
            if (doc.type === 'assessment_attempt' && doc.userId) {
              emit(doc.userId, null);
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

// Create grade design documents
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
        by_assessment: {
          map: `function(doc) {
            if (doc.type === 'grade' && doc.assessmentId) {
              emit(doc.assessmentId, null);
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
    logger.info('Grade design document created/updated successfully');
  } catch (error: any) {
    if (error.statusCode !== 409) {
      logger.error('Failed to create grade design document:', error);
    }
  }
};

// Create certificate design documents
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
        by_certificate_id: {
          map: `function(doc) {
            if (doc.type === 'certificate' && doc.certificateId) {
              emit(doc.certificateId, null);
            }
          }`
        },
        valid_certificates: {
          map: `function(doc) {
            if (doc.type === 'certificate' && doc.status === 'valid') {
              emit([doc.userId, doc.courseId], null);
            }
          }`
        }
      }
    };

    try {
      const existing = await certificatesDb.get('_design/certificates');
      designDoc._rev = existing._rev;
    } catch (error) {
      // Design doc doesn't exist, will create new one
    }

    await certificatesDb.insert(designDoc);
    logger.info('Certificate design document created/updated successfully');
  } catch (error: any) {
    if (error.statusCode !== 409) {
      logger.error('Failed to create certificate design document:', error);
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