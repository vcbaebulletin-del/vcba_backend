const axios = require('axios');

const API_BASE_URL = 'http://localhost:5000';

async function testWelcomePageAPI() {
  console.log('🧪 Testing Welcome Page API...\n');

  try {
    // Test 1: Check if the welcome page test endpoint works
    console.log('1. Testing welcome page test endpoint...');
    const testResponse = await axios.get(`${API_BASE_URL}/api/welcome-page/test`);
    console.log('Test endpoint response:', testResponse.data);
    
    if (testResponse.data.success) {
      console.log('✅ Welcome page routes are working');
    }

    // Test 2: Check public welcome page data endpoint
    console.log('\n2. Testing public welcome page data endpoint...');
    const dataResponse = await axios.get(`${API_BASE_URL}/api/welcome-page/data`);
    console.log('Data endpoint response:', dataResponse.data);
    
    if (dataResponse.data.success) {
      console.log('✅ Public welcome page data endpoint is working');
    }

    // Test 3: Try to access admin endpoint without auth (should fail)
    console.log('\n3. Testing admin endpoint without authentication...');
    try {
      const adminResponse = await axios.get(`${API_BASE_URL}/api/welcome-page/admin/cards`);
      console.log('Admin endpoint response (unexpected success):', adminResponse.data);
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('✅ Admin endpoint properly requires authentication (401)');
      } else {
        console.log('❌ Unexpected error:', error.response?.data || error.message);
      }
    }

    // Test 4: Check if we can get a token with a known admin account
    console.log('\n4. Testing admin authentication...');
    
    // Try different admin accounts
    const adminAccounts = [
      { email: 'vonchristian41@gmail.com', password: 'password123' },
      { email: 'kenluiz@outlook.com', password: 'password123' },
      { email: 'zaira123@gmail.com', password: 'password123' }
    ];

    let validToken = null;
    
    for (const account of adminAccounts) {
      try {
        console.log(`   Trying ${account.email}...`);
        const loginResponse = await axios.post(`${API_BASE_URL}/api/auth/login`, account);
        
        if (loginResponse.data.success) {
          validToken = loginResponse.data.data.token;
          console.log(`   ✅ Successfully authenticated as ${account.email}`);
          break;
        }
      } catch (error) {
        console.log(`   ❌ Failed to authenticate as ${account.email}: ${error.response?.data?.error?.message || error.message}`);
      }
    }

    if (validToken) {
      console.log('\n5. Testing admin welcome page operations with valid token...');
      
      const headers = {
        'Authorization': `Bearer ${validToken}`,
        'Content-Type': 'application/json'
      };

      // Test getting admin cards
      try {
        const cardsResponse = await axios.get(`${API_BASE_URL}/api/welcome-page/admin/cards`, { headers });
        console.log('   ✅ Successfully retrieved admin cards:', cardsResponse.data.data?.length || 0, 'cards');
        
        // Test reordering cards (if there are cards)
        if (cardsResponse.data.data && cardsResponse.data.data.length > 0) {
          console.log('\n6. Testing card reordering...');
          
          const cards = cardsResponse.data.data;
          const cardOrders = cards.map((card, index) => ({
            id: card.id,
            order_index: index
          }));
          
          const reorderResponse = await axios.put(
            `${API_BASE_URL}/api/welcome-page/admin/cards/reorder`,
            { cardOrders },
            { headers }
          );
          
          console.log('   ✅ Card reordering response:', reorderResponse.data);
        }
        
      } catch (error) {
        console.log('   ❌ Admin operations failed:', error.response?.data || error.message);
      }
    } else {
      console.log('❌ Could not authenticate with any admin account');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

testWelcomePageAPI();
