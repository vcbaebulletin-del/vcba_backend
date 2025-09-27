const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
const config = require('../src/config/database');

async function runCalendarCategoriesMigration() {
  let connection;
  
  try {
    console.log('🔗 Connecting to database...');
    connection = await mysql.createConnection(config);
    console.log('✅ Connected to database');
    
    // Check if migration has already been applied
    console.log('\n📋 Checking if migration has already been applied...');
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'school_calendar' 
      AND COLUMN_NAME IN ('category_id', 'subcategory_id')
    `, [config.database]);
    
    if (columns.length === 2) {
      console.log('✅ Migration already applied - category_id and subcategory_id columns exist');
      
      // Check if foreign keys exist
      const [fks] = await connection.execute(`
        SELECT CONSTRAINT_NAME 
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'school_calendar' 
        AND CONSTRAINT_NAME IN ('fk_calendar_category', 'fk_calendar_subcategory')
      `, [config.database]);
      
      if (fks.length === 2) {
        console.log('✅ Foreign key constraints also exist');
        console.log('🎉 Calendar categories migration is complete!');
        return;
      } else {
        console.log('⚠️ Columns exist but foreign keys may be missing');
      }
    } else {
      console.log('❌ Migration not applied - running migration now...');
      
      // Read and execute the migration file
      const migrationPath = path.join(__dirname, '../migrations/add_calendar_categories.sql');
      const migrationSQL = await fs.readFile(migrationPath, 'utf8');
      
      // Split the SQL into individual statements
      const statements = migrationSQL
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
      
      console.log(`📝 Executing ${statements.length} SQL statements...`);
      
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        if (statement.trim()) {
          try {
            console.log(`   ${i + 1}. Executing statement...`);
            await connection.execute(statement);
            console.log(`   ✅ Statement ${i + 1} executed successfully`);
          } catch (error) {
            if (error.code === 'ER_DUP_FIELDNAME' || error.code === 'ER_DUP_KEYNAME') {
              console.log(`   ⚠️ Statement ${i + 1} skipped (already exists): ${error.message}`);
            } else {
              console.error(`   ❌ Error executing statement ${i + 1}:`, error.message);
              throw error;
            }
          }
        }
      }
      
      console.log('✅ Migration executed successfully!');
    }
    
    // Verify the migration
    console.log('\n🔍 Verifying migration...');
    const [verifyColumns] = await connection.execute(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'school_calendar' 
      AND COLUMN_NAME IN ('category_id', 'subcategory_id')
      ORDER BY COLUMN_NAME
    `, [config.database]);
    
    console.log('📋 New columns:');
    verifyColumns.forEach(col => {
      console.log(`   - ${col.COLUMN_NAME}: ${col.DATA_TYPE} (nullable: ${col.IS_NULLABLE})`);
    });
    
    // Check foreign keys
    const [verifyFKs] = await connection.execute(`
      SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME 
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'school_calendar' 
      AND CONSTRAINT_NAME LIKE 'fk_calendar_%'
      AND REFERENCED_TABLE_NAME IN ('categories', 'subcategories')
    `, [config.database]);
    
    console.log('🔗 Foreign key constraints:');
    verifyFKs.forEach(fk => {
      console.log(`   - ${fk.CONSTRAINT_NAME}: ${fk.COLUMN_NAME} -> ${fk.REFERENCED_TABLE_NAME}`);
    });
    
    console.log('\n🎉 Calendar categories migration completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Test the calendar event creation with categories');
    console.log('   2. Migrate existing events from holiday_type_id to category_id if needed');
    console.log('   3. Update frontend to use the new category system');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Stack trace:', error.stack);
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
  runCalendarCategoriesMigration();
}

module.exports = runCalendarCategoriesMigration;
