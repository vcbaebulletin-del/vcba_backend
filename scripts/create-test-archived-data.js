const mysql = require('mysql2/promise');
require('dotenv').config();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'db_ebulletin_system',
  port: process.env.DB_PORT || 3306
};

async function createTestArchivedData() {
  let connection;
  
  try {
    console.log('🔧 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database successfully');

    // Get the first admin ID
    const [firstAdmin] = await connection.execute('SELECT admin_id FROM admin_accounts ORDER BY admin_id LIMIT 1');
    const adminId = firstAdmin[0].admin_id;
    console.log(`Using admin_id: ${adminId} for test data`);

    // Create some test archived welcome cards
    console.log('\n🔧 Creating test archived welcome cards...');
    const archivedCards = [
      {
        title: 'Archived Card 1',
        description: 'This is a test archived welcome card for testing the archive functionality.',
        image: '/carousel/vcba_adv_1.jpg',
        order_index: 0
      },
      {
        title: 'Archived Card 2', 
        description: 'Another test archived welcome card to verify the archive display works correctly.',
        image: '/carousel/vcba_adv_2.jpg',
        order_index: 1
      },
      {
        title: 'Archived Card 3',
        description: 'Third test archived card to ensure pagination and listing works properly.',
        image: '/carousel/vcba_adv_3.jpg',
        order_index: 2
      }
    ];

    for (const card of archivedCards) {
      await connection.execute(`
        INSERT INTO welcome_cards (title, description, image, order_index, is_active, created_by, deleted_at) 
        VALUES (?, ?, ?, ?, 0, ?, NOW())
      `, [card.title, card.description, card.image, card.order_index, adminId]);
    }
    console.log(`✅ Created ${archivedCards.length} test archived welcome cards`);

    // Create some test archived carousel images
    console.log('🔧 Creating test archived carousel images...');
    const archivedImages = [
      { image: '/carousel/vcba_adv_14.jpg', order_index: 0 },
      { image: '/carousel/vcba_adv_15.jpg', order_index: 1 },
      { image: '/carousel/vcba_adv_16.jpg', order_index: 2 },
      { image: '/carousel/vcba_adv_17.jpg', order_index: 3 }
    ];

    for (const img of archivedImages) {
      await connection.execute(`
        INSERT INTO login_carousel_images (image, order_index, is_active, created_by, deleted_at) 
        VALUES (?, ?, 0, ?, NOW())
      `, [img.image, img.order_index, adminId]);
    }
    console.log(`✅ Created ${archivedImages.length} test archived carousel images`);

    // Verify the test data
    console.log('\n🔍 Verifying test archived data...');
    const [archivedCardCount] = await connection.execute('SELECT COUNT(*) as count FROM welcome_cards WHERE deleted_at IS NOT NULL');
    const [archivedImageCount] = await connection.execute('SELECT COUNT(*) as count FROM login_carousel_images WHERE deleted_at IS NOT NULL');
    
    console.log(`✅ Archived welcome cards: ${archivedCardCount[0].count}`);
    console.log(`✅ Archived carousel images: ${archivedImageCount[0].count}`);

    console.log('\n🎉 Test archived data created successfully!');
    console.log('💡 You can now test the archive functionality in the frontend.');

  } catch (error) {
    console.error('❌ Failed to create test data:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the script
if (require.main === module) {
  createTestArchivedData();
}

module.exports = { createTestArchivedData };
