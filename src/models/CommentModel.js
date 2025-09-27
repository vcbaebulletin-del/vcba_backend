const BaseModel = require('./BaseModel');
const { ValidationError, NotFoundError, ConflictError } = require('../middleware/errorHandler');

// Comment depth configuration - following industry best practices
const COMMENT_DEPTH_CONFIG = {
  MAX_DEPTH: 2,           // Maximum allowed depth (0-based: 0=root, 1=reply, 2=reply to reply)
  MAX_VISUAL_DEPTH: 3,    // Maximum visual indentation depth
  FLATTEN_THRESHOLD: 3    // Depth at which to start flattening
};

class CommentModel extends BaseModel {
  constructor() {
    super('comments', 'comment_id');
  }

  /**
   * Calculate the depth of a comment in the thread hierarchy
   * @param {number} commentId - The comment ID to calculate depth for
   * @returns {Promise<number>} The depth level (0-based)
   */
  async calculateCommentDepth(commentId) {
    try {
      let depth = 0;
      let currentCommentId = commentId;
      const visitedIds = new Set(); // Prevent infinite loops

      while (currentCommentId && !visitedIds.has(currentCommentId)) {
        visitedIds.add(currentCommentId);

        const comment = await this.db.findOne(
          'SELECT parent_comment_id FROM comments WHERE comment_id = ?',
          [currentCommentId]
        );

        if (!comment || !comment.parent_comment_id) {
          break;
        }

        depth++;
        currentCommentId = comment.parent_comment_id;

        // Safety check to prevent infinite loops
        if (depth > 10) {
          console.warn('Comment depth calculation exceeded safety limit');
          break;
        }
      }

      return depth;
    } catch (error) {
      console.error('Error calculating comment depth:', error);
      return 0; // Default to root level on error
    }
  }

  /**
   * Validate comment depth before creation
   * @param {number|null} parentCommentId - The parent comment ID
   * @returns {Promise<{isValid: boolean, message?: string, suggestedParentId?: number}>}
   */
  async validateCommentDepth(parentCommentId) {
    if (!parentCommentId) {
      // Top-level comment is always valid
      return { isValid: true };
    }

    try {
      // Check if parent comment exists
      const parentComment = await this.db.findOne(
        'SELECT comment_id, parent_comment_id FROM comments WHERE comment_id = ? AND is_deleted = 0',
        [parentCommentId]
      );

      if (!parentComment) {
        return {
          isValid: false,
          message: "Parent comment not found or has been deleted"
        };
      }

      // Calculate the depth of the parent comment
      const parentDepth = await this.calculateCommentDepth(parentCommentId);
      const newCommentDepth = parentDepth + 1;

      if (newCommentDepth > COMMENT_DEPTH_CONFIG.MAX_DEPTH) {
        // Find the root comment of this thread for suggestion
        const suggestedParentId = await this.findThreadRoot(parentCommentId);

        return {
          isValid: false,
          message: `Comment depth limit (${COMMENT_DEPTH_CONFIG.MAX_DEPTH + 1} levels) exceeded. Reply will be added to thread root.`,
          suggestedParentId
        };
      }

      return { isValid: true };
    } catch (error) {
      console.error('Error validating comment depth:', error);
      return {
        isValid: false,
        message: "Error validating comment depth"
      };
    }
  }

  /**
   * Find the root comment of a thread
   * @param {number} commentId - Any comment ID in the thread
   * @returns {Promise<number>} The root comment ID
   */
  async findThreadRoot(commentId) {
    try {
      let currentCommentId = commentId;
      const visitedIds = new Set();

      while (currentCommentId && !visitedIds.has(currentCommentId)) {
        visitedIds.add(currentCommentId);

        const comment = await this.db.findOne(
          'SELECT comment_id, parent_comment_id FROM comments WHERE comment_id = ?',
          [currentCommentId]
        );

        if (!comment || !comment.parent_comment_id) {
          return currentCommentId;
        }

        currentCommentId = comment.parent_comment_id;
      }

      return currentCommentId;
    } catch (error) {
      console.error('Error finding thread root:', error);
      return commentId; // Return original ID on error
    }
  }

  // Create comment with depth validation
  async createComment(data) {
    try {
      // Validate required fields - either announcement_id or calendar_id is required
      if (!data.announcement_id && !data.calendar_id) {
        throw new ValidationError('Either announcement_id or calendar_id is required');
      }
      if (data.announcement_id && data.calendar_id) {
        throw new ValidationError('Cannot specify both announcement_id and calendar_id');
      }
      this.validateRequired(data, ['user_type', 'user_id', 'comment_text']);

      let parentCommentId = data.parent_comment_id || null;
      let depthWarning = null;

      // Validate comment depth if this is a reply
      if (parentCommentId) {
        const depthValidation = await this.validateCommentDepth(parentCommentId);

        if (!depthValidation.isValid) {
          if (depthValidation.suggestedParentId) {
            // Automatically adjust to suggested parent (thread root)
            parentCommentId = depthValidation.suggestedParentId;
            depthWarning = depthValidation.message;
            console.log(`Comment depth limit reached. Redirecting to thread root: ${parentCommentId}`);
          } else {
            // If no suggestion, make it a top-level comment
            parentCommentId = null;
            depthWarning = "Comment depth limit reached. Creating as new top-level comment.";
            console.log('Comment depth limit reached. Creating as top-level comment.');
          }
        }
      }

      // Prepare comment data
      const commentData = {
        announcement_id: data.announcement_id || null,
        calendar_id: data.calendar_id || null,
        parent_comment_id: parentCommentId,
        user_type: data.user_type,
        user_id: data.user_id,
        comment_text: data.comment_text,
        is_anonymous: data.is_anonymous === true || data.is_anonymous === 'true' || data.is_anonymous === 1 || data.is_anonymous === '1' ? 1 : 0,
        created_at: new Date(),
        updated_at: new Date()
      };

      const result = await this.db.insert(this.tableName, commentData);
      const newComment = await this.getCommentById(result.insertId);

      // Add depth warning to response if applicable
      if (depthWarning) {
        newComment.depth_warning = depthWarning;
      }

      return newComment;
    } catch (error) {
      throw new ValidationError(`Failed to create comment: ${error.message}`);
    }
  }

  /**
   * Get replies for a comment with depth limiting
   * @param {number} parentCommentId - The parent comment ID
   * @param {number|null} userId - Current user ID
   * @param {string|null} userType - Current user type
   * @param {number} currentDepth - Current depth level
   * @returns {Promise<Array>} Array of reply comments
   */
  async getCommentRepliesWithDepth(parentCommentId, userId = null, userType = null, currentDepth = 1) {
    try {
      // Stop recursion if we've reached the maximum depth
      if (currentDepth > COMMENT_DEPTH_CONFIG.MAX_DEPTH) {
        return [];
      }

      const repliesSql = `
        SELECT
          c.*,
          CASE
            WHEN c.is_anonymous = 1 AND c.user_type = 'admin' THEN 'Anonymous Admin'
            WHEN c.is_anonymous = 1 AND c.user_type = 'student' THEN 'Anonymous Student'
            WHEN c.user_type = 'admin' THEN CONCAT_WS(' ', ap.first_name, ap.middle_name, ap.last_name, ap.suffix)
            WHEN c.user_type = 'student' THEN CONCAT_WS(' ', sp.first_name, sp.middle_name, sp.last_name, sp.suffix)
            ELSE 'Anonymous'
          END as author_name,
          CASE
            WHEN c.is_anonymous = 1 THEN NULL
            WHEN c.user_type = 'admin' THEN ap.profile_picture
            WHEN c.user_type = 'student' THEN sp.profile_picture
            ELSE NULL
          END as author_picture,
          (SELECT COUNT(*) FROM comment_reactions cr WHERE cr.comment_id = c.comment_id) as reaction_count,
          ${userId && userType ?
            `(SELECT JSON_OBJECT('reaction_id', cr.reaction_id, 'reaction_name', rt.reaction_name, 'reaction_emoji', rt.reaction_emoji)
              FROM comment_reactions cr
              JOIN reaction_types rt ON cr.reaction_id = rt.reaction_id
              WHERE cr.comment_id = c.comment_id AND cr.user_id = ${userId} AND cr.user_type = '${userType}' LIMIT 1)` :
            'NULL'} as user_reaction
        FROM comments c
        LEFT JOIN admin_profiles ap ON c.user_type = 'admin' AND c.user_id = ap.admin_id
        LEFT JOIN student_profiles sp ON c.user_type = 'student' AND c.user_id = sp.student_id
        WHERE c.parent_comment_id = ? AND c.is_deleted = 0
        ORDER BY c.created_at ASC
      `;

      const replies = await this.db.query(repliesSql, [parentCommentId]);

      // Process user_reaction JSON and get nested replies
      for (let reply of replies) {
        if (reply.user_reaction && typeof reply.user_reaction === 'string') {
          try {
            reply.user_reaction = JSON.parse(reply.user_reaction);
          } catch (e) {
            reply.user_reaction = null;
          }
        }

        // Add depth information
        reply.depth = currentDepth;
        reply.can_reply = currentDepth < COMMENT_DEPTH_CONFIG.MAX_DEPTH;

        // Recursively get replies if within depth limit
        if (currentDepth < COMMENT_DEPTH_CONFIG.MAX_DEPTH) {
          reply.replies = await this.getCommentRepliesWithDepth(
            reply.comment_id,
            userId,
            userType,
            currentDepth + 1
          );
        } else {
          reply.replies = [];
        }
      }

      return replies;
    } catch (error) {
      console.error('Error getting comment replies with depth:', error);
      return [];
    }
  }

  // Get comments for an announcement with threading
  async getCommentsByAnnouncement(announcementId, pagination = {}, options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        sort_by = 'created_at',
        sort_order = 'ASC'
      } = pagination;

      const {
        userId = null,
        userType = null
      } = options;

      const offset = (page - 1) * limit;

      // Get total count
      const countSql = `
        SELECT COUNT(*) as total
        FROM comments
        WHERE announcement_id = ? AND is_deleted = 0 AND parent_comment_id IS NULL
      `;
      const countResult = await this.db.findOne(countSql, [announcementId]);
      const total = countResult.total;

      // Get parent comments
      const sql = `
        SELECT
          c.*,
          CASE
            WHEN c.is_anonymous = 1 AND c.user_type = 'admin' THEN 'Anonymous Admin'
            WHEN c.is_anonymous = 1 AND c.user_type = 'student' THEN 'Anonymous Student'
            WHEN c.user_type = 'admin' THEN CONCAT_WS(' ', ap.first_name, ap.middle_name, ap.last_name, ap.suffix)
            WHEN c.user_type = 'student' THEN CONCAT_WS(' ', sp.first_name, sp.middle_name, sp.last_name, sp.suffix)
            ELSE 'Anonymous'
          END as author_name,
          CASE
            WHEN c.is_anonymous = 1 THEN NULL
            WHEN c.user_type = 'admin' THEN ap.profile_picture
            WHEN c.user_type = 'student' THEN sp.profile_picture
            ELSE NULL
          END as author_picture,
          (SELECT COUNT(*) FROM comment_reactions cr WHERE cr.comment_id = c.comment_id) as reaction_count,
          ${userId && userType ?
            `(SELECT JSON_OBJECT('reaction_id', cr.reaction_id, 'reaction_name', rt.reaction_name, 'reaction_emoji', rt.reaction_emoji)
              FROM comment_reactions cr
              JOIN reaction_types rt ON cr.reaction_id = rt.reaction_id
              WHERE cr.comment_id = c.comment_id AND cr.user_id = ${userId} AND cr.user_type = '${userType}' LIMIT 1)` :
            'NULL'} as user_reaction
        FROM comments c
        LEFT JOIN admin_profiles ap ON c.user_type = 'admin' AND c.user_id = ap.admin_id
        LEFT JOIN student_profiles sp ON c.user_type = 'student' AND c.user_id = sp.student_id
        WHERE c.announcement_id = ? AND c.is_deleted = 0 AND c.parent_comment_id IS NULL
        ORDER BY c.${sort_by} ${sort_order}
        LIMIT ? OFFSET ?
      `;

      const parentComments = await this.db.query(sql, [announcementId, limit, offset]);

      // Process user_reaction JSON for parent comments
      for (let comment of parentComments) {
        if (comment.user_reaction && typeof comment.user_reaction === 'string') {
          try {
            comment.user_reaction = JSON.parse(comment.user_reaction);
          } catch (e) {
            comment.user_reaction = null;
          }
        }
      }

      // Get replies for each parent comment with depth limiting
      for (let comment of parentComments) {
        // Add depth information to parent comments
        comment.depth = 0;
        comment.can_reply = true;

        // Get replies using depth-aware method
        comment.replies = await this.getCommentRepliesWithDepth(comment.comment_id, userId, userType, 1);

        // Process user_reaction JSON for replies
        for (let reply of comment.replies) {
          if (reply.user_reaction && typeof reply.user_reaction === 'string') {
            try {
              reply.user_reaction = JSON.parse(reply.user_reaction);
            } catch (e) {
              reply.user_reaction = null;
            }
          }
        }

        // Get reactions for parent comment
        comment.reactions = await this.getCommentReactions(comment.comment_id);

        // Get reactions for replies
        for (let reply of comment.replies) {
          reply.reactions = await this.getCommentReactions(reply.comment_id);
        }
      }

      // Calculate pagination info
      const totalPages = Math.ceil(total / limit);
      const hasNext = page < totalPages;
      const hasPrev = page > 1;

      return {
        comments: parentComments,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext,
          hasPrev
        }
      };
    } catch (error) {
      throw new ValidationError(`Failed to get comments: ${error.message}`);
    }
  }

  // Get comments for a calendar event with threading
  async getCommentsByCalendar(calendarId, pagination = {}, options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        sort_by = 'created_at',
        sort_order = 'ASC'
      } = pagination;

      const {
        userId = null,
        userType = null
      } = options;

      const offset = (page - 1) * limit;

      // Get total count
      const countSql = `
        SELECT COUNT(*) as total
        FROM comments
        WHERE calendar_id = ? AND is_deleted = 0 AND parent_comment_id IS NULL
      `;
      const countResult = await this.db.findOne(countSql, [calendarId]);
      const total = countResult.total;

      // Get parent comments
      const sql = `
        SELECT
          c.*,
          CASE
            WHEN c.is_anonymous = 1 AND c.user_type = 'admin' THEN 'Anonymous Admin'
            WHEN c.is_anonymous = 1 AND c.user_type = 'student' THEN 'Anonymous Student'
            WHEN c.user_type = 'admin' THEN CONCAT_WS(' ', ap.first_name, ap.middle_name, ap.last_name, ap.suffix)
            WHEN c.user_type = 'student' THEN CONCAT_WS(' ', sp.first_name, sp.middle_name, sp.last_name, sp.suffix)
            ELSE 'Anonymous'
          END as author_name,
          CASE
            WHEN c.is_anonymous = 1 THEN NULL
            WHEN c.user_type = 'admin' THEN ap.profile_picture
            WHEN c.user_type = 'student' THEN sp.profile_picture
            ELSE NULL
          END as author_picture,
          (SELECT COUNT(*) FROM comment_reactions cr WHERE cr.comment_id = c.comment_id) as reaction_count,
          ${userId && userType ?
            `(SELECT JSON_OBJECT('reaction_id', cr.reaction_id, 'reaction_name', rt.reaction_name, 'reaction_emoji', rt.reaction_emoji)
              FROM comment_reactions cr
              JOIN reaction_types rt ON cr.reaction_id = rt.reaction_id
              WHERE cr.comment_id = c.comment_id AND cr.user_id = ${userId} AND cr.user_type = '${userType}' LIMIT 1)` :
            'NULL'} as user_reaction
        FROM comments c
        LEFT JOIN admin_profiles ap ON c.user_type = 'admin' AND c.user_id = ap.admin_id
        LEFT JOIN student_profiles sp ON c.user_type = 'student' AND c.user_id = sp.student_id
        WHERE c.calendar_id = ? AND c.is_deleted = 0 AND c.parent_comment_id IS NULL
        ORDER BY c.${sort_by} ${sort_order}
        LIMIT ? OFFSET ?
      `;

      const parentComments = await this.db.query(sql, [calendarId, limit, offset]);

      // Process user_reaction JSON for parent comments
      for (let comment of parentComments) {
        if (comment.user_reaction && typeof comment.user_reaction === 'string') {
          try {
            comment.user_reaction = JSON.parse(comment.user_reaction);
          } catch (e) {
            comment.user_reaction = null;
          }
        }
      }

      // Get replies for each parent comment with depth limiting
      for (let comment of parentComments) {
        // Add depth information to parent comments
        comment.depth = 0;
        comment.can_reply = true;

        // Get replies using depth-aware method
        comment.replies = await this.getCommentRepliesWithDepth(comment.comment_id, userId, userType, 1);

        // Process user_reaction JSON for replies
        for (let reply of comment.replies) {
          if (reply.user_reaction && typeof reply.user_reaction === 'string') {
            try {
              reply.user_reaction = JSON.parse(reply.user_reaction);
            } catch (e) {
              reply.user_reaction = null;
            }
          }
        }

        // Get reactions for parent comment
        comment.reactions = await this.getCommentReactions(comment.comment_id);

        // Get reactions for replies
        for (let reply of comment.replies) {
          reply.reactions = await this.getCommentReactions(reply.comment_id);
        }
      }

      // Calculate pagination info
      const totalPages = Math.ceil(total / limit);
      const hasNext = page < totalPages;
      const hasPrev = page > 1;

      return {
        comments: parentComments,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext,
          hasPrev
        }
      };
    } catch (error) {
      throw new ValidationError(`Failed to get calendar comments: ${error.message}`);
    }
  }

  // Get single comment with details
  async getCommentById(id, userId = null, userType = null) {
    try {
      const sql = `
        SELECT
          c.*,
          CASE
            WHEN c.user_type = 'admin' THEN CONCAT_WS(' ', ap.first_name, ap.middle_name, ap.last_name, ap.suffix)
            WHEN c.user_type = 'student' THEN CONCAT_WS(' ', sp.first_name, sp.middle_name, sp.last_name, sp.suffix)
            ELSE 'Anonymous'
          END as author_name,
          CASE
            WHEN c.user_type = 'admin' THEN ap.profile_picture
            WHEN c.user_type = 'student' THEN sp.profile_picture
            ELSE NULL
          END as author_picture,
          (SELECT COUNT(*) FROM comment_reactions cr WHERE cr.comment_id = c.comment_id) as reaction_count
        FROM comments c
        LEFT JOIN admin_profiles ap ON c.user_type = 'admin' AND c.user_id = ap.admin_id
        LEFT JOIN student_profiles sp ON c.user_type = 'student' AND c.user_id = sp.student_id
        WHERE c.comment_id = ? AND c.is_deleted = 0
      `;

      const comment = await this.db.findOne(sql, [id]);
      if (!comment) {
        throw new NotFoundError('Comment not found');
      }

      // Get user's reaction if user is provided
      if (userId && userType) {
        const reactionSql = `
          SELECT cr.reaction_id, rt.reaction_name, rt.reaction_emoji
          FROM comment_reactions cr
          JOIN reaction_types rt ON cr.reaction_id = rt.reaction_id
          WHERE cr.comment_id = ? AND cr.user_id = ? AND cr.user_type = ?
        `;
        const userReaction = await this.db.findOne(reactionSql, [id, userId, userType]);
        comment.user_reaction = userReaction;
      }

      // Get reaction summary
      comment.reactions = await this.getCommentReactions(id);

      return comment;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new ValidationError(`Failed to get comment: ${error.message}`);
    }
  }

  // Update comment
  async updateComment(id, data, userId, userType) {
    try {
      // Check if user owns the comment
      const comment = await this.db.findOne(
        'SELECT user_id, user_type FROM comments WHERE comment_id = ? AND is_deleted = 0',
        [id]
      );

      if (!comment) {
        throw new NotFoundError('Comment not found');
      }

      if (comment.user_id !== userId || comment.user_type !== userType) {
        throw new ValidationError('You can only edit your own comments');
      }

      const allowedFields = ['comment_text'];
      const updateData = {};
      
      allowedFields.forEach(field => {
        if (data[field] !== undefined) {
          updateData[field] = data[field];
        }
      });

      if (Object.keys(updateData).length === 0) {
        throw new ValidationError('No valid fields to update');
      }

      updateData.updated_at = new Date();

      const result = await this.db.update(
        this.tableName,
        updateData,
        `${this.primaryKey} = ?`,
        [id]
      );

      if (result.affectedRows === 0) {
        throw new NotFoundError('Comment not found');
      }

      return await this.getCommentById(id);
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) throw error;
      throw new ValidationError(`Failed to update comment: ${error.message}`);
    }
  }

  // Delete comment (soft delete)
  async deleteComment(id, userId, userType) {
    try {
      // Check if user owns the comment or is admin
      const comment = await this.db.findOne(
        'SELECT user_id, user_type FROM comments WHERE comment_id = ? AND is_deleted = 0',
        [id]
      );

      if (!comment) {
        throw new NotFoundError('Comment not found');
      }

      if (comment.user_id !== userId || comment.user_type !== userType) {
        if (userType !== 'admin') {
          throw new ValidationError('You can only delete your own comments');
        }
      }

      const result = await this.db.update(
        this.tableName,
        {
          is_deleted: 1,
          deleted_at: new Date(),
          updated_at: new Date()
        },
        `${this.primaryKey} = ?`,
        [id]
      );

      if (result.affectedRows === 0) {
        throw new NotFoundError('Comment not found');
      }

      return { success: true, message: 'Comment deleted successfully' };
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) throw error;
      throw new ValidationError(`Failed to delete comment: ${error.message}`);
    }
  }

  // Get comment reactions
  async getCommentReactions(commentId) {
    try {
      const sql = `
        SELECT
          rt.reaction_id,
          rt.reaction_name,
          rt.reaction_emoji,
          COUNT(*) as count
        FROM comment_reactions cr
        JOIN reaction_types rt ON cr.reaction_id = rt.reaction_id
        WHERE cr.comment_id = ?
        GROUP BY rt.reaction_id, rt.reaction_name, rt.reaction_emoji
        ORDER BY count DESC
      `;

      return await this.db.query(sql, [commentId]);
    } catch (error) {
      throw new ValidationError(`Failed to get comment reactions: ${error.message}`);
    }
  }

  // Add or update comment reaction
  async addReaction(commentId, userId, userType, reactionId) {
    try {
      // Check if user already reacted
      const existingReaction = await this.db.findOne(
        'SELECT reaction_log_id FROM comment_reactions WHERE comment_id = ? AND user_id = ? AND user_type = ?',
        [commentId, userId, userType]
      );

      if (existingReaction) {
        // Update existing reaction
        await this.db.update(
          'comment_reactions',
          { reaction_id: reactionId, created_at: new Date() },
          'reaction_log_id = ?',
          [existingReaction.reaction_log_id]
        );
      } else {
        // Create new reaction
        await this.db.insert('comment_reactions', {
          comment_id: commentId,
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

  // Remove comment reaction
  async removeReaction(commentId, userId, userType) {
    try {
      const result = await this.db.delete(
        'comment_reactions',
        'comment_id = ? AND user_id = ? AND user_type = ?',
        [commentId, userId, userType]
      );

      return { success: true, removed: result.affectedRows > 0 };
    } catch (error) {
      throw new ValidationError(`Failed to remove reaction: ${error.message}`);
    }
  }

  // Flag comment
  async flagComment(commentId, flaggedBy, reason = null) {
    try {
      const result = await this.db.update(
        this.tableName,
        {
          is_flagged: 1,
          flagged_by: flaggedBy,
          flagged_reason: reason,
          flagged_at: new Date(),
          updated_at: new Date()
        },
        `${this.primaryKey} = ?`,
        [commentId]
      );

      if (result.affectedRows === 0) {
        throw new NotFoundError('Comment not found');
      }

      return { success: true, message: 'Comment flagged successfully' };
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new ValidationError(`Failed to flag comment: ${error.message}`);
    }
  }

  // Get flagged comments (admin only)
  async getFlaggedComments(pagination = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        sort_by = 'flagged_at',
        sort_order = 'DESC'
      } = pagination;

      const offset = (page - 1) * limit;

      // Get total count
      const countSql = `
        SELECT COUNT(*) as total
        FROM comments
        WHERE is_flagged = 1 AND is_deleted = 0
      `;
      const countResult = await this.db.findOne(countSql);
      const total = countResult.total;

      // Get flagged comments
      const sql = `
        SELECT
          c.*,
          CASE
            WHEN c.user_type = 'admin' THEN ap.full_name
            WHEN c.user_type = 'student' THEN sp.full_name
            ELSE 'Anonymous'
          END as author_name,
          afp.full_name as flagged_by_name,
          a.title as announcement_title
        FROM comments c
        LEFT JOIN admin_profiles ap ON c.user_type = 'admin' AND c.user_id = ap.admin_id
        LEFT JOIN student_profiles sp ON c.user_type = 'student' AND c.user_id = sp.student_id
        LEFT JOIN admin_profiles afp ON c.flagged_by = afp.admin_id
        LEFT JOIN announcements a ON c.announcement_id = a.announcement_id
        WHERE c.is_flagged = 1 AND c.is_deleted = 0
        ORDER BY c.${sort_by} ${sort_order}
        LIMIT ? OFFSET ?
      `;

      const comments = await this.db.query(sql, [limit, offset]);

      // Calculate pagination info
      const totalPages = Math.ceil(total / limit);
      const hasNext = page < totalPages;
      const hasPrev = page > 1;

      return {
        comments,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext,
          hasPrev
        }
      };
    } catch (error) {
      throw new ValidationError(`Failed to get flagged comments: ${error.message}`);
    }
  }

  // Approve flagged comment (admin only)
  async approveComment(commentId) {
    try {
      const result = await this.db.update(
        this.tableName,
        {
          is_flagged: 0,
          flagged_by: null,
          flagged_reason: null,
          flagged_at: null,
          updated_at: new Date()
        },
        `${this.primaryKey} = ?`,
        [commentId]
      );

      if (result.affectedRows === 0) {
        throw new NotFoundError('Comment not found');
      }

      return { success: true, message: 'Comment approved successfully' };
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new ValidationError(`Failed to approve comment: ${error.message}`);
    }
  }

  // Reject flagged comment (admin only) - soft delete
  async rejectComment(commentId) {
    try {
      const result = await this.db.update(
        this.tableName,
        {
          is_deleted: 1,
          deleted_at: new Date(),
          updated_at: new Date()
        },
        `${this.primaryKey} = ?`,
        [commentId]
      );

      if (result.affectedRows === 0) {
        throw new NotFoundError('Comment not found');
      }

      return { success: true, message: 'Comment rejected and deleted successfully' };
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new ValidationError(`Failed to reject comment: ${error.message}`);
    }
  }
}

module.exports = new CommentModel();
