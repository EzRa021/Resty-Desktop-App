import { v4 as uuidv4 } from 'uuid';
import validator from 'validator';
import sanitizeHtml from 'sanitize-html';

// Validation function for Restaurant (unchanged)
const validateRestaurant = async (data, db) => {
  const errors = [];

  const sanitizedData = {
    name: sanitizeHtml(data.name || ''),
    isBranchMultiple: data.isBranchMultiple,
    contact: {
      phone: data.contact?.phone ? sanitizeHtml(data.contact.phone) : undefined,
      email: data.contact?.email ? sanitizeHtml(data.contact.email) : undefined,
    },
    logo: data.logo ? sanitizeHtml(data.logo) : undefined,
  };

  if (
    !sanitizedData.name ||
    !validator.isLength(sanitizedData.name, { min: 1, max: 100 })
  ) {
    errors.push('Restaurant name is required and must be 1-100 characters');
  } else {
    const result = await db.find({
      selector: { type: 'restaurant', name: sanitizedData.name },
      limit: 1,
    });
    if (result.docs.length > 0) {
      errors.push('Restaurant name already exists');
    }
  }

  if (typeof sanitizedData.isBranchMultiple !== 'boolean') {
    errors.push('isBranchMultiple must be a boolean');
  }

  if (
    sanitizedData.contact.phone &&
    !validator.isMobilePhone(sanitizedData.contact.phone, 'any')
  ) {
    errors.push('Invalid contact phone number format');
  }

  if (
    sanitizedData.contact.email &&
    !validator.isEmail(sanitizedData.contact.email)
  ) {
    errors.push('Invalid contact email format');
  }

  if (sanitizedData.logo && !validator.isBase64(sanitizedData.logo)) {
    errors.push('Invalid logo base64 string');
  }

  return { isValid: errors.length === 0, errors, sanitizedData };
};

// Socket.IO event handlers
export const registerSocketEvents = (socket, options) => {
  const { db } = options;

  // Create Restaurant
  socket.on('restaurant:create', async ({ name, isBranchMultiple, contact, logo }, callback) => {
    try {
      const validation = await validateRestaurant(
        { name, isBranchMultiple, contact, logo },
        db
      );
      if (!validation.isValid) {
        return callback({
          success: false,
          message: 'Validation failed',
          errors: validation.errors,
        });
      }

      const { sanitizedData } = validation;

      const restaurant = {
        _id: uuidv4(),
        type: 'restaurant',
        name: sanitizedData.name,
        isBranchMultiple: sanitizedData.isBranchMultiple,
        contact: sanitizedData.contact,
        logo: sanitizedData.logo,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await db.put(restaurant);

      // Emit real-time update
      socket.broadcast.emit('restaurant:created', restaurant);

      callback({
        success: true,
        message: 'Restaurant created successfully',
        restaurant,
      });
    } catch (error) {
      console.error('Create restaurant error:', error);
      callback({
        success: false,
        message: 'Internal server error',
      });
    }
  });

  // Get All Restaurants
  socket.on('restaurant:getAll', async (callback) => {
    try {
      const result = await db.find({
        selector: { type: 'restaurant' },
        sort: [{ name: 'asc' }]
      });

      callback({
        success: true,
        restaurants: result.docs,
        count: result.docs.length
      });
    } catch (error) {
      console.error('Get all restaurants error:', error);
      callback({
        success: false,
        message: 'Internal server error'
      });
    }
  });

  // Get Restaurant by ID
  socket.on('restaurant:get', async ({ id }, callback) => {
    try {
      const restaurant = await db.get(id);
      if (restaurant.type !== 'restaurant') {
        throw new Error('Invalid restaurant ID');
      }

      callback({
        success: true,
        restaurant
      });
    } catch (error) {
      console.error('Get restaurant error:', error);
      callback({
        success: false,
        message: error.message === 'Invalid restaurant ID' ? error.message : 'Internal server error'
      });
    }
  });

  // Update Restaurant
  socket.on('restaurant:update', async ({ id, updateData }, callback) => {
    try {
      const existingRestaurant = await db.get(id);
      if (existingRestaurant.type !== 'restaurant') {
        throw new Error('Invalid restaurant ID');
      }

      const validation = await validateRestaurant(updateData, db);
      if (!validation.isValid) {
        return callback({
          success: false,
          message: 'Validation failed',
          errors: validation.errors
        });
      }

      const { sanitizedData } = validation;
      const updatedRestaurant = {
        ...existingRestaurant,
        name: sanitizedData.name,
        isBranchMultiple: sanitizedData.isBranchMultiple,
        contact: sanitizedData.contact,
        logo: sanitizedData.logo,
        updatedAt: new Date().toISOString()
      };

      await db.put(updatedRestaurant);

      // Emit real-time update
      socket.broadcast.emit('restaurant:updated', updatedRestaurant);

      callback({
        success: true,
        message: 'Restaurant updated successfully',
        restaurant: updatedRestaurant
      });
    } catch (error) {
      console.error('Update restaurant error:', error);
      callback({
        success: false,
        message: error.message === 'Invalid restaurant ID' ? error.message : 'Internal server error'
      });
    }
  });

  // Delete Restaurant
  socket.on('restaurant:delete', async ({ id }, callback) => {
    try {
      const restaurant = await db.get(id);
      if (restaurant.type !== 'restaurant') {
        throw new Error('Invalid restaurant ID');
      }

      await db.remove(restaurant);

      // Emit real-time update
      socket.broadcast.emit('restaurant:deleted', { id });

      callback({
        success: true,
        message: 'Restaurant deleted successfully'
      });
    } catch (error) {
      console.error('Delete restaurant error:', error);
      callback({
        success: false,
        message: error.message === 'Invalid restaurant ID' ? error.message : 'Internal server error'
      });
    }
  });
};