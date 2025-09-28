/**
 * Create test students with valid Philippine phone numbers for SMS testing
 */

const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

// Database configuration
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'db_ebulletin_system'
};

// Test students with valid Philippine phone numbers
const testStudents = [
  {
    email: 'student1@vcba.edu.ph',
    student_number: 'VCBA-2024-001',
    password: 'password123',
    first_name: 'Juan',
    last_name: 'Dela Cruz',
    phone_number: '+639123456789',
    grade_level: 7
  },
  {
    email: 'student2@vcba.edu.ph',
    student_number: 'VCBA-2024-002',
    password: 'password123',
    first_name: 'Maria',
    last_name: 'Santos',
    phone_number: '+639987654321',
    grade_level: 8
  },
  {
    email: 'student3@vcba.edu.ph',
    student_number: 'VCBA-2024-003',
    password: 'password123',
    first_name: 'Jose',
    last_name: 'Rizal',
    phone_number: '+639111222333',
    grade_level: 9
  },
  {
    email: 'student4@vcba.edu.ph',
    student_number: 'VCBA-2024-004',
    password: 'password123',
    first_name: 'Andres',
    last_name: 'Bonifacio',
    phone_number: '+639444555666',
    grade_level: 10
  },
  {
    email: 'student5@vcba.edu.ph',
    student_number: 'VCBA-2024-005',
    password: 'password123',
    first_name: 'Gabriela',
    last_name: 'Silang',
    phone_number: '+639777888999',
    grade_level: 11
  }
];

async function createTestStudents() {
  let connection;
  
  try {
    console.log('🔗 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database');

    for (const student of testStudents) {
      try {
        console.log(`\n👤 Creating student: ${student.first_name} ${student.last_name}`);

        // Check if student already exists
        const [existingStudents] = await connection.execute(
          'SELECT student_id FROM student_accounts WHERE email = ? OR student_number = ?',
          [student.email, student.student_number]
        );

        if (existingStudents.length > 0) {
          console.log(`⚠️ Student already exists: ${student.email}`);
          continue;
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(student.password, 10);

        // Insert student account
        const [accountResult] = await connection.execute(
          `INSERT INTO student_accounts (email, password, student_number, is_active, email_verified, created_at, updated_at)
           VALUES (?, ?, ?, 1, 1, NOW(), NOW())`,
          [student.email, hashedPassword, student.student_number]
        );

        const studentId = accountResult.insertId;
        console.log(`✅ Created student account with ID: ${studentId}`);

        // Insert student profile
        await connection.execute(
          `INSERT INTO student_profiles (student_id, first_name, last_name, phone_number, grade_level, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
          [studentId, student.first_name, student.last_name, student.phone_number, student.grade_level]
        );

        console.log(`✅ Created student profile for: ${student.first_name} ${student.last_name}`);
        console.log(`📱 Phone: ${student.phone_number}, Grade: ${student.grade_level}`);

      } catch (error) {
        console.error(`❌ Error creating student ${student.first_name} ${student.last_name}:`, error.message);
      }
    }

    // Verify created students
    console.log('\n📊 Verifying created students...');
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
      INNER JOIN student_profiles p ON s.student_id = p.student_id
      WHERE s.email LIKE '%@vcba.edu.ph'
      ORDER BY p.grade_level, p.last_name
    `);

    console.log(`\n✅ Found ${students.length} VCBA test students:`);
    students.forEach(student => {
      console.log(`  - ${student.first_name} ${student.last_name} (Grade ${student.grade_level}) - ${student.phone_number}`);
    });

    console.log('\n🎉 Test students created successfully!');
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
      console.log('🔗 Database connection closed');
    }
  }
}

// Run the script
createTestStudents();
