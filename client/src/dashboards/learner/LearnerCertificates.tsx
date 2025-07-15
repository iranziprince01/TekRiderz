import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { 
  Award, 
  Download, 
  Eye, 
  Calendar, 
  Search,
  Trophy,
  Star,
  BookOpen,
  ExternalLink
} from 'lucide-react';
import { useComprehensiveDashboardData } from '../../hooks/useComprehensiveDashboardData';

const LearnerCertificates: React.FC = () => {
  const { t } = useLanguage();
  const {
    user,
    certificates,
    enrolledCourses,
    isLoading,
    error
  } = useComprehensiveDashboardData();

  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('date'); // date, course, status

  // Process certificates with course information
  const processedCertificates = useMemo(() => {
    if (!certificates) return [];
    
    return certificates.map((certificate: any) => {
      // Find the corresponding course
      const course = enrolledCourses?.find((c: any) => 
        c.id === certificate.courseId || c._id === certificate.courseId
      );
      
      return {
        ...certificate,
        courseName: course?.title || certificate.courseName || 'Unknown Course',
        courseCategory: course?.category || 'General',
        instructorName: course?.instructorName || certificate.instructorName || 'Unknown Instructor',
        completedDate: certificate.completedAt || certificate.earnedAt || certificate.createdAt,
        issuedDate: certificate.issuedAt || certificate.createdAt,
        certificateNumber: certificate.certificateNumber || certificate.id,
        status: certificate.status || 'issued',
        grade: certificate.grade || certificate.finalGrade,
        course: course
      };
    });
  }, [certificates, enrolledCourses]);

  // Filter certificates based on search term
  const filteredCertificates = useMemo(() => {
    let filtered = processedCertificates;

    if (searchTerm) {
      filtered = filtered.filter((cert: any) =>
        cert.courseName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cert.courseCategory?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cert.instructorName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cert.certificateNumber?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Sort certificates
    filtered.sort((a: any, b: any) => {
      switch (sortBy) {
        case 'course':
          return a.courseName.localeCompare(b.courseName);
        case 'status':
          return a.status.localeCompare(b.status);
        case 'date':
        default:
          return new Date(b.completedDate || 0).getTime() - new Date(a.completedDate || 0).getTime();
      }
    });

    return filtered;
  }, [processedCertificates, searchTerm, sortBy]);

  // Calculate certificate statistics
  const certificateStats = useMemo(() => {
    const total = processedCertificates.length;
    const byCategory = processedCertificates.reduce((acc: any, cert: any) => {
      const category = cert.courseCategory || 'Other';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {});
    
    const thisYear = new Date().getFullYear();
    const thisYearCount = processedCertificates.filter((cert: any) => 
      new Date(cert.completedDate || 0).getFullYear() === thisYear
    ).length;

    const averageGrade = processedCertificates.length > 0
      ? Math.round(processedCertificates.reduce((sum: number, cert: any) => 
          sum + (parseFloat(cert.grade) || 0), 0) / processedCertificates.length)
      : 0;

    return {
      total,
      thisYear: thisYearCount,
      byCategory,
      averageGrade,
      topCategory: Object.keys(byCategory).reduce((a, b) => byCategory[a] > byCategory[b] ? a : b, 'None')
    };
  }, [processedCertificates]);

  // Handle certificate download
  const handleDownload = async (certificate: any) => {
    try {
      // This would typically make an API call to download the certificate
      console.log('Downloading certificate:', certificate.id);
      // For now, just log - in a real app you'd implement the download logic
    } catch (error) {
      console.error('Failed to download certificate:', error);
    }
  };

  // Handle certificate view
  const handleView = (certificate: any) => {
    // This would typically open a modal or navigate to certificate view
    console.log('Viewing certificate:', certificate.id);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <LoadingSpinner className="mx-auto mb-4" />
          <p className="text-gray-600">
            {t('Loading your certificates...')}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="p-8 text-center">
          <Award className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {t('Unable to load certificates')}
          </h3>
          <p className="text-gray-600">
            {error}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          {t('My Certificates')}
        </h1>
        <p className="text-gray-600 mt-1">
          {t('View and manage your earned course certificates')}
        </p>
      </div>

      {/* Certificate Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="bg-yellow-100 p-2 rounded-lg">
              <Award className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <div className="text-xl font-bold">{certificateStats.total}</div>
              <div className="text-gray-600 text-sm">{t('Total Certificates')}</div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="bg-green-100 p-2 rounded-lg">
              <Trophy className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-xl font-bold">{certificateStats.thisYear}</div>
              <div className="text-gray-600 text-sm">{t('This Year')}</div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Star className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-xl font-bold">{certificateStats.averageGrade}%</div>
              <div className="text-gray-600 text-sm">{t('Average Grade')}</div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="bg-purple-100 p-2 rounded-lg">
              <BookOpen className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <div className="text-xl font-bold text-sm">{certificateStats.topCategory}</div>
              <div className="text-gray-600 text-sm">{t('Top Category')}</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Search and Sort */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              type="text"
              placeholder={t('Search certificates, courses, instructors...')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        
        <div className="sm:w-48">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="date">{t('Sort by Date')}</option>
            <option value="course">{t('Sort by Course')}</option>
            <option value="status">{t('Sort by Status')}</option>
          </select>
        </div>
      </div>

      {/* Certificates List */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">{t('Your Certificates')}</h2>
          <Badge variant="default">
            {filteredCertificates.length} {t('certificates')}
          </Badge>
        </div>

        {filteredCertificates.length > 0 ? (
          <div className="space-y-4">
            {filteredCertificates.map((certificate: any) => (
              <Card key={certificate.id || certificate._id} className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex flex-col lg:flex-row gap-6">
                  {/* Certificate Icon/Preview */}
                  <div className="lg:w-32 lg:h-32 w-full h-32 bg-gradient-to-br from-yellow-100 to-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Award className="w-12 h-12 text-yellow-600" />
                  </div>

                  {/* Certificate Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="success" className="text-xs">
                            {t('Certified')}
                          </Badge>
                          {certificate.grade && (
                            <Badge variant="default" className="text-xs">
                              {certificate.grade}%
                            </Badge>
                          )}
                        </div>
                        
                        <h3 className="font-semibold text-gray-900 text-lg mb-2">
                          {certificate.courseName}
                        </h3>
                        
                        <div className="space-y-1 text-sm text-gray-600">
                          <p className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            {t('Completed')}: {new Date(certificate.completedDate).toLocaleDateString()}
                          </p>
                          {certificate.instructorName && (
                            <p>
                              {t('Instructor')}: {certificate.instructorName}
                            </p>
                          )}
                          {certificate.certificateNumber && (
                            <p className="font-mono text-xs">
                              {t('Certificate')}: {certificate.certificateNumber}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col sm:items-end gap-3">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleView(certificate)}
                            className="flex items-center gap-2"
                          >
                            <Eye className="w-4 h-4" />
                            {t('View')}
                          </Button>
                          
                          <Button
                            size="sm"
                            onClick={() => handleDownload(certificate)}
                            className="flex items-center gap-2"
                          >
                            <Download className="w-4 h-4" />
                            {t('Download')}
                          </Button>
                        </div>

                        {certificate.course && (
                          <Link 
                            to={`/course/${certificate.course.id || certificate.course._id}`}
                            className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                          >
                            {t('View Course')}
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        )}
                      </div>
                    </div>

                    {/* Certificate Category */}
                    {certificate.courseCategory && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">{t('Category')}:</span>
                        <Badge variant="default" className="text-xs">
                          {t(certificate.courseCategory)}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-8 text-center">
            <Award className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {processedCertificates.length === 0 
                ? t('No certificates earned')
                : t('No certificates match your search')
              }
            </h3>
            <p className="text-gray-600 mb-4">
              {processedCertificates.length === 0 
                ? t('Complete courses to earn certificates and showcase your achievements')
                : t('Try adjusting your search criteria')
              }
            </p>
            {processedCertificates.length === 0 ? (
              <Link to="/dashboard/courses">
                <Button>
                  {t('Browse Courses')}
                </Button>
              </Link>
            ) : (
              <Button
                variant="outline"
                onClick={() => setSearchTerm('')}
              >
                {t('Clear Search')}
              </Button>
            )}
          </Card>
        )}
      </div>

      {/* Achievement Summary */}
      {processedCertificates.length > 0 && (
        <Card className="p-6 bg-gradient-to-r from-blue-50 to-purple-50">
          <div className="flex items-center gap-4">
            <div className="bg-blue-100 p-3 rounded-full">
              <Trophy className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                {t('Congratulations!')}
              </h3>
              <p className="text-gray-600">
                {t('You have earned')} {processedCertificates.length} {t('certificate(s) and demonstrated your commitment to learning.')}
              </p>
              {certificateStats.thisYear > 0 && (
                <p className="text-sm text-blue-600 mt-1">
                  {certificateStats.thisYear} {t('earned this year - keep up the great work!')}
                </p>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default LearnerCertificates; 