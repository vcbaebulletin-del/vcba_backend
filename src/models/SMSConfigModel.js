const BaseModel = require('./BaseModel');

class SMSConfigModel extends BaseModel {
  constructor() {
    super('sms_config');
  }

  /**
   * Get SMS configuration (there should only be one record)
   */
  async getConfig() {
    try {
      const rows = await this.db.findAll('SELECT * FROM sms_config ORDER BY id DESC LIMIT 1');

      if (!rows || rows.length === 0) {
        // Return default configuration if none exists
        return {
          id: null,
          api_key: '8b8f9e20-0f2b-4949-b8a6-877f56e0b399', // Default from original code
          device_id: '68c85987c27bd0d0b9608142', // Default from original code
          base_url: 'https://api.textbee.dev/api/v1',
          is_enabled: true,
          rate_limit_per_minute: 60,
          created_at: null,
          updated_at: null
        };
      }

      return rows[0];
    } catch (error) {
      console.error('Error getting SMS config:', error);
      throw error;
    }
  }

  /**
   * Update or create SMS configuration
   */
  async updateConfig(config) {
    try {
      const existingConfig = await this.getConfig();

      if (existingConfig.id) {
        // Update existing configuration
        const result = await this.db.execute(
          `UPDATE sms_config SET
           api_key = ?,
           device_id = ?,
           base_url = ?,
           is_enabled = ?,
           rate_limit_per_minute = ?,
           updated_at = NOW()
           WHERE id = ?`,
          [
            config.api_key || config.apiKey,
            config.device_id || config.deviceId,
            config.base_url || config.baseURL,
            config.is_enabled !== undefined ? config.is_enabled : config.isEnabled,
            config.rate_limit_per_minute || config.rateLimitPerMinute,
            existingConfig.id
          ]
        );
        console.log('✅ SMS configuration updated successfully');
        return result;
      } else {
        // Create new configuration
        const result = await this.db.execute(
          `INSERT INTO sms_config
           (api_key, device_id, base_url, is_enabled, rate_limit_per_minute, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            config.api_key || config.apiKey,
            config.device_id || config.deviceId,
            config.base_url || config.baseURL,
            config.is_enabled !== undefined ? config.is_enabled : config.isEnabled,
            config.rate_limit_per_minute || config.rateLimitPerMinute
          ]
        );
        console.log('✅ SMS configuration created successfully');
        return result;
      }
    } catch (error) {
      console.error('❌ Error updating SMS config:', error);
      console.error('Config data:', config);
      throw error;
    }
  }

  /**
   * Initialize SMS config table if it doesn't exist
   */
  async initializeTable() {
    try {
      await this.db.execute(`
        CREATE TABLE IF NOT EXISTS sms_config (
          id INT PRIMARY KEY AUTO_INCREMENT,
          api_key VARCHAR(255) NOT NULL,
          device_id VARCHAR(255) NOT NULL,
          base_url VARCHAR(255) NOT NULL DEFAULT 'https://api.textbee.dev/api/v1',
          is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
          rate_limit_per_minute INT NOT NULL DEFAULT 60,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);

      console.log('✅ SMS config table initialized');
    } catch (error) {
      console.error('❌ Error initializing SMS config table:', error);
      throw error;
    }
  }
}

module.exports = new SMSConfigModel();
