/**
 * Check the actual database schema for student tables
 */

const mysql = require('mysql2/promise');

// Database configuration
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'db_ebulletin_system'
};

async function checkSchema() {
  let connection;
  
  try {
    console.log('🔗 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database');

    // Check student_accounts table structure
    console.log('\n📋 student_accounts table structure:');
    const [accountColumns] = await connection.execute('DESCRIBE student_accounts');
    accountColumns.forEach(col => {
      console.log(`  - ${col.Field} (${col.Type}) ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Key ? col.Key : ''} ${col.Default !== null ? `DEFAULT ${col.Default}` : ''}`);
    });

    // Check student_profiles table structure
    console.log('\n📋 student_profiles table structure:');
    const [profileColumns] = await connection.execute('DESCRIBE student_profiles');
    profileColumns.forEach(col => {
      console.log(`  - ${col.Field} (${col.Type}) ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Key ? col.Key : ''} ${col.Default !== null ? `DEFAULT ${col.Default}` : ''}`);
    });

    // Check existing students
    console.log('\n👥 Existing students:');
    const [students] = await connection.execute(`
      SELECT 
        s.student_id,
        s.email,
        s.student_number,
        s.is_active,
        p.first_name,
        p.last_name,
        p.phone_number,
        p.grade_level
      FROM student_accounts s
      LEFT JOIN student_profiles p ON s.student_id = p.student_id
      LIMIT 10
    `);

    if (students.length > 0) {
      students.forEach(student => {
        console.log(`  - ${student.first_name || 'N/A'} ${student.last_name || 'N/A'} (${student.email}) - Phone: ${student.phone_number || 'N/A'}, Grade: ${student.grade_level || 'N/A'}`);
      });
    } else {
      console.log('  No students found');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔗 Database connection closed');
    }
  }
}

// Run the script
checkSchema();
