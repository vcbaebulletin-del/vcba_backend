const mysql = require('mysql2/promise');
require('dotenv').config();

async function initializeSMSConfig() {
  let connection;
  
  try {
    console.log('🔧 Initializing SMS Configuration Database...\n');
    
    // Create database connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'vcba_bulletin_board'
    });
    
    console.log('✅ Connected to database');
    
    // Create SMS config table
    await connection.execute(`
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
    
    console.log('✅ SMS config table created/verified');
    
    // Check if configuration already exists
    const [existing] = await connection.execute('SELECT COUNT(*) as count FROM sms_config');
    
    if (existing[0].count === 0) {
      // Insert default configuration with the original credentials
      await connection.execute(`
        INSERT INTO sms_config 
        (api_key, device_id, base_url, is_enabled, rate_limit_per_minute) 
        VALUES (?, ?, ?, ?, ?)
      `, [
        '8b8f9e20-0f2b-4949-b8a6-877f56e0b399', // Original API key
        '68c85987c27bd0d0b9608142',             // Original device ID
        'https://api.textbee.dev/api/v1',       // Base URL
        true,                                   // Enabled
        60                                      // Rate limit
      ]);
      
      console.log('✅ Default SMS configuration inserted');
      console.log('   - API Key: 8b8f9e20-0f2b-4949-b8a6-877f56e0b399');
      console.log('   - Device ID: 68c85987c27bd0d0b9608142');
      console.log('   - Base URL: https://api.textbee.dev/api/v1');
      console.log('   - Enabled: true');
      console.log('   - Rate Limit: 60 per minute');
    } else {
      console.log('✅ SMS configuration already exists in database');
      
      // Show current configuration
      const [config] = await connection.execute('SELECT * FROM sms_config ORDER BY id DESC LIMIT 1');
      if (config.length > 0) {
        const current = config[0];
        console.log('   Current configuration:');
        console.log(`   - API Key: ${current.api_key.substring(0, 8)}...`);
        console.log(`   - Device ID: ${current.device_id.substring(0, 8)}...`);
        console.log(`   - Base URL: ${current.base_url}`);
        console.log(`   - Enabled: ${current.is_enabled}`);
        console.log(`   - Rate Limit: ${current.rate_limit_per_minute} per minute`);
      }
    }
    
    console.log('\n🎉 SMS Configuration Database Initialization Complete!');
    console.log('💡 You can now manage SMS settings through the web interface.');
    
  } catch (error) {
    console.error('❌ Error initializing SMS configuration:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

initializeSMSConfig();
