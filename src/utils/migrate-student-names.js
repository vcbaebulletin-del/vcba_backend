const mysql = require('mysql2/promise');
const config = require('../config/database');

async function migrateStudentNames() {
  let connection;
  
  try {
    // Create database connection
    connection = await mysql.createConnection(config);
    console.log('✅ Connected to database');

    // Check current table structure
    console.log('\n📋 Current student_profiles table structure:');
    const [columns] = await connection.execute('DESCRIBE student_profiles');
    console.table(columns);

    // Check if migration is needed
    const hasFullName = columns.some(col => col.Field === 'full_name');
    const hasFirstName = columns.some(col => col.Field === 'first_name');

    if (!hasFullName && hasFirstName) {
      console.log('✅ Migration already completed - new name fields exist');
      return;
    }

    if (!hasFullName) {
      console.log('❌ No full_name field found - nothing to migrate');
      return;
    }

    console.log('\n🔄 Starting migration...');

    // Step 1: Add new name columns
    console.log('1. Adding new name columns...');
    await connection.execute(`
      ALTER TABLE student_profiles 
      ADD COLUMN first_name VARCHAR(100) NOT NULL DEFAULT '' AFTER student_id,
      ADD COLUMN middle_name VARCHAR(100) DEFAULT NULL AFTER first_name,
      ADD COLUMN last_name VARCHAR(100) NOT NULL DEFAULT '' AFTER middle_name,
      ADD COLUMN suffix VARCHAR(20) DEFAULT NULL AFTER last_name
    `);
    console.log('✅ New columns added');

    // Step 2: Migrate existing data
    console.log('2. Migrating existing data...');
    
    // Get all existing records
    const [students] = await connection.execute('SELECT profile_id, full_name FROM student_profiles WHERE full_name IS NOT NULL AND full_name != ""');
    console.log(`Found ${students.length} student records to migrate`);

    for (const student of students) {
      const fullName = student.full_name.trim();
      const nameParts = fullName.split(' ').filter(part => part.length > 0);
      
      let firstName = '';
      let middleName = null;
      let lastName = '';
      let suffix = null;

      if (nameParts.length === 1) {
        firstName = nameParts[0];
      } else if (nameParts.length === 2) {
        firstName = nameParts[0];
        lastName = nameParts[1];
      } else if (nameParts.length === 3) {
        firstName = nameParts[0];
        middleName = nameParts[1];
        lastName = nameParts[2];
      } else if (nameParts.length >= 4) {
        firstName = nameParts[0];
        middleName = nameParts.slice(1, -1).join(' ');
        lastName = nameParts[nameParts.length - 1];
      }

      // Check for common suffixes
      const suffixes = ['Jr.', 'Sr.', 'III', 'IV', 'V', 'Jr', 'Sr'];
      if (lastName && suffixes.includes(lastName)) {
        suffix = lastName;
        if (middleName) {
          const middleParts = middleName.split(' ');
          lastName = middleParts.pop();
          middleName = middleParts.length > 0 ? middleParts.join(' ') : null;
        } else {
          lastName = firstName;
          firstName = '';
        }
      }

      // Update the record
      await connection.execute(`
        UPDATE student_profiles 
        SET first_name = ?, middle_name = ?, last_name = ?, suffix = ?
        WHERE profile_id = ?
      `, [firstName, middleName, lastName, suffix, student.profile_id]);

      console.log(`✅ Migrated: ${fullName} -> ${firstName} | ${middleName || ''} | ${lastName} | ${suffix || ''}`);
    }

    // Step 3: Drop the old full_name column
    console.log('3. Dropping old full_name column...');
    await connection.execute('ALTER TABLE student_profiles DROP COLUMN full_name');
    console.log('✅ Old column dropped');

    // Step 4: Add indexes
    console.log('4. Adding indexes...');
    await connection.execute(`
      ALTER TABLE student_profiles 
      ADD INDEX idx_student_first_name (first_name),
      ADD INDEX idx_student_last_name (last_name)
    `);
    console.log('✅ Indexes added');

    console.log('\n🎉 Migration completed successfully!');

    // Show final structure
    console.log('\n📋 Final student_profiles table structure:');
    const [finalColumns] = await connection.execute('DESCRIBE student_profiles');
    console.table(finalColumns);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateStudentNames()
    .then(() => {
      console.log('✅ Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateStudentNames };
