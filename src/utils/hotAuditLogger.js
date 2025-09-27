const AuditLogService = require('../services/AuditLogService');

/**
 * Hot-reload audit logger that can be used to add audit logging
 * to existing controllers without requiring server restart
 */
class HotAuditLogger {
  
  /**
   * Log a welcome page operation
   */
  static async logWelcomePageOperation(operation, details = {}) {
    try {
      const {
        action = 'UNKNOWN',
        targetTable = 'welcome_cards',
        recordId = null,
        userEmail = 'test@admin.com',
        userId = 31,
        additionalInfo = ''
      } = details;

      await AuditLogService.logContentAction(
        {
          id: userId,
          email: userEmail,
          role: 'admin'
        },
        action,
        targetTable,
        recordId,
        {
          description: `${userEmail} performed ${action} on ${targetTable}${recordId ? ` (ID: ${recordId})` : ''}${additionalInfo ? ` - ${additionalInfo}` : ''}`,
          operation: operation
        },
        {
          method: 'PUT',
          path: `/api/welcome-page/admin/${targetTable}`,
          ip: '127.0.0.1',
          get: () => 'Hot Audit Logger'
        }
      );

      console.log(`✅ Audit log created: ${action} on ${targetTable}`);
      return true;
    } catch (error) {
      console.error('❌ Hot audit logging failed:', error.message);
      return false;
    }
  }

  /**
   * Log card reordering operation
   */
  static async logCardReorder(cardCount = 1) {
    return await this.logWelcomePageOperation('Card Reorder', {
      action: 'REORDER',
      targetTable: 'welcome_cards',
      additionalInfo: `Reordered ${cardCount} cards`
    });
  }

  /**
   * Log card status toggle operation
   */
  static async logCardToggle(cardId) {
    return await this.logWelcomePageOperation('Card Status Toggle', {
      action: 'TOGGLE_STATUS',
      targetTable: 'welcome_cards',
      recordId: cardId,
      additionalInfo: `Toggled status for card ${cardId}`
    });
  }

  /**
   * Log carousel reordering operation
   */
  static async logCarouselReorder(imageCount = 1) {
    return await this.logWelcomePageOperation('Carousel Reorder', {
      action: 'REORDER',
      targetTable: 'carousel_images',
      additionalInfo: `Reordered ${imageCount} carousel images`
    });
  }

  /**
   * Log card creation operation
   */
  static async logCardCreate(cardId) {
    return await this.logWelcomePageOperation('Card Create', {
      action: 'CREATE',
      targetTable: 'welcome_cards',
      recordId: cardId,
      additionalInfo: `Created new card with ID ${cardId}`
    });
  }

  /**
   * Log card update operation
   */
  static async logCardUpdate(cardId) {
    return await this.logWelcomePageOperation('Card Update', {
      action: 'UPDATE',
      targetTable: 'welcome_cards',
      recordId: cardId,
      additionalInfo: `Updated card with ID ${cardId}`
    });
  }

  /**
   * Log card deletion operation
   */
  static async logCardDelete(cardId) {
    return await this.logWelcomePageOperation('Card Delete', {
      action: 'DELETE',
      targetTable: 'welcome_cards',
      recordId: cardId,
      additionalInfo: `Deleted card with ID ${cardId}`
    });
  }

  /**
   * Log background image operations
   */
  static async logBackgroundOperation(action, backgroundId = null) {
    return await this.logWelcomePageOperation('Background Operation', {
      action: action,
      targetTable: 'welcome_backgrounds',
      recordId: backgroundId,
      additionalInfo: `${action} background image${backgroundId ? ` (ID: ${backgroundId})` : ''}`
    });
  }

  /**
   * Log carousel image operations
   */
  static async logCarouselOperation(action, imageId = null) {
    return await this.logWelcomePageOperation('Carousel Operation', {
      action: action,
      targetTable: 'carousel_images',
      recordId: imageId,
      additionalInfo: `${action} carousel image${imageId ? ` (ID: ${imageId})` : ''}`
    });
  }
}

module.exports = HotAuditLogger;
