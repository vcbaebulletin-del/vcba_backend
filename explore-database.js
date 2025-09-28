const mysql = require('mysql2/promise');
require('dotenv').config();

async function exploreDatabase() {
  let connection;
  
  try {
    // Create connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'vcba_bulletin_board'
    });

    console.log('Connected to database successfully!');
    console.log('='.repeat(50));

    // Get all tables
    const [tables] = await connection.execute('SHOW TABLES');
    console.log('TABLES IN DATABASE:');
    console.log('='.repeat(30));
    tables.forEach(table => {
      console.log(`- ${Object.values(table)[0]}`);
    });

    console.log('\n' + '='.repeat(50));

    // Explore each table structure
    for (const table of tables) {
      const tableName = Object.values(table)[0];
      console.log(`\nTABLE: ${tableName}`);
      console.log('-'.repeat(30));
      
      // Get table structure
      const [columns] = await connection.execute(`DESCRIBE ${tableName}`);
      console.log('Columns:');
      columns.forEach(col => {
        console.log(`  ${col.Field} (${col.Type}) ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Key ? `KEY: ${col.Key}` : ''} ${col.Default !== null ? `DEFAULT: ${col.Default}` : ''}`);
      });

      // Get sample data (first 3 rows)
      try {
        const [rows] = await connection.execute(`SELECT * FROM ${tableName} LIMIT 3`);
        if (rows.length > 0) {
          console.log('\nSample data:');
          rows.forEach((row, index) => {
            console.log(`  Row ${index + 1}:`, JSON.stringify(row, null, 2));
          });
        } else {
          console.log('\nNo data in this table');
        }
      } catch (error) {
        console.log(`\nError fetching sample data: ${error.message}`);
      }
    }

    // Look for specific tables we need for SMS functionality
    console.log('\n' + '='.repeat(50));
    console.log('CHECKING FOR SMS-RELATED REQUIREMENTS:');
    console.log('='.repeat(50));

    // Check for users/students table
    const studentTables = tables.filter(table => {
      const name = Object.values(table)[0].toLowerCase();
      return name.includes('user') || name.includes('student');
    });

    if (studentTables.length > 0) {
      console.log('\nFound potential student/user tables:');
      studentTables.forEach(table => {
        console.log(`- ${Object.values(table)[0]}`);
      });
    }

    // Check for posts/announcements tables
    const postTables = tables.filter(table => {
      const name = Object.values(table)[0].toLowerCase();
      return name.includes('post') || name.includes('announcement') || name.includes('calendar');
    });

    if (postTables.length > 0) {
      console.log('\nFound potential post/announcement tables:');
      postTables.forEach(table => {
        console.log(`- ${Object.values(table)[0]}`);
      });
    }

  } catch (error) {
    console.error('Database connection error:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

exploreDatabase();
