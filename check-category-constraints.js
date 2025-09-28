const db = require('./src/config/database');

async function checkCategoryConstraints() {
  console.log('🔍 Checking Category Deletion Constraints...\n');

  try {
    // Check subcategories for categories 1-6
    console.log('1. Checking subcategories for categories 1-6...');
    
    const problematicCategories = [1, 2, 3, 4, 5, 6];
    
    for (const categoryId of problematicCategories) {
      const subcategories = await db.query(
        'SELECT subcategory_id, name, is_active, deleted_at FROM subcategories WHERE category_id = ?',
        [categoryId]
      );
      
      console.log(`\nCategory ${categoryId}:`);
      if (subcategories.length > 0) {
        console.log(`  ❌ Has ${subcategories.length} subcategories:`);
        subcategories.forEach(sub => {
          console.log(`    - ${sub.name} (ID: ${sub.subcategory_id}, Active: ${sub.is_active}, Deleted: ${sub.deleted_at ? 'Yes' : 'No'})`);
        });
        
        // Count active subcategories
        const activeCount = subcategories.filter(sub => sub.is_active === 1 && !sub.deleted_at).length;
        console.log(`  Active subcategories: ${activeCount}`);
        
        if (activeCount > 0) {
          console.log(`  🚫 CANNOT DELETE: Has ${activeCount} active subcategories`);
        } else {
          console.log(`  ✅ CAN DELETE: No active subcategories`);
        }
      } else {
        console.log(`  ✅ No subcategories - CAN DELETE`);
      }
    }

    // Check announcements using these categories
    console.log('\n\n2. Checking announcements using categories 1-6...');
    
    for (const categoryId of problematicCategories) {
      const announcements = await db.query(
        'SELECT announcement_id, title, status FROM announcements WHERE category_id = ? AND deleted_at IS NULL LIMIT 5',
        [categoryId]
      );
      
      console.log(`\nCategory ${categoryId} announcements:`);
      if (announcements.length > 0) {
        console.log(`  Has ${announcements.length} announcements:`);
        announcements.forEach(ann => {
          console.log(`    - ${ann.title} (ID: ${ann.announcement_id}, Status: ${ann.status})`);
        });
      } else {
        console.log(`  No announcements using this category`);
      }
    }

    // Check the categories that CAN be deleted (12, 14-16)
    console.log('\n\n3. Checking categories that CAN be deleted (12, 14-16)...');
    
    const workingCategories = [12, 14, 15, 16];
    
    for (const categoryId of workingCategories) {
      const subcategories = await db.query(
        'SELECT subcategory_id, name, is_active, deleted_at FROM subcategories WHERE category_id = ?',
        [categoryId]
      );
      
      console.log(`\nCategory ${categoryId}:`);
      if (subcategories.length > 0) {
        console.log(`  Has ${subcategories.length} subcategories:`);
        subcategories.forEach(sub => {
          console.log(`    - ${sub.name} (ID: ${sub.subcategory_id}, Active: ${sub.is_active}, Deleted: ${sub.deleted_at ? 'Yes' : 'No'})`);
        });
        
        const activeCount = subcategories.filter(sub => sub.is_active === 1 && !sub.deleted_at).length;
        console.log(`  Active subcategories: ${activeCount}`);
      } else {
        console.log(`  No subcategories`);
      }
    }

    console.log('\n✅ Analysis complete!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await db.close();
  }
}

// Run the check
checkCategoryConstraints();
