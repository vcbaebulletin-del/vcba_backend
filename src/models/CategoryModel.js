const BaseModel = require('./BaseModel');
const { ValidationError, ConflictError, NotFoundError } = require('../middleware/errorHandler');

class CategoryModel extends BaseModel {
  constructor() {
    super('categories', 'category_id');
  }

  // Get all active categories (not soft-deleted)
  async getCategories() {
    const sql = `
      SELECT
        category_id,
        name,
        description,
        color_code,
        is_active,
        created_at,
        updated_at
      FROM categories
      WHERE is_active = 1 AND deleted_at IS NULL
      ORDER BY name
    `;
    return await this.db.query(sql);
  }

  // Get categories with their subcategories (not soft-deleted, includes both active and inactive for management)
  async getCategoriesWithSubcategories() {
    const sql = `
      SELECT
        c.category_id,
        c.name as category_name,
        c.description as category_description,
        c.color_code as category_color,
        c.is_active as category_active,
        s.subcategory_id,
        s.name as subcategory_name,
        s.description as subcategory_description,
        s.color_code as subcategory_color,
        s.is_active as subcategory_active,
        s.display_order
      FROM categories c
      LEFT JOIN subcategories s ON c.category_id = s.category_id AND s.deleted_at IS NULL
      WHERE c.deleted_at IS NULL
      ORDER BY c.name, s.display_order, s.name
    `;

    const rows = await this.db.query(sql);
    
    // Group subcategories under their categories
    const categoriesMap = new Map();
    
    rows.forEach(row => {
      if (!categoriesMap.has(row.category_id)) {
        categoriesMap.set(row.category_id, {
          category_id: row.category_id,
          name: row.category_name,
          description: row.category_description,
          color_code: row.category_color,
          is_active: row.category_active,
          subcategories: []
        });
      }
      
      if (row.subcategory_id) {
        categoriesMap.get(row.category_id).subcategories.push({
          subcategory_id: row.subcategory_id,
          name: row.subcategory_name,
          description: row.subcategory_description,
          color_code: row.subcategory_color,
          is_active: row.subcategory_active,
          display_order: row.display_order
        });
      }
    });
    
    return Array.from(categoriesMap.values());
  }

  // Get active categories with their active subcategories (for public use)
  async getActiveCategoriesWithSubcategories() {
    const sql = `
      SELECT
        c.category_id,
        c.name as category_name,
        c.description as category_description,
        c.color_code as category_color,
        c.is_active as category_active,
        s.subcategory_id,
        s.name as subcategory_name,
        s.description as subcategory_description,
        s.color_code as subcategory_color,
        s.is_active as subcategory_active,
        s.display_order
      FROM categories c
      LEFT JOIN subcategories s ON c.category_id = s.category_id AND s.is_active = 1 AND s.deleted_at IS NULL
      WHERE c.is_active = 1 AND c.deleted_at IS NULL
      ORDER BY c.name, s.display_order, s.name
    `;

    const rows = await this.db.query(sql);

    // Group subcategories under their categories
    const categoriesMap = new Map();

    rows.forEach(row => {
      if (!categoriesMap.has(row.category_id)) {
        categoriesMap.set(row.category_id, {
          category_id: row.category_id,
          name: row.category_name,
          description: row.category_description,
          color_code: row.category_color,
          is_active: row.category_active,
          subcategories: []
        });
      }

      if (row.subcategory_id) {
        categoriesMap.get(row.category_id).subcategories.push({
          subcategory_id: row.subcategory_id,
          name: row.subcategory_name,
          description: row.subcategory_description,
          color_code: row.subcategory_color,
          is_active: row.subcategory_active,
          display_order: row.display_order
        });
      }
    });

    return Array.from(categoriesMap.values());
  }

  // Get subcategories by category ID (not soft-deleted)
  async getSubcategoriesByCategory(categoryId) {
    const sql = `
      SELECT
        s.*,
        c.name as category_name,
        c.color_code as category_color
      FROM subcategories s
      LEFT JOIN categories c ON s.category_id = c.category_id
      WHERE s.category_id = ? AND s.is_active = 1 AND s.deleted_at IS NULL
            AND c.is_active = 1 AND c.deleted_at IS NULL
      ORDER BY s.display_order, s.name
    `;
    return await this.db.query(sql, [categoryId]);
  }

  // Get all subcategories (not soft-deleted)
  async getSubcategories() {
    const sql = `
      SELECT
        s.*,
        c.name as category_name,
        c.color_code as category_color
      FROM subcategories s
      LEFT JOIN categories c ON s.category_id = c.category_id
      WHERE s.is_active = 1 AND s.deleted_at IS NULL
            AND c.is_active = 1 AND c.deleted_at IS NULL
      ORDER BY c.name, s.display_order, s.name
    `;
    return await this.db.query(sql);
  }

  // Create category
  async createCategory(categoryData) {
    // Validate required fields
    this.validateRequired(categoryData, ['name']);

    // Check if category name already exists
    const existingCategory = await this.db.findOne(
      'SELECT category_id FROM categories WHERE name = ?',
      [categoryData.name]
    );

    if (existingCategory) {
      throw new ConflictError('Category name already exists');
    }

    // Prepare category data
    const category = {
      name: categoryData.name,
      description: categoryData.description || null,
      color_code: categoryData.color_code || '#007bff',
      is_active: categoryData.is_active !== undefined ? categoryData.is_active : true,
      created_at: new Date().toISOString(), // FIX: Use UTC string to prevent timezone conversion
      updated_at: new Date().toISOString(), // FIX: Use UTC string to prevent timezone conversion
    };

    const result = await this.db.insert('categories', category);
    
    return await this.getCategoryById(result.insertId);
  }

  // Update category
  async updateCategory(categoryId, updateData) {
    // Check if category exists
    const existingCategory = await this.getCategoryById(categoryId);
    if (!existingCategory) {
      throw new NotFoundError('Category not found');
    }

    // Check if new name conflicts with existing categories (excluding current)
    if (updateData.name) {
      const nameConflict = await this.db.findOne(
        'SELECT category_id FROM categories WHERE name = ? AND category_id != ?',
        [updateData.name, categoryId]
      );

      if (nameConflict) {
        throw new ConflictError('Category name already exists');
      }
    }

    // Prepare update data
    const allowedFields = ['name', 'description', 'color_code', 'is_active'];
    const filteredData = {};

    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        filteredData[field] = updateData[field];
      }
    });

    if (Object.keys(filteredData).length === 0) {
      throw new ValidationError('No valid fields to update');
    }

    filteredData.updated_at = new Date();

    const result = await this.db.update(
      'categories',
      filteredData,
      'category_id = ?',
      [categoryId]
    );

    if (result.affectedRows === 0) {
      throw new NotFoundError('Category not found');
    }

    return await this.getCategoryById(categoryId);
  }

  // Delete category (soft delete by setting deleted_at timestamp)
  async deleteCategory(categoryId, options = {}) {
    const { forceDelete = false, cascadeSubcategories = false } = options;

    // Check if category exists and is not already deleted
    const existingCategory = await this.getCategoryById(categoryId);
    if (!existingCategory || existingCategory.deleted_at) {
      throw new NotFoundError('Category not found or already deleted');
    }

    // Get detailed subcategory information
    const subcategoriesInfo = await this.db.query(
      `SELECT subcategory_id, name, is_active, deleted_at
       FROM subcategories
       WHERE category_id = ? AND deleted_at IS NULL`,
      [categoryId]
    );

    const activeSubcategories = subcategoriesInfo.filter(sub => sub.is_active === 1);
    const inactiveSubcategories = subcategoriesInfo.filter(sub => sub.is_active === 0);

    // If there are active subcategories and no force/cascade options
    if (activeSubcategories.length > 0 && !forceDelete && !cascadeSubcategories) {
      const subcategoryNames = activeSubcategories.map(sub => sub.name).join(', ');
      throw new ValidationError(
        `Cannot delete category "${existingCategory.name}" because it has ${activeSubcategories.length} active subcategories: ${subcategoryNames}. ` +
        `Please either: 1) Delete these subcategories first, 2) Move them to another category, or 3) Use cascade deletion option.`,
        {
          code: 'CATEGORY_HAS_ACTIVE_SUBCATEGORIES',
          categoryId: categoryId,
          categoryName: existingCategory.name,
          activeSubcategories: activeSubcategories.map(sub => ({
            id: sub.subcategory_id,
            name: sub.name
          })),
          totalActiveSubcategories: activeSubcategories.length,
          totalInactiveSubcategories: inactiveSubcategories.length
        }
      );
    }

    // If cascade deletion is requested, soft delete all subcategories first
    if (cascadeSubcategories && subcategoriesInfo.length > 0) {
      await this.db.update(
        'subcategories',
        { deleted_at: new Date(), updated_at: new Date() },
        'category_id = ? AND deleted_at IS NULL',
        [categoryId]
      );
    }

    // Soft delete the category by setting deleted_at timestamp
    const result = await this.db.update(
      'categories',
      { deleted_at: new Date(), updated_at: new Date() },
      'category_id = ?',
      [categoryId]
    );

    if (result.affectedRows === 0) {
      throw new NotFoundError('Category not found');
    }

    return {
      success: true,
      deletedSubcategories: cascadeSubcategories ? subcategoriesInfo.length : 0,
      subcategoriesDeleted: cascadeSubcategories ? subcategoriesInfo.map(sub => sub.name) : []
    };
  }

  // Get category by ID
  async getCategoryById(categoryId) {
    const sql = `
      SELECT
        category_id,
        name,
        description,
        color_code,
        is_active,
        created_at,
        updated_at,
        deleted_at
      FROM categories
      WHERE category_id = ?
    `;
    return await this.db.findOne(sql, [categoryId]);
  }

  // Update category status
  async updateCategoryStatus(categoryId, isActive) {
    const result = await this.db.update(
      'categories',
      { is_active: isActive, updated_at: new Date() },
      'category_id = ?',
      [categoryId]
    );

    if (result.affectedRows === 0) {
      throw new NotFoundError('Category not found');
    }

    return true;
  }

  // Create subcategory
  async createSubcategory(subcategoryData) {
    // Validate required fields
    this.validateRequired(subcategoryData, ['name', 'category_id']);

    // Check if parent category exists and is active
    const parentCategory = await this.getCategoryById(subcategoryData.category_id);
    if (!parentCategory || !parentCategory.is_active) {
      throw new ValidationError('Parent category not found or inactive');
    }

    // Check if subcategory name already exists within the same category
    const existingSubcategory = await this.db.findOne(
      'SELECT subcategory_id FROM subcategories WHERE name = ? AND category_id = ?',
      [subcategoryData.name, subcategoryData.category_id]
    );

    if (existingSubcategory) {
      throw new ConflictError('Subcategory name already exists in this category');
    }

    // Get next display order if not provided
    let displayOrder = subcategoryData.display_order;
    if (displayOrder === undefined || displayOrder === null) {
      const maxOrder = await this.db.findOne(
        'SELECT COALESCE(MAX(display_order), 0) as max_order FROM subcategories WHERE category_id = ?',
        [subcategoryData.category_id]
      );
      displayOrder = maxOrder.max_order + 1;
    }

    // Prepare subcategory data
    const subcategory = {
      name: subcategoryData.name,
      category_id: subcategoryData.category_id,
      description: subcategoryData.description || null,
      color_code: subcategoryData.color_code || parentCategory.color_code,
      display_order: displayOrder,
      is_active: subcategoryData.is_active !== undefined ? subcategoryData.is_active : true,
      created_at: new Date().toISOString(), // FIX: Use UTC string to prevent timezone conversion
      updated_at: new Date().toISOString(), // FIX: Use UTC string to prevent timezone conversion
    };

    const result = await this.db.insert('subcategories', subcategory);
    
    return await this.getSubcategoryById(result.insertId);
  }

  // Update subcategory
  async updateSubcategory(subcategoryId, updateData) {
    // Check if subcategory exists
    const existingSubcategory = await this.getSubcategoryById(subcategoryId);
    if (!existingSubcategory) {
      throw new NotFoundError('Subcategory not found');
    }

    // If category_id is being updated, check if new parent category exists
    if (updateData.category_id) {
      const parentCategory = await this.getCategoryById(updateData.category_id);
      if (!parentCategory || !parentCategory.is_active) {
        throw new ValidationError('Parent category not found or inactive');
      }
    }

    // Check if new name conflicts within the same category
    if (updateData.name) {
      const categoryId = updateData.category_id || existingSubcategory.category_id;
      const nameConflict = await this.db.findOne(
        'SELECT subcategory_id FROM subcategories WHERE name = ? AND category_id = ? AND subcategory_id != ?',
        [updateData.name, categoryId, subcategoryId]
      );

      if (nameConflict) {
        throw new ConflictError('Subcategory name already exists in this category');
      }
    }

    // Prepare update data
    const allowedFields = ['name', 'category_id', 'description', 'color_code', 'display_order', 'is_active'];
    const filteredData = {};

    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        filteredData[field] = updateData[field];
      }
    });

    if (Object.keys(filteredData).length === 0) {
      throw new ValidationError('No valid fields to update');
    }

    filteredData.updated_at = new Date();

    const result = await this.db.update(
      'subcategories',
      filteredData,
      'subcategory_id = ?',
      [subcategoryId]
    );

    if (result.affectedRows === 0) {
      throw new NotFoundError('Subcategory not found');
    }

    return await this.getSubcategoryById(subcategoryId);
  }

  // Delete subcategory (soft delete by setting deleted_at timestamp)
  async deleteSubcategory(subcategoryId) {
    // Check if subcategory exists and is not already deleted
    const existingSubcategory = await this.getSubcategoryById(subcategoryId);
    if (!existingSubcategory || existingSubcategory.deleted_at) {
      throw new NotFoundError('Subcategory not found or already deleted');
    }

    // Soft delete by setting deleted_at timestamp
    const result = await this.db.update(
      'subcategories',
      { deleted_at: new Date(), updated_at: new Date() },
      'subcategory_id = ?',
      [subcategoryId]
    );

    if (result.affectedRows === 0) {
      throw new NotFoundError('Subcategory not found');
    }

    return true;
  }

  // Get subcategory by ID
  async getSubcategoryById(subcategoryId) {
    const sql = `
      SELECT 
        s.*,
        c.name as category_name,
        c.color_code as category_color
      FROM subcategories s
      LEFT JOIN categories c ON s.category_id = c.category_id
      WHERE s.subcategory_id = ?
    `;
    return await this.db.findOne(sql, [subcategoryId]);
  }

  // Update subcategory status
  async updateSubcategoryStatus(subcategoryId, isActive) {
    const result = await this.db.update(
      'subcategories',
      { is_active: isActive, updated_at: new Date() },
      'subcategory_id = ?',
      [subcategoryId]
    );

    if (result.affectedRows === 0) {
      throw new NotFoundError('Subcategory not found');
    }

    return true;
  }

  // Update subcategory order
  async updateSubcategoryOrder(subcategoryId, displayOrder) {
    const result = await this.db.update(
      'subcategories',
      { display_order: displayOrder, updated_at: new Date() },
      'subcategory_id = ?',
      [subcategoryId]
    );

    if (result.affectedRows === 0) {
      throw new NotFoundError('Subcategory not found');
    }

    return true;
  }

  // Get archived categories (soft-deleted)
  async getArchivedCategories(page = 1, limit = 10) {
    const offset = (page - 1) * limit;

    const sql = `
      SELECT
        category_id,
        name,
        description,
        color_code,
        is_active,
        created_at,
        updated_at,
        deleted_at
      FROM categories
      WHERE deleted_at IS NOT NULL
      ORDER BY deleted_at DESC
      LIMIT ? OFFSET ?
    `;

    const countSql = `
      SELECT COUNT(*) as total
      FROM categories
      WHERE deleted_at IS NOT NULL
    `;

    const [categories, countResult] = await Promise.all([
      this.db.query(sql, [limit, offset]),
      this.db.findOne(countSql)
    ]);

    return {
      categories,
      pagination: {
        page,
        limit,
        total: countResult.total,
        totalPages: Math.ceil(countResult.total / limit),
        hasNext: page < Math.ceil(countResult.total / limit),
        hasPrev: page > 1
      }
    };
  }

  // Get archived subcategories (soft-deleted)
  async getArchivedSubcategories(page = 1, limit = 10) {
    const offset = (page - 1) * limit;

    const sql = `
      SELECT
        s.*,
        c.name as category_name,
        c.color_code as category_color
      FROM subcategories s
      LEFT JOIN categories c ON s.category_id = c.category_id
      WHERE s.deleted_at IS NOT NULL
      ORDER BY s.deleted_at DESC
      LIMIT ? OFFSET ?
    `;

    const countSql = `
      SELECT COUNT(*) as total
      FROM subcategories
      WHERE deleted_at IS NOT NULL
    `;

    const [subcategories, countResult] = await Promise.all([
      this.db.query(sql, [limit, offset]),
      this.db.findOne(countSql)
    ]);

    return {
      subcategories,
      pagination: {
        page,
        limit,
        total: countResult.total,
        totalPages: Math.ceil(countResult.total / limit),
        hasNext: page < Math.ceil(countResult.total / limit),
        hasPrev: page > 1
      }
    };
  }

  // Restore soft-deleted category
  async restoreCategory(categoryId) {
    // Check if category exists and is soft-deleted
    const category = await this.db.findOne(
      'SELECT * FROM categories WHERE category_id = ?',
      [categoryId]
    );

    if (!category) {
      throw new NotFoundError('Category not found');
    }

    if (!category.deleted_at) {
      throw new ValidationError('Category is not deleted and cannot be restored');
    }

    // Restore the category by setting deleted_at to null
    const result = await this.db.update(
      'categories',
      { deleted_at: null, updated_at: new Date() },
      'category_id = ?',
      [categoryId]
    );

    if (result.affectedRows === 0) {
      throw new NotFoundError('Category not found');
    }

    return { restored: true, category_id: categoryId };
  }

  // Restore soft-deleted subcategory
  async restoreSubcategory(subcategoryId) {
    // Check if subcategory exists and is soft-deleted
    const subcategory = await this.db.findOne(
      'SELECT * FROM subcategories WHERE subcategory_id = ?',
      [subcategoryId]
    );

    if (!subcategory) {
      throw new NotFoundError('Subcategory not found');
    }

    if (!subcategory.deleted_at) {
      throw new ValidationError('Subcategory is not deleted and cannot be restored');
    }

    // Check if parent category is active and not deleted
    const parentCategory = await this.db.findOne(
      'SELECT * FROM categories WHERE category_id = ?',
      [subcategory.category_id]
    );

    if (!parentCategory || parentCategory.deleted_at) {
      throw new ValidationError('Cannot restore subcategory: parent category is deleted or not found');
    }

    // Restore the subcategory by setting deleted_at to null
    const result = await this.db.update(
      'subcategories',
      { deleted_at: null, updated_at: new Date() },
      'subcategory_id = ?',
      [subcategoryId]
    );

    if (result.affectedRows === 0) {
      throw new NotFoundError('Subcategory not found');
    }

    return { restored: true, subcategory_id: subcategoryId };
  }
}

module.exports = new CategoryModel();
