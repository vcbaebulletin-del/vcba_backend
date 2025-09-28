const AuditLogModel = require('./src/models/AuditLogModel');
const AuditLogService = require('./src/services/AuditLogService');

async function testAuditModel() {
  console.log('🧪 Testing Audit Log Model...\n');

  try {
    console.log('1. Testing AuditLogModel.createAuditLog directly...');
    
    const testLogData = {
      user_type: 'admin',
      user_id: 31,
      action_type: 'TEST_DIRECT',
      target_table: 'test_table',
      target_id: 1,
      old_values: null,
      new_values: null,
      description: 'Direct test of AuditLogModel',
      ip_address: '127.0.0.1',
      user_agent: 'Test User Agent'
    };

    const directResult = await AuditLogModel.createAuditLog(testLogData);
    console.log('✅ Direct AuditLogModel test successful:', directResult.log_id);

    console.log('\n2. Testing AuditLogService.logAction...');
    
    const serviceResult = await AuditLogService.logAction({
      user_type: 'admin',
      user_id: 31,
      action_type: 'TEST_SERVICE',
      target_table: 'test_table',
      target_id: 2,
      old_values: null,
      new_values: null,
      description: 'Service test of audit logging',
      ip_address: '127.0.0.1',
      user_agent: 'Test User Agent'
    });
    
    console.log('✅ AuditLogService test successful');

    console.log('\n3. Testing with mock request object...');
    
    const mockReq = {
      user: { id: 31, email: 'test@admin.com', role: 'admin' },
      ip: '127.0.0.1',
      get: (header) => header === 'User-Agent' ? 'Mock User Agent' : null
    };

    const mockResult = await AuditLogService.logAction({
      user_type: 'admin',
      user_id: 31,
      action_type: 'TEST_MOCK',
      target_table: 'categories',
      target_id: 2,
      old_values: null,
      new_values: null,
      description: 'Mock request test',
      req: mockReq
    });
    
    console.log('✅ Mock request test successful');

  } catch (error) {
    console.error('❌ Audit model test failed:', error.message);
    console.error('Error details:', error);
    console.error('Stack trace:', error.stack);
  }
}

testAuditModel();
