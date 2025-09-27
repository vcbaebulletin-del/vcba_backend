const mysql = require('mysql2/promise');

async function publishAnnouncement() {
  console.log('📢 Publishing grade 11 announcement...\n');

  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'db_ebulletin_system'
    });
    
    console.log('🔍 Current status of announcement ID 35:');
    const [before] = await connection.execute(`
      SELECT announcement_id, title, grade_level, status, created_at
      FROM announcements 
      WHERE announcement_id = 35
    `);
    console.table(before);
    
    console.log('\n📢 Publishing announcement...');
    await connection.execute(`
      UPDATE announcements 
      SET status = 'published', updated_at = NOW()
      WHERE announcement_id = 35
    `);
    
    console.log('✅ Announcement published!');
    
    console.log('\n🔍 Updated status:');
    const [after] = await connection.execute(`
      SELECT announcement_id, title, grade_level, status, created_at, updated_at
      FROM announcements 
      WHERE announcement_id = 35
    `);
    console.table(after);
    
    console.log('\n🎯 Verifying: Announcements that grade 11 admin should now see:');
    const [grade11Announcements] = await connection.execute(`
      SELECT 
        announcement_id,
        title,
        grade_level,
        status,
        created_at
      FROM announcements 
      WHERE (grade_level = 11 OR grade_level IS NULL)
      AND status = 'published'
      ORDER BY created_at DESC
    `);
    
    if (grade11Announcements.length > 0) {
      console.table(grade11Announcements);
      console.log(`✅ SUCCESS: Grade 11 admin should now see ${grade11Announcements.length} announcement(s)`);
    } else {
      console.log('❌ Still no announcements visible to grade 11 admin');
    }
    
    await connection.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

publishAnnouncement();
