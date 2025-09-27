const express = require('express');
const router = express.Router();
const Database = require('../config/database');

// Migration endpoint for student names
router.post('/migrate-student-names', async (req, res) => {
  const db = new Database();
  
  try {
    console.log('🔄 Starting student names migration...');

    // Check current table structure
    const columns = await db.findMany('DESCRIBE student_profiles');
    console.log('📋 Current table structure:', columns);

    const hasFullName = columns.some(col => col.Field === 'full_name');
    const hasFirstName = columns.some(col => col.Field === 'first_name');

    if (!hasFullName && hasFirstName) {
      return res.json({
        success: true,
        message: 'Migration already completed - new name fields exist',
        data: { status: 'already_migrated' }
      });
    }

    if (!hasFullName) {
      return res.json({
        success: false,
        message: 'No full_name field found - nothing to migrate',
        data: { status: 'no_migration_needed' }
      });
    }

    // Step 1: Add new name columns
    console.log('1. Adding new name columns...');
    await db.execute(`
      ALTER TABLE student_profiles 
      ADD COLUMN first_name VARCHAR(100) NOT NULL DEFAULT '' AFTER student_id,
      ADD COLUMN middle_name VARCHAR(100) DEFAULT NULL AFTER first_name,
      ADD COLUMN last_name VARCHAR(100) NOT NULL DEFAULT '' AFTER middle_name,
      ADD COLUMN suffix VARCHAR(20) DEFAULT NULL AFTER last_name
    `);
    console.log('✅ New columns added');

    // Step 2: Migrate existing data
    console.log('2. Migrating existing data...');
    
    const students = await db.findMany('SELECT profile_id, full_name FROM student_profiles WHERE full_name IS NOT NULL AND full_name != ""');
    console.log(`Found ${students.length} student records to migrate`);

    const migratedStudents = [];

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
      await db.execute(`
        UPDATE student_profiles 
        SET first_name = ?, middle_name = ?, last_name = ?, suffix = ?
        WHERE profile_id = ?
      `, [firstName, middleName, lastName, suffix, student.profile_id]);

      migratedStudents.push({
        original: fullName,
        migrated: { firstName, middleName, lastName, suffix }
      });

      console.log(`✅ Migrated: ${fullName} -> ${firstName} | ${middleName || ''} | ${lastName} | ${suffix || ''}`);
    }

    // Step 3: Drop the old full_name column
    console.log('3. Dropping old full_name column...');
    await db.execute('ALTER TABLE student_profiles DROP COLUMN full_name');
    console.log('✅ Old column dropped');

    // Step 4: Add indexes
    console.log('4. Adding indexes...');
    try {
      await db.execute(`
        ALTER TABLE student_profiles 
        ADD INDEX idx_student_first_name (first_name),
        ADD INDEX idx_student_last_name (last_name)
      `);
      console.log('✅ Indexes added');
    } catch (indexError) {
      console.log('⚠️ Indexes may already exist:', indexError.message);
    }

    console.log('🎉 Migration completed successfully!');

    // Get final structure
    const finalColumns = await db.findMany('DESCRIBE student_profiles');

    res.json({
      success: true,
      message: 'Student names migration completed successfully',
      data: {
        status: 'completed',
        migratedCount: migratedStudents.length,
        migratedStudents: migratedStudents,
        finalTableStructure: finalColumns
      }
    });

  } catch (error) {
    console.error('❌ Migration failed:', error);
    res.status(500).json({
      success: false,
      message: 'Migration failed',
      error: error.message
    });
  }
});

// Check migration status
router.get('/migration-status', async (req, res) => {
  const db = new Database();
  
  try {
    const columns = await db.findMany('DESCRIBE student_profiles');
    
    const hasFullName = columns.some(col => col.Field === 'full_name');
    const hasFirstName = columns.some(col => col.Field === 'first_name');
    const hasMiddleName = columns.some(col => col.Field === 'middle_name');
    const hasLastName = columns.some(col => col.Field === 'last_name');
    const hasSuffix = columns.some(col => col.Field === 'suffix');

    let status = 'unknown';
    if (hasFirstName && hasLastName && !hasFullName) {
      status = 'migrated';
    } else if (hasFullName && !hasFirstName) {
      status = 'needs_migration';
    } else if (hasFullName && hasFirstName) {
      status = 'partial_migration';
    }

    res.json({
      success: true,
      data: {
        status,
        tableStructure: columns,
        fields: {
          hasFullName,
          hasFirstName,
          hasMiddleName,
          hasLastName,
          hasSuffix
        }
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to check migration status',
      error: error.message
    });
  }
});

module.exports = router;
