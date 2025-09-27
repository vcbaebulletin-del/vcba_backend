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

async function addCategoryDeletedAtColumns() {
  let connection;
  
  try {
    console.log('🔧 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database successfully');

    console.log('\n🔧 Adding deleted_at column to categories table...');
    
    // Check if deleted_at column already exists in categories
    const [categoriesColumns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'categories' AND COLUMN_NAME = 'deleted_at'
    `, [process.env.DB_NAME || 'db_ebulletin_system']);

    if (categoriesColumns.length === 0) {
      await connection.execute(`
        ALTER TABLE categories 
        ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL 
        AFTER updated_at
      `);
      console.log('✅ Added deleted_at column to categories table');
    } else {
      console.log('⚠️ deleted_at column already exists in categories table');
    }

    console.log('\n🔧 Adding deleted_at column to subcategories table...');
    
    // Check if deleted_at column already exists in subcategories
    const [subcategoriesColumns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'subcategories' AND COLUMN_NAME = 'deleted_at'
    `, [process.env.DB_NAME || 'db_ebulletin_system']);

    if (subcategoriesColumns.length === 0) {
      await connection.execute(`
        ALTER TABLE subcategories 
        ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL 
        AFTER updated_at
      `);
      console.log('✅ Added deleted_at column to subcategories table');
    } else {
      console.log('⚠️ deleted_at column already exists in subcategories table');
    }

    console.log('\n🔧 Adding indexes for better performance...');
    
    // Add index for categories.deleted_at
    try {
      await connection.execute(`
        CREATE INDEX idx_categories_deleted_at ON categories(deleted_at)
      `);
      console.log('✅ Added index for categories.deleted_at');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('⚠️ Index already exists for categories.deleted_at');
      } else {
        throw error;
      }
    }

    // Add index for subcategories.deleted_at
    try {
      await connection.execute(`
        CREATE INDEX idx_subcategories_deleted_at ON subcategories(deleted_at)
      `);
      console.log('✅ Added index for subcategories.deleted_at');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('⚠️ Index already exists for subcategories.deleted_at');
      } else {
        throw error;
      }
    }

    console.log('\n🔍 Verifying column additions...');
    
    // Verify categories table structure
    const [categoriesStructure] = await connection.execute('DESCRIBE categories');
    const categoriesDeletedAt = categoriesStructure.find(col => col.Field === 'deleted_at');
    console.log(`Categories deleted_at column: ${categoriesDeletedAt ? 'EXISTS' : 'MISSING'}`);
    
    // Verify subcategories table structure
    const [subcategoriesStructure] = await connection.execute('DESCRIBE subcategories');
    const subcategoriesDeletedAt = subcategoriesStructure.find(col => col.Field === 'deleted_at');
    console.log(`Subcategories deleted_at column: ${subcategoriesDeletedAt ? 'EXISTS' : 'MISSING'}`);

    console.log('\n🎉 Migration completed successfully!');
    console.log('💡 Summary:');
    console.log('   - Categories table now supports soft deletion with deleted_at column');
    console.log('   - Subcategories table now supports soft deletion with deleted_at column');
    console.log('   - Added performance indexes for deleted_at columns');
    console.log('   - Existing data remains unchanged (all deleted_at values are NULL)');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the migration
addCategoryDeletedAtColumns();
