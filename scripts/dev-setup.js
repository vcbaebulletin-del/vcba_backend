#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Setting up Zaira Backend Development Environment...\n');

// Check if .env file exists
const envPath = path.join(__dirname, '..', '.env');
if (!fs.existsSync(envPath)) {
  console.log('📝 Creating .env file from .env.example...');
  const envExamplePath = path.join(__dirname, '..', '.env.example');
  fs.copyFileSync(envExamplePath, envPath);
  console.log('✅ .env file created. Please update it with your configuration.\n');
} else {
  console.log('✅ .env file already exists.\n');
}

// Create necessary directories
const directories = [
  'logs',
  'uploads',
  'uploads/avatars',
  'uploads/attachments',
  'coverage',
];

console.log('📁 Creating necessary directories...');
directories.forEach(dir => {
  const dirPath = path.join(__dirname, '..', dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`   Created: ${dir}`);
  } else {
    console.log(`   Exists: ${dir}`);
  }
});
console.log('');

// Install dependencies if node_modules doesn't exist
const nodeModulesPath = path.join(__dirname, '..', 'node_modules');
if (!fs.existsSync(nodeModulesPath)) {
  console.log('📦 Installing dependencies...');
  try {
    execSync('npm install', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
    console.log('✅ Dependencies installed successfully.\n');
  } catch (error) {
    console.error('❌ Failed to install dependencies:', error.message);
    process.exit(1);
  }
} else {
  console.log('✅ Dependencies already installed.\n');
}

// Check database connection
console.log('🔍 Checking database connection...');
try {
  // Load environment variables
  require('dotenv').config({ path: envPath });
  
  const mysql = require('mysql2/promise');
  const config = require('../src/config/config');
  
  (async () => {
    try {
      const connection = await mysql.createConnection({
        host: config.database.host,
        port: config.database.port,
        user: config.database.user,
        password: config.database.password,
      });
      
      // Check if database exists
      const [databases] = await connection.execute('SHOW DATABASES LIKE ?', [config.database.database]);
      
      if (databases.length === 0) {
        console.log(`⚠️  Database '${config.database.database}' does not exist.`);
        console.log('   Please create the database and import the schema from ebulletin_system.sql\n');
      } else {
        console.log('✅ Database connection successful.\n');
      }
      
      await connection.end();
    } catch (error) {
      console.log('❌ Database connection failed:', error.message);
      console.log('   Please check your database configuration in .env file.\n');
    }
  })();
} catch (error) {
  console.log('⚠️  Could not check database connection. Make sure to configure your .env file.\n');
}

// Create development scripts
const scriptsDir = path.join(__dirname, '..', 'scripts');
if (!fs.existsSync(scriptsDir)) {
  fs.mkdirSync(scriptsDir, { recursive: true });
}

// Create a simple database reset script
const dbResetScript = `#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

console.log('🔄 Resetting database...');

try {
  // Load environment
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
  
  const config = require('../src/config/config');
  
  // Drop and recreate database
  const mysql = require('mysql2/promise');
  
  (async () => {
    const connection = await mysql.createConnection({
      host: config.database.host,
      port: config.database.port,
      user: config.database.user,
      password: config.database.password,
    });
    
    await connection.execute(\`DROP DATABASE IF EXISTS \${config.database.database}\`);
    await connection.execute(\`CREATE DATABASE \${config.database.database}\`);
    
    console.log('✅ Database reset completed');
    console.log('📥 Import the schema: mysql -u root -p < ebulletin_system.sql');
    
    await connection.end();
  })();
} catch (error) {
  console.error('❌ Database reset failed:', error.message);
  process.exit(1);
}
`;

fs.writeFileSync(path.join(scriptsDir, 'reset-db.js'), dbResetScript);
fs.chmodSync(path.join(scriptsDir, 'reset-db.js'), '755');

console.log('🎉 Development environment setup completed!\n');

console.log('📋 Next steps:');
console.log('   1. Update .env file with your database credentials');
console.log('   2. Create database: CREATE DATABASE db_ebulletin_system;');
console.log('   3. Import schema: mysql -u root -p db_ebulletin_system < ebulletin_system.sql');
console.log('   4. Run: npm run dev');
console.log('');

console.log('🔧 Available commands:');
console.log('   npm run dev          - Start development server');
console.log('   npm test             - Run tests');
console.log('   npm run lint         - Run linter');
console.log('   npm run db:seed      - Seed database with sample data');
console.log('   node scripts/reset-db.js - Reset database');
console.log('');

console.log('🌐 Default URLs:');
console.log('   API: http://localhost:3000');
console.log('   Health: http://localhost:3000/health');
console.log('   API Docs: http://localhost:3000/api (when implemented)');
console.log('');
