const mysql = require('mysql2/promise');
require('dotenv').config();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'vcba_bulletin_board',
  port: process.env.DB_PORT || 3306
};

async function populateWelcomePageData() {
  let connection;
  
  try {
    console.log('🔧 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database');

    // Clear existing data
    console.log('\n🔧 Clearing existing welcome page data...');
    await connection.execute('DELETE FROM login_carousel_images');
    await connection.execute('DELETE FROM welcome_cards');
    await connection.execute('DELETE FROM welcome_page');
    console.log('✅ Cleared existing data');

    // Insert welcome page background
    console.log('\n🔧 Inserting welcome page background...');
    await connection.execute(`
      INSERT INTO welcome_page (background_image, is_active, created_by) 
      VALUES (?, 1, 1)
    `, ['/villamor-image/villamor-collge-BG-landscape.jpg']);
    console.log('✅ Inserted welcome page background');

    // Insert welcome cards
    console.log('\n🔧 Inserting welcome cards...');
    const welcomeCards = [
      {
        title: 'Enrollment Open',
        description: 'Join our vibrant academic community. Enrollment is now open for the upcoming semester with flexible schedules and comprehensive programs.',
        image: '/uploads/welcome/vcba_adv_1.jpg',
        order_index: 0
      },
      {
        title: 'Free Tuition Available',
        description: 'Quality education made accessible. Explore our scholarship programs and financial assistance options for qualified students.',
        image: '/uploads/welcome/vcba_adv_2.jpg',
        order_index: 1
      },
      {
        title: 'Weekend Classes',
        description: 'Perfect for working professionals. Our weekend programs offer the same quality education with flexible scheduling options.',
        image: '/uploads/welcome/vcba_adv_14.jpg',
        order_index: 2
      },
      {
        title: 'Comprehensive Courses',
        description: 'Discover our wide range of business and arts programs designed to prepare you for success in your chosen career path.',
        image: '/uploads/welcome/vcba_adv_15.jpg',
        order_index: 3
      }
    ];

    for (const card of welcomeCards) {
      await connection.execute(`
        INSERT INTO welcome_cards (title, description, image, order_index, is_active, created_by) 
        VALUES (?, ?, ?, ?, 1, 1)
      `, [card.title, card.description, card.image, card.order_index]);
      console.log(`✅ Inserted card: ${card.title}`);
    }

    // Insert login carousel images
    console.log('\n🔧 Inserting login carousel images...');
    const carouselImages = [
      { image: '/uploads/carousel/vcba_adv_4.jpg', order_index: 0 },
      { image: '/uploads/carousel/vcba_adv_5.jpg', order_index: 1 },
      { image: '/uploads/carousel/vcba_adv_6.jpg', order_index: 2 },
      { image: '/uploads/carousel/vcba_adv_7.jpg', order_index: 3 },
      { image: '/uploads/carousel/vcba_adv_8.jpg', order_index: 4 },
      { image: '/uploads/carousel/vcba_adv_9.jpg', order_index: 5 },
      { image: '/uploads/carousel/vcba_adv_10.jpg', order_index: 6 },
      { image: '/uploads/carousel/vcba_adv_11.jpg', order_index: 7 },
      { image: '/uploads/carousel/vcba_adv_12.jpg', order_index: 8 },
      { image: '/uploads/carousel/vcba_adv_13.jpg', order_index: 9 }
    ];

    for (const image of carouselImages) {
      await connection.execute(`
        INSERT INTO login_carousel_images (image, order_index, is_active, created_by) 
        VALUES (?, ?, 1, 1)
      `, [image.image, image.order_index]);
      console.log(`✅ Inserted carousel image: ${image.image}`);
    }

    console.log('\n✅ Welcome page data population completed successfully!');
    
    // Verify data
    console.log('\n🔍 Verifying inserted data...');
    const [backgroundRows] = await connection.execute('SELECT COUNT(*) as count FROM welcome_page');
    const [cardRows] = await connection.execute('SELECT COUNT(*) as count FROM welcome_cards');
    const [carouselRows] = await connection.execute('SELECT COUNT(*) as count FROM login_carousel_images');
    
    console.log(`📊 Background images: ${backgroundRows[0].count}`);
    console.log(`📊 Welcome cards: ${cardRows[0].count}`);
    console.log(`📊 Carousel images: ${carouselRows[0].count}`);

  } catch (error) {
    console.error('❌ Error populating welcome page data:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the population script
if (require.main === module) {
  populateWelcomePageData();
}

module.exports = { populateWelcomePageData };
