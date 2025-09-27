const { asyncHandler } = require('../middleware/errorHandler');
const smsService = require('../services/smsService');
const SMSNotificationModel = require('../models/SMSNotificationModel');

class SMSController {
  constructor() {
    this.smsNotificationModel = new SMSNotificationModel();
  }

  /**
   * Get SMS service status and configuration
   */
  getStatus = asyncHandler(async (req, res) => {
    const status = smsService.getServiceStatus();
    
    res.status(200).json({
      success: true,
      message: 'SMS service status retrieved successfully',
      data: status
    });
  });

  /**
   * Get full SMS configuration for editing (unmasked values)
   */
  getFullConfig = asyncHandler(async (req, res) => {
    const config = smsService.getFullConfiguration();

    res.status(200).json({
      success: true,
      message: 'SMS configuration retrieved successfully',
      data: config
    });
  });

  /**
   * Update SMS configuration
   */
  updateConfig = asyncHandler(async (req, res) => {
    try {
      console.log('📝 SMS Config Update Request:', {
        body: req.body,
        bodyType: typeof req.body,
        bodyKeys: req.body ? Object.keys(req.body) : 'No body',
        headers: {
          'content-type': req.headers['content-type'],
          'authorization': req.headers['authorization'] ? 'Present' : 'Missing'
        },
        user: req.user ? req.user.email : 'No user',
        method: req.method,
        url: req.url
      });

      // Check if body exists and is an object
      if (!req.body || typeof req.body !== 'object') {
        console.log('❌ Invalid request body:', req.body);
        return res.status(400).json({
          success: false,
          error: {
            message: 'Invalid request body',
            details: 'Request body must be a valid JSON object',
            code: 'INVALID_BODY'
          }
        });
      }

      let { apiKey, deviceId, baseURL, isEnabled, rateLimitPerMinute } = req.body;

      // Sanitize and validate data types
      isEnabled = Boolean(isEnabled);
      rateLimitPerMinute = Number(rateLimitPerMinute) || 60;

      console.log('📋 Extracted and sanitized fields:', {
        apiKey: apiKey ? `${apiKey.substring(0, 8)}...` : 'Missing',
        deviceId: deviceId ? `${deviceId.substring(0, 8)}...` : 'Missing',
        baseURL: baseURL || 'Missing',
        isEnabled: isEnabled,
        isEnabledType: typeof isEnabled,
        rateLimitPerMinute: rateLimitPerMinute,
        rateLimitType: typeof rateLimitPerMinute
      });

      // Validate required fields
      if (!apiKey || !deviceId || !baseURL) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Missing required fields: apiKey, deviceId, and baseURL are required',
            code: 'VALIDATION_ERROR'
          }
        });
      }

      // Validate URL format
      try {
        new URL(baseURL);
      } catch (urlError) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Invalid baseURL format. Please provide a valid URL.',
            code: 'INVALID_URL'
          }
        });
      }

      // Validate rate limit
      if (rateLimitPerMinute && (rateLimitPerMinute < 1 || rateLimitPerMinute > 1000)) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Rate limit must be between 1 and 1000 messages per minute',
            code: 'INVALID_RATE_LIMIT'
          }
        });
      }

      console.log('📝 Updating SMS configuration:', {
        apiKey: apiKey ? apiKey.substring(0, 8) + '...' : 'Not provided',
        deviceId: deviceId ? deviceId.substring(0, 8) + '...' : 'Not provided',
        baseURL,
        isEnabled,
        rateLimitPerMinute
      });

      // Update configuration in database
      await smsService.updateConfigInDatabase({
        apiKey,
        deviceId,
        baseURL,
        isEnabled,
        rateLimitPerMinute
      });

      const updatedStatus = smsService.getServiceStatus();
      console.log('✅ SMS configuration updated successfully');

      res.status(200).json({
        success: true,
        message: 'SMS configuration updated successfully',
        data: updatedStatus
      });
    } catch (error) {
      console.error('❌ Error updating SMS configuration:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to update SMS configuration',
          details: error.message,
          code: 'UPDATE_ERROR'
        }
      });
    }
  });

  /**
   * Send test SMS message
   */
  sendTestMessage = asyncHandler(async (req, res) => {
    const { phoneNumber, message } = req.body;

    if (!phoneNumber || !message) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and message are required'
      });
    }

    // Validate phone number format
    if (!smsService.validatePhoneNumber(phoneNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format. Please use Philippine mobile number format (09XXXXXXXXX or +639XXXXXXXXX)'
      });
    }

    try {
      const result = await smsService.sendSMS(phoneNumber, message);
      
      res.status(200).json({
        success: result.success,
        message: result.success ? 'Test SMS sent successfully' : 'Failed to send test SMS',
        details: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error sending test SMS',
        error: error.message
      });
    }
  });

  /**
   * Get SMS statistics
   */
  getStatistics = asyncHandler(async (req, res) => {
    const { startDate, endDate, status } = req.query;

    const filters = {};
    if (startDate) filters.startDate = new Date(startDate);
    if (endDate) filters.endDate = new Date(endDate);
    if (status) filters.status = status;

    try {
      const statistics = await this.smsNotificationModel.getSMSStatistics(filters);
      
      res.status(200).json({
        success: true,
        message: 'SMS statistics retrieved successfully',
        data: statistics
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error retrieving SMS statistics',
        error: error.message
      });
    }
  });

  /**
   * Get SMS notification history
   */
  getHistory = asyncHandler(async (req, res) => {
    const { 
      page = 1, 
      limit = 20, 
      phoneNumber, 
      status 
    } = req.query;

    try {
      const options = {
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit),
        status
      };

      let notifications;
      if (phoneNumber) {
        notifications = await this.smsNotificationModel.getSMSNotificationsByPhoneNumber(
          phoneNumber, 
          options
        );
      } else {
        // Get all SMS notifications with pagination
        // Note: You might want to implement a general method for this in the model
        notifications = [];
      }

      // Calculate total for pagination
      const total = notifications.length; // This is simplified - in production, get actual count
      const totalPages = Math.ceil(total / parseInt(limit));

      res.status(200).json({
        success: true,
        message: 'SMS history retrieved successfully',
        data: {
          data: notifications,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            totalPages
          }
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error retrieving SMS history',
        error: error.message
      });
    }
  });

  /**
   * Test SMS service connectivity
   */
  testService = asyncHandler(async (req, res) => {
    const { testNumber } = req.body;
    
    try {
      const result = await smsService.testService(testNumber);
      
      res.status(200).json({
        success: result.success,
        message: result.message,
        details: result.details
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error testing SMS service',
        error: error.message
      });
    }
  });

  /**
   * Get SMS templates
   */
  getTemplates = asyncHandler(async (req, res) => {
    const templates = smsService.templates;
    
    res.status(200).json({
      success: true,
      message: 'SMS templates retrieved successfully',
      data: templates
    });
  });

  /**
   * Clean up old SMS notifications
   */
  cleanupOldNotifications = asyncHandler(async (req, res) => {
    const { daysOld = 90 } = req.body;

    try {
      const deletedCount = await this.smsNotificationModel.deleteOldSMSNotifications(daysOld);
      
      res.status(200).json({
        success: true,
        message: `Successfully deleted ${deletedCount} old SMS notifications`,
        data: { deletedCount }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error cleaning up old SMS notifications',
        error: error.message
      });
    }
  });
}

module.exports = SMSController;
