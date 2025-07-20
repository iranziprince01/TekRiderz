import React, { useState, useRef } from 'react';
import { Upload, Image, X, Check, AlertCircle, Cloud } from 'lucide-react';
import { Button } from '../ui/Button';

interface CloudinaryImageUploadProps {
  onImageUploaded: (url: string) => void;
  currentImageUrl?: string;
  className?: string;
}

// Cloudinary configuration from environment variables
const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export const CloudinaryImageUpload: React.FC<CloudinaryImageUploadProps> = ({
  onImageUploaded,
  currentImageUrl,
  className = ''
}) => {
  const [uploading, setUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState(currentImageUrl || '');
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if Cloudinary is properly configured
  const isCloudinaryConfigured = CLOUDINARY_CLOUD_NAME && CLOUDINARY_UPLOAD_PRESET;
  
  // Validate Cloudinary configuration on component mount
  React.useEffect(() => {
    if (!isCloudinaryConfigured) {
      console.warn('Cloudinary not configured. Missing VITE_CLOUDINARY_CLOUD_NAME or VITE_CLOUDINARY_UPLOAD_PRESET');
    }
  }, [isCloudinaryConfigured]);

  // Enhanced upload validation
  const validateFile = (file: File): string | null => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      return 'Please select an image file (PNG, JPG, WebP, etc.)';
    }

    // Validate file size (10MB limit for better compatibility)
    if (file.size > 10 * 1024 * 1024) {
      return 'File size must be less than 10MB';
    }

    // Check file extension as additional validation
    const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
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

    try {
      console.log('Starting Cloudinary upload for:', file.name, 'Size:', file.size);

      // Validate file first
      const validationError = validateFile(file);
      if (validationError) {
        throw new Error(validationError);
      }

      // Use backend proxy upload for proper folder control
      const uploadStrategies = [
        // Strategy 1: Backend proxy upload (primary option)
        async () => {
          console.log('Using backend proxy upload for proper folder control...');
          
          const formData = new FormData();
          formData.append('file', file);
          formData.append('type', 'course-thumbnail');
          
          const response = await fetch('/api/v1/upload/cloudinary', {
            method: 'POST',
            body: formData,
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
            }
          });

          if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`Backend upload failed: ${response.status} - ${errorData}`);
          }

          // Backend returns data in a different format
          const result = await response.json();
          if (result.success && result.data) {
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
        },
        // Strategy 2: Direct Cloudinary upload (fallback only)
        async () => {
          if (!isCloudinaryConfigured) {
            throw new Error('Cloudinary not configured');
          }

          const formData = new FormData();
          formData.append('file', file);
          formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
          formData.append('folder', 'tekriders/course-thumbnails');
          formData.append('resource_type', 'image');
          formData.append('quality', 'auto');
          formData.append('fetch_format', 'auto');
          
          const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`Cloudinary upload failed: ${response.status} - ${errorData}`);
          }

          return response;
        },
        // Strategy 3: Local storage fallback with File API
        async () => {
          console.log('Using local storage fallback for thumbnail');
          return await uploadToLocalStorage(file);
        }
      ];

      let lastError: Error | null = null;
      for (const [index, strategy] of uploadStrategies.entries()) {
        try {
          console.log(`Trying upload strategy ${index + 1}...`);
          const response = await strategy();
          
          if (!response.ok && index < 2) {
            throw new Error(`HTTP ${response.status}: ${response.statusText || 'Upload failed'}`);
          }
          
          const data = await response.json();
          console.log(`Strategy ${index + 1} response:`, data);

          if (data.secure_url) {
            let finalUrl = data.secure_url;
            
            // Only apply Cloudinary optimizations for actual Cloudinary URLs
            if (finalUrl.includes('cloudinary.com')) {
              // Apply consistent optimization parameters
              finalUrl = finalUrl.replace(
                '/upload/', 
                '/upload/w_800,h_450,c_fill,q_auto,f_auto,dpr_auto/'
              );
              console.log('Applied Cloudinary optimizations:', finalUrl);
            }
            
            // Validate the URL by attempting to load it
            try {
              await validateImageUrl(finalUrl);
            } catch (validationError) {
              console.warn('Image URL validation failed:', validationError);
              // Continue anyway - don't block upload for validation failures
            }
            
            setImageUrl(finalUrl);
            onImageUploaded(finalUrl);
            console.log(`Upload successful with strategy ${index + 1}`);
            return;
          } else {
            throw new Error(data.error?.message || 'No URL returned from upload service');
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Upload failed';
          console.warn(`Strategy ${index + 1} failed:`, errorMessage);
          lastError = error instanceof Error ? error : new Error(String(error));
          continue;
        }
      }

      throw lastError || new Error('All upload strategies failed');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Upload failed';
      setError(errorMsg);
      console.error('All upload strategies failed:', error);
    } finally {
      setUploading(false);
    }
  };

  // New local storage upload method
  const uploadToLocalStorage = async (file: File): Promise<Response> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        
        // Create a unique identifier for this image
        const imageId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        try {
          // Store in localStorage with a unique key
          localStorage.setItem(`thumbnail_${imageId}`, result);
          
          // Return a response-like object with the data URL
          resolve({
            ok: true,
            json: () => Promise.resolve({
              secure_url: result,
              public_id: imageId,
              format: file.type.split('/')[1] || 'jpg',
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

  // Validate image URL by attempting to load it
  const validateImageUrl = (url: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const img = document.createElement('img');
      img.onload = () => resolve(void 0);
      img.onerror = () => reject(new Error('Image URL validation failed'));
      img.src = url;
      
      // Timeout after 10 seconds
      setTimeout(() => {
        reject(new Error('Image URL validation timeout'));
      }, 10000);
    });
  };

  const uploadAsBase64 = async (file: File) => {
    setUploading(true);
    setError('');

    try {
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

      setImageUrl(result);
      onImageUploaded(result);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (isCloudinaryConfigured) {
      await uploadToCloudinary(file);
    } else {
      await uploadAsBase64(file);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);

    const file = event.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
  };

  const handleUrlSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const url = formData.get('imageUrl') as string;
    
    if (url.trim()) {
      setUploading(true);
      setError('');
      
      try {
        // Validate the URL
        try {
          await validateImageUrl(url.trim());
          setImageUrl(url.trim());
          onImageUploaded(url.trim());
        } catch (validationError) {
          console.warn('URL validation failed:', validationError);
          setError('Invalid image URL or image could not be loaded');
        }
      } catch (error) {
        console.error('Error during URL submission:', error);
        setError('Error processing image URL');
      } finally {
        setUploading(false);
      }
    }
  };

  const removeImage = () => {
    setImageUrl('');
    onImageUploaded('');
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Configuration Status Indicator */}
      {isCloudinaryConfigured ? (
        <div className="flex items-center space-x-2 text-sm text-green-600 bg-green-50 p-2 rounded-md">
          <Cloud className="h-4 w-4" />
          <span>Image upload ready</span>
        </div>
      ) : (
        <div className="flex items-center space-x-2 text-sm text-blue-600 bg-blue-50 p-2 rounded-md">
          <Upload className="h-4 w-4" />
          <span>Upload available</span>
        </div>
      )}

      {/* Current Image Display */}
      {imageUrl && (
        <div className="relative">
          <img
            src={imageUrl}
            alt="Course thumbnail"
            className="w-full h-48 object-cover rounded-lg border-2 border-gray-200"
            onError={() => {
              console.error('Image failed to display:', imageUrl);
              setError('Image failed to load');
            }}
          />
          <button
            onClick={removeImage}
            className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="absolute bottom-2 left-2 px-2 py-1 bg-green-500 text-white text-xs rounded flex items-center">
            <Check className="h-3 w-3 mr-1" />
            Uploaded
          </div>
        </div>
      )}

      {/* Upload Area */}
      {!imageUrl && (
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragOver
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="p-3 bg-gray-100 rounded-full">
                <Image className="h-8 w-8 text-gray-600" />
              </div>
            </div>

            <div>
              <p className="text-gray-600 mb-2">
                Drag and drop an image here, or use the buttons below
              </p>
              <p className="text-sm text-gray-500">
                PNG, JPG, WEBP up to 10MB
              </p>
            </div>

            <Button
              onClick={openFileDialog}
              disabled={uploading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isCloudinaryConfigured ? (
                <Cloud className="h-4 w-4 mr-2" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              {uploading ? 'Uploading...' : 
               isCloudinaryConfigured ? 'Upload to Cloudinary' : 'Choose from Device'}
            </Button>
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* URL Input Alternative */}
      <div className="text-center">
        <p className="text-sm text-gray-500 mb-3">or</p>
        <form onSubmit={handleUrlSubmit} className="flex gap-2">
          <input
            type="url"
            name="imageUrl"
            placeholder="https://example.com/image.jpg"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={uploading}
          />
          <Button
            type="submit"
            variant="outline"
            disabled={uploading}
          >
            Use URL
          </Button>
        </form>
      </div>

      {/* Error Display */}
      {error && (
        <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-md">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Upload Progress */}
      {uploading && (
        <div className="flex items-center space-x-2 text-blue-600 bg-blue-50 p-3 rounded-md">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span className="text-sm">
            {isCloudinaryConfigured ? 'Uploading to Cloudinary...' : 'Processing image...'}
          </span>
        </div>
      )}
    </div>
  );
};

// Extend Window interface for Cloudinary widget
declare global {
  interface Window {
    cloudinary?: {
      openUploadWidget: (config: Record<string, unknown>, callback: (error: unknown, result: unknown) => void) => void;
    };
  }
}

export default CloudinaryImageUpload; 