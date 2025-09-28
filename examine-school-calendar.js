const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'db_ebulletin_system',
  port: 3306,
  timezone: '+08:00'
};

async function examineSchoolCalendar() {
  let connection;
  
  try {
    console.log('🔍 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected successfully!');
    
    // 1. Get full structure of school_calendar table
    console.log('\n📋 SCHOOL_CALENDAR TABLE STRUCTURE:');
    const [structure] = await connection.query('DESCRIBE school_calendar');
    console.table(structure);
    
    // 2. Check for target events (1564, 1565)
    console.log('\n🎯 SEARCHING FOR TARGET EVENTS (1564, 1565):');
    const [targetEvents] = await connection.query(`
      SELECT * FROM school_calendar 
      WHERE calendar_id IN (1564, 1565) 
      ORDER BY calendar_id
    `);
    
    if (targetEvents.length > 0) {
      console.log('✅ Found target events:');
      console.table(targetEvents);
      
      // Analyze dates
      const now = new Date();
      console.log('\n📅 DATE ANALYSIS:');
      console.log('Current Date/Time:', now.toISOString());
      
      targetEvents.forEach(event => {
        const eventStart = new Date(event.event_date);
        const eventEnd = event.end_date ? new Date(event.end_date) : eventStart;
        const isWithinRange = now >= eventStart && now <= eventEnd;
        
        console.log(`\n📌 Event ${event.calendar_id} (${event.title}):`);
        console.log(`   Start: ${eventStart.toISOString()}`);
        console.log(`   End: ${eventEnd.toISOString()}`);
        console.log(`   Active: ${event.is_active ? 'YES' : 'NO'}`);
        console.log(`   Alert: ${event.is_alert ? 'YES' : 'NO'}`);
        console.log(`   Within Range: ${isWithinRange ? 'YES' : 'NO'}`);
        console.log(`   Should Display: ${event.is_active && isWithinRange ? 'YES' : 'NO'}`);
      });
    } else {
      console.log('❌ Target events not found in school_calendar table');
    }
    
    // 3. Get all events around the target date range
    console.log('\n📊 EVENTS AROUND SEPTEMBER 2025:');
    const [septemberEvents] = await connection.query(`
      SELECT 
        calendar_id,
        title,
        event_date,
        end_date,
        is_active,
        is_alert,
        created_at
      FROM school_calendar 
      WHERE event_date >= '2025-09-01' AND event_date <= '2025-09-30'
      ORDER BY event_date ASC
    `);
    
    if (septemberEvents.length > 0) {
      console.table(septemberEvents);
    } else {
      console.log('❌ No September 2025 events found');
    }
    
    // 4. Get recent events for comparison
    console.log('\n📈 MOST RECENT EVENTS:');
    const [recentEvents] = await connection.query(`
      SELECT 
        calendar_id,
        title,
        event_date,
        end_date,
        is_active,
        is_alert,
        created_at
      FROM school_calendar 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    console.table(recentEvents);
    
    // 5. Check total count
    console.log('\n📊 TOTAL EVENTS COUNT:');
    const [countResult] = await connection.query('SELECT COUNT(*) as total FROM school_calendar');
    console.log(`Total events in school_calendar: ${countResult[0].total}`);
    
    // 6. Check for events with specific IDs in a range
    console.log('\n🔍 EVENTS WITH IDs NEAR 1564-1565:');
    const [nearbyEvents] = await connection.query(`
      SELECT 
        calendar_id,
        title,
        event_date,
        end_date,
        is_active,
        is_alert
      FROM school_calendar 
      WHERE calendar_id BETWEEN 1560 AND 1570
      ORDER BY calendar_id
    `);
    
    if (nearbyEvents.length > 0) {
      console.table(nearbyEvents);
    } else {
      console.log('❌ No events found with IDs 1560-1570');
    }
    
  } catch (error) {
    console.error('❌ Error examining school_calendar:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Database connection closed');
    }
  }
}

examineSchoolCalendar();
