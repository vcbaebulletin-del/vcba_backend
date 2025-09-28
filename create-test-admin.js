const AdminModel = require('./src/models/AdminModel');
const logger = require('./src/utils/logger');

async function createTestAdmin() {
  try {
    console.log('🔧 Creating test admin account...');

    const accountData = {
      email: 'test.admin@example.com',
      password: 'TestPassword123!',
      is_active: true,
    };

    const profileData = {
      first_name: 'Test',
      last_name: 'Admin',
      department: 'IT',
      position: 'super_admin', // This position has MANAGE_CATEGORIES permission
      phone_number: '+1234567890',
    };

    // Check if admin already exists
    const existingAdmin = await AdminModel.findByEmailWithProfile(accountData.email);
    if (existingAdmin) {
      console.log('✅ Test admin already exists:', accountData.email);
      console.log('   - Position:', existingAdmin.position);
      console.log('   - Active:', existingAdmin.is_active);
      return existingAdmin;
    }

    const admin = await AdminModel.createAdmin(accountData, profileData);
    
    console.log('✅ Test admin created successfully!');
    console.log('   - Email:', admin.email);
    console.log('   - Password: TestPassword123!');
    console.log('   - Position:', admin.position);
    console.log('   - Admin ID:', admin.admin_id);

    return admin;

  } catch (error) {
    console.error('❌ Failed to create test admin:', error.message);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  createTestAdmin()
    .then(() => {
      console.log('🎉 Test admin creation completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Test admin creation failed:', error);
      process.exit(1);
    });
}

module.exports = createTestAdmin;
