const CategoryModel = require('../models/CategoryModel');
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

class CategoryController {
  // Get all categories
  getCategories = asyncHandler(async (req, res) => {
    const categories = await CategoryModel.getCategories();

    res.status(200).json({
      success: true,
      message: 'Categories retrieved successfully',
      data: { categories },
    });
  });

  // Get categories with their subcategories (includes inactive for management)
  getCategoriesWithSubcategories = asyncHandler(async (req, res) => {
    const categories = await CategoryModel.getCategoriesWithSubcategories();

    res.status(200).json({
      success: true,
      message: 'Categories with subcategories retrieved successfully',
      data: { categories },
    });
  });

  // Get active categories with their active subcategories (for public use)
  getActiveCategoriesWithSubcategories = asyncHandler(async (req, res) => {
    const categories = await CategoryModel.getActiveCategoriesWithSubcategories();

    res.status(200).json({
      success: true,
      message: 'Active categories with subcategories retrieved successfully',
      data: { categories },
    });
  });

  // Get subcategories by category ID
  getSubcategoriesByCategory = asyncHandler(async (req, res) => {
    const { categoryId } = req.params;
    const subcategories = await CategoryModel.getSubcategoriesByCategory(categoryId);

    res.status(200).json({
      success: true,
      message: 'Subcategories retrieved successfully',
      data: { subcategories },
    });
  });

  // Get all subcategories
  getSubcategories = asyncHandler(async (req, res) => {
    const subcategories = await CategoryModel.getSubcategories();

    res.status(200).json({
      success: true,
      message: 'Subcategories retrieved successfully',
      data: { subcategories },
    });
  });

  // Create category (super_admin only)
  createCategory = asyncHandler(async (req, res) => {
    const { name, description, color_code, is_active = true } = req.body;

    // Check if user is authenticated
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        error: { message: 'User not authenticated' }
      });
    }

    const categoryData = {
      name,
      description,
      color_code,
      is_active,
      created_by: req.user.id,
    };

    const category = await CategoryModel.createCategory(categoryData);

    logger.info('Category created', {
      categoryId: category.category_id,
      name: category.name,
      createdBy: req.user.id,
      userEmail: req.user.email || 'unknown',
    });

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: { category },
    });
  });

  // Update category (super_admin only)
  updateCategory = asyncHandler(async (req, res) => {
    const { categoryId } = req.params;
    const { name, description, color_code, is_active } = req.body;

    // Check if user is authenticated
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        error: { message: 'User not authenticated' }
      });
    }

    const updateData = {
      name,
      description,
      color_code,
      is_active,
      updated_by: req.user.id,
    };

    const category = await CategoryModel.updateCategory(categoryId, updateData);

    logger.info('Category updated', {
      categoryId,
      updatedBy: req.user.id,
      userEmail: req.user.email || 'unknown',
    });

    res.status(200).json({
      success: true,
      message: 'Category updated successfully',
      data: { category },
    });
  });

  // Delete category (super_admin only)
  deleteCategory = asyncHandler(async (req, res) => {
    const { categoryId } = req.params;
    const { forceDelete = false, cascadeSubcategories = false } = req.query;

    // Check if user is authenticated
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        error: { message: 'User not authenticated' }
      });
    }

    try {
      const result = await CategoryModel.deleteCategory(categoryId, {
        forceDelete: forceDelete === 'true',
        cascadeSubcategories: cascadeSubcategories === 'true'
      });

      logger.info('Category deleted', {
        categoryId,
        deletedBy: req.user.id,
        userEmail: req.user.email || 'unknown',
        cascadeSubcategories: cascadeSubcategories === 'true',
        deletedSubcategories: result.deletedSubcategories || 0
      });

      res.status(200).json({
        success: true,
        message: cascadeSubcategories === 'true'
          ? `Category deleted successfully along with ${result.deletedSubcategories} subcategories`
          : 'Category deleted successfully',
        data: {
          categoryId: parseInt(categoryId),
          deletedSubcategories: result.deletedSubcategories || 0,
          subcategoriesDeleted: result.subcategoriesDeleted || []
        }
      });
    } catch (error) {
      // Handle validation errors with detailed information
      if (error.name === 'ValidationError' && error.details) {
        return res.status(400).json({
          success: false,
          message: error.message,
          error: {
            code: error.details.code,
            categoryId: error.details.categoryId,
            categoryName: error.details.categoryName,
            activeSubcategories: error.details.activeSubcategories,
            totalActiveSubcategories: error.details.totalActiveSubcategories,
            totalInactiveSubcategories: error.details.totalInactiveSubcategories,
            suggestions: [
              'Delete the subcategories individually first',
              'Move subcategories to another category',
              'Use cascade deletion to delete category with all subcategories'
            ]
          }
        });
      }

      // Re-throw other errors to be handled by global error handler
      throw error;
    }
  });

  // Create subcategory (super_admin only)
  createSubcategory = asyncHandler(async (req, res) => {
    const { name, category_id, description, color_code, display_order, is_active = true } = req.body;

    // Check if user is authenticated
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        error: { message: 'User not authenticated' }
      });
    }

    const subcategoryData = {
      name,
      category_id,
      description,
      color_code,
      display_order,
      is_active,
      created_by: req.user.id,
    };

    const subcategory = await CategoryModel.createSubcategory(subcategoryData);

    logger.info('Subcategory created', {
      subcategoryId: subcategory.subcategory_id,
      name: subcategory.name,
      categoryId: category_id,
      createdBy: req.user.id,
      userEmail: req.user.email || 'unknown',
    });

    res.status(201).json({
      success: true,
      message: 'Subcategory created successfully',
      data: { subcategory },
    });
  });

  // Update subcategory (super_admin only)
  updateSubcategory = asyncHandler(async (req, res) => {
    const { subcategoryId } = req.params;
    const { name, category_id, description, color_code, display_order, is_active } = req.body;

    // Check if user is authenticated
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        error: { message: 'User not authenticated' }
      });
    }

    const updateData = {
      name,
      category_id,
      description,
      color_code,
      display_order,
      is_active,
      updated_by: req.user.id,
    };

    const subcategory = await CategoryModel.updateSubcategory(subcategoryId, updateData);

    logger.info('Subcategory updated', {
      subcategoryId,
      updatedBy: req.user.id,
      userEmail: req.user.email || 'unknown',
    });

    res.status(200).json({
      success: true,
      message: 'Subcategory updated successfully',
      data: { subcategory },
    });
  });

  // Delete subcategory (super_admin only)
  deleteSubcategory = asyncHandler(async (req, res) => {
    const { subcategoryId } = req.params;

    // Check if user is authenticated
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        error: { message: 'User not authenticated' }
      });
    }

    await CategoryModel.deleteSubcategory(subcategoryId);

    logger.info('Subcategory deleted', {
      subcategoryId,
      deletedBy: req.user.id,
      userEmail: req.user.email || 'unknown',
    });

    res.status(200).json({
      success: true,
      message: 'Subcategory deleted successfully',
    });
  });

  // Activate category (super_admin only)
  activateCategory = asyncHandler(async (req, res) => {
    const { categoryId } = req.params;

    await CategoryModel.updateCategoryStatus(categoryId, true);

    logger.info('Category activated', {
      categoryId,
      activatedBy: req.user.id,
      userEmail: req.user.email,
    });

    res.status(200).json({
      success: true,
      message: 'Category activated successfully',
    });
  });

  // Deactivate category (super_admin only)
  deactivateCategory = asyncHandler(async (req, res) => {
    const { categoryId } = req.params;

    await CategoryModel.updateCategoryStatus(categoryId, false);

    logger.info('Category deactivated', {
      categoryId,
      deactivatedBy: req.user.id,
      userEmail: req.user.email,
    });

    res.status(200).json({
      success: true,
      message: 'Category deactivated successfully',
    });
  });

  // Activate subcategory (super_admin only)
  activateSubcategory = asyncHandler(async (req, res) => {
    const { subcategoryId } = req.params;

    await CategoryModel.updateSubcategoryStatus(subcategoryId, true);

    logger.info('Subcategory activated', {
      subcategoryId,
      activatedBy: req.user.id,
      userEmail: req.user.email,
    });

    res.status(200).json({
      success: true,
      message: 'Subcategory activated successfully',
    });
  });

  // Deactivate subcategory (super_admin only)
  deactivateSubcategory = asyncHandler(async (req, res) => {
    const { subcategoryId } = req.params;

    await CategoryModel.updateSubcategoryStatus(subcategoryId, false);

    logger.info('Subcategory deactivated', {
      subcategoryId,
      deactivatedBy: req.user.id,
      userEmail: req.user.email,
    });

    res.status(200).json({
      success: true,
      message: 'Subcategory deactivated successfully',
    });
  });

  // Update subcategory order (super_admin only)
  updateSubcategoryOrder = asyncHandler(async (req, res) => {
    const { subcategoryId } = req.params;
    const { display_order } = req.body;

    await CategoryModel.updateSubcategoryOrder(subcategoryId, display_order);

    logger.info('Subcategory order updated', {
      subcategoryId,
      displayOrder: display_order,
      updatedBy: req.user.id,
      userEmail: req.user.email,
    });

    res.status(200).json({
      success: true,
      message: 'Subcategory order updated successfully',
    });
  });

  // Toggle category status (super_admin only)
  toggleCategoryStatus = asyncHandler(async (req, res) => {
    const { categoryId } = req.params;
    const { is_active } = req.body;

    // Check if user is authenticated
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        error: { message: 'User not authenticated' }
      });
    }

    await CategoryModel.updateCategoryStatus(categoryId, is_active);

    logger.info('Category status toggled', {
      categoryId,
      isActive: is_active,
      updatedBy: req.user.id,
      userEmail: req.user.email || 'unknown',
    });

    res.status(200).json({
      success: true,
      message: `Category ${is_active ? 'activated' : 'deactivated'} successfully`,
    });
  });

  // Toggle subcategory status (super_admin only)
  toggleSubcategoryStatus = asyncHandler(async (req, res) => {
    const { categoryId, subcategoryId } = req.params;
    const { is_active } = req.body;

    // Check if user is authenticated
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        error: { message: 'User not authenticated' }
      });
    }

    await CategoryModel.updateSubcategoryStatus(subcategoryId, is_active);

    logger.info('Subcategory status toggled', {
      categoryId,
      subcategoryId,
      isActive: is_active,
      updatedBy: req.user.id,
      userEmail: req.user.email || 'unknown',
    });

    res.status(200).json({
      success: true,
      message: `Subcategory ${is_active ? 'activated' : 'deactivated'} successfully`,
    });
  });

  // Get archived categories (super_admin only)
  getArchivedCategories = asyncHandler(async (req, res) => {
    // Check if user is authenticated
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        error: { message: 'User not authenticated' }
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const result = await CategoryModel.getArchivedCategories(page, limit);

    res.status(200).json({
      success: true,
      message: 'Archived categories retrieved successfully',
      data: result,
    });
  });

  // Get archived subcategories (super_admin only)
  getArchivedSubcategories = asyncHandler(async (req, res) => {
    // Check if user is authenticated
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        error: { message: 'User not authenticated' }
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const result = await CategoryModel.getArchivedSubcategories(page, limit);

    res.status(200).json({
      success: true,
      message: 'Archived subcategories retrieved successfully',
      data: result,
    });
  });

  // Restore archived category (super_admin only)
  restoreCategory = asyncHandler(async (req, res) => {
    const { categoryId } = req.params;

    // Check if user is authenticated
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        error: { message: 'User not authenticated' }
      });
    }

    const result = await CategoryModel.restoreCategory(categoryId);

    logger.info('Category restored', {
      categoryId,
      restoredBy: req.user.id,
      userEmail: req.user.email || 'unknown',
    });

    res.status(200).json({
      success: true,
      message: 'Category restored successfully',
      data: result,
    });
  });

  // Restore archived subcategory (super_admin only)
  restoreSubcategory = asyncHandler(async (req, res) => {
    const { subcategoryId } = req.params;

    // Check if user is authenticated
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        error: { message: 'User not authenticated' }
      });
    }

    const result = await CategoryModel.restoreSubcategory(subcategoryId);

    logger.info('Subcategory restored', {
      subcategoryId,
      restoredBy: req.user.id,
      userEmail: req.user.email || 'unknown',
    });

    res.status(200).json({
      success: true,
      message: 'Subcategory restored successfully',
      data: result,
    });
  });
}

module.exports = new CategoryController();
