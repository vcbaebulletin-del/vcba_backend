// Use built-in fetch for Node.js 18+
const fetch = globalThis.fetch || require('node-fetch');

async function testAnonymousAPI() {
  console.log('🧪 Testing Anonymous Comment API Directly...\n');

  const API_BASE = 'http://localhost:5000';
  
  // You'll need to replace this with a valid admin token
  // Get this from browser localStorage or login API
  const ADMIN_TOKEN = 'your-admin-token-here';

  try {
    // Test 1: Create anonymous comment with boolean true
    console.log('📝 Test 1: Creating anonymous comment with boolean true...');
    const response1 = await fetch(`${API_BASE}/api/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ADMIN_TOKEN}`
      },
      body: JSON.stringify({
        announcement_id: 83,
        comment_text: 'API Test: Anonymous comment with boolean true',
        is_anonymous: true // Boolean true
      })
    });

    const result1 = await response1.json();
    console.log('Response 1:', result1);

    // Test 2: Create anonymous comment with string 'true'
    console.log('\n📝 Test 2: Creating anonymous comment with string "true"...');
    const response2 = await fetch(`${API_BASE}/api/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ADMIN_TOKEN}`
      },
      body: JSON.stringify({
        announcement_id: 83,
        comment_text: 'API Test: Anonymous comment with string true',
        is_anonymous: 'true' // String 'true'
      })
    });

    const result2 = await response2.json();
    console.log('Response 2:', result2);

    // Test 3: Create regular comment with boolean false
    console.log('\n📝 Test 3: Creating regular comment with boolean false...');
    const response3 = await fetch(`${API_BASE}/api/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ADMIN_TOKEN}`
      },
      body: JSON.stringify({
        announcement_id: 83,
        comment_text: 'API Test: Regular comment with boolean false',
        is_anonymous: false // Boolean false
      })
    });

    const result3 = await response3.json();
    console.log('Response 3:', result3);

    console.log('\n🎉 API test completed!');

  } catch (error) {
    console.error('❌ API test failed:', error.message);
  }
}

// Alternative: Test without authentication (if endpoints are public)
async function testAnonymousAPIPublic() {
  console.log('🧪 Testing Anonymous Comment API (Public endpoints)...\n');

  const API_BASE = 'http://localhost:5000';

  try {
    // Test getting comments to see current data
    console.log('📝 Getting current comments...');
    const response = await fetch(`${API_BASE}/api/comments?announcement_id=83&limit=5`);
    const result = await response.json();
    
    console.log('Current comments:');
    if (result.success && result.data && result.data.comments) {
      result.data.comments.forEach(comment => {
        console.log(`- ID: ${comment.comment_id}, Anonymous: ${comment.is_anonymous}, Author: "${comment.author_name}"`);
      });
    } else {
      console.log('No comments found or error:', result);
    }

  } catch (error) {
    console.error('❌ Public API test failed:', error.message);
  }
}

console.log('Choose test method:');
console.log('1. Run testAnonymousAPI() - requires admin token');
console.log('2. Run testAnonymousAPIPublic() - public endpoints only');
console.log('\nRunning public test...');

testAnonymousAPIPublic();
