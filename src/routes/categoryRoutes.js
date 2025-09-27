const express = require('express');
const { body, param, query } = require('express-validator');
const CategoryController = require('../controllers/CategoryController');
const { authenticate, adminOnly } = require('../middleware/auth');
const { requireManageCategories, requireManageSubcategories } = require('../middleware/permissions');
const { validateRequest } = require('../middleware/validation');
const { auditContentAction } = require('../middleware/auditLogger');

const router = express.Router();

// Validation schemas
const categoryValidation = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Category name must be between 1 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
  body('color_code')
    .optional()
    .matches(/^#[0-9A-F]{6}$/i)
    .withMessage('Color code must be a valid hex color (e.g., #FF0000)'),
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be a boolean')
    .toBoolean(),
];

const subcategoryValidation = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Subcategory name must be between 1 and 100 characters'),
  body('category_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Category ID must be a positive integer')
    .toInt(),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
  body('color_code')
    .optional()
    .matches(/^#[0-9A-F]{6}$/i)
    .withMessage('Color code must be a valid hex color (e.g., #FF0000)'),
  body('display_order')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Display order must be a non-negative integer')
    .toInt(),
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be a boolean')
    .toBoolean(),
];

const categoryIdValidation = [
  param('categoryId')
    .isInt({ min: 1 })
    .withMessage('Category ID must be a positive integer')
    .toInt(),
];

const subcategoryIdValidation = [
  param('subcategoryId')
    .isInt({ min: 1 })
    .withMessage('Subcategory ID must be a positive integer')
    .toInt(),
];

// Public routes (no authentication required)
router.get('/', CategoryController.getCategories);
router.get('/with-subcategories', CategoryController.getCategoriesWithSubcategories);
router.get('/active/with-subcategories', CategoryController.getActiveCategoriesWithSubcategories);
router.get('/:categoryId/subcategories', categoryIdValidation, validateRequest, CategoryController.getSubcategoriesByCategory);
router.get('/subcategories', CategoryController.getSubcategories);

// Protected routes (require authentication)
router.use(authenticate);
router.use(adminOnly);

// Category management routes (require super_admin position)
router.post('/', requireManageCategories, categoryValidation, validateRequest, auditContentAction('CREATE', 'categories'), CategoryController.createCategory);
router.put('/:categoryId', requireManageCategories, categoryIdValidation, categoryValidation, validateRequest, auditContentAction('UPDATE', 'categories'), CategoryController.updateCategory);
router.delete('/:categoryId', requireManageCategories, categoryIdValidation, validateRequest, auditContentAction('DELETE', 'categories'), CategoryController.deleteCategory);

// Subcategory management routes (require super_admin position)
router.post('/subcategories', requireManageSubcategories, subcategoryValidation, validateRequest, auditContentAction('CREATE', 'subcategories'), CategoryController.createSubcategory);
router.put('/subcategories/:subcategoryId', requireManageSubcategories, subcategoryIdValidation, subcategoryValidation, validateRequest, auditContentAction('UPDATE', 'subcategories'), CategoryController.updateSubcategory);
router.delete('/subcategories/:subcategoryId', requireManageSubcategories, subcategoryIdValidation, validateRequest, auditContentAction('DELETE', 'subcategories'), CategoryController.deleteSubcategory);

// Category status management (require super_admin position)
router.put('/:categoryId/activate', requireManageCategories, categoryIdValidation, validateRequest, CategoryController.activateCategory);
router.put('/:categoryId/deactivate', requireManageCategories, categoryIdValidation, validateRequest, CategoryController.deactivateCategory);
router.patch('/:categoryId/status', requireManageCategories, categoryIdValidation, validateRequest, CategoryController.toggleCategoryStatus);

// Subcategory status management (require super_admin position)
router.put('/subcategories/:subcategoryId/activate', requireManageSubcategories, subcategoryIdValidation, validateRequest, CategoryController.activateSubcategory);
router.put('/subcategories/:subcategoryId/deactivate', requireManageSubcategories, subcategoryIdValidation, validateRequest, CategoryController.deactivateSubcategory);
router.patch('/:categoryId/subcategories/:subcategoryId/status', requireManageSubcategories, categoryIdValidation, subcategoryIdValidation, validateRequest, CategoryController.toggleSubcategoryStatus);

// Subcategory ordering (require super_admin position)
router.put('/subcategories/:subcategoryId/order', requireManageSubcategories, subcategoryIdValidation, validateRequest, CategoryController.updateSubcategoryOrder);

// Archive management routes (require super_admin position)
router.get('/archive', requireManageCategories, CategoryController.getArchivedCategories);
router.get('/subcategories/archive', requireManageSubcategories, CategoryController.getArchivedSubcategories);

// Restore routes (require super_admin position)
router.patch('/:categoryId/restore', requireManageCategories, categoryIdValidation, validateRequest, auditContentAction('RESTORE', 'categories'), CategoryController.restoreCategory);
router.patch('/subcategories/:subcategoryId/restore', requireManageSubcategories, subcategoryIdValidation, validateRequest, auditContentAction('RESTORE', 'subcategories'), CategoryController.restoreSubcategory);

module.exports = router;
