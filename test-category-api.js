const axios = require('axios');

const API_BASE_URL = 'http://localhost:5000';

// Test category deletion via API
async function testCategoryAPI() {
  console.log('🧪 Testing Category Deletion via API...\n');

  try {
    // Test without authentication first to see the error
    console.log('1. Testing category deletion without auth (should fail)...');
    try {
      const response = await axios.delete(`${API_BASE_URL}/api/categories/2`);
      console.log('Unexpected success:', response.data);
    } catch (error) {
      console.log('Expected auth error:', error.response?.status, error.response?.data?.message);
    }

    // Test with a simple GET request to see if the server is responding
    console.log('\n2. Testing basic category GET request...');
    try {
      const response = await axios.get(`${API_BASE_URL}/api/categories`);
      console.log('✅ Categories GET successful:', response.data.success);
      console.log('Categories count:', response.data.data?.length || 0);
    } catch (error) {
      console.log('❌ Categories GET failed:', error.response?.data || error.message);
    }

    // Test subcategories for category 2
    console.log('\n3. Testing subcategories for category 2...');
    try {
      const response = await axios.get(`${API_BASE_URL}/api/categories/2/subcategories`);
      console.log('✅ Subcategories GET successful:', response.data.success);
      console.log('Subcategories for category 2:', response.data.data?.length || 0);
      
      if (response.data.data && response.data.data.length > 0) {
        console.log('Subcategories:');
        response.data.data.forEach(sub => {
          console.log(`  - ${sub.name} (ID: ${sub.subcategory_id}, Active: ${sub.is_active})`);
        });
      }
    } catch (error) {
      console.log('❌ Subcategories GET failed:', error.response?.data || error.message);
    }

    // Try to get admin credentials from environment or use test credentials
    console.log('\n4. Testing with admin authentication...');
    
    // Try different admin credentials
    const adminCredentials = [
      { email: 'admin@vcba.edu.ph', password: 'admin123' },
      { email: 'superadmin@vcba.edu.ph', password: 'admin123' },
      { email: 'admin@example.com', password: 'password123' },
      { email: 'test@admin.com', password: 'admin123' }
    ];

    let token = null;
    
    for (const creds of adminCredentials) {
      try {
        console.log(`Trying login with ${creds.email}...`);
        const loginResponse = await axios.post(`${API_BASE_URL}/api/auth/login`, creds);
        
        if (loginResponse.data.success) {
          token = loginResponse.data.data.token;
          console.log(`✅ Login successful with ${creds.email}`);
          break;
        }
      } catch (error) {
        console.log(`❌ Login failed with ${creds.email}:`, error.response?.data?.error?.message || error.message);
      }
    }

    if (token) {
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      // Now test category deletion with authentication
      console.log('\n5. Testing category deletion with authentication...');
      try {
        const deleteResponse = await axios.delete(`${API_BASE_URL}/api/categories/2`, { headers });
        console.log('✅ Delete successful:', deleteResponse.data);
      } catch (error) {
        console.log('❌ Delete failed:', error.response?.status, error.response?.data);
        
        if (error.response?.status === 400) {
          console.log('This is the 400 Bad Request error we need to investigate');
          console.log('Error details:', JSON.stringify(error.response.data, null, 2));
        }
      }
    } else {
      console.log('❌ Could not authenticate with any admin credentials');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testCategoryAPI();
