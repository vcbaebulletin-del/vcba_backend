const fetch = globalThis.fetch || require('node-fetch');

async function testLiveIntegration() {
  console.log('🧪 Testing Live Frontend-Backend Integration...\n');

  const API_BASE = 'http://localhost:5000';
  
  try {
    // Test 1: Simulate exact frontend API call for anonymous comment
    console.log('📝 Test 1: Simulating Frontend Anonymous Comment API Call...');
    
    // This simulates exactly what AdminCommentSection.tsx sends
    const frontendPayload = {
      announcement_id: 83,
      comment_text: 'Live Integration Test: Anonymous comment from simulated frontend',
      is_anonymous: true, // Boolean true from checkbox
      parent_comment_id: null
    };

    console.log('Frontend payload:', {
      is_anonymous: frontendPayload.is_anonymous,
      is_anonymous_type: typeof frontendPayload.is_anonymous,
      full_payload: frontendPayload
    });

    // Simulate the API call (without authentication for testing)
    const response1 = await fetch(`${API_BASE}/api/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Note: In real app, this would include Authorization header
      },
      body: JSON.stringify(frontendPayload)
    });

    console.log('API Response Status:', response1.status);
    const result1 = await response1.json();
    console.log('API Response:', result1);

    if (result1.success && result1.data && result1.data.comment) {
      const commentId = result1.data.comment.comment_id;
      console.log('✅ Comment created with ID:', commentId);

      // Test 2: Verify the comment display
      console.log('\n📝 Test 2: Verifying Comment Display...');
      
      const commentModel = require('./src/models/CommentModel');
      const comments = await commentModel.getCommentsByAnnouncement(83, { limit: 5 }, { userId: 32, userType: 'admin' });
      
      const testComment = comments.comments.find(c => c.comment_id === commentId);
      if (testComment) {
        console.log('Retrieved comment:', {
          comment_id: testComment.comment_id,
          is_anonymous: testComment.is_anonymous,
          author_name: testComment.author_name,
          user_type: testComment.user_type
        });

        if (testComment.is_anonymous === 1 && testComment.author_name === 'Anonymous Admin') {
          console.log('🎉 SUCCESS: Anonymous comment working perfectly!');
          console.log('✅ Frontend boolean true → Backend integer 1 → Anonymous display');
        } else {
          console.log('❌ ISSUE: Anonymous comment not displaying correctly');
          console.log('Expected: is_anonymous=1, author_name="Anonymous Admin"');
          console.log(`Actual: is_anonymous=${testComment.is_anonymous}, author_name="${testComment.author_name}"`);
        }
      } else {
        console.log('❌ Could not find the created comment');
      }
    } else {
      console.log('❌ API call failed or returned error:', result1);
    }

    // Test 3: Test regular comment
    console.log('\n📝 Test 3: Testing Regular Comment...');
    const regularPayload = {
      announcement_id: 83,
      comment_text: 'Live Integration Test: Regular comment (not anonymous)',
      is_anonymous: false, // Boolean false
      parent_comment_id: null
    };

    const response2 = await fetch(`${API_BASE}/api/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(regularPayload)
    });

    const result2 = await response2.json();
    console.log('Regular comment API response:', result2);

    // Test 4: Check current comment display
    console.log('\n📝 Test 4: Checking Current Comment Display...');
    const publicResponse = await fetch(`${API_BASE}/api/comments?announcement_id=83&limit=10`);
    const publicResult = await publicResponse.json();
    
    if (publicResult.success && publicResult.data && publicResult.data.comments) {
      console.log('\nRecent comments display:');
      publicResult.data.comments.slice(0, 5).forEach(comment => {
        const status = comment.is_anonymous === 1 ? '🔒 Anonymous' : '👤 Named';
        console.log(`${status} - ID: ${comment.comment_id}, Author: "${comment.author_name}"`);
      });
    }

  } catch (error) {
    console.error('❌ Integration test failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    process.exit(0);
  }
}

// Also test the server status
async function testServerStatus() {
  console.log('🔍 Testing Server Status...\n');
  
  try {
    const response = await fetch('http://localhost:5000/api/health');
    if (response.ok) {
      console.log('✅ Backend server is responding');
    } else {
      console.log('⚠️ Backend server responded with status:', response.status);
    }
  } catch (error) {
    console.log('❌ Backend server is not responding:', error.message);
  }

  try {
    const response = await fetch('http://localhost:3000');
    if (response.ok) {
      console.log('✅ Frontend server is responding');
    } else {
      console.log('⚠️ Frontend server responded with status:', response.status);
    }
  } catch (error) {
    console.log('❌ Frontend server is not responding:', error.message);
  }

  console.log('\nRunning integration test...\n');
  testLiveIntegration();
}

testServerStatus();
