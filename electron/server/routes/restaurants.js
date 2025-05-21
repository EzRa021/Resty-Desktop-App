import { v4 as uuidv4 } from 'uuid';
import validator from 'validator';
import sanitizeHtml from 'sanitize-html';

// Validation function for Restaurant (unchanged)
const validateRestaurant = async (data, db, isUpdate = false) => {
  const errors = [];
  const sanitizedData = {
    name: sanitizeHtml(data.name || ''),
    description: data.description ? sanitizeHtml(data.description) : '',
    cuisine: data.cuisine ? sanitizeHtml(data.cuisine) : '',
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
      website: data.contactInfo?.website ? sanitizeHtml(data.contactInfo.website) : '',
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
    errors.push('Restaurant name is required and must be 1-100 characters');
  } else if (!isUpdate) {
    try {
      const result = await db.find({
        selector: { 
          type: 'restaurant', 
          name: sanitizedData.name 
        },
        limit: 1,
      });
      if (result.docs.length > 0) {
        errors.push('Restaurant name already exists');
      }
    } catch (error) {
      console.error('Error checking restaurant name uniqueness:', error);
      errors.push('Unable to validate restaurant name uniqueness');
    }
  }

  // Validate cuisine
  if (!sanitizedData.cuisine || !validator.isLength(sanitizedData.cuisine, { min: 1, max: 50 })) {
    errors.push('Cuisine is required and must be 1-50 characters');
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
  if (sanitizedData.contactInfo.website && !validator.isURL(sanitizedData.contactInfo.website)) {
    errors.push('Invalid website URL format');
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

      const validation = await validateRestaurant(updateData, db, true);
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