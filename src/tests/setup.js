const {
  beforeAll, afterAll, beforeEach, afterEach,
} = require('@jest/globals');
const database = require('../config/database');
const logger = require('../utils/logger');

// Test database configuration
const testConfig = {
  host: process.env.TEST_DB_HOST || 'localhost',
  port: parseInt(process.env.TEST_DB_PORT, 10) || 3306,
  user: process.env.TEST_DB_USER || 'root',
  password: process.env.TEST_DB_PASSWORD || '',
  database: process.env.TEST_DB_NAME || 'test_ebulletin_system',
};

// Global test setup
beforeAll(async () => {
  // Set test environment
  process.env.NODE_ENV = 'test';

  // Suppress console logs during tests
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});

  // Mock logger
  jest.spyOn(logger, 'info').mockImplementation(() => {});
  jest.spyOn(logger, 'error').mockImplementation(() => {});
  jest.spyOn(logger, 'warn').mockImplementation(() => {});
  jest.spyOn(logger, 'debug').mockImplementation(() => {});

  // Wait for database connection
  try {
    const health = await database.healthCheck();
    if (health.status !== 'healthy') {
      throw new Error('Database connection failed');
    }
  } catch (error) {
    console.error('Failed to connect to test database:', error.message);
    process.exit(1);
  }
});

// Global test cleanup
afterAll(async () => {
  // Close database connections
  await database.close();

  // Restore console methods
  console.log.mockRestore();
  console.error.mockRestore();
  console.warn.mockRestore();

  // Restore logger methods
  logger.info.mockRestore();
  logger.error.mockRestore();
  logger.warn.mockRestore();
  logger.debug.mockRestore();
});

// Test utilities
const testUtils = {
  // Create test admin
  createTestAdmin: async (overrides = {}) => {
    const AdminModel = require('../models/AdminModel');

    const accountData = {
      email: 'test.admin@example.com',
      password: 'TestPassword123!',
      ...overrides.account,
    };

    const profileData = {
      first_name: 'Test',
      last_name: 'Admin',
      department: 'IT',
      position: 'System Administrator',
      ...overrides.profile,
    };

    return await AdminModel.createAdmin(accountData, profileData);
  },

  // Create test student
  createTestStudent: async (overrides = {}) => {
    const StudentModel = require('../models/StudentModel');

    const accountData = {
      email: 'test.student@example.com',
      password: 'TestPassword123!',
      student_number: '2024-0001',
      ...overrides.account,
    };

    const profileData = {
      first_name: 'Test',
      last_name: 'Student',
      program: 'Computer Science',
      year_level: 1,
      ...overrides.profile,
    };

    return await StudentModel.createStudent(accountData, profileData);
  },

  // Generate JWT token for testing
  generateTestToken: (user, role = 'admin') => {
    const jwtUtil = require('../utils/jwt');

    const payload = {
      id: user.admin_id || user.student_id,
      email: user.email,
      role,
      firstName: user.first_name,
      lastName: user.last_name,
    };

    return jwtUtil.generateAccessToken(payload);
  },

  // Clean up test data
  cleanupTestData: async () => {
    try {
      // Delete test users
      await database.query('DELETE FROM admin_profiles WHERE first_name = "Test" AND last_name = "Admin"');
      await database.query('DELETE FROM admin_accounts WHERE email LIKE "test.%@example.com"');
      await database.query('DELETE FROM student_profiles WHERE first_name = "Test" AND last_name = "Student"');
      await database.query('DELETE FROM student_accounts WHERE email LIKE "test.%@example.com"');

      // Add more cleanup queries as needed
    } catch (error) {
      console.error('Error cleaning up test data:', error.message);
    }
  },

  // Wait for async operations
  wait: (ms = 100) => new Promise((resolve) => setTimeout(resolve, ms)),

  // Generate random test data
  generateRandomEmail: () => `test.${Date.now()}.${Math.random().toString(36).substr(2, 9)}@example.com`,
  generateRandomStudentNumber: () => {
    const year = new Date().getFullYear();
    const number = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
    return `${year}-${number}`;
  },
};

// Clean up before each test
beforeEach(async () => {
  await testUtils.cleanupTestData();
});

// Clean up after each test
afterEach(async () => {
  await testUtils.cleanupTestData();
});

module.exports = testUtils;
