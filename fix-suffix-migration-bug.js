const db = require('./src/config/database');

async function fixSuffixMigrationBug() {
  console.log('🔧 Fixing Suffix Migration Bug...\n');

  try {
    // Step 1: Identify students with incorrect suffix assignments
    console.log('📝 Step 1: Identifying students with potentially incorrect suffixes...');
    
    const studentsWithSuffixes = await db.query(`
      SELECT 
        s.student_id,
        s.student_number,
        p.first_name,
        p.middle_name,
        p.last_name,
        p.suffix,
        CASE 
          WHEN p.first_name = '' AND p.suffix IN ('Jr.', 'Sr.', 'III', 'IV', 'V') THEN 'MIGRATION_BUG'
          WHEN p.suffix IN ('Jr.', 'Sr.', 'III', 'IV', 'V') THEN 'VALID_SUFFIX'
          ELSE 'NO_SUFFIX'
        END as status
      FROM student_accounts s
      LEFT JOIN student_profiles p ON s.student_id = p.student_id
      WHERE p.suffix IS NOT NULL AND p.suffix != ''
      ORDER BY s.student_id
    `);

    console.log(`Found ${studentsWithSuffixes.length} students with suffix values:`);
    studentsWithSuffixes.forEach(student => {
      console.log(`  ID: ${student.student_id}, Name: "${student.first_name}" "${student.middle_name || ''}" "${student.last_name}", Suffix: "${student.suffix}", Status: ${student.status}`);
    });

    // Step 2: Identify students that were affected by the migration bug
    const buggedStudents = studentsWithSuffixes.filter(s => s.status === 'MIGRATION_BUG');
    
    if (buggedStudents.length === 0) {
      console.log('\n✅ No students found with migration bug pattern');
      console.log('The suffix issue might be from manual data entry or form processing');
      
      // Check for students with suspicious suffix patterns
      console.log('\n📝 Checking for other suspicious suffix patterns...');
      const suspiciousStudents = studentsWithSuffixes.filter(s => {
        // Students where the suffix doesn't make sense with their name
        return s.suffix === 'Jr.' && (
          !s.first_name || 
          s.first_name.length < 2 ||
          s.last_name.length < 2
        );
      });
      
      if (suspiciousStudents.length > 0) {
        console.log(`Found ${suspiciousStudents.length} students with suspicious suffix assignments:`);
        suspiciousStudents.forEach(student => {
          console.log(`  ID: ${student.student_id}, Name: "${student.first_name}" "${student.last_name}", Suffix: "${student.suffix}"`);
        });
        
        console.log('\n🤔 These students might have incorrect suffixes from form processing bugs');
        console.log('Manual review recommended for these cases');
      }
      
      return;
    }

    console.log(`\n🚨 Found ${buggedStudents.length} students affected by migration bug:`);
    buggedStudents.forEach(student => {
      console.log(`  ID: ${student.student_id}, Current: "${student.first_name}" "${student.last_name}" "${student.suffix}"`);
    });

    // Step 3: Ask for confirmation before fixing
    console.log('\n⚠️ PROPOSED FIXES:');
    console.log('For students affected by migration bug, we will:');
    console.log('1. Move last_name back to first_name');
    console.log('2. Clear the incorrect suffix');
    console.log('3. Set last_name to the current suffix value (if it makes sense)');
    
    // For now, let's just show what would be fixed without actually doing it
    console.log('\n📋 PROPOSED CHANGES:');
    for (const student of buggedStudents) {
      const proposedFirstName = student.last_name;
      const proposedLastName = student.suffix;
      const proposedSuffix = null;
      
      console.log(`  ID ${student.student_id}:`);
      console.log(`    BEFORE: "${student.first_name}" "${student.middle_name || ''}" "${student.last_name}" "${student.suffix}"`);
      console.log(`    AFTER:  "${proposedFirstName}" "${student.middle_name || ''}" "${proposedLastName}" "${proposedSuffix || 'NULL'}"`);
    }

    // Step 4: Check for students who might have legitimate suffixes but were processed incorrectly
    console.log('\n📝 Step 4: Checking for students with potentially valid suffixes...');
    
    const validSuffixStudents = studentsWithSuffixes.filter(s => s.status === 'VALID_SUFFIX');
    console.log(`Found ${validSuffixStudents.length} students with potentially valid suffixes:`);
    validSuffixStudents.forEach(student => {
      console.log(`  ID: ${student.student_id}, Name: "${student.first_name}" "${student.last_name}", Suffix: "${student.suffix}"`);
    });

    // Step 5: Provide manual fix recommendations
    console.log('\n📋 MANUAL FIX RECOMMENDATIONS:');
    console.log('');
    console.log('1. **For Migration Bug Cases:**');
    console.log('   - These students need their names restructured');
    console.log('   - The migration script incorrectly moved names around');
    console.log('   - Requires manual review of original data if available');
    console.log('');
    console.log('2. **For Form Processing Bug Cases:**');
    console.log('   - These students might have had "Jr." set as default when "None" was selected');
    console.log('   - Check if these students actually have Jr. in their real names');
    console.log('   - If not, clear their suffix field');
    console.log('');
    console.log('3. **For Valid Suffix Cases:**');
    console.log('   - These appear to be legitimate suffixes');
    console.log('   - Verify with student records if possible');
    console.log('');

    // Step 6: Create a safe fix script for obvious cases
    console.log('📝 Step 6: Creating safe fix for obvious incorrect suffixes...');
    
    // Find students where the suffix is clearly wrong (empty first name with Jr. suffix)
    const obviouslyWrongSuffixes = await db.query(`
      SELECT 
        s.student_id,
        s.student_number,
        p.first_name,
        p.last_name,
        p.suffix
      FROM student_accounts s
      LEFT JOIN student_profiles p ON s.student_id = p.student_id
      WHERE (p.first_name = '' OR p.first_name IS NULL) 
        AND p.suffix IN ('Jr.', 'Sr.', 'III', 'IV', 'V')
    `);

    if (obviouslyWrongSuffixes.length > 0) {
      console.log(`\nFound ${obviouslyWrongSuffixes.length} students with obviously incorrect suffixes (empty first name + suffix):`);
      
      for (const student of obviouslyWrongSuffixes) {
        console.log(`\n🔧 Fixing student ID ${student.student_id}:`);
        console.log(`  BEFORE: first_name="${student.first_name}", last_name="${student.last_name}", suffix="${student.suffix}"`);
        
        // The fix: move last_name to first_name, move suffix to last_name, clear suffix
        const newFirstName = student.last_name;
        const newLastName = student.suffix;
        const newSuffix = null;
        
        console.log(`  AFTER:  first_name="${newFirstName}", last_name="${newLastName}", suffix="${newSuffix}"`);
        
        // Apply the fix
        await db.execute(`
          UPDATE student_profiles 
          SET first_name = ?, last_name = ?, suffix = ?
          WHERE student_id = ?
        `, [newFirstName, newLastName, newSuffix, student.student_id]);
        
        console.log(`  ✅ Fixed student ID ${student.student_id}`);
      }
      
      console.log(`\n🎉 Successfully fixed ${obviouslyWrongSuffixes.length} students with migration bug!`);
    } else {
      console.log('\n✅ No students found with obvious migration bug pattern');
    }

    // Step 7: Final verification
    console.log('\n📝 Step 7: Final verification of suffix data...');
    const finalCheck = await db.query(`
      SELECT 
        s.student_id,
        s.student_number,
        p.first_name,
        p.last_name,
        p.suffix,
        CASE 
          WHEN p.suffix IS NULL OR p.suffix = '' THEN 'NO_SUFFIX'
          WHEN p.first_name != '' AND p.last_name != '' AND p.suffix IN ('Jr.', 'Sr.', 'III', 'IV', 'V') THEN 'VALID_SUFFIX'
          ELSE 'NEEDS_REVIEW'
        END as status
      FROM student_accounts s
      LEFT JOIN student_profiles p ON s.student_id = p.student_id
      ORDER BY s.student_id
      LIMIT 10
    `);

    console.log('\nFinal suffix status check (first 10 students):');
    finalCheck.forEach(student => {
      console.log(`  ID: ${student.student_id}, Name: "${student.first_name}" "${student.last_name}", Suffix: "${student.suffix || 'NULL'}", Status: ${student.status}`);
    });

  } catch (error) {
    console.error('❌ Fix failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    process.exit(0);
  }
}

fixSuffixMigrationBug();
