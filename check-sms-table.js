const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkSMSTable() {
  let connection;
  try {
    console.log('Connecting to database...');
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'db_ebulletin_system'
    });

    console.log('Connected! Checking sms_notifications table...');

    // First check if table exists
    const [tables] = await connection.execute("SHOW TABLES LIKE 'sms_notifications'");
    console.log('Table exists check:', tables.length > 0 ? 'YES' : 'NO');

    if (tables.length > 0) {
      const [columns] = await connection.execute('DESCRIBE sms_notifications');
      console.log('\nCurrent sms_notifications table structure:');
      columns.forEach(col => {
        console.log('  ' + col.Field + ' (' + col.Type + ') ' + (col.Null === 'NO' ? 'NOT NULL' : 'NULL'));
      });

      // Check indexes
      const [indexes] = await connection.execute('SHOW INDEX FROM sms_notifications');
      console.log('\nCurrent indexes:');
      indexes.forEach(idx => {
        console.log('  ' + idx.Key_name + ' on ' + idx.Column_name);
      });

      // Check sample data
      const [rows] = await connection.execute('SELECT COUNT(*) as count FROM sms_notifications');
      console.log('\nTotal SMS notifications: ' + rows[0].count);
    } else {
      console.log('\nsms_notifications table does not exist. Need to create it.');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (connection) await connection.end();
  }
}

checkSMSTable();
