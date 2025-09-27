const fs = require('fs');
const path = require('path');

// Setup script for welcome page images
console.log('🔧 Setting up welcome page image directories...');

// Define directories to create
const directories = [
  'public/uploads/welcome',
  'public/uploads/carousel'
];

// Create directories if they don't exist
directories.forEach(dir => {
  const fullPath = path.join(__dirname, '..', dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(`✅ Created directory: ${dir}`);
  } else {
    console.log(`ℹ️ Directory already exists: ${dir}`);
  }
});

// Define source images from project root
const sourceImagesDir = path.join(__dirname, '..', '..', '..');
const carouselImages = [
  'vcba_adv_4.jpg',
  'vcba_adv_5.jpg',
  'vcba_adv_6.jpg',
  'vcba_adv_7.jpg',
  'vcba_adv_8.jpg',
  'vcba_adv_9.jpg',
  'vcba_adv_10.jpg',
  'vcba_adv_11.jpg',
  'vcba_adv_12.jpg',
  'vcba_adv_13.jpg'
];

const welcomeImages = [
  'vcba_adv_1.jpg',  // enrollment
  'vcba_adv_2.jpg',  // free_tuition
  'vcba_adv_14.jpg', // weekend_offer
  'vcba_adv_15.jpg'  // courses_list
];

// Copy carousel images
console.log('\n🔧 Copying carousel images...');
carouselImages.forEach((imageName, index) => {
  const sourcePath = path.join(sourceImagesDir, imageName);
  const destPath = path.join(__dirname, '..', 'public', 'uploads', 'carousel', imageName);
  
  if (fs.existsSync(sourcePath)) {
    try {
      fs.copyFileSync(sourcePath, destPath);
      console.log(`✅ Copied ${imageName} to carousel directory`);
    } catch (error) {
      console.error(`❌ Failed to copy ${imageName}:`, error.message);
    }
  } else {
    console.warn(`⚠️ Source image not found: ${imageName}`);
  }
});

// Copy welcome card images
console.log('\n🔧 Copying welcome card images...');
welcomeImages.forEach((imageName, index) => {
  const sourcePath = path.join(sourceImagesDir, imageName);
  const destPath = path.join(__dirname, '..', 'public', 'uploads', 'welcome', imageName);
  
  if (fs.existsSync(sourcePath)) {
    try {
      fs.copyFileSync(sourcePath, destPath);
      console.log(`✅ Copied ${imageName} to welcome directory`);
    } catch (error) {
      console.error(`❌ Failed to copy ${imageName}:`, error.message);
    }
  } else {
    console.warn(`⚠️ Source image not found: ${imageName}`);
  }
});

console.log('\n✅ Welcome page image setup completed!');
console.log('\nNext steps:');
console.log('1. Run the database migration to create the tables');
console.log('2. Populate the database with image records');
console.log('3. Test the welcome page and login carousel');
