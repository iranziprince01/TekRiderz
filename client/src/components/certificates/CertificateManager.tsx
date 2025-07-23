import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { 
  Award,
  Download,
  Eye,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Calendar,
  User,
  BookOpen,
  Star,
  ExternalLink,
  Copy
} from 'lucide-react';

interface Certificate {
  certificateId: string;
  courseId: string;
  courseTitle: string;
  completedAt: string;
  progress: number;
  downloadUrl: string;
  verifyUrl: string;
}

interface CertificateManagerProps {
  userId?: string;
}

export const CertificateManager: React.FC<CertificateManagerProps> = ({ userId }) => {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const { user } = useAuth();
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCertificate, setSelectedCertificate] = useState<Certificate | null>(null);
  const [showVerificationModal, setShowVerificationModal] = useState(false);

  // Mock data for demonstration
  const mockCertificates: Certificate[] = [
    {
      certificateId: 'CERT-1234-5678-ABC123-DEF45',
      courseId: 'course_1',
      courseTitle: 'Introduction to Programming',
      completedAt: '2024-01-15T10:30:00Z',
      progress: 100,
      downloadUrl: '/api/v1/certificates/download/CERT-1234-5678-ABC123-DEF45',
      verifyUrl: '/api/v1/certificates/verify/CERT-1234-5678-ABC123-DEF45'
    },
    {
      certificateId: 'CERT-5678-9012-GHI678-JKL90',
      courseId: 'course_2',
      courseTitle: 'Web Development Fundamentals',
      completedAt: '2024-01-20T14:45:00Z',
      progress: 100,
      downloadUrl: '/api/v1/certificates/download/CERT-5678-9012-GHI678-JKL90',
      verifyUrl: '/api/v1/certificates/verify/CERT-5678-9012-GHI678-JKL90'
    },
    {
      certificateId: 'CERT-9012-3456-MNO123-PQR45',
      courseId: 'course_3',
      courseTitle: 'Data Science Basics',
      completedAt: '2024-01-25T09:15:00Z',
      progress: 100,
      downloadUrl: '/api/v1/certificates/download/CERT-9012-3456-MNO123-PQR45',
      verifyUrl: '/api/v1/certificates/verify/CERT-9012-3456-MNO123-PQR45'
    }
  ];

  useEffect(() => {
    const fetchCertificates = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Use mock data for demonstration
        setCertificates(mockCertificates);
      } catch (err) {
        setError('Failed to load certificates');
        console.error('Certificate fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCertificates();
  }, [userId]);

  const handleDownloadCertificate = async (certificate: Certificate) => {
    try {
      // In a real implementation, this would trigger the actual download
      console.log('Downloading certificate:', certificate.certificateId);
      
      // Simulate download
      const link = document.createElement('a');
      link.href = certificate.downloadUrl;
      link.download = `certificate_${certificate.certificateId}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const handleVerifyCertificate = async (certificate: Certificate) => {
    setSelectedCertificate(certificate);
    setShowVerificationModal(true);
  };

  const copyCertificateId = (certificateId: string) => {
    navigator.clipboard.writeText(certificateId);
    // You could add a toast notification here
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <p className="text-red-600">{error}</p>
        <Button onClick={() => window.location.reload()} className="mt-4">
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {language === 'rw' ? 'Impamyabumenyi' : 'Certificates'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {language === 'rw' 
              ? 'Reba impamyabumenyi zawe zo gusuzuma amasomo'
              : 'View and manage your course completion certificates'
            }
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant="success">
            {certificates.length} {language === 'rw' ? 'Impamyabumenyi' : 'Certificates'}
          </Badge>
        </div>
      </div>

      {/* Certificates Grid */}
      {certificates.length === 0 ? (
        <Card className="p-8 text-center">
          <Award className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {language === 'rw' ? 'Nta mpamyabumenyi ibashije kuboneka' : 'No Certificates Available'}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {language === 'rw' 
              ? 'Uraza kugera impamyabumenyi nyuma yo gusuzuma amasomo.'
              : 'You will receive certificates after completing courses.'
            }
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {certificates.map((certificate) => (
            <Card key={certificate.certificateId} className="p-6 hover:shadow-lg transition-shadow">
              {/* Certificate Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <Award className="w-8 h-8 text-yellow-500 mr-3" />
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {language === 'rw' ? 'Impamyabumenyi' : 'Certificate'}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {certificate.certificateId}
                    </p>
                  </div>
                </div>
                <CheckCircle className="w-6 h-6 text-green-500" />
              </div>

              {/* Course Information */}
              <div className="mb-4">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                  {certificate.courseTitle}
                </h4>
                <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 mr-2" />
                    {formatDate(certificate.completedAt)}
                  </div>
                  <div className="flex items-center">
                    <BookOpen className="w-4 h-4 mr-2" />
                    {language === 'rw' ? 'Aho ugeze:' : 'Progress:'} {certificate.progress}%
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  onClick={() => handleDownloadCertificate(certificate)}
                  className="flex-1"
                  size="sm"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {language === 'rw' ? 'Kuraho' : 'Download'}
                </Button>
                <Button
                  onClick={() => handleVerifyCertificate(certificate)}
                  variant="outline"
                  size="sm"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  {language === 'rw' ? 'Reba' : 'Verify'}
                </Button>
              </div>

              {/* Certificate ID */}
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {language === 'rw' ? 'ID y\'Impamyabumenyi:' : 'Certificate ID:'}
                  </span>
                  <Button
                    onClick={() => copyCertificateId(certificate.certificateId)}
                    variant="ghost"
                    size="sm"
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
                <p className="text-xs font-mono text-gray-700 dark:text-gray-300 mt-1">
                  {certificate.certificateId}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Verification Modal */}
      {showVerificationModal && selectedCertificate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {language === 'rw' ? 'Gusuzuma Impamyabumenyi' : 'Verify Certificate'}
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowVerificationModal(false)}
                >
                  ×
                </Button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {language === 'rw' ? 'Isomo:' : 'Course:'}
                  </label>
                  <p className="text-gray-900 dark:text-white">
                    {selectedCertificate.courseTitle}
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {language === 'rw' ? 'ID y\'Impamyabumenyi:' : 'Certificate ID:'}
                  </label>
                  <p className="text-sm font-mono text-gray-700 dark:text-gray-300">
                    {selectedCertificate.certificateId}
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {language === 'rw' ? 'Itariki yo Gusuzuma:' : 'Completion Date:'}
                  </label>
                  <p className="text-gray-900 dark:text-white">
                    {formatDate(selectedCertificate.completedAt)}
                  </p>
                </div>
                
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <div className="flex items-center">
                    <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                    <span className="text-green-800 dark:text-green-200 font-medium">
                      {language === 'rw' ? 'Impamyabumenyi Yemewe' : 'Certificate Verified'}
                    </span>
                  </div>
                  <p className="text-green-700 dark:text-green-300 text-sm mt-1">
                    {language === 'rw' 
                      ? 'Iyi mpamyabumenyi yemewe kandi yashyizwe mu gahato.'
                      : 'This certificate is verified and authentic.'
                    }
                  </p>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 mt-6">
                <Button
                  variant="outline"
                  onClick={() => setShowVerificationModal(false)}
                >
                  {language === 'rw' ? 'Funga' : 'Close'}
                </Button>
                <Button
                  onClick={() => {
                    window.open(selectedCertificate.verifyUrl, '_blank');
                    setShowVerificationModal(false);
                  }}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  {language === 'rw' ? 'Reba kuri Web' : 'View Online'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 