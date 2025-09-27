const nodemailer = require('nodemailer');
const config = require('../config/config');
const logger = require('./logger');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  // Initialize email transporter
  initializeTransporter() {
    try {
      // Check if email configuration is available
      if (!config.email.auth.user || !config.email.auth.pass) {
        logger.warn('Email configuration incomplete - SMTP_USER or SMTP_PASS not set', {
          hasUser: !!config.email.auth.user,
          hasPass: !!config.email.auth.pass,
          user: config.email.auth.user ? config.email.auth.user.replace(/(.{2}).*(@.*)/, '$1***$2') : 'not set'
        });
        return;
      }

      logger.info('Initializing email transporter with configuration:', {
        host: config.email.host,
        port: config.email.port,
        secure: config.email.secure,
        user: config.email.auth.user.replace(/(.{2}).*(@.*)/, '$1***$2')
      });

      this.transporter = nodemailer.createTransport({
        host: config.email.host,
        port: config.email.port,
        secure: config.email.secure,
        auth: config.email.auth,
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
        // Additional Gmail-specific settings
        tls: {
          rejectUnauthorized: false
        }
      });

      // Verify connection asynchronously without blocking server startup
      setImmediate(() => {
        const verifyTimeout = setTimeout(() => {
          logger.warn('Email transporter verification timed out - continuing server startup');
        }, 3000); // Reduced timeout to 3 seconds

        this.transporter.verify((error, success) => {
          clearTimeout(verifyTimeout);
          if (error) {
            logger.error('Email transporter verification failed - DETAILED ERROR:', {
              error: error.message,
              code: error.code,
              command: error.command,
              response: error.response,
              responseCode: error.responseCode,
              stack: error.stack,
              host: config.email.host,
              port: config.email.port,
              secure: config.email.secure,
              user: config.email.auth.user ? config.email.auth.user.replace(/(.{2}).*(@.*)/, '$1***$2') : 'not set'
            });

            // Log the full error object for debugging
            logger.error('Full verification error object:', error);

            // In development mode, keep the transporter for testing even if verification fails
            if (config.env === 'development') {
              logger.warn('Development mode: Keeping email transporter despite verification failure for testing');
              logger.info('OTP emails will be attempted but may fail. Check Gmail settings if needed.');
            } else {
              logger.warn('Email service will be disabled due to verification failure');
              this.transporter = null;
            }
          } else {
            logger.info('Email transporter is ready', {
              host: config.email.host,
              port: config.email.port,
              secure: config.email.secure
            });
          }
        });
      });
    } catch (error) {
      logger.error('Failed to initialize email transporter:', error);
    }
  }

  // Send email
  async sendEmail(options) {
    try {
      if (!this.transporter) {
        const errorMsg = 'Email transporter not initialized. Please check SMTP configuration.';
        logger.error('Email sending failed:', { error: errorMsg, to: options?.to });

        // In development, log the email content for debugging
        if (config.env === 'development') {
          logger.info('Development mode: Email content that would have been sent:', {
            to: options?.to,
            subject: options?.subject,
            hasHtml: !!options?.html,
            hasText: !!options?.text
          });
        }

        throw new Error(errorMsg);
      }

      // Validate required options
      if (!options.to) {
        throw new Error('Email recipient (to) is required');
      }
      if (!options.subject) {
        throw new Error('Email subject is required');
      }
      if (!options.html && !options.text) {
        throw new Error('Email content (html or text) is required');
      }

      const mailOptions = {
        from: options.from || `"${config.app.name}" <${config.email.auth.user}>`,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
        attachments: options.attachments,
      };

      logger.info('Attempting to send email', {
        to: options.to.replace(/(.{2}).*(@.*)/, '$1***$2'),
        subject: options.subject,
        hasHtml: !!options.html,
        hasText: !!options.text
      });

      const result = await this.transporter.sendMail(mailOptions);

      logger.info('Email sent successfully', {
        messageId: result.messageId,
        to: options.to.replace(/(.{2}).*(@.*)/, '$1***$2'),
        subject: options.subject,
        response: result.response
      });

      return result;
    } catch (error) {
      logger.error('Failed to send email - DETAILED ERROR:', {
        error: error.message,
        code: error.code,
        command: error.command,
        response: error.response,
        responseCode: error.responseCode,
        stack: error.stack,
        to: options?.to?.replace(/(.{2}).*(@.*)/, '$1***$2') || 'unknown',
        subject: options?.subject || 'unknown'
      });

      // Log the full error object for debugging
      logger.error('Full error object:', error);

      // Provide more user-friendly error messages
      if (error.code === 'EAUTH') {
        throw new Error(`Email authentication failed. Gmail response: ${error.response || error.message}`);
      } else if (error.code === 'ECONNECTION') {
        throw new Error('Failed to connect to email server. Please check network connection.');
      } else if (error.code === 'ETIMEDOUT') {
        throw new Error('Email sending timed out. Please try again.');
      } else {
        throw new Error(`Email delivery failed: ${error.message}`);
      }
    }
  }

  // Send welcome email to new user
  async sendWelcomeEmail(user, userType = 'student') {
    const subject = `Welcome to ${config.app.name}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to ${config.app.name}!</h2>
        <p>Dear ${user.first_name} ${user.last_name},</p>
        <p>Your ${userType} account has been successfully created.</p>
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3>Account Details:</h3>
          <p><strong>Email:</strong> ${user.email}</p>
          ${userType === 'student' ? `<p><strong>Student Number:</strong> ${user.student_number}</p>` : ''}
          <p><strong>Account Type:</strong> ${userType}</p>
        </div>
        <p>You can now log in to access the bulletin board system.</p>
        <p>If you have any questions, please contact the system administrator.</p>
        <p>Best regards,<br>${config.app.name} Team</p>
      </div>
    `;

    return await this.sendEmail({
      to: user.email,
      subject,
      html,
    });
  }

  // Send password reset email
  async sendPasswordResetEmail(user, resetToken) {
    const subject = 'Password Reset Request';
    const resetUrl = `${config.cors.origin}/reset-password?token=${resetToken}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset Request</h2>
        <p>Dear ${user.first_name} ${user.last_name},</p>
        <p>You have requested to reset your password for ${config.app.name}.</p>
        <p>Click the button below to reset your password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
        </div>
        <p>If the button doesn't work, copy and paste this link into your browser:</p>
        <p style="word-break: break-all;">${resetUrl}</p>
        <p><strong>This link will expire in 1 hour.</strong></p>
        <p>If you didn't request this password reset, please ignore this email.</p>
        <p>Best regards,<br>${config.app.name} Team</p>
      </div>
    `;

    return await this.sendEmail({
      to: user.email,
      subject,
      html,
    });
  }

  // Send announcement notification email
  async sendAnnouncementNotification(user, announcement) {
    const subject = `New Announcement: ${announcement.title}`;
    const announcementUrl = `${config.cors.origin}/announcements/${announcement.announcement_id}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>New Announcement</h2>
        <p>Dear ${user.first_name} ${user.last_name},</p>
        <p>A new announcement has been posted:</p>
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #007bff;">
          <h3 style="margin-top: 0;">${announcement.title}</h3>
          <p style="color: #666; margin-bottom: 10px;">
            <strong>Category:</strong> ${announcement.category} | 
            <strong>Priority:</strong> ${announcement.priority}
          </p>
          <p>${announcement.excerpt || announcement.content.substring(0, 200)}...</p>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${announcementUrl}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Read Full Announcement</a>
        </div>
        <p>Best regards,<br>${config.app.name} Team</p>
      </div>
    `;

    return await this.sendEmail({
      to: user.email,
      subject,
      html,
    });
  }

  // Send email verification
  async sendEmailVerification(user, verificationToken) {
    const subject = 'Verify Your Email Address';
    const verificationUrl = `${config.cors.origin}/verify-email?token=${verificationToken}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Email Verification</h2>
        <p>Dear ${user.first_name} ${user.last_name},</p>
        <p>Please verify your email address to complete your account setup.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Verify Email</a>
        </div>
        <p>If the button doesn't work, copy and paste this link into your browser:</p>
        <p style="word-break: break-all;">${verificationUrl}</p>
        <p><strong>This link will expire in 24 hours.</strong></p>
        <p>If you didn't create this account, please ignore this email.</p>
        <p>Best regards,<br>${config.app.name} Team</p>
      </div>
    `;

    return await this.sendEmail({
      to: user.email,
      subject,
      html,
    });
  }

  // Send OTP email for admin registration
  async sendOtpEmail(email, otp, firstName) {
    const subject = 'Admin Registration - OTP Verification';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2c3e50; margin: 0;">${config.app.name}</h1>
            <p style="color: #7f8c8d; margin: 5px 0;">Administrator Registration</p>
          </div>

          <h2 style="color: #34495e; margin-bottom: 20px;">OTP Verification Required</h2>

          <p style="color: #2c3e50; font-size: 16px; line-height: 1.6;">
            Hello <strong>${firstName}</strong>,
          </p>

          <p style="color: #2c3e50; font-size: 16px; line-height: 1.6;">
            Thank you for registering as an administrator for ${config.app.name}.
            To complete your registration, please use the following One-Time Password (OTP):
          </p>

          <div style="text-align: center; margin: 30px 0;">
            <div style="background-color: #3498db; color: white; font-size: 32px; font-weight: bold; padding: 20px; border-radius: 8px; letter-spacing: 8px; display: inline-block; font-family: 'Courier New', monospace;">
              ${otp}
            </div>
          </div>

          <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; padding: 15px; margin: 20px 0;">
            <p style="color: #856404; margin: 0; font-weight: bold;">⚠️ Important Security Information:</p>
            <ul style="color: #856404; margin: 10px 0; padding-left: 20px;">
              <li>This OTP will expire in <strong>10 minutes</strong></li>
              <li>Do not share this code with anyone</li>
              <li>If you didn't request this registration, please ignore this email</li>
            </ul>
          </div>

          <p style="color: #2c3e50; font-size: 16px; line-height: 1.6;">
            Enter this OTP in the registration form to complete your administrator account setup.
          </p>

          <hr style="border: none; border-top: 1px solid #ecf0f1; margin: 30px 0;">

          <p style="color: #7f8c8d; font-size: 14px; text-align: center;">
            This is an automated message from ${config.app.name}.<br>
            If you have any questions, please contact the system administrator.
          </p>
        </div>
      </div>
    `;

    const text = `
Hello ${firstName},

Thank you for registering as an administrator for ${config.app.name}.

Your OTP for admin registration is: ${otp}

This OTP will expire in 10 minutes.

Please enter this code in the registration form to complete your account setup.

If you didn't request this registration, please ignore this email.

Best regards,
${config.app.name} Team
    `;

    return await this.sendEmail({
      to: email,
      subject,
      html,
      text,
    });
  }

  // Send bulk emails
  async sendBulkEmails(recipients, subject, content) {
    const results = [];

    for (const recipient of recipients) {
      try {
        const result = await this.sendEmail({
          to: recipient.email,
          subject,
          html: content.replace(/{{name}}/g, `${recipient.first_name} ${recipient.last_name}`),
        });
        results.push({ email: recipient.email, success: true, messageId: result.messageId });
      } catch (error) {
        results.push({ email: recipient.email, success: false, error: error.message });
      }
    }

    return results;
  }

  // Test email configuration
  async testConnection() {
    try {
      if (!this.transporter) {
        throw new Error('Email transporter not initialized');
      }

      await this.transporter.verify();
      return { success: true, message: 'Email configuration is valid' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}

module.exports = new EmailService();
