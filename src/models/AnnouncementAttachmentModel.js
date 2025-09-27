const BaseModel = require('./BaseModel');
const { ValidationError, NotFoundError } = require('../middleware/errorHandler');
const { deleteUploadedFile } = require('../middleware/upload');

class AnnouncementAttachmentModel extends BaseModel {
  constructor() {
    super('announcement_attachments', 'attachment_id');
  }

  // Override hasTimestamps since this table uses 'uploaded_at' instead of 'created_at'
  hasTimestamps() {
    return false;
  }

  /**
   * Create multiple attachments for an announcement
   * @param {number} announcementId - The announcement ID
   * @param {Array} attachments - Array of attachment data
   * @returns {Promise<Array>} Created attachments
   */
  async createAttachments(announcementId, attachments) {
    if (!Array.isArray(attachments) || attachments.length === 0) {
      return [];
    }

    try {
      const createdAttachments = [];
      
      for (let i = 0; i < attachments.length; i++) {
        const attachment = attachments[i];
        
        const attachmentData = {
          announcement_id: announcementId,
          file_name: attachment.originalName,
          file_path: attachment.path,
          file_type: 'image', // Currently only supporting images
          file_size: attachment.size,
          mime_type: attachment.mimetype,
          display_order: i, // Order based on upload sequence
          is_primary: i === 0 ? 1 : 0, // First image is primary by default
          uploaded_at: new Date()
        };

        const result = await this.create(attachmentData);
        createdAttachments.push(result);
      }

      return createdAttachments;
    } catch (error) {
      // Clean up uploaded files if database operation fails
      attachments.forEach(attachment => {
        if (attachment.filename) {
          deleteUploadedFile(attachment.filename);
        }
      });
      throw error;
    }
  }

  /**
   * Get all attachments for an announcement
   * @param {number} announcementId - The announcement ID
   * @param {string} fileType - Optional file type filter
   * @returns {Promise<Array>} Announcement attachments
   */
  async getAttachmentsByAnnouncementId(announcementId, fileType = null) {
    try {
      let sql = `
        SELECT 
          attachment_id,
          announcement_id,
          file_name,
          file_path,
          file_type,
          file_size,
          mime_type,
          display_order,
          is_primary,
          uploaded_at
        FROM ${this.tableName}
        WHERE announcement_id = ? 
        AND deleted_at IS NULL
      `;
      
      const params = [announcementId];
      
      if (fileType) {
        sql += ' AND file_type = ?';
        params.push(fileType);
      }
      
      sql += ' ORDER BY display_order ASC, uploaded_at ASC';
      
      const attachments = await this.query(sql, params);
      return attachments;
    } catch (error) {
      console.error('Error fetching attachments:', error);
      throw error;
    }
  }

  /**
   * Get primary image for an announcement
   * @param {number} announcementId - The announcement ID
   * @returns {Promise<Object|null>} Primary image attachment
   */
  async getPrimaryImage(announcementId) {
    try {
      const sql = `
        SELECT 
          attachment_id,
          announcement_id,
          file_name,
          file_path,
          file_type,
          file_size,
          mime_type,
          display_order,
          is_primary,
          uploaded_at
        FROM ${this.tableName}
        WHERE announcement_id = ? 
        AND file_type = 'image'
        AND is_primary = 1
        AND deleted_at IS NULL
        LIMIT 1
      `;
      
      const result = await this.query(sql, [announcementId]);
      return result.length > 0 ? result[0] : null;
    } catch (error) {
      console.error('Error fetching primary image:', error);
      throw error;
    }
  }

  /**
   * Update attachment display order
   * @param {number} announcementId - The announcement ID
   * @param {Array} orderData - Array of {attachment_id, display_order}
   * @returns {Promise<boolean>} Success status
   */
  async updateDisplayOrder(announcementId, orderData) {
    if (!Array.isArray(orderData) || orderData.length === 0) {
      throw new ValidationError('Order data is required');
    }

    try {
      await this.beginTransaction();

      for (const item of orderData) {
        if (!item.attachment_id || item.display_order === undefined) {
          throw new ValidationError('attachment_id and display_order are required');
        }

        await this.query(
          `UPDATE ${this.tableName} 
           SET display_order = ?, updated_at = NOW() 
           WHERE attachment_id = ? AND announcement_id = ? AND deleted_at IS NULL`,
          [item.display_order, item.attachment_id, announcementId]
        );
      }

      await this.commit();
      return true;
    } catch (error) {
      await this.rollback();
      throw error;
    }
  }

  /**
   * Set primary image for an announcement
   * @param {number} announcementId - The announcement ID
   * @param {number} attachmentId - The attachment ID to set as primary
   * @returns {Promise<boolean>} Success status
   */
  async setPrimaryImage(announcementId, attachmentId) {
    try {
      await this.beginTransaction();

      // First, unset all primary flags for this announcement
      await this.query(
        `UPDATE ${this.tableName} 
         SET is_primary = 0 
         WHERE announcement_id = ? AND deleted_at IS NULL`,
        [announcementId]
      );

      // Then set the specified attachment as primary
      const result = await this.query(
        `UPDATE ${this.tableName} 
         SET is_primary = 1 
         WHERE attachment_id = ? AND announcement_id = ? AND deleted_at IS NULL`,
        [attachmentId, announcementId]
      );

      if (result.affectedRows === 0) {
        throw new NotFoundError('Attachment not found');
      }

      await this.commit();
      return true;
    } catch (error) {
      await this.rollback();
      throw error;
    }
  }

  /**
   * Soft delete an attachment
   * @param {number} attachmentId - The attachment ID
   * @param {number} announcementId - The announcement ID (for verification)
   * @returns {Promise<boolean>} Success status
   */
  async deleteAttachment(attachmentId, announcementId) {
    try {
      // Get attachment details before deletion
      const attachment = await this.findById(attachmentId);
      if (!attachment || attachment.announcement_id !== announcementId) {
        throw new NotFoundError('Attachment not found');
      }

      // Soft delete the attachment
      const result = await this.query(
        `UPDATE ${this.tableName} 
         SET deleted_at = NOW() 
         WHERE attachment_id = ? AND announcement_id = ?`,
        [attachmentId, announcementId]
      );

      if (result.affectedRows === 0) {
        throw new NotFoundError('Attachment not found');
      }

      // If this was the primary image, set another image as primary
      if (attachment.is_primary) {
        const remainingImages = await this.getAttachmentsByAnnouncementId(announcementId, 'image');
        if (remainingImages.length > 0) {
          await this.setPrimaryImage(announcementId, remainingImages[0].attachment_id);
        }
      }

      // Delete the physical file
      if (attachment.file_path) {
        const filename = attachment.file_path.split('/').pop();
        deleteUploadedFile(filename);
      }

      return true;
    } catch (error) {
      console.error('Error deleting attachment:', error);
      throw error;
    }
  }

  /**
   * Delete all attachments for an announcement (used when announcement is deleted)
   * @param {number} announcementId - The announcement ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteAllAttachments(announcementId) {
    try {
      // Get all attachments before deletion for file cleanup
      const attachments = await this.query(
        `SELECT file_path FROM ${this.tableName} 
         WHERE announcement_id = ? AND deleted_at IS NULL`,
        [announcementId]
      );

      // Soft delete all attachments
      await this.query(
        `UPDATE ${this.tableName} 
         SET deleted_at = NOW() 
         WHERE announcement_id = ?`,
        [announcementId]
      );

      // Delete physical files
      attachments.forEach(attachment => {
        if (attachment.file_path) {
          const filename = attachment.file_path.split('/').pop();
          deleteUploadedFile(filename);
        }
      });

      return true;
    } catch (error) {
      console.error('Error deleting all attachments:', error);
      throw error;
    }
  }

  /**
   * Get attachment statistics for an announcement
   * @param {number} announcementId - The announcement ID
   * @returns {Promise<Object>} Attachment statistics
   */
  async getAttachmentStats(announcementId) {
    try {
      const sql = `
        SELECT 
          COUNT(*) as total_count,
          COUNT(CASE WHEN file_type = 'image' THEN 1 END) as image_count,
          SUM(file_size) as total_size
        FROM ${this.tableName}
        WHERE announcement_id = ? AND deleted_at IS NULL
      `;
      
      const result = await this.query(sql, [announcementId]);
      return result[0] || { total_count: 0, image_count: 0, total_size: 0 };
    } catch (error) {
      console.error('Error fetching attachment stats:', error);
      throw error;
    }
  }
}

module.exports = AnnouncementAttachmentModel;
