const axios = require('axios');

async function testServer() {
  try {
    console.log('Testing server...');
    const response = await axios.get('http://localhost:5000/api/welcome-page/test');
    console.log('Server response:', response.data);
  } catch (error) {
    console.error('Server error:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('❌ Server is not running on port 5000');
    }
  }
}

testServer();
