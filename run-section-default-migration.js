/**
 * Script to run the section default value migration
 * This sets the default value of the section column to 1
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function runMigration() {
  try {
    console.log('🔄 Starting section default value migration...');

    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', 'set_section_default_value.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration SQL:');
    console.log(migrationSQL);
    console.log('');

    // Execute the migration
    console.log('⚙️  Executing migration...');
    await database.execute(migrationSQL);

    console.log('✅ Migration completed successfully!');
    console.log('');

    // Verify the change
    console.log('🔍 Verifying table structure...');
    const [columns] = await database.execute('DESCRIBE student_profiles');
    
    const sectionColumn = columns.find(col => col.Field === 'section');
    if (sectionColumn) {
      console.log('✅ Section column found:');
      console.log('   Field:', sectionColumn.Field);
      console.log('   Type:', sectionColumn.Type);
      console.log('   Null:', sectionColumn.Null);
      console.log('   Default:', sectionColumn.Default);
      console.log('   Extra:', sectionColumn.Extra);
    } else {
      console.log('⚠️  Section column not found in table');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Error details:', error);
    process.exit(1);
  }
}

// Run the migration
runMigration();

