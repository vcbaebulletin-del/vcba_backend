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

async function checkDatabaseStructure() {
  let connection;
  
  try {
    console.log('🔧 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database successfully');

    console.log('\n📋 Checking categories table structure...');
    const [categoriesStructure] = await connection.execute('DESCRIBE categories');
    console.table(categoriesStructure);

    console.log('\n📋 Checking subcategories table structure...');
    const [subcategoriesStructure] = await connection.execute('DESCRIBE subcategories');
    console.table(subcategoriesStructure);

    console.log('\n📊 Sample categories data...');
    const [categoriesData] = await connection.execute('SELECT * FROM categories LIMIT 5');
    console.table(categoriesData);

    console.log('\n📊 Sample subcategories data...');
    const [subcategoriesData] = await connection.execute('SELECT * FROM subcategories LIMIT 5');
    console.table(subcategoriesData);

    console.log('\n🔍 Checking for existing deleted_at columns...');
    const [categoriesColumns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'categories' AND COLUMN_NAME = 'deleted_at'
    `, [process.env.DB_NAME || 'db_ebulletin_system']);
    
    const [subcategoriesColumns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'subcategories' AND COLUMN_NAME = 'deleted_at'
    `, [process.env.DB_NAME || 'db_ebulletin_system']);

    console.log(`Categories has deleted_at column: ${categoriesColumns.length > 0 ? 'YES' : 'NO'}`);
    console.log(`Subcategories has deleted_at column: ${subcategoriesColumns.length > 0 ? 'YES' : 'NO'}`);

  } catch (error) {
    console.error('❌ Database check failed:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the check
checkDatabaseStructure();
