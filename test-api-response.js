const fetch = globalThis.fetch || require('node-fetch');

async function testAPIResponse() {
  console.log('🔍 Testing API Response vs Database...\n');

  try {
    // Test 1: Get API response
    console.log('📝 Step 1: Getting API response...');
    const response = await fetch('http://localhost:5000/api/comments?announcement_id=83&limit=5');
    const apiResult = await response.json();
    
    if (apiResult.success && apiResult.data && apiResult.data.comments) {
      console.log('\nAPI Response Comments:');
      const testComments = apiResult.data.comments.filter(c => [48, 49, 51, 52, 53].includes(c.comment_id));
      
      testComments.forEach(c => {
        console.log(`API - ID: ${c.comment_id}, Anonymous: ${c.is_anonymous}, Author: "${c.author_name}"`);
        
        // Check if this matches expected behavior
        if (c.is_anonymous === 1) {
          if (c.author_name === 'Anonymous Admin') {
            console.log('  ✅ CORRECT: Anonymous comment shows "Anonymous Admin"');
          } else {
            console.log('  ❌ ERROR: Anonymous comment should show "Anonymous Admin" but shows:', c.author_name);
          }
        } else {
          if (c.author_name && c.author_name !== 'Anonymous Admin') {
            console.log('  ✅ CORRECT: Regular comment shows real name');
          } else if (c.author_name === '') {
            console.log('  ⚠️ INFO: Regular comment shows empty name (admin has no profile)');
          } else {
            console.log('  ❌ ERROR: Regular comment issue');
          }
        }
      });
    }

    // Test 2: Direct database query
    console.log('\n📝 Step 2: Direct database query...');
    const commentModel = require('./src/models/CommentModel');
    const dbResult = await commentModel.getCommentsByAnnouncement(83, { limit: 5 }, { userId: null, userType: null });
    
    console.log('\nDatabase Query Comments:');
    const dbTestComments = dbResult.comments.filter(c => [48, 49, 51, 52, 53].includes(c.comment_id));
    
    dbTestComments.forEach(c => {
      console.log(`DB - ID: ${c.comment_id}, Anonymous: ${c.is_anonymous}, Author: "${c.author_name}"`);
    });

    // Test 3: Compare results
    console.log('\n📝 Step 3: Comparing API vs Database...');
    
    const apiComments = apiResult.data.comments.filter(c => [48, 49, 51, 52, 53].includes(c.comment_id));
    const dbComments = dbResult.comments.filter(c => [48, 49, 51, 52, 53].includes(c.comment_id));
    
    for (let i = 0; i < Math.min(apiComments.length, dbComments.length); i++) {
      const apiComment = apiComments[i];
      const dbComment = dbComments[i];
      
      if (apiComment.comment_id === dbComment.comment_id) {
        console.log(`\nComment ID ${apiComment.comment_id}:`);
        console.log(`  API Author: "${apiComment.author_name}"`);
        console.log(`  DB Author:  "${dbComment.author_name}"`);
        
        if (apiComment.author_name === dbComment.author_name) {
          console.log('  ✅ MATCH: API and DB return same author name');
        } else {
          console.log('  ❌ MISMATCH: API and DB return different author names!');
          console.log('  🚨 This indicates a bug in the API processing!');
        }
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    process.exit(0);
  }
}

testAPIResponse();
