const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

const dbConfig = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '',
  database: 'db_ebulletin_system'
};

async function checkAdminAccount() {
  let connection;
  
  try {
    console.log('🔧 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database successfully');

    // Check admin accounts
    console.log('\n📋 Checking admin accounts...');
    const [admins] = await connection.execute(`
      SELECT
        aa.admin_id,
        aa.email,
        aa.password,
        aa.is_active,
        ap.first_name,
        ap.last_name,
        ap.position,
        ap.department
      FROM admin_accounts aa
      LEFT JOIN admin_profiles ap ON aa.admin_id = ap.admin_id
      WHERE aa.email = 'admin@zaira.edu'
    `);

    if (admins.length === 0) {
      console.log('❌ No admin account found with email admin@zaira.edu');
      
      // Check all admin accounts
      console.log('\n📋 All admin accounts:');
      const [allAdmins] = await connection.execute(`
        SELECT
          aa.admin_id,
          aa.email,
          aa.is_active,
          ap.first_name,
          ap.last_name,
          ap.position
        FROM admin_accounts aa
        LEFT JOIN admin_profiles ap ON aa.admin_id = ap.admin_id
        ORDER BY aa.admin_id
      `);
      
      allAdmins.forEach(admin => {
        console.log(`   - ${admin.email} (${admin.first_name} ${admin.last_name}) - Position: ${admin.position} - Active: ${admin.is_active}`);
      });
      
    } else {
      const admin = admins[0];
      console.log('✅ Admin account found:');
      console.log(`   - Email: ${admin.email}`);
      console.log(`   - Name: ${admin.first_name} ${admin.last_name}`);
      console.log(`   - Position: ${admin.position}`);
      console.log(`   - Department: ${admin.department}`);
      console.log(`   - Active: ${admin.is_active}`);
      
      // Test password
      console.log('\n🔍 Testing password...');
      const testPassword = 'Admin123!';
      const isPasswordValid = await bcrypt.compare(testPassword, admin.password);
      console.log(`   - Password '${testPassword}' is ${isPasswordValid ? 'VALID' : 'INVALID'}`);
      
      if (!isPasswordValid) {
        console.log('   - Stored password hash:', admin.password.substring(0, 30) + '...');
      }
    }

  } catch (error) {
    console.error('❌ Database check failed:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkAdminAccount();
