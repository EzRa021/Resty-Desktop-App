import { v4 as uuidv4 } from 'uuid';
import validator from 'validator';
import sanitizeHtml from 'sanitize-html';
import { validateUserSession } from './utils.js';

const validateRecipeVersion = (data) => {
  const errors = [];
  const sanitizedData = {
    recipeId: data.recipeId,
    version: data.version || '1.0.0',
    name: sanitizeHtml(data.name || ''),
    description: sanitizeHtml(data.description || ''),
    ingredients: Array.isArray(data.ingredients) ? data.ingredients : [],
    instructions: Array.isArray(data.instructions) 
      ? data.instructions.map(step => sanitizeHtml(step))
      : [],
    notes: sanitizeHtml(data.notes || ''),
    status: data.status || 'draft',
    costPerServing: Number(data.costPerServing) || 0,
    preparationTime: Number(data.preparationTime) || 0,
    servingSize: Number(data.servingSize) || 1,
    allergens: Array.isArray(data.allergens) ? data.allergens : [],
    nutritionalInfo: data.nutritionalInfo || {},
    restaurantId: data.restaurantId,
    branchId: data.branchId
  };

  if (!sanitizedData.recipeId) {
    errors.push('Recipe ID is required');
  }

  if (!sanitizedData.name) {
    errors.push('Recipe version name is required');
  }

  if (sanitizedData.ingredients.length === 0) {
    errors.push('At least one ingredient is required');
  }

  if (sanitizedData.instructions.length === 0) {
    errors.push('At least one instruction step is required');
  }

  if (!['draft', 'review', 'active', 'archived'].includes(sanitizedData.status)) {
    errors.push('Invalid status');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData
  };
};

export const registerSocketEvents = (socket, {
  db: recipeVersionsDB,
  recipesDB,
  ingredientsDB,
  sessionDB,
  logsDB
}) => {
  if (!recipeVersionsDB || !recipesDB || !ingredientsDB || !sessionDB) {
    console.error('Missing required database dependencies for recipe versions routes');
    return;
  }

  // Create Recipe Version
  socket.on('recipeVersions:create', async (data, callback) => {
    try {
      // 1. Validate session and permissions
      const sessionValidation = await validateUserSession(
        data.sessionId,
        ['owner', 'manager', 'admin', 'kitchen'],
        sessionDB
      );

      if (!sessionValidation.valid) {
        return callback?.({
          success: false,
          message: sessionValidation.message
        });
      }

      // 2. Validate recipe exists
      const recipe = await recipesDB.get(data.recipeId);

      // 3. Get latest version number
      const versionsResult = await recipeVersionsDB.find({
        selector: {
          type: 'recipeVersion',
          recipeId: data.recipeId
        },
        sort: [{ version: 'desc' }],
        limit: 1
      });

      const latestVersion = versionsResult.docs[0]?.version || '0.0.0';
      const nextVersion = incrementVersion(latestVersion);

      // 4. Validate recipe version data
      const validationResult = validateRecipeVersion({
        ...data,
        version: nextVersion
      });

      if (!validationResult.isValid) {
        return callback?.({
          success: false,
          message: 'Validation failed',
          errors: validationResult.errors
        });
      }

      // 5. Calculate cost per serving
      let totalCost = 0;
      for (const ingredient of validationResult.sanitizedData.ingredients) {
        try {
          const ingredientDoc = await ingredientsDB.get(ingredient.ingredientId);
          totalCost += (ingredientDoc.cost || 0) * ingredient.quantity;
        } catch (error) {
          console.warn(`Could not calculate cost for ingredient ${ingredient.ingredientId}:`, error);
        }
      }

      const costPerServing = totalCost / validationResult.sanitizedData.servingSize;

      // 6. Create recipe version document
      const recipeVersion = {
        _id: `recipe_version_${uuidv4()}`,
        type: 'recipeVersion',
        ...validationResult.sanitizedData,
        costPerServing,
        createdBy: sessionValidation.user._id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // 7. Save to database
      await recipeVersionsDB.put(recipeVersion);

      // 8. Log the action
      await logsDB.put({
        _id: `log_${uuidv4()}`,
        type: 'log',
        category: 'recipeVersions',
        action: 'create',
        recipeId: recipe._id,
        versionId: recipeVersion._id,
        userId: sessionValidation.user._id,
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `New version ${recipeVersion.version} created for recipe ${recipe.name}`
      });

      // 9. Emit event to other clients
      socket.broadcast.emit('recipeVersions:created', recipeVersion);

      // 10. Send success response
      callback?.({
        success: true,
        message: 'Recipe version created successfully',
        data: recipeVersion
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

  // List Recipe Versions
  socket.on('recipeVersions:list', async (data, callback) => {
    try {
      // 1. Validate session
      const sessionValidation = await validateUserSession(
        data.sessionId,
        ['owner', 'manager', 'admin', 'kitchen'],
        sessionDB
      );

      if (!sessionValidation.valid) {
        return callback?.({
          success: false,
          message: sessionValidation.message
        });
      }

      // 2. Build query
      const query = {
        selector: {
          type: 'recipeVersion',
          recipeId: data.recipeId,
          status: data.status || { $exists: true }
        },
        sort: [{ version: 'desc' }],
        limit: data.limit || 50,
        skip: data.skip || 0
      };

      // 3. Execute query
      const result = await recipeVersionsDB.find(query);

      // 4. Get base recipe info
      const recipe = await recipesDB.get(data.recipeId);

      // 5. Send response
      callback?.({
        success: true,
        data: {
          recipe,
          versions: result.docs,
          total: result.docs.length,
          hasMore: result.docs.length === (data.limit || 50)
        }
      });

    } catch (error) {
      console.error('Error listing recipe versions:', error);
      callback?.({
        success: false,
        message: 'Failed to list recipe versions',
        error: error.message
      });
    }
  });

  // Activate Recipe Version
  socket.on('recipeVersions:activate', async (data, callback) => {
    try {
      // 1. Validate session
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

      // 2. Get version to activate
      const versionToActivate = await recipeVersionsDB.get(data.versionId);

      // 3. Deactivate current active version if exists
      const currentActiveResult = await recipeVersionsDB.find({
        selector: {
          type: 'recipeVersion',
          recipeId: versionToActivate.recipeId,
          status: 'active'
        }
      });

      if (currentActiveResult.docs.length > 0) {
        const currentActive = currentActiveResult.docs[0];
        await recipeVersionsDB.put({
          ...currentActive,
          status: 'archived',
          updatedAt: new Date().toISOString(),
          updatedBy: sessionValidation.user._id
        });
      }

      // 4. Activate new version
      const activatedVersion = {
        ...versionToActivate,
        status: 'active',
        updatedAt: new Date().toISOString(),
        updatedBy: sessionValidation.user._id
      };

      await recipeVersionsDB.put(activatedVersion);

      // 5. Update base recipe with new version info
      const recipe = await recipesDB.get(versionToActivate.recipeId);
      const updatedRecipe = {
        ...recipe,
        currentVersion: activatedVersion.version,
        ingredients: activatedVersion.ingredients,
        instructions: activatedVersion.instructions,
        costPerServing: activatedVersion.costPerServing,
        updatedAt: new Date().toISOString(),
        updatedBy: sessionValidation.user._id
      };

      await recipesDB.put(updatedRecipe);

      // 6. Log the action
      await logsDB.put({
        _id: `log_${uuidv4()}`,
        type: 'log',
        category: 'recipeVersions',
        action: 'activate',
        recipeId: recipe._id,
        versionId: activatedVersion._id,
        userId: sessionValidation.user._id,
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `Version ${activatedVersion.version} activated for recipe ${recipe.name}`
      });

      // 7. Emit events to other clients
      socket.broadcast.emit('recipeVersions:activated', {
        version: activatedVersion,
        recipe: updatedRecipe
      });

      // 8. Send success response
      callback?.({
        success: true,
        message: 'Recipe version activated successfully',
        data: {
          version: activatedVersion,
          recipe: updatedRecipe
        }
      });

    } catch (error) {
      console.error('Error activating recipe version:', error);
      callback?.({
        success: false,
        message: 'Failed to activate recipe version',
        error: error.message
      });
    }
  });
};

// Helper function to increment version number
function incrementVersion(version) {
  const [major, minor, patch] = version.split('.').map(Number);
  return `${major}.${minor}.${patch + 1}`;
}
