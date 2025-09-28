const commentModel = require('./src/models/CommentModel');

async function testFinalVerification() {
  console.log('🎯 Final Verification of Anonymous Comment Fix...\n');

  try {
    // Get the latest comments
    const result = await commentModel.getCommentsByAnnouncement(83, { limit: 20 }, { userId: 32, userType: 'admin' });
    
    console.log('Latest test comments (ID 59, 60):');
    const testComments = result.comments.filter(c => [59, 60].includes(c.comment_id));
    
    testComments.forEach(c => {
      console.log(`ID: ${c.comment_id}, Anonymous: ${c.is_anonymous}, Author: "${c.author_name}", UserType: ${c.user_type}`);
      
      if (c.comment_id === 59) {
        // This should be anonymous
        if (c.is_anonymous === 1 && c.author_name === 'Anonymous Admin') {
          console.log('  ✅ PERFECT: Anonymous comment shows "Anonymous Admin"');
        } else {
          console.log('  ❌ ERROR: Anonymous comment issue');
        }
      } else if (c.comment_id === 60) {
        // This should show real name
        if (c.is_anonymous === 0 && c.author_name && c.author_name !== 'Anonymous Admin') {
          console.log('  ✅ PERFECT: Regular comment shows real name');
        } else {
          console.log('  ❌ ERROR: Regular comment issue');
        }
      }
    });

    if (testComments.length === 0) {
      console.log('❌ No test comments found. Let me check all recent comments...');
      
      const allComments = result.comments.slice(0, 10);
      console.log('\nRecent comments:');
      allComments.forEach(c => {
        console.log(`ID: ${c.comment_id}, Anonymous: ${c.is_anonymous}, Author: "${c.author_name}"`);
      });
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    process.exit(0);
  }
}

testFinalVerification();
