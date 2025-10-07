const AuditLogService = require('../services/AuditLogService');
const logger = require('../utils/logger');

/**
 * Middleware to automatically log CRUD operations
 * This middleware should be used after the main operation but before sending response
 */
const auditLogger = (options = {}) => {
  const {
    action = null,
    table = null,
    getRecordId = null,
    getOldData = null,
    getNewData = null,
    getDescription = null,
    skipCondition = null
  } = options;

  return async (req, res, next) => {
    // Store original res.json to intercept response
    const originalJson = res.json.bind(res);

    res.json = function(data) {
      // Call original json method first
      const result = originalJson(data);

      // Only log if the operation was successful
      if (data && data.success !== false && res.statusCode < 400) {
        // Run audit logging asynchronously to not block response
        setImmediate(async () => {
          try {
            // Check skip condition
            if (skipCondition && skipCondition(req, res, data)) {
              return;
            }

            // Determine action type
            let actionType = action;
            if (!actionType) {
              switch (req.method) {
                case 'POST':
                  actionType = 'CREATE';
                  break;
                case 'PUT':
                case 'PATCH':
                  actionType = 'UPDATE';
                  break;
                case 'DELETE':
                  actionType = 'DELETE';
                  break;
                case 'GET':
                  actionType = 'READ';
                  break;
                default:
                  actionType = req.method;
              }
            }

            // Determine table name
            let tableName = table;
            if (!tableName) {
              // Try to extract from URL path
              const pathSegments = req.path.split('/').filter(Boolean);
              if (pathSegments.length > 0) {
                tableName = pathSegments[pathSegments.length - 1];
              }
            }

            // Get record ID
            let recordId = null;
            if (getRecordId) {
              recordId = getRecordId(req, res, data);
            } else if (req.params.id) {
              recordId = req.params.id;
            } else if (data && data.data && data.data.id) {
              recordId = data.data.id;
            }

            // Get old and new data
            let oldData = null;
            let newData = null;
            
            if (getOldData) {
              oldData = getOldData(req, res, data);
            }
            
            if (getNewData) {
              newData = getNewData(req, res, data);
            } else if (actionType === 'CREATE' || actionType === 'UPDATE') {
              newData = req.body;
            }

            // Get description
            let description = null;
            if (getDescription) {
              description = getDescription(req, res, data);
            } else {
              const userIdentifier = req.user?.email || req.user?.student_number || 'Unknown user';
              description = `${userIdentifier} performed ${actionType} on ${tableName}${recordId ? ` (ID: ${recordId})` : ''}`;
            }

            // Log the action
            await AuditLogService.logAction({
              user_type: req.user?.role || (req.user?.student_number ? 'student' : 'admin'),
              user_id: req.user?.id || req.user?.admin_id || req.user?.student_id,
              action_type: actionType,
              target_table: tableName,
              target_id: recordId,
              old_values: oldData,
              new_values: newData,
              description,
              req
            });

          } catch (error) {
            // Log error but don't throw to avoid affecting the main response
            logger.error('Audit logging middleware error:', error);
          }
        });
      }
      
      return result;
    };

    next();
  };
};

/**
 * Specific audit loggers for common operations
 */

// Authentication audit logger
const auditAuth = (action, success = true) => {
  return async (req, res, next) => {
    const originalJson = res.json;

    res.json = function(data) {
      const result = originalJson.call(this, data);

      setImmediate(async () => {
        try {
          // Determine success based on response data and status code
          const isSuccess = data && data.success !== false && res.statusCode >= 200 && res.statusCode < 400;

          // Debug logging for logout operations
          if (action.toUpperCase() === 'LOGOUT' || action.toUpperCase() === 'LOGOUT_ALL') {
            logger.info(`[AUDIT DEBUG] ${action} - Response data:`, {
              hasData: !!data,
              dataSuccess: data?.success,
              statusCode: res.statusCode,
              isSuccess,
              userEmail: req.user?.email
            });
          }

          // For logout operations, prioritize req.user (from authenticate middleware)
          // For login operations, use req.body (contains login credentials)
          // For successful login, use the returned user data from response
          let user;
          if (action.toUpperCase() === 'LOGOUT' || action.toUpperCase() === 'LOGOUT_ALL') {
            user = req.user || {};
          } else if (action.toUpperCase() === 'LOGIN' && isSuccess && data.data && data.data.user) {
            // For successful login, use the user data from the response
            user = data.data.user;
          } else {
            user = req.body || req.user || {};
          }

          await AuditLogService.logAuth(
            user,
            action,
            isSuccess,
            {
              error: !isSuccess ? (data?.error?.message || data?.message) : null,
              reason: !isSuccess ? 'Authentication failed' : null
            },
            req
          );
        } catch (error) {
          logger.error('Auth audit logging error:', error);
        }
      });

      return result;
    };

    next();
  };
};

// CRUD audit logger with automatic detection
const auditCRUD = (tableName, options = {}) => {
  return auditLogger({
    table: tableName,
    ...options
  });
};

// Admin management audit logger
const auditAdminAction = (action, targetTable = 'admins') => {
  return auditLogger({
    action,
    table: targetTable,
    getDescription: (req, res, data) => {
      const adminEmail = req.user?.email || 'Unknown admin';
      const targetId = req.params.adminId || req.params.id;
      return `${adminEmail} performed ${action} on ${targetTable}${targetId ? ` (ID: ${targetId})` : ''}`;
    }
  });
};

// Student management audit logger
const auditStudentAction = (action) => {
  return auditLogger({
    action,
    table: 'students',
    getRecordId: (req, res, data) => req.params.studentId || req.params.id,
    getDescription: (req, res, data) => {
      const adminEmail = req.user?.email || 'Unknown admin';
      const studentId = req.params.studentId || req.params.id;
      return `${adminEmail} performed ${action} on student${studentId ? ` (ID: ${studentId})` : ''}`;
    }
  });
};

// Content management audit logger
const auditContentAction = (action, contentType) => {
  return auditLogger({
    action,
    table: contentType,
    getRecordId: (req, res, data) => {
      const params = req.params || {};
      return params.announcementId ||
             params.eventId ||
             params.categoryId ||
             params.subcategoryId ||
             params.commentId ||
             params.calendarId ||
             params.id ||
             (data && data.data && (data.data.announcement_id || data.data.event_id || data.data.category_id || data.data.subcategory_id || data.data.comment_id || data.data.calendar_id || data.data.id));
    },
    getDescription: (req, res, data) => {
      const userEmail = req.user?.email || req.user?.student_number || 'Unknown user';
      const params = req.params || {};
      const recordId = params.announcementId || params.eventId || params.categoryId || params.subcategoryId || params.commentId || params.calendarId || params.id;
      return `${userEmail} performed ${action} on ${contentType}${recordId ? ` (ID: ${recordId})` : ''}`;
    }
  });
};

// File operation audit logger
const auditFileAction = (action) => {
  return async (req, res, next) => {
    const originalJson = res.json;
    
    res.json = function(data) {
      const result = originalJson.call(this, data);
      
      if (data && data.success !== false && res.statusCode < 400) {
        setImmediate(async () => {
          try {
            const fileName = req.file?.originalname || req.files?.[0]?.originalname || 'unknown';
            const fileSize = req.file?.size || req.files?.[0]?.size;
            const fileType = req.file?.mimetype || req.files?.[0]?.mimetype;
            
            await AuditLogService.logFileAction(
              req.user,
              action,
              fileName,
              { fileSize, fileType },
              req
            );
          } catch (error) {
            logger.error('File audit logging error:', error);
          }
        });
      }
      
      return result;
    };

    next();
  };
};

// Security event audit logger
const auditSecurityEvent = (eventType, severity = 'medium') => {
  return async (req, res, next) => {
    try {
      await AuditLogService.logSecurityEvent(
        eventType,
        `Security event: ${eventType}`,
        {
          severity,
          userId: req.user?.id,
          userEmail: req.user?.email,
          path: req.path,
          method: req.method
        },
        req
      );
    } catch (error) {
      logger.error('Security audit logging error:', error);
    }
    
    next();
  };
};

// System event audit logger
const auditSystemEvent = (action, description) => {
  return async (req, res, next) => {
    const originalJson = res.json;
    
    res.json = function(data) {
      const result = originalJson.call(this, data);
      
      if (data && data.success !== false && res.statusCode < 400) {
        setImmediate(async () => {
          try {
            await AuditLogService.logSystemEvent(action, description, {
              path: req.path,
              method: req.method,
              user: req.user?.email || req.user?.student_number
            });
          } catch (error) {
            logger.error('System audit logging error:', error);
          }
        });
      }
      
      return result;
    };

    next();
  };
};

module.exports = {
  auditLogger,
  auditAuth,
  auditCRUD,
  auditAdminAction,
  auditStudentAction,
  auditContentAction,
  auditFileAction,
  auditSecurityEvent,
  auditSystemEvent
};
