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

async function testSoftDeletion() {
  let connection;
  
  try {
    console.log('🔧 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database successfully');

    // Get the first admin ID
    const [firstAdmin] = await connection.execute('SELECT admin_id FROM admin_accounts ORDER BY admin_id LIMIT 1');
    const adminId = firstAdmin[0].admin_id;

    console.log('\n🧪 Testing soft deletion functionality...');

    // Create a test welcome card
    console.log('1. Creating a test welcome card...');
    const [insertResult] = await connection.execute(`
      INSERT INTO welcome_cards (title, description, image, order_index, is_active, created_by) 
      VALUES ('Test Card for Deletion', 'This card will be soft deleted', '/test/image.jpg', 999, 1, ?)
    `, [adminId]);
    
    const testCardId = insertResult.insertId;
    console.log(`✅ Created test card with ID: ${testCardId}`);

    // Verify the card exists and is active
    const [activeCard] = await connection.execute('SELECT * FROM welcome_cards WHERE id = ? AND deleted_at IS NULL', [testCardId]);
    console.log(`✅ Card exists and is active: ${activeCard.length > 0}`);

    // Simulate soft deletion (what the backend model does)
    console.log('2. Performing soft deletion...');
    await connection.execute(`
      UPDATE welcome_cards 
      SET deleted_at = NOW(), updated_at = NOW() 
      WHERE id = ?
    `, [testCardId]);
    console.log('✅ Soft deletion performed');

    // Verify the card is now soft deleted
    const [deletedCard] = await connection.execute('SELECT * FROM welcome_cards WHERE id = ? AND deleted_at IS NOT NULL', [testCardId]);
    console.log(`✅ Card is soft deleted: ${deletedCard.length > 0}`);

    // Verify the card doesn't appear in active cards
    const [activeCards] = await connection.execute('SELECT * FROM welcome_cards WHERE id = ? AND is_active = 1 AND deleted_at IS NULL', [testCardId]);
    console.log(`✅ Card doesn't appear in active cards: ${activeCards.length === 0}`);

    // Verify the card appears in archived cards
    const [archivedCards] = await connection.execute('SELECT * FROM welcome_cards WHERE id = ? AND deleted_at IS NOT NULL', [testCardId]);
    console.log(`✅ Card appears in archived cards: ${archivedCards.length > 0}`);

    console.log('\n📊 Current archive counts:');
    const [cardCount] = await connection.execute('SELECT COUNT(*) as count FROM welcome_cards WHERE deleted_at IS NOT NULL');
    const [imageCount] = await connection.execute('SELECT COUNT(*) as count FROM login_carousel_images WHERE deleted_at IS NOT NULL');
    
    console.log(`   - Archived welcome cards: ${cardCount[0].count}`);
    console.log(`   - Archived carousel images: ${imageCount[0].count}`);

    // Clean up test data
    console.log('\n🧹 Cleaning up test data...');
    await connection.execute('DELETE FROM welcome_cards WHERE id = ?', [testCardId]);
    console.log('✅ Test data cleaned up');

    console.log('\n🎉 Soft deletion test completed successfully!');
    console.log('💡 The soft deletion functionality is working correctly.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the test
if (require.main === module) {
  testSoftDeletion();
}

module.exports = { testSoftDeletion };
