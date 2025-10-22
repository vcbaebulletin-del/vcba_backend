/**
 * TEMPORARY USERNAME MIGRATION SCRIPT
 * 
 * This script converts email addresses to username format in both
 * admin_accounts and student_accounts tables.
 * 
 * IMPORTANT: This is a TEMPORARY solution - REVERT IN FUTURE
 */

const mysql = require('mysql2/promise');

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Database configurations
const LOCAL_CONFIG = {
  host: 'localhost',
  user: 'root',
  password: '', // Empty password for local XAMPP/MySQL
  database: 'db_ebulletin_system',
  multipleStatements: true
};

const RAILWAY_CONFIG = {
  host: 'centerbeam.proxy.rlwy.net',
  port: 14376,
  user: 'root',
  password: 'TtTMjTElsEGhDREYyaIBcNyjbQGajuqi',
  database: 'railway',
  multipleStatements: true,
  connectTimeout: 30000
};

// Migration SQL
const MIGRATION_SQL = `
-- ============================================================================
-- TEMPORARY USERNAME MIGRATION
-- ============================================================================

-- Step 1: Create backup tables
CREATE TABLE IF NOT EXISTS admin_accounts_email_backup AS 
SELECT admin_id, email, created_at FROM admin_accounts;

CREATE TABLE IF NOT EXISTS student_accounts_email_backup AS 
SELECT student_id, email, created_at FROM student_accounts;

-- Step 2: Update admin_accounts - Convert email to username format
UPDATE admin_accounts 
SET email = LOWER(
    REPLACE(
        REPLACE(
            REPLACE(
                REPLACE(
                    SUBSTRING_INDEX(email, '@', 1),
                    '.', ''
                ),
                '-', ''
            ),
            '_', ''
        ),
        ' ', ''
    )
)
WHERE email LIKE '%@%';

-- Step 3: Update student_accounts - Convert email to username format
UPDATE student_accounts 
SET email = LOWER(
    REPLACE(
        REPLACE(
            REPLACE(
                REPLACE(
                    SUBSTRING_INDEX(email, '@', 1),
                    '.', ''
                ),
                '-', ''
            ),
            '_', ''
        ),
        ' ', ''
    )
)
WHERE email LIKE '%@%';
`;

async function runMigration(config, dbName) {
  let connection;
  
  try {
    log(`\n${'='.repeat(60)}`, 'cyan');
    log(`🗄️  Connecting to ${dbName} database...`, 'bright');
    log(`${'='.repeat(60)}`, 'cyan');
    
    connection = await mysql.createConnection(config);
    log(`✅ Connected to ${dbName} successfully!`, 'green');
    
    // Check current data
    log(`\n📊 Checking current data...`, 'yellow');
    const [adminsBefore] = await connection.query('SELECT COUNT(*) as count FROM admin_accounts');
    const [studentsBefore] = await connection.query('SELECT COUNT(*) as count FROM student_accounts');
    log(`   Admins: ${adminsBefore[0].count}`, 'cyan');
    log(`   Students: ${studentsBefore[0].count}`, 'cyan');
    
    // Show sample before migration
    log(`\n📋 Sample data BEFORE migration:`, 'yellow');
    const [adminSampleBefore] = await connection.query('SELECT admin_id, email FROM admin_accounts LIMIT 3');
    adminSampleBefore.forEach(row => {
      log(`   Admin ${row.admin_id}: ${row.email}`, 'cyan');
    });
    
    const [studentSampleBefore] = await connection.query('SELECT student_id, email FROM student_accounts LIMIT 3');
    studentSampleBefore.forEach(row => {
      log(`   Student ${row.student_id}: ${row.email}`, 'cyan');
    });
    
    // Run migration
    log(`\n🚀 Running migration...`, 'yellow');
    await connection.query(MIGRATION_SQL);
    log(`✅ Migration completed successfully!`, 'green');
    
    // Verify migration
    log(`\n✅ Verifying migration...`, 'yellow');
    
    // Check backup tables
    const [backupAdmins] = await connection.query('SELECT COUNT(*) as count FROM admin_accounts_email_backup');
    const [backupStudents] = await connection.query('SELECT COUNT(*) as count FROM student_accounts_email_backup');
    log(`   Backup tables created:`, 'cyan');
    log(`   - admin_accounts_email_backup: ${backupAdmins[0].count} records`, 'cyan');
    log(`   - student_accounts_email_backup: ${backupStudents[0].count} records`, 'cyan');
    
    // Show sample after migration
    log(`\n📋 Sample data AFTER migration:`, 'yellow');
    const [adminSampleAfter] = await connection.query('SELECT admin_id, email FROM admin_accounts LIMIT 3');
    adminSampleAfter.forEach(row => {
      log(`   Admin ${row.admin_id}: ${row.email}`, 'green');
    });
    
    const [studentSampleAfter] = await connection.query('SELECT student_id, email FROM student_accounts LIMIT 3');
    studentSampleAfter.forEach(row => {
      log(`   Student ${row.student_id}: ${row.email}`, 'green');
    });
    
    // Check for duplicates
    log(`\n🔍 Checking for duplicate usernames...`, 'yellow');
    const [adminDuplicates] = await connection.query(
      'SELECT email, COUNT(*) as count FROM admin_accounts GROUP BY email HAVING COUNT(*) > 1'
    );
    const [studentDuplicates] = await connection.query(
      'SELECT email, COUNT(*) as count FROM student_accounts GROUP BY email HAVING COUNT(*) > 1'
    );
    
    if (adminDuplicates.length > 0 || studentDuplicates.length > 0) {
      log(`   ⚠️  WARNING: Duplicate usernames found!`, 'red');
      if (adminDuplicates.length > 0) {
        log(`   Admin duplicates: ${adminDuplicates.length}`, 'red');
        adminDuplicates.forEach(row => {
          log(`      - ${row.email} (${row.count} times)`, 'red');
        });
      }
      if (studentDuplicates.length > 0) {
        log(`   Student duplicates: ${studentDuplicates.length}`, 'red');
        studentDuplicates.forEach(row => {
          log(`      - ${row.email} (${row.count} times)`, 'red');
        });
      }
    } else {
      log(`   ✅ No duplicate usernames found!`, 'green');
    }
    
    log(`\n${'='.repeat(60)}`, 'cyan');
    log(`✅ ${dbName} migration completed successfully!`, 'green');
    log(`${'='.repeat(60)}`, 'cyan');
    
    return true;
    
  } catch (error) {
    log(`\n❌ Error during ${dbName} migration:`, 'red');
    log(`   ${error.message}`, 'red');
    
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      log(`\n💡 Tip: Check your database credentials`, 'yellow');
    } else if (error.code === 'ECONNREFUSED') {
      log(`\n💡 Tip: Make sure MySQL server is running`, 'yellow');
    } else if (error.code === 'ETIMEDOUT') {
      log(`\n💡 Tip: Check your internet connection for Railway`, 'yellow');
    }
    
    return false;
    
  } finally {
    if (connection) {
      await connection.end();
      log(`\n🔌 Disconnected from ${dbName}`, 'cyan');
    }
  }
}

async function main() {
  log(`\n${'='.repeat(60)}`, 'bright');
  log(`🎯 TEMPORARY USERNAME MIGRATION SCRIPT`, 'bright');
  log(`${'='.repeat(60)}`, 'bright');
  log(`\nThis script will convert email addresses to username format.`, 'yellow');
  log(`Backend will still use the 'email' column - this is TEMPORARY.`, 'yellow');
  log(`\n⚠️  IMPORTANT: Backup tables will be created automatically.`, 'yellow');
  
  const args = process.argv.slice(2);
  const target = args[0] || 'both'; // local, railway, or both
  
  let localSuccess = false;
  let railwaySuccess = false;
  
  if (target === 'local' || target === 'both') {
    log(`\n\n${'#'.repeat(60)}`, 'blue');
    log(`📍 MIGRATING LOCAL DATABASE`, 'blue');
    log(`${'#'.repeat(60)}`, 'blue');
    localSuccess = await runMigration(LOCAL_CONFIG, 'LOCAL');
  }
  
  if (target === 'railway' || target === 'both') {
    log(`\n\n${'#'.repeat(60)}`, 'blue');
    log(`☁️  MIGRATING RAILWAY DATABASE`, 'blue');
    log(`${'#'.repeat(60)}`, 'blue');
    railwaySuccess = await runMigration(RAILWAY_CONFIG, 'RAILWAY');
  }
  
  // Final summary
  log(`\n\n${'='.repeat(60)}`, 'bright');
  log(`📊 MIGRATION SUMMARY`, 'bright');
  log(`${'='.repeat(60)}`, 'bright');
  
  if (target === 'local' || target === 'both') {
    log(`   Local Database: ${localSuccess ? '✅ SUCCESS' : '❌ FAILED'}`, localSuccess ? 'green' : 'red');
  }
  
  if (target === 'railway' || target === 'both') {
    log(`   Railway Database: ${railwaySuccess ? '✅ SUCCESS' : '❌ FAILED'}`, railwaySuccess ? 'green' : 'red');
  }
  
  log(`\n${'='.repeat(60)}`, 'bright');
  
  if ((target === 'both' && localSuccess && railwaySuccess) ||
      (target === 'local' && localSuccess) ||
      (target === 'railway' && railwaySuccess)) {
    log(`\n🎉 Migration completed successfully!`, 'green');
    log(`\n📝 Next steps:`, 'yellow');
    log(`   1. Restart your backend server (npm run dev)`, 'cyan');
    log(`   2. Restart your frontend server`, 'cyan');
    log(`   3. Test login with username format`, 'cyan');
    log(`   4. Verify account creation works`, 'cyan');
  } else {
    log(`\n⚠️  Migration had some failures. Please check the errors above.`, 'red');
  }
  
  log(`\n💡 To rollback, run: node rollback-migration.js\n`, 'yellow');
}

// Run the migration
main().catch(error => {
  log(`\n❌ Unexpected error:`, 'red');
  log(`   ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
