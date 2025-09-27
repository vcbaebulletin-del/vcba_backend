const mysql = require("mysql2/promise");
require('dotenv').config();

/**
 * Database Schema Inspection Script
 * Inspects the database structure for announcements and school_calendar tables
 * to understand current schema before implementing archival logic
 */
async function inspectDB() {
  let connection;
  
  try {
    console.log('🔍 Starting database schema inspection...\n');
    
    // Create database connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASS || '',
      database: process.env.DB_NAME || 'vcba_e_bulletin_board',
      timezone: '+08:00' // Philippines timezone
    });

    console.log('✅ Connected to database successfully\n');

    // 1. Show all tables
    console.log('📋 DATABASE TABLES:');
    console.log('='.repeat(50));
    const [tables] = await connection.query("SHOW TABLES;");
    console.log('Tables found:', tables.length);
    tables.forEach((table, index) => {
      const tableName = Object.values(table)[0];
      console.log(`${index + 1}. ${tableName}`);
    });
    console.log('\n');

    // 2. Check timezone settings
    console.log('🌍 TIMEZONE SETTINGS:');
    console.log('='.repeat(50));
    const [timezoneInfo] = await connection.query("SELECT @@global.time_zone as global_tz, @@session.time_zone as session_tz, NOW() as current_db_time;");
    console.log('Global timezone:', timezoneInfo[0].global_tz);
    console.log('Session timezone:', timezoneInfo[0].session_tz);
    console.log('Current database time:', timezoneInfo[0].current_db_time);
    console.log('\n');

    // 3. Inspect announcements table
    console.log('📢 ANNOUNCEMENTS TABLE SCHEMA:');
    console.log('='.repeat(50));
    
    // Show CREATE TABLE for announcements
    const [announcementsCreate] = await connection.query("SHOW CREATE TABLE announcements;");
    console.log('CREATE TABLE statement:');
    console.log(announcementsCreate[0]['Create Table']);
    console.log('\n');

    // Describe announcements table
    const [announcementsDesc] = await connection.query("DESCRIBE announcements;");
    console.log('Column details:');
    console.table(announcementsDesc);
    console.log('\n');

    // Check for existing data and status values
    const [announcementsStats] = await connection.query(`
      SELECT 
        COUNT(*) as total_count,
        COUNT(CASE WHEN status = 'published' THEN 1 END) as published_count,
        COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_count,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
        COUNT(CASE WHEN status = 'archived' THEN 1 END) as archived_count,
        COUNT(CASE WHEN deleted_at IS NOT NULL THEN 1 END) as soft_deleted_count,
        COUNT(CASE WHEN visibility_end_at IS NOT NULL THEN 1 END) as with_end_date_count,
        COUNT(CASE WHEN visibility_end_at IS NOT NULL AND visibility_end_at <= NOW() THEN 1 END) as expired_count
      FROM announcements;
    `);
    console.log('Announcements statistics:');
    console.table(announcementsStats);
    console.log('\n');

    // 4. Inspect school_calendar table
    console.log('📅 SCHOOL_CALENDAR TABLE SCHEMA:');
    console.log('='.repeat(50));
    
    // Show CREATE TABLE for school_calendar
    const [calendarCreate] = await connection.query("SHOW CREATE TABLE school_calendar;");
    console.log('CREATE TABLE statement:');
    console.log(calendarCreate[0]['Create Table']);
    console.log('\n');

    // Describe school_calendar table
    const [calendarDesc] = await connection.query("DESCRIBE school_calendar;");
    console.log('Column details:');
    console.table(calendarDesc);
    console.log('\n');

    // Check for existing data and status values
    const [calendarStats] = await connection.query(`
      SELECT 
        COUNT(*) as total_count,
        COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_count,
        COUNT(CASE WHEN is_active = 0 THEN 1 END) as inactive_count,
        COUNT(CASE WHEN is_published = 1 THEN 1 END) as published_count,
        COUNT(CASE WHEN deleted_at IS NOT NULL THEN 1 END) as soft_deleted_count,
        COUNT(CASE WHEN end_date IS NOT NULL THEN 1 END) as with_end_date_count,
        COUNT(CASE WHEN end_date IS NOT NULL AND end_date <= CURDATE() THEN 1 END) as expired_count
      FROM school_calendar;
    `);
    console.log('School calendar statistics:');
    console.table(calendarStats);
    console.log('\n');

    // 5. Check for existing archival mechanisms
    console.log('🗃️ EXISTING ARCHIVAL MECHANISMS:');
    console.log('='.repeat(50));
    
    // Check if archived_at column exists in announcements
    const announcementsHasArchivedAt = announcementsDesc.some(col => col.Field === 'archived_at');
    console.log('Announcements has archived_at column:', announcementsHasArchivedAt);
    
    // Check if there's a status column that supports 'archived'
    const [statusValues] = await connection.query(`
      SELECT DISTINCT status 
      FROM announcements 
      WHERE status IS NOT NULL 
      ORDER BY status;
    `);
    console.log('Existing announcement status values:', statusValues.map(s => s.status));
    
    // Check calendar archival columns
    const calendarHasDeletedAt = calendarDesc.some(col => col.Field === 'deleted_at');
    console.log('School calendar has deleted_at column:', calendarHasDeletedAt);
    console.log('\n');

    // 6. Sample expired records
    console.log('⏰ SAMPLE EXPIRED RECORDS:');
    console.log('='.repeat(50));
    
    // Find expired announcements
    const [expiredAnnouncements] = await connection.query(`
      SELECT 
        announcement_id,
        title,
        status,
        visibility_end_at,
        archived_at,
        deleted_at
      FROM announcements 
      WHERE visibility_end_at IS NOT NULL 
        AND visibility_end_at <= NOW()
        AND deleted_at IS NULL
      LIMIT 5;
    `);
    console.log('Sample expired announcements:');
    console.table(expiredAnnouncements);
    
    // Find expired calendar events
    const [expiredEvents] = await connection.query(`
      SELECT 
        calendar_id,
        title,
        event_date,
        end_date,
        is_active,
        deleted_at
      FROM school_calendar 
      WHERE end_date IS NOT NULL 
        AND end_date <= CURDATE()
        AND deleted_at IS NULL
      LIMIT 5;
    `);
    console.log('Sample expired calendar events:');
    console.table(expiredEvents);
    console.log('\n');

    console.log('✅ Database schema inspection completed successfully!');

  } catch (error) {
    console.error('❌ Error during database inspection:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the inspection
if (require.main === module) {
  inspectDB();
}

module.exports = inspectDB;
