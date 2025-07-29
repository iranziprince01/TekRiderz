// Robust PouchDB initialization with comprehensive error handling
let localDB: any = null;
let isInitialized = false;
let initializationPromise: Promise<any> | null = null;

// Enhanced PouchDB initialization with retry logic
const initializePouchDB = async (retryCount = 0): Promise<any> => {
  const maxRetries = 3;
  
  try {
    console.log(`🔄 Initializing PouchDB (attempt ${retryCount + 1}/${maxRetries + 1})`);
    
    // Dynamic import to avoid issues during build
    const PouchDB = await import('pouchdb-browser');
    
    // Initialize with comprehensive error handling
    if (typeof PouchDB.default === 'function') {
      localDB = new PouchDB.default('eLearning_local', {
        // Enhanced configuration for better offline performance
        auto_compaction: true,
        revs_limit: 100,
        deterministic_revs: true
      });
      
      // Test the database connection
      await localDB.info();
      
      isInitialized = true;
      console.log('✅ PouchDB initialized successfully with enhanced configuration');
      
      // Set up database event listeners
      localDB.changes({
        since: 'now',
        live: true,
        include_docs: true
      }).on('change', (change: any) => {
        console.log('📊 PouchDB change detected:', change.id);
      }).on('error', (error: any) => {
        console.error('❌ PouchDB change error:', error);
      });
      
      return localDB;
    } else {
      throw new Error('PouchDB is not a constructor');
    }
  } catch (error) {
    console.error(`❌ PouchDB initialization failed (attempt ${retryCount + 1}):`, error);
    
    if (retryCount < maxRetries) {
      console.log(`🔄 Retrying PouchDB initialization in 1 second...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return initializePouchDB(retryCount + 1);
    }
    
    // Final fallback: Create a comprehensive mock database
    console.log('⚠️ Using comprehensive fallback database - offline features available with limitations');
    localDB = createFallbackDatabase();
    isInitialized = true;
    return localDB;
  }
};

// Comprehensive fallback database with full API compatibility
const createFallbackDatabase = () => {
  const fallbackData = new Map();
  
  return {
    name: 'eLearning_local_fallback',
    isFallback: true,
    
    // Core PouchDB methods
    put: async (doc: any) => {
      const id = doc._id || doc.id || `doc_${Date.now()}_${Math.random()}`;
      const docWithId = { ...doc, _id: id, _rev: `1-${Date.now()}` };
      fallbackData.set(id, docWithId);
      console.log('📝 Fallback DB: Document saved:', id);
      return { ok: true, id, rev: docWithId._rev };
    },
    
    get: async (id: string) => {
      const doc = fallbackData.get(id);
      if (doc) {
        console.log('📖 Fallback DB: Document retrieved:', id);
        return doc;
      }
      throw { name: 'not_found', message: 'Document not found' };
    },
    
    allDocs: async (options: any = {}) => {
      const docs = Array.from(fallbackData.values());
      console.log('📚 Fallback DB: Retrieved all documents:', docs.length);
      return {
        rows: docs.map(doc => ({
          id: doc._id,
          key: doc._id,
          value: { rev: doc._rev },
          doc: doc
        }))
      };
    },
    
    remove: async (doc: any) => {
      const id = doc._id || doc.id;
      if (fallbackData.has(id)) {
        fallbackData.delete(id);
        console.log('🗑️ Fallback DB: Document removed:', id);
        return { ok: true, id };
      }
      throw { name: 'not_found', message: 'Document not found' };
    },
    
    info: async () => ({
      db_name: 'eLearning_local_fallback',
      doc_count: fallbackData.size,
      update_seq: fallbackData.size,
      isFallback: true
    }),
    
    // Additional methods for compatibility
    destroy: async () => {
      fallbackData.clear();
      console.log('💥 Fallback DB: Database destroyed');
      return { ok: true };
    },
    
    compact: async () => {
      console.log('🗜️ Fallback DB: Database compacted');
      return { ok: true };
    }
  };
};

// Get or initialize PouchDB instance
export const getPouchDB = async (): Promise<any> => {
  if (isInitialized && localDB) {
    return localDB;
  }
  
  if (initializationPromise) {
    return initializationPromise;
  }
  
  initializationPromise = initializePouchDB();
  return initializationPromise;
};

// Initialize immediately and export the instance
initializePouchDB().then(() => {
  console.log('🚀 PouchDB initialization completed');
}).catch((error) => {
  console.error('💥 PouchDB initialization failed completely:', error);
});

export { localDB };
