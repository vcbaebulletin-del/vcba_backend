#!/usr/bin/env node

/**
 * Test TV Display API Response
 * 
 * This script tests the actual API responses for announcements and calendar events
 * to verify if images are being included in the response.
 */

const axios = require('axios');
require('dotenv').config();

// Use Railway backend URL - update this with your actual Railway backend URL
const BASE_URL = process.env.API_BASE_URL || 'https://vcba-backend-production.up.railway.app';

async function testTVDisplayAPIs() {
  console.log('🧪 Testing TV Display API Responses...\n');
  console.log(`📍 Base URL: ${BASE_URL}\n`);

  try {
    // Test 1: Fetch announcements (like TV Display does)
    console.log('📢 TEST 1: Fetching announcements (published, recent first)');
    console.log('   Endpoint: GET /api/announcements?status=published&page=1&limit=10&sort_by=created_at&sort_order=DESC\n');

    const announcementsResponse = await axios.get(`${BASE_URL}/api/announcements`, {
      params: {
        status: 'published',
        page: 1,
        limit: 10,
        sort_by: 'created_at',
        sort_order: 'DESC'
      }
    });

    if (announcementsResponse.data.success) {
      const announcements = announcementsResponse.data.data.announcements || [];
      console.log(`   ✅ Success: Found ${announcements.length} announcements\n`);

      if (announcements.length > 0) {
        const firstAnnouncement = announcements[0];
        console.log('   📋 First announcement details:');
        console.log(`      ID: ${firstAnnouncement.announcement_id}`);
        console.log(`      Title: ${firstAnnouncement.title}`);
        console.log(`      Has image_path: ${!!firstAnnouncement.image_path}`);
        console.log(`      image_path value: ${firstAnnouncement.image_path || 'null'}`);
        console.log(`      Has images array: ${!!firstAnnouncement.images}`);
        console.log(`      images array length: ${firstAnnouncement.images?.length || 0}`);
        console.log(`      Has attachments array: ${!!firstAnnouncement.attachments}`);
        console.log(`      attachments array length: ${firstAnnouncement.attachments?.length || 0}`);

        if (firstAnnouncement.images && firstAnnouncement.images.length > 0) {
          console.log('\n      📸 Images:');
          firstAnnouncement.images.forEach((img, index) => {
            console.log(`         ${index + 1}. ${img.file_name} (${img.file_path})`);
          });
        }

        if (firstAnnouncement.attachments && firstAnnouncement.attachments.length > 0) {
          console.log('\n      📎 Attachments:');
          firstAnnouncement.attachments.forEach((att, index) => {
            console.log(`         ${index + 1}. ${att.file_name} (${att.file_path})`);
          });
        }
      }
    } else {
      console.log(`   ❌ Failed: ${announcementsResponse.data.message}`);
    }

    console.log('\n' + '='.repeat(80) + '\n');

    // Test 2: Fetch calendar events (like TV Display does)
    const currentYear = new Date().getFullYear();
    console.log(`📅 TEST 2: Fetching calendar events for year ${currentYear}`);
    console.log(`   Endpoint: GET /api/calendar/view?year=${currentYear}\n`);

    const calendarResponse = await axios.get(`${BASE_URL}/api/calendar/view`, {
      params: {
        year: currentYear
      }
    });

    if (calendarResponse.data.success) {
      const eventsGrouped = calendarResponse.data.data.events || {};
      const allEvents = Object.values(eventsGrouped).flat();
      console.log(`   ✅ Success: Found ${allEvents.length} calendar events\n`);

      if (allEvents.length > 0) {
        const firstEvent = allEvents[0];
        console.log('   📋 First calendar event details:');
        console.log(`      ID: ${firstEvent.calendar_id}`);
        console.log(`      Title: ${firstEvent.title}`);
        console.log(`      Event Date: ${firstEvent.event_date}`);
        console.log(`      Has images array: ${!!firstEvent.images}`);
        console.log(`      images array type: ${typeof firstEvent.images}`);
        console.log(`      images array length: ${firstEvent.images?.length || 0}`);
        console.log(`      Has attachments array: ${!!firstEvent.attachments}`);
        console.log(`      attachments array type: ${typeof firstEvent.attachments}`);
        console.log(`      attachments array length: ${firstEvent.attachments?.length || 0}`);

        if (firstEvent.images && firstEvent.images.length > 0) {
          console.log('\n      📸 Images:');
          firstEvent.images.forEach((img, index) => {
            console.log(`         ${index + 1}. ${img.file_name} (${img.file_path})`);
          });
        } else {
          console.log('\n      ⚠️  No images found for this event');
        }

        if (firstEvent.attachments && firstEvent.attachments.length > 0) {
          console.log('\n      📎 Attachments:');
          firstEvent.attachments.forEach((att, index) => {
            console.log(`         ${index + 1}. ${att.file_name} (${att.file_path})`);
          });
        } else {
          console.log('\n      ⚠️  No attachments found for this event');
        }

        // Check a few more events to see if any have images
        console.log('\n   🔍 Checking all events for images...');
        let eventsWithImages = 0;
        let eventsWithAttachments = 0;

        allEvents.forEach(event => {
          if (event.images && event.images.length > 0) {
            eventsWithImages++;
            console.log(`      ✅ Event "${event.title}" (ID: ${event.calendar_id}) has ${event.images.length} images`);
          }
          if (event.attachments && event.attachments.length > 0) {
            eventsWithAttachments++;
          }
        });

        console.log(`\n   📊 Summary:`);
        console.log(`      Total events: ${allEvents.length}`);
        console.log(`      Events with images: ${eventsWithImages}`);
        console.log(`      Events with attachments: ${eventsWithAttachments}`);
      }
    } else {
      console.log(`   ❌ Failed: ${calendarResponse.data.message}`);
    }

    console.log('\n' + '='.repeat(80) + '\n');

    // Test 3: Compare data structures
    console.log('📊 TEST 3: Data Structure Comparison\n');

    if (announcementsResponse.data.success && calendarResponse.data.success) {
      const announcements = announcementsResponse.data.data.announcements || [];
      const eventsGrouped = calendarResponse.data.data.events || {};
      const allEvents = Object.values(eventsGrouped).flat();

      console.log('   Announcement structure:');
      if (announcements.length > 0) {
        const sampleAnnouncement = announcements[0];
        console.log('      Properties:', Object.keys(sampleAnnouncement).join(', '));
        console.log(`      Has 'images': ${Object.keys(sampleAnnouncement).includes('images')}`);
        console.log(`      Has 'attachments': ${Object.keys(sampleAnnouncement).includes('attachments')}`);
      }

      console.log('\n   Calendar event structure:');
      if (allEvents.length > 0) {
        const sampleEvent = allEvents[0];
        console.log('      Properties:', Object.keys(sampleEvent).join(', '));
        console.log(`      Has 'images': ${Object.keys(sampleEvent).includes('images')}`);
        console.log(`      Has 'attachments': ${Object.keys(sampleEvent).includes('attachments')}`);
      }

      console.log('\n   🔍 Conclusion:');
      if (announcements.length > 0 && allEvents.length > 0) {
        const announcementHasImages = Object.keys(announcements[0]).includes('images');
        const eventHasImages = Object.keys(allEvents[0]).includes('images');

        if (announcementHasImages && !eventHasImages) {
          console.log('      ❌ ISSUE FOUND: Announcements have "images" property but calendar events do NOT!');
        } else if (announcementHasImages && eventHasImages) {
          console.log('      ✅ Both announcements and calendar events have "images" property');
          console.log('      ℹ️  If images still not showing, check:');
          console.log('         1. Do calendar events actually have images uploaded in the database?');
          console.log('         2. Are the image file paths correct?');
          console.log('         3. Are the events selected for TV Display?');
        } else {
          console.log('      ⚠️  Neither announcements nor calendar events have "images" property');
        }
      }
    }

    console.log('\n✅ All tests completed!');

  } catch (error) {
    console.error('❌ Error during testing:', error.message);
    if (error.response) {
      console.error('   Response status:', error.response.status);
      console.error('   Response data:', error.response.data);
    }
  }
}

// Run the test
testTVDisplayAPIs().catch(console.error);

