import React, { useState, useRef } from 'react';
import { Upload, Camera, X, Check, AlertCircle, Cloud, User } from 'lucide-react';
import { Button } from './Button';

interface ProfilePictureUploadProps {
  onImageUploaded: (url: string) => void;
  currentImageUrl?: string;
  userName: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

// Cloudinary configuration from environment variables
const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export const ProfilePictureUpload: React.FC<ProfilePictureUploadProps> = ({
  onImageUploaded,
  currentImageUrl,
  userName,
  className = '',
  size = 'lg'
}) => {
  const [uploading, setUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState(currentImageUrl || '');
  const [error, setError] = useState('');
  const [imageError, setImageError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if Cloudinary is properly configured
  const isCloudinaryConfigured = CLOUDINARY_CLOUD_NAME && CLOUDINARY_UPLOAD_PRESET;

  // Validate Cloudinary configuration on component mount
  React.useEffect(() => {
    console.log('ProfilePictureUpload - Cloud storage check:', {
      CLOUDINARY_CLOUD_NAME: CLOUDINARY_CLOUD_NAME ? 'SET' : 'MISSING',
      CLOUDINARY_UPLOAD_PRESET: CLOUDINARY_UPLOAD_PRESET ? 'SET' : 'MISSING',
      isCloudinaryConfigured,
      actualCloudName: CLOUDINARY_CLOUD_NAME,
      actualPreset: CLOUDINARY_UPLOAD_PRESET
    });
    
    if (!isCloudinaryConfigured) {
      console.warn('Cloud storage not configured. Missing required credentials.');
      setError('Cloud storage unavailable - using offline mode');
    } else {
      setError(''); // Clear any previous errors
      console.log('ProfilePictureUpload - Cloud storage properly configured and ready');
      
      // Test Cloudinary configuration
      testCloudinaryConfig();
    }
  }, [isCloudinaryConfigured]);

  // Test if Cloudinary configuration is working
  const testCloudinaryConfig = async () => {
    try {
      const testUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
      console.log('ProfilePictureUpload - Testing Cloudinary endpoint:', testUrl);
      
      // Make a simple OPTIONS request to test CORS and endpoint availability
      const response = await fetch(testUrl, {
        method: 'OPTIONS',
        mode: 'cors',
        credentials: 'omit'
      });
      
      console.log('ProfilePictureUpload - Cloudinary endpoint test result:', {
        status: response.status,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      });
    } catch (error) {
      console.warn('ProfilePictureUpload - Cloudinary endpoint test failed:', error);
      // Don't show error to user for this test
    }
  };

  // Size configurations
  const sizeClasses = {
    sm: 'w-16 h-16 text-lg',
    md: 'w-24 h-24 text-2xl',
    lg: 'w-32 h-32 text-4xl'
  };

  // Get user initials for fallback
  const getUserInitials = (name: string): string => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Enhanced upload validation for profile pictures
  const validateFile = (file: File): string | null => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      return 'Please select an image file (PNG, JPG, WebP, etc.)';
    }

    // Validate file size (5MB limit for profile pictures)
    if (file.size > 5 * 1024 * 1024) {
      return 'File size must be less than 5MB';
    }

    // Check file extension
    const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const fileName = file.name.toLowerCase();
    const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext));
    
    if (!hasValidExtension) {
      return 'File must have a valid image extension (.jpg, .png, .gif, .webp)';
    }

    return null;
  };

  const uploadToCloudinary = async (file: File) => {
    setUploading(true);
    setError('');
    setImageError(false);

    try {
      console.log('ProfilePictureUpload - Starting upload for:', file.name, 'Size:', file.size);
      console.log('ProfilePictureUpload - Cloudinary configured:', isCloudinaryConfigured);

      // Validate file first
      const validationError = validateFile(file);
      if (validationError) {
        throw new Error(validationError);
      }

      // Try Cloudinary upload strategies - ONLY backend proxy for profile pictures
      // Direct Cloudinary upload won't work due to preset's default folder configuration
      const uploadStrategies = [
        // Strategy 1: Backend proxy upload (ONLY option for profile pictures)
        async () => {
          console.log('ProfilePictureUpload - Using backend proxy upload (required for correct folder routing)');
          
          const formData = new FormData();
          formData.append('file', file);
          formData.append('type', 'profile-picture');
          
          const response = await fetch('/api/v1/upload/cloudinary', {
            method: 'POST',
            body: formData,
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
            }
          });

          if (!response.ok) {
            const errorData = await response.text();
            console.error('ProfilePictureUpload - Backend upload failed:', response.status, errorData);
            throw new Error(`Backend upload failed: ${response.status} - ${errorData}`);
          }

          const result = await response.json();
          if (result.success && result.data) {
            console.log('ProfilePictureUpload - Backend proxy upload successful');
            return {
              ok: true,
              json: () => Promise.resolve({
                secure_url: result.data.secure_url,
                public_id: result.data.public_id
              })
            } as Response;
          } else {
            throw new Error(result.error || 'Backend upload failed');
          }
        }
        // NO Strategy 2 - Direct Cloudinary upload removed because preset has default folder
        // NO Strategy 3 - Local storage removed from Cloudinary upload path
      ];

      let lastError: Error | null = null;
      let cloudinaryAttempted = false;
      
      for (const [index, strategy] of uploadStrategies.entries()) {
        try {
          console.log(`ProfilePictureUpload - Executing strategy ${index + 1}...`);
          cloudinaryAttempted = true;
          const response = await strategy();
          const data = await response.json();
          
          console.log(`ProfilePictureUpload - Strategy ${index + 1} response:`, data);

          if (data.secure_url) {
            let finalUrl = data.secure_url;
            
            // Apply profile picture optimizations for Cloudinary URLs
            if (finalUrl.includes('cloudinary.com') && !finalUrl.includes('/upload/w_')) {
              finalUrl = finalUrl.replace(
                '/upload/', 
                '/upload/w_400,h_400,c_fill,g_face,q_auto,f_auto,dpr_auto/'
              );
              console.log('ProfilePictureUpload - Applied Cloudinary optimizations:', finalUrl);
            }
            
            setImageUrl(finalUrl);
            onImageUploaded(finalUrl);
            console.log(`ProfilePictureUpload - Upload successful with strategy ${index + 1}`);
            return;
          } else {
            throw new Error(data.error?.message || 'No URL returned from upload service');
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Upload failed';
          console.warn(`ProfilePictureUpload - Strategy ${index + 1} failed:`, errorMessage);
          lastError = error instanceof Error ? error : new Error(String(error));
          continue;
        }
      }

      // If we get here, all Cloudinary strategies failed
      if (cloudinaryAttempted && lastError) {
        console.error('ProfilePictureUpload - All cloud storage strategies failed:', lastError);
        throw new Error(`Cloud storage upload failed: ${lastError.message}`);
      } else {
        throw new Error('No upload strategies available');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Upload failed';
      console.error('ProfilePictureUpload - All upload strategies failed:', error);
      // Don't set error here - let the calling method handle it
      throw error; // Re-throw to let handleFileUpload handle the error display
    } finally {
      setUploading(false);
    }
  };

  // Local storage upload method for fallback
  const uploadToLocalStorage = async (file: File): Promise<Response> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const imageId = `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        try {
          localStorage.setItem(`profile_${imageId}`, result);
          resolve({
            ok: true,
            json: () => Promise.resolve({
              secure_url: result,
              public_id: imageId,
              local: true
            })
          } as Response);
        } catch (storageError) {
          reject(new Error('Local storage failed - storage may be full'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  // Main file upload handler that chooses the right strategy
  const handleFileUpload = async (file: File) => {
    console.log('ProfilePictureUpload - handleFileUpload called with:', file.name);
    console.log('ProfilePictureUpload - isCloudinaryConfigured:', isCloudinaryConfigured);
    
    // Clear any previous errors
    setError('');
    
    if (isCloudinaryConfigured) {
      console.log('ProfilePictureUpload - Using ONLY cloud storage strategies (no local fallback)');
      try {
        await uploadToCloudinary(file);
      } catch (error) {
        // Show the actual Cloudinary error, don't fall back to local storage
        const errorMsg = error instanceof Error ? error.message : 'Cloud storage upload failed';
        console.error('ProfilePictureUpload - Cloud storage failed:', error);
        setError(`Upload failed: ${errorMsg}`);
      }
    } else {
      console.log('ProfilePictureUpload - Cloud storage not configured, using offline storage only');
      await uploadAsBase64(file);
    }
  };

  // Base64 upload method for when Cloudinary is not available
  const uploadAsBase64 = async (file: File) => {
    setUploading(true);
    setError('');
    setImageError(false);

    try {
      console.log('ProfilePictureUpload - Starting base64 upload for:', file.name);
      
      // Validate file first
      const validationError = validateFile(file);
      if (validationError) {
        throw new Error(validationError);
      }

      // Convert to base64
      const result = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result;
          if (typeof result === 'string') {
            resolve(result);
          } else {
            reject(new Error('File read result was not a string'));
          }
        };
        reader.onerror = () => {
          reject(new Error('Failed to read file'));
        };
        reader.readAsDataURL(file);
      });

      console.log('ProfilePictureUpload - Base64 conversion successful');
      setImageUrl(result);
      onImageUploaded(result);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Base64 upload failed';
      console.error('ProfilePictureUpload - Base64 upload failed:', error);
      setError(errorMsg);
    } finally {
      setUploading(false);
    }
  };

  const removeImage = () => {
    setImageUrl('');
    setImageError(false);
    onImageUploaded('');
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  const handleImageError = () => {
    setImageError(true);
  };

  // Handle drag and drop
  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
  };

  const displayImage = imageUrl && !imageError;

  return (
    <div className={`relative ${className}`}>
      {/* Profile Picture Display */}
      <div className={`relative ${sizeClasses[size]} rounded-full overflow-hidden border-4 border-white shadow-lg bg-gradient-to-br from-blue-400 to-blue-600`}>
        {displayImage ? (
          <img
            src={imageUrl}
            alt={`${userName}'s profile picture`}
            className="w-full h-full object-cover"
            onError={handleImageError}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white font-bold">
            {getUserInitials(userName || 'User')}
          </div>
        )}
        
        {/* Upload Overlay */}
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
             onClick={openFileDialog}
             onDrop={handleDrop}
             onDragOver={handleDragOver}
             onDragLeave={handleDragLeave}>
          <div className="text-center text-white">
            <Camera className="w-6 h-6 mx-auto mb-1" />
            <span className="text-xs font-medium">
              {uploading ? 'Uploading...' : 'Change'}
            </span>
          </div>
        </div>
        
        {/* Upload Progress Indicator */}
        {uploading && (
          <div className="absolute inset-0 bg-blue-600 bg-opacity-75 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          </div>
        )}
        
        {/* Success Indicator */}
        {displayImage && !uploading && (
          <div className="absolute top-1 right-1 bg-green-500 rounded-full p-1">
            <Check className="w-3 h-3 text-white" />
          </div>
        )}
      </div>

      {/* Remove Button */}
      {displayImage && !uploading && (
        <button
          onClick={removeImage}
          className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-lg transition-colors"
          title="Remove profile picture"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Upload Button (Alternative) */}
      <div className="mt-4 text-center">
        <Button
          onClick={openFileDialog}
          disabled={uploading}
          variant="outline"
          size="sm"
          className="text-xs"
        >
          {isCloudinaryConfigured ? (
            <Cloud className="w-3 h-3 mr-1" />
          ) : (
            <Upload className="w-3 h-3 mr-1" />
          )}
          {uploading ? 'Uploading...' : 'Choose Photo'}
        </Button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mt-2 flex items-center space-x-1 text-red-600 text-xs">
          <AlertCircle className="h-3 w-3" />
          <span>{error}</span>
        </div>
      )}

      {/* Configuration Status */}
      {isCloudinaryConfigured ? (
        <div className="mt-2 text-xs text-gray-600 text-center">
          Cloud storage ready
        </div>
      ) : (
        <div className="mt-2 text-xs text-gray-500 text-center">
          Offline mode
        </div>
      )}
    </div>
  );
};

export default ProfilePictureUpload; 