const BaseModel = require('./BaseModel');
const { ValidationError, NotFoundError } = require('../middleware/errorHandler');

class ReactionModel extends BaseModel {
  constructor() {
    super('reaction_types', 'reaction_id');
  }

  // Get all reaction types
  async getReactionTypes() {
    try {
      const sql = 'SELECT * FROM reaction_types WHERE is_active = 1 ORDER BY reaction_id';
      return await this.db.query(sql);
    } catch (error) {
      throw new ValidationError(`Failed to get reaction types: ${error.message}`);
    }
  }

  // Get reaction by ID
  async getReactionById(id) {
    try {
      const reaction = await this.findById(id);
      if (!reaction) {
        throw new NotFoundError('Reaction type not found');
      }
      return reaction;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new ValidationError(`Failed to get reaction type: ${error.message}`);
    }
  }

  // Create new reaction type (admin only)
  async createReactionType(data) {
    try {
      this.validateRequired(data, ['reaction_name', 'reaction_emoji']);

      const reactionData = {
        reaction_name: data.reaction_name,
        reaction_emoji: data.reaction_emoji,
        is_active: data.is_active !== undefined ? data.is_active : 1
      };

      const result = await this.db.insert(this.tableName, reactionData);
      return await this.findById(result.insertId);
    } catch (error) {
      throw new ValidationError(`Failed to create reaction type: ${error.message}`);
    }
  }

  // Update reaction type (admin only)
  async updateReactionType(id, data) {
    try {
      const allowedFields = ['reaction_name', 'reaction_emoji', 'is_active'];
      
      const updateData = {};
      allowedFields.forEach(field => {
        if (data[field] !== undefined) {
          updateData[field] = data[field];
        }
      });

      if (Object.keys(updateData).length === 0) {
        throw new ValidationError('No valid fields to update');
      }

      const result = await this.db.update(
        this.tableName,
        updateData,
        `${this.primaryKey} = ?`,
        [id]
      );

      if (result.affectedRows === 0) {
        throw new NotFoundError('Reaction type not found');
      }

      return await this.findById(id);
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new ValidationError(`Failed to update reaction type: ${error.message}`);
    }
  }

  // Delete reaction type (admin only)
  async deleteReactionType(id) {
    try {
      // Soft delete by setting is_active to 0
      const result = await this.db.update(
        this.tableName,
        { is_active: 0 },
        `${this.primaryKey} = ?`,
        [id]
      );

      if (result.affectedRows === 0) {
        throw new NotFoundError('Reaction type not found');
      }

      return { success: true, message: 'Reaction type deleted successfully' };
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new ValidationError(`Failed to delete reaction type: ${error.message}`);
    }
  }

  // Get reaction statistics for announcements
  async getAnnouncementReactionStats(announcementId = null) {
    try {
      let sql, params = [];

      if (announcementId) {
        sql = `
          SELECT 
            rt.reaction_id,
            rt.reaction_name,
            rt.reaction_emoji,
            COUNT(ar.reaction_log_id) as count,
            a.title as announcement_title
          FROM reaction_types rt
          LEFT JOIN announcement_reactions ar ON rt.reaction_id = ar.reaction_id AND ar.announcement_id = ?
          LEFT JOIN announcements a ON ar.announcement_id = a.announcement_id
          WHERE rt.is_active = 1
          GROUP BY rt.reaction_id, rt.reaction_name, rt.reaction_emoji, a.title
          ORDER BY count DESC, rt.reaction_id
        `;
        params = [announcementId];
      } else {
        sql = `
          SELECT 
            rt.reaction_id,
            rt.reaction_name,
            rt.reaction_emoji,
            COUNT(ar.reaction_log_id) as total_count
          FROM reaction_types rt
          LEFT JOIN announcement_reactions ar ON rt.reaction_id = ar.reaction_id
          WHERE rt.is_active = 1
          GROUP BY rt.reaction_id, rt.reaction_name, rt.reaction_emoji
          ORDER BY total_count DESC, rt.reaction_id
        `;
      }

      return await this.db.query(sql, params);
    } catch (error) {
      throw new ValidationError(`Failed to get announcement reaction stats: ${error.message}`);
    }
  }

  // Get reaction statistics for comments
  async getCommentReactionStats(commentId = null) {
    try {
      let sql, params = [];

      if (commentId) {
        sql = `
          SELECT 
            rt.reaction_id,
            rt.reaction_name,
            rt.reaction_emoji,
            COUNT(cr.reaction_log_id) as count
          FROM reaction_types rt
          LEFT JOIN comment_reactions cr ON rt.reaction_id = cr.reaction_id AND cr.comment_id = ?
          WHERE rt.is_active = 1
          GROUP BY rt.reaction_id, rt.reaction_name, rt.reaction_emoji
          ORDER BY count DESC, rt.reaction_id
        `;
        params = [commentId];
      } else {
        sql = `
          SELECT 
            rt.reaction_id,
            rt.reaction_name,
            rt.reaction_emoji,
            COUNT(cr.reaction_log_id) as total_count
          FROM reaction_types rt
          LEFT JOIN comment_reactions cr ON rt.reaction_id = cr.reaction_id
          WHERE rt.is_active = 1
          GROUP BY rt.reaction_id, rt.reaction_name, rt.reaction_emoji
          ORDER BY total_count DESC, rt.reaction_id
        `;
      }

      return await this.db.query(sql, params);
    } catch (error) {
      throw new ValidationError(`Failed to get comment reaction stats: ${error.message}`);
    }
  }

  // Get user's reactions for announcements
  async getUserAnnouncementReactions(userId, userType, announcementIds = []) {
    try {
      let sql, params = [userId, userType];

      if (announcementIds.length > 0) {
        const placeholders = announcementIds.map(() => '?').join(',');
        sql = `
          SELECT 
            ar.announcement_id,
            ar.reaction_id,
            rt.reaction_name,
            rt.reaction_emoji
          FROM announcement_reactions ar
          JOIN reaction_types rt ON ar.reaction_id = rt.reaction_id
          WHERE ar.user_id = ? AND ar.user_type = ? AND ar.announcement_id IN (${placeholders})
        `;
        params = params.concat(announcementIds);
      } else {
        sql = `
          SELECT 
            ar.announcement_id,
            ar.reaction_id,
            rt.reaction_name,
            rt.reaction_emoji
          FROM announcement_reactions ar
          JOIN reaction_types rt ON ar.reaction_id = rt.reaction_id
          WHERE ar.user_id = ? AND ar.user_type = ?
        `;
      }

      return await this.db.query(sql, params);
    } catch (error) {
      throw new ValidationError(`Failed to get user announcement reactions: ${error.message}`);
    }
  }

  // Get user's reactions for comments
  async getUserCommentReactions(userId, userType, commentIds = []) {
    try {
      let sql, params = [userId, userType];

      if (commentIds.length > 0) {
        const placeholders = commentIds.map(() => '?').join(',');
        sql = `
          SELECT 
            cr.comment_id,
            cr.reaction_id,
            rt.reaction_name,
            rt.reaction_emoji
          FROM comment_reactions cr
          JOIN reaction_types rt ON cr.reaction_id = rt.reaction_id
          WHERE cr.user_id = ? AND cr.user_type = ? AND cr.comment_id IN (${placeholders})
        `;
        params = params.concat(commentIds);
      } else {
        sql = `
          SELECT 
            cr.comment_id,
            cr.reaction_id,
            rt.reaction_name,
            rt.reaction_emoji
          FROM comment_reactions cr
          JOIN reaction_types rt ON cr.reaction_id = rt.reaction_id
          WHERE cr.user_id = ? AND cr.user_type = ?
        `;
      }

      return await this.db.query(sql, params);
    } catch (error) {
      throw new ValidationError(`Failed to get user comment reactions: ${error.message}`);
    }
  }
}

module.exports = new ReactionModel();
