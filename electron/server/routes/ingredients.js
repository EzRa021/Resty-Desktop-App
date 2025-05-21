import { v4 as uuidv4 } from 'uuid';
import validator from 'validator';
import sanitizeHtml from 'sanitize-html';
import { validateUserSession } from './utils.js';

/**
 * Validates ingredient data
 * @param {Object} data - Ingredient data to validate
 * @param {Object} db - PouchDB instance for ingredients
 * @param {boolean} isUpdate - Whether this is an update operation
 * @returns {Promise} - Validation result
 */
const validateIngredient = async (data, db, isUpdate = false) => {
  const errors = [];
  const sanitizedData = {
    name: sanitizeHtml(data.name || ''),
    description: data.description ? sanitizeHtml(data.description) : '',
    unit: data.unit ? sanitizeHtml(data.unit) : '',
    cost: Number.isFinite(data.cost) ? Number(data.cost) : 0,
    stockLevel: Number.isFinite(data.stockLevel) ? Number(data.stockLevel) : 0,
    minimumStockLevel: Number.isFinite(data.minimumStockLevel) ? Number(data.minimumStockLevel) : 0,
    isActive: typeof data.isActive === 'boolean' ? data.isActive : true,
    allergens: Array.isArray(data.allergens) ? data.allergens.map(a => sanitizeHtml(a)) : [],
    nutritionalInfo: {
      calories: Number.isFinite(data.nutritionalInfo?.calories) ? Number(data.nutritionalInfo.calories) : undefined,
      protein: Number.isFinite(data.nutritionalInfo?.protein) ? Number(data.nutritionalInfo.protein) : undefined,
      carbs: Number.isFinite(data.nutritionalInfo?.carbs) ? Number(data.nutritionalInfo.carbs) : undefined,
      fat: Number.isFinite(data.nutritionalInfo?.fat) ? Number(data.nutritionalInfo.fat) : undefined,
      fiber: Number.isFinite(data.nutritionalInfo?.fiber) ? Number(data.nutritionalInfo.fiber) : undefined,
    },
  };

  // Validate name
  if (!sanitizedData.name || !validator.isLength(sanitizedData.name, { min: 1, max: 100 })) {
    errors.push('Ingredient name is required and must be 1-100 characters');
  } else if (!isUpdate) {
    try {
      const result = await db.find({
        selector: { 
          type: 'ingredient', 
          name: sanitizedData.name 
        },
        limit: 1,
      });
      if (result.docs.length > 0) {
        errors.push('Ingredient name already exists');
      }
    } catch (error) {
      console.error('Error checking ingredient name uniqueness:', error);
      errors.push('Unable to validate ingredient name uniqueness');
    }
  }

  // Validate unit
  if (!sanitizedData.unit || !validator.isLength(sanitizedData.unit, { min: 1, max: 50 })) {
    errors.push('Unit is required and must be 1-50 characters');
  }

  // Validate cost
  if (!Number.isFinite(sanitizedData.cost) || sanitizedData.cost < 0) {
    errors.push('Cost must be a non-negative number');
  }

  // Validate stock levels
  if (!Number.isFinite(sanitizedData.stockLevel) || sanitizedData.stockLevel < 0) {
    errors.push('Stock level must be a non-negative number');
  }
  if (!Number.isFinite(sanitizedData.minimumStockLevel) || sanitizedData.minimumStockLevel < 0) {
    errors.push('Minimum stock level must be a non-negative number');
  }
  if (sanitizedData.minimumStockLevel > sanitizedData.stockLevel) {
    errors.push('Minimum stock level cannot be greater than current stock level');
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
 * Registers Socket.IO event handlers for ingredients
 */
export const registerSocketEvents = (socket, { 
  db, 
  suppliersDB, 
  restaurantsDB, 
  branchesDB, 
  sessionDB 
}) => {
  if (!db || !suppliersDB || !restaurantsDB || !branchesDB || !sessionDB) {
    console.error('Missing required database dependencies for ingredient routes');
    return;
  }

  // Create ingredient
  socket.on('ingredients:create', async (data, callback) => {
    try {
      const sessionValidation = await validateUserSession(socket, sessionDB);
      if (!sessionValidation.valid) {
        callback?.({ success: false, error: sessionValidation.message });
        return;
      }

      const validation = await validateIngredient(data, db);
      if (!validation.isValid) {
        callback?.({ success: false, errors: validation.errors });
        return;
      }

      const ingredient = {
        _id: uuidv4(),
        type: 'ingredient',
        ...validation.sanitizedData,
        createdAt: new Date().toISOString(),
        createdBy: sessionValidation.user._id
      };

      await db.put(ingredient);
      callback?.({ success: true, ingredient });

    } catch (error) {
      console.error('Error creating ingredient:', error);
      callback?.({ success: false, error: 'Failed to create ingredient' });
    }
  });

  // ...additional socket event handlers...
}

// HTTP route plugin
export default async function ingredientRoutes(fastify, options) {
  // Register routes
  fastify.get('/api/ingredients', async (request, reply) => {
    try {
      const ingredients = await request.databases.ingredientsDB.allDocs({ include_docs: true });
      return ingredients.rows.map(row => row.doc);
    } catch (error) {
      reply.status(500).send({ error: error.message });
    }
  });

  fastify.get('/api/ingredients/:id', async (request, reply) => {
    try {
      const ingredient = await request.databases.ingredientsDB.get(request.params.id);
      return ingredient;
    } catch (error) {
      reply.status(404).send({ error: 'Ingredient not found' });
    }
  });

  fastify.post('/api/ingredients', async (request, reply) => {
    try {
      const result = await request.databases.ingredientsDB.post(request.body);
      return { id: result.id, ...request.body };
    } catch (error) {
      reply.status(500).send({ error: error.message });
    }
  });
}