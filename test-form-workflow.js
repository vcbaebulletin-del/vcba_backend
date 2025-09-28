const db = require('./src/config/database');

async function testFormWorkflow() {
  console.log('🔍 Testing Form Workflow for Suffix Bug...\n');

  try {
    // Step 1: Create a test student to edit
    console.log('📝 Step 1: Creating a test student...');
    
    const testEmail = `test.workflow.${Date.now()}@test.com`;
    const testStudentNumber = `WORKFLOW-${Date.now()}`;
    
    const accountResult = await db.execute(`
      INSERT INTO student_accounts (email, password, student_number, is_active, created_at, updated_at)
      VALUES (?, 'test123', ?, 1, NOW(), NOW())
    `, [testEmail, testStudentNumber]);
    
    const testStudentId = accountResult.insertId;
    console.log(`✅ Created test student account ID: ${testStudentId}`);

    // Insert initial profile with a suffix
    await db.execute(`
      INSERT INTO student_profiles (student_id, first_name, last_name, suffix, phone_number, grade_level, created_at, updated_at)
      VALUES (?, 'Test', 'Student', 'Jr.', '1234567890', 11, NOW(), NOW())
    `, [testStudentId]);
    
    console.log('✅ Created initial profile with "Jr." suffix');

    // Step 2: Simulate loading the student for editing (what the frontend does)
    console.log('\n📝 Step 2: Simulating frontend data loading...');
    
    const studentData = await db.findOne(`
      SELECT
        s.student_id,
        s.email,
        s.student_number,
        s.is_active,
        s.last_login,
        s.created_by,
        s.created_at as account_created_at,
        s.updated_at as account_updated_at,
        p.profile_id,
        p.first_name,
        p.middle_name,
        p.last_name,
        p.suffix,
        p.phone_number,
        p.grade_level,
        p.parent_guardian_name,
        p.parent_guardian_phone,
        p.address,
        p.profile_picture,
        p.created_at as profile_created_at,
        p.updated_at as profile_updated_at
      FROM student_accounts s
      LEFT JOIN student_profiles p ON s.student_id = p.student_id
      WHERE s.student_id = ?
    `, [testStudentId]);

    console.log('Student data loaded from database:');
    console.log(`  first_name: "${studentData.first_name}"`);
    console.log(`  last_name: "${studentData.last_name}"`);
    console.log(`  suffix: "${studentData.suffix}"`);

    // Step 3: Simulate frontend form data initialization (from StudentManagement.tsx line 412)
    console.log('\n📝 Step 3: Simulating frontend form initialization...');
    
    const formData = {
      studentNumber: studentData.student_number,
      email: studentData.email,
      firstName: studentData.first_name,
      middleName: studentData.middle_name || '',
      lastName: studentData.last_name,
      suffix: studentData.suffix || '', // This is line 412 in StudentManagement.tsx
      phoneNumber: studentData.phone_number,
      gradeLevel: studentData.grade_level,
      parentGuardianName: studentData.parent_guardian_name || '',
      parentGuardianPhone: studentData.parent_guardian_phone || '',
      address: studentData.address || ''
    };

    console.log('Form data initialized:');
    console.log(`  formData.suffix: "${formData.suffix}"`);
    console.log(`  Type: ${typeof formData.suffix}`);

    // Step 4: Simulate user selecting "None" in the dropdown
    console.log('\n📝 Step 4: Simulating user selecting "None" (empty string)...');
    
    // User selects "None" which has value="" in SUFFIX_OPTIONS
    formData.suffix = ''; // This is what happens when user selects "None"
    
    console.log(`  After selecting "None": formData.suffix = "${formData.suffix}"`);

    // Step 5: Simulate form submission (from StudentManagement.tsx line 464)
    console.log('\n📝 Step 5: Simulating form submission...');
    
    const updateData = {
      student_number: formData.studentNumber,
      email: formData.email,
      first_name: formData.firstName,
      middle_name: formData.middleName || undefined,
      last_name: formData.lastName,
      suffix: formData.suffix || undefined, // This is line 464 in StudentManagement.tsx
      phone_number: formData.phoneNumber,
      grade_level: formData.gradeLevel,
      parent_guardian_name: formData.parentGuardianName || undefined,
      parent_guardian_phone: formData.parentGuardianPhone || undefined,
      address: formData.address || undefined
    };

    console.log('Update data prepared:');
    console.log(`  updateData.suffix: ${updateData.suffix}`);
    console.log(`  Type: ${typeof updateData.suffix}`);

    // Step 6: Simulate backend processing (AdminController.js)
    console.log('\n📝 Step 6: Simulating backend update processing...');
    
    // This simulates what happens in AdminController.js updateStudent method
    const profileData = {
      first_name: updateData.first_name,
      middle_name: updateData.middle_name,
      last_name: updateData.last_name,
      suffix: updateData.suffix,
      phone_number: updateData.phone_number,
      grade_level: updateData.grade_level,
      parent_guardian_name: updateData.parent_guardian_name,
      parent_guardian_phone: updateData.parent_guardian_phone,
      address: updateData.address,
    };

    console.log('Profile data for database update:');
    console.log(`  profileData.suffix: ${profileData.suffix}`);
    console.log(`  Type: ${typeof profileData.suffix}`);

    // Step 7: Simulate database update
    console.log('\n📝 Step 7: Performing database update...');
    
    await db.execute(`
      UPDATE student_profiles 
      SET first_name = ?, middle_name = ?, last_name = ?, suffix = ?, 
          phone_number = ?, grade_level = ?, parent_guardian_name = ?, 
          parent_guardian_phone = ?, address = ?, updated_at = NOW()
      WHERE student_id = ?
    `, [
      profileData.first_name,
      profileData.middle_name,
      profileData.last_name,
      profileData.suffix,
      profileData.phone_number,
      profileData.grade_level,
      profileData.parent_guardian_name,
      profileData.parent_guardian_phone,
      profileData.address,
      testStudentId
    ]);

    console.log('✅ Database update completed');

    // Step 8: Verify what was actually stored
    console.log('\n📝 Step 8: Verifying stored data...');
    
    const updatedStudent = await db.findOne(`
      SELECT first_name, last_name, suffix,
        CASE 
          WHEN suffix IS NULL THEN 'NULL'
          WHEN suffix = '' THEN 'EMPTY_STRING'
          ELSE CONCAT('VALUE: "', suffix, '"')
        END as suffix_status
      FROM student_profiles 
      WHERE student_id = ?
    `, [testStudentId]);

    console.log('Final stored data:');
    console.log(`  first_name: "${updatedStudent.first_name}"`);
    console.log(`  last_name: "${updatedStudent.last_name}"`);
    console.log(`  suffix: ${updatedStudent.suffix_status}`);

    if (updatedStudent.suffix_status === 'NULL' || updatedStudent.suffix_status === 'EMPTY_STRING') {
      console.log('✅ SUCCESS: Suffix correctly cleared when "None" was selected');
    } else {
      console.log('❌ BUG: Suffix was not cleared properly!');
      console.log('🚨 This indicates a bug in the form processing workflow');
    }

    // Step 9: Test the reverse - setting a suffix
    console.log('\n📝 Step 9: Testing setting a suffix...');
    
    formData.suffix = 'Sr.'; // User selects "Sr."
    const updateData2 = {
      suffix: formData.suffix || undefined
    };

    await db.execute(`
      UPDATE student_profiles 
      SET suffix = ?
      WHERE student_id = ?
    `, [updateData2.suffix, testStudentId]);

    const updatedStudent2 = await db.findOne(`
      SELECT suffix,
        CASE 
          WHEN suffix IS NULL THEN 'NULL'
          WHEN suffix = '' THEN 'EMPTY_STRING'
          ELSE CONCAT('VALUE: "', suffix, '"')
        END as suffix_status
      FROM student_profiles 
      WHERE student_id = ?
    `, [testStudentId]);

    console.log(`After setting suffix to "Sr.": ${updatedStudent2.suffix_status}`);

    if (updatedStudent2.suffix_status === 'VALUE: "Sr."') {
      console.log('✅ SUCCESS: Suffix correctly set when valid value selected');
    } else {
      console.log('❌ BUG: Suffix was not set properly!');
    }

    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    await db.execute('DELETE FROM student_profiles WHERE student_id = ?', [testStudentId]);
    await db.execute('DELETE FROM student_accounts WHERE student_id = ?', [testStudentId]);
    console.log('✅ Test data cleaned up');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    process.exit(0);
  }
}

testFormWorkflow();
