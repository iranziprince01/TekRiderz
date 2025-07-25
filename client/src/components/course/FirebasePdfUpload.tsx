import React, { useState, useRef } from 'react';
import { Upload, FileText, X, Check, AlertCircle, Download } from 'lucide-react';
import { Button } from '../ui/Button';

interface FirebasePdfUploadProps {
  onPdfUploaded: (url: string, filePath: string) => void;
  currentPdfUrl?: string;
  currentFilePath?: string;
  courseId: string; // Required for module PDFs
  moduleId: string; // Required for module PDFs
  className?: string;
}

export const FirebasePdfUpload: React.FC<FirebasePdfUploadProps> = ({
  onPdfUploaded,
  currentPdfUrl,
  currentFilePath,
  courseId,
  moduleId,
  className = ''
}) => {
  const [uploading, setUploading] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(currentPdfUrl || '');
  const [filePath, setFilePath] = useState(currentFilePath || '');
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Enhanced upload validation for PDFs
  const validateFile = (file: File): string | null => {
    // Validate file type
    if (file.type !== 'application/pdf') {
      return 'Please select a PDF file';
    }

    // Validate file size (25MB limit for PDFs)
    if (file.size > 25 * 1024 * 1024) {
      return 'File size must be less than 25MB';
    }

    // Check file extension as additional validation
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.pdf')) {
      return 'File must have a .pdf extension';
    }

    return null;
  };

  const uploadToFirebase = async (file: File) => {
    setUploading(true);
    setError('');

    try {
      console.log('Starting Firebase PDF upload for:', file.name, 'Size:', file.size);

      // Validate file first
      const validationError = validateFile(file);
      if (validationError) {
        throw new Error(validationError);
      }

      // Create form data
      const formData = new FormData();
      formData.append('file', file);
      formData.append('courseId', courseId);
      formData.append('moduleId', moduleId);

      // Upload to Firebase via backend
      const response = await fetch('/api/v1/firebase-pdf/upload', {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        }
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Upload failed: ${response.status} - ${errorData}`);
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        const { url, filePath: uploadedFilePath } = result.data;
        
        setPdfUrl(url);
        setFilePath(uploadedFilePath);
        onPdfUploaded(url, uploadedFilePath);
        console.log('Firebase PDF upload successful:', { url, filePath: uploadedFilePath });
      } else {
        throw new Error(result.error || 'Upload failed');
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Upload failed';
      setError(errorMsg);
      console.error('Firebase PDF upload failed:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    await uploadToFirebase(file);
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

  const removePdf = () => {
    setPdfUrl('');
    setFilePath('');
    onPdfUploaded('', '');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  const openPdfInNewTab = () => {
    if (pdfUrl) {
      window.open(pdfUrl, '_blank');
    }
  };

  const downloadPdf = async () => {
    if (!filePath) return;

    try {
      const response = await fetch('/api/v1/firebase-pdf/download-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify({ filePath })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data.url) {
          // Create a temporary link to download the file
          const link = document.createElement('a');
          link.href = result.data.url;
          link.download = 'document.pdf';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      }
    } catch (error) {
      console.error('Failed to download PDF:', error);
      // Fallback to opening in new tab
      openPdfInNewTab();
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Error Display */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
          <span className="text-red-700 dark:text-red-300 text-sm">{error}</span>
          <button
            onClick={() => setError('')}
            className="ml-auto text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Current PDF Display */}
      {pdfUrl && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="w-6 h-6 text-green-600 dark:text-green-400" />
              <div>
                <p className="text-green-800 dark:text-green-200 font-medium">PDF Notes Uploaded</p>
                <p className="text-green-600 dark:text-green-400 text-sm">Lecture notes are ready for students</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={openPdfInNewTab}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Preview
              </Button>
              <Button
                onClick={downloadPdf}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download
              </Button>
              <Button
                onClick={removePdf}
                variant="outline"
                size="sm"
                className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Area */}
      {!pdfUrl && (
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragOver
              ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-full">
                <FileText className="w-8 h-8 text-gray-600 dark:text-gray-400" />
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Upload Module Notes (PDF)
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Upload lecture notes or materials for this module
              </p>
            </div>

            <div className="flex justify-center">
              <Button
                onClick={openFileDialog}
                disabled={uploading}
                className="flex items-center gap-2"
              >
                {uploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Choose PDF File
                  </>
                )}
              </Button>
            </div>

            <div className="text-xs text-gray-500 dark:text-gray-400">
              <p>Supported: PDF files up to 25MB</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 