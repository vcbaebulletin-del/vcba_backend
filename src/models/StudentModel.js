const bcrypt = require('bcryptjs');
const BaseModel = require('./BaseModel');
const { ValidationError, ConflictError, NotFoundError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

class StudentModel extends BaseModel {
  constructor() {
    super('student_accounts', 'student_id');
  }

  // Create student account with profile
  async createStudent(accountData, profileData) {
    return await this.transaction(async (connection) => {
      try {
        // Validate required fields
        this.validateRequired(accountData, ['email', 'password', 'student_number', 'created_by']);
        this.validateRequired(profileData, ['first_name', 'last_name', 'phone_number', 'grade_level']);

        // Check if email or student number already exists
        const existingEmail = await this.findBy('email', accountData.email);
        if (existingEmail) {
          throw new ConflictError('Email already exists');
        }

        const existingStudentNumber = await this.findBy('student_number', accountData.student_number);
        if (existingStudentNumber) {
          throw new ConflictError('Student number already exists');
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(accountData.password, 12);

        // Prepare account data
        const studentAccount = {
          email: accountData.email,
          password: hashedPassword,
          student_number: accountData.student_number,
          is_active: accountData.is_active !== undefined ? accountData.is_active : true,
          last_login: null,
          created_by: accountData.created_by,
          created_at: new Date(),
          updated_at: new Date(),
        };

        // Insert student account
        const [accountResult] = await connection.execute(
          `INSERT INTO student_accounts (email, password, student_number, is_active, last_login, created_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          Object.values(studentAccount),
        );

        const studentId = accountResult.insertId;

        // Prepare profile data
        const studentProfile = {
          student_id: studentId,
          first_name: profileData.first_name,
          middle_name: profileData.middle_name || null,
          last_name: profileData.last_name,
          suffix: profileData.suffix || null,
          phone_number: profileData.phone_number,
          grade_level: profileData.grade_level,
          section: profileData.section || '1', // Default to '1' if not provided (VARCHAR field)
          parent_guardian_name: profileData.parent_guardian_name || null,
          parent_guardian_phone: profileData.parent_guardian_phone || null,
          address: profileData.address || null,
          profile_picture: profileData.profile_picture || null,
          created_at: new Date(),
          updated_at: new Date(),
        };

        // Insert student profile
        await connection.execute(
          `INSERT INTO student_profiles (student_id, first_name, middle_name, last_name, suffix, phone_number, grade_level, section, parent_guardian_name, parent_guardian_phone, address, profile_picture, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          Object.values(studentProfile),
        );

        // Return complete student data using the same connection

        const sql = `
          SELECT
            s.student_id,
            s.email,
            s.student_number,
            s.is_active,
            s.last_login,
            s.created_by,
            s.created_at as account_created_at,
            s.updated_at as account_updated_at,
            p.profile_id,
            p.first_name,
            p.middle_name,
            p.last_name,
            p.suffix,
            p.phone_number,
            p.grade_level,
            p.parent_guardian_name,
            p.parent_guardian_phone,
            p.address,
            p.profile_picture,
            p.created_at as profile_created_at,
            p.updated_at as profile_updated_at
          FROM student_accounts s
          LEFT JOIN student_profiles p ON s.student_id = p.student_id
          WHERE s.student_id = ?
        `;

        const [rows] = await connection.execute(sql, [studentId]);
        const result = rows[0] || null;

        if (!result) {
          return null;
        }

        // Format the result to match expected structure
        const formattedResult = {
          student_id: result.student_id,
          email: result.email,
          student_number: result.student_number,
          is_active: result.is_active,
          last_login: result.last_login,
          created_by: result.created_by,
          created_at: result.account_created_at,
          updated_at: result.account_updated_at,
          profile: {
            profile_id: result.profile_id,
            first_name: result.first_name,
            middle_name: result.middle_name,
            last_name: result.last_name,
            suffix: result.suffix,
            full_name: [result.first_name, result.middle_name, result.last_name, result.suffix].filter(Boolean).join(' '),
            phone_number: result.phone_number,
            grade_level: result.grade_level,
            parent_guardian_name: result.parent_guardian_name,
            parent_guardian_phone: result.parent_guardian_phone,
            address: result.address,
            profile_picture: result.profile_picture,
            created_at: result.profile_created_at,
            updated_at: result.profile_updated_at
          }
        };

        return formattedResult;
      } catch (error) {
        throw error;
      }
    });
  }

  // Get student with profile
  async getStudentWithProfile(studentId) {
    const sql = `
      SELECT
        s.student_id,
        s.email,
        s.student_number,
        s.is_active,
        s.last_login,
        s.created_by,
        s.created_at as account_created_at,
        s.updated_at as account_updated_at,
        p.profile_id,
        p.first_name,
        p.middle_name,
        p.last_name,
        p.suffix,
        p.phone_number,
        p.grade_level,
        p.parent_guardian_name,
        p.parent_guardian_phone,
        p.address,
        p.profile_picture,
        p.created_at as profile_created_at,
        p.updated_at as profile_updated_at
      FROM student_accounts s
      LEFT JOIN student_profiles p ON s.student_id = p.student_id
      WHERE s.student_id = ?
    `;

    const result = await this.db.findOne(sql, [studentId]);

    if (!result) {
      return null;
    }

    // Format the result to match expected structure
    return {
      student_id: result.student_id,
      email: result.email,
      student_number: result.student_number,
      is_active: result.is_active,
      last_login: result.last_login,
      created_by: result.created_by,
      created_at: result.account_created_at,
      updated_at: result.account_updated_at,
      profile: {
        profile_id: result.profile_id,
        first_name: result.first_name,
        middle_name: result.middle_name,
        last_name: result.last_name,
        suffix: result.suffix,
        full_name: [result.first_name, result.middle_name, result.last_name, result.suffix].filter(Boolean).join(' '),
        phone_number: result.phone_number,
        grade_level: result.grade_level,
        parent_guardian_name: result.parent_guardian_name,
        parent_guardian_phone: result.parent_guardian_phone,
        address: result.address,
        profile_picture: result.profile_picture,
        created_at: result.profile_created_at,
        updated_at: result.profile_updated_at
      }
    };
  }

  // Find student by email with profile
  async findByEmailWithProfile(email) {
    const sql = `
      SELECT
        s.student_id,
        s.email,
        s.password,
        s.student_number,
        s.is_active,
        s.last_login,
        s.created_by,
        s.created_at as account_created_at,
        s.updated_at as account_updated_at,
        p.profile_id,
        p.first_name,
        p.middle_name,
        p.last_name,
        p.suffix,
        CONCAT_WS(' ', p.first_name, p.middle_name, p.last_name, p.suffix) as full_name,
        p.phone_number,
        p.grade_level,
        p.parent_guardian_name,
        p.parent_guardian_phone,
        p.address,
        p.profile_picture
      FROM student_accounts s
      LEFT JOIN student_profiles p ON s.student_id = p.student_id
      WHERE s.email = ?
    `;

    return await this.db.findOne(sql, [email]);
  }

  // Find student by student number with profile
  async findByStudentNumberWithProfile(studentNumber) {
    const sql = `
      SELECT
        s.student_id,
        s.email,
        s.password,
        s.student_number,
        s.is_active,
        s.last_login,
        s.created_by,
        s.created_at as account_created_at,
        s.updated_at as account_updated_at,
        p.profile_id,
        p.first_name,
        p.middle_name,
        p.last_name,
        p.suffix,
        CONCAT_WS(' ', p.first_name, p.middle_name, p.last_name, p.suffix) as full_name,
        p.phone_number,
        p.grade_level,
        p.parent_guardian_name,
        p.parent_guardian_phone,
        p.address,
        p.profile_picture
      FROM student_accounts s
      LEFT JOIN student_profiles p ON s.student_id = p.student_id
      WHERE s.student_number = ?
    `;

    return await this.db.findOne(sql, [studentNumber]);
  }

  // Find student by ID with password (for password verification)
  async findByIdWithPassword(studentId) {
    const sql = `
      SELECT
        s.student_id,
        s.email,
        s.password,
        s.student_number,
        s.is_active,
        s.last_login,
        s.created_by,
        s.created_at as account_created_at,
        s.updated_at as account_updated_at,
        p.first_name,
        p.last_name,
        p.middle_name,
        p.suffix,
        p.phone_number,
        p.grade_level,
        p.profile_picture
      FROM student_accounts s
      LEFT JOIN student_profiles p ON s.student_id = p.student_id
      WHERE s.student_id = ? AND s.is_active = 1
    `;

    return await this.db.findOne(sql, [studentId]);
  }

  // Update student profile
  async updateProfile(studentId, profileData) {
    const allowedFields = [
      'first_name', 'middle_name', 'last_name', 'suffix', 'phone_number', 'grade_level',
      'parent_guardian_name', 'parent_guardian_phone', 'address', 'profile_picture',
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
      'student_profiles',
      updateData,
      'student_id = ?',
      [studentId],
    );

    if (result.affectedRows === 0) {
      throw new NotFoundError('Student profile not found');
    }

    return await this.getStudentWithProfile(studentId);
  }

  // Update student account
  async updateAccount(studentId, accountData) {
    const allowedFields = ['email', 'student_number', 'is_active'];

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
      'student_accounts',
      updateData,
      'student_id = ?',
      [studentId],
    );

    if (result.affectedRows === 0) {
      throw new NotFoundError('Student account not found');
    }

    return await this.getStudentWithProfile(studentId);
  }

  // Verify password
  async verifyPassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  // Update last login
  async updateLastLogin(studentId) {
    return await this.db.update(
      'student_accounts',
      {
        last_login: new Date(),
        updated_at: new Date(),
      },
      'student_id = ?',
      [studentId],
    );
  }

  // Failed login attempt handling removed per user request

  // Get all students with profiles and filtering
  async getAllStudentsWithProfiles(filters = {}, page = 1, limit = 20) {
    let sql = `
      SELECT
        s.student_id,
        s.email,
        s.student_number,
        s.is_active,
        s.last_login,
        s.created_by,
        s.created_at as account_created_at,
        s.updated_at as account_updated_at,
        p.profile_id,
        p.first_name,
        p.middle_name,
        p.last_name,
        p.suffix,
        p.phone_number,
        p.grade_level,
        p.parent_guardian_name,
        p.parent_guardian_phone,
        p.address,
        p.profile_picture,
        p.created_at as profile_created_at,
        p.updated_at as profile_updated_at
      FROM student_accounts s
      LEFT JOIN student_profiles p ON s.student_id = p.student_id
    `;

    const params = [];
    const conditions = [];

    // Add filters
    if (filters.grade_level) {
      conditions.push('p.grade_level = ?');
      params.push(filters.grade_level);
    }



    if (filters.is_active !== undefined) {
      conditions.push('s.is_active = ?');
      params.push(filters.is_active);
    }

    if (filters.search) {
      conditions.push(`(
        CONCAT_WS(' ', p.first_name, p.middle_name, p.last_name, p.suffix) LIKE ? OR
        p.first_name LIKE ? OR
        p.last_name LIKE ? OR
        s.email LIKE ? OR
        s.student_number LIKE ?
      )`);
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    sql += ' ORDER BY s.created_at DESC';

    const result = await this.db.findMany(sql, params, page, limit);

    // Format the results to match expected structure
    if (result && result.data) {
      result.data = result.data.map(row => ({
        student_id: row.student_id,
        email: row.email,
        student_number: row.student_number,
        is_active: row.is_active,
        last_login: row.last_login,
        created_by: row.created_by,
        created_at: row.account_created_at,
        updated_at: row.account_updated_at,
        profile: {
          profile_id: row.profile_id,
          first_name: row.first_name,
          middle_name: row.middle_name,
          last_name: row.last_name,
          suffix: row.suffix,
          full_name: [row.first_name, row.middle_name, row.last_name, row.suffix].filter(Boolean).join(' '),
          phone_number: row.phone_number,
          grade_level: row.grade_level,
          parent_guardian_name: row.parent_guardian_name,
          parent_guardian_phone: row.parent_guardian_phone,
          address: row.address,
          profile_picture: row.profile_picture,
          created_at: row.profile_created_at,
          updated_at: row.profile_updated_at
        }
      }));
    }

    return result;
  }

  // Check if account is locked (placeholder method)
  isAccountLocked(user) {
    // For now, return false as we don't have account locking implemented
    // This can be extended later to check for failed login attempts, etc.
    return false;
  }

  // Get archived students (inactive accounts)
  async getArchivedStudents(filters = {}, pagination = {}) {
    try {
      const {
        search,
        grade_level,
        created_by,
        start_date,
        end_date
      } = filters;

      const {
        page = 1,
        limit = 20,
        sort_by = 'updated_at',
        sort_order = 'DESC'
      } = pagination;

      let whereConditions = ['s.is_active = 0'];
      let queryParams = [];

      // Add search filter
      if (search) {
        whereConditions.push('(s.email LIKE ? OR s.student_number LIKE ? OR p.first_name LIKE ? OR p.last_name LIKE ?)');
        queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
      }

      // Add grade level filter
      if (grade_level) {
        whereConditions.push('p.grade_level = ?');
        queryParams.push(grade_level);
      }



      // Add creator filter
      if (created_by) {
        whereConditions.push('s.created_by = ?');
        queryParams.push(created_by);
      }

      // Add date range filter (when account was deactivated)
      if (start_date) {
        whereConditions.push('DATE(s.updated_at) >= ?');
        queryParams.push(start_date);
      }

      if (end_date) {
        whereConditions.push('DATE(s.updated_at) <= ?');
        queryParams.push(end_date);
      }

      const whereClause = whereConditions.join(' AND ');

      // Get total count
      const countSql = `
        SELECT COUNT(*) as total
        FROM student_accounts s
        LEFT JOIN student_profiles p ON s.student_id = p.student_id
        WHERE ${whereClause}
      `;
      const countResult = await this.db.findOne(countSql, queryParams);
      const total = countResult.total;

      // Calculate pagination
      const offset = (page - 1) * limit;
      const totalPages = Math.ceil(total / limit);

      // Get archived students with full details
      const sql = `
        SELECT
          s.student_id,
          s.email,
          s.student_number,
          s.is_active,
          s.last_login,
          s.created_by,
          s.created_at as account_created_at,
          s.updated_at as account_updated_at,
          p.profile_id,
          p.first_name,
          p.middle_name,
          p.last_name,
          p.suffix,
          p.phone_number,
          p.grade_level,
          p.parent_guardian_name,
          p.parent_guardian_phone,
          p.address,
          p.profile_picture,
          p.created_at as profile_created_at,
          p.updated_at as profile_updated_at,
          COALESCE(
            CASE
              WHEN ap.first_name IS NOT NULL OR ap.last_name IS NOT NULL
              THEN TRIM(CONCAT(COALESCE(ap.first_name, ''), ' ', COALESCE(ap.last_name, '')))
              WHEN aa.email IS NOT NULL
              THEN aa.email
              ELSE 'Unknown Admin'
            END,
            'Unknown Admin'
          ) as created_by_name
        FROM student_accounts s
        LEFT JOIN student_profiles p ON s.student_id = p.student_id
        LEFT JOIN admin_accounts aa ON s.created_by = aa.admin_id
        LEFT JOIN admin_profiles ap ON aa.admin_id = ap.admin_id
        WHERE ${whereClause}
        ORDER BY s.${sort_by} ${sort_order}
        LIMIT ? OFFSET ?
      `;

      queryParams.push(limit, offset);
      const results = await this.db.query(sql, queryParams);

      // Format results to match expected structure
      const students = results.map(row => ({
        student_id: row.student_id,
        email: row.email,
        student_number: row.student_number,
        is_active: row.is_active,
        last_login: row.last_login,
        created_by: row.created_by,
        created_by_name: row.created_by_name,
        created_at: row.account_created_at,
        updated_at: row.account_updated_at,
        profile: row.profile_id ? {
          profile_id: row.profile_id,
          first_name: row.first_name,
          middle_name: row.middle_name,
          last_name: row.last_name,
          suffix: row.suffix,
          full_name: [row.first_name, row.middle_name, row.last_name, row.suffix].filter(Boolean).join(' '),
          phone_number: row.phone_number,
          grade_level: row.grade_level,
          parent_guardian_name: row.parent_guardian_name,
          parent_guardian_phone: row.parent_guardian_phone,
          address: row.address,
          profile_picture: row.profile_picture,
          created_at: row.profile_created_at,
          updated_at: row.profile_updated_at
        } : null
      }));

      return {
        data: students,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      };
    } catch (error) {
      throw new ValidationError(`Failed to get archived students: ${error.message}`);
    }
  }

  // Restore archived student (reactivate account)
  async restoreStudent(studentId) {
    try {
      const result = await this.db.update(
        'student_accounts',
        {
          is_active: true,
          updated_at: new Date()
        },
        'student_id = ? AND is_active = 0',
        [studentId]
      );

      if (result.affectedRows === 0) {
        throw new NotFoundError('Student not found or already active');
      }

      return await this.getStudentWithProfile(studentId);
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new ValidationError(`Failed to restore student: ${error.message}`);
    }
  }

  /**
   * Get active students for SMS notifications
   * @param {Object} filters - Filter options
   * @param {number} [filters.grade_level] - Filter by grade level (optional)
   * @returns {Promise<Array>} - Array of students with phone numbers
   */
  async getActiveStudentsForSMS(filters = {}) {
    try {
      console.log('📱 getActiveStudentsForSMS called with filters:', filters);

      let sql = `
        SELECT
          s.student_id,
          p.first_name,
          p.last_name,
          p.phone_number,
          p.grade_level
        FROM student_accounts s
        INNER JOIN student_profiles p ON s.student_id = p.student_id
        WHERE s.is_active = 1
          AND p.phone_number IS NOT NULL
          AND p.phone_number != ''
      `;

      const params = [];

      // Add grade level filter if specified
      if (filters.grade_level) {
        sql += ' AND p.grade_level = ?';
        params.push(filters.grade_level);
        console.log(`📱 Filtering by grade level: ${filters.grade_level}`);
      }

      sql += ' ORDER BY p.grade_level, p.last_name, p.first_name';

      console.log('📱 Executing SQL:', sql);
      console.log('📱 With params:', params);

      const rows = await this.db.query(sql, params);

      console.log(`📱 Found ${rows.length} students with phone numbers`);

      // Log phone number formats for debugging
      if (rows.length > 0) {
        console.log('📱 Sample phone numbers:', rows.slice(0, 3).map(row => ({
          name: `${row.first_name} ${row.last_name}`,
          phone: row.phone_number,
          grade: row.grade_level
        })));
      }

      const result = rows.map(row => ({
        student_id: row.student_id,
        full_name: `${row.first_name} ${row.last_name}`.trim(),
        phone_number: row.phone_number,
        grade_level: row.grade_level
      }));

      console.log(`📱 Returning ${result.length} students for SMS`);
      return result;
    } catch (error) {
      logger.error('Error getting active students for SMS:', error);
      throw error;
    }
  }

  /**
   * Bulk deactivate student accounts
   * @param {number[]} studentIds - Array of student IDs to deactivate
   * @returns {Promise<Object>} - Result with affectedRows count
   */
  async bulkDeactivate(studentIds) {
    if (!studentIds || studentIds.length === 0) {
      throw new ValidationError('Student IDs are required');
    }

    const placeholders = studentIds.map(() => '?').join(',');
    const sql = `
      UPDATE student_accounts 
      SET is_active = false, updated_at = NOW() 
      WHERE student_id IN (${placeholders})
    `;

    const result = await this.db.execute(sql, studentIds);
    return result;
  }
}

module.exports = new StudentModel();
