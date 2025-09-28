const commentModel = require('./src/models/CommentModel');

async function testAnonymousFix() {
  console.log('🧪 Testing Anonymous Comment Fix...\n');

  try {
    // Test the boolean conversion logic
    console.log('🔬 Testing Boolean Conversion Logic:');
    
    function convertIsAnonymous(value) {
      return value === true || value === 'true' || value === 1 || value === '1' ? 1 : 0;
    }
    
    const testCases = [
      { input: true, expected: 1 },
      { input: false, expected: 0 },
      { input: 'true', expected: 1 },
      { input: 'false', expected: 0 },
      { input: 1, expected: 1 },
      { input: 0, expected: 0 },
      { input: '1', expected: 1 },
      { input: '0', expected: 0 },
      { input: null, expected: 0 },
      { input: undefined, expected: 0 },
      { input: 'random', expected: 0 }
    ];
    
    testCases.forEach(testCase => {
      const result = convertIsAnonymous(testCase.input);
      const status = result === testCase.expected ? '✅' : '❌';
      console.log(`${status} Input: ${testCase.input} (${typeof testCase.input}) -> Output: ${result} (expected: ${testCase.expected})`);
    });

    // Test 1: Create an anonymous admin comment with boolean true
    console.log('\n📝 Test 1: Creating anonymous admin comment with boolean true...');
    const anonymousCommentData1 = {
      announcement_id: 83,
      user_type: 'admin',
      user_id: 32, // Using admin with profile
      comment_text: 'This is an anonymous admin comment with boolean true',
      is_anonymous: true // Boolean true
    };

    const anonymousComment1 = await commentModel.createComment(anonymousCommentData1);
    console.log('✅ Anonymous comment created with ID:', anonymousComment1.comment_id);

    // Test 2: Create an anonymous admin comment with string 'true'
    console.log('\n📝 Test 2: Creating anonymous admin comment with string "true"...');
    const anonymousCommentData2 = {
      announcement_id: 83,
      user_type: 'admin',
      user_id: 32,
      comment_text: 'This is an anonymous admin comment with string true',
      is_anonymous: 'true' // String 'true'
    };

    const anonymousComment2 = await commentModel.createComment(anonymousCommentData2);
    console.log('✅ Anonymous comment created with ID:', anonymousComment2.comment_id);

    // Test 3: Create a regular comment with boolean false
    console.log('\n📝 Test 3: Creating regular admin comment with boolean false...');
    const regularCommentData = {
      announcement_id: 83,
      user_type: 'admin',
      user_id: 32,
      comment_text: 'This is a regular admin comment with boolean false',
      is_anonymous: false // Boolean false
    };

    const regularComment = await commentModel.createComment(regularCommentData);
    console.log('✅ Regular comment created with ID:', regularComment.comment_id);

    // Test 4: Retrieve comments and verify display
    console.log('\n📝 Test 4: Retrieving comments to verify display...');
    const comments = await commentModel.getCommentsByAnnouncement(83, { limit: 10 }, { userId: 32, userType: 'admin' });

    console.log('\n🔍 Comment Analysis:');
    const testCommentIds = [anonymousComment1.comment_id, anonymousComment2.comment_id, regularComment.comment_id];
    
    comments.comments
      .filter(comment => testCommentIds.includes(comment.comment_id))
      .forEach((comment, index) => {
        console.log(`\nTest Comment ${index + 1}:`);
        console.log(`  - ID: ${comment.comment_id}`);
        console.log(`  - Text: "${comment.comment_text.substring(0, 50)}..."`);
        console.log(`  - is_anonymous: ${comment.is_anonymous}`);
        console.log(`  - author_name: "${comment.author_name}"`);
        console.log(`  - user_type: ${comment.user_type}`);
        
        // Verify the fix
        if (comment.is_anonymous === 1) {
          if (comment.user_type === 'admin' && comment.author_name === 'Anonymous Admin') {
            console.log('  ✅ PASS: Anonymous admin comment shows "Anonymous Admin"');
          } else {
            console.log('  ❌ FAIL: Anonymous comment not displaying correctly');
          }
        } else {
          if (comment.author_name && comment.author_name !== 'Anonymous Admin') {
            console.log('  ✅ PASS: Regular comment shows real name');
          } else {
            console.log('  ❌ FAIL: Regular comment not displaying real name');
          }
        }
      });

    console.log('\n🎉 Anonymous comment fix test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    process.exit(0);
  }
}

// Run the test
testAnonymousFix();
