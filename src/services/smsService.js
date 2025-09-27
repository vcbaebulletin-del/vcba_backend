const axios = require('axios');
const logger = require('../utils/logger');
const SMSConfigModel = require('../models/SMSConfigModel');

class SMSService {
  constructor() {
    // Initialize with default values - will be loaded from database
    this.baseURL = 'https://api.textbee.dev/api/v1';
    this.apiKey = '';
    this.deviceId = '';
    this.isEnabled = true;
    this.rateLimitPerMinute = 60;

    // Rate limiting
    this.sentMessages = new Map(); // Track sent messages for rate limiting

    // Load configuration from database
    this.loadConfigFromDatabase();
    
    // Message templates
    this.templates = {
      announcement_alert: {
        title: '🚨 VCBA Alert Announcement',
        template: 'VCBA ALERT: {title}\n\n{content}\n\nPosted: {date}\nGrade: {grade_level}\n\nVCBA E-Bulletin Board'
      },
      calendar_alert: {
        title: '📅 VCBA Calendar Alert',
        template: 'VCBA CALENDAR ALERT: {title}\n\n{description}\n\nDate: {event_date}\n\nVCBA E-Bulletin Board'
      }
    };
  }

  /**
   * Load configuration from database
   */
  async loadConfigFromDatabase() {
    try {
      // Initialize table if it doesn't exist
      await SMSConfigModel.initializeTable();

      // Load configuration
      const config = await SMSConfigModel.getConfig();

      if (config) {
        this.apiKey = config.api_key || '';
        this.deviceId = config.device_id || '';
        this.baseURL = config.base_url || 'https://api.textbee.dev/api/v1';

        // Fix data corruption: ensure isEnabled is always a boolean
        if (typeof config.is_enabled === 'boolean') {
          this.isEnabled = config.is_enabled;
        } else if (typeof config.is_enabled === 'string') {
          // Handle corrupted data where is_enabled contains device_id
          console.log('⚠️ Detected corrupted is_enabled field, fixing...');
          this.isEnabled = true; // Default to enabled
          // Fix the database immediately
          this.fixCorruptedData();
        } else {
          this.isEnabled = config.is_enabled !== undefined ? Boolean(config.is_enabled) : true;
        }

        this.rateLimitPerMinute = config.rate_limit_per_minute || 60;

        console.log('✅ SMS configuration loaded from database', {
          isEnabled: this.isEnabled,
          isEnabledType: typeof this.isEnabled,
          originalValue: config.is_enabled,
          originalType: typeof config.is_enabled
        });
      } else {
        console.log('⚠️ No SMS configuration found in database, using defaults');
      }
    } catch (error) {
      console.error('❌ Error loading SMS configuration from database:', error);
      // Continue with default values if database load fails
    }
  }

  /**
   * Update configuration in database and reload
   */
  async updateConfigInDatabase(config) {
    try {
      console.log('📝 Updating SMS configuration in database...');
      console.log('Config data:', {
        apiKey: config.apiKey ? config.apiKey.substring(0, 8) + '...' : 'Not provided',
        deviceId: config.deviceId ? config.deviceId.substring(0, 8) + '...' : 'Not provided',
        baseURL: config.baseURL,
        isEnabled: config.isEnabled,
        rateLimitPerMinute: config.rateLimitPerMinute
      });

      await SMSConfigModel.updateConfig(config);
      console.log('✅ Database update completed, reloading configuration...');

      await this.loadConfigFromDatabase(); // Reload from database
      console.log('✅ SMS configuration updated and reloaded successfully');
    } catch (error) {
      console.error('❌ Error updating SMS configuration in database:', error);
      console.error('Error stack:', error.stack);
      throw new Error(`Failed to update SMS configuration: ${error.message}`);
    }
  }

  /**
   * Fix corrupted database data
   */
  async fixCorruptedData() {
    try {
      console.log('🔧 Fixing corrupted SMS configuration data...');

      // Get current config to preserve other values
      const currentConfig = await SMSConfigModel.getConfig();

      // Update with corrected boolean value
      await SMSConfigModel.updateConfig({
        apiKey: currentConfig.api_key,
        deviceId: currentConfig.device_id,
        baseURL: currentConfig.base_url,
        isEnabled: true, // Fix the corrupted boolean
        rateLimitPerMinute: currentConfig.rate_limit_per_minute
      });

      console.log('✅ Corrupted data fixed successfully');
    } catch (error) {
      console.error('❌ Error fixing corrupted data:', error);
    }
  }

  /**
   * Check if SMS service is enabled
   */
  isServiceEnabled() {
    // Ensure configuration is loaded
    if (!this.apiKey || !this.deviceId) {
      // Try to load from defaults if not loaded
      if (!this.apiKey) this.apiKey = '8b8f9e20-0f2b-4949-b8a6-877f56e0b399';
      if (!this.deviceId) this.deviceId = '68c85987c27bd0d0b9608142';
    }
    return this.isEnabled && this.apiKey && this.deviceId;
  }

  /**
   * Validate phone number format
   * @param {string} phoneNumber - Phone number to validate
   * @returns {boolean} - True if valid
   */
  validatePhoneNumber(phoneNumber) {
    if (!phoneNumber) return false;

    // Remove all non-digit characters
    const cleaned = phoneNumber.replace(/\D/g, '');

    // Check if it's a valid Philippine mobile number
    // Philippine mobile numbers: 09XXXXXXXXX (11 digits) or +639XXXXXXXXX (13 digits with country code)
    if (cleaned.length === 11 && cleaned.startsWith('09')) {
      return true;
    }
    if (cleaned.length === 13 && cleaned.startsWith('639')) {
      return true;
    }
    if (cleaned.length === 12 && cleaned.startsWith('63')) {
      return true;
    }

    return false;
  }

  /**
   * Format phone number for SMS sending
   * @param {string} phoneNumber - Raw phone number
   * @returns {string} - Formatted phone number with country code
   */
  formatPhoneNumber(phoneNumber) {
    if (!phoneNumber) return null;
    
    const cleaned = phoneNumber.replace(/\D/g, '');
    
    // Convert to international format
    if (cleaned.length === 11 && cleaned.startsWith('09')) {
      return '+63' + cleaned.substring(1); // Remove leading 0, add +63
    }
    if (cleaned.length === 13 && cleaned.startsWith('639')) {
      return '+' + cleaned; // Add + prefix
    }
    if (cleaned.length === 12 && cleaned.startsWith('63')) {
      return '+' + cleaned; // Add + prefix
    }
    
    return phoneNumber; // Return as-is if format is unclear
  }

  /**
   * Check rate limiting for phone number
   * @param {string} phoneNumber - Phone number to check
   * @returns {boolean} - True if within rate limit
   */
  checkRateLimit(phoneNumber) {
    const now = Date.now();
    const oneMinute = 60 * 1000;
    
    if (!this.sentMessages.has(phoneNumber)) {
      this.sentMessages.set(phoneNumber, []);
    }
    
    const messages = this.sentMessages.get(phoneNumber);
    
    // Remove messages older than 1 minute
    const recentMessages = messages.filter(timestamp => now - timestamp < oneMinute);
    this.sentMessages.set(phoneNumber, recentMessages);
    
    return recentMessages.length < this.rateLimitPerMinute;
  }

  /**
   * Record sent message for rate limiting
   * @param {string} phoneNumber - Phone number
   */
  recordSentMessage(phoneNumber) {
    if (!this.sentMessages.has(phoneNumber)) {
      this.sentMessages.set(phoneNumber, []);
    }
    this.sentMessages.get(phoneNumber).push(Date.now());
  }

  /**
   * Send SMS using TextBee API
   * @param {string|Array} recipients - Phone number(s) to send to
   * @param {string} message - Message content
   * @returns {Promise<Object>} - API response
   */
  async sendSMS(recipients, message) {
    if (!this.isServiceEnabled()) {
      logger.warn('SMS service is disabled or not configured');
      return {
        success: false,
        error: 'SMS service is disabled or not configured',
        sent: 0,
        failed: 0
      };
    }

    try {
      // Ensure recipients is an array
      const recipientList = Array.isArray(recipients) ? recipients : [recipients];
      
      // Validate and format phone numbers
      const validRecipients = [];
      const invalidRecipients = [];
      
      for (const recipient of recipientList) {
        if (this.validatePhoneNumber(recipient)) {
          const formatted = this.formatPhoneNumber(recipient);
          if (this.checkRateLimit(formatted)) {
            validRecipients.push(formatted);
          } else {
            logger.warn(`Rate limit exceeded for ${formatted}`);
            invalidRecipients.push({ number: recipient, reason: 'Rate limit exceeded' });
          }
        } else {
          logger.warn(`Invalid phone number format: ${recipient}`);
          invalidRecipients.push({ number: recipient, reason: 'Invalid format' });
        }
      }

      if (validRecipients.length === 0) {
        return {
          success: false,
          error: 'No valid recipients',
          sent: 0,
          failed: recipientList.length,
          invalidRecipients
        };
      }

      // Prepare API request
      const requestData = {
        recipients: validRecipients,
        message: message.substring(0, 1600) // Limit message length
      };

      logger.info(`Sending SMS to ${validRecipients.length} recipients via TextBee`, {
        recipientCount: validRecipients.length,
        messageLength: message.length,
        endpoint: `${this.baseURL}/gateway/devices/${this.deviceId}/send-sms`,
        hasApiKey: !!this.apiKey,
        apiKeyLength: this.apiKey ? this.apiKey.length : 0,
        deviceIdLength: this.deviceId ? this.deviceId.length : 0
      });

      // Send SMS via TextBee API
      const response = await axios.post(
        `${this.baseURL}/gateway/devices/${this.deviceId}/send-sms`,
        requestData,
        {
          headers: {
            'x-api-key': this.apiKey,
            'Content-Type': 'application/json'
          },
          timeout: 30000 // 30 second timeout
        }
      );

      // Record sent messages for rate limiting
      validRecipients.forEach(recipient => {
        this.recordSentMessage(recipient);
      });

      logger.info('SMS sent successfully via TextBee', {
        recipientCount: validRecipients.length,
        response: response.data
      });

      return {
        success: true,
        sent: validRecipients.length,
        failed: invalidRecipients.length,
        invalidRecipients,
        apiResponse: response.data
      };

    } catch (error) {
      logger.error('Failed to send SMS via TextBee', {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status,
        statusText: error.response?.statusText,
        endpoint: `${this.baseURL}/gateway/devices/${this.deviceId}/send-sms`,
        requestData: {
          ...requestData,
          // Don't log the actual message content for privacy
          message: `[${requestData.message?.length || 0} characters]`
        },
        headers: {
          hasApiKey: !!this.apiKey,
          apiKeyPrefix: this.apiKey ? this.apiKey.substring(0, 8) + '...' : 'Not set',
          contentType: 'application/json'
        },
        axiosConfig: {
          timeout: 30000,
          method: 'POST'
        },
        networkError: error.code,
        isNetworkError: error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT'
      });

      return {
        success: false,
        error: error.message,
        sent: 0,
        failed: Array.isArray(recipients) ? recipients.length : 1,
        apiError: error.response?.data,
        networkError: error.code,
        statusCode: error.response?.status
      };
    }
  }

  /**
   * Send announcement alert SMS
   * @param {Object} announcement - Announcement data
   * @param {Array} recipients - Array of phone numbers
   * @returns {Promise<Object>} - Send result
   */
  async sendAnnouncementAlert(announcement, recipients) {
    console.log('📱 sendAnnouncementAlert called with:', {
      announcementTitle: announcement.title,
      recipientCount: recipients ? recipients.length : 0,
      recipients: recipients ? recipients.map(r => r.substring(0, 6) + '...') : [],
      isServiceEnabled: this.isServiceEnabled(),
      hasTemplate: !!this.templates.announcement_alert
    });

    if (!this.isServiceEnabled()) {
      console.log('❌ SMS service is not enabled for announcement alerts');
      return {
        success: false,
        error: 'SMS service is not enabled',
        sent: 0,
        failed: recipients ? recipients.length : 0
      };
    }

    const template = this.templates.announcement_alert;

    const message = template.template
      .replace('{title}', announcement.title || 'New Announcement')
      .replace('{content}', (announcement.content || '').substring(0, 300) + (announcement.content?.length > 300 ? '...' : ''))
      .replace('{date}', new Date(announcement.created_at || Date.now()).toLocaleDateString('en-PH'))
      .replace('{grade_level}', announcement.grade_level ? `Grade ${announcement.grade_level}` : 'All Grades');

    console.log('📱 Generated SMS message:', {
      messageLength: message.length,
      messagePreview: message.substring(0, 100) + '...'
    });

    const result = await this.sendSMS(recipients, message);
    console.log('📱 sendAnnouncementAlert result:', result);

    return result;
  }

  /**
   * Send calendar event alert SMS
   * @param {Object} event - Calendar event data
   * @param {Array} recipients - Array of phone numbers
   * @returns {Promise<Object>} - Send result
   */
  async sendCalendarAlert(event, recipients) {
    console.log('📅 sendCalendarAlert called with:', {
      eventTitle: event.title,
      recipientCount: recipients ? recipients.length : 0,
      recipients: recipients ? recipients.map(r => r.substring(0, 6) + '...') : [],
      isServiceEnabled: this.isServiceEnabled(),
      hasTemplate: !!this.templates.calendar_alert
    });

    if (!this.isServiceEnabled()) {
      console.log('❌ SMS service is not enabled for calendar alerts');
      return {
        success: false,
        error: 'SMS service is not enabled',
        sent: 0,
        failed: recipients ? recipients.length : 0
      };
    }

    const template = this.templates.calendar_alert;

    const message = template.template
      .replace('{title}', event.title || 'New Event')
      .replace('{description}', (event.description || '').substring(0, 300) + (event.description?.length > 300 ? '...' : ''))
      .replace('{event_date}', new Date(event.event_date || Date.now()).toLocaleDateString('en-PH'));

    console.log('📅 Generated SMS message:', {
      messageLength: message.length,
      messagePreview: message.substring(0, 100) + '...'
    });

    const result = await this.sendSMS(recipients, message);
    console.log('📅 sendCalendarAlert result:', result);

    return result;
  }

  /**
   * Test SMS service connectivity
   * @param {string} testNumber - Test phone number
   * @returns {Promise<Object>} - Test result
   */
  async testService(testNumber = '+639123456789') {
    const testMessage = 'VCBA SMS Test - Service is working correctly!';
    
    try {
      const result = await this.sendSMS(testNumber, testMessage);
      return {
        success: result.success,
        message: result.success ? 'SMS service test successful' : 'SMS service test failed',
        details: result
      };
    } catch (error) {
      return {
        success: false,
        message: 'SMS service test failed',
        error: error.message
      };
    }
  }

  /**
   * Get service status and configuration
   * @returns {Object} - Service status
   */
  getServiceStatus() {
    console.log('🔍 Debug SMS Service State:', {
      isEnabled: this.isEnabled,
      isEnabledType: typeof this.isEnabled,
      apiKey: this.apiKey ? `${this.apiKey.substring(0, 8)}...` : 'Not configured',
      deviceId: this.deviceId ? `${this.deviceId.substring(0, 8)}...` : 'Not configured',
      rateLimitPerMinute: this.rateLimitPerMinute,
      baseURL: this.baseURL,
      isServiceEnabled: this.isServiceEnabled()
    });

    const status = {
      enabled: Boolean(this.isEnabled), // Ensure it's always a boolean
      apiKey: this.apiKey ? `${this.apiKey.substring(0, 8)}...` : 'Not configured',
      deviceId: this.deviceId ? `${this.deviceId.substring(0, 8)}...` : 'Not configured',
      rateLimitPerMinute: this.rateLimitPerMinute,
      baseURL: this.baseURL
    };

    console.log('📤 Returning status:', status);
    return status;
  }

  /**
   * Get full configuration for editing (unmasked values)
   * @returns {Object} - Full configuration with unmasked values
   */
  getFullConfiguration() {
    console.log('🔍 Getting full configuration for editing');

    const config = {
      enabled: this.isServiceEnabled(),
      apiKey: this.apiKey || '8b8f9e20-0f2b-4949-b8a6-877f56e0b399', // Default value
      deviceId: this.deviceId || '68c85987c27bd0d0b9608142', // Default value
      rateLimitPerMinute: this.rateLimitPerMinute || 60,
      baseURL: this.baseURL || 'https://api.textbee.dev/api/v1'
    };

    console.log('📤 Returning full config:', {
      ...config,
      apiKey: config.apiKey ? `${config.apiKey.substring(0, 8)}...` : 'Not set',
      deviceId: config.deviceId ? `${config.deviceId.substring(0, 8)}...` : 'Not set'
    });

    return config;
  }
}

module.exports = new SMSService();
