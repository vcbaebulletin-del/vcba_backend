const jwtUtil = require('../utils/jwt');
const AdminModel = require('../models/AdminModel');
const StudentModel = require('../models/StudentModel');
const { AuthenticationError, AuthorizationError } = require('./errorHandler');
const logger = require('../utils/logger');

// Authentication middleware
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // Handle missing authorization header directly
    if (!authHeader) {
      logger.logAuth('token_verification_failed', null, false, {
        error: 'Authorization header missing',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });
      return res.status(401).json({
        success: false,
        error: {
          message: 'Authorization header missing',
          status: 'fail'
        }
      });
    }

    const token = jwtUtil.extractTokenFromHeader(authHeader);

    // Check if token is blacklisted
    if (jwtUtil.isTokenBlacklisted(token)) {
      throw new AuthenticationError('Token has been revoked');
    }

    // Verify token
    const decoded = jwtUtil.verifyAccessToken(token);

    // Get user data based on role
    let user;
    if (decoded.role === 'admin') {
      user = await AdminModel.getAdminWithProfile(decoded.id);
    } else if (decoded.role === 'student') {
      user = await StudentModel.getStudentWithProfile(decoded.id);
    }

    if (!user) {
      throw new AuthenticationError('User not found');
    }

    if (!user.is_active) {
      throw new AuthenticationError('Account is deactivated');
    }

    // Check if account is locked
    if (decoded.role === 'admin' && AdminModel.isAccountLocked(user)) {
      throw new AuthenticationError('Account is temporarily locked');
    }

    if (decoded.role === 'student' && StudentModel.isAccountLocked(user)) {
      throw new AuthenticationError('Account is temporarily locked');
    }

    // Attach user to request
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      firstName: decoded.firstName,
      lastName: decoded.lastName,
      grade_level: decoded.grade_level,
      position: user.position || null, // Add position for admin users
      department: user.department || null, // Add department for admin users
      fullUser: user,
    };

    // Log authentication
    logger.logAuth('token_verified', decoded.id, true, {
      role: decoded.role,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    next();
  } catch (error) {
    logger.logAuth('token_verification_failed', null, false, {
      error: error.message,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });
    next(error);
  }
};

// Authorization middleware factory
const authorize = (...roles) => (req, res, next) => {
  if (!req.user) {
    return next(new AuthenticationError('Authentication required'));
  }

  if (!roles.includes(req.user.role)) {
    logger.logAuth('authorization_failed', req.user.id, false, {
      requiredRoles: roles,
      userRole: req.user.role,
      ip: req.ip,
    });
    return next(new AuthorizationError('Insufficient permissions'));
  }

  next();
};

// Admin only middleware
const adminOnly = authorize('admin');

// Student only middleware
const studentOnly = authorize('student');

// Admin or student middleware
const authenticated = authorize('admin', 'student');

// Optional authentication middleware (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return next();
    }

    const token = jwtUtil.extractTokenFromHeader(authHeader);

    // Check if token is blacklisted
    if (jwtUtil.isTokenBlacklisted(token)) {
      return next();
    }

    // Verify token
    const decoded = jwtUtil.verifyAccessToken(token);

    // Get user data based on role
    let user;
    if (decoded.role === 'admin') {
      user = await AdminModel.getAdminWithProfile(decoded.id);
    } else if (decoded.role === 'student') {
      user = await StudentModel.getStudentWithProfile(decoded.id);
    }

    if (user && user.is_active) {
      req.user = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
        firstName: decoded.firstName,
        lastName: decoded.lastName,
        grade_level: decoded.grade_level,
        fullUser: user,
      };
    }

    next();
  } catch (error) {
    // Don't fail on optional auth errors, just continue without user
    next();
  }
};

// Resource ownership middleware
const requireOwnership = (resourceIdParam = 'id', userIdField = 'id') => (req, res, next) => {
  if (!req.user) {
    return next(new AuthenticationError('Authentication required'));
  }

  const resourceId = req.params[resourceIdParam];
  const userId = req.user[userIdField];

  // Admins can access any resource
  if (req.user.role === 'admin') {
    return next();
  }

  // Check ownership
  if (resourceId !== userId.toString()) {
    logger.logAuth('ownership_check_failed', req.user.id, false, {
      resourceId,
      userId,
      ip: req.ip,
    });
    return next(new AuthorizationError('Access denied: resource ownership required'));
  }

  next();
};

// User rate limiting removed per user request

// Middleware to check if user email is verified
const requireEmailVerification = (req, res, next) => {
  if (!req.user) {
    return next(new AuthenticationError('Authentication required'));
  }

  if (!req.user.fullUser.email_verified) {
    return next(new AuthorizationError('Email verification required'));
  }

  next();
};

// Middleware to log user activity
const logUserActivity = (action) => (req, res, next) => {
  if (req.user) {
    logger.info('User Activity', {
      userId: req.user.id,
      userRole: req.user.role,
      action,
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString(),
    });
  }
  next();
};

module.exports = {
  authenticate,
  authorize,
  adminOnly,
  studentOnly,
  authenticated,
  optionalAuth,
  requireOwnership,
  requireEmailVerification,
  logUserActivity,
};
