const axios = require('axios');
const AuditLogService = require('./src/services/AuditLogService');

const API_BASE_URL = 'http://localhost:5000';

async function testWelcomePageAuditReal() {
  console.log('🧪 Testing Welcome Page Audit Logging (Real API Calls)...\n');

  try {
    // Test 1: Get current cards to see what we're working with
    console.log('1. Getting current welcome cards...');
    const cardsResponse = await axios.get(`${API_BASE_URL}/api/welcome-page/admin/cards`);
    
    if (cardsResponse.data.success) {
      const cards = cardsResponse.data.data.cards;
      console.log(`✅ Found ${cards.length} cards`);
      
      if (cards.length > 0) {
        console.log('   Cards:', cards.map(c => `ID:${c.id} - ${c.title}`));
      }
    }

    // Test 2: Test reordering cards (should trigger REORDER audit)
    console.log('\n2. Testing card reordering...');
    
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
    }

    // Test 3: Test toggling card status (should trigger TOGGLE_STATUS audit)
    if (cardsResponse.data.success && cardsResponse.data.data.cards.length > 0) {
      const firstCard = cardsResponse.data.data.cards[0];
      console.log(`\n3. Testing card status toggle for card ID ${firstCard.id}...`);
      
      const toggleResponse = await axios.put(
        `${API_BASE_URL}/api/welcome-page/admin/cards/${firstCard.id}/toggle`
      );

      console.log('Toggle response:', toggleResponse.data);
      
      if (toggleResponse.data.success) {
        console.log('✅ Card status toggle successful');
      }
    }

    // Test 4: Test carousel reordering (should trigger REORDER audit)
    console.log('\n4. Testing carousel reordering...');
    
    const carouselReorderData = {
      imageOrders: [
        { id: 1, order_index: 0 },
        { id: 2, order_index: 1 }
      ]
    };

    try {
      const carouselReorderResponse = await axios.put(
        `${API_BASE_URL}/api/welcome-page/admin/carousel/reorder`,
        carouselReorderData
      );

      console.log('Carousel reorder response:', carouselReorderResponse.data);
      
      if (carouselReorderResponse.data.success) {
        console.log('✅ Carousel reordering successful');
      }
    } catch (error) {
      console.log('❌ Carousel reordering failed:', error.response?.data?.message || error.message);
    }

    // Wait a moment for async audit logging to complete
    console.log('\n5. Waiting for audit logs to be written...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 5: Check audit logs for welcome page operations
    console.log('\n6. Checking audit logs for welcome page operations...');
    
    // Check for welcome_cards audit logs
    const welcomeCardsLogs = await AuditLogService.getAuditLogs(
      {
        target_table: 'welcome_cards',
        start_date: new Date(Date.now() - 5 * 60 * 1000).toISOString() // Last 5 minutes
      },
      { page: 1, limit: 10 }
    );

    // Check for carousel_images audit logs
    const carouselLogs = await AuditLogService.getAuditLogs(
      {
        target_table: 'carousel_images',
        start_date: new Date(Date.now() - 5 * 60 * 1000).toISOString() // Last 5 minutes
      },
      { page: 1, limit: 10 }
    );

    const auditLogs = {
      data: [...(welcomeCardsLogs.data || []), ...(carouselLogs.data || [])]
    };

    if (auditLogs.data && auditLogs.data.length > 0) {
      console.log('✅ Found recent audit logs for welcome page operations:');
      auditLogs.data.forEach((log, index) => {
        console.log(`  ${index + 1}. ${log.action_type} on ${log.target_table} - ${log.description}`);
        console.log(`      User: ${log.user_type} (ID: ${log.user_id}) at ${log.performed_at}`);
      });
    } else {
      console.log('❌ No recent audit logs found for welcome page operations');
      
      // Check if there are any audit logs at all
      const allAuditLogs = await AuditLogService.getAuditLogs({}, { page: 1, limit: 5 });
      if (allAuditLogs.data && allAuditLogs.data.length > 0) {
        console.log('\n   But found some other recent audit logs:');
        allAuditLogs.data.forEach((log, index) => {
          console.log(`     ${index + 1}. ${log.action_type} on ${log.target_table} - ${log.description}`);
        });
      } else {
        console.log('\n   No audit logs found at all - there might be a database issue');
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    console.error('Stack trace:', error.stack);
  }
}

testWelcomePageAuditReal();
