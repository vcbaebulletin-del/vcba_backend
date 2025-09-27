const WelcomePageModel = require('../models/WelcomePageModel');
const WelcomeCardsModel = require('../models/WelcomeCardsModel');
const LoginCarouselModel = require('../models/LoginCarouselModel');
const { ValidationError, NotFoundError } = require('../middleware/errorHandler');
const AuditLogService = require('../services/AuditLogService');
const fs = require('fs').promises;
const path = require('path');

class WelcomePageController {
  constructor() {
    this.welcomePageModel = new WelcomePageModel();
    this.welcomeCardsModel = new WelcomeCardsModel();
    this.loginCarouselModel = new LoginCarouselModel();
  }

  // Get welcome page data (public endpoint)
  async getWelcomePageData(req, res) {
    try {
      const [background, cards] = await Promise.all([
        this.welcomePageModel.getActiveBackground(),
        this.welcomeCardsModel.getActiveCards()
      ]);

      res.json({
        success: true,
        data: {
          background: background || {
            background_image: '/villamor-image/villamor-collge-BG-landscape.jpg'
          },
          cards: cards || []
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get welcome page data',
        error: error.message
      });
    }
  }

  // Get login carousel images (public endpoint)
  async getLoginCarouselImages(req, res) {
    try {
      const images = await this.loginCarouselModel.getActiveImages();

      res.json({
        success: true,
        data: {
          images: images || []
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get login carousel images',
        error: error.message
      });
    }
  }

  // ADMIN ENDPOINTS - Background Management

  // Get all backgrounds (admin)
  async getAllBackgrounds(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;

      const result = await this.welcomePageModel.getAllBackgrounds(page, limit);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get backgrounds',
        error: error.message
      });
    }
  }

  // Upload new background (admin)
  async uploadBackground(req, res) {
    try {
      if (!req.uploadedWelcomeImage) {
        throw new ValidationError('No background image uploaded');
      }

      const backgroundData = {
        background_image: req.uploadedWelcomeImage.path,
        created_by: req.user.id
      };

      const result = await this.welcomePageModel.createBackground(backgroundData);

      res.status(201).json({
        success: true,
        message: 'Background uploaded successfully',
        data: result
      });
    } catch (error) {
      res.status(error instanceof ValidationError ? 400 : 500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Set active background (admin)
  async setActiveBackground(req, res) {
    try {
      const { id } = req.params;
      const result = await this.welcomePageModel.setActiveBackground(id);

      res.json({
        success: true,
        message: 'Background set as active',
        data: result
      });
    } catch (error) {
      const status = error instanceof NotFoundError ? 404 : 
                    error instanceof ValidationError ? 400 : 500;
      
      res.status(status).json({
        success: false,
        message: error.message
      });
    }
  }

  // Delete background (admin)
  async deleteBackground(req, res) {
    try {
      const { id } = req.params;
      const result = await this.welcomePageModel.deleteBackground(id);

      // Delete physical file
      if (result.background_image && !result.background_image.includes('villamor-image')) {
        try {
          const filePath = path.join(process.cwd(), 'public', result.background_image);
          await fs.unlink(filePath);
        } catch (fileError) {
          console.warn('Failed to delete background file:', fileError.message);
        }
      }

      res.json({
        success: true,
        message: 'Background deleted successfully'
      });
    } catch (error) {
      const status = error instanceof NotFoundError ? 404 : 
                    error instanceof ValidationError ? 400 : 500;
      
      res.status(status).json({
        success: false,
        message: error.message
      });
    }
  }

  // ADMIN ENDPOINTS - Cards Management

  // Get all cards (admin)
  async getAllCards(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;

      const result = await this.welcomeCardsModel.getAllCards(page, limit);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get cards',
        error: error.message
      });
    }
  }

  // Create new card (admin)
  async createCard(req, res) {
    try {
      const { title, description, order_index, is_active } = req.body;

      if (!req.uploadedWelcomeImage) {
        throw new ValidationError('No card image uploaded');
      }

      const cardData = {
        title,
        description,
        image: req.uploadedWelcomeImage.path,
        order_index: order_index ? parseInt(order_index) : undefined,
        is_active: is_active !== undefined ? Boolean(is_active) : true,
        created_by: req.user.id
      };

      const result = await this.welcomeCardsModel.createCard(cardData);

      // Log the audit event
      try {
        await AuditLogService.logContentAction({
          user: req.user || { id: 31, email: 'test@admin.com', role: 'admin' },
          action: 'CREATE',
          targetTable: 'welcome_cards',
          recordId: result.id,
          description: `${req.user?.email || 'test@admin.com'} performed CREATE on welcome_cards (ID: ${result.id})`,
          request: req,
          response: { success: true, data: result }
        });
      } catch (auditError) {
        console.error('Audit logging failed:', auditError.message);
      }

      res.status(201).json({
        success: true,
        message: 'Card created successfully',
        data: result
      });
    } catch (error) {
      res.status(error instanceof ValidationError ? 400 : 500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Update card (admin)
  async updateCard(req, res) {
    try {
      const { id } = req.params;
      const updateData = { ...req.body };

      // If new image uploaded, update image path
      if (req.uploadedWelcomeImage) {
        updateData.image = req.uploadedWelcomeImage.path;
      }

      const result = await this.welcomeCardsModel.updateCard(id, updateData);

      res.json({
        success: true,
        message: 'Card updated successfully',
        data: result
      });
    } catch (error) {
      const status = error instanceof NotFoundError ? 404 : 
                    error instanceof ValidationError ? 400 : 500;
      
      res.status(status).json({
        success: false,
        message: error.message
      });
    }
  }

  // Reorder cards (admin)
  async reorderCards(req, res) {
    try {
      const { cardOrders } = req.body;
      const result = await this.welcomeCardsModel.reorderCards(cardOrders);

      // Log the audit event
      try {
        await AuditLogService.logContentAction({
          user: req.user || { id: 31, email: 'test@admin.com', role: 'admin' },
          action: 'REORDER',
          targetTable: 'welcome_cards',
          recordId: null,
          description: `${req.user?.email || 'test@admin.com'} performed REORDER on welcome_cards`,
          request: req,
          response: { success: true, data: result }
        });
      } catch (auditError) {
        console.error('Audit logging failed:', auditError.message);
      }

      res.json({
        success: true,
        message: 'Cards reordered successfully',
        data: result
      });
    } catch (error) {
      res.status(error instanceof ValidationError ? 400 : 500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Toggle card status (admin)
  async toggleCardStatus(req, res) {
    try {
      const { id } = req.params;
      const result = await this.welcomeCardsModel.toggleCardStatus(id);

      // Log the audit event
      try {
        await AuditLogService.logContentAction({
          user: req.user || { id: 31, email: 'test@admin.com', role: 'admin' },
          action: 'TOGGLE_STATUS',
          targetTable: 'welcome_cards',
          recordId: id,
          description: `${req.user?.email || 'test@admin.com'} performed TOGGLE_STATUS on welcome_cards (ID: ${id})`,
          request: req,
          response: { success: true, data: result }
        });
      } catch (auditError) {
        console.error('Audit logging failed:', auditError.message);
      }

      res.json({
        success: true,
        message: 'Card status updated successfully',
        data: result
      });
    } catch (error) {
      const status = error instanceof NotFoundError ? 404 : 500;

      res.status(status).json({
        success: false,
        message: error.message
      });
    }
  }

  // Soft delete card (admin)
  async deleteCard(req, res) {
    try {
      const { id } = req.params;
      const result = await this.welcomeCardsModel.deleteCard(id);

      // Note: Physical file is NOT deleted for soft delete
      // This allows for potential restoration of the card

      res.json({
        success: true,
        message: 'Card archived successfully',
        data: { soft_delete: result.soft_delete }
      });
    } catch (error) {
      const status = error instanceof NotFoundError ? 404 : 500;

      res.status(status).json({
        success: false,
        message: error.message
      });
    }
  }

  // ADMIN ENDPOINTS - Carousel Management

  // Get all carousel images (admin)
  async getAllCarouselImages(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;

      const result = await this.loginCarouselModel.getAllImages(page, limit);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get carousel images',
        error: error.message
      });
    }
  }

  // Upload carousel image (admin)
  async uploadCarouselImage(req, res) {
    try {
      const { order_index, is_active } = req.body;

      if (!req.uploadedCarouselImage) {
        throw new ValidationError('No carousel image uploaded');
      }

      const imageData = {
        image: req.uploadedCarouselImage.path,
        order_index: order_index ? parseInt(order_index) : undefined,
        is_active: is_active !== undefined ? Boolean(is_active) : true,
        created_by: req.user.id
      };

      const result = await this.loginCarouselModel.createImage(imageData);

      res.status(201).json({
        success: true,
        message: 'Carousel image uploaded successfully',
        data: result
      });
    } catch (error) {
      res.status(error instanceof ValidationError ? 400 : 500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Update carousel image (admin)
  async updateCarouselImage(req, res) {
    try {
      const { id } = req.params;
      const updateData = { ...req.body };

      // If new image uploaded, update image path
      if (req.uploadedCarouselImage) {
        updateData.image = req.uploadedCarouselImage.path;
      }

      const result = await this.loginCarouselModel.updateImage(id, updateData);

      res.json({
        success: true,
        message: 'Carousel image updated successfully',
        data: result
      });
    } catch (error) {
      const status = error instanceof NotFoundError ? 404 :
                    error instanceof ValidationError ? 400 : 500;

      res.status(status).json({
        success: false,
        message: error.message
      });
    }
  }

  // Reorder carousel images (admin)
  async reorderCarouselImages(req, res) {
    try {
      const { imageOrders } = req.body;
      const result = await this.loginCarouselModel.reorderImages(imageOrders);

      // Log the audit event
      try {
        await AuditLogService.logContentAction({
          user: req.user || { id: 31, email: 'test@admin.com', role: 'admin' },
          action: 'REORDER',
          targetTable: 'carousel_images',
          recordId: null,
          description: `${req.user?.email || 'test@admin.com'} performed REORDER on carousel_images`,
          request: req,
          response: { success: true, data: result }
        });
      } catch (auditError) {
        console.error('Audit logging failed:', auditError.message);
      }

      res.json({
        success: true,
        message: 'Carousel images reordered successfully',
        data: result
      });
    } catch (error) {
      res.status(error instanceof ValidationError ? 400 : 500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Toggle carousel image status (admin)
  async toggleCarouselImageStatus(req, res) {
    try {
      const { id } = req.params;
      const result = await this.loginCarouselModel.toggleImageStatus(id);

      res.json({
        success: true,
        message: 'Carousel image status updated successfully',
        data: result
      });
    } catch (error) {
      const status = error instanceof NotFoundError ? 404 : 500;

      res.status(status).json({
        success: false,
        message: error.message
      });
    }
  }

  // Soft delete carousel image (admin)
  async deleteCarouselImage(req, res) {
    try {
      const { id } = req.params;
      const result = await this.loginCarouselModel.deleteImage(id);

      // Note: Physical file is NOT deleted for soft delete
      // This allows for potential restoration of the carousel image

      res.json({
        success: true,
        message: 'Carousel image archived successfully',
        data: { soft_delete: result.soft_delete }
      });
    } catch (error) {
      const status = error instanceof NotFoundError ? 404 : 500;

      res.status(status).json({
        success: false,
        message: error.message
      });
    }
  }

  // Get archived cards (admin)
  async getArchivedCards(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;

      const result = await this.welcomeCardsModel.getArchivedCards(page, limit);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Get archived carousel images (admin)
  async getArchivedCarouselImages(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;

      const result = await this.loginCarouselModel.getArchivedImages(page, limit);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Restore archived card (admin)
  async restoreCard(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Card ID is required'
        });
      }

      const result = await this.welcomeCardsModel.restoreCard(id);

      res.json({
        success: true,
        message: 'Card restored successfully',
        data: result
      });
    } catch (error) {
      const statusCode = error.name === 'NotFoundError' ? 404 :
                        error.name === 'ValidationError' ? 400 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message
      });
    }
  }

  // Restore archived carousel image (admin)
  async restoreCarouselImage(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Carousel image ID is required'
        });
      }

      const result = await this.loginCarouselModel.restoreImage(id);

      res.json({
        success: true,
        message: 'Carousel image restored successfully',
        data: result
      });
    } catch (error) {
      const statusCode = error.name === 'NotFoundError' ? 404 :
                        error.name === 'ValidationError' ? 400 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = WelcomePageController;
