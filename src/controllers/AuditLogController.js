const AuditLogService = require('../services/AuditLogService');
const AuditLogModel = require('../models/AuditLogModel');
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

class AuditLogController {
  /**
   * Get audit logs with filtering and pagination
   * GET /api/audit-logs
   */
  getAuditLogs = asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 20,
      user_type,
      user_id,
      action_type,
      target_table,
      start_date,
      end_date,
      search,
      sort_by = 'performed_at',
      sort_order = 'DESC'
    } = req.query;

    // Build filters object
    const filters = {};
    if (user_type) filters.user_type = user_type;
    if (user_id) filters.user_id = parseInt(user_id);
    if (action_type) filters.action_type = action_type;
    if (target_table) filters.target_table = target_table;
    if (start_date) filters.start_date = start_date;
    if (end_date) filters.end_date = end_date;
    if (search) filters.search = search;

    // Build pagination object
    const pagination = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort_by,
      sort_order: sort_order.toUpperCase()
    };

    const result = await AuditLogService.getAuditLogs(filters, pagination);

    // Log this audit log access
    await AuditLogService.logAction({
      user_type: 'admin',
      user_id: req.user?.id,
      action_type: 'READ',
      target_table: 'audit_logs',
      description: `Admin ${req.user?.email} accessed audit logs with filters: ${JSON.stringify(filters)}`,
      req
    });

    res.status(200).json({
      success: true,
      message: 'Audit logs retrieved successfully',
      data: result.data,
      pagination: result.pagination,
      filters: filters
    });
  });

  /**
   * Get audit log by ID
   * GET /api/audit-logs/:logId
   */
  getAuditLogById = asyncHandler(async (req, res) => {
    const { logId } = req.params;

    const auditLog = await AuditLogModel.getAuditLogById(parseInt(logId));

    if (!auditLog) {
      return res.status(404).json({
        success: false,
        message: 'Audit log not found'
      });
    }

    // Log this specific audit log access
    await AuditLogService.logAction({
      user_type: 'admin',
      user_id: req.user?.id,
      action_type: 'READ',
      target_table: 'audit_logs',
      target_id: parseInt(logId),
      description: `Admin ${req.user?.email} accessed audit log ID ${logId}`,
      req
    });

    res.status(200).json({
      success: true,
      message: 'Audit log retrieved successfully',
      data: auditLog
    });
  });

  /**
   * Get audit log statistics
   * GET /api/audit-logs/stats
   */
  getAuditLogStats = asyncHandler(async (req, res) => {
    const { start_date, end_date } = req.query;

    const filters = {};
    if (start_date) filters.start_date = start_date;
    if (end_date) filters.end_date = end_date;

    const stats = await AuditLogService.getAuditLogStats(filters);

    // Log stats access
    await AuditLogService.logAction({
      user_type: 'admin',
      user_id: req.user?.id,
      action_type: 'READ',
      target_table: 'audit_logs',
      description: `Admin ${req.user?.email} accessed audit log statistics`,
      req
    });

    res.status(200).json({
      success: true,
      message: 'Audit log statistics retrieved successfully',
      data: stats
    });
  });

  /**
   * Export audit logs
   * GET /api/audit-logs/export
   */
  exportAuditLogs = asyncHandler(async (req, res) => {
    const {
      format = 'json',
      user_type,
      user_id,
      action_type,
      target_table,
      start_date,
      end_date,
      search
    } = req.query;

    // Build filters object
    const filters = {};
    if (user_type) filters.user_type = user_type;
    if (user_id) filters.user_id = parseInt(user_id);
    if (action_type) filters.action_type = action_type;
    if (target_table) filters.target_table = target_table;
    if (start_date) filters.start_date = start_date;
    if (end_date) filters.end_date = end_date;
    if (search) filters.search = search;

    const exportData = await AuditLogService.exportAuditLogs(filters, format);

    // Log the export action
    await AuditLogService.logAction({
      user_type: 'admin',
      user_id: req.user?.id,
      action_type: 'EXPORT',
      target_table: 'audit_logs',
      description: `Admin ${req.user?.email} exported audit logs in ${format} format`,
      new_values: { format, filters },
      req
    });

    // Set appropriate headers based on format
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    switch (format.toLowerCase()) {
      case 'csv':
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${timestamp}.csv"`);
        break;
      case 'json':
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${timestamp}.json"`);
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Unsupported export format. Use "json" or "csv".'
        });
    }

    res.send(exportData);
  });

  /**
   * Get user-specific audit logs
   * GET /api/audit-logs/user/:userId
   */
  getUserAuditLogs = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const {
      page = 1,
      limit = 20,
      action_type,
      target_table,
      start_date,
      end_date,
      sort_by = 'performed_at',
      sort_order = 'DESC'
    } = req.query;

    // Build filters object
    const filters = {
      user_id: parseInt(userId)
    };
    if (action_type) filters.action_type = action_type;
    if (target_table) filters.target_table = target_table;
    if (start_date) filters.start_date = start_date;
    if (end_date) filters.end_date = end_date;

    // Build pagination object
    const pagination = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort_by,
      sort_order: sort_order.toUpperCase()
    };

    const result = await AuditLogService.getAuditLogs(filters, pagination);

    // Log this user-specific audit log access
    await AuditLogService.logAction({
      user_type: 'admin',
      user_id: req.user?.id,
      action_type: 'READ',
      target_table: 'audit_logs',
      description: `Admin ${req.user?.email} accessed audit logs for user ID ${userId}`,
      req
    });

    res.status(200).json({
      success: true,
      message: 'User audit logs retrieved successfully',
      data: result.data,
      pagination: result.pagination,
      filters: filters
    });
  });

  /**
   * Get audit logs by table
   * GET /api/audit-logs/table/:tableName
   */
  getTableAuditLogs = asyncHandler(async (req, res) => {
    const { tableName } = req.params;
    const {
      page = 1,
      limit = 20,
      action_type,
      target_id,
      start_date,
      end_date,
      sort_by = 'performed_at',
      sort_order = 'DESC'
    } = req.query;

    // Build filters object
    const filters = {
      target_table: tableName
    };
    if (action_type) filters.action_type = action_type;
    if (target_id) filters.target_id = parseInt(target_id);
    if (start_date) filters.start_date = start_date;
    if (end_date) filters.end_date = end_date;

    // Build pagination object
    const pagination = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort_by,
      sort_order: sort_order.toUpperCase()
    };

    const result = await AuditLogService.getAuditLogs(filters, pagination);

    // Log this table-specific audit log access
    await AuditLogService.logAction({
      user_type: 'admin',
      user_id: req.user?.id,
      action_type: 'READ',
      target_table: 'audit_logs',
      description: `Admin ${req.user?.email} accessed audit logs for table ${tableName}`,
      req
    });

    res.status(200).json({
      success: true,
      message: `Audit logs for table ${tableName} retrieved successfully`,
      data: result.data,
      pagination: result.pagination,
      filters: filters
    });
  });

  /**
   * Clean up old audit logs (admin only)
   * DELETE /api/audit-logs/cleanup
   */
  cleanupOldLogs = asyncHandler(async (req, res) => {
    const { days_to_keep = 365 } = req.body;

    // Only super admin can perform cleanup
    if (req.user?.position !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only super administrators can perform audit log cleanup'
      });
    }

    const deletedCount = await AuditLogService.cleanupOldLogs(parseInt(days_to_keep));

    res.status(200).json({
      success: true,
      message: `Audit log cleanup completed. ${deletedCount} old records deleted.`,
      data: {
        deleted_count: deletedCount,
        days_kept: parseInt(days_to_keep)
      }
    });
  });

  /**
   * Get audit log summary for dashboard
   * GET /api/audit-logs/summary
   */
  getAuditLogSummary = asyncHandler(async (req, res) => {
    const { days = 7 } = req.query;
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const filters = {
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0]
    };

    const stats = await AuditLogService.getAuditLogStats(filters);
    
    // Get recent critical events
    const recentEvents = await AuditLogService.getAuditLogs(
      { 
        ...filters,
        action_type: 'DELETE'
      },
      { limit: 10, sort_by: 'performed_at', sort_order: 'DESC' }
    );

    res.status(200).json({
      success: true,
      message: 'Audit log summary retrieved successfully',
      data: {
        period_days: parseInt(days),
        statistics: stats,
        recent_critical_events: recentEvents.data
      }
    });
  });
}

module.exports = new AuditLogController();
