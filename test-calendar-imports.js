#!/usr/bin/env node

/**
 * Test Calendar Route Imports
 * 
 * This script tests each import in calendarRoutes.js to identify which one is causing the module loading failure
 */

console.log('🔍 Testing Calendar Route Imports');
console.log('=================================');

const imports = [
  { name: 'express', path: 'express' },
  { name: 'express-validator', path: 'express-validator' },
  { name: 'CalendarController', path: './src/controllers/CalendarController' },
  { name: 'auth middleware', path: './src/middleware/auth' },
  { name: 'permissions middleware', path: './src/middleware/permissions' },
  { name: 'validation middleware', path: './src/middleware/validation' },
  { name: 'calendarUpload middleware', path: './src/middleware/calendarUpload' },
  { name: 'auditLogger middleware', path: './src/middleware/auditLogger' }
];

async function testImport(importInfo) {
  console.log(`\n🧪 Testing ${importInfo.name}...`);
  
  try {
    const module = require(importInfo.path);
    console.log(`   ✅ ${importInfo.name} loaded successfully`);
    
    // Additional checks for specific modules
    if (importInfo.name === 'CalendarController') {
      console.log(`   📊 CalendarController type: ${typeof module}`);
      if (module.prototype && module.prototype.getEvents) {
        console.log(`   🎯 getEvents method found`);
      }
    }
    
    if (importInfo.name === 'calendarUpload middleware') {
      console.log(`   📊 calendarUpload exports: ${Object.keys(module).join(', ')}`);
    }
    
    return { success: true, module };
    
  } catch (error) {
    console.log(`   ❌ ${importInfo.name} failed to load`);
    console.log(`   📝 Error: ${error.message}`);
    console.log(`   📍 Stack: ${error.stack.split('\n')[1]?.trim()}`);
    return { success: false, error: error.message };
  }
}

async function testCalendarRoutes() {
  console.log(`\n🧪 Testing full calendarRoutes.js import...`);
  
  try {
    const calendarRoutes = require('./src/routes/calendarRoutes');
    console.log(`   ✅ calendarRoutes loaded successfully`);
    console.log(`   📊 Router type: ${typeof calendarRoutes}`);
    return { success: true };
    
  } catch (error) {
    console.log(`   ❌ calendarRoutes failed to load`);
    console.log(`   📝 Error: ${error.message}`);
    console.log(`   📍 Stack trace:`);
    console.log(error.stack);
    return { success: false, error: error.message };
  }
}

async function main() {
  let failedImports = [];
  
  // Test individual imports
  for (const importInfo of imports) {
    const result = await testImport(importInfo);
    if (!result.success) {
      failedImports.push({ ...importInfo, error: result.error });
    }
  }
  
  console.log('\n📊 Individual Import Results');
  console.log('============================');
  
  if (failedImports.length === 0) {
    console.log('✅ All individual imports successful');
  } else {
    console.log(`❌ ${failedImports.length} imports failed:`);
    failedImports.forEach(failed => {
      console.log(`   - ${failed.name}: ${failed.error}`);
    });
  }
  
  // Test full calendar routes import
  const routesResult = await testCalendarRoutes();
  
  console.log('\n🎯 Diagnosis');
  console.log('============');
  
  if (failedImports.length === 0 && routesResult.success) {
    console.log('✅ All imports working - issue may be environment-specific');
    console.log('💡 Possible causes:');
    console.log('   - Missing environment variables on Railway');
    console.log('   - Database connection issues');
    console.log('   - File system permissions');
  } else if (failedImports.length > 0) {
    console.log('❌ Import failures detected');
    console.log('💡 Root cause likely in failed imports above');
  } else if (!routesResult.success) {
    console.log('❌ Calendar routes module has internal issues');
    console.log('💡 Check for syntax errors or circular dependencies');
  }
  
  console.log('\n🔧 Next Steps:');
  console.log('   1. Fix any failed imports identified above');
  console.log('   2. Check Railway deployment logs for more details');
  console.log('   3. Verify all dependencies are installed');
  console.log('   4. Test in production environment');
}

if (require.main === module) {
  main().catch(console.error);
}
