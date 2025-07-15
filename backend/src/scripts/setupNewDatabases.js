const nano = require('nano');

// Database configuration
const config = {
  url: 'http://localhost:5984',
  username: 'prince',
  password: 'iranzi123'
};

const couch = nano({
  url: config.url,
  requestDefaults: {
    auth: {
      username: config.username,
      password: config.password
    }
  }
});

async function setupNewDatabases() {
  try {
    console.log('🔧 Setting up new databases for TekRiderz features...');
    
    // Define all new databases needed
    const newDatabases = [
      // Communication System
      'messages',
      
      // Assessment System
      'assessments',
      'assessment_attempts',
      
      // Mobile Optimization
      'mobile_devices',
      'offline_content',
      'mobile_optimized_content',
      'mobile_sessions',
      
      // Security Dashboard
      'security_events',
      'audit_logs',
      'data_protection_records',
      'data_subject_requests',
      'compliance_reports',
      
      // Performance Monitoring
      'performance_metrics',
      'optimization_configs',
      'load_balancing_configs',
      'monitoring_alerts'
    ];
    
    // Create databases
    for (const dbName of newDatabases) {
      try {
        await couch.db.get(dbName);
        console.log(`✅ Database ${dbName} already exists`);
      } catch (error) {
        if (error.statusCode === 404) {
          await couch.db.create(dbName);
          console.log(`✅ Created database ${dbName}`);
        } else {
          console.error(`❌ Error with database ${dbName}:`, error.message);
        }
      }
    }
    
    // Set up design documents for each database
    await createMessagesDesignDoc(couch.db.use('messages'));
    await createAssessmentsDesignDoc(couch.db.use('assessments'));
    await createAssessmentAttemptsDesignDoc(couch.db.use('assessment_attempts'));
    await createMobileDevicesDesignDoc(couch.db.use('mobile_devices'));
    await createOfflineContentDesignDoc(couch.db.use('offline_content'));
    await createMobileOptimizedContentDesignDoc(couch.db.use('mobile_optimized_content'));
    await createMobileSessionsDesignDoc(couch.db.use('mobile_sessions'));
    await createSecurityEventsDesignDoc(couch.db.use('security_events'));
    await createAuditLogsDesignDoc(couch.db.use('audit_logs'));
    await createDataProtectionRecordsDesignDoc(couch.db.use('data_protection_records'));
    await createDataSubjectRequestsDesignDoc(couch.db.use('data_subject_requests'));
    await createComplianceReportsDesignDoc(couch.db.use('compliance_reports'));
    await createPerformanceMetricsDesignDoc(couch.db.use('performance_metrics'));
    await createOptimizationConfigsDesignDoc(couch.db.use('optimization_configs'));
    await createLoadBalancingConfigsDesignDoc(couch.db.use('load_balancing_configs'));
    await createMonitoringAlertsDesignDoc(couch.db.use('monitoring_alerts'));
    
    console.log('✅ All new databases and design documents created successfully!');
    console.log('🎉 TekRiderz backend is now ready with persistent data storage!');
    
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  }
}

// Messages Design Document
async function createMessagesDesignDoc(db) {
  const designDoc = {
    _id: '_design/messages',
    views: {
      all: {
        map: `function(doc) {
          if (doc.type === 'message') {
            emit(doc._id, null);
          }
        }`
      },
      by_conversation: {
        map: `function(doc) {
          if (doc.type === 'message' && doc.conversationId) {
            emit([doc.conversationId, doc.createdAt], null);
          }
        }`
      },
      by_conversation_and_type: {
        map: `function(doc) {
          if (doc.type === 'message' && doc.conversationId && doc.messageType) {
            emit([doc.conversationId, doc.messageType, doc.createdAt], null);
          }
        }`
      },
      by_sender: {
        map: `function(doc) {
          if (doc.type === 'message' && doc.senderId) {
            emit(doc.senderId, null);
          }
        }`
      },
      by_course: {
        map: `function(doc) {
          if (doc.type === 'message' && doc.courseId) {
            emit(doc.courseId, null);
          }
        }`
      }
    }
  };
  
  await insertDesignDoc(db, designDoc, 'Messages');
}

// Assessments Design Document
async function createAssessmentsDesignDoc(db) {
  const designDoc = {
    _id: '_design/assessments',
    views: {
      all: {
        map: `function(doc) {
          if (doc.type === 'assessment') {
            emit(doc._id, null);
          }
        }`
      },
      by_course: {
        map: `function(doc) {
          if (doc.type === 'assessment' && doc.courseId) {
            emit(doc.courseId, null);
          }
        }`
      },
      by_creator: {
        map: `function(doc) {
          if (doc.type === 'assessment' && doc.createdBy) {
            emit(doc.createdBy, null);
          }
        }`
      },
      by_status: {
        map: `function(doc) {
          if (doc.type === 'assessment' && doc.status) {
            emit(doc.status, null);
          }
        }`
      },
      published: {
        map: `function(doc) {
          if (doc.type === 'assessment' && doc.status === 'published') {
            emit(doc._id, null);
          }
        }`
      }
    }
  };
  
  await insertDesignDoc(db, designDoc, 'Assessments');
}

// Assessment Attempts Design Document
async function createAssessmentAttemptsDesignDoc(db) {
  const designDoc = {
    _id: '_design/assessment_attempts',
    views: {
      all: {
        map: `function(doc) {
          if (doc.type === 'assessment_result') {
            emit(doc._id, null);
          }
        }`
      },
      by_assessment: {
        map: `function(doc) {
          if (doc.type === 'assessment_result' && doc.assessmentId) {
            emit(doc.assessmentId, null);
          }
        }`
      },
      by_user: {
        map: `function(doc) {
          if (doc.type === 'assessment_result' && doc.userId) {
            emit(doc.userId, null);
          }
        }`
      },
      by_user_and_assessment: {
        map: `function(doc) {
          if (doc.type === 'assessment_result' && doc.userId && doc.assessmentId) {
            emit([doc.userId, doc.assessmentId], null);
          }
        }`
      }
    }
  };
  
  await insertDesignDoc(db, designDoc, 'Assessment Attempts');
}

// Mobile Devices Design Document
async function createMobileDevicesDesignDoc(db) {
  const designDoc = {
    _id: '_design/mobile_devices',
    views: {
      all: {
        map: `function(doc) {
          if (doc.type === 'mobile_device') {
            emit(doc._id, null);
          }
        }`
      },
      by_user: {
        map: `function(doc) {
          if (doc.type === 'mobile_device' && doc.userId) {
            emit(doc.userId, null);
          }
        }`
      },
      by_platform: {
        map: `function(doc) {
          if (doc.type === 'mobile_device' && doc.platform) {
            emit(doc.platform, null);
          }
        }`
      },
      active: {
        map: `function(doc) {
          if (doc.type === 'mobile_device' && doc.isActive === true) {
            emit(doc._id, null);
          }
        }`
      }
    }
  };
  
  await insertDesignDoc(db, designDoc, 'Mobile Devices');
}

// Offline Content Design Document
async function createOfflineContentDesignDoc(db) {
  const designDoc = {
    _id: '_design/offline_content',
    views: {
      all: {
        map: `function(doc) {
          if (doc.type === 'offline_content') {
            emit(doc._id, null);
          }
        }`
      },
      by_user: {
        map: `function(doc) {
          if (doc.type === 'offline_content' && doc.userId) {
            emit(doc.userId, null);
          }
        }`
      },
      by_course: {
        map: `function(doc) {
          if (doc.type === 'offline_content' && doc.courseId) {
            emit(doc.courseId, null);
          }
        }`
      },
      by_status: {
        map: `function(doc) {
          if (doc.type === 'offline_content' && doc.status) {
            emit(doc.status, null);
          }
        }`
      }
    }
  };
  
  await insertDesignDoc(db, designDoc, 'Offline Content');
}

// Mobile Optimized Content Design Document
async function createMobileOptimizedContentDesignDoc(db) {
  const designDoc = {
    _id: '_design/mobile_optimized_content',
    views: {
      all: {
        map: `function(doc) {
          if (doc.type === 'mobile_optimized_content') {
            emit(doc._id, null);
          }
        }`
      },
      by_original_content: {
        map: `function(doc) {
          if (doc.type === 'mobile_optimized_content' && doc.originalContentId) {
            emit(doc.originalContentId, null);
          }
        }`
      },
      by_quality: {
        map: `function(doc) {
          if (doc.type === 'mobile_optimized_content' && doc.quality) {
            emit(doc.quality, null);
          }
        }`
      }
    }
  };
  
  await insertDesignDoc(db, designDoc, 'Mobile Optimized Content');
}

// Mobile Sessions Design Document
async function createMobileSessionsDesignDoc(db) {
  const designDoc = {
    _id: '_design/mobile_sessions',
    views: {
      all: {
        map: `function(doc) {
          if (doc.type === 'mobile_session') {
            emit(doc._id, null);
          }
        }`
      },
      by_user: {
        map: `function(doc) {
          if (doc.type === 'mobile_session' && doc.userId) {
            emit(doc.userId, null);
          }
        }`
      },
      by_device: {
        map: `function(doc) {
          if (doc.type === 'mobile_session' && doc.deviceId) {
            emit(doc.deviceId, null);
          }
        }`
      },
      active: {
        map: `function(doc) {
          if (doc.type === 'mobile_session' && doc.isActive === true) {
            emit(doc._id, null);
          }
        }`
      }
    }
  };
  
  await insertDesignDoc(db, designDoc, 'Mobile Sessions');
}

// Security Events Design Document
async function createSecurityEventsDesignDoc(db) {
  const designDoc = {
    _id: '_design/security_events',
    views: {
      all: {
        map: `function(doc) {
          if (doc.type === 'security_event') {
            emit(doc.createdAt, null);
          }
        }`
      },
      by_type: {
        map: `function(doc) {
          if (doc.type === 'security_event' && doc.eventType) {
            emit(doc.eventType, null);
          }
        }`
      },
      by_severity: {
        map: `function(doc) {
          if (doc.type === 'security_event' && doc.severity) {
            emit(doc.severity, null);
          }
        }`
      },
      by_user: {
        map: `function(doc) {
          if (doc.type === 'security_event' && doc.userId) {
            emit(doc.userId, null);
          }
        }`
      },
      recent: {
        map: `function(doc) {
          if (doc.type === 'security_event') {
            emit(doc.createdAt, null);
          }
        }`
      }
    }
  };
  
  await insertDesignDoc(db, designDoc, 'Security Events');
}

// Audit Logs Design Document
async function createAuditLogsDesignDoc(db) {
  const designDoc = {
    _id: '_design/audit_logs',
    views: {
      all: {
        map: `function(doc) {
          if (doc.type === 'audit_log') {
            emit(doc.createdAt, null);
          }
        }`
      },
      by_action: {
        map: `function(doc) {
          if (doc.type === 'audit_log' && doc.action) {
            emit(doc.action, null);
          }
        }`
      },
      by_user: {
        map: `function(doc) {
          if (doc.type === 'audit_log' && doc.userId) {
            emit(doc.userId, null);
          }
        }`
      },
      by_resource: {
        map: `function(doc) {
          if (doc.type === 'audit_log' && doc.resourceType) {
            emit(doc.resourceType, null);
          }
        }`
      },
      recent: {
        map: `function(doc) {
          if (doc.type === 'audit_log') {
            emit(doc.createdAt, null);
          }
        }`
      }
    }
  };
  
  await insertDesignDoc(db, designDoc, 'Audit Logs');
}

// Data Protection Records Design Document
async function createDataProtectionRecordsDesignDoc(db) {
  const designDoc = {
    _id: '_design/data_protection_records',
    views: {
      all: {
        map: `function(doc) {
          if (doc.type === 'data_protection_record') {
            emit(doc._id, null);
          }
        }`
      },
      by_user: {
        map: `function(doc) {
          if (doc.type === 'data_protection_record' && doc.userId) {
            emit(doc.userId, null);
          }
        }`
      },
      by_type: {
        map: `function(doc) {
          if (doc.type === 'data_protection_record' && doc.recordType) {
            emit(doc.recordType, null);
          }
        }`
      }
    }
  };
  
  await insertDesignDoc(db, designDoc, 'Data Protection Records');
}

// Data Subject Requests Design Document
async function createDataSubjectRequestsDesignDoc(db) {
  const designDoc = {
    _id: '_design/data_subject_requests',
    views: {
      all: {
        map: `function(doc) {
          if (doc.type === 'data_subject_request') {
            emit(doc._id, null);
          }
        }`
      },
      by_user: {
        map: `function(doc) {
          if (doc.type === 'data_subject_request' && doc.userId) {
            emit(doc.userId, null);
          }
        }`
      },
      by_status: {
        map: `function(doc) {
          if (doc.type === 'data_subject_request' && doc.status) {
            emit(doc.status, null);
          }
        }`
      },
      by_request_type: {
        map: `function(doc) {
          if (doc.type === 'data_subject_request' && doc.requestType) {
            emit(doc.requestType, null);
          }
        }`
      }
    }
  };
  
  await insertDesignDoc(db, designDoc, 'Data Subject Requests');
}

// Compliance Reports Design Document
async function createComplianceReportsDesignDoc(db) {
  const designDoc = {
    _id: '_design/compliance_reports',
    views: {
      all: {
        map: `function(doc) {
          if (doc.type === 'compliance_report') {
            emit(doc._id, null);
          }
        }`
      },
      by_type: {
        map: `function(doc) {
          if (doc.type === 'compliance_report' && doc.reportType) {
            emit(doc.reportType, null);
          }
        }`
      },
      by_date: {
        map: `function(doc) {
          if (doc.type === 'compliance_report' && doc.createdAt) {
            emit(doc.createdAt, null);
          }
        }`
      },
      recent: {
        map: `function(doc) {
          if (doc.type === 'compliance_report') {
            emit(doc.createdAt, null);
          }
        }`
      }
    }
  };
  
  await insertDesignDoc(db, designDoc, 'Compliance Reports');
}

// Performance Metrics Design Document
async function createPerformanceMetricsDesignDoc(db) {
  const designDoc = {
    _id: '_design/performance_metrics',
    views: {
      all: {
        map: `function(doc) {
          if (doc.type === 'performance_metric') {
            emit(doc.createdAt, null);
          }
        }`
      },
      by_metric_type: {
        map: `function(doc) {
          if (doc.type === 'performance_metric' && doc.metricType) {
            emit(doc.metricType, null);
          }
        }`
      },
      by_timestamp: {
        map: `function(doc) {
          if (doc.type === 'performance_metric' && doc.timestamp) {
            emit(doc.timestamp, null);
          }
        }`
      },
      recent: {
        map: `function(doc) {
          if (doc.type === 'performance_metric') {
            emit(doc.createdAt, null);
          }
        }`
      }
    }
  };
  
  await insertDesignDoc(db, designDoc, 'Performance Metrics');
}

// Optimization Configs Design Document
async function createOptimizationConfigsDesignDoc(db) {
  const designDoc = {
    _id: '_design/optimization_configs',
    views: {
      all: {
        map: `function(doc) {
          if (doc.type === 'optimization_config') {
            emit(doc._id, null);
          }
        }`
      },
      by_type: {
        map: `function(doc) {
          if (doc.type === 'optimization_config' && doc.configType) {
            emit(doc.configType, null);
          }
        }`
      },
      active: {
        map: `function(doc) {
          if (doc.type === 'optimization_config' && doc.isActive === true) {
            emit(doc._id, null);
          }
        }`
      }
    }
  };
  
  await insertDesignDoc(db, designDoc, 'Optimization Configs');
}

// Load Balancing Configs Design Document
async function createLoadBalancingConfigsDesignDoc(db) {
  const designDoc = {
    _id: '_design/load_balancing_configs',
    views: {
      all: {
        map: `function(doc) {
          if (doc.type === 'load_balancing_config') {
            emit(doc._id, null);
          }
        }`
      },
      by_server: {
        map: `function(doc) {
          if (doc.type === 'load_balancing_config' && doc.serverId) {
            emit(doc.serverId, null);
          }
        }`
      },
      active: {
        map: `function(doc) {
          if (doc.type === 'load_balancing_config' && doc.isActive === true) {
            emit(doc._id, null);
          }
        }`
      }
    }
  };
  
  await insertDesignDoc(db, designDoc, 'Load Balancing Configs');
}

// Monitoring Alerts Design Document
async function createMonitoringAlertsDesignDoc(db) {
  const designDoc = {
    _id: '_design/monitoring_alerts',
    views: {
      all: {
        map: `function(doc) {
          if (doc.type === 'monitoring_alert') {
            emit(doc.createdAt, null);
          }
        }`
      },
      by_severity: {
        map: `function(doc) {
          if (doc.type === 'monitoring_alert' && doc.severity) {
            emit(doc.severity, null);
          }
        }`
      },
      by_status: {
        map: `function(doc) {
          if (doc.type === 'monitoring_alert' && doc.status) {
            emit(doc.status, null);
          }
        }`
      },
      active: {
        map: `function(doc) {
          if (doc.type === 'monitoring_alert' && doc.status === 'active') {
            emit(doc.createdAt, null);
          }
        }`
      },
      recent: {
        map: `function(doc) {
          if (doc.type === 'monitoring_alert') {
            emit(doc.createdAt, null);
          }
        }`
      }
    }
  };
  
  await insertDesignDoc(db, designDoc, 'Monitoring Alerts');
}

// Helper function to insert design documents
async function insertDesignDoc(db, designDoc, name) {
  try {
    const existing = await db.get(designDoc._id);
    designDoc._rev = existing._rev;
  } catch (error) {
    // Design doc doesn't exist, that's fine
  }
  
  await db.insert(designDoc);
  console.log(`✅ ${name} design document created/updated`);
}

// Run the setup
setupNewDatabases().catch(console.error); 