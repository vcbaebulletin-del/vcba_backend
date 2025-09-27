const request = require('supertest');
const app = require('../server');
const testUtils = require('./setup');

describe('Admin Endpoints', () => {
  let testAdmin;
  let adminToken;

  beforeEach(async () => {
    testAdmin = await testUtils.createTestAdmin({
      account: { email: testUtils.generateRandomEmail() },
    });
    adminToken = testUtils.generateTestToken(testAdmin, 'admin');
  });

  describe('GET /api/admin/profile', () => {
    it('should return admin profile', async () => {
      const response = await request(app)
        .get('/api/admin/profile')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('admin');
      expect(response.body.data.admin.email).toBe(testAdmin.email);
    });

    it('should reject non-admin users', async () => {
      const testStudent = await testUtils.createTestStudent({
        account: {
          email: testUtils.generateRandomEmail(),
          student_number: testUtils.generateRandomStudentNumber(),
        },
      });
      const studentToken = testUtils.generateTestToken(testStudent, 'student');

      const response = await request(app)
        .get('/api/admin/profile')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/admin/profile', () => {
    it('should update admin profile', async () => {
      const updateData = {
        first_name: 'Updated',
        last_name: 'Admin',
        department: 'Updated Department',
        position: 'Updated Position',
      };

      const response = await request(app)
        .put('/api/admin/profile')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.admin.first_name).toBe('Updated');
      expect(response.body.data.admin.department).toBe('Updated Department');
    });

    it('should validate profile data', async () => {
      const invalidData = {
        first_name: '', // Empty name should be invalid
        phone: 'invalid-phone',
      };

      const response = await request(app)
        .put('/api/admin/profile')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/admin/students', () => {
    let testStudents;

    beforeEach(async () => {
      // Create multiple test students
      testStudents = await Promise.all([
        testUtils.createTestStudent({
          account: {
            email: testUtils.generateRandomEmail(),
            student_number: testUtils.generateRandomStudentNumber(),
          },
          profile: { program: 'Computer Science', year_level: 1 },
        }),
        testUtils.createTestStudent({
          account: {
            email: testUtils.generateRandomEmail(),
            student_number: testUtils.generateRandomStudentNumber(),
          },
          profile: { program: 'Engineering', year_level: 2 },
        }),
      ]);
    });

    it('should return list of students', async () => {
      const response = await request(app)
        .get('/api/admin/students')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('pagination');
      expect(Array.isArray(response.body.data.data)).toBe(true);
    });

    it('should filter students by program', async () => {
      const response = await request(app)
        .get('/api/admin/students?program=Computer Science')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should paginate results', async () => {
      const response = await request(app)
        .get('/api/admin/students?page=1&limit=1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.pagination.limit).toBe(1);
    });
  });

  describe('POST /api/admin/students', () => {
    it('should create new student', async () => {
      const studentData = {
        email: testUtils.generateRandomEmail(),
        password: 'StudentPassword123!',
        student_number: testUtils.generateRandomStudentNumber(),
        first_name: 'New',
        last_name: 'Student',
        program: 'Computer Science',
        year_level: 1,
        section: 'A',
      };

      const response = await request(app)
        .post('/api/admin/students')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(studentData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.student.email).toBe(studentData.email);
      expect(response.body.data.student.student_number).toBe(studentData.student_number);
    });

    it('should validate required fields', async () => {
      const incompleteData = {
        email: testUtils.generateRandomEmail(),
        // missing password and other required fields
      };

      const response = await request(app)
        .post('/api/admin/students')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(incompleteData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject duplicate email', async () => {
      const existingStudent = await testUtils.createTestStudent({
        account: {
          email: testUtils.generateRandomEmail(),
          student_number: testUtils.generateRandomStudentNumber(),
        },
      });

      const duplicateData = {
        email: existingStudent.email,
        password: 'StudentPassword123!',
        student_number: testUtils.generateRandomStudentNumber(),
        first_name: 'Duplicate',
        last_name: 'Student',
      };

      const response = await request(app)
        .post('/api/admin/students')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(duplicateData);

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/admin/students/:studentId', () => {
    let testStudent;

    beforeEach(async () => {
      testStudent = await testUtils.createTestStudent({
        account: {
          email: testUtils.generateRandomEmail(),
          student_number: testUtils.generateRandomStudentNumber(),
        },
      });
    });

    it('should return student details', async () => {
      const response = await request(app)
        .get(`/api/admin/students/${testStudent.student_id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.student.student_id).toBe(testStudent.student_id);
    });

    it('should return 404 for non-existent student', async () => {
      const response = await request(app)
        .get('/api/admin/students/99999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/admin/students/:studentId', () => {
    let testStudent;

    beforeEach(async () => {
      testStudent = await testUtils.createTestStudent({
        account: {
          email: testUtils.generateRandomEmail(),
          student_number: testUtils.generateRandomStudentNumber(),
        },
      });
    });

    it('should update student information', async () => {
      const updateData = {
        first_name: 'Updated',
        last_name: 'Student',
        program: 'Updated Program',
        year_level: 2,
      };

      const response = await request(app)
        .put(`/api/admin/students/${testStudent.student_id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.student.first_name).toBe('Updated');
      expect(response.body.data.student.program).toBe('Updated Program');
    });

    it('should validate update data', async () => {
      const invalidData = {
        year_level: 'invalid', // Should be a number
        gpa: 5.0, // Should be max 4.0
      };

      const response = await request(app)
        .put(`/api/admin/students/${testStudent.student_id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/admin/students/:studentId', () => {
    let testStudent;

    beforeEach(async () => {
      testStudent = await testUtils.createTestStudent({
        account: {
          email: testUtils.generateRandomEmail(),
          student_number: testUtils.generateRandomStudentNumber(),
        },
      });
    });

    it('should deactivate student account', async () => {
      const response = await request(app)
        .delete(`/api/admin/students/${testStudent.student_id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/admin/dashboard/stats', () => {
    it('should return dashboard statistics', async () => {
      const response = await request(app)
        .get('/api/admin/dashboard/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('students');
      expect(response.body.data.students).toHaveProperty('total');
      expect(response.body.data.students).toHaveProperty('active');
    });
  });
});
