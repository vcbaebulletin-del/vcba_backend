const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'db_ebulletin_system',
  port: 3306,
  timezone: '+08:00'
};

async function checkPublishedField() {
  let connection;
  
  try {
    console.log('🔍 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected successfully!');
    
    // Check the exact values for target events
    console.log('\n🎯 CHECKING TARGET EVENTS (1564, 1565) - ALL FIELDS:');
    const [targetEvents] = await connection.query(`
      SELECT 
        calendar_id,
        title,
        is_active,
        is_published,
        is_alert,
        event_date,
        end_date,
        deleted_at,
        created_at,
        updated_at
      FROM school_calendar 
      WHERE calendar_id IN (1564, 1565) 
      ORDER BY calendar_id
    `);
    
    console.table(targetEvents);
    
    // Check if there are any unpublished events
    console.log('\n📊 PUBLISHED STATUS ANALYSIS:');
    const [publishedStats] = await connection.query(`
      SELECT 
        is_published,
        COUNT(*) as count
      FROM school_calendar 
      WHERE is_active = 1 AND deleted_at IS NULL
      GROUP BY is_published
    `);
    
    console.table(publishedStats);
    
    // Check recent events and their published status
    console.log('\n📈 RECENT EVENTS WITH PUBLISHED STATUS:');
    const [recentEvents] = await connection.query(`
      SELECT 
        calendar_id,
        title,
        is_active,
        is_published,
        is_alert,
        event_date,
        end_date,
        created_at
      FROM school_calendar 
      WHERE created_at >= '2025-09-20'
      ORDER BY created_at DESC
    `);
    
    console.table(recentEvents);
    
    // Check if there are any events that should be published but aren't
    console.log('\n⚠️ ACTIVE BUT UNPUBLISHED EVENTS:');
    const [unpublishedActive] = await connection.query(`
      SELECT 
        calendar_id,
        title,
        is_active,
        is_published,
        is_alert,
        event_date,
        end_date
      FROM school_calendar 
      WHERE is_active = 1 AND is_published = 0 AND deleted_at IS NULL
      ORDER BY event_date DESC
      LIMIT 10
    `);
    
    if (unpublishedActive.length > 0) {
      console.table(unpublishedActive);
    } else {
      console.log('✅ No active but unpublished events found');
    }
    
    // Test the exact query that the backend API uses
    console.log('\n🔍 TESTING BACKEND API QUERY LOGIC:');
    
    // This replicates the query from CalendarModel.js
    const [apiResults] = await connection.query(`
      SELECT
        sc.*,
        c.name as category_name,
        c.color_code as category_color,
        s.name as subcategory_name,
        s.color_code as subcategory_color,
        CONCAT(IFNULL(ap.first_name, ''), ' ', IFNULL(ap.last_name, '')) as created_by_name
      FROM school_calendar sc
      LEFT JOIN categories c ON sc.category_id = c.category_id
      LEFT JOIN subcategories s ON sc.subcategory_id = s.subcategory_id
      LEFT JOIN admin_profiles ap ON sc.created_by = ap.admin_id
      WHERE sc.deleted_at IS NULL
        AND sc.is_active = 1
        AND sc.calendar_id IN (1564, 1565)
      ORDER BY sc.event_date ASC
    `);
    
    console.log('📊 Backend API Query Results:');
    if (apiResults.length > 0) {
      console.table(apiResults.map(event => ({
        calendar_id: event.calendar_id,
        title: event.title,
        is_active: event.is_active,
        is_published: event.is_published,
        is_alert: event.is_alert,
        event_date: event.event_date,
        end_date: event.end_date,
        category_name: event.category_name,
        subcategory_name: event.subcategory_name,
        created_by_name: event.created_by_name
      })));
    } else {
      console.log('❌ No results from backend API query!');
    }
    
  } catch (error) {
    console.error('❌ Error checking published field:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Database connection closed');
    }
  }
}

checkPublishedField();
