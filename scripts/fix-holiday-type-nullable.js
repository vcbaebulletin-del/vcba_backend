const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
const config = require('../src/config/database');

async function fixHolidayTypeNullable() {
  let connection;
  
  try {
    console.log('🔗 Connecting to database...');
    connection = await mysql.createConnection(config);
    console.log('✅ Connected to database:', config.database);
    
    // Check current holiday_type_id column structure
    console.log('\n📋 Checking current holiday_type_id column structure...');
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'school_calendar' 
      AND COLUMN_NAME = 'holiday_type_id'
    `, [config.database]);
    
    if (columns.length === 0) {
      console.log('❌ holiday_type_id column not found in school_calendar table');
      return;
    }
    
    const column = columns[0];
    console.log('Current holiday_type_id column:');
    console.log(`  - Type: ${column.DATA_TYPE}`);
    console.log(`  - Nullable: ${column.IS_NULLABLE}`);
    console.log(`  - Default: ${column.COLUMN_DEFAULT || 'NULL'}`);
    console.log(`  - Comment: ${column.COLUMN_COMMENT || 'None'}`);
    
    if (column.IS_NULLABLE === 'YES') {
      console.log('✅ holiday_type_id is already nullable - no migration needed');
      return;
    }
    
    console.log('\n🔧 Making holiday_type_id nullable...');
    
    // Make holiday_type_id nullable
    await connection.execute(`
      ALTER TABLE \`school_calendar\` 
      MODIFY COLUMN \`holiday_type_id\` int(11) NULL COMMENT 'Legacy holiday type ID - being phased out in favor of category_id'
    `);
    
    console.log('✅ Successfully made holiday_type_id nullable');
    
    // Verify the change
    console.log('\n🔍 Verifying the change...');
    const [updatedColumns] = await connection.execute(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'school_calendar' 
      AND COLUMN_NAME = 'holiday_type_id'
    `, [config.database]);
    
    const updatedColumn = updatedColumns[0];
    console.log('Updated holiday_type_id column:');
    console.log(`  - Type: ${updatedColumn.DATA_TYPE}`);
    console.log(`  - Nullable: ${updatedColumn.IS_NULLABLE}`);
    console.log(`  - Default: ${updatedColumn.COLUMN_DEFAULT || 'NULL'}`);
    console.log(`  - Comment: ${updatedColumn.COLUMN_COMMENT || 'None'}`);
    
    // Add audit log entry
    console.log('\n📝 Adding audit log entry...');
    await connection.execute(`
      INSERT INTO \`audit_logs\` (
        \`user_type\`, 
        \`user_id\`, 
        \`action_type\`, 
        \`target_table\`, 
        \`description\`, 
        \`performed_at\`
      ) VALUES (
        'system', 
        NULL, 
        'ALTER', 
        'school_calendar', 
        'Migration: Made holiday_type_id column nullable to support transition to category-based system', 
        NOW()
      )
    `);
    
    console.log('✅ Audit log entry added');
    
    // Test creating a calendar event without holiday_type_id
    console.log('\n🧪 Testing calendar event creation without holiday_type_id...');
    
    // Check if we have any categories to use
    const [categories] = await connection.execute('SELECT category_id FROM categories LIMIT 1');
    
    if (categories.length === 0) {
      console.log('⚠️ No categories found - cannot test event creation');
      console.log('Please ensure you have categories in your database');
    } else {
      const categoryId = categories[0].category_id;
      
      try {
        const [result] = await connection.execute(`
          INSERT INTO \`school_calendar\` (
            \`title\`, 
            \`description\`, 
            \`event_date\`, 
            \`category_id\`, 
            \`is_active\`, 
            \`is_published\`,
            \`created_by\`,
            \`created_at\`,
            \`updated_at\`
          ) VALUES (
            'Test Event - Migration Check', 
            'Test event created during migration to verify holiday_type_id is nullable', 
            '2025-07-20', 
            ?, 
            1, 
            0,
            1,
            NOW(),
            NOW()
          )
        `, [categoryId]);
        
        const testEventId = result.insertId;
        console.log(`✅ Successfully created test event with ID: ${testEventId}`);
        
        // Clean up test event
        await connection.execute('DELETE FROM `school_calendar` WHERE `calendar_id` = ?', [testEventId]);
        console.log('✅ Test event cleaned up');
        
      } catch (error) {
        console.log('❌ Failed to create test event:', error.message);
      }
    }
    
    console.log('\n🎉 Migration completed successfully!');
    console.log('Calendar events can now be created without holiday_type_id');
    
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
  fixHolidayTypeNullable();
}

module.exports = fixHolidayTypeNullable;
