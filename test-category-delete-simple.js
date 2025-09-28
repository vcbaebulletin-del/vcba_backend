const express = require('express');
const CategoryController = require('./src/controllers/CategoryController');
const { auditContentAction } = require('./src/middleware/auditLogger');

// Create a simple test to check category deletion
async function testCategoryDeletion() {
  console.log('🧪 Testing Category Deletion Logic...\n');

  // Mock request and response objects
  const mockReq = {
    params: { categoryId: 2 },
    user: { id: 31, email: 'test@admin.com' }
  };

  const mockRes = {
    status: function(code) {
      this.statusCode = code;
      return this;
    },
    json: function(data) {
      console.log(`Response Status: ${this.statusCode}`);
      console.log('Response Data:', JSON.stringify(data, null, 2));
      return this;
    },
    statusCode: 200
  };

  try {
    console.log('1. Testing category deletion directly...');
    
    // Create controller instance
    const categoryController = new CategoryController();
    
    // Test the deleteCategory method directly
    await categoryController.deleteCategory(mockReq, mockRes);
    
  } catch (error) {
    console.error('❌ Direct test failed:', error.message);
    console.error('Error details:', error);
  }
}

// Test audit middleware separately
async function testAuditMiddleware() {
  console.log('\n2. Testing audit middleware...');
  
  const mockReq = {
    params: { categoryId: 2 },
    user: { id: 31, email: 'test@admin.com' }
  };

  const mockRes = {
    status: function(code) {
      this.statusCode = code;
      return this;
    },
    json: function(data) {
      console.log('Audit middleware - Response intercepted');
      console.log(`Status: ${this.statusCode}`);
      console.log('Data:', JSON.stringify(data, null, 2));
      return this;
    },
    statusCode: 200
  };

  try {
    // Test the audit middleware
    const auditMiddleware = auditContentAction('DELETE', 'categories');
    
    // Mock next function
    const mockNext = () => {
      console.log('✅ Audit middleware passed to next()');
    };
    
    // Call the audit middleware
    await auditMiddleware(mockReq, mockRes, mockNext);
    
    // Simulate a successful response
    mockRes.json({ success: true, message: 'Test successful' });
    
  } catch (error) {
    console.error('❌ Audit middleware test failed:', error.message);
    console.error('Error details:', error);
  }
}

// Run tests
async function runTests() {
  await testCategoryDeletion();
  await testAuditMiddleware();
}

runTests();
