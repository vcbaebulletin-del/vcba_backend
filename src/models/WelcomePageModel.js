const BaseModel = require('./BaseModel');
const { ValidationError, NotFoundError } = require('../middleware/errorHandler');

class WelcomePageModel extends BaseModel {
  constructor() {
    super('welcome_page', 'id');
  }

  // Get active background image
  async getActiveBackground() {
    try {
      const sql = `
        SELECT
          wp.*,
          aa.email as created_by_name
        FROM ${this.tableName} wp
        LEFT JOIN admin_accounts aa ON wp.created_by = aa.admin_id
        WHERE wp.is_active = 1 AND wp.deleted_at IS NULL
        ORDER BY wp.created_at DESC
        LIMIT 1
      `;

      const result = await this.db.findOne(sql);
      return result;
    } catch (error) {
      throw new ValidationError(`Failed to get active background: ${error.message}`);
    }
  }

  // Get all backgrounds with pagination
  async getAllBackgrounds(page = 1, limit = 10) {
    try {
      const offset = (page - 1) * limit;
      
      const sql = `
        SELECT
          wp.*,
          aa.email as created_by_name
        FROM ${this.tableName} wp
        LEFT JOIN admin_accounts aa ON wp.created_by = aa.admin_id
        ORDER BY wp.created_at DESC
        LIMIT ? OFFSET ?
      `;
      
      const countSql = `SELECT COUNT(*) as total FROM ${this.tableName}`;
      
      const [backgrounds, countResult] = await Promise.all([
        this.db.findAll(sql, [limit, offset]),
        this.db.findOne(countSql)
      ]);

      return {
        backgrounds,
        pagination: {
          page,
          limit,
          total: countResult.total,
          totalPages: Math.ceil(countResult.total / limit)
        }
      };
    } catch (error) {
      throw new ValidationError(`Failed to get backgrounds: ${error.message}`);
    }
  }

  // Create new background and deactivate others
  async createBackground(data) {
    try {
      this.validateRequired(data, ['background_image', 'created_by']);

      return await this.db.transaction(async (connection) => {
        // Deactivate all existing backgrounds
        await connection.query(
          `UPDATE ${this.tableName} SET is_active = 0 WHERE is_active = 1 AND deleted_at IS NULL`
        );

        // Create new active background
        const backgroundData = {
          background_image: data.background_image,
          is_active: 1,
          created_by: data.created_by,
          created_at: new Date(),
          updated_at: new Date()
        };

        const result = await connection.query(
          `INSERT INTO ${this.tableName} SET ?`,
          [backgroundData]
        );

        return await this.findById(result.insertId);
      });
    } catch (error) {
      throw new ValidationError(`Failed to create background: ${error.message}`);
    }
  }

  // Set background as active
  async setActiveBackground(id) {
    try {
      return await this.db.transaction(async (connection) => {
        // Check if background exists
        const background = await this.findById(id);
        if (!background) {
          throw new NotFoundError('Background not found');
        }

        // Deactivate all backgrounds
        await connection.query(
          `UPDATE ${this.tableName} SET is_active = 0 WHERE is_active = 1 AND deleted_at IS NULL`
        );

        // Activate selected background
        await connection.query(
          `UPDATE ${this.tableName} SET is_active = 1, updated_at = ? WHERE id = ?`,
          [new Date(), id]
        );

        return await this.findById(id);
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new ValidationError(`Failed to set active background: ${error.message}`);
    }
  }

  // Soft delete background
  async deleteBackground(id) {
    try {
      const background = await this.findById(id);
      if (!background) {
        throw new NotFoundError('Background not found');
      }

      // Don't allow deletion of active background if it's the only one
      if (background.is_active) {
        const countSql = `SELECT COUNT(*) as total FROM ${this.tableName} WHERE deleted_at IS NULL`;
        const countResult = await this.db.findOne(countSql);

        if (countResult.total <= 1) {
          throw new ValidationError('Cannot delete the only background image');
        }
      }

      // Perform soft delete by setting deleted_at timestamp
      await this.db.update(
        this.tableName,
        {
          deleted_at: new Date(),
          is_active: false,
          updated_at: new Date()
        },
        'id = ?',
        [id]
      );

      return { deleted: true, soft_delete: true, background_image: background.background_image };
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError(`Failed to delete background: ${error.message}`);
    }
  }
}

module.exports = WelcomePageModel;
