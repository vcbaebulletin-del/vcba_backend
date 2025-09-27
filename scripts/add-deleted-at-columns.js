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

async function addDeletedAtColumns() {
  let connection;
  
  try {
    console.log('🔧 Connecting to database...');
    console.log(`Database: ${dbConfig.database} at ${dbConfig.host}:${dbConfig.port}`);
    
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database successfully');

    // Check if tables exist
    console.log('\n🔍 Checking if welcome page tables exist...');
    const [tables] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN ('welcome_page', 'welcome_cards', 'login_carousel_images')
    `, [dbConfig.database]);
    
    if (tables.length === 0) {
      console.error('❌ Welcome page tables not found! Please run the main migration first.');
      process.exit(1);
    }
    
    console.log('✅ Found welcome page tables');

    // Add deleted_at column to welcome_page table
    console.log('\n🔧 Adding deleted_at column to welcome_page table...');
    try {
      await connection.execute(`
        ALTER TABLE welcome_page 
        ADD COLUMN deleted_at TIMESTAMP NULL COMMENT 'Timestamp when the record was soft deleted' AFTER updated_at
      `);
      console.log('✅ Added deleted_at column to welcome_page');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('⚠️ deleted_at column already exists in welcome_page');
      } else {
        throw error;
      }
    }

    // Add deleted_at column to welcome_cards table
    console.log('🔧 Adding deleted_at column to welcome_cards table...');
    try {
      await connection.execute(`
        ALTER TABLE welcome_cards 
        ADD COLUMN deleted_at TIMESTAMP NULL COMMENT 'Timestamp when the record was soft deleted' AFTER updated_at
      `);
      console.log('✅ Added deleted_at column to welcome_cards');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('⚠️ deleted_at column already exists in welcome_cards');
      } else {
        throw error;
      }
    }

    // Add deleted_at column to login_carousel_images table
    console.log('🔧 Adding deleted_at column to login_carousel_images table...');
    try {
      await connection.execute(`
        ALTER TABLE login_carousel_images 
        ADD COLUMN deleted_at TIMESTAMP NULL COMMENT 'Timestamp when the record was soft deleted' AFTER updated_at
      `);
      console.log('✅ Added deleted_at column to login_carousel_images');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('⚠️ deleted_at column already exists in login_carousel_images');
      } else {
        throw error;
      }
    }

    // Add indexes for better performance
    console.log('\n🔧 Adding indexes for deleted_at columns...');
    
    try {
      await connection.execute('ALTER TABLE welcome_page ADD INDEX idx_welcome_page_deleted_at (deleted_at)');
      console.log('✅ Added index for welcome_page.deleted_at');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('⚠️ Index already exists for welcome_page.deleted_at');
      } else {
        throw error;
      }
    }

    try {
      await connection.execute('ALTER TABLE welcome_cards ADD INDEX idx_welcome_cards_deleted_at (deleted_at)');
      console.log('✅ Added index for welcome_cards.deleted_at');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('⚠️ Index already exists for welcome_cards.deleted_at');
      } else {
        throw error;
      }
    }

    try {
      await connection.execute('ALTER TABLE login_carousel_images ADD INDEX idx_login_carousel_deleted_at (deleted_at)');
      console.log('✅ Added index for login_carousel_images.deleted_at');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('⚠️ Index already exists for login_carousel_images.deleted_at');
      } else {
        throw error;
      }
    }

    // Verify columns were added
    console.log('\n🔍 Verifying columns were added...');
    const [welcomePageCols] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'welcome_page' AND COLUMN_NAME = 'deleted_at'
    `, [dbConfig.database]);

    const [welcomeCardsCols] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'welcome_cards' AND COLUMN_NAME = 'deleted_at'
    `, [dbConfig.database]);

    const [carouselCols] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'login_carousel_images' AND COLUMN_NAME = 'deleted_at'
    `, [dbConfig.database]);

    console.log('✅ Verification results:');
    console.log(`   - welcome_page.deleted_at: ${welcomePageCols.length > 0 ? 'EXISTS' : 'MISSING'}`);
    console.log(`   - welcome_cards.deleted_at: ${welcomeCardsCols.length > 0 ? 'EXISTS' : 'MISSING'}`);
    console.log(`   - login_carousel_images.deleted_at: ${carouselCols.length > 0 ? 'EXISTS' : 'MISSING'}`);

    console.log('\n🎉 Migration completed successfully!');
    console.log('💡 You can now use soft deletion functionality in the welcome page system.');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('💡 Make sure MySQL server is running');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('💡 Check database credentials in .env file');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.error('💡 Database does not exist. Please create it first.');
    }
    
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the migration
if (require.main === module) {
  addDeletedAtColumns();
}

module.exports = { addDeletedAtColumns };
