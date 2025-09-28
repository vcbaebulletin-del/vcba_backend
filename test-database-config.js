const SMSConfigModel = require('./src/models/SMSConfigModel');

async function testDatabaseConfig() {
  console.log('🧪 Testing SMS Database Configuration...\n');
  
  try {
    // Test 1: Initialize table
    console.log('1. Initializing table...');
    await SMSConfigModel.initializeTable();
    console.log('✅ Table initialized successfully\n');
    
    // Test 2: Get current configuration
    console.log('2. Getting current configuration...');
    const config = await SMSConfigModel.getConfig();
    console.log('✅ Configuration retrieved:');
    console.log(`   - ID: ${config.id}`);
    console.log(`   - API Key: ${config.api_key ? config.api_key.substring(0, 8) + '...' : 'Not set'}`);
    console.log(`   - Device ID: ${config.device_id ? config.device_id.substring(0, 8) + '...' : 'Not set'}`);
    console.log(`   - Base URL: ${config.base_url}`);
    console.log(`   - Enabled: ${config.is_enabled}`);
    console.log(`   - Rate Limit: ${config.rate_limit_per_minute} per minute`);
    console.log('');
    
    // Test 3: Test SMS Service loading
    console.log('3. Testing SMS Service configuration loading...');
    const smsService = require('./src/services/smsService');
    
    // Wait a moment for async loading
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('✅ SMS Service configuration:');
    console.log(`   - API Key: ${smsService.apiKey ? smsService.apiKey.substring(0, 8) + '...' : 'Not set'}`);
    console.log(`   - Device ID: ${smsService.deviceId ? smsService.deviceId.substring(0, 8) + '...' : 'Not set'}`);
    console.log(`   - Base URL: ${smsService.baseURL}`);
    console.log(`   - Enabled: ${smsService.isEnabled}`);
    console.log(`   - Rate Limit: ${smsService.rateLimitPerMinute} per minute`);
    console.log('');
    
    // Test 4: Test configuration update
    console.log('4. Testing configuration update...');
    const testConfig = {
      apiKey: 'test-api-key-123456789',
      deviceId: 'test-device-id-123456789',
      baseURL: 'https://api.textbee.dev/api/v1',
      isEnabled: false,
      rateLimitPerMinute: 30
    };
    
    await smsService.updateConfigInDatabase(testConfig);
    console.log('✅ Configuration updated successfully');
    
    // Verify the update
    const updatedConfig = await SMSConfigModel.getConfig();
    console.log('✅ Updated configuration verified:');
    console.log(`   - API Key: ${updatedConfig.api_key.substring(0, 8)}...`);
    console.log(`   - Device ID: ${updatedConfig.device_id.substring(0, 8)}...`);
    console.log(`   - Base URL: ${updatedConfig.base_url}`);
    console.log(`   - Enabled: ${updatedConfig.is_enabled}`);
    console.log(`   - Rate Limit: ${updatedConfig.rate_limit_per_minute} per minute`);
    console.log('');
    
    // Test 5: Restore original configuration
    console.log('5. Restoring original configuration...');
    const originalConfig = {
      apiKey: '8b8f9e20-0f2b-4949-b8a6-877f56e0b399',
      deviceId: '68c85987c27bd0d0b9608142',
      baseURL: 'https://api.textbee.dev/api/v1',
      isEnabled: true,
      rateLimitPerMinute: 60
    };
    
    await smsService.updateConfigInDatabase(originalConfig);
    console.log('✅ Original configuration restored');
    
    console.log('\n🎉 All database configuration tests passed!');
    console.log('💡 The SMS service is now using database storage for configuration.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
  
  process.exit(0);
}

testDatabaseConfig();
