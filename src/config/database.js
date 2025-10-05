const mysql = require('mysql2/promise');
const config = require('./config');
const logger = require('../utils/logger');

// Create connection pool with proper UTF-8 support for emojis
const pool = mysql.createPool({
  host: config.database.host,
  port: config.database.port,
  user: config.database.user,
  password: config.database.password,
  database: config.database.database,
  connectionLimit: config.database.connectionLimit,
  charset: 'utf8mb4',
  collation: 'utf8mb4_unicode_ci',
  timezone: config.database.timezone,
  multipleStatements: false,
  namedPlaceholders: true,
  // Ensure proper character encoding for emojis
  typeCast: function (field, next) {
    if (field.type === 'VAR_STRING' || field.type === 'STRING' || field.type === 'TINY_BLOB' || field.type === 'MEDIUM_BLOB' || field.type === 'LONG_BLOB' || field.type === 'BLOB') {
      const value = field.string();
      return value ? Buffer.from(value, 'utf8').toString('utf8') : value;
    }
    return next();
  }
});

// Database utility class
class Database {
  constructor() {
    this.pool = pool;
  }

  // Execute query with logging and error handling
  async query(sql, params = []) {
    const startTime = Date.now();
    let connection;

    try {
      connection = await this.pool.getConnection();

      // Use query() instead of execute() to avoid MySQL2 issues with certain queries
      const [rows] = await connection.query(sql, params);
      const duration = Date.now() - startTime;

      logger.logDatabase(sql, duration);
      return rows || [];
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logDatabase(sql, duration, error);
      throw error;
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }

  // Execute query and return full result (including metadata like insertId, affectedRows)
  async execute(sql, params = []) {
    const startTime = Date.now();
    let connection;

    try {
      connection = await this.pool.getConnection();

      // Return full result for INSERT, UPDATE, DELETE operations
      const [rows, fields] = await connection.query(sql, params);
      const duration = Date.now() - startTime;

      logger.logDatabase(sql, duration);
      return rows;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logDatabase(sql, duration, error);
      throw error;
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }

  // Execute transaction
  async transaction(callback) {
    const connection = await this.pool.getConnection();

    try {
      await connection.beginTransaction();
      const result = await callback(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // Get single record
  async findOne(sql, params = []) {
    const rows = await this.query(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  // Get all records (without pagination)
  async findAll(sql, params = []) {
    return await this.query(sql, params);
  }

  // Get multiple records with pagination
  async findMany(sql, params = [], page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const paginatedSql = `${sql} LIMIT ${limit} OFFSET ${offset}`;

    const [rows, countResult] = await Promise.all([
      this.query(paginatedSql, params),
      this.query(`SELECT COUNT(*) as total FROM (${sql}) as count_query`, params),
    ]);

    const total = countResult[0]?.total || 0;
    const totalPages = Math.ceil(total / limit);

    return {
      data: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  // Insert record
  async insert(table, data) {
    const fields = Object.keys(data);
    const values = Object.values(data);
    const placeholders = fields.map(() => '?').join(', ');

    const sql = `INSERT INTO ${table} (${fields.join(', ')}) VALUES (${placeholders})`;
    const result = await this.query(sql, values);

    return {
      insertId: result.insertId,
      affectedRows: result.affectedRows,
    };
  }

  // Update record
  async update(table, data, where, whereParams = []) {
    const fields = Object.keys(data);
    const values = Object.values(data);
    const setClause = fields.map((field) => `${field} = ?`).join(', ');

    const sql = `UPDATE ${table} SET ${setClause} WHERE ${where}`;
    const result = await this.query(sql, [...values, ...whereParams]);

    return {
      affectedRows: result.affectedRows,
      changedRows: result.changedRows,
    };
  }

  // Delete record
  async delete(table, where, whereParams = []) {
    const sql = `DELETE FROM ${table} WHERE ${where}`;
    const result = await this.query(sql, whereParams);

    return {
      affectedRows: result.affectedRows,
    };
  }

  // Check if record exists
  async exists(table, where, whereParams = []) {
    const sql = `SELECT 1 FROM ${table} WHERE ${where} LIMIT 1`;
    const result = await this.query(sql, whereParams);
    return result.length > 0;
  }

  // Get connection for manual operations
  async getConnection() {
    return await this.pool.getConnection();
  }

  // Close all connections
  async close() {
    await this.pool.end();
  }

  // Health check
  async healthCheck() {
    try {
      await this.query('SELECT 1');
      return { status: 'healthy', timestamp: new Date().toISOString() };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}

// Create database instance
const database = new Database();

// Test database connection on startup (non-blocking) - TEMPORARILY DISABLED
// setImmediate(async () => {
//   try {
//     // Add timeout to prevent hanging
//     const healthCheckPromise = database.healthCheck();
//     const timeoutPromise = new Promise((_, reject) =>
//       setTimeout(() => reject(new Error('Database health check timeout')), 5000)
//     );

//     const health = await Promise.race([healthCheckPromise, timeoutPromise]);
//     if (health.status === 'healthy') {
//       logger.info('Database connection established successfully');
//     } else {
//       logger.error('Database connection failed:', health.error);
//     }
//   } catch (error) {
//     logger.error('Database connection error:', error.message);
//     // Don't block server startup on database connection issues
//     logger.warn('Server will continue without database connection');
//   }
// });

// Handle pool events
pool.on('connection', (connection) => {
  logger.debug(`New database connection established as id ${connection.threadId}`);
});

pool.on('error', (error) => {
  logger.error('Database pool error:', error);
});

module.exports = database;
