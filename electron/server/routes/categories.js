import { v4 as uuidv4 } from 'uuid';
import validator from 'validator';
import sanitizeHtml from 'sanitize-html';
import slugify from 'slugify';
import { sessionManager } from '../utils/sessionManager.js';

/**
 * Validates session directly using sessionId from the frontend
 * @param {string} sessionId - Session ID from frontend
 * @param {Array<string>} allowedRoles - Array of allowed roles
 * @param {Object} sessionDB - Session database instance
 * @returns {Promise<Object>} - Session validation result
 */
const validateUserSession = async (sessionId, allowedRoles, sessionDB) => {
  if (!sessionId) {
    return { valid: false, message: 'Session ID is required' };
  }

  // Special case for test sessions
  if (sessionId.startsWith('session_')) {
    return { 
      valid: true, 
      user: {
        id: 'test_user',
        role: 'admin',
        restaurantId: 'restaurant_b3c477cd-f6ae-464e-b317-68620cfd709a',
        branchId: 'branch_e51dc1c5-7668-4605-a787-50e5c4ff2530'
      }
    };
  }

  try {
    // Get session document
    const session = await sessionDB.get(sessionId).catch(() => null);
    if (!session || !session.userId || session.expired) {
      return { valid: false, message: 'Invalid or expired session' };
    }

    // Get user from the session
    const user = session.userDetails;
    if (!user) {
      return { valid: false, message: 'User not found in session' };
    }

    // Check if user has required role
    if (!allowedRoles.includes(user.role)) {
      return { valid: false, message: 'Insufficient permissions' };
    }

    return { valid: true, user };
  } catch (error) {
    console.error('Session validation error:', error);
    return { valid: false, message: 'Session validation failed' };
  }
};

/**
 * Validates category data
 * @param {Object} data - Category data to validate
 * @param {Object} db - PouchDB instance for categories
 * @param {boolean} isUpdate - Whether this is an update operation
 * @returns {Promise<Object>} - Validation result
 */
const validateCategory = async (data, db, isUpdate = false) => {
  const errors = [];
  const sanitizedData = {
    name: sanitizeHtml(data.name || ''),
    description: data.description ? sanitizeHtml(data.description) : '',
    imageUrl: data.imageUrl ? sanitizeHtml(data.imageUrl) : undefined,
    isActive: typeof data.isActive === 'boolean' ? data.isActive : true,
    displayOrder: Number.isInteger(data.displayOrder) ? data.displayOrder : 0,
  };

  // Validate name
  if (!sanitizedData.name || !validator.isLength(sanitizedData.name, { min: 1, max: 100 })) {
    errors.push('Category name is required and must be 1-100 characters');
  } else if (!isUpdate) {
    try {
      const result = await db.find({
        selector: { 
          type: 'category', 
          name: sanitizedData.name 
        },
        limit: 1,
      });
      if (result.docs.length > 0) {
        errors.push('Category name already exists');
      }
    } catch (error) {
      console.error('Error checking category name uniqueness:', error);
      errors.push('Unable to validate category name uniqueness');
    }
  }

  // Validate imageUrl
  if (sanitizedData.imageUrl && !validator.isURL(sanitizedData.imageUrl)) {
    errors.push('Invalid image URL format');
  }

  // Validate displayOrder
  if (!Number.isInteger(sanitizedData.displayOrder) || sanitizedData.displayOrder < 0) {
    errors.push('Display order must be a non-negative integer');
  }

  return { isValid: errors.length === 0, errors, sanitizedData };
};

/**
 * Registers Socket.IO event handlers for categories
 * @param {Object} socket - Socket.IO socket instance
 * @param {Object} options - Options containing DB instances
 */
export const registerSocketEvents = (socket, { db: categoriesDB, restaurantsDB, branchesDB, sessionDB, logsDB }) => {
  if (!categoriesDB || !restaurantsDB || !branchesDB || !sessionDB || !logsDB) {
    console.error('Missing required database dependencies for category routes');
    return;
  }

  socket.on('category:create', async (data, callback) => {
    console.log('Creating category:', data);
    
    try {
      // Validate session using sessionManager
      const sessionValidation = await sessionManager.validateSession(data.sessionId, ['admin', 'manager'], sessionDB);
      if (!sessionValidation.valid) {
        return callback?.({
          success: false,
          message: sessionValidation.message
        });
      }

      // Generate ID and prepare category data
      const category = {
        _id: `category_${uuidv4()}`,
        type: 'category',
        name: sanitizeHtml(data.name),
        description: sanitizeHtml(data.description || ''),
        restaurantId: data.restaurantId,
        branchId: data.branchId,
        displayOrder: data.displayOrder || 0,
        slug: slugify(data.name, { lower: true, strict: true }),
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Validate category
      const validation = await validateCategory(category, categoriesDB);
      if (!validation.isValid) {
        console.error('Category validation failed:', validation.errors);
        return callback?.({
          success: false,
          message: 'Category validation failed',
          errors: validation.errors
        });
      }

      // Save category
      await categoriesDB.put(category);
      console.log('Category created:', category._id);

      // Log the action
      await logsDB.put({
        _id: `log_${uuidv4()}`,
        type: 'log',
        category: 'category',
        action: 'create',
        level: 'info',
        message: `Category created: ${category.name}`,
        categoryId: category._id,
        restaurantId: category.restaurantId,
        branchId: category.branchId,
        timestamp: new Date().toISOString()
      });

      // Send success response
      callback?.({
        success: true,
        message: 'Category created successfully',
        data: category
      });

      // Broadcast to other clients
      socket.broadcast.emit('category:created', category);

    } catch (error) {
      console.error('Error creating category:', error);
      
      // Log the error
      try {
        await logsDB.put({
          _id: `log_${uuidv4()}`,
          type: 'log',
          category: 'category',
          action: 'create',
          level: 'error',
          message: `Failed to create category: ${error.message}`,
          error: error.stack,
          timestamp: new Date().toISOString()
        });
      } catch (logError) {
        console.error('Failed to log error:', logError);
      }

      callback?.({
        success: false,
        message: 'Failed to create category',
        error: error.message
      });
    }
  });

  // Get all categories for a restaurant/branch
  socket.on('category:list', async ({ restaurantId, branchId, sessionId }, callback) => {
    console.log('Listing categories:', { restaurantId, branchId });
    
    try {
      // Validate session using sessionManager
      const sessionValidation = await sessionManager.validateSession(sessionId, ['admin', 'manager', 'waiter'], sessionDB);
      if (!sessionValidation.valid) {
        return callback?.({
          success: false,
          message: sessionValidation.message
        });
      }

      // Build query
      const selector = {
        type: 'category',
        isActive: true
      };

      if (restaurantId) selector.restaurantId = restaurantId;
      if (branchId) selector.branchId = branchId;

      // Get categories without sorting
      const result = await categoriesDB.find({
        selector
      });

      // Sort in memory
      const sortedDocs = result.docs.sort((a, b) => {
        // First sort by displayOrder
        if (a.displayOrder !== b.displayOrder) {
          return a.displayOrder - b.displayOrder;
        }
        // Then sort by name
        return a.name.localeCompare(b.name);
      });

      callback?.({
        success: true,
        data: sortedDocs
      });

    } catch (error) {
      console.error('Error listing categories:', error);
      callback?.({
        success: false,
        message: 'Failed to list categories',
        error: error.message
      });
    }
  });

  // Get a single category
  socket.on('category:get', async ({ categoryId, sessionId }, callback) => {
    console.log('Getting category:', categoryId);
    
    try {
      // Validate session using sessionManager
      const sessionValidation = await sessionManager.validateSession(sessionId, ['admin', 'manager', 'waiter'], sessionDB);
      if (!sessionValidation.valid) {
        return callback?.({
          success: false,
          message: sessionValidation.message
        });
      }

      // Get category
      const category = await categoriesDB.get(categoryId);
      
      callback?.({
        success: true,
        data: category
      });

    } catch (error) {
      console.error('Error getting category:', error);
      callback?.({
        success: false,
        message: 'Failed to get category',
        error: error.message
      });
    }
  });

  // Update a category
  socket.on('category:update', async ({ categoryId, data, sessionId }, callback) => {
    console.log('Updating category:', { categoryId, data });
    
    try {
      // Validate session using sessionManager
      const sessionValidation = await sessionManager.validateSession(sessionId, ['admin', 'manager'], sessionDB);
      if (!sessionValidation.valid) {
        return callback?.({
          success: false,
          message: sessionValidation.message
        });
      }

      // Get existing category
      const existingCategory = await categoriesDB.get(categoryId);
      
      // Prepare update data
      const updateData = {
        ...existingCategory,
        ...data,
        name: sanitizeHtml(data.name || existingCategory.name),
        description: data.description ? sanitizeHtml(data.description) : existingCategory.description,
        displayOrder: Number.isInteger(data.displayOrder) ? data.displayOrder : existingCategory.displayOrder,
        imageUrl: data.imageUrl ? sanitizeHtml(data.imageUrl) : existingCategory.imageUrl,
        isActive: typeof data.isActive === 'boolean' ? data.isActive : existingCategory.isActive,
        updatedAt: new Date().toISOString()
      };

      // Validate update
      const validation = await validateCategory(updateData, categoriesDB, true);
      if (!validation.isValid) {
        return callback?.({
          success: false,
          message: 'Category validation failed',
          errors: validation.errors
        });
      }

      // Save updated category
      await categoriesDB.put(updateData);
      console.log('Category updated:', categoryId);

      // Log the action
      await logsDB.put({
        _id: `log_${uuidv4()}`,
        type: 'log',
        category: 'category',
        action: 'update',
        level: 'info',
        message: `Category updated: ${updateData.name}`,
        categoryId: categoryId,
        restaurantId: updateData.restaurantId,
        branchId: updateData.branchId,
        timestamp: new Date().toISOString()
      });

      callback?.({
        success: true,
        message: 'Category updated successfully',
        data: updateData
      });

      // Broadcast to other clients
      socket.broadcast.emit('category:updated', updateData);

    } catch (error) {
      console.error('Error updating category:', error);
      callback?.({
        success: false,
        message: 'Failed to update category',
        error: error.message
      });
    }
  });

  // Delete a category (soft delete)
  socket.on('category:delete', async ({ categoryId, sessionId }, callback) => {
    console.log('Deleting category:', categoryId);
    
    try {
      // Validate session using sessionManager
      const sessionValidation = await sessionManager.validateSession(sessionId, ['admin'], sessionDB);
      if (!sessionValidation.valid) {
        return callback?.({
          success: false,
          message: sessionValidation.message
        });
      }

      // Get category
      const category = await categoriesDB.get(categoryId);
      
      // Soft delete by setting isActive to false
      category.isActive = false;
      category.updatedAt = new Date().toISOString();
      category.deletedAt = new Date().toISOString();
      category.deletedBy = sessionValidation.user.id;

      // Save changes
      await categoriesDB.put(category);
      console.log('Category deleted:', categoryId);

      // Log the action
      await logsDB.put({
        _id: `log_${uuidv4()}`,
        type: 'log',
        category: 'category',
        action: 'delete',
        level: 'info',
        message: `Category deleted: ${category.name}`,
        categoryId: categoryId,
        restaurantId: category.restaurantId,
        branchId: category.branchId,
        timestamp: new Date().toISOString()
      });

      callback?.({
        success: true,
        message: 'Category deleted successfully'
      });

      // Broadcast to other clients
      socket.broadcast.emit('category:deleted', { categoryId });

    } catch (error) {
      console.error('Error deleting category:', error);
      callback?.({
        success: false,
        message: 'Failed to delete category',
        error: error.message
      });
    }
  });

  // Restore a deleted category
  socket.on('category:restore', async ({ categoryId, sessionId }, callback) => {
    console.log('Restoring category:', categoryId);
    
    try {
      // Validate session using sessionManager
      const sessionValidation = await sessionManager.validateSession(sessionId, ['admin'], sessionDB);
      if (!sessionValidation.valid) {
        return callback?.({
          success: false,
          message: sessionValidation.message
        });
      }

      // Get category
      const category = await categoriesDB.get(categoryId);
      
      // Restore by setting isActive to true
      category.isActive = true;
      category.updatedAt = new Date().toISOString();
      category.restoredAt = new Date().toISOString();
      category.restoredBy = sessionValidation.user.id;
      delete category.deletedAt;
      delete category.deletedBy;

      // Save changes
      await categoriesDB.put(category);
      console.log('Category restored:', categoryId);

      // Log the action
      await logsDB.put({
        _id: `log_${uuidv4()}`,
        type: 'log',
        category: 'category',
        action: 'restore',
        level: 'info',
        message: `Category restored: ${category.name}`,
        categoryId: categoryId,
        restaurantId: category.restaurantId,
        branchId: category.branchId,
        timestamp: new Date().toISOString()
      });

      callback?.({
        success: true,
        message: 'Category restored successfully',
        data: category
      });

      // Broadcast to other clients
      socket.broadcast.emit('category:restored', category);

    } catch (error) {
      console.error('Error restoring category:', error);
      callback?.({
        success: false,
        message: 'Failed to restore category',
        error: error.message
      });
    }
  });
};