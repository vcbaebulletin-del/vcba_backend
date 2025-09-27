const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'db_ebulletin_system',
  port: process.env.DB_PORT || 3306,
  multipleStatements: true
};

async function runMigration() {
  let connection;
  
  try {
    console.log('🔧 Connecting to database...');
    console.log(`Database: ${dbConfig.database} at ${dbConfig.host}:${dbConfig.port}`);
    
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database successfully');

    // Check if admin_accounts table exists
    console.log('\n🔍 Checking admin_accounts table...');
    const [adminTables] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'admin_accounts'
    `, [dbConfig.database]);
    
    if (adminTables.length === 0) {
      console.error('❌ admin_accounts table not found! Please ensure the admin system is set up first.');
      process.exit(1);
    }
    console.log('✅ admin_accounts table found');

    // Check if any admin exists
    const [adminCount] = await connection.execute('SELECT COUNT(*) as count FROM admin_accounts');
    if (adminCount[0].count === 0) {
      console.error('❌ No admin accounts found! Please create at least one admin account first.');
      process.exit(1);
    }
    console.log(`✅ Found ${adminCount[0].count} admin account(s)`);

    // Check if welcome page tables already exist
    console.log('\n🔍 Checking existing welcome page tables...');
    const [existingTables] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN ('welcome_page', 'welcome_cards', 'login_carousel_images')
    `, [dbConfig.database]);
    
    if (existingTables.length > 0) {
      console.log('⚠️ Some welcome page tables already exist:');
      existingTables.forEach(table => console.log(`   - ${table.TABLE_NAME}`));
      
      console.log('\n🗑️ Dropping existing tables...');
      await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
      await connection.execute('DROP TABLE IF EXISTS login_carousel_images');
      await connection.execute('DROP TABLE IF EXISTS welcome_cards');
      await connection.execute('DROP TABLE IF EXISTS welcome_page');
      await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
      console.log('✅ Existing tables dropped');
    }

    // Execute migration statements individually
    console.log('\n🔧 Creating welcome_page table...');
    await connection.execute(`
      CREATE TABLE welcome_page (
        id int(11) NOT NULL AUTO_INCREMENT,
        background_image varchar(500) NOT NULL COMMENT 'Path to background image file',
        is_active tinyint(1) NOT NULL DEFAULT 1 COMMENT 'Whether this background is currently active',
        created_at timestamp NOT NULL DEFAULT current_timestamp(),
        updated_at timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        created_by int(11) NOT NULL COMMENT 'Admin ID who uploaded the image',
        PRIMARY KEY (id),
        KEY idx_welcome_page_active (is_active),
        KEY idx_welcome_page_created_by (created_by),
        CONSTRAINT fk_welcome_page_created_by FOREIGN KEY (created_by) REFERENCES admin_accounts (admin_id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Welcome page background image management'
    `);
    console.log('✅ welcome_page table created');

    console.log('🔧 Creating welcome_cards table...');
    await connection.execute(`
      CREATE TABLE welcome_cards (
        id int(11) NOT NULL AUTO_INCREMENT,
        title varchar(255) NOT NULL COMMENT 'Card title',
        description text NOT NULL COMMENT 'Card description',
        image varchar(500) NOT NULL COMMENT 'Path to card image file',
        order_index int(11) NOT NULL DEFAULT 0 COMMENT 'Display order (0-based)',
        is_active tinyint(1) NOT NULL DEFAULT 1 COMMENT 'Whether this card is visible',
        created_at timestamp NOT NULL DEFAULT current_timestamp(),
        updated_at timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        created_by int(11) NOT NULL COMMENT 'Admin ID who created the card',
        PRIMARY KEY (id),
        KEY idx_welcome_cards_active (is_active),
        KEY idx_welcome_cards_order (order_index),
        KEY idx_welcome_cards_created_by (created_by),
        CONSTRAINT fk_welcome_cards_created_by FOREIGN KEY (created_by) REFERENCES admin_accounts (admin_id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Welcome page dynamic cards'
    `);
    console.log('✅ welcome_cards table created');

    console.log('🔧 Creating login_carousel_images table...');
    await connection.execute(`
      CREATE TABLE login_carousel_images (
        id int(11) NOT NULL AUTO_INCREMENT,
        image varchar(500) NOT NULL COMMENT 'Path to carousel image file',
        order_index int(11) NOT NULL DEFAULT 0 COMMENT 'Display order (0-based)',
        is_active tinyint(1) NOT NULL DEFAULT 1 COMMENT 'Whether this image is visible in carousel',
        created_at timestamp NOT NULL DEFAULT current_timestamp(),
        updated_at timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        created_by int(11) NOT NULL COMMENT 'Admin ID who uploaded the image',
        PRIMARY KEY (id),
        KEY idx_login_carousel_active (is_active),
        KEY idx_login_carousel_order (order_index),
        KEY idx_login_carousel_created_by (created_by),
        CONSTRAINT fk_login_carousel_created_by FOREIGN KEY (created_by) REFERENCES admin_accounts (admin_id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Login page carousel images'
    `);
    console.log('✅ login_carousel_images table created');

    console.log('🔧 Inserting default data...');

    // Get the first admin ID
    const [firstAdmin] = await connection.execute('SELECT admin_id FROM admin_accounts ORDER BY admin_id LIMIT 1');
    const adminId = firstAdmin[0].admin_id;
    console.log(`Using admin_id: ${adminId} for default data`);

    // Insert default welcome page background
    await connection.execute(`
      INSERT INTO welcome_page (background_image, is_active, created_by) VALUES
      ('/villamor-image/villamor-collge-BG-landscape.jpg', 1, ?)
    `, [adminId]);
    console.log('✅ Default background inserted');

    // Insert default welcome cards
    await connection.execute(`
      INSERT INTO welcome_cards (title, description, image, order_index, is_active, created_by) VALUES
      ('Academic Excellence', 'Access to quality education and comprehensive learning resources', '/uploads/welcome/default-academic.jpg', 0, 1, ?),
      ('Vibrant Community', 'Join a diverse community of students, faculty, and staff', '/uploads/welcome/default-community.jpg', 1, 1, ?),
      ('Campus Events', 'Stay updated with the latest announcements and campus activities', '/uploads/welcome/default-events.jpg', 2, 1, ?),
      ('Achievement Recognition', 'Celebrate academic and extracurricular accomplishments', '/uploads/welcome/default-achievement.jpg', 3, 1, ?)
    `, [adminId, adminId, adminId, adminId]);
    console.log('✅ Default cards inserted');

    // Insert default login carousel images
    await connection.execute(`
      INSERT INTO login_carousel_images (image, order_index, is_active, created_by) VALUES
      ('/uploads/carousel/vcba_adv_4.jpg', 0, 1, ?),
      ('/uploads/carousel/vcba_adv_5.jpg', 1, 1, ?),
      ('/uploads/carousel/vcba_adv_6.jpg', 2, 1, ?),
      ('/uploads/carousel/vcba_adv_7.jpg', 3, 1, ?),
      ('/uploads/carousel/vcba_adv_8.jpg', 4, 1, ?),
      ('/uploads/carousel/vcba_adv_9.jpg', 5, 1, ?),
      ('/uploads/carousel/vcba_adv_10.jpg', 6, 1, ?),
      ('/uploads/carousel/vcba_adv_11.jpg', 7, 1, ?),
      ('/uploads/carousel/vcba_adv_12.jpg', 8, 1, ?),
      ('/uploads/carousel/vcba_adv_13.jpg', 9, 1, ?)
    `, [adminId, adminId, adminId, adminId, adminId, adminId, adminId, adminId, adminId, adminId]);
    console.log('✅ Default carousel images inserted');

    console.log('✅ Migration executed successfully');

    // Verify tables were created
    console.log('\n🔍 Verifying table creation...');
    const [newTables] = await connection.execute(`
      SELECT TABLE_NAME, TABLE_COMMENT
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN ('welcome_page', 'welcome_cards', 'login_carousel_images')
    `, [dbConfig.database]);
    
    console.log('✅ Created tables:');
    newTables.forEach(table => {
      console.log(`   - ${table.TABLE_NAME}: ${table.TABLE_COMMENT}`);
    });

    // Check data
    console.log('\n📊 Checking inserted data...');
    const [backgroundCount] = await connection.execute('SELECT COUNT(*) as count FROM welcome_page');
    const [cardCount] = await connection.execute('SELECT COUNT(*) as count FROM welcome_cards');
    const [carouselCount] = await connection.execute('SELECT COUNT(*) as count FROM login_carousel_images');
    
    console.log(`   - Welcome page backgrounds: ${backgroundCount[0].count}`);
    console.log(`   - Welcome cards: ${cardCount[0].count}`);
    console.log(`   - Carousel images: ${carouselCount[0].count}`);

    console.log('\n🎉 Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('💡 Make sure MySQL server is running');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('💡 Check database credentials in .env file');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.error('💡 Database does not exist. Please create it first.');
    }
    
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the migration
if (require.main === module) {
  runMigration();
}

module.exports = { runMigration };
