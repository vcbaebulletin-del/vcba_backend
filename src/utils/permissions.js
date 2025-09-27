/**
 * Position-Based Permissions System
 * Defines permissions for different admin positions
 */

// Define admin positions
const POSITIONS = {
  SUPER_ADMIN: 'super_admin',
  PROFESSOR: 'professor'
};

// Define permission categories
const PERMISSIONS = {
  // Category & Subcategory Management
  MANAGE_CATEGORIES: 'manage_categories',
  MANAGE_SUBCATEGORIES: 'manage_subcategories',
  
  // Admin Management
  MANAGE_ADMIN_ACCOUNTS: 'manage_admin_accounts',
  MANAGE_ADMIN_PROFILES: 'manage_admin_profiles',
  
  // System Settings
  MANAGE_SMS_SETTINGS: 'manage_sms_settings',
  MANAGE_SYSTEM_SETTINGS: 'manage_system_settings',
  
  // Student Management
  MANAGE_STUDENTS: 'manage_students',
  VIEW_STUDENTS: 'view_students',
  
  // Content Management
  CREATE_ANNOUNCEMENTS: 'create_announcements',
  MANAGE_ANNOUNCEMENTS: 'manage_announcements',
  CREATE_CALENDAR_EVENTS: 'create_calendar_events',
  MANAGE_CALENDAR_EVENTS: 'manage_calendar_events',
  CREATE_NEWSFEED_POSTS: 'create_newsfeed_posts',
  
  // Archive Management
  VIEW_ARCHIVE: 'view_archive',
  MANAGE_ARCHIVE: 'manage_archive',
  
  // TV Display Management
  MANAGE_TV_DISPLAY: 'manage_tv_display'
};

// Define position-based permissions mapping
const POSITION_PERMISSIONS = {
  [POSITIONS.SUPER_ADMIN]: [
    // Full system access
    PERMISSIONS.MANAGE_CATEGORIES,
    PERMISSIONS.MANAGE_SUBCATEGORIES,
    PERMISSIONS.MANAGE_ADMIN_ACCOUNTS,
    PERMISSIONS.MANAGE_ADMIN_PROFILES,
    PERMISSIONS.MANAGE_SMS_SETTINGS,
    PERMISSIONS.MANAGE_SYSTEM_SETTINGS,
    PERMISSIONS.MANAGE_STUDENTS,
    PERMISSIONS.VIEW_STUDENTS,
    PERMISSIONS.CREATE_ANNOUNCEMENTS,
    PERMISSIONS.MANAGE_ANNOUNCEMENTS,
    PERMISSIONS.CREATE_CALENDAR_EVENTS,
    PERMISSIONS.MANAGE_CALENDAR_EVENTS,
    PERMISSIONS.CREATE_NEWSFEED_POSTS,
    PERMISSIONS.VIEW_ARCHIVE,
    PERMISSIONS.MANAGE_ARCHIVE,
    PERMISSIONS.MANAGE_TV_DISPLAY
  ],
  
  [POSITIONS.PROFESSOR]: [
    // Content creation and student management
    PERMISSIONS.VIEW_STUDENTS, // Can view students
    PERMISSIONS.MANAGE_STUDENTS, // Can manage students (limited to their grade level)
    PERMISSIONS.CREATE_ANNOUNCEMENTS,
    PERMISSIONS.MANAGE_ANNOUNCEMENTS, // Can manage their own announcements
    PERMISSIONS.CREATE_CALENDAR_EVENTS,
    PERMISSIONS.MANAGE_CALENDAR_EVENTS, // Can manage their own calendar events
    PERMISSIONS.CREATE_NEWSFEED_POSTS,
    PERMISSIONS.VIEW_ARCHIVE, // Read-only archive access
    PERMISSIONS.MANAGE_TV_DISPLAY // Can manage TV display
  ]
};

/**
 * Permission checking utilities
 */
class PermissionChecker {
  /**
   * Check if a position has a specific permission
   * @param {string} position - Admin position (super_admin, professor)
   * @param {string} permission - Permission to check
   * @returns {boolean}
   */
  static hasPermission(position, permission) {
    if (!position || !permission) {
      return false;
    }
    
    const positionPermissions = POSITION_PERMISSIONS[position] || [];
    return positionPermissions.includes(permission);
  }
  
  /**
   * Check if a user has a specific permission
   * @param {Object} user - User object with position property
   * @param {string} permission - Permission to check
   * @returns {boolean}
   */
  static userHasPermission(user, permission) {
    if (!user || !user.position) {
      return false;
    }
    
    return this.hasPermission(user.position, permission);
  }
  
  /**
   * Check if a position can access admin management features
   * @param {string} position - Admin position
   * @returns {boolean}
   */
  static canManageAdmins(position) {
    return this.hasPermission(position, PERMISSIONS.MANAGE_ADMIN_ACCOUNTS);
  }
  
  /**
   * Check if a position can manage categories/subcategories
   * @param {string} position - Admin position
   * @returns {boolean}
   */
  static canManageCategories(position) {
    return this.hasPermission(position, PERMISSIONS.MANAGE_CATEGORIES);
  }
  
  /**
   * Check if a position can manage system settings
   * @param {string} position - Admin position
   * @returns {boolean}
   */
  static canManageSystemSettings(position) {
    return this.hasPermission(position, PERMISSIONS.MANAGE_SYSTEM_SETTINGS);
  }
  
  /**
   * Check if a position can fully manage students (create, update, delete)
   * @param {string} position - Admin position
   * @returns {boolean}
   */
  static canManageStudents(position) {
    return this.hasPermission(position, PERMISSIONS.MANAGE_STUDENTS);
  }
  
  /**
   * Check if a position can view students (read-only)
   * @param {string} position - Admin position
   * @returns {boolean}
   */
  static canViewStudents(position) {
    return this.hasPermission(position, PERMISSIONS.VIEW_STUDENTS);
  }
  
  /**
   * Check if a position can manage SMS settings
   * @param {string} position - Admin position
   * @returns {boolean}
   */
  static canManageSMSSettings(position) {
    return this.hasPermission(position, PERMISSIONS.MANAGE_SMS_SETTINGS);
  }
  
  /**
   * Get all permissions for a position
   * @param {string} position - Admin position
   * @returns {Array<string>}
   */
  static getPositionPermissions(position) {
    return POSITION_PERMISSIONS[position] || [];
  }
  
  /**
   * Validate if a position is valid
   * @param {string} position - Position to validate
   * @returns {boolean}
   */
  static isValidPosition(position) {
    return Object.values(POSITIONS).includes(position);
  }
  
  /**
   * Get all available positions
   * @returns {Object}
   */
  static getPositions() {
    return POSITIONS;
  }
  
  /**
   * Get all available permissions
   * @returns {Object}
   */
  static getPermissions() {
    return PERMISSIONS;
  }
}

module.exports = {
  POSITIONS,
  PERMISSIONS,
  POSITION_PERMISSIONS,
  PermissionChecker
};
