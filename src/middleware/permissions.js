const { PermissionChecker, PERMISSIONS } = require('../utils/permissions');
const { AuthorizationError } = require('./errorHandler');
const logger = require('../utils/logger');

/**
 * Position-based permission middleware
 * Checks if the authenticated admin has the required permission
 */

/**
 * Generic permission middleware factory
 * @param {string} requiredPermission - The permission required to access the route
 * @returns {Function} Express middleware function
 */
const requirePermission = (requiredPermission) => {
  return (req, res, next) => {
    try {
      // Ensure user is authenticated
      if (!req.user) {
        logger.logAuth('permission_check_failed', null, false, {
          reason: 'no_user',
          requiredPermission,
          ip: req.ip,
        });
        return next(new AuthorizationError('Authentication required'));
      }

      // Ensure user has position information
      if (!req.user.position) {
        logger.logAuth('permission_check_failed', req.user.id, false, {
          reason: 'no_position',
          requiredPermission,
          userEmail: req.user.email,
          ip: req.ip,
        });
        return next(new AuthorizationError('User position not defined'));
      }

      // Check if user has the required permission
      const hasPermission = PermissionChecker.userHasPermission(req.user, requiredPermission);
      
      if (!hasPermission) {
        logger.logAuth('permission_check_failed', req.user.id, false, {
          reason: 'insufficient_permissions',
          requiredPermission,
          userPosition: req.user.position,
          userEmail: req.user.email,
          ip: req.ip,
        });
        return next(new AuthorizationError('Insufficient permissions for this action'));
      }

      // Log successful permission check
      logger.logAuth('permission_check_success', req.user.id, true, {
        requiredPermission,
        userPosition: req.user.position,
        userEmail: req.user.email,
        ip: req.ip,
      });

      next();
    } catch (error) {
      logger.error('Permission middleware error:', error);
      next(new AuthorizationError('Permission check failed'));
    }
  };
};

/**
 * Specific permission middleware functions
 */

// Category & Subcategory Management
const requireManageCategories = requirePermission(PERMISSIONS.MANAGE_CATEGORIES);
const requireManageSubcategories = requirePermission(PERMISSIONS.MANAGE_SUBCATEGORIES);

// Admin Management
const requireManageAdminAccounts = requirePermission(PERMISSIONS.MANAGE_ADMIN_ACCOUNTS);
const requireManageAdminProfiles = requirePermission(PERMISSIONS.MANAGE_ADMIN_PROFILES);

// System Settings
const requireManageSMSSettings = requirePermission(PERMISSIONS.MANAGE_SMS_SETTINGS);
const requireManageSystemSettings = requirePermission(PERMISSIONS.MANAGE_SYSTEM_SETTINGS);

// Student Management
const requireManageStudents = requirePermission(PERMISSIONS.MANAGE_STUDENTS);
const requireViewStudents = requirePermission(PERMISSIONS.VIEW_STUDENTS);

// Content Management
const requireCreateAnnouncements = requirePermission(PERMISSIONS.CREATE_ANNOUNCEMENTS);
const requireManageAnnouncements = requirePermission(PERMISSIONS.MANAGE_ANNOUNCEMENTS);
const requireCreateCalendarEvents = requirePermission(PERMISSIONS.CREATE_CALENDAR_EVENTS);
const requireManageCalendarEvents = requirePermission(PERMISSIONS.MANAGE_CALENDAR_EVENTS);
const requireCreateNewsfeedPosts = requirePermission(PERMISSIONS.CREATE_NEWSFEED_POSTS);

// Archive Management
const requireViewArchive = requirePermission(PERMISSIONS.VIEW_ARCHIVE);
const requireManageArchive = requirePermission(PERMISSIONS.MANAGE_ARCHIVE);

// TV Display Management
const requireManageTVDisplay = requirePermission(PERMISSIONS.MANAGE_TV_DISPLAY);

/**
 * Position-based middleware (for backward compatibility and specific position checks)
 */

/**
 * Require super admin position
 */
const requireSuperAdmin = (req, res, next) => {
  if (!req.user) {
    return next(new AuthorizationError('Authentication required'));
  }

  if (req.user.position !== 'super_admin') {
    logger.logAuth('super_admin_check_failed', req.user.id, false, {
      userPosition: req.user.position,
      userEmail: req.user.email,
      ip: req.ip,
    });
    return next(new AuthorizationError('Super admin access required'));
  }

  next();
};

/**
 * Allow both super admin and professor positions
 */
const requireAdminOrProfessor = (req, res, next) => {
  if (!req.user) {
    return next(new AuthorizationError('Authentication required'));
  }

  const allowedPositions = ['super_admin', 'professor'];
  if (!allowedPositions.includes(req.user.position)) {
    logger.logAuth('admin_professor_check_failed', req.user.id, false, {
      userPosition: req.user.position,
      userEmail: req.user.email,
      ip: req.ip,
    });
    return next(new AuthorizationError('Admin or professor access required'));
  }

  next();
};

/**
 * Utility function to check permissions in controllers
 * @param {Object} user - User object
 * @param {string} permission - Permission to check
 * @returns {boolean}
 */
const checkUserPermission = (user, permission) => {
  return PermissionChecker.userHasPermission(user, permission);
};

module.exports = {
  // Generic permission middleware
  requirePermission,
  
  // Specific permission middleware
  requireManageCategories,
  requireManageSubcategories,
  requireManageAdminAccounts,
  requireManageAdminProfiles,
  requireManageSMSSettings,
  requireManageSystemSettings,
  requireManageStudents,
  requireViewStudents,
  requireCreateAnnouncements,
  requireManageAnnouncements,
  requireCreateCalendarEvents,
  requireManageCalendarEvents,
  requireCreateNewsfeedPosts,
  requireViewArchive,
  requireManageArchive,
  requireManageTVDisplay,
  
  // Position-based middleware
  requireSuperAdmin,
  requireAdminOrProfessor,
  
  // Utility functions
  checkUserPermission
};
