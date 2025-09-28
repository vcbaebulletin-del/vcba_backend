const db = require('./src/config/database');

async function testDatabaseConnection() {
  console.log('🧪 Testing Database Connection...\n');

  try {
    console.log('1. Checking database instance...');
    console.log('Database instance:', typeof db);
    console.log('Database methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(db)));
    
    console.log('\n2. Testing database health check...');
    const health = await db.healthCheck();
    console.log('Health check result:', health);

    console.log('\n3. Testing execute method...');
    console.log('Execute method exists:', typeof db.execute === 'function');
    
    if (typeof db.execute === 'function') {
      console.log('✅ Execute method is available');
      
      // Test a simple query
      console.log('\n4. Testing simple query...');
      const result = await db.execute('SELECT 1 as test');
      console.log('Simple query result:', result);
      
      console.log('\n5. Testing audit log insertion...');
      const auditQuery = `
        INSERT INTO audit_logs (
          user_type, user_id, action_type, target_table, target_id,
          old_values, new_values, description, ip_address, user_agent
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const auditValues = [
        'admin',
        31,
        'TEST',
        'test_table',
        1,
        null,
        null,
        'Test audit log entry',
        '127.0.0.1',
        'Test User Agent'
      ];
      
      const auditResult = await db.execute(auditQuery, auditValues);
      console.log('✅ Audit log insertion successful:', auditResult);
      console.log('Insert ID:', auditResult.insertId);
      
    } else {
      console.log('❌ Execute method is not available');
      console.log('Available methods:', Object.getOwnPropertyNames(db));
    }

  } catch (error) {
    console.error('❌ Database test failed:', error.message);
    console.error('Error details:', error);
  }
}

testDatabaseConnection();
