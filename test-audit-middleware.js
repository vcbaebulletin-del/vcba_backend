const { auditContentAction } = require('./src/middleware/auditLogger');
const AuditLogService = require('./src/services/AuditLogService');

// Mock Express request and response objects
function createMockReq(method = 'POST', path = '/api/welcome-page/admin/cards', user = null, params = {}, body = {}) {
  return {
    method,
    path,
    user: user || {
      id: 31,
      email: 'test@admin.com',
      role: 'admin'
    },
    params,
    body,
    ip: '127.0.0.1',
    get: (header) => header === 'User-Agent' ? 'Test User Agent' : null
  };
}

function createMockRes() {
  const res = {
    statusCode: 200,
    json: function(data) {
      console.log('Response data:', data);
      return data;
    }
  };
  return res;
}

async function testAuditMiddleware() {
  console.log('🧪 Testing Audit Middleware Directly...\n');

  try {
    console.log('1. Testing CREATE audit for welcome_cards...');
    
    // Create mock request and response
    const req = createMockReq('POST', '/api/welcome-page/admin/cards', null, { id: 123 }, {
      title: 'Test Card',
      description: 'Test Description'
    });
    
    const res = createMockRes();
    
    // Create the audit middleware
    const auditMiddleware = auditContentAction('CREATE', 'welcome_cards');
    
    // Mock next function
    const next = () => {
      console.log('✅ Middleware next() called');
    };
    
    // Execute the middleware
    await auditMiddleware(req, res, next);
    
    // Simulate successful response
    res.json({
      success: true,
      message: 'Card created successfully',
      data: { id: 123, title: 'Test Card' }
    });
    
    // Wait a bit for async audit logging
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('✅ CREATE audit test completed');

    console.log('\n2. Testing REORDER audit for welcome_cards...');
    
    const reorderReq = createMockReq('PUT', '/api/welcome-page/admin/cards/reorder', null, {}, {
      cardOrders: [{ id: 1, order_index: 0 }, { id: 2, order_index: 1 }]
    });
    
    const reorderRes = createMockRes();
    const reorderAuditMiddleware = auditContentAction('REORDER', 'welcome_cards');
    
    await reorderAuditMiddleware(reorderReq, reorderRes, next);
    
    reorderRes.json({
      success: true,
      message: 'Cards reordered successfully',
      data: { reordered: 2 }
    });
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('✅ REORDER audit test completed');

    console.log('\n3. Checking recent audit logs...');
    
    const recentLogs = await AuditLogService.getAuditLogs(
      { target_table: 'welcome_cards' },
      { page: 1, limit: 10 }
    );
    
    if (recentLogs.data && recentLogs.data.length > 0) {
      console.log('✅ Found recent audit logs for welcome_cards:');
      recentLogs.data.forEach((log, index) => {
        console.log(`  ${index + 1}. ${log.action_type} - ${log.description} (${log.performed_at})`);
      });
    } else {
      console.log('❌ No recent audit logs found for welcome_cards');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

testAuditMiddleware();
