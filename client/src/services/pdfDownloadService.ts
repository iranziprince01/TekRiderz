import { getPdfFromPouchDB, cachePdfInPouchDB } from '../offline/cacheService';

/**
 * PDF Download Service
 * Handles PDF downloads with offline support using PouchDB
 */
class PdfDownloadService {
  private static instance: PdfDownloadService;

  static getInstance(): PdfDownloadService {
    if (!PdfDownloadService.instance) {
      PdfDownloadService.instance = new PdfDownloadService();
    }
    return PdfDownloadService.instance;
  }

  /**
   * Download PDF with offline support and multiple fallback strategies
   * @param pdfUrl - The URL of the PDF to download
   * @param moduleId - Optional module ID for association
   * @param courseId - Optional course ID for association
   * @returns Promise<Blob> - The PDF blob data
   */
  async downloadPdf(
    pdfUrl: string, 
    moduleId?: string, 
    courseId?: string
  ): Promise<Blob> {
    try {
      console.log(`📄 Attempting to download PDF: ${pdfUrl}`);
      
      // First, try to get PDF from PouchDB (offline)
      const cachedPdf = await getPdfFromPouchDB(pdfUrl);
      if (cachedPdf) {
        console.log(`📄 PDF retrieved from PouchDB (offline): ${pdfUrl}`);
        return cachedPdf;
      }

      // If not in PouchDB, try multiple strategies to fetch from network
      console.log(`📄 PDF not in PouchDB, trying network fetch: ${pdfUrl}`);
      
      // Strategy 1: Direct fetch with credentials
      try {
        const response = await fetch(pdfUrl, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Accept': 'application/pdf,application/octet-stream,*/*',
            'Cache-Control': 'no-cache'
          }
        });
        
        if (response.ok) {
          const pdfBlob = await response.blob();
          console.log(`📄 PDF fetched successfully with direct fetch: ${pdfUrl}`);
          
          // Cache the PDF in PouchDB for future offline access
          try {
            await cachePdfInPouchDB(pdfUrl, pdfBlob, moduleId, courseId);
            console.log(`📄 PDF cached in PouchDB for offline access: ${pdfUrl}`);
          } catch (cacheError) {
            console.warn(`⚠️ Failed to cache PDF in PouchDB: ${pdfUrl}`, cacheError);
          }
          
          return pdfBlob;
        }
      } catch (directFetchError) {
        console.warn(`⚠️ Direct fetch failed, trying alternative strategies: ${pdfUrl}`, directFetchError);
      }

      // Strategy 2: Try with different URL formats for Firebase/Cloudinary
      const alternativeUrls = this.generateAlternativeUrls(pdfUrl);
      for (const altUrl of alternativeUrls) {
        try {
          console.log(`📄 Trying alternative URL: ${altUrl}`);
          const response = await fetch(altUrl, {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Accept': 'application/pdf,application/octet-stream,*/*'
            }
          });
          
          if (response.ok) {
            const pdfBlob = await response.blob();
            console.log(`📄 PDF fetched successfully with alternative URL: ${altUrl}`);
            
            // Cache the PDF in PouchDB for future offline access
            try {
              await cachePdfInPouchDB(pdfUrl, pdfBlob, moduleId, courseId);
              console.log(`📄 PDF cached in PouchDB for offline access: ${pdfUrl}`);
            } catch (cacheError) {
              console.warn(`⚠️ Failed to cache PDF in PouchDB: ${pdfUrl}`, cacheError);
            }
            
            return pdfBlob;
          }
        } catch (altUrlError) {
          console.warn(`⚠️ Alternative URL failed: ${altUrl}`, altUrlError);
          continue;
        }
      }

      // Strategy 3: Try backend proxy if available
      try {
        const proxyUrl = `${import.meta.env.VITE_API_URL || '/api/v1'}/upload/proxy-download?url=${encodeURIComponent(pdfUrl)}&filename=${encodeURIComponent(this.extractFilenameFromUrl(pdfUrl))}`;
        console.log(`📄 Trying backend proxy: ${proxyUrl}`);
        
        const response = await fetch(proxyUrl, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Accept': 'application/pdf,application/octet-stream,*/*'
          }
        });
        
        if (response.ok) {
          const pdfBlob = await response.blob();
          console.log(`📄 PDF fetched successfully via backend proxy: ${pdfUrl}`);
          
          // Cache the PDF in PouchDB for future offline access
          try {
            await cachePdfInPouchDB(pdfUrl, pdfBlob, moduleId, courseId);
            console.log(`📄 PDF cached in PouchDB for offline access: ${pdfUrl}`);
          } catch (cacheError) {
            console.warn(`⚠️ Failed to cache PDF in PouchDB: ${pdfUrl}`, cacheError);
          }
          
          return pdfBlob;
        }
      } catch (proxyError) {
        console.warn(`⚠️ Backend proxy failed: ${pdfUrl}`, proxyError);
      }

      // Strategy 4: Try opening in new tab as last resort
      try {
        console.log(`📄 Trying to open PDF in new tab as fallback: ${pdfUrl}`);
        const newWindow = window.open(pdfUrl, '_blank');
        if (newWindow) {
          console.log(`📄 PDF opened in new tab: ${pdfUrl}`);
          // Return a placeholder blob since we can't get the actual blob from new tab
          return new Blob(['PDF opened in new tab'], { type: 'application/pdf' });
        }
      } catch (newTabError) {
        console.warn(`⚠️ New tab fallback failed: ${pdfUrl}`, newTabError);
      }

      // All strategies failed
      throw new Error(`All PDF download strategies failed for: ${pdfUrl}`);
    } catch (error) {
      console.error(`❌ Failed to download PDF: ${pdfUrl}`, error);
      throw error;
    }
  }

  /**
   * Generate alternative URLs for Firebase/Cloudinary PDFs
   * @param originalUrl - The original PDF URL
   * @returns Array of alternative URLs to try
   */
  private generateAlternativeUrls(originalUrl: string): string[] {
    const alternatives: string[] = [];
    
    // Firebase Storage alternatives
    if (originalUrl.includes('storage.googleapis.com')) {
      // Try different Firebase URL formats
      alternatives.push(
        originalUrl.replace('?alt=media', ''),
        originalUrl.replace('?alt=media', '&download=true'),
        originalUrl + '&download=true',
        originalUrl.replace('firebasestorage.googleapis.com', 'storage.googleapis.com')
      );
    }
    
    // Cloudinary alternatives
    if (originalUrl.includes('cloudinary')) {
      alternatives.push(
        originalUrl.replace('/upload/', '/upload/fl_attachment/'),
        originalUrl.replace('/upload/', '/upload/v1/'),
        originalUrl.replace('/raw/', '/image/'),
        originalUrl.replace(/\/v\d+\//, '/'),
        originalUrl.replace('/raw/upload/', '/image/upload/'),
        originalUrl.replace('/image/upload/', '/raw/upload/')
      );
    }
    
    // General alternatives
    alternatives.push(
      originalUrl.replace('https://', 'http://'),
      originalUrl.replace('http://', 'https://')
    );
    
    return alternatives.filter(url => url !== originalUrl);
  }

  /**
   * Check if PDF is available offline
   * @param pdfUrl - The URL of the PDF to check
   * @returns Promise<boolean> - True if PDF is cached offline
   */
  async isPdfAvailableOffline(pdfUrl: string): Promise<boolean> {
    try {
      const cachedPdf = await getPdfFromPouchDB(pdfUrl);
      return cachedPdf !== null;
    } catch (error) {
      console.warn(`⚠️ Error checking offline PDF availability: ${pdfUrl}`, error);
      return false;
    }
  }

  /**
   * Check if PDF URL is accessible (online check)
   * @param pdfUrl - The URL of the PDF to check
   * @returns Promise<boolean> - True if PDF URL is accessible
   */
  async isPdfUrlAccessible(pdfUrl: string): Promise<boolean> {
    try {
      // Try a HEAD request first (lighter than GET)
      const response = await fetch(pdfUrl, { 
        method: 'HEAD',
        credentials: 'include',
        headers: {
          'Accept': 'application/pdf,application/octet-stream,*/*'
        }
      });
      
      return response.ok;
    } catch (error) {
      console.warn(`⚠️ PDF URL accessibility check failed: ${pdfUrl}`, error);
      return false;
    }
  }

  /**
   * Open PDF in new tab for viewing (original intended flow)
   * @param pdfUrl - The URL of the PDF to open
   * @param moduleId - Optional module ID for association
   * @param courseId - Optional course ID for association
   */
  async openPdfInNewTab(
    pdfUrl: string, 
    moduleId?: string, 
    courseId?: string
  ): Promise<void> {
    try {
      console.log(`📄 Opening PDF in new tab: ${pdfUrl}`);
      
      // First, try to get PDF from PouchDB (offline)
      const cachedPdf = await getPdfFromPouchDB(pdfUrl);
      if (cachedPdf) {
        console.log(`📄 PDF retrieved from PouchDB (offline): ${pdfUrl}`);
        // Create blob URL for cached PDF
        const blobUrl = window.URL.createObjectURL(cachedPdf);
        const newWindow = window.open(blobUrl, '_blank');
        if (newWindow) {
          console.log(`📄 Cached PDF opened in new tab: ${pdfUrl}`);
          return;
        }
      }

      // If not cached, try to open the original URL
      console.log(`📄 PDF not cached, opening original URL: ${pdfUrl}`);
      const newWindow = window.open(pdfUrl, '_blank');
      
      // Modern browsers may return null even when PDF opens successfully
      // We'll assume success if no exception is thrown
      console.log(`📄 PDF opened in new tab: ${pdfUrl}`);
      
      // Pre-cache the PDF in background for offline access
      try {
        await this.preCachePdf(pdfUrl, moduleId, courseId);
      } catch (cacheError) {
        console.warn(`⚠️ Background caching failed: ${pdfUrl}`, cacheError);
        // Don't throw error - PDF is already opened
      }
      
      return;
    } catch (error) {
      console.error(`❌ Failed to open PDF in new tab: ${pdfUrl}`, error);
      throw error;
    }
  }

  /**
   * Download PDF and trigger browser download (alternative method)
   * @param pdfUrl - The URL of the PDF to download
   * @param filename - Optional filename for the download
   * @param moduleId - Optional module ID for association
   * @param courseId - Optional course ID for association
   */
  async downloadPdfToBrowser(
    pdfUrl: string, 
    filename?: string, 
    moduleId?: string, 
    courseId?: string
  ): Promise<void> {
    try {
      console.log(`📄 Starting browser download for PDF: ${pdfUrl}`);
      
      const pdfBlob = await this.downloadPdf(pdfUrl, moduleId, courseId);
      
      // Check if we got a placeholder blob (indicating PDF was opened in new tab)
      if (pdfBlob.size < 100 && pdfBlob.type === 'application/pdf') {
        const text = await pdfBlob.text();
        if (text.includes('PDF opened in new tab')) {
          console.log(`📄 PDF opened in new tab instead of download: ${pdfUrl}`);
          return; // PDF was opened in new tab, no need for download
        }
      }
      
      // Create download link
      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || this.extractFilenameFromUrl(pdfUrl);
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up
      window.URL.revokeObjectURL(url);
      
      console.log(`📄 PDF download completed: ${pdfUrl}`);
    } catch (error) {
      console.error(`❌ Failed to download PDF to browser: ${pdfUrl}`, error);
      
      // Last resort: try to open in new tab
      try {
        console.log(`📄 Trying to open PDF in new tab as last resort: ${pdfUrl}`);
        const newWindow = window.open(pdfUrl, '_blank');
        if (newWindow) {
          console.log(`📄 PDF opened in new tab as fallback: ${pdfUrl}`);
          return;
        }
      } catch (newTabError) {
        console.error(`❌ New tab fallback also failed: ${pdfUrl}`, newTabError);
      }
      
      throw error;
    }
  }

  /**
   * Extract filename from URL
   * @param url - The URL to extract filename from
   * @returns string - The extracted filename
   */
  private extractFilenameFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const filename = pathname.split('/').pop();
      return filename || 'document.pdf';
    } catch (error) {
      return 'document.pdf';
    }
  }

  /**
   * Pre-cache PDF for offline access
   * @param pdfUrl - The URL of the PDF to pre-cache
   * @param moduleId - Optional module ID for association
   * @param courseId - Optional course ID for association
   */
  async preCachePdf(
    pdfUrl: string, 
    moduleId?: string, 
    courseId?: string
  ): Promise<boolean> {
    try {
      console.log(`📄 Pre-caching PDF: ${pdfUrl}`);
      
      // Check if already cached
      const existingPdf = await getPdfFromPouchDB(pdfUrl);
      if (existingPdf) {
        console.log(`📄 PDF already cached: ${pdfUrl}`);
        return true;
      }

      // Fetch and cache
      const response = await fetch(pdfUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
      }

      const pdfBlob = await response.blob();
      await cachePdfInPouchDB(pdfUrl, pdfBlob, moduleId, courseId);
      
      console.log(`📄 PDF pre-cached successfully: ${pdfUrl}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to pre-cache PDF: ${pdfUrl}`, error);
      return false;
    }
  }
}

// Export singleton instance
export const pdfDownloadService = PdfDownloadService.getInstance();

// Export hook for React components
export const usePdfDownload = () => {
  return {
    downloadPdf: pdfDownloadService.downloadPdf.bind(pdfDownloadService),
    openPdfInNewTab: pdfDownloadService.openPdfInNewTab.bind(pdfDownloadService),
    downloadPdfToBrowser: pdfDownloadService.downloadPdfToBrowser.bind(pdfDownloadService),
    isPdfAvailableOffline: pdfDownloadService.isPdfAvailableOffline.bind(pdfDownloadService),
    isPdfUrlAccessible: pdfDownloadService.isPdfUrlAccessible.bind(pdfDownloadService),
    preCachePdf: pdfDownloadService.preCachePdf.bind(pdfDownloadService)
  };
}; 