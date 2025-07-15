const nano = require('nano');
const bcrypt = require('bcryptjs');

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

async function setupDatabase() {
  try {
    console.log('🔧 Setting up database...');
    
    // Check if databases exist
    const databases = ['users', 'courses', 'enrollments', 'progress', 'otp'];
    
    for (const dbName of databases) {
      try {
        await couch.db.get(dbName);
        console.log(`✅ Database ${dbName} exists`);
      } catch (error) {
        if (error.statusCode === 404) {
          await couch.db.create(dbName);
          console.log(`✅ Created database ${dbName}`);
        } else {
          console.error(`❌ Error with database ${dbName}:`, error.message);
        }
      }
    }
    
    // Set up users database
    const usersDb = couch.db.use('users');
    const coursesDb = couch.db.use('courses');
    
    // Create design documents
    await createUserDesignDoc(usersDb);
    await createCourseDesignDoc(coursesDb);
    
    // Check if test tutor user exists
    await createTestTutorUser(usersDb);
    await createAdminUser(usersDb); // Add this line to create admin user
    
    // Check for existing courses
    await checkExistingCourses(coursesDb);
    
    console.log('✅ Database setup complete!');
    
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  }
}

async function createUserDesignDoc(usersDb) {
  const designDoc = {
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
      active_users: {
        map: `function(doc) {
          if (doc.type === 'user' && doc.status === 'active') {
            emit(doc._id, null);
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
  
  try {
    const existing = await usersDb.get('_design/users');
    designDoc._rev = existing._rev;
  } catch (error) {
    // Design doc doesn't exist
  }
  
  await usersDb.insert(designDoc);
  console.log('✅ User design document created/updated');
}

async function createCourseDesignDoc(coursesDb) {
  const designDoc = {
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
      by_instructor: {
        map: `function(doc) {
          if (doc.type === 'course' && doc.instructorId) {
            emit(doc.instructorId, null);
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
      pending_approval: {
        map: `function(doc) {
          if (doc.type === 'course' && doc.status === 'submitted') {
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
      }
    }
  };
  
  try {
    const existing = await coursesDb.get('_design/courses');
    designDoc._rev = existing._rev;
  } catch (error) {
    // Design doc doesn't exist
  }
  
  await coursesDb.insert(designDoc);
  console.log('✅ Course design document created/updated');
}

async function createTestTutorUser(usersDb) {
  const testEmail = 'prince@test.com';
  
  try {
    // Check if test user exists
    const result = await usersDb.view('users', 'by_email', {
      key: testEmail,
      include_docs: true,
      limit: 1
    });
    
    if (result.rows.length > 0) {
      console.log('✅ Test tutor user already exists');
      return;
    }
    
    // Create test tutor user
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    const tutorUser = {
      type: 'user',
      name: 'Prince Iranzi',
      email: testEmail,
      password: hashedPassword,
      role: 'tutor',
      status: 'active',
      verified: true,
      profile: {
        bio: 'Test tutor user',
        expertise: ['React', 'JavaScript', 'Web Development'],
        location: 'Rwanda',
        website: '',
        socialMedia: {}
      },
      preferences: {
        language: 'en',
        notifications: {
          email: true,
          push: true,
          marketing: false
        },
        accessibility: {
          highContrast: false,
          largeText: false,
          screenReader: false,
          reducedMotion: false
        }
      },
      refreshTokens: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const response = await usersDb.insert(tutorUser);
    console.log('✅ Test tutor user created:', response.id);
    
  } catch (error) {
    console.error('❌ Error creating test tutor user:', error);
  }
}

async function createAdminUser(usersDb) {
  const adminEmail = 'admin@tekriders.com';
  
  try {
    // Check if admin user exists
    const result = await usersDb.view('users', 'by_email', {
      key: adminEmail,
      include_docs: true,
      limit: 1
    });
    
    if (result.rows.length > 0) {
      console.log('✅ Admin user already exists');
      return;
    }
    
    // Create admin user
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    const adminUser = {
      type: 'user',
      name: 'Admin User',
      email: adminEmail,
      password: hashedPassword,
      role: 'admin',
      status: 'active',
      verified: true,
      profile: {
        bio: 'System Administrator',
        expertise: ['System Administration', 'Management'],
        location: 'Rwanda',
        website: '',
        socialMedia: {}
      },
      preferences: {
        language: 'en',
        notifications: {
          email: true,
          push: true,
          marketing: false
        },
        accessibility: {
          highContrast: false,
          largeText: false,
          screenReader: false,
          reducedMotion: false
        }
      },
      refreshTokens: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const response = await usersDb.insert(adminUser);
    console.log('✅ Admin user created:', response.id);
    console.log('📧 Admin credentials: admin@tekriders.com / admin123');
    
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
  }
}

async function checkExistingCourses(coursesDb) {
  try {
    const result = await coursesDb.view('courses', 'all_courses', {
      include_docs: true
    });
    
    console.log(`📚 Found ${result.rows.length} courses in database`);
    
    result.rows.forEach(row => {
      const course = row.doc;
      console.log(`  - ${course.title} (${course.status}) by ${course.instructorName}`);
    });
    
  } catch (error) {
    console.error('❌ Error checking courses:', error);
  }
}

// Run the setup
setupDatabase().catch(console.error); 