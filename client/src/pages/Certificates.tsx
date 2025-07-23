import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';

import DashboardLayout from '../components/layout/DashboardLayout';
import { Award, Download, BookOpen, Calendar, CheckCircle } from 'lucide-react';
import api from '../utils/api';

interface Certificate {
  certificateId: string;
  courseId: string;
  courseTitle: string;
  completedAt: string;
  progress: number;
  downloadUrl: string;
}

interface CompletedCourse {
  courseId: string;
  title: string;
  completedAt: string;
  progress: number;
  hasCertificate: boolean;
}

const Certificates: React.FC = () => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [completedCourses, setCompletedCourses] = useState<CompletedCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingCertificate, setGeneratingCertificate] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch certificates with error handling
        let certificatesResponse;
        try {
          console.log('Fetching certificates for user:', user?.id);
          certificatesResponse = await api.getUserCertificates(user?.id || '');
          console.log('Certificates response:', certificatesResponse);
        } catch (certError: any) {
          console.warn('Failed to fetch certificates, continuing with enrollments:', certError);
          console.warn('Certificate error details:', {
            message: certError?.message,
            status: certError?.response?.status,
            data: certError?.response?.data
          });
          certificatesResponse = { data: { certificates: [] } };
        }
        
        // Fetch completed courses with error handling
        let enrollmentsResponse;
        try {
          console.log('Fetching enrollments...');
          enrollmentsResponse = await api.getEnrollments();
          console.log('Enrollments response:', enrollmentsResponse);
        } catch (enrollmentError: any) {
          console.warn('Failed to fetch enrollments:', enrollmentError);
          console.warn('Enrollment error details:', {
            message: enrollmentError?.message,
            status: enrollmentError?.response?.status,
            data: enrollmentError?.response?.data
          });
          enrollmentsResponse = { data: { courses: [] } };
        }
        
        setCertificates(certificatesResponse.data.certificates || []);
        
        // The backend returns courses array, not enrollments array
        let completedCoursesData = (enrollmentsResponse.data.courses || [])
          .filter((course: any) => {
            // Check multiple progress indicators for completion
            const progressPercentage = course.progress?.percentage || 0;
            const overallProgress = course.progress?.overallProgress || 0;
            const enrollmentProgress = course.enrollment?.progress || 0;
            const status = course.enrollment?.status || 'enrolled';
            
            // Course is completed if any of these conditions are met:
            const isCompleted = 
              progressPercentage >= 100 || 
              overallProgress >= 100 || 
              enrollmentProgress >= 100 || 
              status === 'completed';
            
            console.log(`Course: ${course.title}, Progress: ${progressPercentage}%, Overall: ${overallProgress}%, Enrollment: ${enrollmentProgress}%, Status: ${status}, IsCompleted: ${isCompleted}`);
            return isCompleted;
          })
          .map((course: any) => ({
            courseId: course.id || course._id,
            title: course.title || 'Unknown Course',
            completedAt: course.enrollment?.completedAt || course.enrollment?.enrolledAt || course.updatedAt || new Date().toISOString(),
            progress: Math.max(
              course.progress?.percentage || 0,
              course.progress?.overallProgress || 0,
              course.enrollment?.progress || 0
            ),
            hasCertificate: (certificatesResponse.data.certificates || []).some((cert: any) => cert.courseId === (course.id || course._id)) || false
          }));

        console.log('Found completed courses:', completedCoursesData.length);
        console.log('Completed courses data:', completedCoursesData);
        
        // Debug: Log all courses to see what we're getting
        console.log('All courses from API:', enrollmentsResponse.data.courses || []);
        
        // Additional debugging: Check each course's progress structure
        (enrollmentsResponse.data.courses || []).forEach((course: any, index: number) => {
          console.log(`Course ${index + 1}:`, {
            title: course.title,
            id: course.id || course._id,
            progress: course.progress,
            enrollment: course.enrollment,
            overallProgress: course.progress?.overallProgress,
            percentage: course.progress?.percentage,
            enrollmentProgress: course.enrollment?.progress,
            enrollmentStatus: course.enrollment?.status
          });
        });
        
        setCompletedCourses(completedCoursesData);
      } catch (err: any) {
        const errorMessage = err?.response?.data?.error || err?.message || 'Failed to load certificates and completed courses';
        setError(errorMessage);
        console.error('Certificates error:', err);
      } finally {
        setLoading(false);
      }
    };

    if (user?.id) {
      fetchData();
    }
  }, [user?.id]);

  const handleDownload = async (certificateId: string) => {
    try {
      // Find the certificate
      const certificate = certificates.find(cert => cert.certificateId === certificateId);
      if (!certificate) {
        alert('Certificate not found');
        return;
      }

      // Create a modern, creative certificate as a downloadable HTML file optimized for PDF
      const certificateHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Certificate - ${certificate.courseTitle}</title>
          <style>
            @page {
              size: A4 landscape;
              margin: 0;
            }
            @media print {
              body { 
                margin: 0; 
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .certificate { 
                box-shadow: none; 
                page-break-inside: avoid;
                margin: 0;
                width: 100%;
                height: 100%;
              }
            }
            * {
              box-sizing: border-box;
            }
            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              margin: 0;
              padding: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              width: 100vw;
              height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              overflow: hidden;
            }
            .certificate {
              background: white;
              padding: 80px 60px;
              text-align: center;
              width: 100%;
              max-width: 1100px;
              position: relative;
              border-radius: 20px;
              box-shadow: 0 25px 50px rgba(0,0,0,0.15);
              overflow: hidden;
            }
            .certificate::before {
              content: '';
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              height: 8px;
              background: linear-gradient(90deg, #3b82f6, #8b5cf6, #06b6d4, #10b981);
            }
            .geometric-bg {
              position: absolute;
              top: -50%;
              right: -50%;
              width: 200%;
              height: 200%;
              background: 
                radial-gradient(circle at 20% 80%, rgba(59, 130, 246, 0.03) 0%, transparent 50%),
                radial-gradient(circle at 80% 20%, rgba(139, 92, 246, 0.03) 0%, transparent 50%),
                radial-gradient(circle at 40% 40%, rgba(6, 182, 212, 0.03) 0%, transparent 50%);
              pointer-events: none;
              z-index: 0;
            }
            .content-wrapper {
              position: relative;
              z-index: 1;
            }
            .header {
              color: #3b82f6;
              font-size: 42px;
              font-weight: 800;
              margin-bottom: 8px;
              text-transform: uppercase;
              letter-spacing: 3px;
              background: linear-gradient(135deg, #3b82f6, #8b5cf6);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
              background-clip: text;
            }
            .subtitle {
              color: #6b7280;
              font-size: 18px;
              margin-bottom: 50px;
              font-weight: 500;
              text-transform: uppercase;
              letter-spacing: 2px;
            }
            .title {
              color: #1f2937;
              font-size: 32px;
              font-weight: 700;
              margin-bottom: 30px;
              text-transform: uppercase;
              letter-spacing: 2px;
              position: relative;
            }
            .title::after {
              content: '';
              position: absolute;
              bottom: -10px;
              left: 50%;
              transform: translateX(-50%);
              width: 80px;
              height: 3px;
              background: linear-gradient(90deg, #3b82f6, #8b5cf6);
              border-radius: 2px;
            }
            .content {
              color: #4b5563;
              font-size: 18px;
              margin-bottom: 25px;
              line-height: 1.7;
              font-weight: 400;
            }
            .student-name {
              color: #3b82f6;
              font-size: 28px;
              font-weight: 700;
              margin-bottom: 25px;
              text-transform: uppercase;
              letter-spacing: 2px;
              background: linear-gradient(135deg, #3b82f6, #8b5cf6);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
              background-clip: text;
            }
            .course-title {
              color: #1f2937;
              font-size: 24px;
              font-weight: 600;
              margin-bottom: 35px;
              line-height: 1.4;
              padding: 20px;
              background: linear-gradient(135deg, #f8fafc, #f1f5f9);
              border-radius: 12px;
              border-left: 4px solid #3b82f6;
            }
            .details {
              color: #6b7280;
              font-size: 14px;
              margin-bottom: 50px;
              line-height: 1.8;
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 20px;
              max-width: 600px;
              margin-left: auto;
              margin-right: auto;
            }
            .detail-item {
              background: linear-gradient(135deg, #f8fafc, #f1f5f9);
              padding: 15px;
              border-radius: 10px;
              border: 1px solid #e2e8f0;
            }
            .detail-label {
              font-weight: 600;
              color: #374151;
              font-size: 12px;
              text-transform: uppercase;
              letter-spacing: 1px;
              margin-bottom: 5px;
            }
            .detail-value {
              font-weight: 700;
              color: #3b82f6;
              font-size: 16px;
            }
            .certificate-id {
              color: #9ca3af;
              font-size: 11px;
              margin-top: 50px;
              font-style: italic;
              font-weight: 400;
            }
            .date {
              color: #4b5563;
              font-size: 16px;
              margin-bottom: 25px;
              font-weight: 600;
              background: linear-gradient(135deg, #3b82f6, #8b5cf6);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
              background-clip: text;
            }
            .signature-section {
              margin-top: 60px;
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
              padding: 0 80px;
            }
            .signature-box {
              text-align: center;
            }
            .signature-line {
              width: 180px;
              height: 2px;
              background: linear-gradient(90deg, #3b82f6, #8b5cf6);
              margin: 30px auto 10px;
              border-radius: 1px;
            }
            .signature-label {
              font-size: 12px;
              color: #6b7280;
              font-weight: 500;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            .seal {
              position: absolute;
              bottom: 30px;
              right: 30px;
              width: 80px;
              height: 80px;
              border: 3px solid #3b82f6;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 14px;
              color: #3b82f6;
              font-weight: 800;
              background: white;
              box-shadow: 0 8px 25px rgba(59, 130, 246, 0.2);
            }
            .seal::before {
              content: '';
              position: absolute;
              top: -2px;
              left: -2px;
              right: -2px;
              bottom: -2px;
              border: 1px solid #3b82f6;
              border-radius: 50%;
              opacity: 0.3;
            }
            .watermark {
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%) rotate(-45deg);
              font-size: 140px;
              color: rgba(59, 130, 246, 0.04);
              font-weight: 900;
              pointer-events: none;
              z-index: 0;
              letter-spacing: 8px;
            }
            .corner-decoration {
              position: absolute;
              width: 60px;
              height: 60px;
              border: 2px solid #3b82f6;
              opacity: 0.3;
            }
            .corner-decoration.top-left {
              top: 20px;
              left: 20px;
              border-right: none;
              border-bottom: none;
            }
            .corner-decoration.top-right {
              top: 20px;
              right: 20px;
              border-left: none;
              border-bottom: none;
            }
            .corner-decoration.bottom-left {
              bottom: 20px;
              left: 20px;
              border-right: none;
              border-top: none;
            }
            .corner-decoration.bottom-right {
              bottom: 20px;
              right: 20px;
              border-left: none;
              border-top: none;
            }
          </style>
        </head>
        <body>
          <div class="certificate">
            <div class="geometric-bg"></div>
            <div class="corner-decoration top-left"></div>
            <div class="corner-decoration top-right"></div>
            <div class="corner-decoration bottom-left"></div>
            <div class="corner-decoration bottom-right"></div>
            <div class="watermark">TEKRIDERS</div>
            <div class="content-wrapper">
              <div class="header">TekRiders</div>
              <div class="subtitle">E-Learning Platform</div>
              <div class="title">Certificate of Completion</div>
              <div class="content">This is to certify that</div>
              <div class="student-name">${user?.name || 'Student'}</div>
              <div class="content">has successfully completed the course</div>
              <div class="course-title">${certificate.courseTitle}</div>
              <div class="date">Completed on: ${new Date(certificate.completedAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}</div>
              <div class="details">
                <div class="detail-item">
                  <div class="detail-label">Progress</div>
                  <div class="detail-value">${certificate.progress}%</div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">Certificate ID</div>
                  <div class="detail-value">${certificate.certificateId}</div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">Status</div>
                  <div class="detail-value">Completed</div>
                </div>
              </div>
              <div class="signature-section">
                <div class="signature-box">
                  <div class="signature-line"></div>
                  <div class="signature-label">Platform Director</div>
                </div>
                <div class="signature-box">
                  <div class="signature-line"></div>
                  <div class="signature-label">Course Instructor</div>
                </div>
              </div>
              <div class="seal">TR</div>
              <div class="certificate-id">
                Generated by TekRiders E-Learning Platform<br>
                This certificate is valid and can be verified through our platform
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

      // Create blob and download
      const blob = new Blob([certificateHtml], { type: 'text/html' });
      const url = window.URL.createObjectURL(blob);
      
      // Create a new window for PDF generation
      const printWindow = window.open(url, '_blank', 'width=800,height=600');
      
      if (printWindow) {
        printWindow.onload = () => {
          // Auto-trigger print dialog with PDF option
          printWindow.print();
          
          // Close the window after a delay
          setTimeout(() => {
            printWindow.close();
          }, 3000);
        };
      } else {
        // Fallback: direct download as HTML file
        const link = document.createElement('a');
        link.href = url;
        link.download = `TekRiders_Certificate_${certificate.courseTitle.replace(/[^a-zA-Z0-9]/g, '_')}_${certificate.certificateId}.html`;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      
      window.URL.revokeObjectURL(url);
      
      // Show detailed instructions for PDF download
      const instructions = `
Certificate PDF Download Instructions:

1. A new window will open with your certificate
2. The print dialog will appear automatically
3. In the print dialog, select "Save as PDF" or "Microsoft Print to PDF"
4. Choose your downloads folder as the save location
5. Click "Save" to download the PDF

If the print dialog doesn't appear, press Ctrl+P (or Cmd+P on Mac) in the certificate window.
      `;
      
      alert(instructions);
    } catch (err: any) {
      console.error('Download error:', err);
      const errorMessage = err?.response?.data?.error || err?.message || 'Failed to download certificate';
      alert(errorMessage);
    }
  };

  const handleGenerateCertificate = async (courseId: string) => {
    try {
      setGeneratingCertificate(courseId);
      
      // Find the course details
      const course = completedCourses.find(c => c.courseId === courseId);
      if (!course) {
        alert('Course not found');
        return;
      }

      console.log('Generating certificate for course:', course.title);
      
      // Create a simple certificate with consistent URL
      const certificateId = `CERT-${courseId.slice(-4)}-${Date.now().toString(36)}`.toUpperCase();
      const certificate = {
        certificateId,
        courseId: courseId,
        courseTitle: course.title,
        completedAt: course.completedAt,
        progress: course.progress,
        downloadUrl: `/api/v1/certificates/download/${certificateId}`
      };
      
      // Add to certificates list
      setCertificates(prev => [...prev, certificate]);
      
      // Update completed courses to show certificate is generated
      setCompletedCourses(prev => prev.map(c => 
        c.courseId === courseId 
          ? { ...c, hasCertificate: true }
          : c
      ));
      
      alert('Certificate generated successfully!');
    } catch (err: any) {
      console.error('Generate certificate error:', err);
      const errorMessage = err?.response?.data?.error || err?.message || 'Failed to generate certificate';
      alert(errorMessage);
    } finally {
      setGeneratingCertificate(null);
    }
  };



  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center min-h-64">
          <LoadingSpinner />
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={() => window.location.reload()} className="mr-2">
            Retry
          </Button>
          <Button variant="outline" onClick={() => window.location.href = '/dashboard'}>
            Go to Dashboard
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {language === 'rw' ? 'Impamyabumenyi Zanjye' : 'My Certificates'}
              </h1>
              <p className="text-gray-600">
                {language === 'rw' 
                  ? 'Reba kandi kuraho impamyabumenyi zawe zo kurangira amasomo'
                  : 'View and download your course completion certificates'
                }
              </p>
            </div>
            

          </div>
        </div>

        {/* Certificates Section */}
        {certificates.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <Award className="w-5 h-5 mr-2 text-green-600" />
              {language === 'rw' ? 'Impamyabumenyi Zatangira' : 'Generated Certificates'}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {certificates.map((certificate) => (
                <Card key={certificate.certificateId} className="p-6 hover:shadow-lg transition-shadow">
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {certificate.courseTitle}
                      </h3>
                                          <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    </div>
                    </div>
                    <div className="space-y-1 text-sm text-gray-600">
                      <p>ID: {certificate.certificateId}</p>
                      <p className="flex items-center">
                        <Calendar className="w-4 h-4 mr-1" />
                        {new Date(certificate.completedAt).toLocaleDateString()}
                      </p>
                      <p>Progress: {certificate.progress}%</p>
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button 
                      onClick={() => handleDownload(certificate.certificateId)}
                      className="flex-1 bg-blue-500 hover:bg-blue-600 text-white transition-colors duration-200"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      {language === 'rw' ? 'Kuraho PDF' : 'Get PDF'}
                    </Button>

                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Completed Courses Section */}
        {completedCourses.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <BookOpen className="w-5 h-5 mr-2 text-blue-600" />
              {language === 'rw' ? 'Amasomo Arangiriye' : 'Completed Courses'}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {completedCourses.map((course) => (
                <Card key={course.courseId} className="p-6 hover:shadow-lg transition-shadow">
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {course.title}
                      </h3>
                      {course.hasCertificate ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <Award className="w-5 h-5 text-yellow-500" />
                      )}
                    </div>
                    <div className="space-y-1 text-sm text-gray-600">
                      <p className="flex items-center">
                        <Calendar className="w-4 h-4 mr-1" />
                        {new Date(course.completedAt).toLocaleDateString()}
                      </p>
                      <p>Progress: {course.progress}%</p>
                    </div>
                  </div>
                  
                  {!course.hasCertificate && (
                    <Button 
                      onClick={() => handleGenerateCertificate(course.courseId)}
                      disabled={generatingCertificate === course.courseId}
                      className="w-full bg-blue-500 hover:bg-blue-600 text-white transition-colors duration-200"
                    >
                      {generatingCertificate === course.courseId ? (
                        <>
                          <LoadingSpinner size="sm" />
                          <span className="ml-2">
                            {language === 'rw' ? 'Gutegura...' : 'Generating...'}
                          </span>
                        </>
                      ) : (
                        <>
                          <Award className="w-4 h-4 mr-2" />
                          {language === 'rw' ? 'Tegura Impamyabumenyi' : 'Generate Certificate'}
                        </>
                      )}
                    </Button>
                  )}
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {certificates.length === 0 && completedCourses.length === 0 && (
          <Card className="p-8 text-center">
            <div className="mb-4">
              <Award className="mx-auto h-12 w-12 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {language === 'rw' ? 'Nta mpamyabumenyi ubu' : 'No certificates yet'}
            </h3>
            <p className="text-gray-600 mb-4">
              {language === 'rw' 
                ? 'Rangira amasomo kugira ngo ubone impamyabumenyi. Impamyabumenyi zawe zizagaragara hano nyuma yo kurangira isomo.'
                : 'Complete courses to earn certificates. Your certificates will appear here once you finish a course.'
              }
            </p>
            <Button onClick={() => window.location.href = '/dashboard/courses'} className="bg-blue-500 hover:bg-blue-600 text-white transition-colors duration-200">
              <BookOpen className="w-4 h-4 mr-2" />
              {language === 'rw' ? 'Reba Amasomo' : 'Browse Courses'}
            </Button>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Certificates; 