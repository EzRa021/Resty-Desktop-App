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
    unit: sanitizeHtml(data.unit || ''),
    stockLevel: Number.isFinite(data.stockLevel) ? Number(data.stockLevel) : undefined,
    minimumThreshold: Number.isFinite(data.minimumThreshold) ? Number(data.minimumThreshold) : undefined,
    cost: Number.isFinite(data.cost) ? Number(data.cost) : undefined,
    supplierInfo: {
      name: data.supplierInfo?.name ? sanitizeHtml(data.supplierInfo.name) : undefined,
      contactPerson: data.supplierInfo?.contactPerson ? sanitizeHtml(data.supplierInfo.contactPerson) : undefined,
      email: data.supplierInfo?.email ? sanitizeHtml(data.supplierInfo.email) : undefined,
      phone: data.supplierInfo?.phone ? sanitizeHtml(data.supplierInfo.phone) : undefined,
      leadTime: Number.isFinite(data.supplierInfo?.leadTime) ? Number(data.supplierInfo.leadTime) : undefined,
    },
    batchInfo: Array.isArray(data.batchInfo) ? data.batchInfo : [],
    location: data.location ? sanitizeHtml(data.location) : undefined,
    category: data.category ? sanitizeHtml(data.category) : undefined,
    isActive: typeof data.isActive === 'boolean' ? data.isActive : true,
  };

  // Validate name
  if (!sanitizedData.name || !validator.isLength(sanitizedData.name, { min: 1, max: 100 })) {
    errors.push('Ingredient name is required and must be 1-100 characters');
  } else if (!isUpdate) {
    try {
      const result = await db.find({
        selector: { type: 'ingredient', name: sanitizedData.name },
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

  // Validate stockLevel
  if (!Number.isFinite(sanitizedData.stockLevel) || sanitizedData.stockLevel < 0) {
    errors.push('Stock level is required and must be non-negative');
  }

  // Validate minimumThreshold
  if (!Number.isFinite(sanitizedData.minimumThreshold) || sanitizedData.minimumThreshold < 0) {
    errors.push('Minimum threshold is required and must be non-negative');
  }

  // Validate cost
  if (Number.isFinite(sanitizedData.cost) && sanitizedData.cost < 0) {
    errors.push('Cost must be non-negative');
  }

  // Validate supplierInfo
  if (sanitizedData.supplierInfo.email && !validator.isEmail(sanitizedData.supplierInfo.email)) {
    errors.push('Invalid supplier email format');
  }
  if (sanitizedData.supplierInfo.phone && !validator.isMobilePhone(sanitizedData.supplierInfo.phone, 'any')) {
    errors.push('Invalid supplier phone number format');
  }
  if (Number.isFinite(sanitizedData.supplierInfo.leadTime) && sanitizedData.supplierInfo.leadTime < 0) {
    errors.push('Supplier lead time must be non-negative');
  }

  // Validate batchInfo
  if (sanitizedData.batchInfo.length > 0) {
    for (const batch of sanitizedData.batchInfo) {
      if (!batch.batchId) {
        errors.push('Batch ID is required for each batch');
      }
      if (!Number.isFinite(batch.quantity) || batch.quantity <= 0) {
        errors.push('Batch quantity must be a positive number');
      }
      if (batch.expiryDate && !validator.isISO8601(batch.expiryDate)) {
        errors.push('Invalid expiry date format');
      }
      if (batch.receivedDate && !validator.isISO8601(batch.receivedDate)) {
        errors.push('Invalid received date format');
      }
    }
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