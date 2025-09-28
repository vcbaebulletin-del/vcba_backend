const axios = require('axios');

async function simpleAuditTest() {
  console.log('🧪 Simple Audit Test...\n');

  try {
    console.log('Making API call...');
    const response = await axios.put('http://localhost:5000/api/welcome-page/admin/cards/reorder', {
      cardOrders: [{ id: 1, order_index: 0 }]
    });
    
    console.log('Response:', response.data);
    console.log('✅ Test completed');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

simpleAuditTest();
