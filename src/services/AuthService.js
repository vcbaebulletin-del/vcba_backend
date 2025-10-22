const AdminModel = require('../models/AdminModel');
const StudentModel = require('../models/StudentModel');
const jwtUtil = require('../utils/jwt');
const logger = require('../utils/logger');
const {
  AuthenticationError,
  ValidationError,
  NotFoundError,
} = require('../middleware/errorHandler');

class AuthService {
  // Admin login
  async loginAdmin(email, password, ipAddress, userAgent) {
    try {
      // Find admin by email
      const admin = await AdminModel.findByEmailWithProfile(email);
      if (!admin) {
        logger.logAuth('admin_login_failed', null, false, {
          email,
          reason: 'user_not_found',
          ip: ipAddress,
          userAgent,
        });
        throw new AuthenticationError('Invalid email or password');
      }

      // Check if account is active
      if (!admin.is_active) {
        logger.logAuth('admin_login_failed', admin.admin_id, false, {
          email,
          reason: 'account_inactive',
          ip: ipAddress,
          userAgent,
        });
        throw new AuthenticationError('Account is deactivated');
      }

      // Account locking removed per user request

      // Verify password
      const isPasswordValid = await AdminModel.verifyPassword(password, admin.password);
      if (!isPasswordValid) {
        // Failed login attempt tracking removed per user request

        logger.logAuth('admin_login_failed', admin.admin_id, false, {
          email,
          reason: 'invalid_password',
          ip: ipAddress,
          userAgent,
        });
        throw new AuthenticationError('Invalid email or password');
      }

      // Update last login
      await AdminModel.updateLastLogin(admin.admin_id);

      // Debug: Log admin object before token generation
      console.log('🔍 AuthService.login - Admin object before token generation:', {
        admin_id: admin.admin_id,
        email: admin.email,
        first_name: admin.first_name,
        last_name: admin.last_name,
        grade_level: admin.grade_level,
        hasGradeLevel: admin.hasOwnProperty('grade_level'),
        gradeType: typeof admin.grade_level
      });

      // Generate tokens
      const tokens = jwtUtil.generateTokenPair(admin);

      // Debug: Decode and log the generated token
      const jwt = require('jsonwebtoken');
      const decodedToken = jwt.decode(tokens.accessToken);
      console.log('🔍 AuthService.login - Generated JWT payload:', {
        id: decodedToken.id,
        email: decodedToken.email,
        role: decodedToken.role,
        firstName: decodedToken.firstName,
        lastName: decodedToken.lastName,
        grade_level: decodedToken.grade_level,
        hasGradeLevel: decodedToken.hasOwnProperty('grade_level'),
        gradeType: typeof decodedToken.grade_level
      });

      // Note: Successful login audit logging is handled by auditAuth('LOGIN') middleware
      // Failed login attempts are still logged immediately above for security monitoring

      // Return user data without password
      const { password: _, ...adminData } = admin;

      return {
        user: adminData,
        tokens,
      };
    } catch (error) {
      throw error;
    }
  }

  // Student login
  async loginStudent(identifier, password, ipAddress, userAgent) {
    try {
      // TEMPORARY: Find student by username (stored in email field) or student number - REVERT IN FUTURE
      // Original logic checked for '@' to determine email vs student number
      let student;
      
      // Try to find by student number first (if identifier is all digits)
      if (/^\d+$/.test(identifier)) {
        student = await StudentModel.findByStudentNumberWithProfile(identifier);
      }
      
      // If not found or identifier is not all digits, try by username (email field)
      if (!student) {
        student = await StudentModel.findByEmailWithProfile(identifier);
      }

      if (!student) {
        logger.logAuth('student_login_failed', null, false, {
          identifier,
          reason: 'user_not_found',
          ip: ipAddress,
          userAgent,
        });
        throw new AuthenticationError('Invalid credentials');
      }

      // Check if account is active
      if (!student.is_active) {
        logger.logAuth('student_login_failed', student.student_id, false, {
          identifier,
          reason: 'account_inactive',
          ip: ipAddress,
          userAgent,
        });
        throw new AuthenticationError('Account is deactivated');
      }

      // Account locking removed per user request

      // Verify password
      const isPasswordValid = await StudentModel.verifyPassword(password, student.password);
      if (!isPasswordValid) {
        // Failed login attempt tracking removed per user request

        logger.logAuth('student_login_failed', student.student_id, false, {
          identifier,
          reason: 'invalid_password',
          ip: ipAddress,
          userAgent,
        });
        throw new AuthenticationError('Invalid credentials');
      }

      // Update last login
      await StudentModel.updateLastLogin(student.student_id);

      // Generate tokens
      const tokens = jwtUtil.generateTokenPair(student);

      // Note: Successful login audit logging is handled by auditAuth('LOGIN') middleware
      // Failed login attempts are still logged immediately above for security monitoring

      // Return user data without password
      const { password: _, ...studentData } = student;

      return {
        user: studentData,
        tokens,
      };
    } catch (error) {
      throw error;
    }
  }

  // Refresh token
  async refreshToken(refreshToken) {
    try {
      const decoded = jwtUtil.verifyRefreshToken(refreshToken);

      // Get fresh user data
      let user;
      if (decoded.role === 'admin') {
        user = await AdminModel.getAdminWithProfile(decoded.id);
      } else {
        user = await StudentModel.getStudentWithProfile(decoded.id);
      }

      if (!user) {
        throw new AuthenticationError('User not found');
      }

      if (!user.is_active) {
        throw new AuthenticationError('Account is deactivated');
      }

      // Generate new access token
      const accessToken = jwtUtil.generateAccessToken({
        id: user.admin_id || user.student_id,
        email: user.email,
        role: user.admin_id ? 'admin' : 'student',
        firstName: user.first_name,
        lastName: user.last_name,
        grade_level: user.grade_level || null,
        position: user.position || null,
        department: user.department || null,
      });

      // Note: Token refresh audit logging is handled by auditAuth('TOKEN_REFRESH') middleware

      return {
        accessToken,
        expiresIn: jwtUtil.expiresIn,
      };
    } catch (error) {
      // Note: Failed token refresh audit logging is handled by auditAuth('TOKEN_REFRESH') middleware
      throw error;
    }
  }

  // Logout
  async logout(accessToken, refreshToken) {
    try {
      // Blacklist tokens
      if (accessToken) {
        jwtUtil.blacklistToken(accessToken);
      }
      if (refreshToken) {
        jwtUtil.blacklistToken(refreshToken);
      }

      // Note: Audit logging for logout is now handled by the auditAuth middleware
      // in the route handler, which has access to req.user from the authenticate middleware
      // This ensures proper user identification in audit logs

      return { message: 'Logged out successfully' };
    } catch (error) {
      throw error;
    }
  }

  // Get current user profile
  async getCurrentUser(userId, role) {
    try {
      let user;
      if (role === 'admin') {
        user = await AdminModel.getAdminWithProfile(userId);
      } else {
        user = await StudentModel.getStudentWithProfile(userId);
      }

      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Remove sensitive data
      const {
        password, ...userData
      } = user;

      return userData;
    } catch (error) {
      throw error;
    }
  }

  // Change password
  async changePassword(userId, role, currentPassword, newPassword) {
    try {
      let user;
      let model;

      if (role === 'admin') {
        user = await AdminModel.findById(userId);
        model = AdminModel;
      } else {
        user = await StudentModel.findById(userId);
        model = StudentModel;
      }

      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Verify current password
      const isCurrentPasswordValid = await model.verifyPassword(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        // Note: Failed password change audit logging is handled by auditAuth('CHANGE_PASSWORD') middleware
        throw new AuthenticationError('Current password is incorrect');
      }

      // Update password
      if (role === 'admin') {
        await AdminModel.updateAccount(userId, { password: newPassword });
      } else {
        await StudentModel.updateAccount(userId, { password: newPassword });
      }

      // Note: Successful password change audit logging is handled by auditAuth('CHANGE_PASSWORD') middleware

      return { message: 'Password changed successfully' };
    } catch (error) {
      throw error;
    }
  }

  // Validate token
  async validateToken(token) {
    try {
      const decoded = jwtUtil.verifyAccessToken(token);

      // Check if token is blacklisted
      if (jwtUtil.isTokenBlacklisted(token)) {
        throw new AuthenticationError('Token has been revoked');
      }

      return {
        valid: true,
        decoded,
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message,
      };
    }
  }

  // Get user by ID (for internal use)
  async getAdminById(adminId) {
    return await AdminModel.getAdminWithProfile(adminId);
  }

  async getStudentById(studentId) {
    return await StudentModel.getStudentWithProfile(studentId);
  }

  // Admin registration with OTP
  async registerAdmin(adminData) {
    try {
      console.log('🔍 AuthService registerAdmin received data:', adminData);

      const { email, password, firstName, lastName, middleName, suffix, phoneNumber, department, position, gradeLevel } = adminData;

      console.log('🎯 AuthService extracted gradeLevel:', gradeLevel, 'Type:', typeof gradeLevel);

      // Check if admin already exists
      const existingAdmin = await AdminModel.findByEmailWithProfile(email);
      if (existingAdmin) {
        throw new ValidationError('An admin account with this email already exists');
      }

      // Generate OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Store pending registration data temporarily (you might want to use Redis for this)
      // For now, we'll store it in a temporary table or in-memory store
      const pendingData = {
        email,
        password,
        firstName,
        lastName,
        middleName,
        suffix,
        phoneNumber,
        department,
        position,
        gradeLevel,
        otp,
        otpExpires
      };

      console.log('🔍 Storing pending registration with gradeLevel:', pendingData.gradeLevel);

      await this.storePendingAdminRegistration(pendingData);

      // Send OTP email with error handling
      let otpSent = false;
      try {
        await this.sendOtpEmail(email, otp, firstName);
        otpSent = true;
        logger.info('Admin registration OTP sent', { email });
      } catch (emailError) {
        logger.error('Failed to send OTP email, but registration will continue', {
          email: email.replace(/(.{2}).*(@.*)/, '$1***$2'),
          error: emailError.message
        });
        // Don't throw the error - allow registration to continue
        // User can request resend OTP later
      }

      return {
        email,
        otpSent,
        message: otpSent
          ? 'Registration initiated successfully! Please check your email for the OTP.'
          : 'Registration initiated successfully! There was an issue sending the email. Please use the resend option.'
      };
    } catch (error) {
      throw error;
    }
  }

  // Verify admin OTP and create account
  async verifyAdminOtp(email, otp) {
    try {
      console.log('🔍 verifyAdminOtp - Starting verification for:', email);

      // Get pending registration data
      const pendingData = await this.getPendingAdminRegistration(email);

      console.log('🔍 verifyAdminOtp - Retrieved pendingData.gradeLevel:', pendingData?.gradeLevel);

      if (!pendingData) {
        throw new ValidationError('No pending registration found for this email');
      }

      if (pendingData.otpExpires < new Date()) {
        throw new ValidationError('OTP has expired. Please request a new one');
      }

      if (pendingData.otp !== otp) {
        throw new ValidationError('Invalid OTP');
      }

      // Create admin account
      const accountData = {
        email: pendingData.email,
        password: pendingData.password,
        is_active: true
      };

      const profileData = {
        first_name: pendingData.firstName,
        middle_name: pendingData.middleName || null,
        last_name: pendingData.lastName,
        suffix: pendingData.suffix || null,
        phone_number: pendingData.phoneNumber || null,
        department: pendingData.department,
        position: pendingData.position,
        grade_level: pendingData.gradeLevel !== undefined && pendingData.gradeLevel !== null && pendingData.gradeLevel !== '' ? pendingData.gradeLevel : null
      };

      console.log('🔍 pendingData.gradeLevel value:', pendingData.gradeLevel);
      console.log('🔍 pendingData.gradeLevel type:', typeof pendingData.gradeLevel);
      console.log('🔍 pendingData.gradeLevel === "":', pendingData.gradeLevel === '');
      console.log('🔍 pendingData.gradeLevel === null:', pendingData.gradeLevel === null);
      console.log('� pendingData.gradeLevel === undefined:', pendingData.gradeLevel === undefined);
      console.log('🔍 Final profileData.grade_level:', profileData.grade_level);
      console.log('🔍 Full profile data:', profileData);

      // Create admin account with comprehensive error handling
      let admin;
      try {
        admin = await AdminModel.createAdmin(accountData, profileData);
      } catch (createError) {
        // Clean up pending registration on failure
        await this.deletePendingAdminRegistration(email);

        // Re-throw the error with better context
        if (createError.message.includes('Phone number already exists')) {
          throw new ConflictError('An admin account with this phone number already exists');
        } else if (createError.message.includes('Email already exists')) {
          throw new ConflictError('An admin account with this email already exists');
        } else if (createError.message.includes('Duplicate entry')) {
          throw new ConflictError('An admin account with this information already exists');
        }

        logger.error('Admin account creation failed', {
          email: accountData.email,
          error: createError.message
        });

        throw new Error('Failed to create admin account. Please try again.');
      }

      // Validate that admin was created successfully
      if (!admin || !admin.admin_id) {
        await this.deletePendingAdminRegistration(email);
        logger.error('Admin creation returned null or invalid data', {
          email: accountData.email,
          adminData: admin
        });
        throw new Error('Failed to create admin account. Please try again.');
      }

      // Clean up pending registration after successful creation
      await this.deletePendingAdminRegistration(email);

      logger.info('Admin account created successfully', {
        adminId: admin.admin_id,
        email: admin.email
      });

      // Remove sensitive data
      const { password: _, ...adminData } = admin;

      return {
        admin: adminData
      };
    } catch (error) {
      throw error;
    }
  }

  // Resend admin OTP
  async resendAdminOtp(email) {
    try {
      const pendingData = await this.getPendingAdminRegistration(email);

      if (!pendingData) {
        throw new ValidationError('No pending registration found for this email');
      }

      // Generate new OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Update pending registration with new OTP
      await this.updatePendingAdminRegistration(email, { otp, otpExpires });

      // Send OTP email
      try {
        await this.sendOtpEmail(email, otp, pendingData.firstName);
        logger.info('Admin registration OTP resent successfully', { email });
      } catch (emailError) {
        logger.error('Failed to send OTP email during resend, but registration will continue', {
          error: emailError.message,
          email
        });
        // Continue with success response even if email fails
      }

      return {
        email,
        otpSent: true
      };
    } catch (error) {
      logger.error('Admin OTP resend error:', error);
      throw error;
    }
  }

  // Helper methods for pending registrations (simplified in-memory store)
  // In production, you should use Redis or a database table
  static pendingRegistrations = new Map();

  async storePendingAdminRegistration(data) {
    console.log('🔍 storePendingAdminRegistration - Storing data with gradeLevel:', data.gradeLevel);

    const storedData = {
      ...data,
      createdAt: new Date()
    };

    console.log('🔍 storePendingAdminRegistration - Final stored data:', storedData);

    AuthService.pendingRegistrations.set(data.email, storedData);
  }

  async getPendingAdminRegistration(email) {
    const data = AuthService.pendingRegistrations.get(email);
    console.log('🔍 getPendingAdminRegistration - Retrieved data for', email, ':', data);
    console.log('🔍 getPendingAdminRegistration - gradeLevel:', data?.gradeLevel);
    return data;
  }

  async updatePendingAdminRegistration(email, updates) {
    const existing = AuthService.pendingRegistrations.get(email);
    if (existing) {
      AuthService.pendingRegistrations.set(email, {
        ...existing,
        ...updates
      });
    }
  }

  async deletePendingAdminRegistration(email) {
    AuthService.pendingRegistrations.delete(email);
  }

  // Send OTP email
  async sendOtpEmail(email, otp, firstName) {
    try {
      // Log OTP in development for debugging
      if (process.env.NODE_ENV === 'development') {
        logger.info('OTP generated for admin registration', {
          email: email.replace(/(.{2}).*(@.*)/, '$1***$2'),
          firstName,
          otp: otp, // Show actual OTP in development
          otpLength: otp.length
        });

        // In development, we'll still send the email for testing
        logger.info('Development mode: Sending email for testing purposes.');
      }

      // Import email service
      const emailService = require('../utils/email');

      // Send actual email in production
      await emailService.sendOtpEmail(email, otp, firstName);

      logger.info('OTP email sent successfully', {
        email: email.replace(/(.{2}).*(@.*)/, '$1***$2'), // Mask email for privacy
        firstName
      });

      return true;
    } catch (error) {
      logger.error('Failed to send OTP email:', error);

      // In development, provide more detailed error information but don't fail the registration
      if (process.env.NODE_ENV === 'development') {
        logger.error('Development mode: Email sending failed with details:', {
          error: error.message,
          code: error.code,
          command: error.command,
          response: error.response
        });

        // In development, we can be more lenient with email failures
        // Log the OTP for debugging purposes
        logger.warn('Development mode: Email failed, but OTP is available in logs for testing');
        logger.info(`🔑 DEVELOPMENT OTP for ${email}: ${otp}`);

        // Re-throw the error so the calling function can handle it appropriately
        throw new Error(`Email delivery failed: ${error.message}`);
      }

      throw new Error('Failed to send OTP email. Please try again or contact support.');
    }
  }
}

module.exports = new AuthService();
