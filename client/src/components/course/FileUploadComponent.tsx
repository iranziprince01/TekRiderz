import React, { useState, useRef } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { Alert } from '../ui/Alert';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { apiClient } from '../../utils/api';
import { 
  Upload, 
  X, 
  FileImage, 
  FileVideo, 
  CheckCircle, 
  AlertCircle,
  Download,
  Eye,
  FileText
} from 'lucide-react';

interface FileUploadComponentProps {
  fileType: 'thumbnail' | 'video' | 'document' | 'material';
  entityType?: 'course' | 'user' | 'lesson';
  entityId?: string;
  currentFileUrl?: string;
  onFileUploaded?: (fileData: {
    fileId: string;
    filename: string;
    url: string;
    size: number;
    type: string;
  }) => void;
  onFileDeleted?: () => void;
  maxSize?: number; // in MB
  allowedTypes?: string[];
  className?: string;
}

export const FileUploadComponent: React.FC<FileUploadComponentProps> = ({
  fileType,
  entityType = 'course',
  entityId,
  currentFileUrl,
  onFileUploaded,
  onFileDeleted,
  maxSize = 50, // 50MB default
  allowedTypes = fileType === 'thumbnail' 
    ? ['image/jpeg', 'image/png', 'image/webp'] 
    : fileType === 'video' 
    ? ['video/mp4', 'video/webm'] 
    : fileType === 'document' || fileType === 'material'
    ? ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'text/plain', 'image/jpeg', 'image/png']
    : [],
  className = ''
}) => {
  const { user, token } = useAuth();
  const { language } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [currentFile, setCurrentFile] = useState<{
    fileId: string;
    filename: string;
    url: string;
    size: number;
    type: string;
  } | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!allowedTypes.includes(file.type)) {
      setError(language === 'rw' 
        ? `Ubwoko bwa dosiye ntibwemewe. Gukoresha: ${allowedTypes.join(', ')}`
        : `Invalid file type. Please use: ${allowedTypes.join(', ')}`
      );
      return;
    }

    // Validate file size
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxSize) {
      setError(language === 'rw' 
        ? `Dosiye ni nini cyane. Ubunini bwemewe: ${maxSize}MB`
        : `File too large. Maximum size: ${maxSize}MB`
      );
      return;
    }

    setError('');
    uploadFile(file);
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    setUploadProgress(0);
    setError('');

    try {
      const formData = new FormData();
      formData.append(fileType, file);
      
      if (entityId) {
        if (fileType === 'material') {
          formData.append('lessonId', entityId);
        } else {
        formData.append('courseId', entityId);
        }
      }

      // Use the appropriate upload endpoint
      const endpointMap = {
        'thumbnail': '/api/v1/upload/thumbnail',
        'video': '/api/v1/upload/video',
        'document': '/api/v1/upload/document',
        'material': '/api/v1/upload/material'
      };
      
      const endpoint = endpointMap[fileType];
      
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${token || ''}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const result = await response.json();
      
      if (result.success) {
        const fileData = {
          fileId: result.data.fileId,
          filename: result.data.filename,
          url: result.data.url,
          size: result.data.size,
          type: result.data.type,
        };
        
        setCurrentFile(fileData);
        onFileUploaded?.(fileData);
        
        // Clear file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (error: any) {
      setError(error.message || 'Upload failed');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDeleteFile = async () => {
    if (!currentFile) return;

    try {
      const baseUrl = import.meta.env.VITE_API_URL || '/api/v1';
      const response = await fetch(`${baseUrl}/upload/file/${currentFile.fileId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token || ''}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setCurrentFile(null);
        onFileDeleted?.();
      } else {
        throw new Error(result.error || 'Delete failed');
      }
    } catch (error: any) {
      setError(error.message || 'Delete failed');
    }
  };

  const getFileIcon = () => {
    if (fileType === 'thumbnail') {
      return <FileImage className="w-8 h-8 text-blue-500" />;
    }
    if (fileType === 'video') {
    return <FileVideo className="w-8 h-8 text-purple-500" />;
    }
    if (fileType === 'document') {
      return <FileText className="w-8 h-8 text-green-500" />;
    }
    if (fileType === 'material') {
      return <FileText className="w-8 h-8 text-orange-500" />;
    }
    return <FileText className="w-8 h-8 text-gray-500" />;
  };

  const getFileTypeName = () => {
    const names = {
      'thumbnail': language === 'rw' ? 'Ifoto ntoya' : 'Thumbnail',
      'video': language === 'rw' ? 'Video' : 'Video',
      'document': language === 'rw' ? 'Inyandiko' : 'Document',
      'material': language === 'rw' ? 'Ibikoresho' : 'Material'
    };
    return names[fileType] || 'File';
  };

  const getAcceptedFormats = () => {
    const formats = {
      'thumbnail': 'JPG, PNG, WebP',
      'video': 'MP4, WebM',
      'document': 'PDF, Word, PowerPoint, Text',
      'material': 'PDF, Word, PowerPoint, Images, Text'
    };
    return formats[fileType] || 'Various formats';
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <Card className={`p-4 ${className}`}>
      <div className="space-y-4">
          <div className="flex items-center space-x-2">
            {getFileIcon()}
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">
              {getFileTypeName()}
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              {getAcceptedFormats()} - Max {maxSize}MB
            </p>
          </div>
        </div>

        {(currentFile || currentFileUrl) && (
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {currentFile?.filename || 'Current file'}
                  </p>
                  {currentFile?.size && (
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {formatFileSize(currentFile.size)}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(currentFile?.url || currentFileUrl, '_blank')}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  {language === 'rw' ? 'Kureba' : 'View'}
                </Button>
                {currentFile && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDeleteFile}
                    className="text-red-600 hover:text-red-700"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Upload Area */}
        <div className="space-y-4">
          <div
            className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={allowedTypes.join(',')}
              onChange={handleFileSelect}
              className="hidden"
              disabled={uploading}
            />
            
            {uploading ? (
              <div className="space-y-2">
                <LoadingSpinner size="lg" />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {language === 'rw' ? 'Birimo koherezwa...' : 'Uploading...'}
                </p>
                {uploadProgress > 0 && (
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="w-8 h-8 text-gray-400 mx-auto" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {language === 'rw' ? 'Kanda hano cyangwa sureruza dosiye' : 'Click here or drag and drop'}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {language === 'rw' 
                      ? `Ubwoko bwemewe: ${getAcceptedFormats()} (Max: ${maxSize}MB)`
                      : `Supported formats: ${getAcceptedFormats()} (Max: ${maxSize}MB)`
                    }
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <Alert variant="error">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </Alert>
          )}
        </div>
      </div>
    </Card>
  );
};

export default FileUploadComponent; 