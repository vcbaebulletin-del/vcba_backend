const commentModel = require('./src/models/CommentModel');

async function testEndToEndFlow() {
  console.log('🧪 Testing End-to-End Anonymous Comment Flow...\n');

  try {
    // Simulate the exact data flow from frontend to backend
    console.log('📝 Step 1: Simulating Frontend Data (AdminCommentSection)');
    const frontendData = {
      announcement_id: 83,
      comment_text: 'E2E Test: Anonymous comment from frontend simulation',
      is_anonymous: true // Boolean true from checkbox
    };
    
    console.log('Frontend data:', {
      is_anonymous: frontendData.is_anonymous,
      is_anonymous_type: typeof frontendData.is_anonymous
    });

    console.log('\n📝 Step 2: Simulating CommentService Processing');
    // This is what happens in commentService.ts
    const serviceData = {
      ...frontendData,
      is_anonymous: frontendData.is_anonymous || false // Line 245 in commentService.ts
    };
    
    console.log('Service data:', {
      is_anonymous: serviceData.is_anonymous,
      is_anonymous_type: typeof serviceData.is_anonymous
    });

    console.log('\n📝 Step 3: Simulating Backend Controller Processing');
    // This is what happens in CommentController.js
    const { is_anonymous } = serviceData;
    const processedIsAnonymous = is_anonymous === true || is_anonymous === 'true' || is_anonymous === 1 || is_anonymous === '1' ? 1 : 0;
    
    console.log('Controller processing:', {
      received_is_anonymous: is_anonymous,
      received_type: typeof is_anonymous,
      processed_is_anonymous: processedIsAnonymous,
      processed_type: typeof processedIsAnonymous
    });

    console.log('\n📝 Step 4: Simulating CommentModel Processing');
    const modelData = {
      announcement_id: frontendData.announcement_id,
      user_type: 'admin',
      user_id: 32, // Admin with profile
      comment_text: frontendData.comment_text,
      is_anonymous: processedIsAnonymous
    };

    // This is what happens in CommentModel.js line 180
    const finalIsAnonymous = modelData.is_anonymous === true || modelData.is_anonymous === 'true' || modelData.is_anonymous === 1 || modelData.is_anonymous === '1' ? 1 : 0;
    
    console.log('Model processing:', {
      received_is_anonymous: modelData.is_anonymous,
      received_type: typeof modelData.is_anonymous,
      final_is_anonymous: finalIsAnonymous,
      final_type: typeof finalIsAnonymous
    });

    console.log('\n📝 Step 5: Creating Comment in Database');
    const finalCommentData = {
      ...modelData,
      is_anonymous: finalIsAnonymous
    };

    const createdComment = await commentModel.createComment(finalCommentData);
    console.log('✅ Comment created with ID:', createdComment.comment_id);

    console.log('\n📝 Step 6: Retrieving Comment to Verify Display');
    const comments = await commentModel.getCommentsByAnnouncement(83, { limit: 5 }, { userId: 32, userType: 'admin' });
    
    const testComment = comments.comments.find(c => c.comment_id === createdComment.comment_id);
    if (testComment) {
      console.log('Retrieved comment:', {
        comment_id: testComment.comment_id,
        is_anonymous: testComment.is_anonymous,
        author_name: testComment.author_name,
        user_type: testComment.user_type,
        comment_text: testComment.comment_text.substring(0, 50) + '...'
      });

      // Verify the complete flow
      if (testComment.is_anonymous === 1 && testComment.author_name === 'Anonymous Admin') {
        console.log('\n🎉 SUCCESS: End-to-end anonymous comment flow working perfectly!');
        console.log('✅ Frontend boolean true → Backend integer 1 → Database storage → Anonymous display');
      } else {
        console.log('\n❌ FAILURE: End-to-end flow has issues');
        console.log('Expected: is_anonymous=1, author_name="Anonymous Admin"');
        console.log('Actual: is_anonymous=' + testComment.is_anonymous + ', author_name="' + testComment.author_name + '"');
      }
    } else {
      console.log('❌ Could not find the created comment');
    }

    console.log('\n📝 Step 7: Testing Regular Comment Flow');
    const regularCommentData = {
      announcement_id: 83,
      user_type: 'admin',
      user_id: 32,
      comment_text: 'E2E Test: Regular comment (not anonymous)',
      is_anonymous: false // Boolean false
    };

    const regularComment = await commentModel.createComment(regularCommentData);
    console.log('✅ Regular comment created with ID:', regularComment.comment_id);

    const regularComments = await commentModel.getCommentsByAnnouncement(83, { limit: 5 }, { userId: 32, userType: 'admin' });
    const testRegularComment = regularComments.comments.find(c => c.comment_id === regularComment.comment_id);
    
    if (testRegularComment) {
      console.log('Regular comment:', {
        comment_id: testRegularComment.comment_id,
        is_anonymous: testRegularComment.is_anonymous,
        author_name: testRegularComment.author_name,
        user_type: testRegularComment.user_type
      });

      if (testRegularComment.is_anonymous === 0 && testRegularComment.author_name && testRegularComment.author_name !== 'Anonymous Admin') {
        console.log('✅ SUCCESS: Regular comment flow working correctly!');
      } else {
        console.log('❌ FAILURE: Regular comment flow has issues');
      }
    }

  } catch (error) {
    console.error('❌ End-to-end test failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    process.exit(0);
  }
}

testEndToEndFlow();
