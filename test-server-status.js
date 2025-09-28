const axios = require('axios');

async function testServerStatus() {
  try {
    console.log('🔧 Testing server status...');
    
    const response = await axios.get('http://localhost:5000/api/health', {
      timeout: 5000
    });
    
    console.log('✅ Server is running!');
    console.log('Status:', response.status);
    console.log('Data:', response.data);
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ Server is not running on port 5000');
    } else {
      console.log('❌ Error:', error.message);
    }
  }
}

testServerStatus();
