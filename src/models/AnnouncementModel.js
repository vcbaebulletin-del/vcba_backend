const BaseModel = require('./BaseModel');
const { ValidationError, NotFoundError, ConflictError } = require('../middleware/errorHandler');

class AnnouncementModel extends BaseModel {
  constructor() {
    super('announcements', 'announcement_id');
  }

  // Create announcement
  async createAnnouncement(data) {
    try {
      // Validate required fields
      this.validateRequired(data, ['title', 'content', 'category_id', 'posted_by']);

      // Prepare announcement data
      const announcementData = {
        title: data.title,
        content: data.content,
        image_path: data.image_path || null,
        category_id: data.category_id,
        subcategory_id: data.subcategory_id || null,
        posted_by: data.posted_by,
        grade_level: data.grade_level || null,
        status: data.status || 'pending',
        is_pinned: data.is_pinned !== undefined ? Boolean(data.is_pinned) : false,
        is_alert: data.is_alert !== undefined ? Boolean(data.is_alert) : false,
        allow_comments: data.allow_comments !== undefined ? Boolean(data.allow_comments) : true,
        allow_sharing: data.allow_sharing !== undefined ? Boolean(data.allow_sharing) : true,
        scheduled_publish_at: this.formatDateTimeForMySQL(data.scheduled_publish_at),
        visibility_start_at: this.formatDateTimeForMySQL(data.visibility_start_at),
        visibility_end_at: this.formatDateTimeForMySQL(data.visibility_end_at),
        published_at: data.status === 'published' ? new Date().toISOString() : null, // FIX: Use UTC string
        created_at: new Date().toISOString(), // FIX: Use UTC string to prevent timezone conversion
        updated_at: new Date().toISOString()  // FIX: Use UTC string to prevent timezone conversion
      };

      const result = await this.db.insert(this.tableName, announcementData);
      return await this.findById(result.insertId);
    } catch (error) {
      throw new ValidationError(`Failed to create announcement: ${error.message}`);
    }
  }

  // Get announcements with filters and pagination
  async getAnnouncements(filters = {}, pagination = {}, options = {}) {
    try {
      const {
        status,
        category_id,
        subcategory_id,
        posted_by,
        grade_level,
        is_pinned,
        is_alert,
        search,
        start_date,
        end_date
      } = filters;

      const {
        page = 1,
        limit = 20,
        sort_by = 'created_at',
        sort_order = 'DESC'
      } = pagination;

      const {
        userType = 'public',
        userId = 0
      } = options;

      let whereConditions = [];
      let params = [];

      // Always exclude soft deleted records unless specifically requested
      whereConditions.push('a.deleted_at IS NULL');

      // Exclude archived announcements by default unless specifically requested
      if (status !== 'archived') {
        whereConditions.push('a.status != ?');
        params.push('archived');
      }

      // Add visibility filtering - only show announcements that are currently visible
      // If visibility_start_at is NULL, show from creation/publish time onward
      // If visibility_end_at is NULL, show indefinitely after start
      whereConditions.push('(a.visibility_start_at IS NULL OR a.visibility_start_at <= NOW())');
      whereConditions.push('(a.visibility_end_at IS NULL OR a.visibility_end_at >= NOW())');

      // Build WHERE conditions
      if (status) {
        whereConditions.push('a.status = ?');
        params.push(status);
      }

      if (category_id) {
        whereConditions.push('a.category_id = ?');
        params.push(category_id);
      }

      if (subcategory_id) {
        whereConditions.push('a.subcategory_id = ?');
        params.push(subcategory_id);
      }

      if (posted_by) {
        whereConditions.push('a.posted_by = ?');
        params.push(posted_by);
      }

      if (grade_level !== undefined) {
        if (grade_level === null) {
          // Show announcements for all grades (grade_level IS NULL)
          whereConditions.push('a.grade_level IS NULL');
        } else {
          // Show announcements for specific grade or all grades
          whereConditions.push('(a.grade_level = ? OR a.grade_level IS NULL)');
          params.push(grade_level);
        }
      }

      if (is_pinned !== undefined) {
        whereConditions.push('a.is_pinned = ?');
        params.push(is_pinned);
      }

      if (is_alert !== undefined) {
        whereConditions.push('a.is_alert = ?');
        params.push(is_alert);
      }

      if (search) {
        whereConditions.push('(a.title LIKE ? OR a.content LIKE ?)');
        params.push(`%${search}%`, `%${search}%`);
      }

      if (start_date) {
        whereConditions.push('a.created_at >= ?');
        params.push(start_date);
      }

      if (end_date) {
        whereConditions.push('a.created_at <= ?');
        params.push(end_date);
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // Calculate offset
      const offset = (page - 1) * limit;

      // Get total count
      const countSql = `
        SELECT COUNT(*) as total
        FROM announcements a
        ${whereClause}
      `;
      const countResult = await this.db.findOne(countSql, params);
      const total = countResult.total;

      // Prepare parameters for the main query
      // We need to separate the WHERE clause params from the user reaction params
      const whereParams = [...params]; // Copy the WHERE clause parameters
      const mainQueryParams = [];

      // Add user parameters for user_reaction query first (if user is authenticated)
      if (userId && userType) {
        mainQueryParams.push(userId, userType);
      }

      // Add WHERE clause parameters
      mainQueryParams.push(...whereParams);

      // Add pagination parameters
      mainQueryParams.push(limit, offset);

      // Get announcements with all required fields
      const sql = `
        SELECT
          a.announcement_id,
          a.title,
          a.content,
          a.image_path,
          a.category_id,
          a.subcategory_id,
          a.posted_by,
          a.grade_level,
          a.status,
          a.is_pinned,
          a.is_alert,
          a.allow_comments,
          a.allow_sharing,
          a.scheduled_publish_at,
          a.visibility_start_at,
          a.visibility_end_at,
          a.published_at,
          a.archived_at,
          a.view_count,
          a.created_at,
          a.updated_at,
          COALESCE(c.name, 'Uncategorized') as category_name,
          COALESCE(c.color_code, '#6b7280') as category_color,
          COALESCE(s.name, '') as subcategory_name,
          COALESCE(s.color_code, '') as subcategory_color,
          COALESCE(
            CASE
              WHEN ap.first_name IS NOT NULL OR ap.last_name IS NOT NULL
              THEN TRIM(CONCAT(COALESCE(ap.first_name, ''), ' ', COALESCE(ap.last_name, '')))
              WHEN aa.email IS NOT NULL
              THEN aa.email
              ELSE 'Unknown Author'
            END,
            'Unknown Author'
          ) as author_name,
          COALESCE(ap.profile_picture, '') as author_picture,
          (SELECT COUNT(*) FROM announcement_reactions ar WHERE ar.announcement_id = a.announcement_id) as reaction_count,
          (SELECT COUNT(*) FROM comments cm WHERE cm.announcement_id = a.announcement_id AND cm.is_deleted = 0) as comment_count,
          ${userId && userType ?
            `(SELECT JSON_OBJECT('reaction_id', ar.reaction_id, 'reaction_name', rt.reaction_name, 'reaction_emoji', rt.reaction_emoji)
              FROM announcement_reactions ar
              JOIN reaction_types rt ON ar.reaction_id = rt.reaction_id
              WHERE ar.announcement_id = a.announcement_id AND ar.user_id = ? AND ar.user_type = ? LIMIT 1)` :
            'NULL'} as user_reaction
        FROM announcements a
        LEFT JOIN categories c ON a.category_id = c.category_id
        LEFT JOIN subcategories s ON a.subcategory_id = s.subcategory_id
        LEFT JOIN admin_profiles ap ON a.posted_by = ap.admin_id
        LEFT JOIN admin_accounts aa ON a.posted_by = aa.admin_id
        ${whereClause}
        ORDER BY a.${sort_by} ${sort_order}
        LIMIT ? OFFSET ?
      `;

      console.log('🔍 Executing announcement query with params:', mainQueryParams.length, 'parameters');
      console.log('🔍 User context:', { userId, userType });
      console.log('🔍 Filters:', Object.keys(filters).filter(k => filters[k] !== undefined));

      const announcements = await this.db.query(sql, mainQueryParams);

      console.log('✅ Query executed successfully, found', announcements.length, 'announcements');

      // Process user_reaction JSON for announcements
      for (let announcement of announcements) {
        if (announcement.user_reaction && typeof announcement.user_reaction === 'string') {
          try {
            announcement.user_reaction = JSON.parse(announcement.user_reaction);
          } catch (e) {
            announcement.user_reaction = null;
          }
        }
      }

      // Get attachments for each announcement
      for (let announcement of announcements) {
        const attachmentsSql = `
          SELECT
            attachment_id,
            file_name,
            file_path,
            file_type,
            file_size,
            mime_type,
            display_order,
            is_primary,
            uploaded_at
          FROM announcement_attachments
          WHERE announcement_id = ? AND deleted_at IS NULL
          ORDER BY display_order ASC, uploaded_at ASC
        `;
        const attachments = await this.db.query(attachmentsSql, [announcement.announcement_id]);
        announcement.attachments = attachments;
        announcement.images = attachments; // For backward compatibility
      }

      // Calculate pagination info
      const totalPages = Math.ceil(total / limit);
      const hasNext = page < totalPages;
      const hasPrev = page > 1;

      const result = {
        announcements,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext,
          hasPrev
        }
      };



      return result;
    } catch (error) {
      throw new ValidationError(`Failed to get announcements: ${error.message}`);
    }
  }

  // Get single announcement with full details
  async getAnnouncementById(id, options = {}) {
    const { userId = null, userType = null } = options;
    try {
      const sql = `
        SELECT
          a.announcement_id,
          a.title,
          a.content,
          a.image_path,
          a.category_id,
          a.subcategory_id,
          a.posted_by,
          a.grade_level,
          a.status,
          a.is_pinned,
          a.is_alert,
          a.allow_comments,
          a.allow_sharing,
          a.scheduled_publish_at,
          a.visibility_start_at,
          a.visibility_end_at,
          a.published_at,
          a.archived_at,
          a.view_count,
          a.created_at,
          a.updated_at,
          COALESCE(c.name, 'Uncategorized') as category_name,
          COALESCE(c.color_code, '#6b7280') as category_color,
          COALESCE(s.name, '') as subcategory_name,
          COALESCE(s.color_code, '') as subcategory_color,
          COALESCE(
            CASE
              WHEN ap.first_name IS NOT NULL OR ap.last_name IS NOT NULL
              THEN TRIM(CONCAT(COALESCE(ap.first_name, ''), ' ', COALESCE(ap.last_name, '')))
              WHEN aa.email IS NOT NULL
              THEN aa.email
              ELSE 'Unknown Author'
            END,
            'Unknown Author'
          ) as author_name,
          COALESCE(ap.profile_picture, '') as author_picture,
          (SELECT COUNT(*) FROM announcement_reactions ar WHERE ar.announcement_id = a.announcement_id) as reaction_count,
          (SELECT COUNT(*) FROM comments cm WHERE cm.announcement_id = a.announcement_id AND cm.is_deleted = 0) as comment_count,
          (SELECT ar.reaction_id FROM announcement_reactions ar
           WHERE ar.announcement_id = a.announcement_id
           AND ar.user_type = ? AND ar.user_id = ? LIMIT 1) as user_reaction
        FROM announcements a
        LEFT JOIN categories c ON a.category_id = c.category_id
        LEFT JOIN subcategories s ON a.subcategory_id = s.subcategory_id
        LEFT JOIN admin_profiles ap ON a.posted_by = ap.admin_id
        LEFT JOIN admin_accounts aa ON a.posted_by = aa.admin_id
        WHERE a.announcement_id = ?
      `;

      // Add user info for reaction check (if provided)
      const userType = options?.userType || 'admin';
      const userId = options?.userId || 0;
      const announcement = await this.db.findOne(sql, [userType, userId, id]);
      if (!announcement) {
        throw new NotFoundError('Announcement not found');
      }

      // Process user_reaction JSON if it exists
      if (announcement.user_reaction && typeof announcement.user_reaction === 'string') {
        try {
          announcement.user_reaction = JSON.parse(announcement.user_reaction);
        } catch (e) {
          announcement.user_reaction = null;
        }
      }

      // Get user's reaction if user is provided (fallback method)
      if (userId && userType && !announcement.user_reaction) {
        const reactionSql = `
          SELECT ar.reaction_id, rt.reaction_name, rt.reaction_emoji
          FROM announcement_reactions ar
          JOIN reaction_types rt ON ar.reaction_id = rt.reaction_id
          WHERE ar.announcement_id = ? AND ar.user_id = ? AND ar.user_type = ?
        `;
        const userReaction = await this.db.findOne(reactionSql, [id, userId, userType]);
        announcement.user_reaction = userReaction;
      }

      // Get reaction summary
      const reactionsSql = `
        SELECT 
          rt.reaction_id,
          rt.reaction_name,
          rt.reaction_emoji,
          COUNT(*) as count
        FROM announcement_reactions ar
        JOIN reaction_types rt ON ar.reaction_id = rt.reaction_id
        WHERE ar.announcement_id = ?
        GROUP BY rt.reaction_id, rt.reaction_name, rt.reaction_emoji
        ORDER BY count DESC
      `;
      const reactions = await this.db.query(reactionsSql, [id]);
      announcement.reactions = reactions;

      // Get attachments for the announcement
      const attachmentsSql = `
        SELECT
          attachment_id,
          file_name,
          file_path,
          file_type,
          file_size,
          mime_type,
          display_order,
          is_primary,
          uploaded_at
        FROM announcement_attachments
        WHERE announcement_id = ? AND deleted_at IS NULL
        ORDER BY display_order ASC, uploaded_at ASC
      `;
      const attachments = await this.db.query(attachmentsSql, [id]);
      announcement.attachments = attachments;
      announcement.images = attachments; // For backward compatibility

      return announcement;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new ValidationError(`Failed to get announcement: ${error.message}`);
    }
  }

  // Helper method to format datetime for MySQL
  formatDateTimeForMySQL(dateValue) {
    if (!dateValue || dateValue === '' || dateValue === null) {
      return null;
    }

    try {
      // Handle different input formats
      let date;

      if (typeof dateValue === 'string') {
        // Handle datetime-local format (YYYY-MM-DDTHH:MM)
        if (dateValue.includes('T') && !dateValue.includes('Z') && !dateValue.includes('+')) {
          // This is likely a datetime-local input, treat as Philippines timezone
          date = new Date(dateValue + ':00+08:00'); // Add seconds and Philippines timezone
        } else {
          // Handle ISO strings or other formats
          date = new Date(dateValue);
        }
      } else if (dateValue instanceof Date) {
        date = dateValue;
      } else {
        return null;
      }

      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.warn('Invalid date value:', dateValue);
        return null;
      }

      // Format as MySQL DATETIME (YYYY-MM-DD HH:MM:SS)
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');

      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    } catch (error) {
      console.warn('Error formatting datetime for MySQL:', dateValue, error.message);
      return null;
    }
  }

  // Update announcement
  async updateAnnouncement(id, data) {
    try {
      const allowedFields = [
        'title', 'content', 'image_path', 'category_id', 'subcategory_id', 'grade_level', 'status', 'is_pinned', 'is_alert',
        'allow_comments', 'allow_sharing', 'scheduled_publish_at', 'visibility_start_at', 'visibility_end_at', 'published_at', 'approved_by', 'approved_at', 'rejection_reason'
      ];

      const updateData = {};
      // Process each field with proper validation
      allowedFields.forEach(field => {
        const value = data[field];

        // Handle different field types appropriately
        if (field === 'subcategory_id') {
          // subcategory_id can be null/undefined (optional field)
          if (value !== undefined) {
            updateData[field] = value === '' || value === null ? null : value;
          }
        } else if (['is_pinned', 'is_alert', 'allow_comments', 'allow_sharing'].includes(field)) {
          // Boolean fields - accept 0/1, true/false, '0'/'1', 'true'/'false'
          if (value !== undefined) {
            updateData[field] = value === true || value === 1 || value === '1' || value === 'true';
          }
        } else if (['scheduled_publish_at', 'visibility_start_at', 'visibility_end_at', 'published_at', 'approved_at'].includes(field)) {
          // DateTime fields - format properly for MySQL
          if (value !== undefined) {
            updateData[field] = this.formatDateTimeForMySQL(value);
          }
        } else {
          // Regular fields - must have actual content
          if (value !== undefined && value !== null && value !== '') {
            updateData[field] = value;
          }
        }
      });

      // Always update the timestamp
      updateData.updated_at = new Date();

      // Handle status changes
      if (data.status === 'published' && !updateData.published_at) {
        updateData.published_at = new Date();
      } else if (data.status === 'archived' && !updateData.archived_at) {
        updateData.archived_at = new Date();
        // Mark as user-archived when manually changed via update
        updateData.archived_by = data.archived_by || 'admin';
      }

      updateData.updated_at = new Date();

      const result = await this.db.update(
        this.tableName,
        updateData,
        `${this.primaryKey} = ?`,
        [id]
      );

      if (result.affectedRows === 0) {
        throw new NotFoundError('Announcement not found');
      }

      return await this.findById(id);
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new ValidationError(`Failed to update announcement: ${error.message}`);
    }
  }

  // Delete announcement (soft delete by setting status to archived)
  async deleteAnnouncement(id, userId = 'admin') {
    try {
      const result = await this.db.update(
        this.tableName,
        {
          status: 'archived',
          archived_at: new Date(),
          archived_by: userId,
          updated_at: new Date()
        },
        `${this.primaryKey} = ?`,
        [id]
      );

      if (result.affectedRows === 0) {
        throw new NotFoundError('Announcement not found');
      }

      return { success: true, message: 'Announcement deleted successfully' };
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new ValidationError(`Failed to delete announcement: ${error.message}`);
    }
  }

  // Mark announcement as viewed
  async markAsViewed(announcementId, userId, userType, ipAddress = null) {
    try {
      // Check if already viewed by this user
      const existingView = await this.db.findOne(
        'SELECT view_id FROM announcement_views WHERE announcement_id = ? AND user_id = ? AND user_type = ?',
        [announcementId, userId, userType]
      );

      if (!existingView) {
        await this.db.insert('announcement_views', {
          announcement_id: announcementId,
          user_type: userType,
          user_id: userId,
          viewed_at: new Date(),
          ip_address: ipAddress
        });

        // Update view count in announcements table
        await this.db.query(
          'UPDATE announcements SET view_count = view_count + 1 WHERE announcement_id = ?',
          [announcementId]
        );
      }

      return { success: true };
    } catch (error) {
      throw new ValidationError(`Failed to mark as viewed: ${error.message}`);
    }
  }

  // Add or update reaction
  async addReaction(announcementId, userId, userType, reactionId) {
    try {
      // Check if user already reacted
      const existingReaction = await this.db.findOne(
        'SELECT reaction_log_id FROM announcement_reactions WHERE announcement_id = ? AND user_id = ? AND user_type = ?',
        [announcementId, userId, userType]
      );

      if (existingReaction) {
        // Update existing reaction
        await this.db.update(
          'announcement_reactions',
          { reaction_id: reactionId, created_at: new Date() },
          'reaction_log_id = ?',
          [existingReaction.reaction_log_id]
        );
      } else {
        // Create new reaction
        await this.db.insert('announcement_reactions', {
          announcement_id: announcementId,
          user_type: userType,
          user_id: userId,
          reaction_id: reactionId,
          created_at: new Date()
        });
      }

      return { success: true };
    } catch (error) {
      throw new ValidationError(`Failed to add reaction: ${error.message}`);
    }
  }

  // Remove reaction
  async removeReaction(announcementId, userId, userType) {
    try {
      const result = await this.db.delete(
        'announcement_reactions',
        'announcement_id = ? AND user_id = ? AND user_type = ?',
        [announcementId, userId, userType]
      );

      return { success: true, removed: result.affectedRows > 0 };
    } catch (error) {
      throw new ValidationError(`Failed to remove reaction: ${error.message}`);
    }
  }

  // Get categories
  async getCategories() {
    try {
      const sql = 'SELECT * FROM categories WHERE is_active = 1 ORDER BY name';
      return await this.db.query(sql);
    } catch (error) {
      throw new ValidationError(`Failed to get categories: ${error.message}`);
    }
  }

  // Get all subcategories
  async getSubcategories() {
    try {
      const sql = `
        SELECT
          s.*,
          c.name as category_name,
          c.color_code as category_color
        FROM subcategories s
        LEFT JOIN categories c ON s.category_id = c.category_id
        WHERE s.is_active = 1 AND c.is_active = 1
        ORDER BY c.name, s.display_order, s.name
      `;
      return await this.db.query(sql);
    } catch (error) {
      throw new ValidationError(`Failed to get subcategories: ${error.message}`);
    }
  }

  // Get subcategories by category ID
  async getSubcategoriesByCategory(categoryId) {
    try {
      const sql = `
        SELECT * FROM subcategories
        WHERE category_id = ? AND is_active = 1
        ORDER BY display_order, name
      `;
      return await this.db.query(sql, [categoryId]);
    } catch (error) {
      throw new ValidationError(`Failed to get subcategories for category: ${error.message}`);
    }
  }

  // Get categories with their subcategories (hierarchical structure)
  async getCategoriesWithSubcategories() {
    try {
      const sql = `
        SELECT
          c.category_id,
          c.name as category_name,
          c.description as category_description,
          c.color_code as category_color,
          c.is_active as category_active,
          s.subcategory_id,
          s.name as subcategory_name,
          s.description as subcategory_description,
          s.color_code as subcategory_color,
          s.is_active as subcategory_active,
          s.display_order
        FROM categories c
        LEFT JOIN subcategories s ON c.category_id = s.category_id AND s.is_active = 1
        WHERE c.is_active = 1
        ORDER BY c.name, s.display_order, s.name
      `;

      const results = await this.db.query(sql);

      // Group subcategories under their parent categories
      const categoriesMap = new Map();

      results.forEach(row => {
        if (!categoriesMap.has(row.category_id)) {
          categoriesMap.set(row.category_id, {
            category_id: row.category_id,
            name: row.category_name,
            description: row.category_description,
            color_code: row.category_color,
            is_active: row.category_active,
            subcategories: []
          });
        }

        if (row.subcategory_id) {
          categoriesMap.get(row.category_id).subcategories.push({
            subcategory_id: row.subcategory_id,
            name: row.subcategory_name,
            description: row.subcategory_description,
            color_code: row.subcategory_color,
            is_active: row.subcategory_active,
            display_order: row.display_order
          });
        }
      });

      return Array.from(categoriesMap.values());
    } catch (error) {
      throw new ValidationError(`Failed to get categories with subcategories: ${error.message}`);
    }
  }

  // Get featured announcements
  async getFeaturedAnnouncements(limit = 5) {
    try {
      const sql = `
        SELECT
          a.*,
          c.name as category_name,
          c.color_code as category_color,
          ap.full_name as author_name
        FROM announcements a
        LEFT JOIN categories c ON a.category_id = c.category_id
        LEFT JOIN admin_profiles ap ON a.posted_by = ap.admin_id
        WHERE a.status = 'published' AND a.is_pinned = 1
        ORDER BY a.created_at DESC
        LIMIT ?
      `;

      return await this.db.query(sql, [limit]);
    } catch (error) {
      throw new ValidationError(`Failed to get featured announcements: ${error.message}`);
    }
  }

  // Publish announcement
  async publishAnnouncement(id) {
    try {
      const result = await this.db.update(
        this.tableName,
        {
          status: 'published',
          published_at: new Date(),
          updated_at: new Date()
        },
        `${this.primaryKey} = ?`,
        [id]
      );

      if (result.affectedRows === 0) {
        throw new NotFoundError('Announcement not found');
      }

      return await this.findById(id);
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new ValidationError(`Failed to publish announcement: ${error.message}`);
    }
  }

  // Unpublish announcement
  async unpublishAnnouncement(id) {
    try {
      const result = await this.db.update(
        this.tableName,
        {
          status: 'draft',
          published_at: null,
          updated_at: new Date()
        },
        `${this.primaryKey} = ? AND deleted_at IS NULL`,
        [id]
      );

      if (result.affectedRows === 0) {
        throw new NotFoundError('Announcement not found');
      }

      return await this.findById(id);
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new ValidationError(`Failed to unpublish announcement: ${error.message}`);
    }
  }

  // Soft delete announcement
  async softDeleteAnnouncement(id) {
    try {
      const result = await this.db.update(
        this.tableName,
        {
          deleted_at: new Date(),
          updated_at: new Date()
        },
        `${this.primaryKey} = ? AND deleted_at IS NULL`,
        [id]
      );

      if (result.affectedRows === 0) {
        throw new NotFoundError('Announcement not found or already deleted');
      }

      return { id, deleted_at: new Date() };
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new ValidationError(`Failed to delete announcement: ${error.message}`);
    }
  }

  // Permanently delete announcement
  async permanentlyDeleteAnnouncement(id) {
    try {
      const result = await this.db.delete(
        this.tableName,
        `${this.primaryKey} = ?`,
        [id]
      );

      if (result.affectedRows === 0) {
        throw new NotFoundError('Announcement not found');
      }

      return { id, permanently_deleted: true };
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new ValidationError(`Failed to permanently delete announcement: ${error.message}`);
    }
  }

  // Restore archived or soft deleted announcement
  async restoreAnnouncement(id) {
    try {
      // First check if the announcement exists and is archived or soft deleted
      const announcement = await this.db.findOne(
        `SELECT ${this.primaryKey}, status, deleted_at, archived_by FROM ${this.tableName} WHERE ${this.primaryKey} = ?`,
        [id]
      );

      if (!announcement) {
        throw new NotFoundError('Announcement not found');
      }

      // Check if it's system-archived (cannot be restored)
      if (announcement.archived_by === 'system') {
        throw new ValidationError('This announcement was automatically archived by the system due to expiration and cannot be restored. System-archived content follows organizational retention policies and cannot be manually restored.');
      }

      // Check if announcement can be restored (either archived or soft deleted)
      const canRestore = announcement.status === 'archived' || announcement.deleted_at !== null;
      if (!canRestore) {
        throw new NotFoundError('Announcement is not archived or deleted');
      }

      // Restore the announcement by setting status to 'published' and clearing deleted_at
      const result = await this.db.update(
        this.tableName,
        {
          status: 'published',
          deleted_at: null,
          updated_at: new Date()
        },
        `${this.primaryKey} = ?`,
        [id]
      );

      if (result.affectedRows === 0) {
        throw new NotFoundError('Failed to restore announcement');
      }

      return await this.findById(id);
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new ValidationError(`Failed to restore announcement: ${error.message}`);
    }
  }

  // Get archived announcements (status = 'archived' and not soft deleted)
  async getArchivedAnnouncements(filters = {}, pagination = {}) {
    try {
      const {
        search,
        category_id,
        subcategory_id,
        posted_by,
        start_date,
        end_date
      } = filters;

      const {
        page = 1,
        limit = 20,
        sort_by = 'archived_at',
        sort_order = 'DESC'
      } = pagination;

      // Include both archived announcements and soft deleted announcements
      let whereConditions = ['(a.status = ? OR a.deleted_at IS NOT NULL)'];
      let queryParams = ['archived'];

      // Add search filter
      if (search) {
        whereConditions.push('(a.title LIKE ? OR a.content LIKE ?)');
        queryParams.push(`%${search}%`, `%${search}%`);
      }

      // Add category filter
      if (category_id) {
        whereConditions.push('a.category_id = ?');
        queryParams.push(category_id);
      }

      // Add subcategory filter
      if (subcategory_id) {
        whereConditions.push('a.subcategory_id = ?');
        queryParams.push(subcategory_id);
      }

      // Add author filter
      if (posted_by) {
        whereConditions.push('a.posted_by = ?');
        queryParams.push(posted_by);
      }

      // Add date range filter
      if (start_date) {
        whereConditions.push('DATE(a.deleted_at) >= ?');
        queryParams.push(start_date);
      }

      if (end_date) {
        whereConditions.push('DATE(a.deleted_at) <= ?');
        queryParams.push(end_date);
      }

      const whereClause = whereConditions.join(' AND ');

      // Get total count
      const countSql = `
        SELECT COUNT(*) as total
        FROM announcements a
        WHERE ${whereClause}
      `;
      const countResult = await this.db.findOne(countSql, queryParams);
      const total = countResult.total;

      // Calculate pagination
      const offset = (page - 1) * limit;
      const totalPages = Math.ceil(total / limit);

      // Get archived announcements with full details
      const sql = `
        SELECT
          a.announcement_id,
          a.title,
          a.content,
          a.image_path,
          a.category_id,
          a.subcategory_id,
          a.posted_by,
          a.grade_level,
          a.status,
          a.is_pinned,
          a.is_alert,
          a.allow_comments,
          a.allow_sharing,
          a.scheduled_publish_at,
          a.published_at,
          a.archived_at,
          a.archived_by,
          a.deleted_at,
          a.view_count,
          a.created_at,
          a.updated_at,
          COALESCE(c.name, 'Uncategorized') as category_name,
          COALESCE(c.color_code, '#6b7280') as category_color,
          COALESCE(s.name, '') as subcategory_name,
          COALESCE(s.color_code, '') as subcategory_color,
          COALESCE(
            CASE
              WHEN ap.first_name IS NOT NULL OR ap.last_name IS NOT NULL
              THEN TRIM(CONCAT(COALESCE(ap.first_name, ''), ' ', COALESCE(ap.last_name, '')))
              WHEN aa.email IS NOT NULL
              THEN aa.email
              ELSE 'Unknown Author'
            END,
            'Unknown Author'
          ) as author_name
        FROM announcements a
        LEFT JOIN categories c ON a.category_id = c.category_id
        LEFT JOIN subcategories s ON a.subcategory_id = s.subcategory_id
        LEFT JOIN admin_accounts aa ON a.posted_by = aa.admin_id
        LEFT JOIN admin_profiles ap ON aa.admin_id = ap.admin_id
        WHERE ${whereClause}
        ORDER BY a.${sort_by} ${sort_order}
        LIMIT ? OFFSET ?
      `;

      queryParams.push(limit, offset);
      const announcements = await this.db.query(sql, queryParams);

      return {
        data: announcements,
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
      throw new ValidationError(`Failed to get archived announcements: ${error.message}`);
    }
  }

  // Override findById to support including soft deleted records and attachments
  async findById(id, includeSoftDeleted = false, includeAttachments = true) {
    try {
      const whereClause = includeSoftDeleted
        ? `${this.primaryKey} = ?`
        : `${this.primaryKey} = ? AND deleted_at IS NULL`;

      const sql = `SELECT * FROM ${this.tableName} WHERE ${whereClause}`;
      const result = await this.db.findOne(sql, [id]);

      if (!result) {
        return null;
      }

      // Include attachments if requested
      if (includeAttachments) {
        const attachmentsSql = `
          SELECT
            attachment_id,
            file_name,
            file_path,
            file_type,
            file_size,
            mime_type,
            display_order,
            is_primary,
            uploaded_at
          FROM announcement_attachments
          WHERE announcement_id = ? AND deleted_at IS NULL
          ORDER BY display_order ASC, uploaded_at ASC
        `;

        const attachments = await this.db.query(attachmentsSql, [id]);
        result.attachments = attachments || [];

        // Separate images for easier access
        result.images = attachments ? attachments.filter(att => att.file_type === 'image') : [];
      }

      return result;
    } catch (error) {
      throw new ValidationError(`Failed to find announcement: ${error.message}`);
    }
  }

  // Get archive statistics
  async getArchiveStats() {
    try {
      const sql = `
        SELECT
          COUNT(CASE WHEN status = 'archived' AND deleted_at IS NULL THEN 1 END) as archived,
          COUNT(CASE WHEN deleted_at IS NOT NULL THEN 1 END) as soft_deleted,
          COUNT(CASE WHEN visibility_end_at IS NOT NULL AND visibility_end_at <= NOW() AND status != 'archived' AND deleted_at IS NULL THEN 1 END) as expired_not_archived
        FROM announcements;
      `;

      const [stats] = await this.db.query(sql);
      return stats[0];
    } catch (error) {
      throw new ValidationError(`Failed to get archive statistics: ${error.message}`);
    }
  }
}

module.exports = new AnnouncementModel();
