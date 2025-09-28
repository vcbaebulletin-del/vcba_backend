const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'db_ebulletin_system',
  port: 3306,
  timezone: '+08:00'
};

async function exploreDatabase() {
  let connection;
  
  try {
    console.log('🔍 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected successfully!');
    
    // 1. Show all tables
    console.log('\n📋 ALL TABLES IN DATABASE:');
    const [tables] = await connection.query('SHOW TABLES');
    console.table(tables);
    
    // 2. Look for calendar-related tables
    console.log('\n📅 CALENDAR-RELATED TABLES:');
    const [calendarTables] = await connection.query("SHOW TABLES LIKE '%calendar%'");
    if (calendarTables.length > 0) {
      console.table(calendarTables);
    } else {
      console.log('❌ No calendar tables found!');
    }
    
    // 3. Look for event-related tables
    console.log('\n🎯 EVENT-RELATED TABLES:');
    const [eventTables] = await connection.query("SHOW TABLES LIKE '%event%'");
    if (eventTables.length > 0) {
      console.table(eventTables);
    } else {
      console.log('❌ No event tables found!');
    }
    
    // 4. Check announcements table structure
    console.log('\n📢 ANNOUNCEMENTS TABLE STRUCTURE:');
    try {
      const [announcementStructure] = await connection.query('DESCRIBE announcements');
      console.table(announcementStructure);
      
      // Check for recent announcements
      console.log('\n📊 RECENT ANNOUNCEMENTS:');
      const [recentAnnouncements] = await connection.query(`
        SELECT 
          announcement_id,
          title,
          status,
          created_at,
          visibility_start_at,
          visibility_end_at
        FROM announcements 
        ORDER BY created_at DESC 
        LIMIT 5
      `);
      console.table(recentAnnouncements);
      
    } catch (error) {
      console.log('❌ Announcements table error:', error.message);
    }
    
    // 5. Look for any tables that might contain calendar/event data
    console.log('\n🔍 SEARCHING FOR TABLES WITH CALENDAR/EVENT DATA:');
    const tableNames = tables.map(t => Object.values(t)[0]);
    
    for (const tableName of tableNames) {
      try {
        // Check if table has columns that suggest calendar/event data
        const [columns] = await connection.query(`DESCRIBE ${tableName}`);
        const columnNames = columns.map(c => c.Field.toLowerCase());
        
        const hasCalendarColumns = columnNames.some(col => 
          col.includes('event') || 
          col.includes('calendar') || 
          col.includes('date') && (col.includes('start') || col.includes('end')) ||
          col.includes('alert') ||
          col.includes('schedule')
        );
        
        if (hasCalendarColumns) {
          console.log(`\n📅 Table "${tableName}" has calendar-like columns:`);
          const relevantColumns = columns.filter(c => {
            const field = c.Field.toLowerCase();
            return field.includes('event') || 
                   field.includes('calendar') || 
                   field.includes('date') || 
                   field.includes('alert') || 
                   field.includes('schedule') ||
                   field.includes('title') ||
                   field.includes('description');
          });
          console.table(relevantColumns);
          
          // Check for data with IDs 1564, 1565
          try {
            const [data] = await connection.query(`
              SELECT * FROM ${tableName} 
              WHERE ${tableName.slice(0, -1)}_id IN (1564, 1565) 
              OR id IN (1564, 1565)
              LIMIT 5
            `);
            if (data.length > 0) {
              console.log(`🎯 Found target IDs in ${tableName}:`);
              console.table(data);
            }
          } catch (idError) {
            // Try different ID column patterns
            try {
              const [data2] = await connection.query(`
                SELECT * FROM ${tableName} 
                WHERE announcement_id IN (1564, 1565)
                LIMIT 5
              `);
              if (data2.length > 0) {
                console.log(`🎯 Found target IDs in ${tableName} (announcement_id):`);
                console.table(data2);
              }
            } catch (idError2) {
              // Ignore ID search errors
            }
          }
        }
      } catch (error) {
        // Skip tables we can't access
      }
    }
    
  } catch (error) {
    console.error('❌ Database exploration failed:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Database connection closed');
    }
  }
}

exploreDatabase();
