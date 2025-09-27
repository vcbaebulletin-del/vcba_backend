const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'db_ebulletin_system',
  port: process.env.DB_PORT || 3306
};

async function addAnnouncementVisibilityFields() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database');

    // Step 1: Add visibility_start_at column
    console.log('🔄 Adding visibility_start_at column...');
    await connection.execute(`
      ALTER TABLE announcements
      ADD COLUMN visibility_start_at TIMESTAMP NULL DEFAULT NULL
      COMMENT 'Start date and time for announcement visibility (includes time for precision, e.g., 2025-09-04 07:00:00)'
      AFTER scheduled_publish_at
    `);
    console.log('✅ Added visibility_start_at column');

    // Step 2: Add visibility_end_at column
    console.log('🔄 Adding visibility_end_at column...');
    await connection.execute(`
      ALTER TABLE announcements
      ADD COLUMN visibility_end_at TIMESTAMP NULL DEFAULT NULL
      COMMENT 'End date and time for announcement visibility (includes time for precision, e.g., 2025-09-10 17:00:00)'
      AFTER visibility_start_at
    `);
    console.log('✅ Added visibility_end_at column');

    // Step 3: Add indexes
    console.log('🔄 Adding indexes...');
    await connection.execute('CREATE INDEX idx_announcements_visibility_start ON announcements(visibility_start_at)');
    await connection.execute('CREATE INDEX idx_announcements_visibility_end ON announcements(visibility_end_at)');
    await connection.execute('CREATE INDEX idx_announcements_status_visibility ON announcements(status, visibility_start_at, visibility_end_at)');
    await connection.execute('CREATE INDEX idx_announcements_published_visibility ON announcements(status, published_at, visibility_start_at, visibility_end_at)');
    console.log('✅ Added all indexes');

    console.log('✅ Migration completed successfully');

    // Verify the changes
    console.log('\n📋 Updated announcements table structure:');
    const [structure] = await connection.execute('DESCRIBE announcements');
    console.table(structure);

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
  } finally {
    if (connection) await connection.end();
  }
}

addAnnouncementVisibilityFields();