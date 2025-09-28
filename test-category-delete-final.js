const axios = require('axios');

const API_BASE_URL = 'http://localhost:5000';

async function testCategoryDeletionFinal() {
  console.log('🧪 Final Test: Category Deletion with Fixed Audit Logging...\n');

  try {
    // Login first
    console.log('1. Logging in...');
    const loginResponse = await axios.post(`${API_BASE_URL}/api/auth/login`, {
      email: 'admin@vcba.edu.ph',
      password: 'admin123'
    });

    if (!loginResponse.data.success) {
      console.log('❌ Login failed:', loginResponse.data);
      return;
    }

    const token = loginResponse.data.data.token;
    console.log('✅ Login successful');

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // Check subcategories for category 2 first
    console.log('\n2. Checking subcategories for category 2...');
    try {
      const subcategoriesResponse = await axios.get(`${API_BASE_URL}/api/categories/2/subcategories`, { headers });
      console.log(`Found ${subcategoriesResponse.data.data.length} subcategories for category 2`);
      
      if (subcategoriesResponse.data.data.length > 0) {
        console.log('Active subcategories that might prevent deletion:');
        subcategoriesResponse.data.data.forEach(sub => {
          if (sub.is_active && !sub.deleted_at) {
            console.log(`  - ${sub.name} (ID: ${sub.subcategory_id}, Active: ${sub.is_active})`);
          }
        });
      }
    } catch (error) {
      console.log('Error getting subcategories:', error.response?.data || error.message);
    }

    // Try to delete category 2
    console.log('\n3. Attempting to delete category 2...');
    try {
      const deleteResponse = await axios.delete(`${API_BASE_URL}/api/categories/2`, { headers });
      console.log('✅ Delete successful:', deleteResponse.data);
      
      // Check if audit log was created
      console.log('\n4. Checking if audit log was created...');
      setTimeout(async () => {
        try {
          // Query the database directly to check for recent audit logs
          const mysql = require('mysql2/promise');
          const config = require('./src/config/config');
          
          const connection = await mysql.createConnection({
            host: config.database.host,
            user: config.database.user,
            password: config.database.password,
            database: config.database.database
          });

          const [rows] = await connection.execute(
            'SELECT * FROM audit_logs WHERE action_type = ? AND target_table = ? ORDER BY performed_at DESC LIMIT 1',
            ['DELETE', 'categories']
          );

          if (rows.length > 0) {
            console.log('✅ Audit log created successfully:');
            console.log(`   - Log ID: ${rows[0].log_id}`);
            console.log(`   - Action: ${rows[0].action_type}`);
            console.log(`   - Table: ${rows[0].target_table}`);
            console.log(`   - Target ID: ${rows[0].target_id}`);
            console.log(`   - Description: ${rows[0].description}`);
            console.log(`   - Performed at: ${rows[0].performed_at}`);
          } else {
            console.log('❌ No audit log found for category deletion');
          }

          await connection.end();
        } catch (dbError) {
          console.log('Error checking audit logs:', dbError.message);
        }
      }, 1000);
      
    } catch (error) {
      console.log('❌ Delete failed:', error.response?.status, error.response?.statusText);
      console.log('Error response:', JSON.stringify(error.response?.data, null, 2));
      
      if (error.response?.status === 400) {
        console.log('\n🔍 400 Bad Request - This might be due to business logic constraints');
        
        // Check if it's a validation error about subcategories
        if (error.response.data.error && error.response.data.error.message) {
          console.log('Error message:', error.response.data.error.message);
          
          if (error.response.data.error.message.includes('subcategories')) {
            console.log('\n💡 This appears to be a business logic constraint preventing deletion of categories with active subcategories.');
            console.log('This is expected behavior and not related to the audit logging issue.');
          }
        }
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testCategoryDeletionFinal();
