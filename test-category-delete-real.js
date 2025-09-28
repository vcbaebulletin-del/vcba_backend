const axios = require('axios');

const API_BASE_URL = 'http://localhost:5000';

async function testCategoryDeletion() {
  console.log('🧪 Testing Category Deletion with Real API...\n');

  try {
    // First, let's try to login with a known admin account
    console.log('1. Attempting to login...');
    
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

    // Get categories first to see which ones exist
    console.log('\n2. Getting categories...');
    const categoriesResponse = await axios.get(`${API_BASE_URL}/api/categories`, { headers });
    console.log('Categories:', categoriesResponse.data.data.map(cat => `${cat.category_id}: ${cat.name}`));

    // Check subcategories for category 2
    console.log('\n3. Checking subcategories for category 2...');
    try {
      const subcategoriesResponse = await axios.get(`${API_BASE_URL}/api/categories/2/subcategories`, { headers });
      console.log('Subcategories for category 2:', subcategoriesResponse.data.data.length);
      
      if (subcategoriesResponse.data.data.length > 0) {
        console.log('Active subcategories:');
        subcategoriesResponse.data.data.forEach(sub => {
          console.log(`  - ${sub.name} (ID: ${sub.subcategory_id}, Active: ${sub.is_active})`);
        });
      }
    } catch (error) {
      console.log('Error getting subcategories:', error.response?.data || error.message);
    }

    // Now try to delete category 2
    console.log('\n4. Attempting to delete category 2...');
    try {
      const deleteResponse = await axios.delete(`${API_BASE_URL}/api/categories/2`, { headers });
      console.log('✅ Delete successful:', deleteResponse.data);
    } catch (error) {
      console.log('❌ Delete failed:', error.response?.status, error.response?.statusText);
      console.log('Error response:', JSON.stringify(error.response?.data, null, 2));
      
      if (error.response?.status === 400) {
        console.log('\n🔍 This is the 400 Bad Request error we need to investigate');
        
        // Check the latest error logs
        console.log('\n5. Checking recent error logs...');
        const fs = require('fs');
        const path = require('path');
        
        try {
          const errorLogPath = path.join(__dirname, 'logs', 'error-2025-09-14.log');
          const errorLog = fs.readFileSync(errorLogPath, 'utf8');
          const lines = errorLog.split('\n');
          const recentLines = lines.slice(-20); // Get last 20 lines
          
          console.log('Recent error log entries:');
          recentLines.forEach(line => {
            if (line.trim()) {
              try {
                const logEntry = JSON.parse(line);
                if (logEntry.timestamp && logEntry.message) {
                  console.log(`${logEntry.timestamp}: ${logEntry.message}`);
                }
              } catch (e) {
                console.log(line);
              }
            }
          });
        } catch (logError) {
          console.log('Could not read error log:', logError.message);
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

testCategoryDeletion();
