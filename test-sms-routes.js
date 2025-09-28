const express = require('express');
const smsRoutes = require('./src/routes/smsRoutes');

const app = express();
app.use(express.json());

// Test the SMS routes directly
app.use('/api/sms', smsRoutes);

const PORT = 3001;

app.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`);
  console.log(`Test health endpoint: http://localhost:${PORT}/api/sms/health`);
});

// Test the health endpoint
setTimeout(async () => {
  try {
    const response = await fetch(`http://localhost:${PORT}/api/sms/health`);
    const data = await response.json();
    console.log('Health check result:', data);
  } catch (error) {
    console.error('Health check failed:', error.message);
  }
}, 1000);
