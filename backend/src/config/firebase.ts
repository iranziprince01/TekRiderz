import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import { getAuth } from 'firebase-admin/auth';

// Firebase Admin SDK configuration
const firebaseConfig = {
  type: process.env.FIREBASE_TYPE || 'service_account',
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: process.env.FIREBASE_AUTH_URI || 'https://accounts.google.com/o/oauth2/auth',
  token_uri: process.env.FIREBASE_TOKEN_URI || 'https://oauth2.googleapis.com/token',
  auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL || 'https://www.googleapis.com/oauth2/v1/certs',
  client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
  universe_domain: process.env.FIREBASE_UNIVERSE_DOMAIN || 'googleapis.com'
};

// Initialize Firebase Admin SDK
let firebaseApp: any;
let firebaseStorage: any;
let firebaseAuth: any;
let bucket: any;

try {
  // Check if Firebase is already initialized
  if (getApps().length === 0) {
    const appOptions: any = {
      credential: cert(firebaseConfig as any)
    };
    
    // Add storage bucket if configured
    if (process.env.FIREBASE_STORAGE_BUCKET) {
      appOptions.storageBucket = process.env.FIREBASE_STORAGE_BUCKET;
    }
    
    firebaseApp = initializeApp(appOptions);
  } else {
    firebaseApp = getApps()[0];
  }

  // Initialize Firebase services
  firebaseStorage = getStorage(firebaseApp);
  firebaseAuth = getAuth(firebaseApp);

  // Get the default bucket
  bucket = firebaseStorage.bucket();
  
  console.log('✅ Firebase initialized successfully');
  console.log('📦 Storage bucket:', bucket.name);
  
} catch (error) {
  console.error('❌ Firebase initialization failed:', (error as Error).message);
  
  // Set to null to prevent crashes
  firebaseApp = null;
  firebaseStorage = null;
  firebaseAuth = null;
  bucket = null;
}

export { firebaseStorage, firebaseAuth, bucket };
export default firebaseApp; 