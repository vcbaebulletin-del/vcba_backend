/**
 * Update existing students with valid Philippine phone numbers for SMS testing
 */

const mysql = require('mysql2/promise');

// Database configuration
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'db_ebulletin_system'
};

// Valid Philippine phone numbers for testing
const testPhoneNumbers = [
  '+639123456789',
  '+639987654321',
  '+639111222333',
  '+639444555666',
  '+639777888999',
  '+639555666777',
  '+639888999000',
  '+639222333444'
];

async function updateStudentPhones() {
  let connection;
  
  try {
    console.log('🔗 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database');

    // Get existing students
    console.log('\n👥 Finding existing students...');
    const [students] = await connection.execute(`
      SELECT 
        s.student_id,
        s.email,
        p.first_name,
        p.last_name,
        p.phone_number,
        p.grade_level
      FROM student_accounts s
      LEFT JOIN student_profiles p ON s.student_id = p.student_id
      WHERE s.is_active = 1
      LIMIT 8
    `);

    console.log(`Found ${students.length} active students`);

    if (students.length === 0) {
      console.log('❌ No active students found. Please create some students first.');
      return;
    }

    // Update each student with a test phone number
    for (let i = 0; i < students.length && i < testPhoneNumbers.length; i++) {
      const student = students[i];
      const phoneNumber = testPhoneNumbers[i];
      const gradeLevel = 7 + (i % 5); // Grades 7-11

      try {
        if (student.first_name) {
          // Update existing profile
          await connection.execute(
            `UPDATE student_profiles 
             SET phone_number = ?, grade_level = ?, updated_at = NOW()
             WHERE student_id = ?`,
            [phoneNumber, gradeLevel, student.student_id]
          );
          console.log(`✅ Updated ${student.first_name} ${student.last_name}: ${phoneNumber}, Grade ${gradeLevel}`);
        } else {
          // Create profile if it doesn't exist
          await connection.execute(
            `INSERT INTO student_profiles (student_id, first_name, last_name, phone_number, grade_level, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
            [student.student_id, `Student${i+1}`, `Test${i+1}`, phoneNumber, gradeLevel]
          );
          console.log(`✅ Created profile for ${student.email}: ${phoneNumber}, Grade ${gradeLevel}`);
        }
      } catch (error) {
        console.error(`❌ Error updating student ${student.student_id}:`, error.message);
      }
    }

    // Verify updated students
    console.log('\n📊 Verifying updated students...');
    const [updatedStudents] = await connection.execute(`
      SELECT 
        s.student_id,
        s.email,
        s.is_active,
        p.first_name,
        p.last_name,
        p.phone_number,
        p.grade_level
      FROM student_accounts s
      INNER JOIN student_profiles p ON s.student_id = p.student_id
      WHERE s.is_active = 1 
        AND p.phone_number IS NOT NULL 
        AND p.phone_number != ''
      ORDER BY p.grade_level, p.last_name
    `);

    console.log(`\n✅ Found ${updatedStudents.length} students with phone numbers:`);
    updatedStudents.forEach(student => {
      console.log(`  - ${student.first_name} ${student.last_name} (Grade ${student.grade_level}) - ${student.phone_number}`);
    });

    console.log('\n🎉 Students updated successfully!');
    console.log('\n📱 SMS Testing Instructions:');
    console.log('1. Create an announcement and mark it as "alert"');
    console.log('2. Set the grade level filter (7, 8, 9, 10, or 11)');
    console.log('3. Approve the announcement as super admin');
    console.log('4. Check server logs for SMS sending details');
    console.log('5. Create a calendar event and mark it as "alert"');
    console.log('6. Check server logs for SMS sending to all students');

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
updateStudentPhones();
