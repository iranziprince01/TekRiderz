// Robust PouchDB initialization with error handling
let localDB: any = null;

// Initialize PouchDB asynchronously
const initializePouchDB = async () => {
  try {
    // Dynamic import to avoid issues during build
    const PouchDB = await import('pouchdb-browser');
    
    // Initialize with error handling
    if (typeof PouchDB.default === 'function') {
      localDB = new PouchDB.default('eLearning_local');
      console.log('✅ PouchDB initialized successfully');
    } else {
      console.error('❌ PouchDB is not a constructor');
      throw new Error('PouchDB initialization failed');
    }
  } catch (error) {
    console.error('❌ Failed to initialize PouchDB:', error);
    
    // Fallback: Create a mock database for basic functionality
    localDB = {
      name: 'eLearning_local_fallback',
      put: async () => ({ ok: true, id: 'mock' }),
      get: async () => ({ _id: 'mock', type: 'mock' }),
      allDocs: async () => ({ rows: [] }),
      remove: async () => ({ ok: true }),
      info: async () => ({ db_name: 'fallback' })
    };
    console.log('⚠️ Using fallback database - offline features limited');
  }
};

// Initialize immediately
initializePouchDB();

export { localDB };
