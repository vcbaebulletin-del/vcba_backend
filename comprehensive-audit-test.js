const axios = require('axios');

const API_BASE_URL = 'http://localhost:5000';

async function comprehensiveAuditTest() {
  console.log('🧪 Comprehensive Welcome Page Audit Test...\n');

  try {
    // Get current timestamp for comparison
    const testStartTime = new Date();
    console.log('Test started at:', testStartTime.toISOString());

    // Test 1: Card reordering
    console.log('\n1. Testing card reordering...');
    const reorderResponse = await axios.put(`${API_BASE_URL}/api/welcome-page/admin/cards/reorder`, {
      cardOrders: [
        { id: 1, order_index: 0 },
        { id: 2, order_index: 1 }
      ]
    });
    console.log('Reorder response:', reorderResponse.data.success ? '✅ Success' : '❌ Failed');

    // Test 2: Card status toggle
    console.log('\n2. Testing card status toggle...');
    const toggleResponse = await axios.put(`${API_BASE_URL}/api/welcome-page/admin/cards/1/toggle`);
    console.log('Toggle response:', toggleResponse.data.success ? '✅ Success' : '❌ Failed');

    // Test 3: Carousel reordering
    console.log('\n3. Testing carousel reordering...');
    try {
      const carouselResponse = await axios.put(`${API_BASE_URL}/api/welcome-page/admin/carousel/reorder`, {
        imageOrders: [
          { id: 1, order_index: 0 },
          { id: 2, order_index: 1 }
        ]
      });
      console.log('Carousel reorder response:', carouselResponse.data.success ? '✅ Success' : '❌ Failed');
    } catch (error) {
      console.log('Carousel reorder failed:', error.response?.data?.message || error.message);
    }

    // Wait for audit logs to be written
    console.log('\n4. Waiting for audit logs to be written...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check for new audit logs
    console.log('\n5. Checking for new audit logs...');
    const mysql = require('mysql2/promise');
    
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'db_ebulletin_system'
    });

    // Get audit logs created after test start time
    const [rows] = await connection.execute(`
      SELECT log_id, action_type, target_table, description, performed_at
      FROM audit_logs 
      WHERE performed_at >= ?
      ORDER BY performed_at DESC
    `, [testStartTime]);

    if (rows.length > 0) {
      console.log('✅ Found new audit logs created during test:');
      rows.forEach((log, index) => {
        console.log(`  ${index + 1}. ${log.action_type} on ${log.target_table}`);
        console.log(`     Description: ${log.description}`);
        console.log(`     Time: ${log.performed_at}`);
        console.log('');
      });
    } else {
      console.log('❌ No new audit logs found during test period');
      
      // Check the most recent audit logs to see what's happening
      const [recentRows] = await connection.execute(`
        SELECT log_id, action_type, target_table, description, performed_at
        FROM audit_logs 
        ORDER BY performed_at DESC
        LIMIT 3
      `);
      
      console.log('\nMost recent audit logs in database:');
      recentRows.forEach((log, index) => {
        console.log(`  ${index + 1}. ${log.action_type} on ${log.target_table} - ${log.performed_at}`);
      });
    }

    await connection.end();

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

comprehensiveAuditTest();
