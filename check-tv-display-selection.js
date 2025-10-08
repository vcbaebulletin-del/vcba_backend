#!/usr/bin/env node

/**
 * Check TV Display Content Selection
 * 
 * This script checks which calendar events and announcements are selected for TV Display.
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkTVDisplaySelection() {
  console.log('📺 Checking TV Display Content Selection...\n');

  const connection = await mysql.createConnection({
    host: process.env.MYSQLHOST || 'centerbeam.proxy.rlwy.net',
    port: parseInt(process.env.MYSQLPORT || '14376'),
    user: process.env.MYSQLUSER || 'root',
    password: process.env.MYSQLPASSWORD || 'TtTMjTElsEGhDREYyaIBcNyjbQGajuqi',
    database: process.env.MYSQLDATABASE || 'railway',
    timezone: 'Z',
    dateStrings: true
  });

  try {
    console.log('✅ Connected to Railway MySQL database\n');

    // Check TV Display settings
    console.log('⚙️  TV DISPLAY SETTINGS:');
    console.log('='.repeat(80));
    
    // TV Display settings are stored in localStorage on the frontend
    // But let's check if there's a settings table
    const [tables] = await connection.execute(`
      SHOW TABLES LIKE '%tv%'
    `);
    
    if (tables.length > 0) {
      console.log('Found TV-related tables:');
      tables.forEach(table => {
        console.log(`   - ${Object.values(table)[0]}`);
      });
    } else {
      console.log('ℹ️  No TV-related tables found (settings stored in localStorage)');
    }

    console.log('\n');

    // Check calendar events with images that are active
    console.log('📅 ACTIVE CALENDAR EVENTS WITH IMAGES:');
    console.log('='.repeat(80));
    
    const [eventsWithImages] = await connection.execute(`
      SELECT 
        sc.calendar_id,
        sc.title,
        sc.event_date,
        sc.end_date,
        sc.is_active,
        COUNT(ca.attachment_id) as image_count
      FROM school_calendar sc
      JOIN calendar_attachments ca ON sc.calendar_id = ca.calendar_id
      WHERE sc.deleted_at IS NULL 
        AND ca.deleted_at IS NULL
        AND sc.is_active = 1
      GROUP BY sc.calendar_id
      ORDER BY sc.event_date DESC
    `);

    console.log(`Found ${eventsWithImages.length} active calendar events with images\n`);

    if (eventsWithImages.length === 0) {
      console.log('❌ NO ACTIVE CALENDAR EVENTS WITH IMAGES!');
      console.log('   Either:');
      console.log('   1. Events with images are set to inactive (is_active = 0)');
      console.log('   2. No calendar events have images uploaded\n');
    } else {
      eventsWithImages.forEach((event, index) => {
        console.log(`${index + 1}. Event ID: ${event.calendar_id}`);
        console.log(`   Title: ${event.title}`);
        console.log(`   Date: ${event.event_date}${event.end_date ? ` to ${event.end_date}` : ''}`);
        console.log(`   Images: ${event.image_count}`);
        console.log(`   Active: ${event.is_active ? 'Yes' : 'No'}`);
        console.log('');
      });
    }

    // Check announcements with images that are published
    console.log('\n📢 PUBLISHED ANNOUNCEMENTS WITH IMAGES:');
    console.log('='.repeat(80));
    
    const [announcementsWithImages] = await connection.execute(`
      SELECT 
        a.announcement_id,
        a.title,
        a.status,
        a.image_path,
        COUNT(aa.attachment_id) as attachment_count
      FROM announcements a
      LEFT JOIN announcement_attachments aa ON a.announcement_id = aa.announcement_id AND aa.deleted_at IS NULL
      WHERE a.deleted_at IS NULL 
        AND a.status = 'published'
        AND (a.image_path IS NOT NULL OR aa.attachment_id IS NOT NULL)
      GROUP BY a.announcement_id
      ORDER BY a.created_at DESC
      LIMIT 10
    `);

    console.log(`Found ${announcementsWithImages.length} published announcements with images\n`);

    if (announcementsWithImages.length > 0) {
      announcementsWithImages.forEach((ann, index) => {
        console.log(`${index + 1}. Announcement ID: ${ann.announcement_id}`);
        console.log(`   Title: ${ann.title}`);
        console.log(`   Has image_path: ${ann.image_path ? 'Yes' : 'No'}`);
        console.log(`   Attachments: ${ann.attachment_count}`);
        console.log('');
      });
    }

    // Summary and recommendations
    console.log('\n📊 SUMMARY & RECOMMENDATIONS:');
    console.log('='.repeat(80));
    
    if (eventsWithImages.length > 0) {
      console.log(`✅ ${eventsWithImages.length} active calendar events with images are available for TV Display`);
      console.log('\n💡 TO DISPLAY THESE EVENTS ON TV:');
      console.log('   1. Open Admin Panel → TV Display Control');
      console.log('   2. Click "Content Selection" tab');
      console.log('   3. Select the following calendar events:');
      eventsWithImages.forEach(event => {
        console.log(`      ☐ ${event.title} (ID: ${event.calendar_id}) - ${event.image_count} image(s)`);
      });
      console.log('   4. Click "Save Selection"');
      console.log('   5. Open TV Display');
      console.log('   6. Images should now appear!');
    } else {
      console.log('❌ No active calendar events with images found!');
      console.log('\n💡 TO FIX THIS:');
      console.log('   1. Go to Admin Panel → Calendar Management');
      console.log('   2. Find an active calendar event (or create a new one)');
      console.log('   3. Click "Edit"');
      console.log('   4. Upload 1-3 images');
      console.log('   5. Make sure "Active" is checked');
      console.log('   6. Save the event');
      console.log('   7. Then select it for TV Display');
    }

    console.log('\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await connection.end();
    console.log('✅ Database connection closed');
  }
}

// Run the check
checkTVDisplaySelection().catch(console.error);

