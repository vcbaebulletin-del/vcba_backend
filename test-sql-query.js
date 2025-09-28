const commentModel = require('./src/models/CommentModel');

async function testSQLQuery() {
  console.log('🔍 Testing SQL Query Results for Anonymous Comments...\n');

  try {
    // Test announcement comments
    console.log('📝 Testing announcement comments...');
    const result = await commentModel.getCommentsByAnnouncement(83, { limit: 10 }, { userId: 32, userType: 'admin' });
    
    console.log('\n🔍 Comment Analysis:');
    result.comments.forEach((comment, index) => {
      console.log(`\nComment ${index + 1}:`);
      console.log(`  - ID: ${comment.comment_id}`);
      console.log(`  - Text: "${comment.comment_text.substring(0, 50)}..."`);
      console.log(`  - is_anonymous: ${comment.is_anonymous}`);
      console.log(`  - author_name: "${comment.author_name}"`);
      console.log(`  - user_type: ${comment.user_type}`);
      console.log(`  - user_id: ${comment.user_id}`);
      
      // Check if the fix is working
      if (comment.is_anonymous === 1) {
        if (comment.user_type === 'admin' && comment.author_name === 'Anonymous Admin') {
          console.log('  ✅ PASS: Anonymous admin comment shows "Anonymous Admin"');
        } else if (comment.user_type === 'student' && comment.author_name === 'Anonymous Student') {
          console.log('  ✅ PASS: Anonymous student comment shows "Anonymous Student"');
        } else {
          console.log(`  ❌ FAIL: Anonymous comment shows "${comment.author_name}" instead of "Anonymous ${comment.user_type}"`);
        }
      } else {
        if (comment.author_name && comment.author_name !== 'Anonymous Admin' && comment.author_name !== 'Anonymous Student') {
          console.log('  ✅ PASS: Regular comment shows real name');
        } else {
          console.log(`  ❌ FAIL: Regular comment shows "${comment.author_name}" instead of real name`);
        }
      }
    });

    console.log('\n🎉 SQL Query test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    process.exit(0);
  }
}

// Run the test
testSQLQuery();
