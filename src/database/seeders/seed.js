const database = require('../../config/database');
const AdminModel = require('../../models/AdminModel');
const StudentModel = require('../../models/StudentModel');
const logger = require('../../utils/logger');

class DatabaseSeeder {
  async run() {
    try {
      logger.info('Starting database seeding...');

      // Check if data already exists
      const existingAdmins = await AdminModel.count();
      if (existingAdmins > 0) {
        logger.info('Database already seeded, skipping...');
        return;
      }

      // Seed admin accounts
      await this.seedAdmins();

      // Seed student accounts
      await this.seedStudents();

      // Seed other data
      await this.seedAnnouncements();
      await this.seedNotifications();

      logger.info('Database seeding completed successfully');
    } catch (error) {
      logger.error('Database seeding failed:', error);
      throw error;
    }
  }

  async seedAdmins() {
    logger.info('Seeding admin accounts...');

    const admins = [
      {
        account: {
          email: 'admin@zaira.edu',
          password: 'Admin123!',
          is_active: true,
          email_verified: true,
        },
        profile: {
          first_name: 'System',
          last_name: 'Administrator',
          phone_number: '+1234567890',
          department: 'Information Technology',
          position: 'System Administrator',
          bio: 'Main system administrator for the e-bulletin board system.',
        },
      },
      {
        account: {
          email: 'registrar@zaira.edu',
          password: 'Registrar123!',
          is_active: true,
          email_verified: true,
        },
        profile: {
          first_name: 'Jane',
          last_name: 'Smith',
          phone_number: '+1234567891',
          department: 'Registrar Office',
          position: 'Registrar',
          bio: 'Handles student registration and academic records.',
        },
      },
    ];

    for (const adminData of admins) {
      try {
        await AdminModel.createAdmin(adminData.account, adminData.profile);
        logger.info(`Created admin: ${adminData.account.email}`);
      } catch (error) {
        logger.error(`Failed to create admin ${adminData.account.email}:`, error.message);
      }
    }
  }

  async seedStudents() {
    logger.info('Seeding student accounts...');

    const students = [
      {
        account: {
          email: 'john.doe@student.zaira.edu',
          password: '1234567890!',
          student_number: '2024-0001',
          is_active: true,
          email_verified: true,
        },
        profile: {
          first_name: 'John',
          last_name: 'Doe',
          middle_name: 'Michael',
          date_of_birth: '2000-05-15',
          gender: 'male',
          phone: '+1234567892',
          address: '123 Student St',
          city: 'University City',
          state: 'State',
          postal_code: '12345',
          country: 'Country',
          emergency_contact_name: 'Mary Doe',
          emergency_contact_phone: '+1234567893',
          emergency_contact_relationship: 'Mother',
          program: 'Computer Science',
          year_level: 2,
          section: 'A',
          enrollment_date: '2023-08-15',
          gpa: 3.75,
          status: 'active',
          bio: 'Computer Science student interested in web development.',
        },
      },
      {
        account: {
          email: 'jane.smith@student.zaira.edu',
          password: '1234567890!',
          student_number: '2024-0002',
          is_active: true,
          email_verified: true,
        },
        profile: {
          first_name: 'Jane',
          last_name: 'Smith',
          middle_name: 'Elizabeth',
          date_of_birth: '2001-03-22',
          gender: 'female',
          phone: '+1234567894',
          address: '456 Campus Ave',
          city: 'University City',
          state: 'State',
          postal_code: '12345',
          country: 'Country',
          emergency_contact_name: 'Robert Smith',
          emergency_contact_phone: '+1234567895',
          emergency_contact_relationship: 'Father',
          program: 'Information Technology',
          year_level: 1,
          section: 'B',
          enrollment_date: '2024-08-15',
          gpa: 3.90,
          status: 'active',
          bio: 'IT student passionate about cybersecurity.',
        },
      },
      {
        account: {
          email: 'mike.johnson@student.zaira.edu',
          password: '1234567890!',
          student_number: '2024-0003',
          is_active: true,
          email_verified: true,
        },
        profile: {
          first_name: 'Michael',
          last_name: 'Johnson',
          date_of_birth: '1999-11-08',
          gender: 'male',
          phone: '+1234567896',
          address: '789 College Rd',
          city: 'University City',
          state: 'State',
          postal_code: '12345',
          country: 'Country',
          emergency_contact_name: 'Sarah Johnson',
          emergency_contact_phone: '+1234567897',
          emergency_contact_relationship: 'Mother',
          program: 'Engineering',
          year_level: 3,
          section: 'A',
          enrollment_date: '2022-08-15',
          gpa: 3.60,
          status: 'active',
          bio: 'Engineering student specializing in software engineering.',
        },
      },
    ];

    for (const studentData of students) {
      try {
        await StudentModel.createStudent(studentData.account, studentData.profile);
        logger.info(`Created student: ${studentData.account.email}`);
      } catch (error) {
        logger.error(`Failed to create student ${studentData.account.email}:`, error.message);
      }
    }
  }

  async seedAnnouncements() {
    logger.info('Seeding announcements...');

    // Get the first admin for author
    const admin = await database.findOne('SELECT admin_id FROM admin_accounts LIMIT 1');
    if (!admin) {
      logger.warn('No admin found, skipping announcement seeding');
      return;
    }

    const announcements = [
      {
        title: 'Welcome to the New Academic Year 2024-2025',
        content: 'We are excited to welcome all students to the new academic year. Please check your schedules and prepare for an amazing year of learning and growth.',
        excerpt: 'Welcome message for the new academic year.',
        category: 'general',
        priority: 'high',
        author_id: admin.admin_id,
        is_published: true,
        is_featured: true,
        allow_comments: true,
        target_audience: JSON.stringify(['all']),
        tags: JSON.stringify(['welcome', 'academic-year', 'students']),
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        title: 'Library Hours Extended During Finals Week',
        content: 'The library will be open 24/7 during finals week to support students in their studies. Additional study spaces and resources will be available.',
        excerpt: 'Extended library hours during finals week.',
        category: 'academic',
        priority: 'normal',
        author_id: admin.admin_id,
        is_published: true,
        is_featured: false,
        allow_comments: true,
        target_audience: JSON.stringify(['students']),
        tags: JSON.stringify(['library', 'finals', 'study']),
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        title: 'Campus Maintenance Scheduled',
        content: 'Routine maintenance will be performed on campus facilities this weekend. Some areas may be temporarily inaccessible.',
        excerpt: 'Weekend campus maintenance notice.',
        category: 'maintenance',
        priority: 'low',
        author_id: admin.admin_id,
        is_published: true,
        is_featured: false,
        allow_comments: false,
        target_audience: JSON.stringify(['all']),
        tags: JSON.stringify(['maintenance', 'campus', 'weekend']),
        created_at: new Date(),
        updated_at: new Date(),
      },
    ];

    for (const announcement of announcements) {
      try {
        await database.insert('announcements', announcement);
        logger.info(`Created announcement: ${announcement.title}`);
      } catch (error) {
        logger.error(`Failed to create announcement ${announcement.title}:`, error.message);
      }
    }
  }

  async seedNotifications() {
    logger.info('Seeding notifications...');

    // Get students for notifications
    const students = await database.query('SELECT student_id FROM student_accounts LIMIT 3');
    if (students.length === 0) {
      logger.warn('No students found, skipping notification seeding');
      return;
    }

    const notifications = [];
    students.forEach((student) => {
      notifications.push({
        user_id: student.student_id,
        user_type: 'student',
        title: 'Welcome to the Platform',
        message: 'Welcome to the e-bulletin board system. Stay updated with the latest announcements.',
        type: 'system',
        is_read: false,
        created_at: new Date(),
        updated_at: new Date(),
      });
    });

    for (const notification of notifications) {
      try {
        await database.insert('notifications', notification);
        logger.info(`Created notification for user: ${notification.user_id}`);
      } catch (error) {
        logger.error('Failed to create notification:', error.message);
      }
    }
  }

  async cleanup() {
    logger.info('Cleaning up seeded data...');

    try {
      // Delete in reverse order of dependencies
      await database.query('DELETE FROM notifications WHERE title = "Welcome to the Platform"');
      await database.query('DELETE FROM announcements WHERE title IN ("Welcome to the New Academic Year 2024-2025", "Library Hours Extended During Finals Week", "Campus Maintenance Scheduled")');
      await database.query('DELETE FROM student_profiles WHERE first_name IN ("John", "Jane", "Michael") AND last_name IN ("Doe", "Smith", "Johnson")');
      await database.query('DELETE FROM student_accounts WHERE email LIKE "%@student.zaira.edu"');
      await database.query('DELETE FROM admin_profiles WHERE first_name IN ("System", "Jane") AND last_name IN ("Administrator", "Smith")');
      await database.query('DELETE FROM admin_accounts WHERE email IN ("admin@zaira.edu", "registrar@zaira.edu")');

      logger.info('Seeded data cleanup completed');
    } catch (error) {
      logger.error('Failed to cleanup seeded data:', error);
    }
  }
}

// Run seeder if called directly
if (require.main === module) {
  const seeder = new DatabaseSeeder();

  seeder.run()
    .then(() => {
      logger.info('Seeding process completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Seeding process failed:', error);
      process.exit(1);
    });
}

module.exports = DatabaseSeeder;
