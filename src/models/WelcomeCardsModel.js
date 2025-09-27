const BaseModel = require('./BaseModel');
const { ValidationError, NotFoundError } = require('../middleware/errorHandler');

class WelcomeCardsModel extends BaseModel {
  constructor() {
    super('welcome_cards', 'id');
  }

  // Get all active cards ordered by order_index
  async getActiveCards() {
    try {
      const sql = `
        SELECT
          wc.*,
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
        FROM ${this.tableName} wc
        LEFT JOIN admin_accounts aa ON wc.created_by = aa.admin_id
        LEFT JOIN admin_profiles ap ON aa.admin_id = ap.admin_id
        WHERE wc.is_active = 1 AND wc.deleted_at IS NULL
        ORDER BY wc.order_index ASC
      `;

      const result = await this.db.findAll(sql);
      return result;
    } catch (error) {
      throw new ValidationError(`Failed to get active cards: ${error.message}`);
    }
  }

  // Get all cards with pagination
  async getAllCards(page = 1, limit = 10) {
    try {
      const offset = (page - 1) * limit;
      
      const sql = `
        SELECT
          wc.*,
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
        FROM ${this.tableName} wc
        LEFT JOIN admin_accounts aa ON wc.created_by = aa.admin_id
        LEFT JOIN admin_profiles ap ON aa.admin_id = ap.admin_id
        WHERE wc.deleted_at IS NULL
        ORDER BY wc.order_index ASC, wc.created_at DESC
        LIMIT ? OFFSET ?
      `;

      const countSql = `SELECT COUNT(*) as total FROM ${this.tableName} WHERE deleted_at IS NULL`;
      
      const [cards, countResult] = await Promise.all([
        this.db.findAll(sql, [limit, offset]),
        this.db.findOne(countSql)
      ]);

      return {
        cards,
        pagination: {
          page,
          limit,
          total: countResult.total,
          totalPages: Math.ceil(countResult.total / limit)
        }
      };
    } catch (error) {
      throw new ValidationError(`Failed to get cards: ${error.message}`);
    }
  }

  // Create new card
  async createCard(data) {
    try {
      this.validateRequired(data, ['title', 'description', 'image', 'created_by']);

      // Get next order index if not provided
      if (data.order_index === undefined) {
        const maxOrderSql = `SELECT COALESCE(MAX(order_index), -1) + 1 as next_order FROM ${this.tableName}`;
        const maxOrderResult = await this.db.findOne(maxOrderSql);
        data.order_index = maxOrderResult.next_order;
      }

      const cardData = {
        title: data.title,
        description: data.description,
        image: data.image,
        order_index: data.order_index,
        is_active: data.is_active !== undefined ? data.is_active : 1,
        created_by: data.created_by,
        created_at: new Date(),
        updated_at: new Date()
      };

      const result = await this.create(cardData);
      return result;
    } catch (error) {
      throw new ValidationError(`Failed to create card: ${error.message}`);
    }
  }

  // Update card
  async updateCard(id, data) {
    try {
      const card = await this.findById(id);
      if (!card) {
        throw new NotFoundError('Card not found');
      }

      const allowedFields = ['title', 'description', 'image', 'order_index', 'is_active'];
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
      throw new ValidationError(`Failed to update card: ${error.message}`);
    }
  }

  // Reorder cards
  async reorderCards(cardOrders) {
    try {
      if (!Array.isArray(cardOrders) || cardOrders.length === 0) {
        throw new ValidationError('Card orders must be a non-empty array');
      }

      return await this.db.transaction(async (connection) => {
        let updatedCount = 0;

        for (let i = 0; i < cardOrders.length; i++) {
          const { id, order_index } = cardOrders[i];

          if (!id || order_index === undefined) {
            throw new ValidationError('Each card order must have id and order_index');
          }

          // Check if card exists first
          const [existingCard] = await connection.query(
            `SELECT id FROM ${this.tableName} WHERE id = ?`,
            [id]
          );

          if (!existingCard || existingCard.length === 0) {
            throw new ValidationError(`Card with id ${id} not found`);
          }

          const [result] = await connection.query(
            `UPDATE ${this.tableName} SET order_index = ?, updated_at = ? WHERE id = ?`,
            [order_index, new Date(), id]
          );

          if (result.affectedRows > 0) {
            updatedCount++;
          }
        }

        return { reordered: true, count: updatedCount };
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError(`Failed to reorder cards: ${error.message}`);
    }
  }

  // Toggle card active status
  async toggleCardStatus(id) {
    try {
      const card = await this.findById(id);
      if (!card) {
        throw new NotFoundError('Card not found');
      }

      const newStatus = card.is_active ? 0 : 1;
      const result = await this.updateById(id, { 
        is_active: newStatus, 
        updated_at: new Date() 
      });

      return result;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new ValidationError(`Failed to toggle card status: ${error.message}`);
    }
  }

  // Soft delete card (set deleted_at timestamp)
  async deleteCard(id) {
    try {
      const card = await this.findById(id);
      if (!card) {
        throw new NotFoundError('Card not found');
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

      return { deleted: true, soft_delete: true, image: card.image };
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new ValidationError(`Failed to delete card: ${error.message}`);
    }
  }

  // Get archived (soft deleted) cards
  async getArchivedCards(page = 1, limit = 20) {
    try {
      const sql = `
        SELECT
          wc.*,
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
        FROM ${this.tableName} wc
        LEFT JOIN admin_accounts aa ON wc.created_by = aa.admin_id
        LEFT JOIN admin_profiles ap ON aa.admin_id = ap.admin_id
        WHERE wc.deleted_at IS NOT NULL
        ORDER BY wc.deleted_at DESC
      `;

      return await this.db.findMany(sql, [], page, limit);
    } catch (error) {
      throw new ValidationError(`Failed to get archived cards: ${error.message}`);
    }
  }

  // Get card by ID with creator info
  async getCardById(id) {
    try {
      const sql = `
        SELECT
          wc.*,
          aa.email as created_by_name
        FROM ${this.tableName} wc
        LEFT JOIN admin_accounts aa ON wc.created_by = aa.admin_id
        WHERE wc.id = ?
      `;
      
      const result = await this.db.findOne(sql, [id]);
      if (!result) {
        throw new NotFoundError('Card not found');
      }
      
      return result;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new ValidationError(`Failed to get card: ${error.message}`);
    }
  }

  // Restore soft-deleted card (set deleted_at = null)
  async restoreCard(id) {
    try {
      const card = await this.findById(id);
      if (!card) {
        throw new NotFoundError('Card not found');
      }

      // Check if the card is actually soft-deleted
      if (!card.deleted_at) {
        throw new ValidationError('Card is not archived and cannot be restored');
      }

      // Restore the card by setting deleted_at to null
      await this.db.update(
        this.tableName,
        {
          deleted_at: null,
          updated_at: new Date()
        },
        'id = ?',
        [id]
      );

      return { restored: true, card_id: id };
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError(`Failed to restore card: ${error.message}`);
    }
  }
}

module.exports = WelcomeCardsModel;
