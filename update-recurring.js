const mysql = require('mysql2/promise');

async function updateRecurringEvents() {
  console.log('Updating all school_calendar rows to set is_recurring = 1...\n');

  try {
    // Create database connection
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'db_ebulletin_system'
    });

    console.log('✅ Connected to database');

    // First, let's see the current state
    console.log('\n=== Current state ===');
    const [currentRows] = await connection.execute(
      'SELECT is_recurring, COUNT(*) as count FROM school_calendar GROUP BY is_recurring'
    );
    
    console.log('Current is_recurring values:');
    currentRows.forEach(row => {
      console.log(`- is_recurring = ${row.is_recurring}: ${row.count} rows`);
    });

    // Update all rows to set is_recurring = 1
    console.log('\n=== Updating rows ===');
    const [updateResult] = await connection.execute(
      'UPDATE school_calendar SET is_recurring = 1'
    );

    console.log(`✅ Updated ${updateResult.affectedRows} rows`);

    // Verify the update
    console.log('\n=== After update ===');
    const [afterRows] = await connection.execute(
      'SELECT is_recurring, COUNT(*) as count FROM school_calendar GROUP BY is_recurring'
    );
    
    console.log('Updated is_recurring values:');
    afterRows.forEach(row => {
      console.log(`- is_recurring = ${row.is_recurring}: ${row.count} rows`);
    });

    // Show total count
    const [totalCount] = await connection.execute(
      'SELECT COUNT(*) as total FROM school_calendar'
    );
    console.log(`\nTotal rows in school_calendar: ${totalCount[0].total}`);

    // Close connection
    await connection.end();
    console.log('\n✅ Database connection closed');
    console.log('🎉 Update completed successfully!');

  } catch (error) {
    console.error('❌ Error updating recurring events:', error.message);
    process.exit(1);
  }
}

updateRecurringEvents();
