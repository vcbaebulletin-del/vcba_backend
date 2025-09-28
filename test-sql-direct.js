const db = require('./src/config/database');

async function testSQLDirect() {
  console.log('🔍 Testing SQL Query Directly...\n');

  try {
    const sql = `
      SELECT 
        c.comment_id,
        c.is_anonymous,
        c.user_type,
        c.user_id,
        CASE
          WHEN c.is_anonymous = 1 AND c.user_type = 'admin' THEN 'Anonymous Admin'
          WHEN c.is_anonymous = 1 AND c.user_type = 'student' THEN 'Anonymous Student'
          WHEN c.user_type = 'admin' THEN CONCAT_WS(' ', ap.first_name, ap.middle_name, ap.last_name, ap.suffix)
          WHEN c.user_type = 'student' THEN CONCAT_WS(' ', sp.first_name, sp.middle_name, sp.last_name, sp.suffix)
          ELSE 'Anonymous'
        END as author_name
      FROM comments c
      LEFT JOIN admin_profiles ap ON c.user_type = 'admin' AND c.user_id = ap.admin_id
      LEFT JOIN student_profiles sp ON c.user_type = 'student' AND c.user_id = sp.student_id
      WHERE c.announcement_id = 83 AND c.comment_id IN (48, 49, 51, 52, 53)
      ORDER BY c.comment_id
    `;

    const results = await db.query(sql);
    
    console.log('Direct SQL query results:');
    results.forEach(r => {
      console.log(`ID: ${r.comment_id}, Anonymous: ${r.is_anonymous}, UserType: ${r.user_type}, UserID: ${r.user_id}, Author: "${r.author_name}"`);
      
      // Analyze each result
      if (r.is_anonymous === 1) {
        if (r.user_type === 'admin' && r.author_name === 'Anonymous Admin') {
          console.log('  ✅ CORRECT: Anonymous admin shows "Anonymous Admin"');
        } else {
          console.log('  ❌ ERROR: Anonymous comment should show "Anonymous Admin" but shows:', r.author_name);
        }
      } else {
        if (r.author_name && r.author_name !== 'Anonymous Admin' && r.author_name !== 'Anonymous') {
          console.log('  ✅ CORRECT: Regular comment shows real name');
        } else {
          console.log('  ❌ ERROR: Regular comment should show real name but shows:', r.author_name);
        }
      }
    });

    // Also test the public API endpoint that's being used
    console.log('\n🔍 Testing Public API Endpoint...');
    const fetch = globalThis.fetch || require('node-fetch');
    
    const response = await fetch('http://localhost:5000/api/comments?announcement_id=83&limit=10');
    const apiResult = await response.json();
    
    if (apiResult.success && apiResult.data && apiResult.data.comments) {
      console.log('\nPublic API results:');
      const testComments = apiResult.data.comments.filter(c => [48, 49, 51, 52, 53].includes(c.comment_id));
      
      testComments.forEach(c => {
        console.log(`API - ID: ${c.comment_id}, Anonymous: ${c.is_anonymous}, Author: "${c.author_name}"`);
      });
    } else {
      console.log('API Error:', apiResult);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    process.exit(0);
  }
}

testSQLDirect();
