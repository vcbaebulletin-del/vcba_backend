const mysql = require('mysql2/promise');
require('dotenv').config();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'db_ebulletin_system',
  port: process.env.DB_PORT || 3306,
  timezone: '+08:00'
};

async function examineTargetEvents() {
  let connection;
  
  try {
    console.log('🔍 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    
    // Set timezone
    await connection.query("SET time_zone = '+08:00'");
    
    console.log('✅ Connected to database: ' + dbConfig.database);
    console.log('🕐 Current database time:', new Date().toISOString());
    
    // 1. Examine calendar table structure
    console.log('\n📋 CALENDAR TABLE STRUCTURE:');
    const [structure] = await connection.query('DESCRIBE calendar');
    console.table(structure);
    
    // 2. Check target events (1564, 1565)
    console.log('\n🎯 TARGET EVENTS (1564, 1565):');
    const [targetEvents] = await connection.query(`
      SELECT 
        calendar_id,
        title,
        description,
        is_active,
        is_alert,
        event_date,
        end_date,
        created_at,
        updated_at,
        deleted_at
      FROM calendar 
      WHERE calendar_id IN (1564, 1565) 
      ORDER BY calendar_id
    `);
    
    if (targetEvents.length > 0) {
      console.table(targetEvents);
      
      // Check if events are within current date range
      const now = new Date();
      console.log('\n📅 DATE ANALYSIS:');
      console.log('Current Date/Time:', now.toISOString());
      
      targetEvents.forEach(event => {
        const eventStart = new Date(event.event_date);
        const eventEnd = new Date(event.end_date);
        const isWithinRange = now >= eventStart && now <= eventEnd;
        
        console.log(`\n📌 Event ${event.calendar_id} (${event.title}):`);
        console.log(`   Start: ${eventStart.toISOString()}`);
        console.log(`   End: ${eventEnd.toISOString()}`);
        console.log(`   Active: ${event.is_active ? 'YES' : 'NO'}`);
        console.log(`   Alert: ${event.is_alert ? 'YES' : 'NO'}`);
        console.log(`   Within Range: ${isWithinRange ? 'YES' : 'NO'}`);
        console.log(`   Deleted: ${event.deleted_at ? 'YES' : 'NO'}`);
        console.log(`   Should Display: ${event.is_active && !event.deleted_at && isWithinRange ? 'YES' : 'NO'}`);
      });
    } else {
      console.log('❌ No target events found!');
    }
    
    // 3. Check for archive tables
    console.log('\n🗄️ ARCHIVE TABLES:');
    const [archiveTables] = await connection.query("SHOW TABLES LIKE '%archive%'");
    if (archiveTables.length > 0) {
      console.table(archiveTables);
      
      // Check if target events are in archive
      for (const table of archiveTables) {
        const tableName = Object.values(table)[0];
        console.log(`\n📦 Checking ${tableName}:`);
        try {
          const [archivedEvents] = await connection.query(`
            SELECT calendar_id, title, archived_at 
            FROM ${tableName} 
            WHERE calendar_id IN (1564, 1565)
          `);
          if (archivedEvents.length > 0) {
            console.table(archivedEvents);
          } else {
            console.log('   No target events found in archive');
          }
        } catch (error) {
          console.log(`   Error checking ${tableName}:`, error.message);
        }
      }
    } else {
      console.log('No archive tables found');
    }
    
    // 4. Check recent calendar events for comparison
    console.log('\n📊 RECENT CALENDAR EVENTS (for comparison):');
    const [recentEvents] = await connection.query(`
      SELECT 
        calendar_id,
        title,
        is_active,
        is_alert,
        event_date,
        end_date,
        deleted_at
      FROM calendar 
      WHERE event_date >= '2025-09-20' 
      ORDER BY event_date ASC 
      LIMIT 10
    `);
    console.table(recentEvents);
    
    // 5. Check announcements table for comparison
    console.log('\n📢 RECENT ANNOUNCEMENTS (for comparison):');
    const [announcements] = await connection.query(`
      SELECT 
        announcement_id,
        title,
        status,
        created_at,
        visibility_start_at,
        visibility_end_at,
        deleted_at
      FROM announcements 
      WHERE created_at >= '2025-09-20' 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    console.table(announcements);
    
  } catch (error) {
    console.error('❌ Database examination failed:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Database connection closed');
    }
  }
}

examineTargetEvents();
