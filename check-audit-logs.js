const AuditLogService = require('./src/services/AuditLogService');

async function checkAuditLogs() {
  console.log('🔍 Checking Audit Logs...\n');

  try {
    // Check recent audit logs
    console.log('1. Getting recent audit logs...');
    const recentLogs = await AuditLogService.getAuditLogs({}, { page: 1, limit: 10 });
    
    if (recentLogs.data && recentLogs.data.length > 0) {
      console.log('✅ Found recent audit logs:');
      recentLogs.data.forEach((log, index) => {
        console.log(`  ${index + 1}. ${log.action_type} on ${log.target_table} - ${log.description}`);
        console.log(`      User: ${log.user_type} (ID: ${log.user_id}) at ${log.performed_at}`);
      });
    } else {
      console.log('❌ No recent audit logs found');
    }

    // Check specifically for welcome_cards logs
    console.log('\n2. Getting welcome_cards audit logs...');
    const welcomeCardsLogs = await AuditLogService.getAuditLogs(
      { target_table: 'welcome_cards' },
      { page: 1, limit: 5 }
    );
    
    if (welcomeCardsLogs.data && welcomeCardsLogs.data.length > 0) {
      console.log('✅ Found welcome_cards audit logs:');
      welcomeCardsLogs.data.forEach((log, index) => {
        console.log(`  ${index + 1}. ${log.action_type} - ${log.description} (${log.performed_at})`);
      });
    } else {
      console.log('❌ No welcome_cards audit logs found');
    }

    // Check specifically for carousel_images logs
    console.log('\n3. Getting carousel_images audit logs...');
    const carouselLogs = await AuditLogService.getAuditLogs(
      { target_table: 'carousel_images' },
      { page: 1, limit: 5 }
    );
    
    if (carouselLogs.data && carouselLogs.data.length > 0) {
      console.log('✅ Found carousel_images audit logs:');
      carouselLogs.data.forEach((log, index) => {
        console.log(`  ${index + 1}. ${log.action_type} - ${log.description} (${log.performed_at})`);
      });
    } else {
      console.log('❌ No carousel_images audit logs found');
    }

    // Get audit log statistics
    console.log('\n4. Getting audit log statistics...');
    const stats = await AuditLogService.getAuditLogStats({});
    console.log('Audit log statistics:', stats);

  } catch (error) {
    console.error('❌ Error checking audit logs:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

checkAuditLogs();
