import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';
import multer, { FileFilterCallback } from 'multer';
import FormData from 'form-data';
import fetch from 'node-fetch';
import crypto from 'crypto';

// Cloudinary configuration - using import instead of require
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary with credentials from environment
if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
} else {
  console.error('Cloudinary configuration missing. Please check your environment variables.');
}

// Upload preset mapping - use different presets for different content types
const UPLOAD_PRESET_MAP = {
  'course-thumbnail': process.env.CLOUDINARY_UPLOAD_PRESET, // tekriders-uploads (has default folder)
  'profile-picture': process.env.CLOUDINARY_UPLOAD_PRESET, // We'll override folder for this
  'user-avatar': process.env.CLOUDINARY_UPLOAD_PRESET,
  'course-material': process.env.CLOUDINARY_UPLOAD_PRESET,
  'general': process.env.CLOUDINARY_UPLOAD_PRESET
};

// Folder mapping for different content types
const folderMap = {
  'course-thumbnail': 'tekriders/course-thumbnails',
  'profile-picture': 'tekriders/profile-pictures',
  'user-avatar': 'tekriders/user-avatars',
  'course-material': 'tekriders/course-materials',
  'general': 'tekriders/general'
};

const router = Router();

// Configure multer for memory storage
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    // Check file type
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Cloudinary upload proxy endpoint
router.post('/cloudinary', authenticate, upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        error: 'No file provided'
      });
      return;
    }

    const { type = 'course-thumbnail' } = req.body;

    // Check if Cloudinary is configured
    const cloudinaryUrl = process.env.CLOUDINARY_URL;
    if (!cloudinaryUrl) {
      logger.warn('Cloudinary not configured, falling back to local storage');
      res.status(400).json({
        success: false,
        error: 'Cloudinary not configured on server'
      });
      return;
    }

    // Parse Cloudinary URL to extract credentials
    const cloudinaryConfig = parseCloudinaryUrl(cloudinaryUrl);
    if (!cloudinaryConfig) {
      logger.error('Invalid CLOUDINARY_URL format');
      res.status(500).json({
        success: false,
        error: 'Invalid Cloudinary configuration'
      });
      return;
    }

    // Upload to Cloudinary
    const result = await uploadToCloudinary(req.file, cloudinaryConfig, type);

    logger.info('File uploaded to Cloudinary successfully', {
      publicId: result.public_id,
      secureUrl: result.secure_url,
      userId: req.user?.id,
      fileType: type
    });

    res.json({
      success: true,
      data: {
        secure_url: result.secure_url,
        public_id: result.public_id,
        format: result.format,
        width: result.width,
        height: result.height,
        bytes: result.bytes,
        url: result.url
      }
    });

  } catch (error) {
    logger.error('Cloudinary upload failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed'
    });
  }
});

// Local file upload fallback endpoint
router.post('/local', authenticate, upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        error: 'No file provided'
      });
      return;
    }

    const { type = 'course-thumbnail' } = req.body;

    logger.info('Local file upload request:', {
      filename: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      userId: req.user?.id,
      type
    });

    // Validate file type
    if (!req.file.mimetype.startsWith('image/')) {
      res.status(400).json({
        success: false,
        error: 'Only image files are allowed for local upload'
      });
      return;
    }

    // Convert to base64 for storage
    const base64Data = req.file.buffer.toString('base64');
    const dataUrl = `data:${req.file.mimetype};base64,${base64Data}`;

    // Create a unique identifier
    const fileId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    logger.info('Local file converted to base64:', {
      fileId,
      originalSize: req.file.size,
      base64Size: base64Data.length,
      userId: req.user?.id
    });

    res.json({
      success: true,
      data: {
        secure_url: dataUrl,
        public_id: fileId,
        format: req.file.mimetype.split('/')[1],
        width: null, // Not available for base64
        height: null, // Not available for base64
        bytes: req.file.size,
        url: dataUrl,
        local: true,
        upload_type: 'local_fallback'
      }
    });

  } catch (error) {
    logger.error('Local file upload failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Local upload failed'
    });
  }
});

// Helper function to parse CLOUDINARY_URL
function parseCloudinaryUrl(cloudinaryUrl: string) {
  try {
    // Format: cloudinary://api_key:api_secret@cloud_name
    const url = new URL(cloudinaryUrl);
    
    if (url.protocol !== 'cloudinary:') {
      return null;
    }

    return {
      cloud_name: url.hostname,
      api_key: url.username,
      api_secret: url.password
    };
  } catch (error) {
    logger.error('Failed to parse CLOUDINARY_URL:', error);
    return null;
  }
}

// Cloudinary response interface
interface CloudinaryResponse {
  public_id: string;
  secure_url: string;
  url: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
}

// Helper function to upload to Cloudinary
async function uploadToCloudinary(file: Express.Multer.File, config: any, type: string): Promise<CloudinaryResponse> {
  const formData = new FormData();
  formData.append('file', file.buffer, {
    filename: file.originalname,
    contentType: file.mimetype
  });

  // Determine folder based on type
  const folder = folderMap[type as keyof typeof folderMap] || folderMap['general'];
  
  // Special handling for profile pictures to ensure correct folder routing
  if (type === 'profile-picture') {
    console.log('Profile picture upload detected - Ensuring correct folder routing');
    console.log('Profile picture upload - Type:', type);
    console.log('Profile picture upload - Mapped folder:', folder);
    console.log('Profile picture upload - Expected folder: tekriders/profile-pictures');
    
    // Double-check the folder mapping
    if (folder !== 'tekriders/profile-pictures') {
      console.error('Profile picture folder mapping error! Expected: tekriders/profile-pictures, Got:', folder);
    }
  }

  // Add Cloudinary parameters
  formData.append('timestamp', Math.round(Date.now() / 1000));
  formData.append('folder', folder);
  formData.append('resource_type', 'image');
  formData.append('quality', 'auto');
  formData.append('fetch_format', 'auto');
  formData.append('dpr', 'auto');

  // Generate signature for authenticated upload
  const timestamp = Math.round(Date.now() / 1000);
  
  // For signed uploads, only include essential parameters in signature
  // Cloudinary signature should only include parameters that affect the upload
  const signatureParams = {
    folder: folder,
    timestamp: timestamp
  };
  
  // Sort parameters alphabetically for consistent signature
  const sortedParams = Object.keys(signatureParams)
    .sort()
    .map(key => `${key}=${signatureParams[key as keyof typeof signatureParams]}`)
    .join('&');
  
  const stringToSign = `${sortedParams}${config.api_secret}`;
  const signature = crypto.createHash('sha1').update(stringToSign).digest('hex');

  console.log('Backend upload - Profile picture folder routing:', {
    type,
    folder,
    targetFolder: folder,
    usingSignedUpload: true,
    timestamp,
    signatureLength: signature.length
  });

  console.log('Backend upload signature generation:', {
    type,
    folder,
    timestamp,
    signatureParams: Object.keys(signatureParams),
    sortedParams,
    stringToSign: `${sortedParams}[API_SECRET]`,
    signature
  });

  formData.append('api_key', config.api_key);
  formData.append('signature', signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${config.cloud_name}/image/upload`, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Cloudinary upload failed: ${response.status} - ${errorText}`);
  }

  return await response.json() as CloudinaryResponse;
}

export default router; 