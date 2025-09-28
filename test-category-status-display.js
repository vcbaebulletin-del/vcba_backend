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

async function testCategoryStatusDisplay() {
  let connection;
  
  try {
    console.log('🔧 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database successfully');

    // Step 1: Set one category to inactive for testing
    console.log('\n📝 Setting "Academic" category to inactive for testing...');
    await connection.execute(
      'UPDATE categories SET is_active = 0 WHERE name = "Academic"'
    );

    // Step 2: Set one subcategory to inactive for testing
    console.log('📝 Setting "Grade Release" subcategory to inactive for testing...');
    await connection.execute(
      'UPDATE subcategories SET is_active = 0 WHERE name = "Grade Release"'
    );

    // Step 3: Test the getCategoriesWithSubcategories query (what the API uses)
    console.log('\n🔍 Testing getCategoriesWithSubcategories query...');
    const sql = `
      SELECT
        c.category_id,
        c.name as category_name,
        c.description as category_description,
        c.color_code as category_color,
        c.is_active as category_active,
        s.subcategory_id,
        s.name as subcategory_name,
        s.description as subcategory_description,
        s.color_code as subcategory_color,
        s.is_active as subcategory_active,
        s.display_order
      FROM categories c
      LEFT JOIN subcategories s ON c.category_id = s.category_id AND s.deleted_at IS NULL
      WHERE c.deleted_at IS NULL
      ORDER BY c.name, s.display_order, s.name
    `;

    const [rows] = await connection.execute(sql);
    
    // Group subcategories under their categories (same logic as backend)
    const categoriesMap = new Map();
    
    rows.forEach(row => {
      if (!categoriesMap.has(row.category_id)) {
        categoriesMap.set(row.category_id, {
          category_id: row.category_id,
          name: row.category_name,
          description: row.category_description,
          color_code: row.category_color,
          is_active: row.category_active,
          subcategories: []
        });
      }
      
      if (row.subcategory_id) {
        categoriesMap.get(row.category_id).subcategories.push({
          subcategory_id: row.subcategory_id,
          name: row.subcategory_name,
          description: row.subcategory_description,
          color_code: row.subcategory_color,
          is_active: row.subcategory_active,
          display_order: row.display_order
        });
      }
    });
    
    const categories = Array.from(categoriesMap.values());

    console.log('\n📊 Results from getCategoriesWithSubcategories:');
    categories.forEach(category => {
      const status = category.is_active ? '✅ ACTIVE' : '❌ INACTIVE';
      console.log(`\n${status} Category: ${category.name}`);
      
      if (category.subcategories.length > 0) {
        category.subcategories.forEach(sub => {
          const subStatus = sub.is_active ? '✅ ACTIVE' : '❌ INACTIVE';
          console.log(`  ${subStatus} Subcategory: ${sub.name}`);
        });
      }
    });

    // Step 4: Check what the frontend would receive
    console.log('\n🎯 Analysis:');
    const inactiveCategories = categories.filter(c => !c.is_active);
    const inactiveSubcategories = categories.flatMap(c => c.subcategories).filter(s => !s.is_active);
    
    console.log(`- Total categories returned: ${categories.length}`);
    console.log(`- Inactive categories returned: ${inactiveCategories.length}`);
    console.log(`- Total subcategories returned: ${categories.flatMap(c => c.subcategories).length}`);
    console.log(`- Inactive subcategories returned: ${inactiveSubcategories.length}`);

    if (inactiveCategories.length > 0 || inactiveSubcategories.length > 0) {
      console.log('\n✅ SUCCESS: Backend correctly returns both active and inactive items');
      console.log('   The issue must be in the frontend filtering or display logic');
    } else {
      console.log('\n❌ ISSUE: Backend is not returning inactive items');
    }

    // Step 5: Keep inactive state for testing (comment out restoration)
    console.log('\n🔄 Keeping inactive state for API testing...');
    console.log('✅ Academic category and Grade Release subcategory remain inactive for testing');
    // await connection.execute(
    //   'UPDATE categories SET is_active = 1 WHERE name = "Academic"'
    // );
    // await connection.execute(
    //   'UPDATE subcategories SET is_active = 1 WHERE name = "Grade Release"'
    // );
    // console.log('✅ Original state restored');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the test
testCategoryStatusDisplay();
