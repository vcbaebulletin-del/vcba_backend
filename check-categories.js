const config = require('./src/config/config');
const mysql = require('mysql2/promise');

async function checkCategories() {
  let connection;

  try {
    console.log('🔗 Connecting to database...');
    connection = await mysql.createConnection(config.database);
    console.log('✅ Connected to database');

    // Check categories table
    console.log('\n📋 Checking categories table...');
    try {
      const result = await connection.execute(`
        SELECT category_id, name, description, color_code, is_active, deleted_at, created_at
        FROM categories
        ORDER BY category_id
      `);

      console.log('Raw result:', result);
      const categories = result[0];

      console.log(`✅ Found ${categories ? categories.length : 0} categories:`);
      if (categories && categories.length > 0) {
        categories.forEach(cat => {
          const status = cat.is_active ? '✅ Active' : '❌ Inactive';
          const deleted = cat.deleted_at ? `🗑️ Deleted (${cat.deleted_at})` : '✅ Not deleted';
          console.log(`   - ID: ${cat.category_id}, Name: "${cat.name}", ${status}, ${deleted}`);
        });
      } else {
        console.log('   - No categories found');
      }
    } catch (err) {
      console.log('Error querying categories:', err.message);
      // Try to check if table exists
      try {
        const tableCheck = await connection.execute(`SHOW TABLES LIKE 'categories'`);
        console.log('Table check result:', tableCheck);
      } catch (tableErr) {
        console.log('Table check error:', tableErr.message);
      }
    }

    // Check subcategories table
    console.log('\n📋 Checking subcategories table...');
    const [subcategories] = await connection.execute(`
      SELECT s.subcategory_id, s.name, s.category_id, c.name as category_name,
             s.is_active, s.deleted_at, s.created_at
      FROM subcategories s
      LEFT JOIN categories c ON s.category_id = c.category_id
      ORDER BY s.category_id, s.subcategory_id
    `);

    console.log(`✅ Found ${subcategories ? subcategories.length : 0} subcategories:`);
    if (subcategories && subcategories.length > 0) {
      subcategories.forEach(sub => {
        const status = sub.is_active ? '✅ Active' : '❌ Inactive';
        const deleted = sub.deleted_at ? `🗑️ Deleted (${sub.deleted_at})` : '✅ Not deleted';
        console.log(`   - ID: ${sub.subcategory_id}, Name: "${sub.name}", Category: "${sub.category_name}", ${status}, ${deleted}`);
      });
    } else {
      console.log('   - No subcategories found');
    }

    // Check active categories specifically
    console.log('\n📋 Checking active categories (what the API should return)...');
    const [activeCategories] = await connection.execute(`
      SELECT category_id, name, description, color_code, is_active, deleted_at 
      FROM categories 
      WHERE is_active = 1 AND deleted_at IS NULL
      ORDER BY category_id
    `);
    
    console.log(`✅ Found ${activeCategories.length} active, non-deleted categories:`);
    activeCategories.forEach(cat => {
      console.log(`   - ID: ${cat.category_id}, Name: "${cat.name}"`);
    });

    // Check what the calendar API endpoint should return
    console.log('\n📋 Simulating calendar categories API response...');
    const [calendarCategories] = await connection.execute(`
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
      LEFT JOIN subcategories s ON c.category_id = s.category_id
        AND s.is_active = 1 AND s.deleted_at IS NULL
      WHERE c.is_active = 1 AND c.deleted_at IS NULL
      ORDER BY c.name, s.display_order, s.name
    `);
    
    console.log(`✅ Calendar API would return ${calendarCategories.length} rows (categories with their subcategories):`);
    
    // Group by category
    const categoryMap = new Map();
    calendarCategories.forEach(row => {
      if (!categoryMap.has(row.category_id)) {
        categoryMap.set(row.category_id, {
          category_id: row.category_id,
          name: row.category_name,
          description: row.category_description,
          color_code: row.category_color,
          is_active: row.category_active,
          subcategories: []
        });
      }

      if (row.subcategory_id) {
        categoryMap.get(row.category_id).subcategories.push({
          subcategory_id: row.subcategory_id,
          name: row.subcategory_name,
          description: row.subcategory_description,
          color_code: row.subcategory_color,
          is_active: row.subcategory_active,
          display_order: row.display_order
        });
      }
    });

    const categoriesArray = Array.from(categoryMap.values());
    console.log(`✅ Grouped into ${categoriesArray.length} categories:`);
    categoriesArray.forEach(cat => {
      console.log(`   - "${cat.name}" (ID: ${cat.category_id}) - ${cat.subcategories.length} subcategories`);
      cat.subcategories.forEach(sub => {
        console.log(`     └─ "${sub.name}" (ID: ${sub.subcategory_id})`);
      });
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Database connection closed');
    }
  }
}

checkCategories();
