const axios = require('axios');

const API_BASE_URL = 'http://localhost:5000';

async function debugAuditMiddleware() {
  console.log('🔍 Debugging Audit Middleware...\n');

  try {
    // Test a simple reorder operation and check if audit logs are created
    console.log('1. Performing card reorder operation...');
    
    const reorderData = {
      cardOrders: [
        { id: 1, order_index: 0 },
        { id: 2, order_index: 1 },
        { id: 3, order_index: 2 }
      ]
    };

    const reorderResponse = await axios.put(
      `${API_BASE_URL}/api/welcome-page/admin/cards/reorder`,
      reorderData
    );

    console.log('Reorder response:', reorderResponse.data);
    
    if (reorderResponse.data.success) {
      console.log('✅ Card reordering successful');
      
      // Wait for audit logging to complete
      console.log('\n2. Waiting for audit logging...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Check if audit log was created
      console.log('\n3. Checking for new audit logs...');
      
      // Use direct database query to check for recent logs
      const AuditLogService = require('./src/services/AuditLogService');
      
      const recentLogs = await AuditLogService.getAuditLogs(
        {},
        { page: 1, limit: 5 }
      );
      
      if (recentLogs.data && recentLogs.data.length > 0) {
        console.log('✅ Recent audit logs found:');
        recentLogs.data.forEach((log, index) => {
          const logTime = new Date(log.performed_at);
          const now = new Date();
          const timeDiff = (now - logTime) / 1000; // seconds
          
          console.log(`  ${index + 1}. ${log.action_type} on ${log.target_table} - ${log.description}`);
          console.log(`      Time: ${log.performed_at} (${timeDiff.toFixed(1)}s ago)`);
          
          // Check if this log was created in the last 10 seconds
          if (timeDiff < 10 && log.target_table === 'welcome_cards' && log.action_type === 'REORDER') {
            console.log('      🎯 This looks like our reorder operation!');
          }
        });
      } else {
        console.log('❌ No recent audit logs found');
      }
    }

  } catch (error) {
    console.error('❌ Debug failed:', error.response?.data || error.message);
  }
}

debugAuditMiddleware();
