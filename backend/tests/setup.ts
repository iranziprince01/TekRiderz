import dotenv from 'dotenv';

// Load environment variables for testing
dotenv.config({ path: '.env.test' });

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
process.env.CLOUDINARY_API_KEY = 'test-api-key';
process.env.CLOUDINARY_API_SECRET = 'test-api-secret';
process.env.FIREBASE_PROJECT_ID = 'test-project';
process.env.FIREBASE_PRIVATE_KEY = 'test-private-key';
process.env.FIREBASE_CLIENT_EMAIL = 'test@test.com';

// Mock external services
jest.mock('../src/config/firebase', () => ({
  auth: {
    verifyIdToken: jest.fn().mockResolvedValue({
      uid: 'test-uid',
      email: 'test@example.com'
    })
  },
  storage: {
    bucket: jest.fn().mockReturnValue({
      file: jest.fn().mockReturnValue({
        save: jest.fn().mockResolvedValue([{ publicUrl: 'https://test.com/file.pdf' }]),
        getSignedUrl: jest.fn().mockResolvedValue(['https://test.com/signed-url'])
      })
    })
  }
}));

jest.mock('../src/services/emailService', () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
  sendWelcomeEmail: jest.fn().mockResolvedValue(true)
}));

jest.mock('../src/config/database', () => ({
  connectToDatabases: jest.fn().mockResolvedValue(true),
  databases: {
    users: {
      insert: jest.fn(),
      get: jest.fn(),
      view: jest.fn(),
      find: jest.fn(),
      list: jest.fn(),
      destroy: jest.fn(),
      info: jest.fn().mockResolvedValue({ doc_count: 0 })
    },
    courses: {
      insert: jest.fn(),
      get: jest.fn(),
      view: jest.fn(),
      find: jest.fn(),
      list: jest.fn(),
      destroy: jest.fn(),
      info: jest.fn().mockResolvedValue({ doc_count: 0 })
    },
    enrollments: {
      insert: jest.fn(),
      get: jest.fn(),
      view: jest.fn(),
      find: jest.fn(),
      list: jest.fn(),
      destroy: jest.fn(),
      info: jest.fn().mockResolvedValue({ doc_count: 0 })
    },
    progress: {
      insert: jest.fn(),
      get: jest.fn(),
      view: jest.fn(),
      find: jest.fn(),
      list: jest.fn(),
      destroy: jest.fn(),
      info: jest.fn().mockResolvedValue({ doc_count: 0 })
    },
    otp: {
      insert: jest.fn(),
      get: jest.fn(),
      view: jest.fn(),
      find: jest.fn(),
      list: jest.fn(),
      destroy: jest.fn(),
      info: jest.fn().mockResolvedValue({ doc_count: 0 })
    }
  }
}));

// Global test timeout
jest.setTimeout(30000);

// Suppress console logs during tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}; 