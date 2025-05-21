import { v4 as uuidv4 } from 'uuid';
import validator from 'validator';
import sanitizeHtml from 'sanitize-html';
import { validateUserSession } from '../utils/sessionManager.js';

// Validation function for Branch (unchanged)
const validateBranch = async (data, db, restaurantsDB, isUpdate = false) => {
  const errors = [];
  const sanitizedData = {
    name: sanitizeHtml(data.name || ''),
    restaurantId: data.restaurantId ? sanitizeHtml(data.restaurantId) : '',
    address: data.address ? {
      street: sanitizeHtml(data.address.street || ''),
      city: sanitizeHtml(data.address.city || ''),
      state: sanitizeHtml(data.address.state || ''),
      zipCode: sanitizeHtml(data.address.zipCode || ''),
      country: sanitizeHtml(data.address.country || ''),
    } : undefined,
    contactInfo: {
      phone: data.contactInfo?.phone ? sanitizeHtml(data.contactInfo.phone) : '',
      email: data.contactInfo?.email ? sanitizeHtml(data.contactInfo.email) : '',
    },
    operatingHours: data.operatingHours || {
      monday: { open: '09:00', close: '17:00' },
      tuesday: { open: '09:00', close: '17:00' },
      wednesday: { open: '09:00', close: '17:00' },
      thursday: { open: '09:00', close: '17:00' },
      friday: { open: '09:00', close: '17:00' },
      saturday: { open: '09:00', close: '17:00' },
      sunday: { open: '09:00', close: '17:00' },
    },
    isActive: typeof data.isActive === 'boolean' ? data.isActive : true,
  };

  // Validate name
  if (!sanitizedData.name || !validator.isLength(sanitizedData.name, { min: 1, max: 100 })) {
    errors.push('Branch name is required and must be 1-100 characters');
  } else if (!isUpdate) {
    try {
      const result = await db.find({
        selector: { 
          type: 'branch', 
          name: sanitizedData.name,
          restaurantId: sanitizedData.restaurantId 
        },
        limit: 1,
      });
      if (result.docs.length > 0) {
        errors.push('Branch name already exists for this restaurant');
      }
    } catch (error) {
      console.error('Error checking branch name uniqueness:', error);
      errors.push('Unable to validate branch name uniqueness');
    }
  }

  // Validate restaurant
  if (!sanitizedData.restaurantId) {
    errors.push('Restaurant ID is required');
  } else {
    try {
      const restaurant = await restaurantsDB.get(sanitizedData.restaurantId).catch(() => null);
      if (!restaurant || !restaurant.isActive) {
        errors.push('Invalid or inactive restaurant ID');
      }
    } catch (error) {
      console.error('Error validating restaurant ID:', error);
      errors.push('Unable to validate restaurant ID');
    }
  }

  // Validate address
  if (!sanitizedData.address) {
    errors.push('Address is required');
  } else {
    if (!sanitizedData.address.street) {
      errors.push('Street address is required');
    }
    if (!sanitizedData.address.city) {
      errors.push('City is required');
    }
    if (!sanitizedData.address.state) {
      errors.push('State is required');
    }
    if (!sanitizedData.address.zipCode) {
      errors.push('ZIP code is required');
    }
    if (!sanitizedData.address.country) {
      errors.push('Country is required');
    }
  }

  // Validate contact info
  if (sanitizedData.contactInfo.phone && !validator.isMobilePhone(sanitizedData.contactInfo.phone, 'any')) {
    errors.push('Invalid phone number format');
  }
  if (sanitizedData.contactInfo.email && !validator.isEmail(sanitizedData.contactInfo.email)) {
    errors.push('Invalid email format');
  }

  // Validate operating hours
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  for (const day of days) {
    const hours = sanitizedData.operatingHours[day];
    if (!hours || !hours.open || !hours.close) {
      errors.push(`Operating hours for ${day} are required`);
    } else {
      if (!validator.isTime(hours.open)) {
        errors.push(`Invalid opening time format for ${day}`);
      }
      if (!validator.isTime(hours.close)) {
        errors.push(`Invalid closing time format for ${day}`);
      }
    }
  }

  return { isValid: errors.length === 0, errors, sanitizedData };
};

/**
 * Registers Socket.IO event handlers for branches
 */
export const registerSocketEvents = (socket, { 
  db, 
  restaurantsDB, 
  sessionDB 
}) => {
  if (!db || !restaurantsDB || !sessionDB) {
    console.error('Missing required database dependencies for branch routes');
    return;
  }

  // Create index for createdAt field to support sorting
  db.createIndex({
    index: {
      fields: ['type', 'restaurantId', 'createdAt']
    }
  }).then(function (result) {
    console.log('Successfully created index for branch queries:', result);
  }).catch(function (err) {
    console.error('Error creating index for branch queries:', err);
  });

  // Create branch
  socket.on('branches:create', async (data, callback) => {
    try {
      // Validate session
      const sessionValidation = await validateUserSession(socket.id, sessionDB);
      if (!sessionValidation.valid) {
        return callback?.({ success: false, error: 'Unauthorized' });
      }
      
      // Validate input data
      const validation = await validateBranch(data, db, restaurantsDB);
      if (!validation.isValid) {
        return callback?.({ success: false, errors: validation.errors });
      }
  
      const branch = {
        _id: uuidv4(),
        type: 'branch',
        ...validation.sanitizedData,
        restaurantId: data.restaurantId,
        createdAt: new Date().toISOString(),
        createdBy: sessionValidation.user._id
      };

      await db.put(branch);
      callback?.({ success: true, branch });

    } catch (error) {
      console.error('Error creating branch:', error);
      callback?.({ success: false, error: 'Failed to create branch' });
    }
  });

  // Get all branches for a restaurant
  socket.on('branches:getAll', async (data, callback) => {
    try {
      // Validate input data
      const { restaurantId } = data;
      if (!restaurantId) {
        console.error('Restaurant ID is required');
        return callback({ error: "Restaurant ID is required" });
      }

      // Validate restaurant exists
      const restaurant = await restaurantsDB.get(restaurantId).catch(() => null);
      if (!restaurant) {
        console.error('Restaurant not found:', restaurantId);
        return callback({ error: "Restaurant not found" });
      }
    
      // Query branches with proper error handling and using the correct index
      let result;
      try {
        result = await db.find({
          selector: {
            type: "branch",
            restaurantId: restaurantId,
            _deleted: { $exists: false }
          },
          // Use the index we created that includes these fields
          use_index: ['type', 'restaurantId', 'createdAt'],
          sort: [{ createdAt: "desc" }]
        });
      } catch (dbError) {
        console.error('Database error while fetching branches:', dbError);
        
        // Fallback: If sorting fails, just fetch all branches without sorting
        try {
          result = await db.find({
            selector: {
              type: "branch",
              restaurantId: restaurantId,
              _deleted: { $exists: false }
            }
          });
          
          // Manual sorting in memory since we couldn't do it in the database
          if (result && Array.isArray(result.docs)) {
            result.docs.sort((a, b) => {
              return new Date(b.createdAt) - new Date(a.createdAt);
            });
          }
        } catch (fallbackError) {
          console.error('Fallback query also failed:', fallbackError);
          return callback({ error: "Failed to fetch branches from database" });
        }
      }

      // Validate and process results
      if (!result || !Array.isArray(result.docs)) {
        console.error('Invalid database response format');
        return callback({ error: "Invalid response format from database" });
      }

      console.log(`Found ${result.docs.length} branches for restaurant ${restaurantId}`);
      return callback({ 
        success: true,
        branches: result.docs,
        total: result.docs.length
      });

    } catch (error) {
      console.error('Unexpected error in branches:getAll:', error);
      return callback({ 
        error: "An unexpected error occurred while fetching branches",
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  // Delete branch
  socket.on('branches:delete', async (data, callback) => {
    try {
      // Validate session
      const sessionValidation = await validateUserSession(socket.id, sessionDB);
      if (!sessionValidation.valid) {
        return callback?.({ success: false, error: 'Unauthorized' });
      }

      // Get the branch
      const branch = await db.get(data.branchId).catch(() => null);
      if (!branch) {
        callback?.({ success: false, error: 'Branch not found' });
        return;
      }

      // Validate restaurant ownership
      const restaurant = await restaurantsDB.get(branch.restaurantId).catch(() => null);
      if (!restaurant) {
        callback?.({ success: false, error: 'Not authorized to delete this branch' });
        return;
      }

      // Check if this is the last branch
      const branches = await db.find({
        selector: {
          type: 'branch',
          restaurantId: branch.restaurantId
        }
      });

      if (branches.docs.length === 1) {
        callback?.({ success: false, error: 'Cannot delete the last branch of a restaurant' });
        return;
      }

      // Delete the branch
      await db.remove(branch);
      callback?.({ success: true });

    } catch (error) {
      console.error('Error deleting branch:', error);
      callback?.({ success: false, error: 'Failed to delete branch' });
    }
  });

  // Get branch by ID
  socket.on('branches:get', async (data, callback) => {
    try {
      // Validate session
      const sessionValidation = await validateUserSession(socket.id, sessionDB);
      if (!sessionValidation.valid) {
        return callback?.({ success: false, error: 'Unauthorized' });
      }

      const branch = await db.get(data.branchId).catch(() => null);
      if (!branch) {
        callback?.({ success: false, error: 'Branch not found' });
        return;
      }

      // Validate restaurant ownership
      const restaurant = await restaurantsDB.get(branch.restaurantId).catch(() => null);
      if (!restaurant) {
        callback?.({ success: false, error: 'Not authorized to view this branch' });
        return;
      }

      callback?.({ success: true, branch });

    } catch (error) {
      console.error('Error fetching branch:', error);
      callback?.({ success: false, error: 'Failed to fetch branch' });
    }
  });
};