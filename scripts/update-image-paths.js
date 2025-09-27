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

async function updateImagePaths() {
  let connection;
  
  try {
    console.log('🔧 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database');

    // Update carousel images with correct paths
    console.log('\n🔧 Updating carousel image paths...');
    
    // Clear existing carousel images
    await connection.execute('DELETE FROM login_carousel_images');
    console.log('✅ Cleared existing carousel images');

    // Get the first admin ID
    const [firstAdmin] = await connection.execute('SELECT admin_id FROM admin_accounts ORDER BY admin_id LIMIT 1');
    const adminId = firstAdmin[0].admin_id;
    console.log(`Using admin_id: ${adminId} for image records`);

    // Insert carousel images with correct paths
    const carouselImages = [
      { image: '/carousel/vcba_adv_1.jpg', order_index: 0 },
      { image: '/carousel/vcba_adv_2.jpg', order_index: 1 },
      { image: '/carousel/vcba_adv_3.jpg', order_index: 2 },
      { image: '/carousel/vcba_adv_4.jpg', order_index: 3 },
      { image: '/carousel/vcba_adv_5.jpg', order_index: 4 },
      { image: '/carousel/vcba_adv_6.jpg', order_index: 5 },
      { image: '/carousel/vcba_adv_7.jpg', order_index: 6 },
      { image: '/carousel/vcba_adv_8.jpg', order_index: 7 },
      { image: '/carousel/vcba_adv_9.jpg', order_index: 8 },
      { image: '/carousel/vcba_adv_10.jpg', order_index: 9 },
      { image: '/carousel/vcba_adv_11.jpg', order_index: 10 },
      { image: '/carousel/vcba_adv_12.jpg', order_index: 11 },
      { image: '/carousel/vcba_adv_13.jpg', order_index: 12 },
      { image: '/carousel/vcba_adv_14.jpg', order_index: 13 },
      { image: '/carousel/vcba_adv_15.jpg', order_index: 14 },
      { image: '/carousel/vcba_adv_16.jpg', order_index: 15 }
    ];

    for (const image of carouselImages) {
      await connection.execute(`
        INSERT INTO login_carousel_images (image, order_index, is_active, created_by) 
        VALUES (?, ?, 1, ?)
      `, [image.image, image.order_index, adminId]);
      console.log(`✅ Inserted carousel image: ${image.image}`);
    }

    // Update welcome cards with better sample data
    console.log('\n🔧 Updating welcome cards...');
    
    // Clear existing cards
    await connection.execute('DELETE FROM welcome_cards');
    console.log('✅ Cleared existing welcome cards');

    // Insert updated welcome cards
    const welcomeCards = [
      {
        title: 'Enrollment Open',
        description: 'Join our vibrant academic community. Enrollment is now open for the upcoming semester with flexible schedules and comprehensive programs.',
        image: '/carousel/vcba_adv_1.jpg',
        order_index: 0
      },
      {
        title: 'Free Tuition Available',
        description: 'Quality education made accessible. Explore our scholarship programs and financial assistance options for qualified students.',
        image: '/carousel/vcba_adv_2.jpg',
        order_index: 1
      },
      {
        title: 'Weekend Classes',
        description: 'Perfect for working professionals. Our weekend programs offer the same quality education with flexible scheduling options.',
        image: '/carousel/vcba_adv_14.jpg',
        order_index: 2
      },
      {
        title: 'Comprehensive Courses',
        description: 'Discover our wide range of business and arts programs designed to prepare you for success in your chosen career path.',
        image: '/carousel/vcba_adv_15.jpg',
        order_index: 3
      }
    ];

    for (const card of welcomeCards) {
      await connection.execute(`
        INSERT INTO welcome_cards (title, description, image, order_index, is_active, created_by) 
        VALUES (?, ?, ?, ?, 1, ?)
      `, [card.title, card.description, card.image, card.order_index, adminId]);
      console.log(`✅ Inserted welcome card: ${card.title}`);
    }

    console.log('\n✅ Image paths updated successfully!');
    
    // Verify data
    console.log('\n🔍 Verifying updated data...');
    const [cardRows] = await connection.execute('SELECT COUNT(*) as count FROM welcome_cards');
    const [carouselRows] = await connection.execute('SELECT COUNT(*) as count FROM login_carousel_images');
    
    console.log(`📊 Welcome cards: ${cardRows[0].count}`);
    console.log(`📊 Carousel images: ${carouselRows[0].count}`);

  } catch (error) {
    console.error('❌ Error updating image paths:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the update script
if (require.main === module) {
  updateImagePaths();
}

module.exports = { updateImagePaths };
