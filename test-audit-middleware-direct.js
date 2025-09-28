// Test the audit middleware directly without going through the routes
const { auditContentAction } = require('./src/middleware/auditLogger');

async function testAuditMiddlewareDirect() {
  console.log('🧪 Testing Audit Middleware Direct Import...\n');

  try {
    console.log('1. Testing if auditContentAction is available...');
    console.log('auditContentAction type:', typeof auditContentAction);
    console.log('auditContentAction available:', !!auditContentAction);

    if (auditContentAction) {
      console.log('✅ auditContentAction is available');
      
      // Test creating the middleware
      console.log('\n2. Creating audit middleware...');
      const middleware = auditContentAction('REORDER', 'welcome_cards');
      console.log('Middleware type:', typeof middleware);
      console.log('Middleware available:', !!middleware);
      
      if (typeof middleware === 'function') {
        console.log('✅ Audit middleware function created successfully');
        
        // Test the middleware with mock objects
        console.log('\n3. Testing middleware with mock objects...');
        
        const mockReq = {
          method: 'PUT',
          path: '/api/welcome-page/admin/cards/reorder',
          user: { id: 31, email: 'test@admin.com', role: 'admin' },
          body: { cardOrders: [{ id: 1, order_index: 0 }] },
          ip: '127.0.0.1',
          get: (header) => header === 'User-Agent' ? 'Test User Agent' : null
        };
        
        const mockRes = {
          statusCode: 200,
          json: function(data) {
            console.log('Mock response data:', data);
            return data;
          }
        };
        
        const mockNext = () => {
          console.log('Mock next() called');
        };
        
        // Execute the middleware
        await middleware(mockReq, mockRes, mockNext);
        
        // Simulate successful response
        mockRes.json({
          success: true,
          message: 'Cards reordered successfully',
          data: { reordered: true, count: 1 }
        });
        
        // Wait for async audit logging
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log('✅ Middleware test completed');
        
        // Check if audit log was created
        console.log('\n4. Checking for audit log...');
        const AuditLogService = require('./src/services/AuditLogService');
        const recentLogs = await AuditLogService.getAuditLogs({}, { page: 1, limit: 3 });
        
        if (recentLogs.data && recentLogs.data.length > 0) {
          console.log('Recent audit logs:');
          recentLogs.data.forEach((log, index) => {
            console.log(`  ${index + 1}. ${log.action_type} on ${log.target_table} - ${log.description}`);
          });
        }
        
      } else {
        console.log('❌ Audit middleware is not a function');
      }
    } else {
      console.log('❌ auditContentAction is not available');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

testAuditMiddlewareDirect();
