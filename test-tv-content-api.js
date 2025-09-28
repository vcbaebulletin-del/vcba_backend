// Use node's built-in fetch (Node 18+) or http module
const https = require('https');
const http = require('http');

const BASE_URL = 'http://localhost:5000';

async function testTVContentAPI() {
  try {
    console.log('🔐 Testing admin login...');
    
    // Login to get token
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: 'test.admin@example.com',
      password: 'TestPassword123!',
      userType: 'admin'
    });

    if (!loginResponse.data.success) {
      throw new Error('Login failed');
    }

    const token = loginResponse.data.data.accessToken;
    console.log('✅ Login successful, token received:', token.substring(0, 20) + '...');

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    console.log('\n📢 Testing announcements endpoint...');
    try {
      const announcementsResponse = await axios.get(`${BASE_URL}/api/announcements`, {
        headers,
        params: {
          status: 'published',
          page: 1,
          limit: 50,
          sort_by: 'created_at',
          sort_order: 'DESC'
        }
      });

      console.log('✅ Announcements response:', {
        success: announcementsResponse.data.success,
        count: announcementsResponse.data.data?.announcements?.length || 0,
        status: announcementsResponse.status
      });

      if (announcementsResponse.data.data?.announcements?.length > 0) {
        console.log('📋 Sample announcement:', {
          id: announcementsResponse.data.data.announcements[0].announcement_id,
          title: announcementsResponse.data.data.announcements[0].title,
          status: announcementsResponse.data.data.announcements[0].status
        });
      }
    } catch (error) {
      console.error('❌ Announcements request failed:', error.response?.data || error.message);
    }

    console.log('\n📅 Testing calendar endpoint...');
    try {
      const calendarResponse = await axios.get(`${BASE_URL}/api/calendar`, {
        headers,
        params: {
          is_holiday: 0,
          is_active: 1,
          limit: 50,
          sort_by: 'event_date',
          sort_order: 'ASC'
        }
      });

      console.log('✅ Calendar response:', {
        success: calendarResponse.data.success,
        count: calendarResponse.data.data?.length || 0,
        status: calendarResponse.status
      });

      if (calendarResponse.data.data?.length > 0) {
        console.log('📋 Sample calendar event:', {
          id: calendarResponse.data.data[0].calendar_id,
          title: calendarResponse.data.data[0].title,
          date: calendarResponse.data.data[0].event_date,
          is_holiday: calendarResponse.data.data[0].is_holiday
        });
      }
    } catch (error) {
      console.error('❌ Calendar request failed:', error.response?.data || error.message);
    }

  } catch (error) {
    console.error('💥 Test failed:', error.response?.data || error.message);
  }
}

testTVContentAPI();
