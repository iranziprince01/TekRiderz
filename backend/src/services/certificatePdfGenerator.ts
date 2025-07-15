import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { createCanvas } from 'canvas';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import path from 'path';
import { Certificate } from '../types';
import { logger } from '../utils/logger';

export class CertificatePdfGenerator {
  private readonly uploadsDir: string;
  private readonly certificatesDir: string;

  constructor() {
    this.uploadsDir = path.join(__dirname, '../../uploads');
    this.certificatesDir = path.join(this.uploadsDir, 'certificates');
    this.ensureDirectoryExists();
  }

  private async ensureDirectoryExists(): Promise<void> {
    try {
      await fs.mkdir(this.certificatesDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create certificates directory:', error);
    }
  }

  /**
   * Generate PDF certificate
   */
  async generateCertificatePdf(certificate: Certificate): Promise<{ filePath: string; fileSize: number }> {
    try {
      const fileName = `certificate_${certificate.certificateNumber}.pdf`;
      const filePath = path.join(this.certificatesDir, fileName);

      // Create PDF document
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margin: 50,
      });

      // Generate QR code
      const qrCodeDataUrl = await this.generateQRCode(certificate.verificationUrl);

      // Generate certificate based on template type
      switch (certificate.templateType) {
        case 'excellence':
          await this.generateExcellenceTemplate(doc, certificate, qrCodeDataUrl);
          break;
        case 'achievement':
          await this.generateAchievementTemplate(doc, certificate, qrCodeDataUrl);
          break;
        case 'completion':
        default:
          await this.generateCompletionTemplate(doc, certificate, qrCodeDataUrl);
          break;
      }

      // Save to file
      const stream = doc.pipe(createWriteStream(filePath));
      doc.end();

      // Wait for file to be written
      await new Promise<void>((resolve, reject) => {
        stream.on('finish', () => resolve());
        stream.on('error', reject);
      });

      // Get file size
      const stats = await fs.stat(filePath);
      const fileSize = stats.size;

      logger.info('Certificate PDF generated successfully', {
        certificateId: certificate._id,
        fileName,
        fileSize,
        templateType: certificate.templateType,
      });

      return { filePath, fileSize };
    } catch (error) {
      logger.error('Failed to generate certificate PDF:', error);
      throw error;
    }
  }

  /**
   * Generate QR code for verification
   */
  private async generateQRCode(verificationUrl: string): Promise<string> {
    try {
      return await QRCode.toDataURL(verificationUrl, {
        width: 100,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });
    } catch (error) {
      logger.error('Failed to generate QR code:', error);
      return '';
    }
  }

  /**
   * Generate completion certificate template
   */
  private async generateCompletionTemplate(
    doc: typeof PDFDocument,
    certificate: Certificate,
    qrCodeDataUrl: string
  ): Promise<void> {
    const { width, height } = doc.page;
    const centerX = width / 2;

    // Background and border
    doc.rect(20, 20, width - 40, height - 40)
       .lineWidth(3)
       .stroke('#2563eb');

    doc.rect(30, 30, width - 60, height - 60)
       .lineWidth(1)
       .stroke('#94a3b8');

    // Header
    doc.fontSize(32)
       .fillColor('#1e40af')
       .font('Helvetica-Bold')
       .text('CERTIFICATE OF COMPLETION', centerX - 200, 80, { align: 'center', width: 400 });

    // Decorative line
    doc.moveTo(centerX - 150, 125)
       .lineTo(centerX + 150, 125)
       .lineWidth(2)
       .stroke('#2563eb');

    // Main content
    doc.fontSize(18)
       .fillColor('#374151')
       .font('Helvetica')
       .text('This is to certify that', centerX - 100, 160, { align: 'center', width: 200 });

    doc.fontSize(28)
       .fillColor('#1f2937')
       .font('Helvetica-Bold')
       .text(certificate.learnerName, centerX - 200, 190, { align: 'center', width: 400 });

    doc.fontSize(18)
       .fillColor('#374151')
       .font('Helvetica')
       .text('has successfully completed the course', centerX - 150, 230, { align: 'center', width: 300 });

    doc.fontSize(24)
       .fillColor('#1e40af')
       .font('Helvetica-Bold')
       .text(certificate.courseName, centerX - 250, 260, { align: 'center', width: 500 });

    // Course details
    doc.fontSize(14)
       .fillColor('#6b7280')
       .font('Helvetica')
       .text(`Instructor: ${certificate.instructorName}`, centerX - 200, 310, { align: 'center', width: 400 });

    doc.text(`Duration: ${Math.round(certificate.totalDuration / 60)} hours`, centerX - 200, 330, { align: 'center', width: 400 });

    doc.text(`Grade: ${certificate.certificateData.grade} (${certificate.finalGrade}%)`, centerX - 200, 350, { align: 'center', width: 400 });

    // Date and signature area
    doc.fontSize(12)
       .fillColor('#374151')
       .text(`Completed on: ${new Date(certificate.completedAt).toLocaleDateString()}`, 80, height - 120);

    doc.text(`Issued on: ${new Date(certificate.issuedAt).toLocaleDateString()}`, 80, height - 100);

    doc.text(`Certificate Number: ${certificate.certificateNumber}`, 80, height - 80);

    // QR Code
    if (qrCodeDataUrl) {
      doc.image(qrCodeDataUrl, width - 150, height - 150, { width: 80, height: 80 });
      doc.fontSize(10)
         .fillColor('#6b7280')
         .text('Scan to verify', width - 150, height - 60, { width: 80, align: 'center' });
    }

    // Signature line
    doc.moveTo(width - 250, height - 80)
       .lineTo(width - 80, height - 80)
       .stroke('#94a3b8');

    doc.fontSize(12)
       .fillColor('#374151')
       .text('Digital Certificate', width - 250, height - 60, { width: 170, align: 'center' });
  }

  /**
   * Generate achievement certificate template
   */
  private async generateAchievementTemplate(
    doc: typeof PDFDocument,
    certificate: Certificate,
    qrCodeDataUrl: string
  ): Promise<void> {
    const { width, height } = doc.page;
    const centerX = width / 2;

    // Background and decorative border
    doc.rect(20, 20, width - 40, height - 40)
       .lineWidth(4)
       .stroke('#059669');

    doc.rect(30, 30, width - 60, height - 60)
       .lineWidth(2)
       .stroke('#10b981');

    // Decorative corners
    this.addDecorativeCorners(doc, '#059669');

    // Header with achievement styling
    doc.fontSize(36)
       .fillColor('#047857')
       .font('Helvetica-Bold')
       .text('CERTIFICATE OF ACHIEVEMENT', centerX - 250, 70, { align: 'center', width: 500 });

    // Decorative elements
    doc.moveTo(centerX - 180, 115)
       .lineTo(centerX + 180, 115)
       .lineWidth(3)
       .stroke('#10b981');

    // Achievement badge
    doc.circle(centerX, 140, 20)
       .fillColor('#10b981')
       .fill();

    doc.fontSize(14)
       .fillColor('#ffffff')
       .font('Helvetica-Bold')
       .text('★', centerX - 7, 133);

    // Main content
    doc.fontSize(18)
       .fillColor('#374151')
       .font('Helvetica')
       .text('This is to certify that', centerX - 100, 180, { align: 'center', width: 200 });

    doc.fontSize(30)
       .fillColor('#1f2937')
       .font('Helvetica-Bold')
       .text(certificate.learnerName, centerX - 200, 210, { align: 'center', width: 400 });

    doc.fontSize(18)
       .fillColor('#374151')
       .font('Helvetica')
       .text('has demonstrated exceptional performance in', centerX - 180, 250, { align: 'center', width: 360 });

    doc.fontSize(26)
       .fillColor('#047857')
       .font('Helvetica-Bold')
       .text(certificate.courseName, centerX - 250, 280, { align: 'center', width: 500 });

    // Achievement details
    doc.fontSize(16)
       .fillColor('#059669')
       .font('Helvetica-Bold')
       .text(`Outstanding Grade: ${certificate.certificateData.grade} (${certificate.finalGrade}%)`, centerX - 200, 320, { align: 'center', width: 400 });

    // Achievements list
    if (certificate.certificateData.achievements && certificate.certificateData.achievements.length > 0) {
      doc.fontSize(14)
         .fillColor('#374151')
         .font('Helvetica')
         .text('Achievements:', centerX - 200, 350, { align: 'center', width: 400 });

      certificate.certificateData.achievements.slice(0, 3).forEach((achievement, index) => {
        doc.fontSize(12)
           .fillColor('#059669')
           .text(`• ${achievement}`, centerX - 200, 370 + (index * 15), { align: 'center', width: 400 });
      });
    }

    // Course details
    doc.fontSize(14)
       .fillColor('#6b7280')
       .font('Helvetica')
       .text(`Instructor: ${certificate.instructorName}`, centerX - 200, 430, { align: 'center', width: 400 });

    // Date and certificate info
    doc.fontSize(12)
       .fillColor('#374151')
       .text(`Completed: ${new Date(certificate.completedAt).toLocaleDateString()}`, 80, height - 120);

    doc.text(`Issued: ${new Date(certificate.issuedAt).toLocaleDateString()}`, 80, height - 100);

    doc.text(`Certificate No: ${certificate.certificateNumber}`, 80, height - 80);

    // QR Code
    if (qrCodeDataUrl) {
      doc.image(qrCodeDataUrl, width - 150, height - 150, { width: 80, height: 80 });
      doc.fontSize(10)
         .fillColor('#6b7280')
         .text('Verify Certificate', width - 150, height - 60, { width: 80, align: 'center' });
    }

    // Digital signature
    doc.moveTo(width - 250, height - 80)
       .lineTo(width - 80, height - 80)
       .stroke('#94a3b8');

    doc.fontSize(12)
       .fillColor('#047857')
       .font('Helvetica-Bold')
       .text('Digital Certificate of Achievement', width - 250, height - 60, { width: 170, align: 'center' });
  }

  /**
   * Generate excellence certificate template
   */
  private async generateExcellenceTemplate(
    doc: typeof PDFDocument,
    certificate: Certificate,
    qrCodeDataUrl: string
  ): Promise<void> {
    const { width, height } = doc.page;
    const centerX = width / 2;

    // Premium background with gradient effect
    doc.rect(20, 20, width - 40, height - 40)
       .lineWidth(5)
       .stroke('#dc2626');

    doc.rect(30, 30, width - 60, height - 60)
       .lineWidth(2)
       .stroke('#fbbf24');

    doc.rect(35, 35, width - 70, height - 70)
       .lineWidth(1)
       .stroke('#dc2626');

    // Premium decorative elements
    this.addPremiumDecorations(doc, '#dc2626', '#fbbf24');

    // Header with excellence styling
    doc.fontSize(40)
       .fillColor('#dc2626')
       .font('Helvetica-Bold')
       .text('CERTIFICATE OF EXCELLENCE', centerX - 280, 60, { align: 'center', width: 560 });

    // Premium decorative line
    doc.moveTo(centerX - 200, 110)
       .lineTo(centerX + 200, 110)
       .lineWidth(4)
       .stroke('#fbbf24');

    // Excellence badge
    doc.circle(centerX, 135, 25)
       .fillColor('#dc2626')
       .fill();

    doc.fontSize(20)
       .fillColor('#ffffff')
       .font('Helvetica-Bold')
       .text('★', centerX - 10, 125);

    // Premium content
    doc.fontSize(20)
       .fillColor('#374151')
       .font('Helvetica')
       .text('This is to certify that', centerX - 120, 175, { align: 'center', width: 240 });

    doc.fontSize(34)
       .fillColor('#1f2937')
       .font('Helvetica-Bold')
       .text(certificate.learnerName, centerX - 250, 205, { align: 'center', width: 500 });

    doc.fontSize(20)
       .fillColor('#374151')
       .font('Helvetica')
       .text('has achieved excellence in', centerX - 150, 245, { align: 'center', width: 300 });

    doc.fontSize(28)
       .fillColor('#dc2626')
       .font('Helvetica-Bold')
       .text(certificate.courseName, centerX - 300, 275, { align: 'center', width: 600 });

    // Excellence details
    doc.fontSize(18)
       .fillColor('#dc2626')
       .font('Helvetica-Bold')
       .text(`Excellent Grade: ${certificate.certificateData.grade} (${certificate.finalGrade}%)`, centerX - 200, 315, { align: 'center', width: 400 });

    // Premium achievements
    if (certificate.certificateData.achievements && certificate.certificateData.achievements.length > 0) {
      doc.fontSize(16)
         .fillColor('#374151')
         .font('Helvetica-Bold')
         .text('Distinguished Achievements:', centerX - 250, 345, { align: 'center', width: 500 });

      certificate.certificateData.achievements.slice(0, 4).forEach((achievement, index) => {
        doc.fontSize(14)
           .fillColor('#dc2626')
           .font('Helvetica')
           .text(`★ ${achievement}`, centerX - 250, 365 + (index * 18), { align: 'center', width: 500 });
      });
    }

    // Course details
    doc.fontSize(16)
       .fillColor('#6b7280')
       .font('Helvetica')
       .text(`Distinguished Instructor: ${certificate.instructorName}`, centerX - 250, 430, { align: 'center', width: 500 });

    // Date and certificate info
    doc.fontSize(12)
       .fillColor('#374151')
       .text(`Completed: ${new Date(certificate.completedAt).toLocaleDateString()}`, 80, height - 120);

    doc.text(`Issued: ${new Date(certificate.issuedAt).toLocaleDateString()}`, 80, height - 100);

    doc.text(`Certificate No: ${certificate.certificateNumber}`, 80, height - 80);

    // QR Code
    if (qrCodeDataUrl) {
      doc.image(qrCodeDataUrl, width - 150, height - 150, { width: 80, height: 80 });
      doc.fontSize(10)
         .fillColor('#6b7280')
         .text('Verify Excellence', width - 150, height - 60, { width: 80, align: 'center' });
    }

    // Premium signature
    doc.moveTo(width - 280, height - 80)
       .lineTo(width - 80, height - 80)
       .stroke('#dc2626');

    doc.fontSize(14)
       .fillColor('#dc2626')
       .font('Helvetica-Bold')
       .text('Certificate of Excellence', width - 280, height - 60, { width: 200, align: 'center' });
  }

  /**
   * Add decorative corners for achievement template
   */
  private addDecorativeCorners(doc: typeof PDFDocument, color: string): void {
    const cornerSize = 30;
    
    // Top left corner
    doc.moveTo(50, 50)
       .lineTo(50 + cornerSize, 50)
       .moveTo(50, 50)
       .lineTo(50, 50 + cornerSize)
       .lineWidth(2)
       .stroke(color);

    // Top right corner
    doc.moveTo(doc.page.width - 50, 50)
       .lineTo(doc.page.width - 50 - cornerSize, 50)
       .moveTo(doc.page.width - 50, 50)
       .lineTo(doc.page.width - 50, 50 + cornerSize)
       .stroke(color);

    // Bottom left corner
    doc.moveTo(50, doc.page.height - 50)
       .lineTo(50 + cornerSize, doc.page.height - 50)
       .moveTo(50, doc.page.height - 50)
       .lineTo(50, doc.page.height - 50 - cornerSize)
       .stroke(color);

    // Bottom right corner
    doc.moveTo(doc.page.width - 50, doc.page.height - 50)
       .lineTo(doc.page.width - 50 - cornerSize, doc.page.height - 50)
       .moveTo(doc.page.width - 50, doc.page.height - 50)
       .lineTo(doc.page.width - 50, doc.page.height - 50 - cornerSize)
       .stroke(color);
  }

  /**
   * Add premium decorations for excellence template
   */
  private addPremiumDecorations(doc: typeof PDFDocument, primaryColor: string, secondaryColor: string): void {
    // Add diamond shapes in corners
    const diamondSize = 20;
    
    // Top corners
    this.drawDiamond(doc, 70, 70, diamondSize, primaryColor);
    this.drawDiamond(doc, doc.page.width - 70, 70, diamondSize, secondaryColor);
    
    // Bottom corners
    this.drawDiamond(doc, 70, doc.page.height - 70, diamondSize, secondaryColor);
    this.drawDiamond(doc, doc.page.width - 70, doc.page.height - 70, diamondSize, primaryColor);
  }

  /**
   * Draw diamond shape
   */
  private drawDiamond(doc: typeof PDFDocument, x: number, y: number, size: number, color: string): void {
    doc.polygon([x, y - size], [x + size, y], [x, y + size], [x - size, y])
       .fillColor(color)
       .fill();
  }

  /**
   * Get certificate file path
   */
  getCertificateFilePath(certificateNumber: string): string {
    return path.join(this.certificatesDir, `certificate_${certificateNumber}.pdf`);
  }

  /**
   * Check if certificate file exists
   */
  async certificateFileExists(certificateNumber: string): Promise<boolean> {
    try {
      const filePath = this.getCertificateFilePath(certificateNumber);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete certificate file
   */
  async deleteCertificateFile(certificateNumber: string): Promise<boolean> {
    try {
      const filePath = this.getCertificateFilePath(certificateNumber);
      await fs.unlink(filePath);
      logger.info('Certificate file deleted', { certificateNumber });
      return true;
    } catch (error) {
      logger.error('Failed to delete certificate file:', error);
      return false;
    }
  }
}

export const certificatePdfGenerator = new CertificatePdfGenerator(); 