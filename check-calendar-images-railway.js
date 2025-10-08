/**
 * Check Calendar Events with Images in Railway Database
 */

const mysql = require('mysql2/promise');

async function checkCalendarImages() {
  let connection;
  
  try {
    console.log('🔍 CHECKING CALENDAR EVENTS WITH IMAGES');
    console.log('🌐 RAILWAY DATABASE\n');
    console.log('='.repeat(60));
    
    // Connect to Railway database
    connection = await mysql.createConnection({
      host: 'centerbeam.proxy.rlwy.net',
      port: 14376,
      user: 'root',
      password: 'TtTMjTElsEGhDREYyaIBcNyjbQGajuqi',
      database: 'railway',
      timezone: '+08:00'
    });
    
    console.log('✅ Connected to Railway database\n');
    
    // Check total calendar events
    const [totalEvents] = await connection.execute(
      'SELECT COUNT(*) as total FROM school_calendar WHERE deleted_at IS NULL'
    );
    console.log(`📊 Total calendar events: ${totalEvents[0].total}`);
    
    // Check active calendar events
    const [activeEvents] = await connection.execute(
      'SELECT COUNT(*) as total FROM school_calendar WHERE is_active = 1 AND deleted_at IS NULL'
    );
    console.log(`✅ Active calendar events: ${activeEvents[0].total}`);
    
    // Check total calendar attachments
    const [totalAttachments] = await connection.execute(
      'SELECT COUNT(*) as total FROM calendar_attachments WHERE deleted_at IS NULL'
    );
    console.log(`📎 Total calendar attachments: ${totalAttachments[0].total}\n`);
    
    // Get calendar events with images
    console.log('📅 CALENDAR EVENTS WITH IMAGES:');
    console.log('-'.repeat(60));
    
    const [eventsWithImages] = await connection.execute(`
      SELECT 
        c.calendar_id,
        c.title,
        c.event_date,
        c.end_date,
        c.is_active,
        COUNT(a.attachment_id) as image_count,
        GROUP_CONCAT(a.file_name SEPARATOR ', ') as image_files,
        GROUP_CONCAT(a.file_path SEPARATOR ', ') as image_paths
      FROM school_calendar c
      LEFT JOIN calendar_attachments a ON c.calendar_id = a.calendar_id AND a.deleted_at IS NULL
      WHERE c.deleted_at IS NULL
      GROUP BY c.calendar_id
      HAVING image_count > 0
      ORDER BY c.event_date DESC
      LIMIT 10
    `);
    
    if (eventsWithImages.length === 0) {
      console.log('❌ NO CALENDAR EVENTS WITH IMAGES FOUND');
      console.log('\n💡 To test TV Display images:');
      console.log('   1. Go to Admin Calendar');
      console.log('   2. Create or edit a calendar event');
      console.log('   3. Upload images to the event');
      console.log('   4. Save the event');
      console.log('   5. Select the event for TV Display');
    } else {
      console.log(`✅ Found ${eventsWithImages.length} calendar events with images:\n`);
      
      eventsWithImages.forEach((event, index) => {
        console.log(`${index + 1}. Event ID: ${event.calendar_id}`);
        console.log(`   Title: ${event.title}`);
        console.log(`   Date: ${event.event_date}${event.end_date ? ` to ${event.end_date}` : ''}`);
        console.log(`   Active: ${event.is_active ? 'Yes' : 'No'}`);
        console.log(`   Images: ${event.image_count}`);
        console.log(`   Files: ${event.image_files}`);
        console.log(`   Paths: ${event.image_paths}`);
        console.log('');
      });
      
      // Get detailed info for first event
      if (eventsWithImages.length > 0) {
        const firstEventId = eventsWithImages[0].calendar_id;
        console.log('\n📸 DETAILED IMAGE INFO FOR FIRST EVENT:');
        console.log('-'.repeat(60));
        
        const [imageDetails] = await connection.execute(`
          SELECT 
            attachment_id,
            file_name,
            file_path,
            file_type,
            file_size,
            mime_type,
            display_order,
            is_primary,
            uploaded_at
          FROM calendar_attachments
          WHERE calendar_id = ? AND deleted_at IS NULL
          ORDER BY display_order ASC, uploaded_at ASC
        `, [firstEventId]);
        
        imageDetails.forEach((img, index) => {
          console.log(`\nImage ${index + 1}:`);
          console.log(`  ID: ${img.attachment_id}`);
          console.log(`  File: ${img.file_name}`);
          console.log(`  Path: ${img.file_path}`);
          console.log(`  Type: ${img.file_type}`);
          console.log(`  Size: ${(img.file_size / 1024).toFixed(2)} KB`);
          console.log(`  MIME: ${img.mime_type}`);
          console.log(`  Order: ${img.display_order}`);
          console.log(`  Primary: ${img.is_primary ? 'Yes' : 'No'}`);
          console.log(`  Uploaded: ${img.uploaded_at}`);
        });
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ CHECK COMPLETED');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Database connection closed');
    }
  }
}

// Run the check
if (require.main === module) {
  checkCalendarImages();
}

module.exports = checkCalendarImages;

