const database = require('../config/database');
const { DatabaseError, NotFoundError, ValidationError } = require('../middleware/errorHandler');

class BaseModel {
  constructor(tableName, primaryKey = 'id') {
    this.tableName = tableName;
    this.primaryKey = primaryKey;
    this.db = database;
  }

  // Find record by ID
  async findById(id) {
    try {
      const sql = `SELECT * FROM ${this.tableName} WHERE ${this.primaryKey} = ?`;
      const result = await this.db.findOne(sql, [id]);
      return result;
    } catch (error) {
      throw new DatabaseError(`Failed to find ${this.tableName} by ID: ${error.message}`);
    }
  }

  // Find record by field
  async findBy(field, value) {
    try {
      const sql = `SELECT * FROM ${this.tableName} WHERE ${field} = ?`;
      const result = await this.db.findOne(sql, [value]);
      return result;
    } catch (error) {
      throw new DatabaseError(`Failed to find ${this.tableName} by ${field}: ${error.message}`);
    }
  }

  // Find all records with optional conditions
  async findAll(conditions = {}, page = 1, limit = 20, orderBy = null) {
    try {
      let sql = `SELECT * FROM ${this.tableName}`;
      const params = [];

      // Add WHERE conditions
      if (Object.keys(conditions).length > 0) {
        const whereClause = Object.keys(conditions)
          .map((key) => `${key} = ?`)
          .join(' AND ');
        sql += ` WHERE ${whereClause}`;
        params.push(...Object.values(conditions));
      }

      // Add ORDER BY
      if (orderBy) {
        sql += ` ORDER BY ${orderBy}`;
      }

      const result = await this.db.findMany(sql, params, page, limit);
      return result;
    } catch (error) {
      throw new DatabaseError(`Failed to find ${this.tableName} records: ${error.message}`);
    }
  }

  // Create new record
  async create(data) {
    try {
      // Add timestamps if they exist in the table
      const now = new Date().toISOString(); // FIX: Use UTC string to prevent timezone conversion
      if (this.hasTimestamps()) {
        data.created_at = now;
        data.updated_at = now;
      }

      const result = await this.db.insert(this.tableName, data);

      // Return the created record
      if (result.insertId) {
        return await this.findById(result.insertId);
      }

      return result;
    } catch (error) {
      throw new DatabaseError(`Failed to create ${this.tableName}: ${error.message}`);
    }
  }

  // Update record by ID
  async updateById(id, data) {
    try {
      // Add updated timestamp if it exists
      if (this.hasTimestamps()) {
        data.updated_at = new Date().toISOString(); // FIX: Use UTC string to prevent timezone conversion
      }

      const result = await this.db.update(
        this.tableName,
        data,
        `${this.primaryKey} = ?`,
        [id],
      );

      if (result.affectedRows === 0) {
        throw new NotFoundError(`${this.tableName} with ID ${id} not found`);
      }

      // Return the updated record
      return await this.findById(id);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError(`Failed to update ${this.tableName}: ${error.message}`);
    }
  }

  // Delete record by ID
  async deleteById(id) {
    try {
      const result = await this.db.delete(
        this.tableName,
        `${this.primaryKey} = ?`,
        [id],
      );

      if (result.affectedRows === 0) {
        throw new NotFoundError(`${this.tableName} with ID ${id} not found`);
      }

      return { deleted: true, affectedRows: result.affectedRows };
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError(`Failed to delete ${this.tableName}: ${error.message}`);
    }
  }

  // Soft delete (if deleted_at column exists)
  async softDeleteById(id) {
    try {
      const data = { deleted_at: new Date().toISOString() }; // FIX: Use UTC string to prevent timezone conversion
      return await this.updateById(id, data);
    } catch (error) {
      throw new DatabaseError(`Failed to soft delete ${this.tableName}: ${error.message}`);
    }
  }

  // Check if record exists
  async exists(field, value) {
    try {
      return await this.db.exists(this.tableName, `${field} = ?`, [value]);
    } catch (error) {
      throw new DatabaseError(`Failed to check ${this.tableName} existence: ${error.message}`);
    }
  }

  // Count records
  async count(conditions = {}) {
    try {
      let sql = `SELECT COUNT(*) as total FROM ${this.tableName}`;
      const params = [];

      if (Object.keys(conditions).length > 0) {
        const whereClause = Object.keys(conditions)
          .map((key) => `${key} = ?`)
          .join(' AND ');
        sql += ` WHERE ${whereClause}`;
        params.push(...Object.values(conditions));
      }

      const result = await this.db.findOne(sql, params);
      return result.total;
    } catch (error) {
      throw new DatabaseError(`Failed to count ${this.tableName} records: ${error.message}`);
    }
  }

  // Execute custom query
  async query(sql, params = []) {
    try {
      return await this.db.query(sql, params);
    } catch (error) {
      throw new DatabaseError(`Query failed: ${error.message}`);
    }
  }

  // Execute transaction
  async transaction(callback) {
    try {
      return await this.db.transaction(callback);
    } catch (error) {
      throw new DatabaseError(`Transaction failed: ${error.message}`);
    }
  }

  // Check if table has timestamp columns
  hasTimestamps() {
    // This can be overridden in child classes
    return true;
  }

  // Validate required fields
  validateRequired(data, requiredFields) {
    const missingFields = requiredFields.filter((field) => !data[field]);
    if (missingFields.length > 0) {
      throw new ValidationError(`Missing required fields: ${missingFields.join(', ')}`);
    }
  }

  // Sanitize data (remove undefined values)
  sanitizeData(data) {
    const sanitized = {};
    Object.keys(data).forEach((key) => {
      if (data[key] !== undefined) {
        sanitized[key] = data[key];
      }
    });
    return sanitized;
  }
}

module.exports = BaseModel;
