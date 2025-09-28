const database = require('./src/config/database');

async function checkDatabaseTables() {
  try {
    console.log('🔍 Checking database tables...\n');

    // Show all tables
    const tables = await database.query('SHOW TABLES');
    console.log(`📊 Found ${tables.length} tables:`);
    tables.forEach((table, index) => {
      const tableName = Object.values(table)[0];
      console.log(`${index + 1}. ${tableName}`);
    });

    // Look for admin-related tables
    const adminTables = tables.filter(table => {
      const tableName = Object.values(table)[0].toLowerCase();
      return tableName.includes('admin') || tableName.includes('user');
    });

    if (adminTables.length > 0) {
      console.log('\n🔍 Admin-related tables found:');
      for (const table of adminTables) {
        const tableName = Object.values(table)[0];
        console.log(`\n📋 Table: ${tableName}`);
        
        try {
          const columns = await database.query(`DESCRIBE ${tableName}`);
          console.log('   Columns:');
          columns.forEach(col => {
            console.log(`   - ${col.Field} (${col.Type})`);
          });

          // Try to get some sample data
          const sampleData = await database.query(`SELECT * FROM ${tableName} LIMIT 3`);
          if (sampleData.length > 0) {
            console.log(`   Sample data (${sampleData.length} rows):`);
            sampleData.forEach((row, index) => {
              console.log(`   ${index + 1}.`, Object.keys(row).slice(0, 5).map(key => `${key}: ${row[key]}`).join(', '));
            });
          } else {
            console.log('   No data found');
          }
        } catch (error) {
          console.log(`   Error accessing table: ${error.message}`);
        }
      }
    }

    // Now let's test the calendar API directly
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

        if (!event1564 && !event1565) {
          console.log('\n❌ Neither target event found in API response!');
          console.log('📋 Events that ARE being returned:');
          events.slice(0, 10).forEach((event, index) => {
            console.log(`   ${index + 1}. ${event.title} (ID: ${event.calendar_id}, Active: ${event.is_active}, Alert: ${event.is_alert})`);
          });

          // Check if our events exist in database but are being filtered out
          console.log('\n🔍 Checking if our events exist in database...');
          const dbEvents = await database.query(`
            SELECT 
              calendar_id, 
              title, 
              event_date, 
              end_date, 
              is_active, 
              is_alert, 
              is_published,
              deleted_at
            FROM school_calendar 
            WHERE calendar_id IN (1564, 1565)
          `);

          console.log(`📊 Found ${dbEvents.length} target events in database:`);
          dbEvents.forEach(event => {
            console.log(`   - ${event.title} (ID: ${event.calendar_id})`);
            console.log(`     Active: ${event.is_active}, Alert: ${event.is_alert}, Published: ${event.is_published}`);
            console.log(`     Deleted: ${event.deleted_at}, Event Date: ${event.event_date}, End Date: ${event.end_date}`);
          });

          // Check what the API query is actually doing
          console.log('\n🔍 Testing the exact API query...');
          const apiQuery = `
            SELECT
              sc.*,
              c.name as category_name
            FROM school_calendar sc
            LEFT JOIN categories c ON sc.category_id = c.category_id
            WHERE sc.deleted_at IS NULL 
              AND sc.is_active = 1
            ORDER BY sc.event_date ASC
            LIMIT 50
          `;
          
          const apiResults = await database.query(apiQuery);
          console.log(`📊 API query returned ${apiResults.length} events`);
          
          const apiEvent1564 = apiResults.find(e => e.calendar_id === 1564);
          const apiEvent1565 = apiResults.find(e => e.calendar_id === 1565);
          
          console.log(`   Event 1564 in API query: ${!!apiEvent1564}`);
          console.log(`   Event 1565 in API query: ${!!apiEvent1565}`);

          if (!apiEvent1564 || !apiEvent1565) {
            console.log('\n❌ Events are being filtered out by the API query!');
            console.log('🔍 Checking why...');
            
            // Check each condition
            const checkQuery1 = await database.query(`
              SELECT calendar_id, title, deleted_at, is_active 
              FROM school_calendar 
              WHERE calendar_id IN (1564, 1565)
            `);
            
            checkQuery1.forEach(event => {
              console.log(`   Event ${event.calendar_id}:`);
              console.log(`     deleted_at IS NULL: ${event.deleted_at === null}`);
              console.log(`     is_active = 1: ${event.is_active === 1}`);
            });
          }
        } else {
          console.log('\n✅ Target events found in API response!');
          if (event1564) {
            console.log(`   Event 1564: ${event1564.title} (Active: ${event1564.is_active}, Alert: ${event1564.is_alert})`);
          }
          if (event1565) {
            console.log(`   Event 1565: ${event1565.title} (Active: ${event1565.is_active}, Alert: ${event1565.is_alert})`);
          }
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

  } catch (error) {
    console.error('❌ Error checking database tables:', error);
  } finally {
    await database.close();
  }
}

checkDatabaseTables();
