import { createCanvas, loadImage, registerFont } from 'canvas';
import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { logger } from '../utils/logger';
import { config } from '../config/config';
import { Course, User, Enrollment } from '../types';

export interface CertificateData {
  studentName: string;
  courseTitle: string;
  instructorName: string;
  completionDate: string;
  certificateId: string;
  grade?: string;
  totalHours?: number;
  courseCategory?: string;
}

export interface CertificateTemplate {
  id: string;
  name: string;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  logoUrl?: string;
  watermark?: string;
  fontFamily: string;
}

export class CertificateService {
  private templates: CertificateTemplate[] = [
    {
      id: 'modern-blue',
      name: 'Modern Blue',
      backgroundColor: '#ffffff',
      textColor: '#1f2937',
      accentColor: '#3b82f6',
      fontFamily: 'Arial'
    },
    {
      id: 'elegant-gold',
      name: 'Elegant Gold',
      backgroundColor: '#fefefe',
      textColor: '#1f2937',
      accentColor: '#f59e0b',
      fontFamily: 'Georgia'
    },
    {
      id: 'professional-dark',
      name: 'Professional Dark',
      backgroundColor: '#1f2937',
      textColor: '#ffffff',
      accentColor: '#10b981',
      fontFamily: 'Arial'
    }
  ];

  constructor() {
    // Register custom fonts if available
    try {
      registerFont(path.join(__dirname, '../../assets/fonts/OpenSans-Regular.ttf'), { family: 'Open Sans' });
      registerFont(path.join(__dirname, '../../assets/fonts/OpenSans-Bold.ttf'), { family: 'Open Sans Bold' });
    } catch (error) {
      logger.warn('Custom fonts not available, using system fonts');
    }
  }

  /**
   * Generate a completion certificate
   */
  async generateCertificate(
    certificateData: CertificateData,
    templateId: string = 'modern-blue',
    outputPath?: string
  ): Promise<{ buffer: Buffer; filename: string }> {
    try {
      const template = this.templates.find(t => t.id === templateId) || this.templates[0];
      
      if (!template) {
        throw new Error('No certificate template available');
      }
      
      // Create canvas
      const canvas = createCanvas(1200, 800);
      const ctx = canvas.getContext('2d');

      // Set background
      ctx.fillStyle = template.backgroundColor;
      ctx.fillRect(0, 0, 1200, 800);

      // Add border
      ctx.strokeStyle = template.accentColor;
      ctx.lineWidth = 8;
      ctx.strokeRect(20, 20, 1160, 760);

      // Add inner border
      ctx.strokeStyle = template.accentColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(40, 40, 1120, 720);

      // Add decorative corner elements
      this.drawCornerElements(ctx, template.accentColor);

      // Add header
      await this.drawHeader(ctx, template);

      // Add main content
      this.drawMainContent(ctx, certificateData, template);

      // Add footer
      this.drawFooter(ctx, template);

      // Add watermark
      this.drawWatermark(ctx, template);

      // Generate filename
      const filename = `certificate_${certificateData.certificateId}_${Date.now()}.png`;
      const fullPath = outputPath || path.join(__dirname, '../../uploads/certificates', filename);

      // Ensure directory exists
      const dir = path.dirname(fullPath);
      mkdirSync(dir, { recursive: true });

      // Save to file
      const buffer = canvas.toBuffer('image/png');
      writeFileSync(fullPath, buffer);

      logger.info('Certificate generated successfully:', {
        certificateId: certificateData.certificateId,
        studentName: certificateData.studentName,
        courseTitle: certificateData.courseTitle,
        filename
      });

      return { buffer, filename };
    } catch (error) {
      logger.error('Failed to generate certificate:', error);
      throw new Error('Certificate generation failed');
    }
  }

  /**
   * Draw decorative corner elements
   */
  private drawCornerElements(ctx: any, color: string): void {
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;

    // Top-left corner
    ctx.beginPath();
    ctx.moveTo(60, 80);
    ctx.lineTo(120, 80);
    ctx.moveTo(80, 60);
    ctx.lineTo(80, 120);
    ctx.stroke();

    // Top-right corner
    ctx.beginPath();
    ctx.moveTo(1140, 80);
    ctx.lineTo(1080, 80);
    ctx.moveTo(1120, 60);
    ctx.lineTo(1120, 120);
    ctx.stroke();

    // Bottom-left corner
    ctx.beginPath();
    ctx.moveTo(60, 720);
    ctx.lineTo(120, 720);
    ctx.moveTo(80, 680);
    ctx.lineTo(80, 740);
    ctx.stroke();

    // Bottom-right corner
    ctx.beginPath();
    ctx.moveTo(1140, 720);
    ctx.lineTo(1080, 720);
    ctx.moveTo(1120, 680);
    ctx.lineTo(1120, 740);
    ctx.stroke();
  }

  /**
   * Draw certificate header
   */
  private async drawHeader(ctx: any, template: CertificateTemplate): Promise<void> {
    // Logo placeholder
    ctx.fillStyle = template.accentColor;
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('TekRiders', 600, 120);

    // Subtitle
    ctx.fillStyle = template.textColor;
    ctx.font = '24px Arial';
    ctx.fillText('E-Learning Platform', 600, 160);

    // Certificate title
    ctx.fillStyle = template.accentColor;
    ctx.font = 'bold 36px Arial';
    ctx.fillText('Certificate of Completion', 600, 220);
  }

  /**
   * Draw main certificate content
   */
  private drawMainContent(ctx: any, data: CertificateData, template: CertificateTemplate): void {
    // This is to certify that
    ctx.fillStyle = template.textColor;
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('This is to certify that', 600, 300);

    // Student name
    ctx.fillStyle = template.accentColor;
    ctx.font = 'bold 32px Arial';
    ctx.fillText(data.studentName, 600, 350);

    // Has successfully completed
    ctx.fillStyle = template.textColor;
    ctx.font = '20px Arial';
    ctx.fillText('has successfully completed the course', 600, 390);

    // Course title
    ctx.fillStyle = template.accentColor;
    ctx.font = 'bold 28px Arial';
    ctx.fillText(data.courseTitle, 600, 430);

    // Instructor
    ctx.fillStyle = template.textColor;
    ctx.font = '18px Arial';
    ctx.fillText(`Instructor: ${data.instructorName}`, 600, 470);

    // Completion date
    const completionDate = new Date(data.completionDate).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    ctx.fillText(`Completed on: ${completionDate}`, 600, 500);

    // Certificate ID
    ctx.font = '14px Arial';
    ctx.fillText(`Certificate ID: ${data.certificateId}`, 600, 530);

    // Grade (if available)
    if (data.grade) {
      ctx.fillText(`Grade: ${data.grade}`, 600, 560);
    }

    // Total hours (if available)
    if (data.totalHours) {
      ctx.fillText(`Total Hours: ${data.totalHours}`, 600, 590);
    }
  }

  /**
   * Draw certificate footer
   */
  private drawFooter(ctx: any, template: CertificateTemplate): void {
    // Signature line
    ctx.strokeStyle = template.accentColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(400, 650);
    ctx.lineTo(600, 650);
    ctx.stroke();

    // Signature label
    ctx.fillStyle = template.textColor;
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Platform Director', 500, 680);

    // Verification note
    ctx.font = '14px Arial';
    ctx.fillText('This certificate can be verified at:', 600, 720);
    ctx.fillText('https://tekriders.com/verify', 600, 740);
  }

  /**
   * Draw watermark
   */
  private drawWatermark(ctx: any, template: CertificateTemplate): void {
    ctx.save();
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = template.accentColor;
    ctx.font = 'bold 120px Arial';
    ctx.textAlign = 'center';
    ctx.translate(600, 400);
    ctx.rotate(-Math.PI / 6);
    ctx.fillText('TEKRIDERS', 0, 0);
    ctx.restore();
  }

  /**
   * Generate certificate ID
   */
  generateCertificateId(studentId: string, courseId: string): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `CERT-${studentId.slice(-4)}-${courseId.slice(-4)}-${timestamp}-${random}`.toUpperCase();
  }

  /**
   * Verify certificate authenticity
   */
  async verifyCertificate(certificateId: string): Promise<{
    isValid: boolean;
    certificateData?: CertificateData;
    error?: string;
  }> {
    try {
      // In a real implementation, you would check against a database
      // For now, we'll validate the format
      const isValidFormat = /^CERT-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]+-[A-Z0-9]{5}$/.test(certificateId);
      
      if (!isValidFormat) {
        return { isValid: false, error: 'Invalid certificate format' };
      }

      // Here you would typically:
      // 1. Look up the certificate in the database
      // 2. Verify the student and course exist
      // 3. Check if the certificate hasn't been revoked
      // 4. Return the certificate data

      return { isValid: true };
    } catch (error) {
      logger.error('Certificate verification failed:', error);
      return { isValid: false, error: 'Verification failed' };
    }
  }

  /**
   * Get available certificate templates
   */
  getTemplates(): CertificateTemplate[] {
    return this.templates;
  }

  /**
   * Create certificate data from enrollment
   */
  createCertificateData(
    enrollment: Enrollment,
    course: Course,
    student: User,
    instructor: User
  ): CertificateData {
    const certificateId = this.generateCertificateId(student.id, course.id);
    
    return {
      studentName: student.name,
      courseTitle: course.title,
      instructorName: instructor.name,
      completionDate: enrollment.completedAt || new Date().toISOString(),
      certificateId,
      courseCategory: course.category,
      totalHours: Math.round((course.totalDuration || 0) / 3600) // Convert seconds to hours
    };
  }
}

export const certificateService = new CertificateService(); 