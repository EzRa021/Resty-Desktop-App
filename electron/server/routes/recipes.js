import { v4 as uuidv4 } from 'uuid';
import validator from 'validator';
import sanitizeHtml from 'sanitize-html';
import slugify from 'slugify';
import { validateUserSession } from './utils.js';

/**
 * Validates recipe data
 * @param {Object} data - Recipe data to validate
 * @param {Object} db - PouchDB instance for recipes
 * @param {Object} menuItemsDB - PouchDB instance for menu items
 * @param {Object} ingredientsDB - PouchDB instance for ingredients
 * @param {Object} restaurantsDB - PouchDB instance for restaurants
 * @param {Object} branchesDB - PouchDB instance for branches
 * @param {boolean} isUpdate - Whether this is an update operation
 * @returns {Promise} - Validation result
 */
const validateRecipe = async (data, db, menuItemsDB, ingredientsDB, restaurantsDB, branchesDB, isUpdate = false) => {
  const errors = [];
  const sanitizedData = {
    name: sanitizeHtml(data.name || ''),
    restaurantId: data.restaurantId ? sanitizeHtml(data.restaurantId) : '',
    branchId: data.branchId ? sanitizeHtml(data.branchId) : '',
    menuItemId: data.menuItemId ? sanitizeHtml(data.menuItemId) : undefined,
    version: Number.isInteger(data.version) ? data.version : 1,
    ingredients: Array.isArray(data.ingredients) ? data.ingredients : [],
    preparationInstructions: data.preparationInstructions ? sanitizeHtml(data.preparationInstructions) : '',
    preparationTime: Number.isFinite(data.preparationTime) ? Number(data.preparationTime) : undefined,
    yield: Number.isFinite(data.yield) ? Number(data.yield) : undefined,
    isActive: typeof data.isActive === 'boolean' ? data.isActive : true,
  };

  // Validate name
  if (!sanitizedData.name || !validator.isLength(sanitizedData.name, { min: 1, max: 100 })) {
    errors.push('Recipe name is required and must be 1-100 characters');
  } else if (!isUpdate) {
    try {
      const result = await db.find({
        selector: { 
          type: 'recipe', 
          name: sanitizedData.name,
          restaurantId: sanitizedData.restaurantId,
          branchId: sanitizedData.branchId 
        },
        limit: 1,
      });
      if (result.docs.length > 0) {
        errors.push('Recipe name already exists for this restaurant and branch');
      }
    } catch (error) {
      console.error('Error checking recipe name uniqueness:', error);
      errors.push('Unable to validate recipe name uniqueness');
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

  // Validate menuItemId
  if (sanitizedData.menuItemId) {
    try {
      const menuItem = await menuItemsDB.get(sanitizedData.menuItemId).catch(() => null);
      if (!menuItem || !menuItem.isActive) {
        errors.push('Invalid or inactive menu item ID');
      }
    } catch (error) {
      console.error('Error validating menu item ID:', error);
      errors.push('Unable to validate menu item ID');
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

  // Validate preparationTime
  if (Number.isFinite(sanitizedData.preparationTime) && sanitizedData.preparationTime <= 0) {
    errors.push('Preparation time must be positive');
  }

  // Validate yield
  if (Number.isFinite(sanitizedData.yield) && sanitizedData.yield <= 0) {
    errors.push('Yield must be positive');
  }

  return { isValid: errors.length === 0, errors, sanitizedData };
};

/**
 * Calculates recipe cost per serving
 * @param {Array} ingredients - Recipe ingredients
 * @param {Object} ingredientsDB - PouchDB instance for ingredients
 * @param {string} inventoryMethod - FIFO or LIFO
 * @returns {Promise<Object>} - Cost calculation result
 */
const calculateRecipeCost = async (ingredients, ingredientsDB, inventoryMethod = 'FIFO') => {
  let totalCost = 0;
  let costBreakdown = [];
  let warnings = [];

  for (const ingredient of ingredients) {
    try {
      const ing = await ingredientsDB.get(ingredient.ingredientId);
      
      // Calculate cost based on inventory method
      let ingredientCost = 0;
      if (ing.cost) {
        if (inventoryMethod === 'FIFO' && ing.batches) {
          // Use oldest batch first
          const sortedBatches = [...ing.batches].sort((a, b) => 
            new Date(a.receivedDate) - new Date(b.receivedDate)
          );
          ingredientCost = sortedBatches[0]?.cost || ing.cost;
        } else if (inventoryMethod === 'LIFO' && ing.batches) {
          // Use newest batch first
          const sortedBatches = [...ing.batches].sort((a, b) => 
            new Date(b.receivedDate) - new Date(a.receivedDate)
          );
          ingredientCost = sortedBatches[0]?.cost || ing.cost;
        } else {
          ingredientCost = ing.cost;
        }
      }

      const ingredientTotalCost = ingredientCost * ingredient.quantity;
      totalCost += ingredientTotalCost;

      costBreakdown.push({
        ingredientId: ing._id,
        name: ing.name,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        unitCost: ingredientCost,
        totalCost: ingredientTotalCost
      });

      // Check for potential issues
      if (ing.stockLevel < ingredient.quantity) {
        warnings.push({
          type: 'low_stock',
          ingredientId: ing._id,
          name: ing.name,
          required: ingredient.quantity,
          available: ing.stockLevel,
          unit: ing.unit
        });
      }

      if (ing.batches) {
        const expiringBatches = ing.batches.filter(batch => 
          batch.expiryDate && 
          new Date(batch.expiryDate) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        );
        if (expiringBatches.length > 0) {
          warnings.push({
            type: 'expiring_ingredient',
            ingredientId: ing._id,
            name: ing.name,
            batches: expiringBatches
          });
        }
      }
    } catch (error) {
      console.error(`Error calculating cost for ingredient ${ingredient.ingredientId}:`, error);
      warnings.push({
        type: 'calculation_error',
        ingredientId: ingredient.ingredientId,
        error: error.message
      });
    }
  }

  return {
    totalCost,
    costBreakdown,
    warnings
  };
};

/**
 * Calculate nutritional information for a recipe
 * @param {Array} ingredients - Recipe ingredients
 * @param {Object} ingredientsDB - PouchDB instance for ingredients
 * @returns {Promise<Object>} - Nutritional information
 */
const calculateNutritionalInfo = async (ingredients, ingredientsDB) => {
  const nutritionalInfo = {
    calories: 0,
    protein: 0,
    carbohydrates: 0,
    fat: 0,
    fiber: 0,
    sodium: 0,
    sugar: 0,
    ingredients: []
  };

  for (const ingredient of ingredients) {
    try {
      const ing = await ingredientsDB.get(ingredient.ingredientId);
      if (ing.nutritionalInfo) {
        const factor = ingredient.quantity / (ing.servingSize || 1);
        nutritionalInfo.calories += (ing.nutritionalInfo.calories || 0) * factor;
        nutritionalInfo.protein += (ing.nutritionalInfo.protein || 0) * factor;
        nutritionalInfo.carbohydrates += (ing.nutritionalInfo.carbohydrates || 0) * factor;
        nutritionalInfo.fat += (ing.nutritionalInfo.fat || 0) * factor;
        nutritionalInfo.fiber += (ing.nutritionalInfo.fiber || 0) * factor;
        nutritionalInfo.sodium += (ing.nutritionalInfo.sodium || 0) * factor;
        nutritionalInfo.sugar += (ing.nutritionalInfo.sugar || 0) * factor;

        nutritionalInfo.ingredients.push({
          name: ing.name,
          quantity: ingredient.quantity,
          unit: ingredient.unit,
          nutritionalInfo: {
            calories: (ing.nutritionalInfo.calories || 0) * factor,
            protein: (ing.nutritionalInfo.protein || 0) * factor,
            carbohydrates: (ing.nutritionalInfo.carbohydrates || 0) * factor,
            fat: (ing.nutritionalInfo.fat || 0) * factor
          }
        });
      }
    } catch (error) {
      console.error(`Error calculating nutrition for ingredient ${ingredient.ingredientId}:`, error);
    }
  }

  return nutritionalInfo;
};

/**
 * Create a new recipe version
 * @param {Object} recipe - Current recipe
 * @param {Object} changes - Changes made to the recipe
 * @param {string} userId - User making the changes
 * @returns {Object} - New recipe version
 */
const createRecipeVersion = (recipe, changes, userId) => {
  const version = {
    _id: `recipe_version_${uuidv4()}`,
    type: 'recipeVersion',
    recipeId: recipe._id,
    version: recipe.version + 1,
    previousVersion: recipe.version,
    changes: {
      ingredients: changes.ingredients || [],
      preparationInstructions: changes.preparationInstructions,
      yield: changes.yield,
      cost: changes.cost,
      nutritionalInfo: changes.nutritionalInfo
    },
    changedBy: userId,
    changedAt: new Date().toISOString(),
    metadata: {
      reason: changes.reason || 'Regular update',
      impact: changes.impact || 'Minor'
    }
  };

  return version;
};

/**
 * Registers Socket.IO event handlers for recipes
 */
export const registerSocketEvents = (socket, { 
  db, 
  menuItemsDB, 
  ingredientsDB, 
  restaurantsDB, 
  branchesDB, 
  sessionDB 
}) => {
  if (!db || !menuItemsDB || !ingredientsDB || !restaurantsDB || !branchesDB || !sessionDB) {
    console.error('Missing required database dependencies for recipe routes');
    return;
  }

  // Create recipe
  socket.on('recipes:create', async (data, callback) => {
    try {
      const sessionValidation = await validateUserSession(socket, sessionDB);
      if (!sessionValidation.valid) {
        callback?.({ success: false, error: sessionValidation.message });
        return;
      }

      const validation = await validateRecipe(
        data, 
        db, 
        menuItemsDB, 
        ingredientsDB,
        restaurantsDB,
        branchesDB
      );

      if (!validation.isValid) {
        callback?.({ success: false, errors: validation.errors });
        return;
      }

      // Calculate recipe cost
      const costCalculation = await calculateRecipeCost(
        validation.sanitizedData.ingredients,
        ingredientsDB,
        data.inventoryMethod
      );

      const recipe = {
        _id: uuidv4(),
        type: 'recipe',
        ...validation.sanitizedData,
        costCalculation,
        costPerServing: costCalculation.totalCost / (validation.sanitizedData.yield || 1),
        createdAt: new Date().toISOString(),
        createdBy: sessionValidation.user._id
      };

      await db.put(recipe);
      callback?.({ 
        success: true, 
        recipe,
        warnings: costCalculation.warnings
      });

    } catch (error) {
      console.error('Error creating recipe:', error);
      callback?.({ success: false, error: 'Failed to create recipe' });
    }
  });

  // Get All Recipes
  socket.on('recipe:getAll', async ({ restaurantId, branchId, menuItemId, active, search, sort = 'name', order = 'asc' }, callback) => {
    try {
      if (!restaurantId || !branchId) {
        return callback({ success: false, message: 'Restaurant ID and Branch ID are required' });
      }

      const selector = {
        type: 'recipe',
        restaurantId,
        branchId,
        _deleted: { $exists: false },
      };

      if (menuItemId) {
        selector.menuItemId = menuItemId;
      }
      if (typeof active === 'boolean') {
        selector.isActive = active;
      }
      if (search) {
        selector.name = { $regex: new RegExp(search, 'i') };
      }

      const validSortFields = ['name', 'createdAt', 'costPerServing', 'isActive'];
      if (!validSortFields.includes(sort)) {
        return callback({
          success: false,
          message: `Invalid sort field. Must be one of: ${validSortFields.join(', ')}`,
        });
      }

      const sortDirective = {};
      sortDirective[sort] = order === 'desc' ? 'desc' : 'asc';

      const result = await db.find({
        selector,
        sort: [sortDirective],
      });

      callback({
        success: true,
        recipes: result.docs,
        total: result.docs.length,
      });
    } catch (error) {
      console.error('Get all recipes error:', error);
      callback({
        success: false,
        message: `Failed to fetch recipes: ${error.message}`,
      });
    }
  });

  // Get Recipe by ID
  socket.on('recipe:get', async ({ id }, callback) => {
    try {
      if (!id) {
        return callback({ success: false, message: 'Recipe ID is required' });
      }

      let recipe;
      try {
        recipe = await db.get(id);
      } catch (error) {
        return callback({ success: false, message: 'Recipe not found' });
      }

      if (recipe.type !== 'recipe' || recipe._deleted) {
        return callback({ success: false, message: 'Recipe not found' });
      }

      callback({
        success: true,
        recipe,
      });
    } catch (error) {
      console.error('Get recipe error:', error);
      callback({
        success: false,
        message: `Failed to get recipe: ${error.message}`,
      });
    }
  });

  // Update Recipe
  socket.on('recipe:update', async (recipeData, callback) => {
    try {
      if (!recipeData.id) {
        return callback({ success: false, message: 'Recipe ID is required' });
      }

      const sessionValidation = await validateUserSession(
        recipeData.sessionId,
        ['super-admin', 'admin', 'manager'],
        sessionDB
      );
      if (!sessionValidation.valid) {
        return callback({ success: false, message: sessionValidation.message });
      }
      const user = sessionValidation.user;

      let recipe;
      try {
        recipe = await db.get(recipeData.id);
        if (recipe.type !== 'recipe' || recipe._deleted) {
          return callback({ success: false, message: 'Recipe not found' });
        }
      } catch (error) {
        return callback({ success: false, message: 'Recipe not found' });
      }

      if (recipeData.restaurantId && recipeData.restaurantId !== recipe.restaurantId) {
        return callback({ success: false, message: 'Cannot change the restaurant ID of a recipe' });
      }
      if (recipeData.branchId && recipeData.branchId !== recipe.branchId) {
        return callback({ success: false, message: 'Cannot change the branch ID of a recipe' });
      }

      const updatedRecipeData = {
        ...recipeData,
        restaurantId: recipe.restaurantId,
        branchId: recipe.branchId,
        version: recipe.version + 1, // Increment version
      };

      const validation = await validateRecipe(updatedRecipeData, db, menuItemsDB, ingredientsDB, restaurantsDB, branchesDB, true);
      if (!validation.isValid) {
        return callback({
          success: false,
          message: 'Validation failed',
          errors: validation.errors,
        });
      }

      // Recalculate recipe cost
      const costCalculation = await calculateRecipeCost(
        validation.sanitizedData.ingredients,
        ingredientsDB,
        recipeData.inventoryMethod
      );

      const updatedRecipe = {
        ...recipe,
        name: validation.sanitizedData.name || recipe.name,
        slug: validation.sanitizedData.name ? slugify(validation.sanitizedData.name, { lower: true, strict: true }) : recipe.slug,
        menuItemId: validation.sanitizedData.menuItemId || recipe.menuItemId,
        version: validation.sanitizedData.version,
        ingredients: validation.sanitizedData.ingredients || recipe.ingredients,
        preparationInstructions: typeof validation.sanitizedData.preparationInstructions === 'string' ? validation.sanitizedData.preparationInstructions : recipe.preparationInstructions,
        preparationTime: Number.isFinite(validation.sanitizedData.preparationTime) ? validation.sanitizedData.preparationTime : recipe.preparationTime,
        yield: Number.isFinite(validation.sanitizedData.yield) ? validation.sanitizedData.yield : recipe.yield,
        costCalculation,
        costPerServing: costCalculation.totalCost / (validation.sanitizedData.yield || recipe.yield || 1),
        isActive: typeof validation.sanitizedData.isActive === 'boolean' ? validation.sanitizedData.isActive : recipe.isActive,
        nutritionalInfo: validation.sanitizedData.nutritionalInfo || recipe.nutritionalInfo,
        metadata: {
          ...recipe.metadata,
          updatedBy: user._id,
          updatedAt: new Date().toISOString(),
        },
      };

      await db.put(updatedRecipe);

      socket.emit('recipe:updated', updatedRecipe);
      socket.broadcast.emit('recipe:updated', updatedRecipe);

      callback({
        success: true,
        message: 'Recipe updated successfully',
        recipe: updatedRecipe,
        warnings: costCalculation.warnings
      });
    } catch (error) {
      console.error('Update recipe error:', error);
      callback({
        success: false,
        message: `Failed to update recipe: ${error.message}`,
      });
    }
  });

  // Delete Recipe
  socket.on('recipe:delete', async ({ id, sessionId }, callback) => {
    try {
      if (!id) {
        return callback({ success: false, message: 'Recipe ID is required' });
      }

      const sessionValidation = await validateUserSession(
        sessionId,
        ['super-admin', 'admin'],
        sessionDB
      );
      if (!sessionValidation.valid) {
        return callback({ success: false, message: sessionValidation.message });
      }
      const user = sessionValidation.user;

      let recipe;
      try {
        recipe = await db.get(id);
        if (recipe.type !== 'recipe' || recipe._deleted) {
          return callback({ success: false, message: 'Recipe not found' });
        }
      } catch (error) {
        return callback({ success: false, message: 'Recipe not found' });
      }

      const deletedRecipe = {
        ...recipe,
        isActive: false,
        _deleted: true,
        metadata: {
          ...recipe.metadata,
          updatedBy: user._id,
          updatedAt: new Date().toISOString(),
          deletedBy: user._id,
          deletedAt: new Date().toISOString(),
        },
      };

      await db.put(deletedRecipe);

      socket.emit('recipe:deleted', { id });
      socket.broadcast.emit('recipe:deleted', { id });

      callback({
        success: true,
        message: 'Recipe deleted successfully',
      });
    } catch (error) {
      console.error('Delete recipe error:', error);
      callback({
        success: false,
        message: `Failed to delete recipe: ${error.message}`,
      });
    }
  });

  // Check Recipe Availability
  socket.on('recipe:checkAvailability', async ({ id, restaurantId, branchId, scale = 1 }, callback) => {
    try {
      if (!id || !restaurantId || !branchId) {
        return callback({ success: false, message: 'Recipe ID, Restaurant ID, and Branch ID are required' });
      }
      if (!Number.isFinite(scale) || scale <= 0) {
        return callback({ success: false, message: 'Scale must be a positive number' });
      }

      let recipe;
      try {
        recipe = await db.get(id);
        if (recipe.type !== 'recipe' || recipe._deleted || !recipe.isActive) {
          return callback({ success: false, message: 'Recipe not found or not active' });
        }
      } catch (error) {
        return callback({ success: false, message: 'Recipe not found' });
      }

      if (recipe.restaurantId !== restaurantId || recipe.branchId !== branchId) {
        return callback({ success: false, message: 'Recipe does not belong to the specified restaurant or branch' });
      }

      let isAvailable = true;
      const unavailableIngredients = [];

      for (const ingredient of recipe.ingredients) {
        try {
          const ing = await ingredientsDB.get(ingredient.ingredientId);
          if (!ing.isActive || ing.stockLevel < ingredient.quantity * scale) {
            isAvailable = false;
            unavailableIngredients.push({
              id: ing._id,
              name: ing.name,
              required: ingredient.quantity * scale,
              available: ing.stockLevel,
            });
          }
        } catch (error) {
          isAvailable = false;
          unavailableIngredients.push({
            id: ingredient.ingredientId,
            name: 'Unknown',
            required: ingredient.quantity * scale,
            available: 0,
          });
        }
      }

      callback({
        success: true,
        isAvailable,
        unavailableIngredients,
      });
    } catch (error) {
      console.error('Check recipe availability error:', error);
      callback({
        success: false,
        message: `Failed to check availability: ${error.message}`,
      });
    }
  });

  // Scale Recipe
  socket.on('recipe:scale', async ({ id, scale, sessionId }, callback) => {
    try {
      if (!id || !Number.isFinite(scale) || scale <= 0) {
        return callback({ success: false, message: 'Recipe ID and positive scale are required' });
      }

      const sessionValidation = await validateUserSession(
        sessionId,
        ['super-admin', 'admin', 'manager'],
        sessionDB
      );
      if (!sessionValidation.valid) {
        return callback({ success: false, message: sessionValidation.message });
      }
      const user = sessionValidation.user;

      let recipe;
      try {
        recipe = await db.get(id);
        if (recipe.type !== 'recipe' || recipe._deleted) {
          return callback({ success: false, message: 'Recipe not found' });
        }
      } catch (error) {
        return callback({ success: false, message: 'Recipe not found' });
      }

      const scaledIngredients = recipe.ingredients.map(ingredient => ({
        ...ingredient,
        quantity: ingredient.quantity * scale,
      }));

      const costCalculation = await calculateRecipeCost(
        scaledIngredients,
        ingredientsDB,
        recipe.inventoryMethod
      );
      const scaledRecipe = {
        ...recipe,
        ingredients: scaledIngredients,
        yield: Number.isFinite(recipe.yield) ? recipe.yield * scale : recipe.yield,
        costCalculation,
        costPerServing: costCalculation.totalCost / (recipe.yield * scale || 1),
        version: recipe.version + 1,
        nutritionalInfo: recipe.nutritionalInfo,
        metadata: {
          ...recipe.metadata,
          updatedBy: user._id,
          updatedAt: new Date().toISOString(),
        },
      };

      await db.put(scaledRecipe);

      socket.emit('recipe:updated', scaledRecipe);
      socket.broadcast.emit('recipe:updated', scaledRecipe);

      callback({
        success: true,
        message: 'Recipe scaled successfully',
        recipe: scaledRecipe,
      });
    } catch (error) {
      console.error('Scale recipe error:', error);
      callback({
        success: false,
        message: `Failed to scale recipe: ${error.message}`,
      });
    }
  });

  // Add new socket events for recipe management
  socket.on('recipe:createVersion', async (data, callback) => {
    try {
      const sessionValidation = await validateUserSession(
        data.sessionId,
        ['owner', 'manager', 'admin'],
        sessionDB
      );

      if (!sessionValidation.valid) {
        return callback?.({
          success: false,
          message: sessionValidation.message
        });
      }

      // Get current recipe
      const recipe = await db.get(data.recipeId);
      
      // Calculate new nutritional info if ingredients changed
      let nutritionalInfo = recipe.nutritionalInfo;
      if (data.changes.ingredients) {
        nutritionalInfo = await calculateNutritionalInfo(
          data.changes.ingredients,
          ingredientsDB
        );
      }

      // Create new version
      const version = createRecipeVersion(recipe, {
        ...data.changes,
        nutritionalInfo
      }, sessionValidation.user._id);

      // Update recipe
      const updatedRecipe = {
        ...recipe,
        version: version.version,
        ingredients: data.changes.ingredients || recipe.ingredients,
        preparationInstructions: data.changes.preparationInstructions || recipe.preparationInstructions,
        yield: data.changes.yield || recipe.yield,
        nutritionalInfo,
        updatedAt: new Date().toISOString(),
        updatedBy: sessionValidation.user._id
      };

      // Save both documents
      await Promise.all([
        db.put(updatedRecipe),
        db.put(version)
      ]);

      callback?.({
        success: true,
        data: {
          recipe: updatedRecipe,
          version
        }
      });

    } catch (error) {
      console.error('Error creating recipe version:', error);
      callback?.({
        success: false,
        message: 'Failed to create recipe version',
        error: error.message
      });
    }
  });

  socket.on('recipe:getVersions', async (data, callback) => {
    try {
      const sessionValidation = await validateUserSession(
        data.sessionId,
        ['owner', 'manager', 'admin'],
        sessionDB
      );

      if (!sessionValidation.valid) {
        return callback?.({
          success: false,
          message: sessionValidation.message
        });
      }

      // Get all versions for the recipe
      const versions = await db.find({
        selector: {
          type: 'recipeVersion',
          recipeId: data.recipeId
        },
        sort: [{ version: 'desc' }]
      });

      callback?.({
        success: true,
        data: versions.docs
      });

    } catch (error) {
      console.error('Error getting recipe versions:', error);
      callback?.({
        success: false,
        message: 'Failed to get recipe versions',
        error: error.message
      });
    }
  });

  socket.on('recipe:getCostTrend', async (data, callback) => {
    try {
      const sessionValidation = await validateUserSession(
        data.sessionId,
        ['owner', 'manager', 'admin'],
        sessionDB
      );

      if (!sessionValidation.valid) {
        return callback?.({
          success: false,
          message: sessionValidation.message
        });
      }

      // Get all versions with cost information
      const versions = await db.find({
        selector: {
          type: 'recipeVersion',
          recipeId: data.recipeId,
          'changes.cost': { $exists: true }
        },
        sort: [{ changedAt: 'asc' }]
      });

      // Calculate cost trend
      const costTrend = versions.docs.map(version => ({
        version: version.version,
        date: version.changedAt,
        cost: version.changes.cost,
        costPerServing: version.changes.cost / (version.changes.yield || 1),
        changedBy: version.changedBy
      }));

      callback?.({
        success: true,
        data: costTrend
      });

    } catch (error) {
      console.error('Error getting recipe cost trend:', error);
      callback?.({
        success: false,
        message: 'Failed to get recipe cost trend',
        error: error.message
      });
    }
  });
}

// HTTP route plugin
export default async function recipeRoutes(fastify, options) {
  // Register routes
  fastify.get('/api/recipes', async (request, reply) => {
    try {
      const recipes = await request.databases.recipesDB.allDocs({ include_docs: true });
      return recipes.rows.map(row => row.doc);
    } catch (error) {
      reply.status(500).send({ error: error.message });
    }
  });

  fastify.get('/api/recipes/:id', async (request, reply) => {
    try {
      const recipe = await request.databases.recipesDB.get(request.params.id);
      return recipe;
    } catch (error) {
      reply.status(404).send({ error: 'Recipe not found' });
    }
  });

  fastify.post('/api/recipes', async (request, reply) => {
    try {
      const result = await request.databases.recipesDB.post(request.body);
      return { id: result.id, ...request.body };
    } catch (error) {
      reply.status(500).send({ error: error.message });
    }
  });
}