const commentModel = require('./src/models/CommentModel');

async function testAnonymousComments() {
  console.log('🧪 Testing Anonymous Comment Functionality...\n');

  try {

    // Test 1: Create an anonymous admin comment
    console.log('📝 Test 1: Creating anonymous admin comment...');
    const anonymousCommentData = {
      announcement_id: 83, // Using existing announcement ID
      user_type: 'admin',
      user_id: 1, // Assuming admin user ID 1 exists
      comment_text: 'This is an anonymous admin comment for testing',
      is_anonymous: 1 // This should make the comment anonymous
    };

    const anonymousComment = await commentModel.createComment(anonymousCommentData);
    console.log('✅ Anonymous comment created with ID:', anonymousComment.comment_id);

    // Test 2: Create a regular (non-anonymous) admin comment
    console.log('\n📝 Test 2: Creating regular admin comment...');
    const regularCommentData = {
      announcement_id: 83,
      user_type: 'admin',
      user_id: 1,
      comment_text: 'This is a regular admin comment for testing',
      is_anonymous: 0 // This should show the admin's real name
    };

    const regularComment = await commentModel.createComment(regularCommentData);
    console.log('✅ Regular comment created with ID:', regularComment.comment_id);

    // Test 3: Retrieve comments and check author names
    console.log('\n📝 Test 3: Retrieving comments to verify author names...');
    const comments = await commentModel.getCommentsByAnnouncement(83, { limit: 10 }, { userId: 1, userType: 'admin' });

    console.log('\n🔍 Comment Analysis:');
    comments.comments.forEach((comment, index) => {
      console.log(`\nComment ${index + 1}:`);
      console.log(`  - ID: ${comment.comment_id}`);
      console.log(`  - Text: ${comment.comment_text}`);
      console.log(`  - is_anonymous: ${comment.is_anonymous}`);
      console.log(`  - author_name: ${comment.author_name}`);
      console.log(`  - user_type: ${comment.user_type}`);
      
      // Verify the fix
      if (comment.is_anonymous === 1) {
        if (comment.user_type === 'admin' && comment.author_name === 'Anonymous Admin') {
          console.log('  ✅ PASS: Anonymous admin comment shows "Anonymous Admin"');
        } else if (comment.user_type === 'student' && comment.author_name === 'Anonymous Student') {
          console.log('  ✅ PASS: Anonymous student comment shows "Anonymous Student"');
        } else {
          console.log('  ❌ FAIL: Anonymous comment not displaying correctly');
        }
      } else {
        if (comment.author_name && comment.author_name !== 'Anonymous Admin' && comment.author_name !== 'Anonymous Student') {
          console.log('  ✅ PASS: Regular comment shows real name');
        } else {
          console.log('  ❌ FAIL: Regular comment not displaying real name');
        }
      }
    });

    console.log('\n🎉 Anonymous comment functionality test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    process.exit(0);
  }
}

// Run the test
testAnonymousComments();
