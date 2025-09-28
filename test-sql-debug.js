const commentModel = require('./src/models/CommentModel');

async function testSQLQuery() {
  console.log('🔍 Testing SQL Query for Anonymous Comments...\n');

  try {
    // Get comments using the model method
    const result = await commentModel.getCommentsByAnnouncement(83, { limit: 10 }, { userId: 32, userType: 'admin' });
    
    console.log('Comments with author names:');
    const testCommentIds = [48, 49, 51, 52, 53];
    
    result.comments
      .filter(c => testCommentIds.includes(c.comment_id))
      .forEach(c => {
        console.log(`ID: ${c.comment_id}, Anonymous: ${c.is_anonymous}, Author: "${c.author_name}", UserType: ${c.user_type}`);
        
        // Analyze the issue
        if (c.is_anonymous === 1) {
          if (c.user_type === 'admin' && c.author_name === 'Anonymous Admin') {
            console.log('  ✅ CORRECT: Anonymous admin shows "Anonymous Admin"');
          } else if (c.user_type === 'admin' && c.author_name !== 'Anonymous Admin') {
            console.log('  ❌ ERROR: Anonymous admin should show "Anonymous Admin" but shows:', c.author_name);
          }
        } else {
          if (c.author_name && c.author_name !== 'Anonymous Admin') {
            console.log('  ✅ CORRECT: Regular comment shows real name');
          } else {
            console.log('  ❌ ERROR: Regular comment should show real name but shows:', c.author_name);
          }
        }
      });

    console.log('\n🔍 Raw SQL Query Analysis...');
    
    // Let's also test the raw SQL query to see what's happening
    const db = require('./src/config/database');
    const rawQuery = `
      SELECT 
        c.comment_id,
        c.user_id,
        c.user_type,
        c.is_anonymous,
        c.comment_text,
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

    const rawResults = await db.query(rawQuery);
    console.log('\nRaw SQL Results:');
    rawResults.forEach(row => {
      console.log(`ID: ${row.comment_id}, Anonymous: ${row.is_anonymous}, Author: "${row.author_name}"`);
    });

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    process.exit(0);
  }
}

testSQLQuery();
