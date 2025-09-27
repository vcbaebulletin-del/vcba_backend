const BaseModel = require('./BaseModel');
const { ValidationError, NotFoundError } = require('../middleware/errorHandler');

class LoginCarouselModel extends BaseModel {
  constructor() {
    super('login_carousel_images', 'id');
  }

  // Get all active carousel images ordered by order_index
  async getActiveImages() {
    try {
      const sql = `
        SELECT
          lci.*,
          COALESCE(
            CASE
              WHEN ap.first_name IS NOT NULL OR ap.last_name IS NOT NULL
              THEN TRIM(CONCAT(COALESCE(ap.first_name, ''), ' ', COALESCE(ap.middle_name, ''), ' ', COALESCE(ap.last_name, ''), ' ', COALESCE(ap.suffix, '')))
              WHEN aa.email IS NOT NULL
              THEN aa.email
              ELSE 'Unknown Admin'
            END,
            'Unknown Admin'
          ) as created_by_name
        FROM ${this.tableName} lci
        LEFT JOIN admin_accounts aa ON lci.created_by = aa.admin_id
        LEFT JOIN admin_profiles ap ON aa.admin_id = ap.admin_id
        WHERE lci.is_active = 1 AND lci.deleted_at IS NULL
        ORDER BY lci.order_index ASC
      `;

      const result = await this.db.findAll(sql);
      return result;
    } catch (error) {
      throw new ValidationError(`Failed to get active carousel images: ${error.message}`);
    }
  }

  // Get all carousel images with pagination
  async getAllImages(page = 1, limit = 20) {
    try {
      const offset = (page - 1) * limit;
      
      const sql = `
        SELECT
          lci.*,
          COALESCE(
            CASE
              WHEN ap.first_name IS NOT NULL OR ap.last_name IS NOT NULL
              THEN TRIM(CONCAT(COALESCE(ap.first_name, ''), ' ', COALESCE(ap.middle_name, ''), ' ', COALESCE(ap.last_name, ''), ' ', COALESCE(ap.suffix, '')))
              WHEN aa.email IS NOT NULL
              THEN aa.email
              ELSE 'Unknown Admin'
            END,
            'Unknown Admin'
          ) as created_by_name
        FROM ${this.tableName} lci
        LEFT JOIN admin_accounts aa ON lci.created_by = aa.admin_id
        LEFT JOIN admin_profiles ap ON aa.admin_id = ap.admin_id
        WHERE lci.deleted_at IS NULL
        ORDER BY lci.order_index ASC, lci.created_at DESC
        LIMIT ? OFFSET ?
      `;

      const countSql = `SELECT COUNT(*) as total FROM ${this.tableName} WHERE deleted_at IS NULL`;
      
      const [images, countResult] = await Promise.all([
        this.db.findAll(sql, [limit, offset]),
        this.db.findOne(countSql)
      ]);

      return {
        images,
        pagination: {
          page,
          limit,
          total: countResult.total,
          totalPages: Math.ceil(countResult.total / limit)
        }
      };
    } catch (error) {
      throw new ValidationError(`Failed to get carousel images: ${error.message}`);
    }
  }

  // Create new carousel image
  async createImage(data) {
    try {
      this.validateRequired(data, ['image', 'created_by']);

      // Get next order index if not provided
      if (data.order_index === undefined) {
        const maxOrderSql = `SELECT COALESCE(MAX(order_index), -1) + 1 as next_order FROM ${this.tableName}`;
        const maxOrderResult = await this.db.findOne(maxOrderSql);
        data.order_index = maxOrderResult.next_order;
      }

      const imageData = {
        image: data.image,
        order_index: data.order_index,
        is_active: data.is_active !== undefined ? data.is_active : 1,
        created_by: data.created_by,
        created_at: new Date(),
        updated_at: new Date()
      };

      const result = await this.create(imageData);
      return result;
    } catch (error) {
      throw new ValidationError(`Failed to create carousel image: ${error.message}`);
    }
  }

  // Update carousel image
  async updateImage(id, data) {
    try {
      const image = await this.findById(id);
      if (!image) {
        throw new NotFoundError('Carousel image not found');
      }

      const allowedFields = ['image', 'order_index', 'is_active'];
      const updateData = {};

      allowedFields.forEach(field => {
        if (data[field] !== undefined) {
          updateData[field] = data[field];
        }
      });

      if (Object.keys(updateData).length === 0) {
        throw new ValidationError('No valid fields to update');
      }

      updateData.updated_at = new Date();

      const result = await this.updateById(id, updateData);
      return result;
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError(`Failed to update carousel image: ${error.message}`);
    }
  }

  // Reorder carousel images
  async reorderImages(imageOrders) {
    try {
      if (!Array.isArray(imageOrders) || imageOrders.length === 0) {
        throw new ValidationError('Image orders must be a non-empty array');
      }

      return await this.db.transaction(async (connection) => {
        for (let i = 0; i < imageOrders.length; i++) {
          const { id, order_index } = imageOrders[i];
          
          if (!id || order_index === undefined) {
            throw new ValidationError('Each image order must have id and order_index');
          }

          await connection.query(
            `UPDATE ${this.tableName} SET order_index = ?, updated_at = ? WHERE id = ?`,
            [order_index, new Date(), id]
          );
        }

        return { reordered: true, count: imageOrders.length };
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError(`Failed to reorder carousel images: ${error.message}`);
    }
  }

  // Toggle image active status
  async toggleImageStatus(id) {
    try {
      const image = await this.findById(id);
      if (!image) {
        throw new NotFoundError('Carousel image not found');
      }

      const newStatus = image.is_active ? 0 : 1;
      const result = await this.updateById(id, { 
        is_active: newStatus, 
        updated_at: new Date() 
      });

      return result;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new ValidationError(`Failed to toggle image status: ${error.message}`);
    }
  }

  // Soft delete carousel image (set deleted_at timestamp)
  async deleteImage(id) {
    try {
      const image = await this.findById(id);
      if (!image) {
        throw new NotFoundError('Carousel image not found');
      }

      // Perform soft delete by setting deleted_at timestamp
      await this.db.update(
        this.tableName,
        {
          deleted_at: new Date(),
          updated_at: new Date()
        },
        'id = ?',
        [id]
      );

      return { deleted: true, soft_delete: true, image: image.image };
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new ValidationError(`Failed to delete carousel image: ${error.message}`);
    }
  }

  // Get archived (soft deleted) carousel images
  async getArchivedImages(page = 1, limit = 20) {
    try {
      const sql = `
        SELECT
          lci.*,
          COALESCE(
            CASE
              WHEN ap.first_name IS NOT NULL OR ap.last_name IS NOT NULL
              THEN TRIM(CONCAT(COALESCE(ap.first_name, ''), ' ', COALESCE(ap.middle_name, ''), ' ', COALESCE(ap.last_name, ''), ' ', COALESCE(ap.suffix, '')))
              WHEN aa.email IS NOT NULL
              THEN aa.email
              ELSE 'Unknown Admin'
            END,
            'Unknown Admin'
          ) as created_by_name
        FROM ${this.tableName} lci
        LEFT JOIN admin_accounts aa ON lci.created_by = aa.admin_id
        LEFT JOIN admin_profiles ap ON aa.admin_id = ap.admin_id
        WHERE lci.deleted_at IS NOT NULL
        ORDER BY lci.deleted_at DESC
      `;

      return await this.db.findMany(sql, [], page, limit);
    } catch (error) {
      throw new ValidationError(`Failed to get archived carousel images: ${error.message}`);
    }
  }

  // Get image by ID with creator info
  async getImageById(id) {
    try {
      const sql = `
        SELECT
          lci.*,
          aa.email as created_by_name
        FROM ${this.tableName} lci
        LEFT JOIN admin_accounts aa ON lci.created_by = aa.admin_id
        WHERE lci.id = ?
      `;
      
      const result = await this.db.findOne(sql, [id]);
      if (!result) {
        throw new NotFoundError('Carousel image not found');
      }
      
      return result;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new ValidationError(`Failed to get carousel image: ${error.message}`);
    }
  }

  // Bulk create images (for initial setup)
  async bulkCreateImages(imagesData, createdBy) {
    try {
      if (!Array.isArray(imagesData) || imagesData.length === 0) {
        throw new ValidationError('Images data must be a non-empty array');
      }

      return await this.db.transaction(async (connection) => {
        const createdImages = [];
        
        for (let i = 0; i < imagesData.length; i++) {
          const imageData = {
            image: imagesData[i].image,
            order_index: imagesData[i].order_index !== undefined ? imagesData[i].order_index : i,
            is_active: imagesData[i].is_active !== undefined ? imagesData[i].is_active : 1,
            created_by: createdBy,
            created_at: new Date(),
            updated_at: new Date()
          };

          const result = await connection.query(
            `INSERT INTO ${this.tableName} SET ?`,
            [imageData]
          );

          createdImages.push({
            id: result.insertId,
            ...imageData
          });
        }

        return createdImages;
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError(`Failed to bulk create carousel images: ${error.message}`);
    }
  }

  // Restore soft-deleted carousel image (set deleted_at = null)
  async restoreImage(id) {
    try {
      const image = await this.findById(id);
      if (!image) {
        throw new NotFoundError('Carousel image not found');
      }

      // Check if the image is actually soft-deleted
      if (!image.deleted_at) {
        throw new ValidationError('Carousel image is not archived and cannot be restored');
      }

      // Restore the image by setting deleted_at to null
      await this.db.update(
        this.tableName,
        {
          deleted_at: null,
          updated_at: new Date()
        },
        'id = ?',
        [id]
      );

      return { restored: true, image_id: id };
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError(`Failed to restore carousel image: ${error.message}`);
    }
  }
}

module.exports = LoginCarouselModel;
