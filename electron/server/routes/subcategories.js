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

  try {
    // Get session document
    const session = await sessionDB.get(sessionId).catch(() => null);
    
    // If session not found in DB but starts with 'session_', treat as test session
    if (!session && sessionId.startsWith('session_')) {
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

    // Regular session validation
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
 * Validates subcategory data
 * @param {Object} data - Subcategory data to validate
 * @param {Object} db - PouchDB instance for subcategories
 * @param {Object} categoriesDB - PouchDB instance for categories
 * @param {Object} restaurantsDB - PouchDB instance for restaurants
 * @param {Object} branchesDB - PouchDB instance for branches
 * @param {boolean} isUpdate - Whether this is an update operation
 * @returns {Promise<Object>} - Validation result
 */
const validateSubcategory = async (data, db, categoriesDB, isUpdate = false) => {
  const errors = [];
  const sanitizedData = {
    name: sanitizeHtml(data.name || ''),
    description: data.description ? sanitizeHtml(data.description) : '',
    categoryId: data.categoryId ? sanitizeHtml(data.categoryId) : '',
    imageUrl: data.imageUrl ? sanitizeHtml(data.imageUrl) : undefined,
    isActive: typeof data.isActive === 'boolean' ? data.isActive : true,
    displayOrder: Number.isInteger(data.displayOrder) ? data.displayOrder : 0,
  };

  // Validate name
  if (!sanitizedData.name || !validator.isLength(sanitizedData.name, { min: 1, max: 100 })) {
    errors.push('Subcategory name is required and must be 1-100 characters');
  } else if (!isUpdate) {
    try {
      const result = await db.find({
        selector: { 
          type: 'subcategory', 
          name: sanitizedData.name,
          categoryId: sanitizedData.categoryId 
        },
        limit: 1,
      });
      if (result.docs.length > 0) {
        errors.push('Subcategory name already exists for this category');
      }
    } catch (error) {
      console.error('Error checking subcategory name uniqueness:', error);
      errors.push('Unable to validate subcategory name uniqueness');
    }
  }

  // Validate category
  if (!sanitizedData.categoryId) {
    errors.push('Category ID is required');
  } else {
    try {
      const category = await categoriesDB.get(sanitizedData.categoryId).catch(() => null);
      if (!category || !category.isActive) {
        errors.push('Invalid or inactive category ID');
      }
    } catch (error) {
      console.error('Error validating category ID:', error);
      errors.push('Unable to validate category ID');
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
 * Registers Socket.IO event handlers for subcategories
 * @param {Object} socket - Socket.IO socket instance
 * @param {Object} options - Options containing DB instances
 */
export const registerSocketEvents = (socket, { 
  db: subcategoriesDB, 
  categoriesDB,
  restaurantsDB,
  branchesDB,
  sessionDB,
  logsDB 
}) => {
  if (!subcategoriesDB || !categoriesDB || !sessionDB) {
    console.error('Missing required database dependencies for subcategory routes');
    return;
  }

  socket.on('subcategory:create', async (data, callback) => {
    console.log('Creating subcategory:', data);
    try {
      // Validate session using sessionManager
      const sessionValidation = await sessionManager.validateSession(sessionDB, data.sessionId, { logsDB });
      if (!sessionValidation.isValid) {
        console.error('Session validation failed:', sessionValidation.reason);
        return callback?.({
          success: false,
          message: sessionValidation.reason
        });
      }

      // Validate data
      const validationResult = await validateSubcategory(data, subcategoriesDB, categoriesDB, false);
      if (!validationResult.isValid) {
        console.error('Subcategory validation failed:', validationResult.errors);
        return callback?.({
          success: false,
          message: 'Validation failed',
          errors: validationResult.errors
        });
      }

      // Create subcategory document
      const subcategory = {
        _id: `subcategory_${uuidv4()}`,
        type: 'subcategory',
        ...validationResult.sanitizedData,
        slug: slugify(data.name, { lower: true }),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Save to database
      await subcategoriesDB.put(subcategory);
      console.log('Subcategory created:', subcategory._id);

      // Log the action
      await logsDB.put({
        _id: `log_${uuidv4()}`,
        type: 'log',
        category: 'subcategory',
        action: 'create',
        subcategoryId: subcategory._id,
        restaurantId: data.restaurantId,
        branchId: data.branchId,
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `Subcategory created: ${subcategory.name}`
      });

      // Emit event to other clients
      socket.broadcast.emit('subcategory:created', subcategory);

      // Send success response
      callback?.({
        success: true,
        message: 'Subcategory created successfully',
        data: subcategory
      });

    } catch (error) {
      console.error('Error creating subcategory:', error);
      callback?.({
        success: false,
        message: 'Failed to create subcategory',
        error: error.message
      });

      // Log error
      try {
        await logsDB.put({
          _id: `log_${uuidv4()}`,
          type: 'log',
          category: 'subcategory',
          action: 'create',
          error: error.message,
          timestamp: new Date().toISOString(),
          level: 'error',
          message: `Failed to create subcategory: ${error.message}`
        });
      } catch (logError) {
        console.error('Failed to log error:', logError);
      }
    }
  });

  // Get subcategories by category
  socket.on('subcategory:getByCategory', async ({ categoryId, restaurantId, branchId, sessionId }, callback) => {
    console.log('Getting subcategories by category:', { categoryId, restaurantId, branchId });
    
    try {
      // Validate session using sessionManager
      const sessionValidation = await sessionManager.validateSession(sessionDB, sessionId, { logsDB });
      if (!sessionValidation.isValid) {
        console.error('Session validation failed:', sessionValidation.reason);
        return callback?.({
          success: false,
          message: sessionValidation.reason
        });
      }

      // Build query
      const selector = {
        type: 'subcategory',
        isActive: true,
        categoryId
      };

      if (restaurantId) selector.restaurantId = restaurantId;
      if (branchId) selector.branchId = branchId;

      // Get subcategories
      const result = await subcategoriesDB.find({
        selector,
        use_index: ['type', 'categoryId', 'isActive']
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
      console.error('Error getting subcategories by category:', error);
      callback?.({
        success: false,
        message: 'Failed to get subcategories',
        error: error.message
      });
    }
  });

  // Add other subcategory events (update, delete, etc.) here...
};