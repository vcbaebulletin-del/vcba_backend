const BaseModel = require('./BaseModel');
const { ValidationError, NotFoundError } = require('../middleware/errorHandler');

class NotificationModel extends BaseModel {
  constructor() {
    super('notifications', 'notification_id');
  }

  // Create notification
  async createNotification(data) {
    try {
      this.validateRequired(data, ['recipient_type', 'recipient_id', 'notification_type_id', 'title', 'message']);

      const notificationData = {
        recipient_type: data.recipient_type,
        recipient_id: data.recipient_id,
        notification_type_id: data.notification_type_id,
        title: data.title,
        message: data.message,
        related_announcement_id: data.related_announcement_id || null,
        related_comment_id: data.related_comment_id || null,
        is_read: 0,
        created_at: new Date().toISOString() // FIX: Use UTC string to prevent timezone conversion (8-hour offset issue)
      };

      const result = await this.db.insert(this.tableName, notificationData);
      return await this.getNotificationById(result.insertId);
    } catch (error) {
      throw new ValidationError(`Failed to create notification: ${error.message}`);
    }
  }

  // Get notifications for a user with pagination
  async getNotificationsByUser(userType, userId, pagination = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        is_read = null,
        notification_type_id = null,
        sort_by = 'created_at',
        sort_order = 'DESC'
      } = pagination;

      const offset = (page - 1) * limit;
      let whereConditions = ['n.recipient_type = ?', 'n.recipient_id = ?'];
      let params = [userType, userId];

      // Add optional filters
      if (is_read !== null) {
        whereConditions.push('n.is_read = ?');
        params.push(is_read);
      }

      if (notification_type_id !== null) {
        whereConditions.push('n.notification_type_id = ?');
        params.push(notification_type_id);
      }

      // Get total count
      const countSql = `
        SELECT COUNT(*) as total
        FROM notifications n
        WHERE ${whereConditions.join(' AND ')}
      `;
      const countResult = await this.db.findOne(countSql, params);
      const total = countResult.total;

      // Get notifications with enhanced metadata for context-aware redirection
      const sql = `
        SELECT
          n.*,
          nt.type_name,
          nt.description as type_description,
          a.title as announcement_title,
          a.status as announcement_status,
          a.category_id as announcement_category_id,
          c.comment_text as comment_preview,
          c.parent_comment_id,
          c.user_type as comment_user_type,
          c.user_id as comment_user_id,
          parent_c.comment_id as parent_comment_exists,
          cal.title as calendar_title,
          cal.event_date as calendar_event_date,
          cal.calendar_id as calendar_id,
          -- Generate context metadata for redirection
          CASE
            WHEN nt.type_name IN ('comment_reply', 'comment_reaction', 'comment_flagged') THEN
              JSON_OBJECT(
                'type', 'comment',
                'target_id', n.related_comment_id,
                'announcement_id', n.related_announcement_id,
                'parent_comment_id', c.parent_comment_id,
                'scroll_to', CONCAT('comment-', n.related_comment_id)
              )
            WHEN nt.type_name = 'announcement_comment' THEN
              JSON_OBJECT(
                'type', 'announcement',
                'target_id', n.related_announcement_id,
                'announcement_id', n.related_announcement_id,
                'comment_id', n.related_comment_id,
                'scroll_to', CONCAT('comment-', n.related_comment_id)
              )
            WHEN nt.type_name IN ('new_announcement', 'alert_announcement', 'announcement_reaction', 'pinned_post') THEN
              JSON_OBJECT(
                'type', 'announcement',
                'target_id', n.related_announcement_id,
                'announcement_id', n.related_announcement_id,
                'scroll_to', CONCAT('announcement-', n.related_announcement_id)
              )
            WHEN nt.type_name = 'calendar_event' THEN
              JSON_OBJECT(
                'type', 'calendar',
                'target_id', cal.calendar_id,
                'event_date', cal.event_date,
                'scroll_to', CONCAT('event-', cal.calendar_id)
              )
            ELSE
              JSON_OBJECT('type', 'general', 'target_id', null)
          END as context_metadata
        FROM notifications n
        LEFT JOIN notification_types nt ON n.notification_type_id = nt.type_id
        LEFT JOIN announcements a ON n.related_announcement_id = a.announcement_id
        LEFT JOIN comments c ON n.related_comment_id = c.comment_id
        LEFT JOIN comments parent_c ON c.parent_comment_id = parent_c.comment_id
        LEFT JOIN school_calendar cal ON n.related_announcement_id = cal.calendar_id AND nt.type_name = 'calendar_event'
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY n.${sort_by} ${sort_order}
        LIMIT ? OFFSET ?
      `;

      const notifications = await this.db.query(sql, [...params, limit, offset]);

      // Calculate pagination info
      const totalPages = Math.ceil(total / limit);
      const hasNext = page < totalPages;
      const hasPrev = page > 1;

      return {
        notifications,
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
      throw new ValidationError(`Failed to get notifications: ${error.message}`);
    }
  }

  // Get single notification by ID with enhanced metadata
  async getNotificationById(id) {
    try {
      const sql = `
        SELECT
          n.*,
          nt.type_name,
          nt.description as type_description,
          a.title as announcement_title,
          a.status as announcement_status,
          a.category_id as announcement_category_id,
          c.comment_text as comment_preview,
          c.parent_comment_id,
          c.user_type as comment_user_type,
          c.user_id as comment_user_id,
          parent_c.comment_id as parent_comment_exists,
          cal.title as calendar_title,
          cal.event_date as calendar_event_date,
          cal.calendar_id as calendar_id,
          -- Generate context metadata for redirection
          CASE
            WHEN nt.type_name IN ('comment_reply', 'comment_reaction', 'comment_flagged') THEN
              JSON_OBJECT(
                'type', 'comment',
                'target_id', n.related_comment_id,
                'announcement_id', n.related_announcement_id,
                'parent_comment_id', c.parent_comment_id,
                'scroll_to', CONCAT('comment-', n.related_comment_id)
              )
            WHEN nt.type_name = 'announcement_comment' THEN
              JSON_OBJECT(
                'type', 'announcement',
                'target_id', n.related_announcement_id,
                'announcement_id', n.related_announcement_id,
                'comment_id', n.related_comment_id,
                'scroll_to', CONCAT('comment-', n.related_comment_id)
              )
            WHEN nt.type_name IN ('new_announcement', 'alert_announcement', 'announcement_reaction', 'pinned_post') THEN
              JSON_OBJECT(
                'type', 'announcement',
                'target_id', n.related_announcement_id,
                'announcement_id', n.related_announcement_id,
                'scroll_to', CONCAT('announcement-', n.related_announcement_id)
              )
            WHEN nt.type_name = 'calendar_event' THEN
              JSON_OBJECT(
                'type', 'calendar',
                'target_id', cal.calendar_id,
                'event_date', cal.event_date,
                'scroll_to', CONCAT('event-', cal.calendar_id)
              )
            ELSE
              JSON_OBJECT('type', 'general', 'target_id', null)
          END as context_metadata
        FROM notifications n
        LEFT JOIN notification_types nt ON n.notification_type_id = nt.type_id
        LEFT JOIN announcements a ON n.related_announcement_id = a.announcement_id
        LEFT JOIN comments c ON n.related_comment_id = c.comment_id
        LEFT JOIN comments parent_c ON c.parent_comment_id = parent_c.comment_id
        LEFT JOIN school_calendar cal ON n.related_announcement_id = cal.calendar_id AND nt.type_name = 'calendar_event'
        WHERE n.notification_id = ?
      `;

      const notification = await this.db.findOne(sql, [id]);
      if (!notification) {
        throw new NotFoundError('Notification not found');
      }

      return notification;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new ValidationError(`Failed to get notification: ${error.message}`);
    }
  }

  // Get unread count for user
  async getUnreadCount(userType, userId) {
    try {
      const sql = `
        SELECT COUNT(*) as count
        FROM notifications
        WHERE recipient_type = ? AND recipient_id = ? AND is_read = 0
      `;

      const result = await this.db.findOne(sql, [userType, userId]);
      return result.count;
    } catch (error) {
      throw new ValidationError(`Failed to get unread count: ${error.message}`);
    }
  }

  // Mark notification as read
  async markAsRead(id, userId, userType) {
    try {
      // Verify notification belongs to user
      const notification = await this.db.findOne(
        'SELECT recipient_type, recipient_id FROM notifications WHERE notification_id = ?',
        [id]
      );

      if (!notification) {
        throw new NotFoundError('Notification not found');
      }

      if (notification.recipient_type !== userType || notification.recipient_id !== userId) {
        throw new ValidationError('You can only mark your own notifications as read');
      }

      const result = await this.db.update(
        this.tableName,
        {
          is_read: 1,
          read_at: new Date().toISOString() // FIX: Use UTC string to prevent timezone conversion
        },
        `${this.primaryKey} = ?`,
        [id]
      );

      if (result.affectedRows === 0) {
        throw new NotFoundError('Notification not found');
      }

      return await this.getNotificationById(id);
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) throw error;
      throw new ValidationError(`Failed to mark notification as read: ${error.message}`);
    }
  }

  // Mark all notifications as read for user
  async markAllAsRead(userType, userId) {
    try {
      const result = await this.db.update(
        this.tableName,
        {
          is_read: 1,
          read_at: new Date().toISOString() // FIX: Use UTC string to prevent timezone conversion
        },
        'recipient_type = ? AND recipient_id = ? AND is_read = 0',
        [userType, userId]
      );

      return { success: true, markedCount: result.affectedRows };
    } catch (error) {
      throw new ValidationError(`Failed to mark all notifications as read: ${error.message}`);
    }
  }

  // Delete notification
  async deleteNotification(id, userId, userType) {
    try {
      // Verify notification belongs to user
      const notification = await this.db.findOne(
        'SELECT recipient_type, recipient_id FROM notifications WHERE notification_id = ?',
        [id]
      );

      if (!notification) {
        throw new NotFoundError('Notification not found');
      }

      if (notification.recipient_type !== userType || notification.recipient_id !== userId) {
        throw new ValidationError('You can only delete your own notifications');
      }

      const result = await this.db.delete(
        this.tableName,
        `${this.primaryKey} = ?`,
        [id]
      );

      if (result.affectedRows === 0) {
        throw new NotFoundError('Notification not found');
      }

      return { success: true, message: 'Notification deleted successfully' };
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) throw error;
      throw new ValidationError(`Failed to delete notification: ${error.message}`);
    }
  }

  // Get notification statistics (admin only)
  async getNotificationStats() {
    try {
      const sql = `
        SELECT 
          COUNT(*) as total_notifications,
          SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as unread_notifications,
          notification_type_id,
          nt.type_name,
          COUNT(*) as count_by_type
        FROM notifications n
        LEFT JOIN notification_types nt ON n.notification_type_id = nt.type_id
        GROUP BY notification_type_id, nt.type_name
        ORDER BY count_by_type DESC
      `;

      const typeStats = await this.db.query(sql);

      // Get overall stats
      const overallSql = `
        SELECT 
          COUNT(*) as total_notifications,
          SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as unread_notifications,
          SUM(CASE WHEN recipient_type = 'admin' THEN 1 ELSE 0 END) as admin_notifications,
          SUM(CASE WHEN recipient_type = 'student' THEN 1 ELSE 0 END) as student_notifications
        FROM notifications
      `;

      const overallStats = await this.db.findOne(overallSql);

      return {
        ...overallStats,
        notificationsByType: typeStats
      };
    } catch (error) {
      throw new ValidationError(`Failed to get notification statistics: ${error.message}`);
    }
  }

  // Create bulk notifications (for announcements)
  async createBulkNotifications(notifications) {
    try {
      if (!Array.isArray(notifications) || notifications.length === 0) {
        throw new ValidationError('Notifications array is required');
      }

      const results = [];
      for (const notificationData of notifications) {
        const result = await this.createNotification(notificationData);
        results.push(result);
      }

      return results;
    } catch (error) {
      throw new ValidationError(`Failed to create bulk notifications: ${error.message}`);
    }
  }

  // Get notification types
  async getNotificationTypes() {
    try {
      const sql = 'SELECT * FROM notification_types ORDER BY type_id';
      return await this.db.query(sql);
    } catch (error) {
      throw new ValidationError(`Failed to get notification types: ${error.message}`);
    }
  }
}

module.exports = new NotificationModel();
