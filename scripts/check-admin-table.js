const mysql = require('mysql2/promise');
require('dotenv').config();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'db_ebulletin_system',
  port: process.env.DB_PORT || 3306
};

async function checkAdminTable() {
  let connection;
  
  try {
    console.log('🔧 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database');

    // Check admin_accounts table structure
    console.log('\n🔍 Checking admin_accounts table structure...');
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'admin_accounts'
      ORDER BY ORDINAL_POSITION
    `, [dbConfig.database]);
    
    console.log('📊 admin_accounts table columns:');
    columns.forEach(col => {
      console.log(`   - ${col.COLUMN_NAME} (${col.DATA_TYPE}) ${col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

    // Get sample admin data
    console.log('\n🔍 Sample admin data:');
    const [admins] = await connection.execute('SELECT * FROM admin_accounts LIMIT 1');
    if (admins.length > 0) {
      console.log('📊 Sample admin record:');
      console.log(JSON.stringify(admins[0], null, 2));
    } else {
      console.log('⚠️ No admin records found');
    }

  } catch (error) {
    console.error('❌ Error checking admin table:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the check
if (require.main === module) {
  checkAdminTable();
}

module.exports = { checkAdminTable };
