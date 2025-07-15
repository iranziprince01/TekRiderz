import nodemailer from 'nodemailer';
import { config } from '../config/config';
import { EmailOptions, EmailTemplate } from '../types';
import { logger } from '../utils/logger';

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.secure,
      auth: {
        user: config.email.auth.user,
        pass: config.email.auth.pass,
      },
      // Enable debug logging in development
      debug: config.server.nodeEnv === 'development',
      logger: config.server.nodeEnv === 'development',
    });
  }

  // Verify email configuration
  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      logger.info('Email service connection verified');
      return true;
    } catch (error) {
      logger.error('Email service connection failed:', error);
      return false;
    }
  }

  // Send email
  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      const mailOptions = {
        from: `${config.email.from.name} <${config.email.from.email}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        attachments: options.attachments,
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      logger.info('Email sent successfully', {
        to: options.to,
        subject: options.subject,
        messageId: result.messageId,
      });

      return true;
    } catch (error) {
      logger.error('Failed to send email:', {
        to: options.to,
        subject: options.subject,
        error,
      });
      return false;
    }
  }

  // Send OTP email
  async sendOTPEmail(email: string, otp: string, purpose: string): Promise<boolean> {
    const template = this.getOTPTemplate(otp, purpose);
    
    return await this.sendEmail({
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  // Get OTP email template
  private getOTPTemplate(otp: string, purpose: string): EmailTemplate {
    const templates = {
      signup: {
        subject: 'Welcome to TekRiders - Verify Your Account',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #4F46E5; margin: 0;">TekRiders</h1>
              <p style="color: #6B7280; margin: 5px 0;">E-Learning Platform</p>
            </div>
            
            <div style="background: #F8FAFC; border-radius: 12px; padding: 30px; margin: 20px 0;">
              <h2 style="color: #1F2937; margin: 0 0 20px 0;">Welcome to TekRiders!</h2>
              <p style="color: #4B5563; line-height: 1.6; margin: 0 0 20px 0;">
                Thank you for joining our e-learning platform. To complete your registration, 
                please verify your email address using the code below:
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <div style="background: #4F46E5; color: white; font-size: 32px; font-weight: bold; 
                           letter-spacing: 8px; padding: 20px; border-radius: 8px; display: inline-block;">
                  ${otp}
                </div>
              </div>
              
              <p style="color: #6B7280; font-size: 14px; margin: 20px 0 0 0;">
                This code will expire in 10 minutes. If you didn't create an account with TekRiders, 
                please ignore this email.
              </p>
            </div>
            
            <div style="text-align: center; margin-top: 30px;">
              <p style="color: #9CA3AF; font-size: 12px;">
                © ${new Date().getFullYear()} TekRiders. All rights reserved.
              </p>
            </div>
          </div>
        `,
        text: `
Welcome to TekRiders!

Your verification code is: ${otp}

This code will expire in 10 minutes. Enter this code in the app to verify your account.

If you didn't create an account with TekRiders, please ignore this email.

© ${new Date().getFullYear()} TekRiders. All rights reserved.
        `,
      },
      'password-reset': {
        subject: 'TekRiders - Reset Your Password',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #4F46E5; margin: 0;">TekRiders</h1>
              <p style="color: #6B7280; margin: 5px 0;">E-Learning Platform</p>
            </div>
            
            <div style="background: #FEF2F2; border-radius: 12px; padding: 30px; margin: 20px 0; border-left: 4px solid #EF4444;">
              <h2 style="color: #DC2626; margin: 0 0 20px 0;">Password Reset Request</h2>
              <p style="color: #4B5563; line-height: 1.6; margin: 0 0 20px 0;">
                We received a request to reset your password. Use the code below to reset your password:
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <div style="background: #DC2626; color: white; font-size: 32px; font-weight: bold; 
                           letter-spacing: 8px; padding: 20px; border-radius: 8px; display: inline-block;">
                  ${otp}
                </div>
              </div>
              
              <p style="color: #6B7280; font-size: 14px; margin: 20px 0 0 0;">
                This code will expire in 10 minutes. If you didn't request a password reset, 
                please ignore this email and your password will remain unchanged.
              </p>
            </div>
            
            <div style="text-align: center; margin-top: 30px;">
              <p style="color: #9CA3AF; font-size: 12px;">
                © ${new Date().getFullYear()} TekRiders. All rights reserved.
              </p>
            </div>
          </div>
        `,
        text: `
TekRiders - Password Reset

Your password reset code is: ${otp}

This code will expire in 10 minutes. Enter this code in the app to reset your password.

If you didn't request a password reset, please ignore this email.

© ${new Date().getFullYear()} TekRiders. All rights reserved.
        `,
      },
      'email-verification': {
        subject: 'TekRiders - Verify Your Email Address',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #4F46E5; margin: 0;">TekRiders</h1>
              <p style="color: #6B7280; margin: 5px 0;">E-Learning Platform</p>
            </div>
            
            <div style="background: #F0F9FF; border-radius: 12px; padding: 30px; margin: 20px 0; border-left: 4px solid #0EA5E9;">
              <h2 style="color: #0369A1; margin: 0 0 20px 0;">Email Verification</h2>
              <p style="color: #4B5563; line-height: 1.6; margin: 0 0 20px 0;">
                Please verify your email address using the code below:
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <div style="background: #0EA5E9; color: white; font-size: 32px; font-weight: bold; 
                           letter-spacing: 8px; padding: 20px; border-radius: 8px; display: inline-block;">
                  ${otp}
                </div>
              </div>
              
              <p style="color: #6B7280; font-size: 14px; margin: 20px 0 0 0;">
                This code will expire in 10 minutes.
              </p>
            </div>
            
            <div style="text-align: center; margin-top: 30px;">
              <p style="color: #9CA3AF; font-size: 12px;">
                © ${new Date().getFullYear()} TekRiders. All rights reserved.
              </p>
            </div>
          </div>
        `,
        text: `
TekRiders - Email Verification

Your verification code is: ${otp}

This code will expire in 10 minutes. Enter this code in the app to verify your email.

© ${new Date().getFullYear()} TekRiders. All rights reserved.
        `,
      },
    };

    return templates[purpose as keyof typeof templates] || templates.signup;
  }

  // Send welcome email after successful verification
  async sendWelcomeEmail(email: string, name: string, role: string): Promise<boolean> {
    const subject = 'Welcome to TekRiders - Let\'s Start Learning!';
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #4F46E5; margin: 0;">TekRiders</h1>
          <p style="color: #6B7280; margin: 5px 0;">E-Learning Platform</p>
        </div>
        
        <div style="background: #F0FDF4; border-radius: 12px; padding: 30px; margin: 20px 0; border-left: 4px solid #10B981;">
          <h2 style="color: #059669; margin: 0 0 20px 0;">Welcome to TekRiders, ${name}!</h2>
          <p style="color: #4B5563; line-height: 1.6; margin: 0 0 20px 0;">
            Congratulations! Your account has been successfully verified. You're now ready to ${
              role === 'tutor' ? 'start teaching and sharing your knowledge' : 'begin your learning journey'
            }.
          </p>
          
          <div style="margin: 30px 0;">
            <h3 style="color: #374151; margin: 0 0 15px 0;">What's next?</h3>
            <ul style="color: #4B5563; line-height: 1.8; margin: 0; padding-left: 20px;">
              ${role === 'tutor' ? `
                <li>Create your first course and start teaching</li>
                <li>Build your tutor profile to attract students</li>
                <li>Explore our course creation tools</li>
                <li>Join our tutor community</li>
              ` : `
                <li>Browse our extensive course catalog</li>
                <li>Complete your learner profile</li>
                <li>Start your first course</li>
                <li>Track your learning progress</li>
              `}
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${config.cors.frontendUrl}/dashboard" 
               style="background: #4F46E5; color: white; text-decoration: none; 
                      padding: 15px 30px; border-radius: 8px; font-weight: bold; display: inline-block;">
              Go to Dashboard
            </a>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 30px;">
          <p style="color: #9CA3AF; font-size: 12px;">
            © ${new Date().getFullYear()} TekRiders. All rights reserved.
          </p>
        </div>
      </div>
    `;

    const text = `
Welcome to TekRiders, ${name}!

Your account has been successfully verified. You're now ready to ${
  role === 'tutor' ? 'start teaching and sharing your knowledge' : 'begin your learning journey'
}.

Visit your dashboard: ${config.cors.frontendUrl}/dashboard

© ${new Date().getFullYear()} TekRiders. All rights reserved.
    `;

    return await this.sendEmail({
      to: email,
      subject,
      html,
      text,
    });
  }

  // Send course approval notification
  async sendCourseApprovalEmail(email: string, courseName: string, approved: boolean, reason?: string, feedback?: any): Promise<boolean> {
    const subject = approved 
      ? `Your course "${courseName}" has been approved!`
      : `Course submission requires changes - "${courseName}"`;

    const html = approved ? `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #F0FDF4; border-radius: 12px; padding: 30px; margin: 20px 0; border-left: 4px solid #10B981;">
          <h2 style="color: #059669; margin: 0 0 20px 0;">Course Approved!</h2>
          <p style="color: #4B5563; line-height: 1.6;">
            Great news! Your course "<strong>${courseName}</strong>" has been approved and is now live on TekRiders.
          </p>
          ${feedback ? `
            <div style="margin: 20px 0;">
              <h3 style="color: #374151; margin: 0 0 10px 0;">Review Feedback:</h3>
              <p style="color: #4B5563; line-height: 1.6;"><strong>Overall Score:</strong> ${feedback.overallScore}/100</p>
              ${feedback.feedback?.strengths?.length > 0 ? `
                <div style="margin: 10px 0;">
                  <strong style="color: #059669;">Strengths:</strong>
                  <ul style="color: #4B5563; margin: 5px 0; padding-left: 20px;">
                    ${feedback.feedback.strengths.map((strength: string) => `<li>${strength}</li>`).join('')}
                  </ul>
                </div>
              ` : ''}
            </div>
          ` : ''}
          <div style="text-align: center; margin: 30px 0;">
            <a href="${config.cors.frontendUrl}/tutor/courses" 
               style="background: #4F46E5; color: white; text-decoration: none; 
                      padding: 15px 30px; border-radius: 8px; font-weight: bold; display: inline-block;">
              View Course
            </a>
          </div>
        </div>
      </div>
    ` : `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #FEF2F2; border-radius: 12px; padding: 30px; margin: 20px 0; border-left: 4px solid #EF4444;">
          <h2 style="color: #DC2626; margin: 0 0 20px 0;">Course Needs Updates</h2>
          <p style="color: #4B5563; line-height: 1.6;">
            Your course "<strong>${courseName}</strong>" requires some changes before it can be published.
          </p>
          ${reason ? `<p style="color: #4B5563; line-height: 1.6;"><strong>Feedback:</strong> ${reason}</p>` : ''}
          ${feedback ? `
            <div style="margin: 20px 0;">
              <h3 style="color: #374151; margin: 0 0 10px 0;">Detailed Review Feedback:</h3>
              <p style="color: #4B5563; line-height: 1.6;"><strong>Overall Score:</strong> ${feedback.overallScore}/100</p>
              
              <div style="margin: 15px 0;">
                <h4 style="color: #374151; margin: 0 0 10px 0;">Criteria Scores:</h4>
                <ul style="color: #4B5563; margin: 5px 0; padding-left: 20px;">
                  <li>Content Quality: ${feedback.criteria?.contentQuality || 0}/100</li>
                  <li>Technical Quality: ${feedback.criteria?.technicalQuality || 0}/100</li>
                  <li>Marketability: ${feedback.criteria?.marketability || 0}/100</li>
                  <li>Accessibility: ${feedback.criteria?.accessibility || 0}/100</li>
                  <li>Engagement: ${feedback.criteria?.engagement || 0}/100</li>
                </ul>
              </div>
              
              ${feedback.feedback?.improvements?.length > 0 ? `
                <div style="margin: 15px 0;">
                  <h4 style="color: #DC2626; margin: 0 0 10px 0;">Required Improvements:</h4>
                  <ul style="color: #4B5563; margin: 5px 0; padding-left: 20px;">
                    ${feedback.feedback.improvements.map((improvement: string) => `<li>${improvement}</li>`).join('')}
                  </ul>
                </div>
              ` : ''}
              
              ${feedback.feedback?.requirements?.length > 0 ? `
                <div style="margin: 15px 0;">
                  <h4 style="color: #DC2626; margin: 0 0 10px 0;">Requirements:</h4>
                  <ul style="color: #4B5563; margin: 5px 0; padding-left: 20px;">
                    ${feedback.feedback.requirements.map((requirement: string) => `<li>${requirement}</li>`).join('')}
                  </ul>
                </div>
              ` : ''}
              
              ${feedback.estimatedRevisionTime ? `
                <p style="color: #4B5563; line-height: 1.6;">
                  <strong>Estimated Revision Time:</strong> ${feedback.estimatedRevisionTime}
                </p>
              ` : ''}
            </div>
          ` : ''}
          <div style="text-align: center; margin: 30px 0;">
            <a href="${config.cors.frontendUrl}/tutor/courses" 
               style="background: #DC2626; color: white; text-decoration: none; 
                      padding: 15px 30px; border-radius: 8px; font-weight: bold; display: inline-block;">
              Update Course
            </a>
          </div>
        </div>
      </div>
    `;

    const text = approved 
      ? `Course Approved! Your course "${courseName}" is now live on TekRiders.`
      : `Course Update Required: Your course "${courseName}" needs changes before publication. ${reason || ''}`;

    return await this.sendEmail({
      to: email,
      subject,
      html,
      text,
    });
  }

  // Send course submission notification to admins
  async sendCourseSubmissionNotification(email: string, course: any): Promise<boolean> {
    const subject = `New Course Submission: "${course.title}" - Review Required`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #4F46E5; margin: 0;">TekRiders</h1>
          <p style="color: #6B7280; margin: 5px 0;">Admin Panel</p>
        </div>
        
        <div style="background: #FEF3C7; border-radius: 12px; padding: 30px; margin: 20px 0; border-left: 4px solid #F59E0B;">
          <h2 style="color: #92400E; margin: 0 0 20px 0;">New Course Submission</h2>
          <p style="color: #4B5563; line-height: 1.6; margin: 0 0 20px 0;">
            A new course has been submitted for review and requires your attention.
          </p>
          
          <div style="margin: 20px 0;">
            <h3 style="color: #374151; margin: 0 0 15px 0;">Course Details:</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6B7280; width: 120px;"><strong>Title:</strong></td>
                <td style="padding: 8px 0; color: #4B5563;">${course.title}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6B7280;"><strong>Instructor:</strong></td>
                <td style="padding: 8px 0; color: #4B5563;">${course.instructorName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6B7280;"><strong>Category:</strong></td>
                <td style="padding: 8px 0; color: #4B5563;">${course.category}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6B7280;"><strong>Level:</strong></td>
                <td style="padding: 8px 0; color: #4B5563;">${course.level}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6B7280;"><strong>Sections:</strong></td>
                <td style="padding: 8px 0; color: #4B5563;">${course.sections?.length || 0}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6B7280;"><strong>Lessons:</strong></td>
                <td style="padding: 8px 0; color: #4B5563;">${course.totalLessons || 0}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6B7280;"><strong>Submitted:</strong></td>
                <td style="padding: 8px 0; color: #4B5563;">${new Date(course.submittedAt || course.updatedAt).toLocaleDateString()}</td>
              </tr>
            </table>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${config.cors.frontendUrl}/admin/courses" 
               style="background: #F59E0B; color: white; text-decoration: none; 
                      padding: 15px 30px; border-radius: 8px; font-weight: bold; display: inline-block;">
              Review Course
            </a>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 30px;">
          <p style="color: #9CA3AF; font-size: 12px;">
            © ${new Date().getFullYear()} TekRiders. All rights reserved.
          </p>
        </div>
      </div>
    `;

    const text = `
New Course Submission - Review Required

Course: "${course.title}"
Instructor: ${course.instructorName}
Category: ${course.category}
Level: ${course.level}
Submitted: ${new Date(course.submittedAt || course.updatedAt).toLocaleDateString()}

Review at: ${config.cors.frontendUrl}/admin/courses

© ${new Date().getFullYear()} TekRiders. All rights reserved.
    `;

    return await this.sendEmail({
      to: email,
      subject,
      html,
      text,
    });
  }

  // Send course review started notification to instructor
  async sendCourseReviewStartNotification(email: string, course: any): Promise<boolean> {
    const subject = `Course Review Started: "${course.title}"`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #4F46E5; margin: 0;">TekRiders</h1>
          <p style="color: #6B7280; margin: 5px 0;">E-Learning Platform</p>
        </div>
        
        <div style="background: #FEF3C7; border-radius: 12px; padding: 30px; margin: 20px 0; border-left: 4px solid #F59E0B;">
          <h2 style="color: #92400E; margin: 0 0 20px 0;">Course Review Started</h2>
          <p style="color: #4B5563; line-height: 1.6; margin: 0 0 20px 0;">
            Good news! Your course "<strong>${course.title}</strong>" is now being reviewed by our admin team.
          </p>
          
          <div style="margin: 20px 0;">
            <h3 style="color: #374151; margin: 0 0 15px 0;">What happens next?</h3>
            <ul style="color: #4B5563; line-height: 1.8; margin: 0; padding-left: 20px;">
              <li>Our team will review your course content and structure</li>
              <li>We'll check for quality, accuracy, and compliance</li>
              <li>You'll receive detailed feedback within 2-3 business days</li>
              <li>If approved, your course will be published automatically</li>
            </ul>
          </div>
          
          <div style="background: #F0F9FF; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h4 style="color: #0369A1; margin: 0 0 10px 0;">Review Tips</h4>
            <p style="color: #4B5563; line-height: 1.6; margin: 0; font-size: 14px;">
              While waiting for review, you can continue working on other courses or update your profile. 
              Make sure all your course materials are complete and error-free.
            </p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${config.cors.frontendUrl}/tutor/courses" 
               style="background: #4F46E5; color: white; text-decoration: none; 
                      padding: 15px 30px; border-radius: 8px; font-weight: bold; display: inline-block;">
              View Course Status
            </a>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 30px;">
          <p style="color: #9CA3AF; font-size: 12px;">
            © ${new Date().getFullYear()} TekRiders. All rights reserved.
          </p>
        </div>
      </div>
    `;

    const text = `
Course Review Started

Your course "${course.title}" is now being reviewed by our admin team.

What happens next:
- Our team will review your course content and structure
- We'll check for quality, accuracy, and compliance
- You'll receive detailed feedback within 2-3 business days
- If approved, your course will be published automatically

View status at: ${config.cors.frontendUrl}/tutor/courses

© ${new Date().getFullYear()} TekRiders. All rights reserved.
    `;

    return await this.sendEmail({
      to: email,
      subject,
      html,
      text,
    });
  }

  // Send payment confirmation email
  async sendPaymentConfirmationEmail(email: string, courseName: string, amount: number, currency: string): Promise<boolean> {
    const subject = `Payment Confirmation - ${courseName}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #F0FDF4; border-radius: 12px; padding: 30px; margin: 20px 0; border-left: 4px solid #10B981;">
          <h2 style="color: #059669; margin: 0 0 20px 0;">Payment Confirmed!</h2>
          <p style="color: #4B5563; line-height: 1.6;">
            Your payment for "<strong>${courseName}</strong>" has been successfully processed.
          </p>
          <div style="margin: 20px 0;">
            <p style="color: #4B5563; line-height: 1.6;"><strong>Amount:</strong> ${amount} ${currency}</p>
            <p style="color: #4B5563; line-height: 1.6;"><strong>Course:</strong> ${courseName}</p>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${config.cors.frontendUrl}/courses" 
               style="background: #10B981; color: white; text-decoration: none; 
                      padding: 15px 30px; border-radius: 8px; font-weight: bold; display: inline-block;">
              Start Learning
            </a>
          </div>
        </div>
      </div>
    `;

    return await this.sendEmail({
      to: email,
      subject,
      html,
      text: `Payment confirmed for ${courseName}. Amount: ${amount} ${currency}. Start learning at: ${config.cors.frontendUrl}/courses`,
    });
  }

  // Send payment failure email
  async sendPaymentFailureEmail(email: string, amount: number, currency: string, reason: string): Promise<boolean> {
    const subject = `Payment Failed - ${amount} ${currency}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #FEF2F2; border-radius: 12px; padding: 30px; margin: 20px 0; border-left: 4px solid #EF4444;">
          <h2 style="color: #DC2626; margin: 0 0 20px 0;">Payment Failed</h2>
          <p style="color: #4B5563; line-height: 1.6;">
            Unfortunately, your payment of <strong>${amount} ${currency}</strong> could not be processed.
          </p>
          <div style="margin: 20px 0;">
            <p style="color: #4B5563; line-height: 1.6;"><strong>Reason:</strong> ${reason}</p>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${config.cors.frontendUrl}/payment/retry" 
               style="background: #DC2626; color: white; text-decoration: none; 
                      padding: 15px 30px; border-radius: 8px; font-weight: bold; display: inline-block;">
              Try Again
            </a>
          </div>
        </div>
      </div>
    `;

    return await this.sendEmail({
      to: email,
      subject,
      html,
      text: `Payment failed: ${amount} ${currency}. Reason: ${reason}. Try again at: ${config.cors.frontendUrl}/payment/retry`,
    });
  }

  // Send refund confirmation email
  async sendRefundConfirmationEmail(email: string, amount: number, currency: string, reason: string): Promise<boolean> {
    const subject = `Refund Processed - ${amount} ${currency}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #F0F9FF; border-radius: 12px; padding: 30px; margin: 20px 0; border-left: 4px solid #0EA5E9;">
          <h2 style="color: #0284C7; margin: 0 0 20px 0;">Refund Processed</h2>
          <p style="color: #4B5563; line-height: 1.6;">
            Your refund of <strong>${amount} ${currency}</strong> has been processed successfully.
          </p>
          <div style="margin: 20px 0;">
            <p style="color: #4B5563; line-height: 1.6;"><strong>Reason:</strong> ${reason}</p>
            <p style="color: #4B5563; line-height: 1.6;">Please allow 3-5 business days for the refund to appear in your account.</p>
          </div>
        </div>
      </div>
    `;

    return await this.sendEmail({
      to: email,
      subject,
      html,
      text: `Refund processed: ${amount} ${currency}. Reason: ${reason}. Allow 3-5 business days for processing.`,
    });
  }

  // Send course status update notification
  async sendCourseStatusUpdateNotification(email: string, course: any, newStatus: string, message?: string): Promise<boolean> {
    const statusMessages = {
      published: 'Your course is now live and available to students!',
      archived: 'Your course has been archived and is no longer available.',
      suspended: 'Your course has been suspended and requires attention.',
      rejected: 'Your course submission needs revisions before publication.'
    };

    const subject = `Course Status Update: "${course.title}" - ${newStatus.toUpperCase()}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #4F46E5; margin: 0;">TekRiders</h1>
          <p style="color: #6B7280; margin: 5px 0;">E-Learning Platform</p>
        </div>
        
        <div style="background: #F8FAFC; border-radius: 12px; padding: 30px; margin: 20px 0; border-left: 4px solid #6B7280;">
          <h2 style="color: #374151; margin: 0 0 20px 0;">📢 Course Status Update</h2>
          <p style="color: #4B5563; line-height: 1.6; margin: 0 0 20px 0;">
            Your course "<strong>${course.title}</strong>" status has been updated to: <strong>${newStatus.toUpperCase()}</strong>
          </p>
          
          <p style="color: #4B5563; line-height: 1.6; margin: 0 0 20px 0;">
            ${statusMessages[newStatus as keyof typeof statusMessages] || 'Status has been updated.'}
          </p>
          
          ${message ? `
            <div style="background: #FEF3C7; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h4 style="color: #92400E; margin: 0 0 10px 0;">Additional Information:</h4>
              <p style="color: #4B5563; line-height: 1.6; margin: 0;">${message}</p>
            </div>
          ` : ''}
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${config.cors.frontendUrl}/tutor/courses" 
               style="background: #4F46E5; color: white; text-decoration: none; 
                      padding: 15px 30px; border-radius: 8px; font-weight: bold; display: inline-block;">
              View Course
            </a>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 30px;">
          <p style="color: #9CA3AF; font-size: 12px;">
            © ${new Date().getFullYear()} TekRiders. All rights reserved.
          </p>
        </div>
      </div>
    `;

    const text = `
Course Status Update

Your course "${course.title}" status has been updated to: ${newStatus.toUpperCase()}

${statusMessages[newStatus as keyof typeof statusMessages] || 'Status has been updated.'}

${message ? `Additional Information: ${message}` : ''}

View at: ${config.cors.frontendUrl}/tutor/courses

© ${new Date().getFullYear()} TekRiders. All rights reserved.
    `;

    return await this.sendEmail({
      to: email,
      subject,
      html,
      text,
    });
  }
}

export const emailService = new EmailService();
export default emailService; 