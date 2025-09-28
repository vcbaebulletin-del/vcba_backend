const axios = require('axios');

const API_BASE_URL = 'http://localhost:5000';

// Test welcome page audit logging
async function testWelcomePageAuditLogging() {
  console.log('🧪 Testing Welcome Page Audit Logging...\n');

  try {
    // First, get a valid admin token
    console.log('1. Getting admin token...');
    const loginResponse = await axios.post(`${API_BASE_URL}/api/auth/login`, {
      email: 'vonchristian41@gmail.com',
      password: '12345QWERTqwert'
    });

    if (!loginResponse.data.success) {
      throw new Error('Failed to login');
    }

    const token = loginResponse.data.data.token;
    console.log('✅ Admin token obtained');

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // Test 1: Create a welcome card (should trigger CREATE audit)
    console.log('\n2. Testing CREATE welcome card audit...');
    const createCardData = {
      title: 'Test Audit Card',
      description: 'Testing audit logging for card creation',
      is_active: true
    };

    const createResponse = await axios.post(
      `${API_BASE_URL}/api/welcome-page/admin/cards`,
      createCardData,
      { headers }
    );

    console.log('Create response:', createResponse.data);
    
    if (createResponse.data.success) {
      const cardId = createResponse.data.data.id;
      console.log(`✅ Card created with ID: ${cardId}`);

      // Test 2: Update the card (should trigger UPDATE audit)
      console.log('\n3. Testing UPDATE welcome card audit...');
      const updateCardData = {
        title: 'Updated Test Audit Card',
        description: 'Updated description for audit testing',
        is_active: true
      };

      const updateResponse = await axios.put(
        `${API_BASE_URL}/api/welcome-page/admin/cards/${cardId}`,
        updateCardData,
        { headers }
      );

      console.log('Update response:', updateResponse.data);
      
      if (updateResponse.data.success) {
        console.log('✅ Card updated successfully');

        // Test 3: Toggle card status (should trigger TOGGLE_STATUS audit)
        console.log('\n4. Testing TOGGLE_STATUS welcome card audit...');
        const toggleResponse = await axios.put(
          `${API_BASE_URL}/api/welcome-page/admin/cards/${cardId}/toggle`,
          {},
          { headers }
        );

        console.log('Toggle response:', toggleResponse.data);
        
        if (toggleResponse.data.success) {
          console.log('✅ Card status toggled successfully');
        }

        // Test 4: Delete the card (should trigger DELETE audit)
        console.log('\n5. Testing DELETE welcome card audit...');
        const deleteResponse = await axios.delete(
          `${API_BASE_URL}/api/welcome-page/admin/cards/${cardId}`,
          { headers }
        );

        console.log('Delete response:', deleteResponse.data);
        
        if (deleteResponse.data.success) {
          console.log('✅ Card deleted successfully');
        }
      }
    }

    // Test 5: Check audit logs for welcome page operations
    console.log('\n6. Checking audit logs...');
    const auditResponse = await axios.get(
      `${API_BASE_URL}/api/audit-logs?page=1&limit=10&table_name=welcome_cards`,
      { headers }
    );

    console.log('Audit logs response:', auditResponse.data);
    
    if (auditResponse.data.success && auditResponse.data.data.length > 0) {
      console.log('✅ Found audit logs for welcome_cards:');
      auditResponse.data.data.forEach((log, index) => {
        console.log(`  ${index + 1}. ${log.action_type} - ${log.description} (${log.performed_at})`);
      });
    } else {
      console.log('❌ No audit logs found for welcome_cards operations');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

// Run the test
testWelcomePageAuditLogging();
