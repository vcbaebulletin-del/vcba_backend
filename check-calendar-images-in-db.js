#!/usr/bin/env node

/**
 * Check Calendar Images in Database
 * 
 * This script directly queries the Railway database to check if calendar events have images.
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkCalendarImages() {
  console.log('🔍 Checking Calendar Images in Railway Database...\n');

  // Create connection to Railway MySQL database
  const connection = await mysql.createConnection({
    host: process.env.MYSQLHOST || 'centerbeam.proxy.rlwy.net',
    port: parseInt(process.env.MYSQLPORT || '14376'),
    user: process.env.MYSQLUSER || 'root',
    password: process.env.MYSQLPASSWORD || 'TtTMjTElsEGhDREYyaIBcNyjbQGajuqi',
    database: process.env.MYSQLDATABASE || 'railway',
    timezone: 'Z', // Use UTC to avoid timezone issues
    dateStrings: true
  });

  try {
    console.log('✅ Connected to Railway MySQL database\n');

    // Check calendar events
    console.log('📅 CALENDAR EVENTS:');
    console.log('='.repeat(80));
    const [events] = await connection.execute(`
      SELECT 
        calendar_id,
        title,
        event_date,
        end_date,
        is_active,
        created_at
      FROM school_calendar
      WHERE deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT 10
    `);

    console.log(`Found ${events.length} calendar events\n`);

    if (events.length === 0) {
      console.log('⚠️  No calendar events found in database!\n');
    } else {
      events.forEach((event, index) => {
        console.log(`${index + 1}. Event ID: ${event.calendar_id}`);
        console.log(`   Title: ${event.title}`);
        console.log(`   Date: ${event.event_date}${event.end_date ? ` to ${event.end_date}` : ''}`);
        console.log(`   Active: ${event.is_active ? 'Yes' : 'No'}`);
        console.log(`   Created: ${event.created_at}`);
        console.log('');
      });
    }

    // Check calendar attachments
    console.log('\n📎 CALENDAR ATTACHMENTS:');
    console.log('='.repeat(80));
    const [attachments] = await connection.execute(`
      SELECT 
        ca.attachment_id,
        ca.calendar_id,
        ca.file_name,
        ca.file_path,
        ca.file_type,
        ca.mime_type,
        ca.is_primary,
        ca.uploaded_at,
        sc.title as event_title
      FROM calendar_attachments ca
      JOIN school_calendar sc ON ca.calendar_id = sc.calendar_id
      WHERE ca.deleted_at IS NULL
      ORDER BY ca.uploaded_at DESC
      LIMIT 20
    `);

    console.log(`Found ${attachments.length} calendar attachments\n`);

    if (attachments.length === 0) {
      console.log('❌ NO CALENDAR ATTACHMENTS FOUND IN DATABASE!');
      console.log('   This is the problem! Calendar events have no images uploaded.\n');
    } else {
      console.log('✅ Calendar attachments exist in database:\n');
      attachments.forEach((att, index) => {
        console.log(`${index + 1}. Attachment ID: ${att.attachment_id}`);
        console.log(`   Event: ${att.event_title} (ID: ${att.calendar_id})`);
        console.log(`   File: ${att.file_name}`);
        console.log(`   Path: ${att.file_path}`);
        console.log(`   Type: ${att.file_type} (${att.mime_type})`);
        console.log(`   Primary: ${att.is_primary ? 'Yes' : 'No'}`);
        console.log(`   Uploaded: ${att.uploaded_at}`);
        console.log('');
      });
    }

    // Summary
    console.log('\n📊 SUMMARY:');
    console.log('='.repeat(80));
    console.log(`Total calendar events: ${events.length}`);
    console.log(`Total calendar attachments: ${attachments.length}`);

    if (events.length > 0 && attachments.length === 0) {
      console.log('\n❌ PROBLEM IDENTIFIED:');
      console.log('   Calendar events exist, but NO images/attachments are uploaded!');
      console.log('   This is why TV Display shows no images for calendar events.');
      console.log('\n💡 SOLUTION:');
      console.log('   1. Go to Admin Panel → Calendar Management');
      console.log('   2. Edit an existing calendar event');
      console.log('   3. Upload 1-3 images using the image upload feature');
      console.log('   4. Save the event');
      console.log('   5. Select the event for TV Display');
      console.log('   6. Check TV Display - images should now appear!');
    } else if (events.length > 0 && attachments.length > 0) {
      // Check which events have attachments
      const eventsWithAttachments = new Set(attachments.map(a => a.calendar_id));
      const eventsWithoutAttachments = events.filter(e => !eventsWithAttachments.has(e.calendar_id));

      console.log(`\n✅ Events with images: ${eventsWithAttachments.size}`);
      console.log(`⚠️  Events without images: ${eventsWithoutAttachments.length}`);

      if (eventsWithoutAttachments.length > 0) {
        console.log('\nEvents without images:');
        eventsWithoutAttachments.forEach(e => {
          console.log(`   - ${e.title} (ID: ${e.calendar_id})`);
        });
      }

      console.log('\n💡 NEXT STEPS:');
      console.log('   1. Make sure the events WITH images are selected for TV Display');
      console.log('   2. Check Railway backend logs for image detection');
      console.log('   3. Check browser console for TV Display image logs');
      console.log('   4. If images still not showing, there may be a file path issue');
    } else if (events.length === 0) {
      console.log('\n⚠️  No calendar events found in database!');
      console.log('   Create some calendar events first.');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await connection.end();
    console.log('\n✅ Database connection closed');
  }
}

// Run the check
checkCalendarImages().catch(console.error);

