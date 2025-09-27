const BaseModel = require('./BaseModel');
const logger = require('../utils/logger');

class AuditLogModel extends BaseModel {
  constructor() {
    super('audit_logs', 'log_id');
  }
  /**
   * Create a new audit log entry
   * @param {Object} logData - The audit log data
   * @returns {Promise<Object>} The created audit log entry
   */
  static async createAuditLog(logData) {
    const instance = new AuditLogModel();
    const {
      user_type,
      user_id,
      action_type,
      target_table,
      target_id,
      old_values,
      new_values,
      description,
      ip_address,
      user_agent
    } = logData;

    try {
      const query = `
        INSERT INTO audit_logs (
          user_type, user_id, action_type, target_table, target_id,
          old_values, new_values, description, ip_address, user_agent, performed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `;

      const values = [
        user_type,
        user_id,
        action_type,
        target_table,
        target_id,
        old_values ? JSON.stringify(old_values) : null,
        new_values ? JSON.stringify(new_values) : null,
        description,
        ip_address,
        user_agent
      ];

      const result = await instance.db.execute(query, values);

      // Return the created audit log
      return await instance.getAuditLogById(result.insertId);
    } catch (error) {
      logger.error('Error creating audit log:', error);
      throw error;
    }
  }

  /**
   * Get audit log by ID
   * @param {number} logId - The audit log ID
   * @returns {Promise<Object|null>} The audit log entry or null if not found
   */
  async getAuditLogById(logId) {
    try {
      const query = `
        SELECT
          al.*,
          CASE
            WHEN al.user_type = 'admin' THEN CONCAT(ap.first_name, ' ', ap.last_name)
            WHEN al.user_type = 'student' THEN CONCAT(sp.first_name, ' ', sp.last_name)
            ELSE 'System'
          END as user_name,
          CASE
            WHEN al.user_type = 'admin' THEN aa.email
            WHEN al.user_type = 'student' THEN sa.email
            ELSE NULL
          END as user_email
        FROM audit_logs al
        LEFT JOIN admin_accounts aa ON al.user_type = 'admin' AND al.user_id = aa.admin_id
        LEFT JOIN admin_profiles ap ON aa.admin_id = ap.admin_id
        LEFT JOIN student_accounts sa ON al.user_type = 'student' AND al.user_id = sa.student_id
        LEFT JOIN student_profiles sp ON sa.student_id = sp.student_id
        WHERE al.log_id = ?
      `;

      const rows = await this.db.execute(query, [logId]);
      
      if (rows.length === 0) {
        return null;
      }

      const log = rows[0];
      
      // Parse JSON fields
      if (log.old_values) {
        try {
          log.old_values = JSON.parse(log.old_values);
        } catch (e) {
          log.old_values = null;
        }
      }
      
      if (log.new_values) {
        try {
          log.new_values = JSON.parse(log.new_values);
        } catch (e) {
          log.new_values = null;
        }
      }

      return log;
    } catch (error) {
      logger.error('Error getting audit log by ID:', error);
      throw error;
    }
  }

  /**
   * Get audit logs with filtering, pagination, and search
   * @param {Object} filters - Filter criteria
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Object>} Paginated audit logs with metadata
   */
  static async getAuditLogs(filters = {}, pagination = {}) {
    const instance = new AuditLogModel();
    const {
      user_type,
      user_id,
      action_type,
      target_table,
      start_date,
      end_date,
      search,
      severity
    } = filters;

    const {
      page = 1,
      limit = 20,
      sort_by = 'performed_at',
      sort_order = 'DESC'
    } = pagination;

    try {
      // Build WHERE clause
      const whereConditions = [];
      const queryParams = [];

      if (user_type) {
        whereConditions.push('al.user_type = ?');
        queryParams.push(user_type);
      }

      if (user_id) {
        whereConditions.push('al.user_id = ?');
        queryParams.push(user_id);
      }

      if (action_type) {
        whereConditions.push('al.action_type = ?');
        queryParams.push(action_type);
      }

      if (target_table) {
        whereConditions.push('al.target_table = ?');
        queryParams.push(target_table);
      }

      if (start_date) {
        whereConditions.push('al.performed_at >= ?');
        queryParams.push(start_date);
      }

      if (end_date) {
        whereConditions.push('al.performed_at <= ?');
        queryParams.push(end_date);
      }

      if (search) {
        whereConditions.push(`(
          al.description LIKE ? OR 
          al.target_table LIKE ? OR
          CASE 
            WHEN al.user_type = 'admin' THEN ap.full_name
            WHEN al.user_type = 'student' THEN sp.full_name
            ELSE 'System'
          END LIKE ? OR
          CASE 
            WHEN al.user_type = 'admin' THEN a.email
            WHEN al.user_type = 'student' THEN s.email
            ELSE NULL
          END LIKE ?
        )`);
        const searchTerm = `%${search}%`;
        queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // Count total records
      const countQuery = `
        SELECT COUNT(*) as total
        FROM audit_logs al
        LEFT JOIN admin_accounts aa ON al.user_type = 'admin' AND al.user_id = aa.admin_id
        LEFT JOIN admin_profiles ap ON aa.admin_id = ap.admin_id
        LEFT JOIN student_accounts sa ON al.user_type = 'student' AND al.user_id = sa.student_id
        LEFT JOIN student_profiles sp ON sa.student_id = sp.student_id
        ${whereClause}
      `;



      const countResult = await instance.db.execute(countQuery, queryParams);
      const totalRecords = countResult[0].total;

      // Calculate pagination
      const offset = (page - 1) * limit;
      const totalPages = Math.ceil(totalRecords / limit);

      // Main query with pagination
      const mainQuery = `
        SELECT
          al.*,
          CASE
            WHEN al.user_type = 'admin' THEN CONCAT(ap.first_name, ' ', ap.last_name)
            WHEN al.user_type = 'student' THEN CONCAT(sp.first_name, ' ', sp.last_name)
            ELSE 'System'
          END as user_name,
          CASE
            WHEN al.user_type = 'admin' THEN aa.email
            WHEN al.user_type = 'student' THEN sa.email
            ELSE NULL
          END as user_email
        FROM audit_logs al
        LEFT JOIN admin_accounts aa ON al.user_type = 'admin' AND al.user_id = aa.admin_id
        LEFT JOIN admin_profiles ap ON aa.admin_id = ap.admin_id
        LEFT JOIN student_accounts sa ON al.user_type = 'student' AND al.user_id = sa.student_id
        LEFT JOIN student_profiles sp ON sa.student_id = sp.student_id
        ${whereClause}
        ORDER BY al.${sort_by} ${sort_order}
        LIMIT ? OFFSET ?
      `;

      queryParams.push(limit, offset);



      const rows = await instance.db.execute(mainQuery, queryParams);

      // Parse JSON fields for each log
      const logs = rows.map(log => {
        if (log.old_values) {
          try {
            log.old_values = JSON.parse(log.old_values);
          } catch (e) {
            log.old_values = null;
          }
        }
        
        if (log.new_values) {
          try {
            log.new_values = JSON.parse(log.new_values);
          } catch (e) {
            log.new_values = null;
          }
        }

        return log;
      });

      return {
        data: logs,
        pagination: {
          current_page: page,
          per_page: limit,
          total_pages: totalPages,
          total_records: totalRecords,
          has_next_page: page < totalPages,
          has_prev_page: page > 1
        }
      };
    } catch (error) {
      logger.error('Error getting audit logs:', error);
      throw error;
    }
  }

  /**
   * Get audit log statistics
   * @param {Object} filters - Filter criteria for statistics
   * @returns {Promise<Object>} Audit log statistics
   */
  static async getAuditLogStats(filters = {}) {
    const instance = new AuditLogModel();
    const { start_date, end_date } = filters;

    try {
      const whereConditions = [];
      const queryParams = [];

      if (start_date) {
        whereConditions.push('performed_at >= ?');
        queryParams.push(start_date);
      }

      if (end_date) {
        whereConditions.push('performed_at <= ?');
        queryParams.push(end_date);
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      const statsQuery = `
        SELECT 
          COUNT(*) as total_logs,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(CASE WHEN action_type = 'CREATE' THEN 1 END) as create_actions,
          COUNT(CASE WHEN action_type = 'UPDATE' THEN 1 END) as update_actions,
          COUNT(CASE WHEN action_type = 'DELETE' THEN 1 END) as delete_actions,
          COUNT(CASE WHEN action_type = 'LOGIN' THEN 1 END) as login_actions,
          COUNT(CASE WHEN action_type = 'LOGOUT' THEN 1 END) as logout_actions,
          COUNT(CASE WHEN user_type = 'admin' THEN 1 END) as admin_actions,
          COUNT(CASE WHEN user_type = 'student' THEN 1 END) as student_actions,
          COUNT(CASE WHEN user_type = 'system' THEN 1 END) as system_actions
        FROM audit_logs
        ${whereClause}
      `;

      const statsResult = await instance.db.execute(statsQuery, queryParams);
      return statsResult[0];
    } catch (error) {
      logger.error('Error getting audit log statistics:', error);
      throw error;
    }
  }

  /**
   * Delete old audit logs (for maintenance)
   * @param {number} daysToKeep - Number of days to keep logs
   * @returns {Promise<number>} Number of deleted records
   */
  static async deleteOldLogs(daysToKeep = 365) {
    const instance = new AuditLogModel();
    try {
      const query = `
        DELETE FROM audit_logs
        WHERE performed_at < DATE_SUB(NOW(), INTERVAL ? DAY)
      `;

      const result = await instance.db.execute(query, [daysToKeep]);
      
      logger.info(`Deleted ${result.affectedRows} old audit log entries older than ${daysToKeep} days`);
      return result.affectedRows;
    } catch (error) {
      logger.error('Error deleting old audit logs:', error);
      throw error;
    }
  }
}

module.exports = AuditLogModel;
