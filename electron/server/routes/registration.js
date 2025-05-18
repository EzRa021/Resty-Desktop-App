import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import validator from 'validator';
import sanitizeHtml from 'sanitize-html';

// Validation functions (unchanged)
async function validateUser(data, db) {
  if (!db || typeof db.find !== 'function') {
    console.error('Invalid users database object provided');
    return {
      isValid: false,
      errors: ['Database error: Unable to validate user'],
      sanitizedData: {},
    };
  }

  const errors = [];
  const sanitizedData = {
    email: sanitizeHtml(data.email || ''),
    password: data.password || '',
    name: sanitizeHtml(data.name || ''),
    phone: data.phone ? sanitizeHtml(data.phone) : undefined,
    restaurantId: data.restaurantId,
  };

  if (!sanitizedData.email || !validator.isEmail(sanitizedData.email)) {
    errors.push('Invalid email format');
  } else {
    try {
      const result = await db.find({
        selector: { type: 'user', email: sanitizedData.email },
        limit: 1,
      });
      if (result.docs.length > 0) {
        errors.push('Email already exists');
      }
    } catch (error) {
      console.error('Error checking user email uniqueness:', error);
      errors.push('Unable to validate email uniqueness');
    }
  }

  if (
    !sanitizedData.password ||
    !validator.isLength(sanitizedData.password, { min: 8 }) ||
    !/[a-zA-Z]/.test(sanitizedData.password) ||
    !/[0-9]/.test(sanitizedData.password)
  ) {
    errors.push('Password must be at least 8 characters with one letter and one number');
  }

  if (
    !sanitizedData.name ||
    !validator.isLength(sanitizedData.name, { min: 1, max: 100 })
  ) {
    errors.push('Name is required and must be 1-100 characters');
  }

  if (sanitizedData.phone) {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(sanitizedData.phone)) {
      errors.push('Invalid phone number format');
    }
  }

  return { isValid: errors.length === 0, errors, sanitizedData };
}

async function validateRestaurant(data, db) {
  if (!db) {
    console.error('Invalid restaurants database object provided');
    return {
      isValid: false,
      errors: ['Database error: Unable to validate restaurant'],
      sanitizedData: {},
    };
  }

  if (!data) {
    return {
      isValid: false,
      errors: ['Restaurant data is required'],
      sanitizedData: {},
    };
  }

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
    try {
      const result = await db.find({
        selector: { type: 'restaurant', name: sanitizedData.name },
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

  if (typeof sanitizedData.isBranchMultiple !== 'boolean') {
    errors.push('isBranchMultiple must be a boolean');
  }

  if (sanitizedData.contact.phone) {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(sanitizedData.contact.phone)) {
      errors.push('Invalid contact phone number format');
    }
  }

  if (
    sanitizedData.contact.email &&
    !validator.isEmail(sanitizedData.contact.email)
  ) {
    errors.push('Invalid contact email format');
  }

  if (sanitizedData.logo) {
    const base64Regex = /^data:image\/[a-z]+;base64,([A-Za-z0-9+/=]+)$/;
    const match = sanitizedData.logo.match(base64Regex);
    if (!match || !validator.isBase64(match[1])) {
      errors.push('Invalid logo base64 string');
    } else {
      sanitizedData.logo = match[1];
    }
  }

  return { isValid: errors.length === 0, errors, sanitizedData };
}

async function validateBranch(data, db, restaurantId) {
  if (!db || typeof db.find !== 'function') {
    console.error('Invalid branches database object provided');
    return {
      isValid: false,
      errors: ['Database error: Unable to validate branch'],
      sanitizedData: {},
    };
  }

  if (!data) {
    return {
      isValid: false,
      errors: ['Branch data is required'],
      sanitizedData: {},
    };
  }

  const errors = [];
  const sanitizedData = {
    name: sanitizeHtml(data.name || ''),
    location: {
      address: sanitizeHtml(data.location?.address || ''),
    },
    contact: {
      phone: data.contact?.phone ? sanitizeHtml(data.contact.phone) : undefined,
      email: data.contact?.email ? sanitizeHtml(data.contact.email) : undefined,
    },
  };

  if (
    !sanitizedData.name ||
    !validator.isLength(sanitizedData.name, { min: 1, max: 100 })
  ) {
    errors.push('Branch name is required and must be 1-100 characters');
  } else {
    try {
      const result = await db.find({
        selector: {
          type: 'branch',
          restaurantId,
          name: sanitizedData.name,
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

  if (
    !sanitizedData.location.address ||
    !validator.isLength(sanitizedData.location.address, { min: 1, max: 200 })
  ) {
    errors.push('Branch address is required and must be 1-200 characters');
  }

  if (sanitizedData.contact.phone) {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(sanitizedData.contact.phone)) {
      errors.push('Invalid contact phone number format');
    }
  }

  if (
    sanitizedData.contact.email &&
    !validator.isEmail(sanitizedData.contact.email)
  ) {
    errors.push('Invalid contact email format');
  }

  return { isValid: errors.length === 0, errors, sanitizedData };
}

// Socket.IO event handlers
export const registerSocketEvents = (socket, { usersDB, restaurantsDB, branchesDB, logsDB }) => {
  if (!usersDB || !restaurantsDB || !branchesDB) {
    console.error('Missing required database dependencies for registration routes');
    return;
  }

  socket.on('registration:register', async (data, callback) => {
    console.log('Processing registration request:', { ...data, user: { ...data.user, password: '[REDACTED]' } });

    try {
      // 1. Validate user data
      const userValidation = await validateUser(data.user, usersDB);
      if (!userValidation.isValid) {
        console.error('User validation failed:', userValidation.errors);
        return callback?.({
          success: false,
          message: 'User validation failed',
          errors: userValidation.errors
        });
      }

      // 2. Validate restaurant data
      const restaurantValidation = await validateRestaurant(data.restaurant, restaurantsDB);
      if (!restaurantValidation.isValid) {
        console.error('Restaurant validation failed:', restaurantValidation.errors);
        return callback?.({
          success: false,
          message: 'Restaurant validation failed',
          errors: restaurantValidation.errors
        });
      }

      // 3. Create restaurant
      const restaurant = {
        _id: `restaurant_${uuidv4()}`,
        type: 'restaurant',
        ...restaurantValidation.sanitizedData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await restaurantsDB.put(restaurant);
      console.log('Restaurant created:', restaurant._id);

      // 4. Create branches
      const branchPromises = data.branches.map(async (branchData) => {
        const branch = {
          _id: `branch_${uuidv4()}`,
          type: 'branch',
          restaurantId: restaurant._id,
          ...branchData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await branchesDB.put(branch);
        console.log('Branch created:', branch._id);
        return branch;
      });
      const branches = await Promise.all(branchPromises);

      // 5. Hash password and create user
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(data.user.password, salt);

      const user = {
        _id: `user_${uuidv4()}`,
        type: 'user',
        ...userValidation.sanitizedData,
        password: hashedPassword,
        restaurantId: restaurant._id,
        branchId: branches[0]._id, // Assign to first branch by default
        role: 'owner',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await usersDB.put(user);
      console.log('User created:', user._id);

      // 6. Log the registration
      await logsDB.put({
        _id: `log_${uuidv4()}`,
        type: 'log',
        category: 'registration',
        level: 'info',
        message: `New restaurant registration: ${restaurant.name}`,
        userId: user._id,
        restaurantId: restaurant._id,
        timestamp: new Date().toISOString()
      });

      // 7. Send success response
      callback?.({
        success: true,
        message: 'Registration successful',
        data: {
          user: { ...user, password: undefined },
          restaurant,
          branches
        }
      });

      // 8. Broadcast events to other clients
      socket.broadcast.emit('restaurant:created', restaurant);
      socket.broadcast.emit('user:created', { ...user, password: undefined });
      branches.forEach(branch => {
        socket.broadcast.emit('branch:created', branch);
      });

    } catch (error) {
      console.error('Registration error:', error);
      
      // Log the error
      try {
        await logsDB.put({
          _id: `log_${uuidv4()}`,
          type: 'log',
          category: 'registration',
          level: 'error',
          message: `Registration failed: ${error.message}`,
          error: error.stack,
          timestamp: new Date().toISOString()
        });
      } catch (logError) {
        console.error('Failed to log error:', logError);
      }

      callback?.({
        success: false,
        message: 'Registration failed',
        error: error.message
      });
    }
  });
};