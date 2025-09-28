const AuditLogModel = require('./src/models/AuditLogModel');

async function testAuditLogsFix() {
  console.log('🧪 Testing Audit Logs Database Fix...');
  
  try {
    // Test the getAuditLogs method that was failing
    console.log('📋 Testing getAuditLogs method...');
    
    const filters = {
      user_type: null,
      user_id: null,
      action_type: null,
      start_date: null,
      end_date: null,
      search: null,
      severity: null
    };
    
    const pagination = {
      page: 1,
      limit: 20,
      sort_by: 'performed_at',
      sort_order: 'DESC'
    };
    
    const result = await AuditLogModel.getAuditLogs(filters, pagination);
    
    console.log('✅ SUCCESS: getAuditLogs method works!');
    console.log('📊 Result:', {
      totalRecords: result.totalRecords,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
      logsCount: result.logs.length
    });
    
    if (result.logs.length > 0) {
      console.log('📝 Sample log:', {
        log_id: result.logs[0].log_id,
        action_type: result.logs[0].action_type,
        user_type: result.logs[0].user_type,
        performed_at: result.logs[0].performed_at
      });
    }
    
    console.log('🎉 Database fix is working correctly!');
    
  } catch (error) {
    console.error('❌ ERROR: Database fix failed');
    console.error('Error details:', error.message);
    console.error('Stack trace:', error.stack);
  }
  
  process.exit(0);
}

testAuditLogsFix();
