const database = require('./src/config/database');

async function checkAdminCredentials() {
  try {
    console.log('🔍 Checking available admin credentials...\n');

    // Get admin users
    const admins = await database.query(`
      SELECT 
        admin_id, 
        email, 
        first_name, 
        last_name, 
        role,
        is_active,
        created_at
      FROM admins 
      WHERE deleted_at IS NULL 
      ORDER BY created_at DESC
      LIMIT 10
    `);

    console.log(`📊 Found ${admins.length} admin users:`);
    admins.forEach((admin, index) => {
      console.log(`${index + 1}. ${admin.email} (${admin.first_name} ${admin.last_name}) - Role: ${admin.role}, Active: ${admin.is_active}`);
    });

    // Let's also check if there are any test credentials or default passwords
    console.log('\n🔍 Checking for common test credentials...');
    
    const testEmails = [
      'admin@test.com',
      'admin@example.com', 
      'test@admin.com',
      'admin@admin.com',
      'super@admin.com',
      'zaira@gmail.com',
      'zaira123@gmail.com'
    ];

    for (const email of testEmails) {
      const user = await database.query('SELECT admin_id, email, first_name, last_name, role FROM admins WHERE email = ? AND deleted_at IS NULL', [email]);
      if (user.length > 0) {
        console.log(`✅ Found test user: ${email} (${user[0].first_name} ${user[0].last_name}) - Role: ${user[0].role}`);
      }
    }

    // Let's try to use the first active admin for our test
    const activeAdmin = admins.find(admin => admin.is_active === 1);
    if (activeAdmin) {
      console.log(`\n🎯 Will use admin: ${activeAdmin.email} for testing`);
      
      // Now test the calendar API with a simple approach - no auth first
      console.log('\n2️⃣ Testing calendar API without authentication...');
      const axios = require('axios');
      
      try {
        const response = await axios.get('http://localhost:5000/api/calendar?limit=50&sort_by=event_date&sort_order=ASC');
        console.log('📊 API Response Status:', response.status);
        console.log('📊 API Response Success:', response.data.success);
        console.log('📊 Total events returned:', response.data.data?.events?.length || 0);

        if (response.data.success && response.data.data?.events) {
          const events = response.data.data.events;
          
          // Look for our specific events
          const event1564 = events.find(e => e.calendar_id === 1564);
          const event1565 = events.find(e => e.calendar_id === 1565);
          
          console.log('\n📅 Target Events Check:');
          console.log(`   Event 1564 (Earthquake) found: ${!!event1564}`);
          console.log(`   Event 1565 (Marsquake) found: ${!!event1565}`);

          if (event1564) {
            console.log('\n🚨 Event 1564 Details:');
            console.log('   Title:', event1564.title);
            console.log('   Event Date:', event1564.event_date);
            console.log('   End Date:', event1564.end_date);
            console.log('   Is Active:', event1564.is_active);
            console.log('   Is Alert:', event1564.is_alert);
            console.log('   Is Published:', event1564.is_published);
          }

          if (event1565) {
            console.log('\n📅 Event 1565 Details:');
            console.log('   Title:', event1565.title);
            console.log('   Event Date:', event1565.event_date);
            console.log('   End Date:', event1565.end_date);
            console.log('   Is Active:', event1565.is_active);
            console.log('   Is Alert:', event1565.is_alert);
            console.log('   Is Published:', event1565.is_published);
          }

          // Show all events for debugging
          console.log('\n📋 All events returned (first 20):');
          events.slice(0, 20).forEach((event, index) => {
            console.log(`   ${index + 1}. ${event.title} (ID: ${event.calendar_id}, Active: ${event.is_active}, Alert: ${event.is_alert}, Date: ${event.event_date})`);
          });

          // Check active events
          const activeEvents = events.filter(e => e.is_active === 1);
          console.log(`\n📊 Active events: ${activeEvents.length} out of ${events.length}`);
          
          if (activeEvents.length > 0) {
            console.log('   Active events:');
            activeEvents.slice(0, 10).forEach(event => {
              console.log(`   - ${event.title} (ID: ${event.calendar_id}, Alert: ${event.is_alert})`);
            });
          }

        } else {
          console.error('❌ API response failed or no events data:', response.data);
        }
      } catch (apiError) {
        console.error('❌ Calendar API error:', apiError.message);
        if (apiError.response) {
          console.error('Response Status:', apiError.response.status);
          console.error('Response Data:', JSON.stringify(apiError.response.data, null, 2));
        }
      }
    }

  } catch (error) {
    console.error('❌ Error checking admin credentials:', error);
  } finally {
    await database.close();
  }
}

checkAdminCredentials();
