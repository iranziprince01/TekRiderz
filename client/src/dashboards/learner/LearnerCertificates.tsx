import React, { useState, useEffect, useRef } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Alert } from '../../components/ui/Alert';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { apiClient } from '../../utils/api';
import { 
  Award, 
  Download, 
  Calendar, 
  User, 
  BookOpen, 
  Star,
  Trophy,
  CheckCircle,
  Share2,
  Mail,
  ExternalLink,
  Eye,
  Search,
  Clock
} from 'lucide-react';

interface Certificate {
  id: string;
  courseId: string;
  courseName: string;
  learnerName: string;
  instructorName: string;
  completionDate: string;
  grade: number;
  certificateNumber: string;
  issuedDate: string;
  validUntil?: string;
  skills: string[];
  duration: string;
}

interface CertificateTemplateProps {
  certificate: Certificate;
  isPreview?: boolean;
}

const CertificateTemplate: React.FC<CertificateTemplateProps> = ({ certificate, isPreview = false }) => {
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className={`bg-white relative overflow-hidden ${isPreview ? 'w-full h-auto' : 'w-[210mm] h-[297mm]'} shadow-2xl`}>
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-0 left-0 w-full h-full">
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <defs>
              <pattern id="grain" patternUnits="userSpaceOnUse" width="100" height="100">
                <circle cx="50" cy="50" r="30" fill="none" stroke="currentColor" strokeWidth="0.5"/>
                <circle cx="20" cy="20" r="15" fill="none" stroke="currentColor" strokeWidth="0.3"/>
                <circle cx="80" cy="80" r="20" fill="none" stroke="currentColor" strokeWidth="0.4"/>
              </pattern>
            </defs>
            <rect width="100" height="100" fill="url(#grain)"/>
          </svg>
        </div>
      </div>

      {/* Border Design */}
      <div className="absolute inset-4 border-4 border-gradient-to-r from-blue-600 via-purple-600 to-blue-600 rounded-lg">
        <div className="absolute inset-2 border-2 border-gray-300 rounded-lg"></div>
      </div>

      {/* Content */}
      <div className="relative h-full flex flex-col justify-between p-16">
        {/* Header */}
        <div className="text-center mb-8">
          {/* Logo/Institution */}
          <div className="mb-6">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full shadow-lg mb-4">
              <Trophy className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-gray-800 mb-2">TekRiderz</h1>
            <p className="text-lg text-gray-600">Digital Learning Platform</p>
          </div>

          {/* Certificate Title */}
          <div className="mb-8">
            <h2 className="text-5xl font-serif text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 mb-4">
              Certificate of Completion
            </h2>
            <div className="w-32 h-1 bg-gradient-to-r from-blue-600 to-purple-600 mx-auto rounded-full"></div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col justify-center text-center">
          {/* Presentment */}
          <div className="mb-8">
            <p className="text-xl text-gray-700 mb-6 font-light">
              This is to certify that
            </p>
            
            {/* Learner Name */}
            <div className="mb-6">
              <h3 className="text-4xl font-bold text-gray-800 mb-2 font-serif">
                {certificate.learnerName}
              </h3>
              <div className="w-48 h-0.5 bg-gray-400 mx-auto"></div>
            </div>

            <p className="text-xl text-gray-700 mb-6 font-light">
              has successfully completed the course
            </p>

            {/* Course Name */}
            <div className="mb-8">
              <h4 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 mb-4 font-serif">
                {certificate.courseName}
              </h4>
              
              {/* Course Details */}
              <div className="flex justify-center space-x-8 text-gray-600 mb-6">
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4" />
                  <span>{certificate.duration}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Star className="w-4 h-4" />
                  <span>Grade: {certificate.grade}%</span>
                </div>
                <div className="flex items-center space-x-2">
                  <User className="w-4 h-4" />
                  <span>{certificate.instructorName}</span>
                </div>
              </div>

              {/* Skills */}
              {certificate.skills && certificate.skills.length > 0 && (
                <div className="mb-6">
                  <p className="text-sm text-gray-600 mb-3">Skills Acquired:</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {certificate.skills.map((skill, index) => (
                      <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-end">
          {/* Left Side - Date */}
          <div className="text-left">
            <div className="mb-4">
              <p className="text-sm text-gray-500">Date of Completion</p>
              <p className="text-lg font-semibold text-gray-800">{new Date(certificate.completionDate).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Certificate Number</p>
              <p className="text-sm font-mono text-gray-700">{certificate.certificateNumber}</p>
            </div>
          </div>

          {/* Center - Seal */}
          <div className="text-center">
            <div className="w-24 h-24 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center shadow-lg mb-2">
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center">
                <CheckCircle className="w-12 h-12 text-blue-600" />
              </div>
            </div>
            <p className="text-xs text-gray-500 font-semibold">VERIFIED</p>
          </div>

          {/* Right Side - Signature */}
          <div className="text-right">
            <div className="mb-4">
              <div className="w-32 h-0.5 bg-gray-400 mb-2"></div>
              <p className="text-sm text-gray-600">Digital Signature</p>
              <p className="text-sm font-semibold text-gray-800">TekRiderz Platform</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Issued Date</p>
              <p className="text-sm text-gray-700">{currentDate}</p>
            </div>
          </div>
        </div>

        {/* QR Code Placeholder */}
        <div className="absolute bottom-4 left-4 w-16 h-16 bg-gray-200 rounded flex items-center justify-center">
          <div className="text-xs text-gray-500 text-center">
            <ExternalLink className="w-4 h-4 mx-auto mb-1" />
            <span>Verify</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const LearnerCertificates: React.FC = () => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCertificate, setSelectedCertificate] = useState<Certificate | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  // Load certificates
  const loadCertificates = async () => {
    try {
      setLoading(true);
      setError('');

      // Try to load from API first
      const response = await apiClient.getUserCertificates();
      
      if (response.success && response.data) {
        // Transform backend data to match frontend interface
        const backendCertificates = response.data.certificates || [];
        
        console.log('📜 Certificate data received:', {
          certificateCount: backendCertificates.length,
          certificates: backendCertificates
        });
        
        const transformedCertificates = backendCertificates.map((cert: any) => ({
          id: cert.id || cert._id,
          courseId: cert.courseId,
          courseName: cert.courseName || 'Unknown Course',
          learnerName: cert.learnerName || user?.name || 'Student Name',
          instructorName: cert.instructorName || cert.instructor || 'Unknown Instructor',
          completionDate: cert.completedAt ? new Date(cert.completedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          grade: cert.finalGrade || cert.grade || 100, // Use finalGrade from auto-generation
          certificateNumber: cert.certificateNumber || `TRZ-${cert.courseId}-${new Date().getFullYear()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
          issuedDate: cert.issuedAt ? new Date(cert.issuedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          skills: cert.skills || [],
          duration: cert.duration ? `${Math.round(cert.duration / 3600)} hours` : '0 hours'
        }));
        
        setCertificates(transformedCertificates);
        
        console.log('✅ Certificates loaded successfully:', {
          transformedCount: transformedCertificates.length,
          certificates: transformedCertificates
        });
      } else {
        // Only show empty state if API fails - no mock data
        setCertificates([]);
        if (!response.success && response.error) {
          setError('Failed to load certificates. Please try again later.');
        }
        
        console.log('⚠️ No certificates found or API error:', response.error);
      }
    } catch (err: any) {
      console.error('Failed to load certificates:', err);
      setError(err.message || 'Failed to load certificates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadCertificates();
    }
  }, [user]);

  // Filter certificates
  const filteredCertificates = certificates.filter(cert =>
    cert.courseName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cert.instructorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cert.certificateNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Handle certificate download
  const handleDownload = async (certificate: Certificate) => {
    try {
      setDownloading(certificate.id);
      
      // Download the PDF certificate from backend
      const response = await apiClient.downloadCertificate(certificate.id);
      
      if (response.success) {
        // Create a temporary download link
        const url = `/api/v1/certificates/${certificate.id}/download`;
        const link = document.createElement('a');
        link.href = url;
        link.download = `certificate_${certificate.certificateNumber}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setSuccess('Certificate downloaded successfully!');
      } else {
        throw new Error(response.error || 'Failed to download certificate');
      }
    } catch (err: any) {
      setError('Failed to download certificate');
      console.error('Certificate download error:', err);
    } finally {
      setDownloading(null);
    }
  };

  // Handle certificate sharing
  const handleShare = async (certificate: Certificate) => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Certificate - ${certificate.courseName}`,
          text: `I've completed ${certificate.courseName} and earned a certificate!`,
          url: window.location.href
        });
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(
          `I've completed ${certificate.courseName} and earned a certificate! Certificate #${certificate.certificateNumber}`
        );
        setSuccess('Certificate details copied to clipboard!');
      }
    } catch (err) {
      setError('Failed to share certificate');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error and Success Messages */}
      {error && (
        <Alert variant="error">
          {error}
        </Alert>
      )}

      {success && (
        <Alert variant="success">
          {success}
        </Alert>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {language === 'rw' ? 'Impamyabushobozi' : 'My Certificates'}
          </h2>
          <p className="text-gray-600 dark:text-gray-300">
            {language === 'rw' 
              ? 'Impamyabushobozi zawe zo gutsinzira amasomo'
              : 'Your certificates for completed courses'
            }
          </p>
        </div>

        {/* Search */}
        <div className="w-full sm:w-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder={language === 'rw' ? 'Shakisha impamyabushobozi...' : 'Search certificates...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full sm:w-80"
            />
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                {language === 'rw' ? 'Impamyabushobozi' : 'Total Certificates'}
              </p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {certificates.length}
              </p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <Award className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                {language === 'rw' ? 'Igipimo cyo hagati' : 'Average Grade'}
              </p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {certificates.length > 0 
                  ? Math.round(certificates.reduce((sum, cert) => sum + cert.grade, 0) / certificates.length)
                  : 0
                }%
              </p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
              <Star className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                {language === 'rw' ? 'Ubuhanga bwize' : 'Skills Earned'}
              </p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {certificates.reduce((total, cert) => total + (cert.skills?.length || 0), 0)}
              </p>
            </div>
            <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
              <Trophy className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </Card>
      </div>

      {/* Certificates Grid */}
      {filteredCertificates.length === 0 ? (
        <Card className="p-12 text-center">
          <Award className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {language === 'rw' ? 'Nta mpamyabushobozi' : 'No Certificates Yet'}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {language === 'rw' 
              ? 'Rangiza amasomo yawe kugira ngo uhabwe impamyabushobozi'
              : 'Complete courses to earn certificates and showcase your achievements'
            }
          </p>
          <Button onClick={() => window.location.href = '/courses'} className="inline-flex items-center">
            <BookOpen className="w-4 h-4 mr-2" />
            {language === 'rw' ? 'Shakisha Amasomo' : 'Browse Courses'}
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredCertificates.map((certificate) => (
            <Card key={certificate.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              {/* Certificate Preview */}
              <div className="aspect-[1.4/1] bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 p-4">
                <div className="h-full bg-white rounded-lg shadow-sm transform scale-90 hover:scale-95 transition-transform cursor-pointer"
                     onClick={() => {
                       setSelectedCertificate(certificate);
                       setShowPreview(true);
                     }}>
                  <div className="h-full border-2 border-blue-200 rounded-lg p-3 flex flex-col justify-between">
                    <div className="text-center">
                      <div className="w-8 h-8 bg-blue-600 rounded-full mx-auto mb-2 flex items-center justify-center">
                        <Trophy className="w-4 h-4 text-white" />
                      </div>
                      <h4 className="text-sm font-bold text-blue-600 mb-1">Certificate of Completion</h4>
                      <div className="w-8 h-0.5 bg-blue-600 mx-auto mb-2"></div>
                    </div>
                    
                    <div className="text-center flex-1 flex flex-col justify-center">
                      <p className="text-xs text-gray-600 mb-1">This certifies that</p>
                      <p className="text-sm font-bold text-gray-800 mb-1">{certificate.learnerName}</p>
                      <p className="text-xs text-gray-600 mb-1">has completed</p>
                      <p className="text-xs font-semibold text-blue-600 leading-tight">{certificate.courseName}</p>
                    </div>
                    
                    <div className="flex justify-between items-end">
                      <div className="text-xs text-gray-500">
                        <div className="w-6 h-0.5 bg-gray-300 mb-1"></div>
                        <span>TekRiderz</span>
                      </div>
                      <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                        <CheckCircle className="w-3 h-3 text-blue-600" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Certificate Info */}
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                      {certificate.courseName}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      Instructor: {certificate.instructorName}
                    </p>
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-4 h-4" />
                        <span>{new Date(certificate.completionDate).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Star className="w-4 h-4" />
                        <span>{certificate.grade}%</span>
                      </div>
                    </div>
                  </div>
                  <Badge variant="success" className="ml-4">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Verified
                  </Badge>
                </div>

                {/* Skills */}
                {certificate.skills && certificate.skills.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Skills:</p>
                    <div className="flex flex-wrap gap-1">
                      {certificate.skills.slice(0, 3).map((skill, index) => (
                        <span key={index} className="px-2 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 rounded text-xs">
                          {skill}
                        </span>
                      ))}
                      {certificate.skills.length > 3 && (
                        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded text-xs">
                          +{certificate.skills.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center space-x-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      setSelectedCertificate(certificate);
                      setShowPreview(true);
                    }}
                    className="flex-1"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    {language === 'rw' ? 'Reba' : 'View'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDownload(certificate)}
                    disabled={downloading === certificate.id}
                  >
                    {downloading === certificate.id ? (
                      <LoadingSpinner size="sm" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleShare(certificate)}
                  >
                    <Share2 className="w-4 h-4" />
                  </Button>
                </div>

                {/* Certificate Number */}
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Certificate #{certificate.certificateNumber}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Certificate Preview Modal */}
      {showPreview && selectedCertificate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                Certificate Preview - {selectedCertificate.courseName}
              </h3>
              <div className="flex items-center space-x-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDownload(selectedCertificate)}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowPreview(false)}
                >
                  ×
                </Button>
              </div>
            </div>
            <div className="p-6">
              <div ref={printRef} className="transform scale-75 origin-top">
                <CertificateTemplate certificate={selectedCertificate} isPreview={true} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LearnerCertificates; 