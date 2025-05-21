import { v4 as uuidv4 } from 'uuid';
import validator from 'validator';
import sanitizeHtml from 'sanitize-html';
import slugify from 'slugify';
import { sessionManager } from '../utils/sessionManager.js';

/**
 * Validates menu item data
 * @param {Object} data - Menu item data to validate
 * @param {Object} db - PouchDB instance for menu items
 * @param {Object} categoriesDB - PouchDB instance for categories
 * @param {Object} ingredientsDB - PouchDB instance for ingredients
 * @param {Object} restaurantsDB - PouchDB instance for restaurants
 * @param {Object} branchesDB - PouchDB instance for branches
 * @param {boolean} isUpdate - Whether this is an update operation
 * @returns {Promise} - Validation result
 */
const validateMenuItem = async (data, db, categoriesDB, ingredientsDB, restaurantsDB, branchesDB, isUpdate = false) => {
  const errors = [];
  const sanitizedData = {
    name: sanitizeHtml(data.name || ''),
    description: data.description ? sanitizeHtml(data.description) : '',
    price: {
      regular: Number.isFinite(data.price?.regular) ? Number(data.price.regular) : undefined,
      large: Number.isFinite(data.price?.large) ? Number(data.price.large) : undefined,
      special: Number.isFinite(data.price?.special) ? Number(data.price.special) : undefined,
    },
    categoryId: data.categoryId ? sanitizeHtml(data.categoryId) : '',
    restaurantId: data.restaurantId ? sanitizeHtml(data.restaurantId) : '',
    branchId: data.branchId ? sanitizeHtml(data.branchId) : '',
    availability: data.availability || { isAvailable: true, customHours: [] },
    ingredients: Array.isArray(data.ingredients) ? data.ingredients : [],
    imageUrl: data.imageUrl ? sanitizeHtml(data.imageUrl) : undefined,
    allergens: Array.isArray(data.allergens) ? data.allergens.map(a => sanitizeHtml(a)) : [],
    nutritionalInfo: {
      calories: Number.isFinite(data.nutritionalInfo?.calories) ? Number(data.nutritionalInfo.calories) : undefined,
      protein: Number.isFinite(data.nutritionalInfo?.protein) ? Number(data.nutritionalInfo.protein) : undefined,
      carbs: Number.isFinite(data.nutritionalInfo?.carbs) ? Number(data.nutritionalInfo.carbs) : undefined,
      fat: Number.isFinite(data.nutritionalInfo?.fat) ? Number(data.nutritionalInfo.fat) : undefined,
      fiber: Number.isFinite(data.nutritionalInfo?.fiber) ? Number(data.nutritionalInfo.fiber) : undefined,
    },
    tags: Array.isArray(data.tags) ? data.tags.map(t => sanitizeHtml(t)) : [],
    isActive: typeof data.isActive === 'boolean' ? data.isActive : true,
  };

  // Validate name
  if (!sanitizedData.name || !validator.isLength(sanitizedData.name, { min: 1, max: 100 })) {
    errors.push('Menu item name is required and must be 1-100 characters');
  } else if (!isUpdate) {
    try {
      const result = await db.find({
        selector: { 
          type: 'menuItem', 
          name: sanitizedData.name,
          restaurantId: sanitizedData.restaurantId,
          branchId: sanitizedData.branchId 
        },
        limit: 1,
      });
      if (result.docs.length > 0) {
        errors.push('Menu item name already exists for this restaurant and branch');
      }
    } catch (error) {
      console.error('Error checking menu item name uniqueness:', error);
      errors.push('Unable to validate menu item name uniqueness');
    }
  }

  // Validate price
  if (!Number.isFinite(sanitizedData.price.regular) || sanitizedData.price.regular <= 0) {
    errors.push('Regular price is required and must be a positive number');
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

  // Validate restaurant
  if (!sanitizedData.restaurantId) {
    errors.push('Restaurant ID is required');
  } else {
    try {
      const restaurant = await restaurantsDB.get(sanitizedData.restaurantId).catch(() => null);
      if (!restaurant) {
        errors.push('Invalid restaurant ID');
      }
    } catch (error) {
      console.error('Error validating restaurant ID:', error);
      errors.push('Unable to validate restaurant ID');
    }
  }

  // Validate branch
  if (!sanitizedData.branchId) {
    errors.push('Branch ID is required');
  } else {
    try {
      const branch = await branchesDB.get(sanitizedData.branchId).catch(() => null);
      if (!branch || branch.restaurantId !== sanitizedData.restaurantId) {
        errors.push('Invalid branch ID or branch does not belong to the specified restaurant');
      }
    } catch (error) {
      console.error('Error validating branch ID:', error);
      errors.push('Unable to validate branch ID');
    }
  }

  // Validate availability
  if (!sanitizedData.availability.isAvailable && 
      (!Array.isArray(sanitizedData.availability.customHours) || 
       sanitizedData.availability.customHours.length === 0)) {
    errors.push('Custom hours are required when item is not always available');
  } else if (Array.isArray(sanitizedData.availability.customHours)) {
    for (const hour of sanitizedData.availability.customHours) {
      if (!Number.isInteger(hour.dayOfWeek) || hour.dayOfWeek < 0 || hour.dayOfWeek > 6) {
        errors.push('Invalid day of week in availability schedule');
      }
      if (!validator.isTime(hour.startTime) || !validator.isTime(hour.endTime)) {
        errors.push('Invalid time format in availability schedule');
      }
    }
  }

  // Validate ingredients
  if (sanitizedData.ingredients.length > 0) {
    for (const ingredient of sanitizedData.ingredients) {
      if (!ingredient.ingredientId) {
        errors.push('Ingredient ID is required for each ingredient');
        continue;
      }
      try {
        const ing = await ingredientsDB.get(ingredient.ingredientId).catch(() => null);
        if (!ing || !ing.isActive) {
          errors.push(`Invalid or inactive ingredient ID: ${ingredient.ingredientId}`);
        }
      } catch (error) {
        console.error(`Error validating ingredient ID ${ingredient.ingredientId}:`, error);
        errors.push('Unable to validate ingredient ID');
      }
      if (!Number.isFinite(ingredient.quantity) || ingredient.quantity <= 0) {
        errors.push('Ingredient quantity must be a positive number');
      }
      if (!ingredient.unit || !validator.isLength(ingredient.unit, { min: 1, max: 50 })) {
        errors.push('Ingredient unit is required and must be 1-50 characters');
      }
    }
  }

  // Validate imageUrl
  if (sanitizedData.imageUrl && !validator.isURL(sanitizedData.imageUrl)) {
    errors.push('Invalid image URL format');
  }

  // Validate nutritional info
  if (Number.isFinite(sanitizedData.nutritionalInfo.calories) && sanitizedData.nutritionalInfo.calories < 0) {
    errors.push('Calories must be non-negative');
  }
  if (Number.isFinite(sanitizedData.nutritionalInfo.protein) && sanitizedData.nutritionalInfo.protein < 0) {
    errors.push('Protein must be non-negative');
  }
  if (Number.isFinite(sanitizedData.nutritionalInfo.carbs) && sanitizedData.nutritionalInfo.carbs < 0) {
    errors.push('Carbohydrates must be non-negative');
  }
  if (Number.isFinite(sanitizedData.nutritionalInfo.fat) && sanitizedData.nutritionalInfo.fat < 0) {
    errors.push('Fat must be non-negative');
  }
  if (Number.isFinite(sanitizedData.nutritionalInfo.fiber) && sanitizedData.nutritionalInfo.fiber < 0) {
    errors.push('Fiber must be non-negative');
  }

  return { isValid: errors.length === 0, errors, sanitizedData };
};

/**
 * Registers Socket.IO event handlers for menu items
 */
export const registerSocketEvents = (socket, { 
  db, 
  categoriesDB, 
  ingredientsDB, 
  restaurantsDB, 
  branchesDB,
  sessionDB,
  logsDB 
}) => {
  if (!db || !categoriesDB || !ingredientsDB || !restaurantsDB || !branchesDB || !sessionDB || !logsDB) {
    console.error('Missing required database dependencies for menu item routes');
    return;
  }

  // Create menu item
  socket.on('menuItem:create', async (data, callback) => {
    console.log('Creating menu item:', data);
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
      const validation = await validateMenuItem(
        data, 
        db, 
        categoriesDB, 
        ingredientsDB,
        restaurantsDB,
        branchesDB
      );

      if (!validation.isValid) {
        console.error('Menu item validation failed:', validation.errors);
        return callback?.({
          success: false,
          message: 'Validation failed',
          errors: validation.errors
        });
      }

      // Create menu item document
      const menuItem = {
        _id: `menuItem_${uuidv4()}`,
        type: 'menuItem',
        ...validation.sanitizedData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Save to database
      await db.put(menuItem);
      console.log('Menu item created:', menuItem._id);

      // Log the action
      await logsDB.put({
        _id: `log_${uuidv4()}`,
        type: 'log',
        category: 'menuItem',
        action: 'create',
        menuItemId: menuItem._id,
        restaurantId: data.restaurantId,
        branchId: data.branchId,
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `Menu item created: ${menuItem.name}`
      });

      // Emit event to other clients
      socket.broadcast.emit('menuItem:created', menuItem);

      // Send success response
      callback?.({
        success: true,
        message: 'Menu item created successfully',
        data: menuItem
      });

    } catch (error) {
      console.error('Error creating menu item:', error);
      
      // Log error
      try {
        await logsDB.put({
          _id: `log_${uuidv4()}`,
          type: 'log',
          category: 'menuItem',
          action: 'create',
          error: error.message,
          timestamp: new Date().toISOString(),
          level: 'error',
          message: `Failed to create menu item: ${error.message}`
        });
      } catch (logError) {
        console.error('Failed to log error:', logError);
      }

      callback?.({
        success: false,
        message: 'Failed to create menu item',
        error: error.message
      });
    }
  });

  // Get menu items by category
  socket.on('menuItem:getByCategory', async ({ categoryId, restaurantId, branchId, sessionId }, callback) => {
    console.log('Getting menu items by category:', { categoryId, restaurantId, branchId });
    
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
        type: 'menuItem',
        isActive: true,
        categoryId
      };

      if (restaurantId) selector.restaurantId = restaurantId;
      if (branchId) selector.branchId = branchId;

      // Get menu items
      const result = await db.find({
        selector,
        use_index: ['type', 'categoryId', 'isActive']
      });

      // Sort in memory
      const sortedDocs = result.docs.sort((a, b) => {
        // First sort by displayOrder if available
        if (a.displayOrder !== b.displayOrder) {
          return (a.displayOrder || 0) - (b.displayOrder || 0);
        }
        // Then sort by name
        return a.name.localeCompare(b.name);
      });

      callback?.({
        success: true,
        data: sortedDocs
      });

    } catch (error) {
      console.error('Error getting menu items by category:', error);
      callback?.({
        success: false,
        message: 'Failed to get menu items',
        error: error.message
      });
    }
  });

  // ...additional socket event handlers...
}

// HTTP route plugin
export default async function menuRoutes(fastify, options) {
  // Register routes
  fastify.get('/api/menu/items', async (request, reply) => {
    try {
      const items = await request.databases.menuItemsDB.allDocs({ include_docs: true });
      return items.rows.map(row => row.doc);
    } catch (error) {
      reply.status(500).send({ error: error.message });
    }
  });

  fastify.get('/api/menu/items/:id', async (request, reply) => {
    try {
      const item = await request.databases.menuItemsDB.get(request.params.id);
      return item;
    } catch (error) {
      reply.status(404).send({ error: 'Menu item not found' });
    }
  });

  fastify.post('/api/menu/items', async (request, reply) => {
    try {
      const result = await request.databases.menuItemsDB.post(request.body);
      return { id: result.id, ...request.body };
    } catch (error) {
      reply.status(500).send({ error: error.message });
    }
  });
}