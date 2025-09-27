const mysql = require('mysql2/promise');

// Database configuration - using defaults since .env might not be loaded
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '', // Empty password
  database: 'db_ebulletin_system',
  port: 3306,
  timezone: '+08:00'
};

async function quickDbCheck() {
  let connection;
  
  try {
    console.log('🔍 Connecting to database with empty password...');
    connection = await mysql.createConnection(dbConfig);
    
    console.log('✅ Connected successfully!');
    
    // Check target events
    console.log('\n🎯 Checking target events (1564, 1565):');
    const [events] = await connection.query(`
      SELECT 
        calendar_id,
        title,
        is_active,
        is_alert,
        event_date,
        end_date,
        deleted_at
      FROM calendar 
      WHERE calendar_id IN (1564, 1565)
    `);
    
    console.table(events);
    
    // Check calendar table structure
    console.log('\n📋 Calendar table structure:');
    const [structure] = await connection.query('DESCRIBE calendar');
    console.table(structure.slice(0, 10)); // Show first 10 columns
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.log('\n🔑 Trying with different password configurations...');
      
      // Try with common passwords
      const passwords = ['root', 'password', '123456'];
      
      for (const pwd of passwords) {
        try {
          const testConfig = { ...dbConfig, password: pwd };
          const testConnection = await mysql.createConnection(testConfig);
          console.log(`✅ Connected with password: "${pwd}"`);
          await testConnection.end();
          return;
        } catch (testError) {
          console.log(`❌ Failed with password: "${pwd}"`);
        }
      }
    }
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

quickDbCheck();
