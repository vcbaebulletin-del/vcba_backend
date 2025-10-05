const bcrypt = require('bcryptjs');
const BaseModel = require('./BaseModel');
const { ValidationError, ConflictError, NotFoundError } = require('../middleware/errorHandler');
const { PermissionChecker, POSITIONS } = require('../utils/permissions');

class AdminModel extends BaseModel {
  constructor() {
    super('admin_accounts', 'admin_id');
  }

  // Create admin account with profile
  async createAdmin(accountData, profileData) {
    return await this.transaction(async (connection) => {
      try {
        // Validate required fields
        this.validateRequired(accountData, ['email', 'password']);
        this.validateRequired(profileData, ['first_name', 'last_name']);

        // Validate grade_level if provided
        if (profileData.grade_level !== undefined && profileData.grade_level !== null) {
          const gradeLevel = parseInt(profileData.grade_level);
          if (isNaN(gradeLevel) || gradeLevel < 11 || gradeLevel > 12) {
            throw new ValidationError('Grade level must be between 11 and 12');
          }
          profileData.grade_level = gradeLevel;
        }

        // Validate position if provided
        if (profileData.position !== undefined && profileData.position !== null) {
          if (!PermissionChecker.isValidPosition(profileData.position)) {
            throw new ValidationError(`Invalid position. Must be one of: ${Object.values(POSITIONS).join(', ')}`);
          }
        }

        // Check if email already exists
        const existingAdmin = await this.findBy('email', accountData.email);
        if (existingAdmin) {
          throw new ConflictError('Email already exists');
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(accountData.password, 12);

        // Prepare account data
        const adminAccount = {
          email: accountData.email,
          password: hashedPassword,
          is_active: accountData.is_active !== undefined ? accountData.is_active : true,
          last_login: null,
          password_reset_token: null,
          password_reset_expires: null,
          created_at: new Date(),
          updated_at: new Date(),
        };

        // Insert admin account
        const [accountResult] = await connection.execute(
          `INSERT INTO admin_accounts (email, password, is_active, last_login,
           password_reset_token, password_reset_expires, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          Object.values(adminAccount),
        );

        const adminId = accountResult.insertId;

        // Prepare profile data with proper defaults to handle Railway database constraints
        console.log('🔍 AdminModel - Input profileData.grade_level:', profileData.grade_level, 'Type:', typeof profileData.grade_level);

        const adminProfile = {
          admin_id: adminId,
          first_name: profileData.first_name,
          middle_name: profileData.middle_name || null,
          last_name: profileData.last_name,
          suffix: profileData.suffix || null,
          phone_number: profileData.phone_number || null,
          department: profileData.department || null,
          position: profileData.position, // Required field, should always be provided
          grade_level: profileData.grade_level !== undefined ? profileData.grade_level : null,
          bio: profileData.bio || null,
          profile_picture: profileData.profile_picture || null,
          created_at: new Date(),
          updated_at: new Date(),
        };

        console.log('🔍 AdminModel - Final adminProfile:', {
          grade_level: adminProfile.grade_level,
          position: adminProfile.position,
          department: adminProfile.department
        });

        // Insert admin profile with better error handling
        try {
          console.log('🔍 AdminModel - Inserting profile with values:', Object.values(adminProfile));

          await connection.execute(
            `INSERT INTO admin_profiles (admin_id, first_name, middle_name, last_name, suffix,
             phone_number, department, position, grade_level, bio, profile_picture, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            Object.values(adminProfile),
          );

          console.log('🔍 AdminModel - Profile inserted successfully with grade_level:', adminProfile.grade_level);
        } catch (profileError) {
          // Handle specific database constraint errors
          if (profileError.code === 'ER_DUP_ENTRY') {
            if (profileError.message.includes('uk_admin_phone')) {
              throw new ConflictError('Phone number already exists');
            }
            throw new ConflictError('Duplicate entry detected');
          }
          throw profileError;
        }

        // Return complete admin data - use connection for consistency
        const adminData = await this.getAdminWithProfileByConnection(connection, adminId);
        if (!adminData) {
          throw new Error('Failed to retrieve created admin data');
        }

        return adminData;
      } catch (error) {
        // Log the error for debugging
        console.error('Error in createAdmin:', error.message);
        throw error;
      }
    });
  }

  // Get admin with profile using existing connection (for transactions)
  async getAdminWithProfileByConnection(connection, adminId) {
    const sql = `
      SELECT
        a.admin_id,
        a.email,
        a.is_active,
        a.last_login,
        a.password_reset_token,
        a.password_reset_expires,
        a.created_at as account_created_at,
        a.updated_at as account_updated_at,
        p.first_name,
        p.middle_name,
        p.last_name,
        p.suffix,
        CONCAT_WS(' ', p.first_name, p.middle_name, p.last_name, p.suffix) as full_name,
        p.phone_number,
        p.department,
        p.position,
        p.grade_level,
        p.bio,
        p.profile_picture,
        p.created_at as profile_created_at,
        p.updated_at as profile_updated_at
      FROM admin_accounts a
      LEFT JOIN admin_profiles p ON a.admin_id = p.admin_id
      WHERE a.admin_id = ?
    `;

    const [rows] = await connection.execute(sql, [adminId]);
    return rows.length > 0 ? rows[0] : null;
  }

  // Get admin with profile
  async getAdminWithProfile(adminId) {
    const sql = `
      SELECT
        a.admin_id,
        a.email,
        a.is_active,
        a.last_login,
        a.password_reset_token,
        a.password_reset_expires,
        a.created_at as account_created_at,
        a.updated_at as account_updated_at,
        p.first_name,
        p.middle_name,
        p.last_name,
        p.suffix,
        CONCAT_WS(' ', p.first_name, p.middle_name, p.last_name, p.suffix) as full_name,
        p.phone_number,
        p.department,
        p.position,
        p.grade_level,
        p.bio,
        p.profile_picture,
        p.created_at as profile_created_at,
        p.updated_at as profile_updated_at
      FROM admin_accounts a
      LEFT JOIN admin_profiles p ON a.admin_id = p.admin_id
      WHERE a.admin_id = ?
    `;

    return await this.db.findOne(sql, [adminId]);
  }

  // Find admin by email with profile
  async findByEmailWithProfile(email) {
    const sql = `
      SELECT
        a.admin_id,
        a.email,
        a.password,
        a.is_active,
        a.last_login,
        a.password_reset_token,
        a.password_reset_expires,
        a.created_at as account_created_at,
        a.updated_at as account_updated_at,
        p.first_name,
        p.middle_name,
        p.last_name,
        p.suffix,
        CONCAT_WS(' ', p.first_name, p.middle_name, p.last_name, p.suffix) as full_name,
        p.phone_number,
        p.department,
        p.position,
        p.grade_level,
        p.bio,
        p.profile_picture
      FROM admin_accounts a
      LEFT JOIN admin_profiles p ON a.admin_id = p.admin_id
      WHERE a.email = ?
    `;

    return await this.db.findOne(sql, [email]);
  }

  // Update admin profile
  async updateProfile(adminId, profileData) {
    const allowedFields = [
      'first_name', 'middle_name', 'last_name', 'suffix',
      'phone_number', 'department', 'position', 'grade_level', 'bio', 'profile_picture',
    ];

    const updateData = {};
    allowedFields.forEach((field) => {
      if (profileData[field] !== undefined) {
        updateData[field] = profileData[field];
      }
    });

    if (Object.keys(updateData).length === 0) {
      throw new ValidationError('No valid fields to update');
    }

    updateData.updated_at = new Date();

    const result = await this.db.update(
      'admin_profiles',
      updateData,
      'admin_id = ?',
      [adminId],
    );

    if (result.affectedRows === 0) {
      throw new NotFoundError('Admin profile not found');
    }

    return await this.getAdminWithProfile(adminId);
  }

  // Update admin account
  async updateAccount(adminId, accountData) {
    const allowedFields = ['email', 'is_active'];

    const updateData = {};
    allowedFields.forEach((field) => {
      if (accountData[field] !== undefined) {
        updateData[field] = accountData[field];
      }
    });

    // Handle password update separately
    if (accountData.password) {
      updateData.password = await bcrypt.hash(accountData.password, 12);
    }

    if (Object.keys(updateData).length === 0) {
      throw new ValidationError('No valid fields to update');
    }

    updateData.updated_at = new Date();

    const result = await this.db.update(
      'admin_accounts',
      updateData,
      'admin_id = ?',
      [adminId],
    );

    if (result.affectedRows === 0) {
      throw new NotFoundError('Admin account not found');
    }

    return await this.getAdminWithProfile(adminId);
  }

  // Verify password
  async verifyPassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  // Update last login
  async updateLastLogin(adminId) {
    return await this.db.update(
      'admin_accounts',
      {
        last_login: new Date(),
        updated_at: new Date(),
      },
      'admin_id = ?',
      [adminId],
    );
  }

  // Failed login attempt handling removed per user request

  // Get all admins with profiles
  async getAllAdminsWithProfiles(page = 1, limit = 20) {
    const sql = `
      SELECT
        a.admin_id,
        a.email,
        a.is_active,
        a.last_login,
        a.created_at as account_created_at,
        CONCAT_WS(' ', p.first_name, p.middle_name, p.last_name, p.suffix) as full_name,
        p.phone_number,
        p.department,
        p.position,
        p.grade_level
      FROM admin_accounts a
      LEFT JOIN admin_profiles p ON a.admin_id = p.admin_id
      ORDER BY a.created_at DESC
    `;

    return await this.db.findMany(sql, [], page, limit);
  }

  // Get admins with pagination and filtering
  async getAdminsWithPagination({ page = 1, limit = 10, filters = {} }) {
    let whereConditions = [];
    let params = [];

    // Build WHERE conditions based on filters
    if (filters.position) {
      whereConditions.push('p.position = ?');
      params.push(filters.position);
    }

    if (filters.is_active !== undefined) {
      whereConditions.push('a.is_active = ?');
      params.push(filters.is_active);
    }

    if (filters.search) {
      whereConditions.push(`(
        p.first_name LIKE ? OR
        p.last_name LIKE ? OR
        p.middle_name LIKE ? OR
        a.email LIKE ? OR
        CONCAT_WS(' ', p.first_name, p.middle_name, p.last_name, p.suffix) LIKE ?
      )`);
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Count total items
    const countSql = `
      SELECT COUNT(*) as total
      FROM admin_accounts a
      LEFT JOIN admin_profiles p ON a.admin_id = p.admin_id
      ${whereClause}
    `;

    const countResult = await this.db.query(countSql, params);
    const totalItems = countResult?.[0]?.total || 0;

    // Get paginated data
    const offset = (page - 1) * limit;
    const dataSql = `
      SELECT
        a.admin_id,
        a.email,
        a.is_active,
        a.last_login,
        a.created_at as account_created_at,
        a.updated_at as account_updated_at,
        p.first_name,
        p.middle_name,
        p.last_name,
        p.suffix,
        CONCAT_WS(' ', p.first_name, p.middle_name, p.last_name, p.suffix) as full_name,
        p.phone_number,
        p.position,
        p.grade_level,
        p.profile_picture,
        p.created_at as profile_created_at,
        p.updated_at as profile_updated_at
      FROM admin_accounts a
      LEFT JOIN admin_profiles p ON a.admin_id = p.admin_id
      ${whereClause}
      ORDER BY a.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const dataResult = await this.db.query(dataSql, [...params, limit, offset]);

    // Transform data to match frontend interface
    const admins = dataResult.map(row => ({
      admin_id: row.admin_id,
      email: row.email,
      is_active: Boolean(row.is_active),
      last_login: row.last_login,
      created_at: row.account_created_at,
      profile: {
        first_name: row.first_name,
        middle_name: row.middle_name,
        last_name: row.last_name,
        suffix: row.suffix,
        full_name: row.full_name,
        phone_number: row.phone_number,
        position: row.position,
        grade_level: row.grade_level,
        profile_picture: row.profile_picture
      }
    }));

    return {
      admins,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalItems / limit),
        totalItems,
        itemsPerPage: parseInt(limit)
      }
    };
  }

  // Check if account is locked (placeholder method)
  isAccountLocked(user) {
    // For now, return false as we don't have account locking implemented
    // This can be extended later to check for failed login attempts, etc.
    return false;
  }

  // Get admins by grade level
  async getAdminsByGradeLevel(gradeLevel) {
    const sql = `
      SELECT
        a.admin_id,
        a.email,
        a.is_active,
        a.last_login,
        a.created_at as account_created_at,
        a.updated_at as account_updated_at,
        p.first_name,
        p.middle_name,
        p.last_name,
        p.suffix,
        CONCAT_WS(' ', p.first_name, p.middle_name, p.last_name, p.suffix) as full_name,
        p.phone_number,
        p.department,
        p.position,
        p.grade_level,
        p.bio,
        p.profile_picture,
        p.created_at as profile_created_at,
        p.updated_at as profile_updated_at
      FROM admin_accounts a
      LEFT JOIN admin_profiles p ON a.admin_id = p.admin_id
      WHERE p.grade_level = ? AND a.is_active = 1
      ORDER BY p.last_name, p.first_name
    `;

    return await this.db.findMany(sql, [gradeLevel]);
  }

  // Check if admin has access to specific grade level
  async hasGradeAccess(adminId, targetGradeLevel) {
    const admin = await this.getAdminWithProfile(adminId);
    if (!admin) {
      return false;
    }

    // System admins (grade_level = null) have access to all grades
    if (admin.grade_level === null) {
      return true;
    }

    // Grade-specific admins only have access to their assigned grade
    return admin.grade_level === targetGradeLevel;
  }

  // Find admin by ID with password (for password verification)
  async findByIdWithPassword(adminId) {
    const sql = `
      SELECT
        a.admin_id,
        a.email,
        a.password,
        a.is_active,
        a.last_login,
        a.created_at as account_created_at,
        a.updated_at as account_updated_at,
        p.first_name,
        p.last_name,
        p.middle_name,
        p.suffix,
        p.phone_number,
        p.department,
        p.position,
        p.grade_level,
        p.bio,
        p.profile_picture
      FROM admin_accounts a
      LEFT JOIN admin_profiles p ON a.admin_id = p.admin_id
      WHERE a.admin_id = ? AND a.is_active = 1
    `;

    return await this.db.findOne(sql, [adminId]);
  }

  // Update admin password
  async updatePassword(adminId, newPassword) {
    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    const result = await this.db.update(
      'admin_accounts',
      {
        password: hashedPassword,
        updated_at: new Date()
      },
      'admin_id = ?',
      [adminId]
    );

    if (result.affectedRows === 0) {
      throw new Error('Admin not found or password update failed');
    }

    return result;
  }

  // Position-based permission methods

  /**
   * Check if admin has a specific permission
   * @param {number} adminId - Admin ID
   * @param {string} permission - Permission to check
   * @returns {boolean}
   */
  async hasPermission(adminId, permission) {
    const admin = await this.getAdminWithProfile(adminId);
    if (!admin) {
      return false;
    }

    return PermissionChecker.userHasPermission(admin, permission);
  }

  /**
   * Get all admins with a specific position (active only)
   * @param {string} position - Position to filter by
   * @returns {Array}
   */
  async getAdminsByPosition(position) {
    if (!PermissionChecker.isValidPosition(position)) {
      throw new ValidationError(`Invalid position: ${position}`);
    }

    const sql = `
      SELECT
        a.admin_id,
        a.email,
        a.is_active,
        a.last_login,
        a.created_at as account_created_at,
        CONCAT_WS(' ', p.first_name, p.middle_name, p.last_name, p.suffix) as full_name,
        p.phone_number,
        p.department,
        p.position,
        p.grade_level
      FROM admin_accounts a
      LEFT JOIN admin_profiles p ON a.admin_id = p.admin_id
      WHERE p.position = ? AND a.is_active = 1
      ORDER BY p.last_name, p.first_name
    `;

    return await this.db.query(sql, [position]);
  }

  /**
   * Get all admins with a specific position (both active and inactive)
   * @param {string} position - Position to filter by
   * @returns {Array}
   */
  async getAllAdminsByPosition(position) {
    if (!PermissionChecker.isValidPosition(position)) {
      throw new ValidationError(`Invalid position: ${position}`);
    }

    const sql = `
      SELECT
        a.admin_id,
        a.email,
        a.is_active,
        a.last_login,
        a.created_at as account_created_at,
        CONCAT_WS(' ', p.first_name, p.middle_name, p.last_name, p.suffix) as full_name,
        p.phone_number,
        p.department,
        p.position,
        p.grade_level
      FROM admin_accounts a
      LEFT JOIN admin_profiles p ON a.admin_id = p.admin_id
      WHERE p.position = ?
      ORDER BY p.last_name, p.first_name
    `;

    return await this.db.query(sql, [position]);
  }

  /**
   * Check if admin can manage another admin (position hierarchy)
   * @param {number} adminId - Admin performing the action
   * @param {number} targetAdminId - Admin being managed
   * @returns {boolean}
   */
  async canManageAdmin(adminId, targetAdminId) {
    const admin = await this.getAdminWithProfile(adminId);
    const targetAdmin = await this.getAdminWithProfile(targetAdminId);

    if (!admin || !targetAdmin) {
      return false;
    }

    // Only super_admin can manage other admins
    return admin.position === POSITIONS.SUPER_ADMIN;
  }

  /**
   * Validate position update
   * @param {number} adminId - Admin ID
   * @param {string} newPosition - New position to assign
   * @param {number} updatingAdminId - Admin performing the update
   * @returns {boolean}
   */
  async validatePositionUpdate(adminId, newPosition, updatingAdminId) {
    // Validate position value
    if (!PermissionChecker.isValidPosition(newPosition)) {
      throw new ValidationError(`Invalid position: ${newPosition}`);
    }

    // Check if updating admin has permission to change positions
    const updatingAdmin = await this.getAdminWithProfile(updatingAdminId);
    if (!updatingAdmin || updatingAdmin.position !== POSITIONS.SUPER_ADMIN) {
      throw new ValidationError('Only super admins can change admin positions');
    }

    // Prevent super admin from demoting themselves if they're the only super admin
    if (adminId === updatingAdminId && newPosition !== POSITIONS.SUPER_ADMIN) {
      const allSuperAdmins = await this.getAllAdminsByPosition(POSITIONS.SUPER_ADMIN);
      const activeSuperAdmins = allSuperAdmins.filter(admin => admin.is_active);
      if (activeSuperAdmins.length <= 1) {
        throw new ValidationError('Cannot demote the last super admin');
      }
    }

    return true;
  }

  // Alias methods for controller compatibility
  async createAdminWithProfile(accountData, profileData) {
    return await this.createAdmin(accountData, profileData);
  }

  async updateAdminWithProfile(adminId, accountData, profileData) {
    return await this.transaction(async (connection) => {
      // Update account data if provided
      if (Object.keys(accountData).length > 0) {
        await this.updateAdminAccount(adminId, accountData);
      }

      // Update profile data if provided
      if (Object.keys(profileData).length > 0) {
        await this.updateAdminProfile(adminId, profileData);
      }

      // Return updated admin data
      return await this.getAdminWithProfileByConnection(connection, adminId);
    });
  }

  async updateAdminAccount(adminId, accountData) {
    const updateData = {
      ...accountData,
      updated_at: new Date()
    };

    return await this.db.update(
      'admin_accounts',
      updateData,
      'admin_id = ?',
      [adminId]
    );
  }

  async updateAdminProfile(adminId, profileData) {
    const updateData = {
      ...profileData,
      updated_at: new Date()
    };

    return await this.db.update(
      'admin_profiles',
      updateData,
      'admin_id = ?',
      [adminId]
    );
  }

  async deleteAdmin(adminId) {
    // Soft delete by setting is_active to false
    return await this.updateAdminAccount(adminId, { is_active: false });
  }
}

module.exports = new AdminModel();
