const BaseModel = require('./BaseModel');
const logger = require('../utils/logger');

class SMSNotificationModel extends BaseModel {
  constructor() {
    super();
    this.tableName = 'sms_notifications';
  }

  /**
   * Create SMS notification record
   * @param {Object} data - SMS notification data
   * @param {number} data.notification_id - Related notification ID
   * @param {string} data.phone_number - Recipient phone number
   * @param {string} data.message - SMS message content
   * @param {string} [data.status='pending'] - SMS status
   * @param {string} [data.provider_message_id] - Provider message ID
   * @param {string} [data.error_message] - Error message if failed
   * @returns {Promise<Object>} - Created SMS notification
   */
  async createSMSNotification(data) {
    try {
      const smsData = {
        notification_id: data.notification_id,
        phone_number: data.phone_number,
        message: data.message,
        status: data.status || 'pending',
        provider_message_id: data.provider_message_id || null,
        error_message: data.error_message || null,
        sent_at: data.status === 'sent' ? new Date() : null,
        delivered_at: data.status === 'delivered' ? new Date() : null,
        created_at: new Date()
      };

      const [result] = await this.db.execute(
        `INSERT INTO ${this.tableName} 
         (notification_id, phone_number, message, status, provider_message_id, error_message, sent_at, delivered_at, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          smsData.notification_id,
          smsData.phone_number,
          smsData.message,
          smsData.status,
          smsData.provider_message_id,
          smsData.error_message,
          smsData.sent_at,
          smsData.delivered_at,
          smsData.created_at
        ]
      );

      return {
        sms_id: result.insertId,
        ...smsData
      };
    } catch (error) {
      logger.error('Error creating SMS notification:', error);
      throw error;
    }
  }

  /**
   * Create multiple SMS notification records
   * @param {Array} smsNotifications - Array of SMS notification data
   * @returns {Promise<Array>} - Created SMS notifications
   */
  async createBulkSMSNotifications(smsNotifications) {
    if (!smsNotifications || smsNotifications.length === 0) {
      return [];
    }

    try {
      const values = [];
      const placeholders = [];

      for (const sms of smsNotifications) {
        placeholders.push('(?, ?, ?, ?, ?, ?, ?, ?, ?)');
        values.push(
          sms.notification_id,
          sms.phone_number,
          sms.message,
          sms.status || 'pending',
          sms.provider_message_id || null,
          sms.error_message || null,
          sms.status === 'sent' ? new Date() : null,
          sms.status === 'delivered' ? new Date() : null,
          new Date()
        );
      }

      const [result] = await this.db.execute(
        `INSERT INTO ${this.tableName} 
         (notification_id, phone_number, message, status, provider_message_id, error_message, sent_at, delivered_at, created_at) 
         VALUES ${placeholders.join(', ')}`,
        values
      );

      // Return created records with IDs
      const createdRecords = [];
      for (let i = 0; i < smsNotifications.length; i++) {
        createdRecords.push({
          sms_id: result.insertId + i,
          ...smsNotifications[i],
          status: smsNotifications[i].status || 'pending',
          created_at: new Date()
        });
      }

      return createdRecords;
    } catch (error) {
      logger.error('Error creating bulk SMS notifications:', error);
      throw error;
    }
  }

  /**
   * Update SMS notification status
   * @param {number} smsId - SMS notification ID
   * @param {Object} updateData - Update data
   * @param {string} [updateData.status] - New status
   * @param {string} [updateData.provider_message_id] - Provider message ID
   * @param {string} [updateData.error_message] - Error message
   * @returns {Promise<Object>} - Updated SMS notification
   */
  async updateSMSStatus(smsId, updateData) {
    try {
      const updates = [];
      const values = [];

      if (updateData.status) {
        updates.push('status = ?');
        values.push(updateData.status);

        // Set timestamps based on status
        if (updateData.status === 'sent' && !updateData.sent_at) {
          updates.push('sent_at = ?');
          values.push(new Date());
        }
        if (updateData.status === 'delivered' && !updateData.delivered_at) {
          updates.push('delivered_at = ?');
          values.push(new Date());
        }
      }

      if (updateData.provider_message_id) {
        updates.push('provider_message_id = ?');
        values.push(updateData.provider_message_id);
      }

      if (updateData.error_message) {
        updates.push('error_message = ?');
        values.push(updateData.error_message);
      }

      if (updateData.sent_at) {
        updates.push('sent_at = ?');
        values.push(updateData.sent_at);
      }

      if (updateData.delivered_at) {
        updates.push('delivered_at = ?');
        values.push(updateData.delivered_at);
      }

      if (updates.length === 0) {
        throw new Error('No valid update fields provided');
      }

      values.push(smsId);

      await this.db.execute(
        `UPDATE ${this.tableName} SET ${updates.join(', ')} WHERE sms_id = ?`,
        values
      );

      // Return updated record
      return await this.getSMSNotificationById(smsId);
    } catch (error) {
      logger.error('Error updating SMS notification status:', error);
      throw error;
    }
  }

  /**
   * Get SMS notification by ID
   * @param {number} smsId - SMS notification ID
   * @returns {Promise<Object|null>} - SMS notification or null
   */
  async getSMSNotificationById(smsId) {
    try {
      const [rows] = await this.db.execute(
        `SELECT * FROM ${this.tableName} WHERE sms_id = ?`,
        [smsId]
      );

      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      logger.error('Error getting SMS notification by ID:', error);
      throw error;
    }
  }

  /**
   * Get SMS notifications by notification ID
   * @param {number} notificationId - Notification ID
   * @returns {Promise<Array>} - SMS notifications
   */
  async getSMSNotificationsByNotificationId(notificationId) {
    try {
      const [rows] = await this.db.execute(
        `SELECT * FROM ${this.tableName} WHERE notification_id = ? ORDER BY created_at DESC`,
        [notificationId]
      );

      return rows;
    } catch (error) {
      logger.error('Error getting SMS notifications by notification ID:', error);
      throw error;
    }
  }

  /**
   * Get SMS notifications by phone number
   * @param {string} phoneNumber - Phone number
   * @param {Object} [options] - Query options
   * @param {number} [options.limit=50] - Limit results
   * @param {number} [options.offset=0] - Offset results
   * @param {string} [options.status] - Filter by status
   * @returns {Promise<Array>} - SMS notifications
   */
  async getSMSNotificationsByPhoneNumber(phoneNumber, options = {}) {
    try {
      const { limit = 50, offset = 0, status } = options;
      
      let query = `SELECT * FROM ${this.tableName} WHERE phone_number = ?`;
      const values = [phoneNumber];

      if (status) {
        query += ' AND status = ?';
        values.push(status);
      }

      query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      values.push(limit, offset);

      const [rows] = await this.db.execute(query, values);
      return rows;
    } catch (error) {
      logger.error('Error getting SMS notifications by phone number:', error);
      throw error;
    }
  }

  /**
   * Get SMS notification statistics
   * @param {Object} [filters] - Filter options
   * @param {Date} [filters.startDate] - Start date
   * @param {Date} [filters.endDate] - End date
   * @param {string} [filters.status] - Status filter
   * @returns {Promise<Object>} - SMS statistics
   */
  async getSMSStatistics(filters = {}) {
    try {
      const { startDate, endDate, status } = filters;
      
      let whereClause = '1=1';
      const values = [];

      if (startDate) {
        whereClause += ' AND created_at >= ?';
        values.push(startDate);
      }

      if (endDate) {
        whereClause += ' AND created_at <= ?';
        values.push(endDate);
      }

      if (status) {
        whereClause += ' AND status = ?';
        values.push(status);
      }

      const [rows] = await this.db.execute(
        `SELECT 
           COUNT(*) as total,
           SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
           SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
           SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
           SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
         FROM ${this.tableName} 
         WHERE ${whereClause}`,
        values
      );

      return rows[0] || {
        total: 0,
        sent: 0,
        delivered: 0,
        failed: 0,
        pending: 0
      };
    } catch (error) {
      logger.error('Error getting SMS statistics:', error);
      throw error;
    }
  }

  /**
   * Delete old SMS notifications
   * @param {number} daysOld - Delete records older than this many days
   * @returns {Promise<number>} - Number of deleted records
   */
  async deleteOldSMSNotifications(daysOld = 90) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const [result] = await this.db.execute(
        `DELETE FROM ${this.tableName} WHERE created_at < ?`,
        [cutoffDate]
      );

      logger.info(`Deleted ${result.affectedRows} old SMS notifications older than ${daysOld} days`);
      return result.affectedRows;
    } catch (error) {
      logger.error('Error deleting old SMS notifications:', error);
      throw error;
    }
  }
}

module.exports = SMSNotificationModel;
