const request = require('supertest');
const app = require('../server');
const testUtils = require('./setup');

describe('Authentication Endpoints', () => {
  describe('POST /api/auth/login', () => {
    let testAdmin;
    let testStudent;

    beforeEach(async () => {
      testAdmin = await testUtils.createTestAdmin({
        account: { email: testUtils.generateRandomEmail() },
      });
      testStudent = await testUtils.createTestStudent({
        account: {
          email: testUtils.generateRandomEmail(),
          student_number: testUtils.generateRandomStudentNumber(),
        },
      });
    });

    it('should login admin with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testAdmin.email,
          password: 'TestPassword123!',
          userType: 'admin',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user.email).toBe(testAdmin.email);
    });

    it('should login student with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testStudent.email,
          password: 'TestPassword123!',
          userType: 'student',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user.email).toBe(testStudent.email);
    });

    it('should login student with student number', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testStudent.student_number,
          password: 'TestPassword123!',
          userType: 'student',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.student_number).toBe(testStudent.student_number);
    });

    it('should reject invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testAdmin.email,
          password: 'WrongPassword',
          userType: 'admin',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Invalid');
    });

    it('should reject missing fields', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testAdmin.email,
          // missing password
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject non-existent user', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'TestPassword123!',
          userType: 'admin',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/auth/me', () => {
    let testAdmin;
    let adminToken;

    beforeEach(async () => {
      testAdmin = await testUtils.createTestAdmin({
        account: { email: testUtils.generateRandomEmail() },
      });
      adminToken = testUtils.generateTestToken(testAdmin, 'admin');
    });

    it('should return user profile with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user.email).toBe(testAdmin.email);
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/change-password', () => {
    let testAdmin;
    let adminToken;

    beforeEach(async () => {
      testAdmin = await testUtils.createTestAdmin({
        account: { email: testUtils.generateRandomEmail() },
      });
      adminToken = testUtils.generateTestToken(testAdmin, 'admin');
    });

    it('should change password with valid data', async () => {
      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          currentPassword: 'TestPassword123!',
          newPassword: 'NewPassword123!',
          confirmPassword: 'NewPassword123!',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject with wrong current password', async () => {
      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          currentPassword: 'WrongPassword',
          newPassword: 'NewPassword123!',
          confirmPassword: 'NewPassword123!',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should reject when passwords do not match', async () => {
      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          currentPassword: 'TestPassword123!',
          newPassword: 'NewPassword123!',
          confirmPassword: 'DifferentPassword123!',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject weak password', async () => {
      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          currentPassword: 'TestPassword123!',
          newPassword: 'weak',
          confirmPassword: 'weak',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/logout', () => {
    let testAdmin;
    let adminToken;

    beforeEach(async () => {
      testAdmin = await testUtils.createTestAdmin({
        account: { email: testUtils.generateRandomEmail() },
      });
      adminToken = testUtils.generateTestToken(testAdmin, 'admin');
    });

    it('should logout successfully', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should work without token (graceful logout)', async () => {
      const response = await request(app)
        .post('/api/auth/logout');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/auth/check', () => {
    let testStudent;
    let studentToken;

    beforeEach(async () => {
      testStudent = await testUtils.createTestStudent({
        account: {
          email: testUtils.generateRandomEmail(),
          student_number: testUtils.generateRandomStudentNumber(),
        },
      });
      studentToken = testUtils.generateTestToken(testStudent, 'student');
    });

    it('should confirm authentication status', async () => {
      const response = await request(app)
        .get('/api/auth/check')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.role).toBe('student');
    });

    it('should reject unauthenticated request', async () => {
      const response = await request(app)
        .get('/api/auth/check');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });
});
