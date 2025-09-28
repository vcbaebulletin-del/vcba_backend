const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkTables() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'vcba_bulletin_board'
    });

    const [tables] = await connection.execute("SHOW TABLES LIKE '%admin%'");
    console.log('Admin-related tables:');
    tables.forEach(table => console.log('- ' + Object.values(table)[0]));

    console.log('\nChecking admin_accounts table:');
    try {
      const [adminColumns] = await connection.execute('DESCRIBE admin_accounts');
      console.log('admin_accounts columns:');
      adminColumns.forEach(col => console.log('  ' + col.Field + ' (' + col.Type + ')'));

      const [adminRows] = await connection.execute('SELECT admin_id, username, position FROM admin_accounts LIMIT 3');
      console.log('\nSample admin data:');
      adminRows.forEach(row => console.log('  ', row));
    } catch (err) {
      console.log('admin_accounts table error:', err.message);
    }

    console.log('\nChecking admin_profiles table:');
    try {
      const [profileColumns] = await connection.execute('DESCRIBE admin_profiles');
      console.log('admin_profiles columns:');
      profileColumns.forEach(col => console.log('  ' + col.Field + ' (' + col.Type + ')'));

      const [profileRows] = await connection.execute('SELECT * FROM admin_profiles LIMIT 3');
      console.log('\nSample profile data:');
      profileRows.forEach(row => console.log('  ', row));
    } catch (err) {
      console.log('admin_profiles table error:', err.message);
    }

  } catch (error) {
    console.error('Connection error:', error.message);
  } finally {
    if (connection) await connection.end();
  }
}

checkTables();
