const mysql = require('mysql2/promise');

/**
 * Manual script to archive expired content in Railway database
 * This fixes the immediate issue of expired content showing wrong status
 */

async function fixExpiredContent() {
  let connection;
  
  try {
    console.log('🔧 FIXING EXPIRED CONTENT IN RAILWAY DATABASE');
    console.log('='.repeat(80));
    console.log('🔍 Connecting to Railway database...\n');
    
    // Connect to Railway database
    connection = await mysql.createConnection({
      host: 'centerbeam.proxy.rlwy.net',
      port: 14376,
      user: 'root',
      password: 'TtTMjTElsEGhDREYyaIBcNyjbQGajuqi',
      database: 'railway',
      timezone: '+08:00'
    });

    await connection.query("SET time_zone = '+08:00'");
    console.log('✅ Connected to Railway database\n');

    // Get current time
    const [currentTimeResult] = await connection.query("SELECT NOW() as `current_time`");
    const currentTime = currentTimeResult[0].current_time;
    console.log(`📅 Current Time (Asia/Manila): ${currentTime}\n`);
    console.log('='.repeat(80));

    // ========================================
    // FIX EXPIRED ANNOUNCEMENTS
    // ========================================
    console.log('\n📢 FIXING EXPIRED ANNOUNCEMENTS');
    console.log('='.repeat(80));

    await connection.beginTransaction();

    try {
      // Find expired announcements
      const findExpiredAnnouncementsQuery = `
        SELECT 
          announcement_id,
          title,
          status,
          visibility_end_at
        FROM announcements 
        WHERE visibility_end_at IS NOT NULL 
          AND visibility_end_at <= NOW()
          AND status != 'archived'
          AND deleted_at IS NULL
        FOR UPDATE;
      `;

      const [expiredAnnouncements] = await connection.query(findExpiredAnnouncementsQuery);
      console.log(`\nFound ${expiredAnnouncements.length} expired announcements to archive\n`);

      if (expiredAnnouncements.length > 0) {
        // Archive each expired announcement
        const archiveQuery = `
          UPDATE announcements 
          SET 
            status = 'archived',
            archived_at = NOW(),
            updated_at = NOW()
          WHERE announcement_id = ?
            AND status != 'archived'
            AND deleted_at IS NULL;
        `;

        let archivedCount = 0;
        for (const announcement of expiredAnnouncements) {
          const [result] = await connection.query(archiveQuery, [announcement.announcement_id]);
          
          if (result.affectedRows > 0) {
            archivedCount++;
            console.log(`✅ Archived: ${announcement.title} (ID: ${announcement.announcement_id})`);
            console.log(`   Expired: ${announcement.visibility_end_at}`);
          }
        }

        await connection.commit();
        console.log(`\n✅ Successfully archived ${archivedCount} announcements`);
      } else {
        await connection.commit();
        console.log('✅ No expired announcements to archive');
      }

    } catch (error) {
      await connection.rollback();
      console.error('❌ Error archiving announcements:', error.message);
      throw error;
    }

    // ========================================
    // FIX EXPIRED CALENDAR EVENTS
    // ========================================
    console.log('\n\n📅 FIXING EXPIRED CALENDAR EVENTS');
    console.log('='.repeat(80));

    await connection.beginTransaction();

    try {
      // Find expired calendar events
      const findExpiredEventsQuery = `
        SELECT 
          calendar_id,
          title,
          event_date,
          end_date,
          is_active
        FROM school_calendar 
        WHERE (
          (end_date IS NOT NULL AND end_date < CURDATE())
          OR (end_date IS NULL AND event_date < CURDATE())
        )
        AND is_active = 1
        AND deleted_at IS NULL
        FOR UPDATE;
      `;

      const [expiredEvents] = await connection.query(findExpiredEventsQuery);
      console.log(`\nFound ${expiredEvents.length} expired calendar events to archive\n`);

      if (expiredEvents.length > 0) {
        // Archive each expired event
        const archiveQuery = `
          UPDATE school_calendar 
          SET 
            is_active = 0,
            updated_at = NOW()
          WHERE calendar_id = ?
            AND is_active = 1
            AND deleted_at IS NULL;
        `;

        let archivedCount = 0;
        for (const event of expiredEvents) {
          const [result] = await connection.query(archiveQuery, [event.calendar_id]);
          
          if (result.affectedRows > 0) {
            archivedCount++;
            console.log(`✅ Archived: ${event.title} (ID: ${event.calendar_id})`);
            console.log(`   Event Date: ${event.event_date}`);
            if (event.end_date) {
              console.log(`   End Date: ${event.end_date}`);
            }
          }
        }

        await connection.commit();
        console.log(`\n✅ Successfully archived ${archivedCount} calendar events`);
      } else {
        await connection.commit();
        console.log('✅ No expired calendar events to archive');
      }

    } catch (error) {
      await connection.rollback();
      console.error('❌ Error archiving calendar events:', error.message);
      throw error;
    }

    // ========================================
    // VERIFICATION
    // ========================================
    console.log('\n\n🔍 VERIFICATION');
    console.log('='.repeat(80));

    // Check for remaining expired announcements
    const [remainingAnnouncements] = await connection.query(`
      SELECT COUNT(*) as count
      FROM announcements 
      WHERE visibility_end_at IS NOT NULL 
        AND visibility_end_at <= NOW()
        AND status != 'archived'
        AND deleted_at IS NULL
    `);

    // Check for remaining expired events
    const [remainingEvents] = await connection.query(`
      SELECT COUNT(*) as count
      FROM school_calendar 
      WHERE (
        (end_date IS NOT NULL AND end_date < CURDATE())
        OR (end_date IS NULL AND event_date < CURDATE())
      )
      AND is_active = 1
      AND deleted_at IS NULL
    `);

    console.log(`\n📊 Remaining Issues:`);
    console.log(`   Expired Announcements (not archived): ${remainingAnnouncements[0].count}`);
    console.log(`   Expired Calendar Events (is_active=1): ${remainingEvents[0].count}`);

    if (remainingAnnouncements[0].count === 0 && remainingEvents[0].count === 0) {
      console.log('\n✅ SUCCESS! All expired content has been properly archived.');
    } else {
      console.log('\n⚠️  WARNING: Some expired content still remains. Manual review needed.');
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ FIX COMPLETED');
    console.log('='.repeat(80));
    console.log('\n📋 Next Steps:');
    console.log('   1. Generate a new October report to verify the fix');
    console.log('   2. Set up automated cron job to prevent this issue in the future');
    console.log('   3. See RAILWAY_DATABASE_ANALYSIS_RESULTS.md for detailed instructions');
    console.log('\n');

  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Disconnected from database\n');
    }
  }
}

// Run the fix
fixExpiredContent();
