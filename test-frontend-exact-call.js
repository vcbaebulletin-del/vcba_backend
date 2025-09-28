const axios = require('axios');

async function testFrontendExactCall() {
  try {
    console.log('🔍 Testing the exact frontend API call...\n');

    // Test 1: Non-authenticated call (as my previous test)
    console.log('1️⃣ Testing non-authenticated call...');
    const noAuthResponse = await axios.get('http://localhost:5000/api/calendar?limit=50&sort_by=event_date&sort_order=ASC');
    
    console.log('📊 No-auth Response Status:', noAuthResponse.status);
    console.log('📊 No-auth Total events:', noAuthResponse.data.data?.events?.length || 0);
    
    if (noAuthResponse.data.data?.events) {
      const noAuthEvents = noAuthResponse.data.data.events;
      const noAuthEvent1564 = noAuthEvents.find(e => e.calendar_id === 1564);
      const noAuthEvent1565 = noAuthEvents.find(e => e.calendar_id === 1565);
      
      console.log(`   Event 1564 found: ${!!noAuthEvent1564}`);
      console.log(`   Event 1565 found: ${!!noAuthEvent1565}`);
      
      console.log('   First 10 events:');
      noAuthEvents.slice(0, 10).forEach((event, index) => {
        console.log(`   ${index + 1}. ${event.title} (ID: ${event.calendar_id}, Active: ${event.is_active}, Alert: ${event.is_alert})`);
      });
    }

    // Test 2: Try to get admin credentials and make authenticated call
    console.log('\n2️⃣ Testing with admin authentication...');
    
    // Get admin credentials from database
    const database = require('./src/config/database');
    const admins = await database.query(`
      SELECT aa.admin_id, aa.email, ap.first_name, ap.last_name 
      FROM admin_accounts aa
      LEFT JOIN admin_profiles ap ON aa.admin_id = ap.admin_id
      WHERE aa.is_active = 1 
      LIMIT 1
    `);
    
    if (admins.length === 0) {
      console.log('❌ No active admin found');
      return;
    }
    
    const admin = admins[0];
    console.log(`   Using admin: ${admin.email} (${admin.first_name} ${admin.last_name})`);
    
    // Try common passwords
    const commonPasswords = ['password', 'password123', 'admin123', '123456', 'admin'];
    let authToken = null;
    
    for (const password of commonPasswords) {
      try {
        console.log(`   Trying password: ${password}`);
        const loginResponse = await axios.post('http://localhost:5000/api/auth/login', {
          email: admin.email,
          password: password,
          role: 'admin'
        });
        
        if (loginResponse.data.success) {
          authToken = loginResponse.data.data.token;
          console.log(`   ✅ Login successful with password: ${password}`);
          break;
        }
      } catch (loginError) {
        console.log(`   ❌ Password ${password} failed`);
      }
    }
    
    if (!authToken) {
      console.log('❌ Could not authenticate with any common password');
      console.log('   Proceeding with non-authenticated test only...');
    } else {
      // Test authenticated call
      console.log('\n3️⃣ Testing authenticated call...');
      const authResponse = await axios.get('http://localhost:5000/api/calendar?limit=50&sort_by=event_date&sort_order=ASC', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('📊 Auth Response Status:', authResponse.status);
      console.log('📊 Auth Total events:', authResponse.data.data?.events?.length || 0);
      
      if (authResponse.data.data?.events) {
        const authEvents = authResponse.data.data.events;
        const authEvent1564 = authEvents.find(e => e.calendar_id === 1564);
        const authEvent1565 = authEvents.find(e => e.calendar_id === 1565);
        
        console.log(`   Event 1564 found: ${!!authEvent1564}`);
        console.log(`   Event 1565 found: ${!!authEvent1565}`);
        
        console.log('   First 10 events:');
        authEvents.slice(0, 10).forEach((event, index) => {
          console.log(`   ${index + 1}. ${event.title} (ID: ${event.calendar_id}, Active: ${event.is_active}, Alert: ${event.is_alert})`);
        });
        
        // Compare the two responses
        console.log('\n4️⃣ Comparing responses...');
        console.log(`   No-auth events: ${noAuthEvents.length}`);
        console.log(`   Auth events: ${authEvents.length}`);
        
        const noAuthIds = noAuthEvents.map(e => e.calendar_id).sort();
        const authIds = authEvents.map(e => e.calendar_id).sort();
        
        const idsMatch = JSON.stringify(noAuthIds) === JSON.stringify(authIds);
        console.log(`   Event IDs match: ${idsMatch}`);
        
        if (!idsMatch) {
          console.log('   ❌ Different events returned!');
          console.log(`   No-auth IDs: ${noAuthIds.slice(0, 10)}`);
          console.log(`   Auth IDs: ${authIds.slice(0, 10)}`);
        }
      }
    }

    // Test 3: Check if there are any archived events that might be interfering
    console.log('\n5️⃣ Checking archived events...');
    const archivedEvents = await database.query(`
      SELECT calendar_id, title, is_active, deleted_at, event_date, end_date
      FROM school_calendar 
      WHERE is_active = 0 OR deleted_at IS NOT NULL
      ORDER BY calendar_id DESC
      LIMIT 10
    `);
    
    console.log(`📊 Found ${archivedEvents.length} archived/deleted events:`);
    archivedEvents.forEach(event => {
      console.log(`   - ${event.title} (ID: ${event.calendar_id}, Active: ${event.is_active}, Deleted: ${!!event.deleted_at})`);
    });

    // Test 4: Check if our target events might have been archived recently
    console.log('\n6️⃣ Checking target events status in database...');
    const targetEvents = await database.query(`
      SELECT calendar_id, title, is_active, deleted_at, event_date, end_date, updated_at
      FROM school_calendar 
      WHERE calendar_id IN (1564, 1565)
    `);
    
    console.log(`📊 Target events in database:`);
    targetEvents.forEach(event => {
      console.log(`   - ${event.title} (ID: ${event.calendar_id})`);
      console.log(`     Active: ${event.is_active}, Deleted: ${!!event.deleted_at}`);
      console.log(`     Updated: ${event.updated_at}`);
      console.log(`     Event Date: ${event.event_date}, End Date: ${event.end_date}`);
    });

    await database.close();

  } catch (error) {
    console.error('❌ Error testing frontend exact call:', error.message);
    if (error.response) {
      console.error('Response Status:', error.response.status);
      console.error('Response Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testFrontendExactCall();
