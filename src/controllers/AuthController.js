const AuthService = require('../services/AuthService');
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

class AuthController {
  // Admin login
  login = asyncHandler(async (req, res) => {
    const { email, password, userType = 'admin' } = req.body;
    const ipAddress = req.ip;
    const userAgent = req.get('User-Agent');

    let result;
    if (userType === 'admin') {
      result = await AuthService.loginAdmin(email, password, ipAddress, userAgent);
    } else {
      // For students, email can be email or student number
      result = await AuthService.loginStudent(email, password, ipAddress, userAgent);
    }

    // Set refresh token as httpOnly cookie with role-specific name
    const cookieName = userType === 'admin' ? 'adminRefreshToken' : 'studentRefreshToken';
    res.cookie(cookieName, result.tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: userType === 'admin' ? '/admin' : '/student', // Path-specific cookies
    });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: result.user,
        accessToken: result.tokens.accessToken,
        expiresIn: result.tokens.expiresIn,
      },
    });
  });

  // Refresh access token
  refreshToken = asyncHandler(async (req, res) => {
    // Try to get refresh token from both admin and student cookies
    const adminRefreshToken = req.cookies.adminRefreshToken;
    const studentRefreshToken = req.cookies.studentRefreshToken;

    const refreshToken = adminRefreshToken || studentRefreshToken || req.body.refreshToken;
    const userType = adminRefreshToken ? 'admin' : 'student';

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Refresh token not provided',
        },
      });
    }

    const result = await AuthService.refreshToken(refreshToken);

    // Set new refresh token as httpOnly cookie with role-specific name if we have a role-specific token
    if (adminRefreshToken || studentRefreshToken) {
      const cookieName = userType === 'admin' ? 'adminRefreshToken' : 'studentRefreshToken';
      res.cookie(cookieName, result.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: userType === 'admin' ? '/admin' : '/student', // Path-specific cookies
      });
    }

    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: result,
    });
  });

  // Logout
  logout = asyncHandler(async (req, res) => {
    const accessToken = req.headers.authorization?.split(' ')[1];

    // Try to get refresh token from both admin and student cookies
    const adminRefreshToken = req.cookies.adminRefreshToken;
    const studentRefreshToken = req.cookies.studentRefreshToken;
    const refreshToken = adminRefreshToken || studentRefreshToken || req.body.refreshToken;

    await AuthService.logout(accessToken, refreshToken);

    // Clear both types of refresh token cookies
    res.clearCookie('adminRefreshToken', { path: '/admin' });
    res.clearCookie('studentRefreshToken', { path: '/student' });
    res.clearCookie('refreshToken'); // Legacy cookie cleanup

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  });

  // Get current user profile
  getProfile = asyncHandler(async (req, res) => {
    const user = await AuthService.getCurrentUser(req.user.id, req.user.role);

    res.status(200).json({
      success: true,
      message: 'Profile retrieved successfully',
      data: { user },
    });
  });

  // Change password
  changePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'New password and confirmation do not match',
        },
      });
    }

    // Validate password strength
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Password must be at least 8 characters long',
        },
      });
    }

    const result = await AuthService.changePassword(
      req.user.id,
      req.user.role,
      currentPassword,
      newPassword
    );

    res.status(200).json({
      success: true,
      message: result.message,
    });
  });

  // Validate token
  validateToken = asyncHandler(async (req, res) => {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Token is required',
        },
      });
    }

    const result = await AuthService.validateToken(token);

    res.status(200).json({
      success: true,
      message: 'Token validation completed',
      data: result,
    });
  });

  // Check authentication status
  checkAuth = asyncHandler(async (req, res) => {
    // This endpoint is protected by auth middleware
    // If we reach here, the user is authenticated
    res.status(200).json({
      success: true,
      message: 'User is authenticated',
      data: {
        user: {
          id: req.user.id,
          email: req.user.email,
          role: req.user.role,
          firstName: req.user.firstName,
          lastName: req.user.lastName,
        },
      },
    });
  });

  // Logout from all devices (invalidate all tokens)
  logoutAll = asyncHandler(async (req, res) => {
    // In a production environment, you would:
    // 1. Increment a user's token version in the database
    // 2. Include this version in JWT tokens
    // 3. Check version on token validation

    // Note: Audit logging is handled by auditAuth('LOGOUT_ALL') middleware

    res.status(200).json({
      success: true,
      message: 'Logged out from all devices successfully',
    });
  });

  // Admin registration
  adminRegister = asyncHandler(async (req, res) => {
    console.log('🔍 Admin registration request body:', req.body);

    const {
      email,
      password,
      firstName,
      lastName,
      middleName,
      suffix,
      phoneNumber,
      department,
      position,
      gradeLevel
    } = req.body;

    console.log('🎯 Extracted gradeLevel:', gradeLevel, 'Type:', typeof gradeLevel);

    try {
      const result = await AuthService.registerAdmin({
        email,
        password,
        firstName,
        lastName,
        middleName,
        suffix,
        phoneNumber,
        department,
        position,
        gradeLevel
      });

      res.status(200).json({
        success: true,
        message: 'Registration initiated. Please check your email for OTP verification.',
        data: {
          email: result.email,
          otpSent: true
        }
      });
    } catch (error) {
      logger.error('Admin registration error:', error);
      throw error;
    }
  });

  // Verify admin OTP
  verifyAdminOtp = asyncHandler(async (req, res) => {
    const { email, otp } = req.body;

    try {
      const result = await AuthService.verifyAdminOtp(email, otp);

      res.status(200).json({
        success: true,
        message: 'Admin account verified and created successfully. You can now login.',
        data: {
          admin: result.admin
        }
      });
    } catch (error) {
      logger.error('Admin OTP verification error:', error);
      throw error;
    }
  });

  // Resend admin OTP
  resendAdminOtp = asyncHandler(async (req, res) => {
    const { email } = req.body;

    try {
      await AuthService.resendAdminOtp(email);

      res.status(200).json({
        success: true,
        message: 'OTP resent successfully. Please check your email.',
        data: {
          email,
          otpSent: true
        }
      });
    } catch (error) {
      logger.error('Admin OTP resend error:', error);
      throw error;
    }
  });
}

module.exports = new AuthController();
