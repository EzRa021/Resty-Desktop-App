import validator from 'validator';
import sanitizeHtml from 'sanitize-html';
import { CONSTANTS } from './userUtils.js';
import { roleUtils } from './roleUtils.js';

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

/**
 * Retries a database operation with exponential backoff
 * @param {Function} operation - Database operation to retry
 * @param {number} maxRetries - Maximum number of retries
 * @returns {Promise<any>} - Operation result
 */
async function retryOperation(operation, maxRetries = MAX_RETRIES) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
      }
    }
  }
  
  throw lastError;
}

/**
 * Validates user data during creation and update
 * @param {Object} data - User data to validate
 * @param {Object} db - PouchDB instance for users
 * @param {boolean} isUpdate - Whether this is an update operation
 * @param {Object} options - Additional validation options
 * @param {string} options.currentRole - Current user's role (for validating role assignments)
 * @param {string} options.oldUserId - ID of user being updated (for email uniqueness check)
 * @param {Object} options.restaurantsDB - PouchDB instance for restaurants
 * @param {Object} options.branchesDB - PouchDB instance for branches
 * @returns {Promise<Object>} - Validation result
 */
async function validateUser(data, db, isUpdate = false, options = {}) {
  if (!db || typeof db.find !== 'function') {
    console.error('Invalid users database object provided');
    return {
      isValid: false,
      errors: ['Database error: Unable to validate user'],
      sanitizedData: {}
    };
  }

  const errors = [];
  const sanitizedData = {
    email: sanitizeHtml(data.email || ''),
    password: data.password || '',
    name: sanitizeHtml(data.name || ''),
    role: data.role || CONSTANTS.ROLES.WAITER,
    phone: data.phone ? sanitizeHtml(data.phone) : undefined,
    restaurantId: data.restaurantId ? sanitizeHtml(data.restaurantId) : undefined,
    branchId: data.branchId ? sanitizeHtml(data.branchId) : undefined,
    restaurantName: data.restaurantName ? sanitizeHtml(data.restaurantName) : undefined,
    branchName: data.branchName ? sanitizeHtml(data.branchName) : undefined,
    branchPhone: data.branchPhone ? sanitizeHtml(data.branchPhone) : undefined,
    branchLocation: data.branchLocation ? sanitizeHtml(data.branchLocation) : undefined
  };

  // Email validation
  if (!sanitizedData.email || !validator.isEmail(sanitizedData.email)) {
    errors.push('Invalid email format');
  } else {
    try {
      const checkEmail = async () => {
        const selector = { type: 'user', email: sanitizedData.email };
        if (isUpdate && options.oldUserId) {
          selector._id = { $ne: options.oldUserId };
        }
        const result = await db.find({
          selector,
          limit: 1
        });
        return result;
      };

      const result = await retryOperation(checkEmail);
      if (result.docs.length > 0) {
        errors.push('Email already exists');
      }
    } catch (error) {
      console.error('Error checking email uniqueness:', error);
      errors.push('Unable to validate email uniqueness');
    }
  }

  // Password validation (only required for new users or password updates)
  if (!isUpdate || sanitizedData.password) {
    if (
      !sanitizedData.password ||
      !validator.isLength(sanitizedData.password, { min: CONSTANTS.PASSWORD_POLICIES.MIN_LENGTH }) ||
      !/[a-zA-Z]/.test(sanitizedData.password) ||
      !/[0-9]/.test(sanitizedData.password)
    ) {
      errors.push(`Password must be at least ${CONSTANTS.PASSWORD_POLICIES.MIN_LENGTH} characters with one letter and one number`);
    }
  }

  // Name validation
  if (!sanitizedData.name || !validator.isLength(sanitizedData.name, { min: 1, max: 100 })) {
    errors.push('Name is required and must be 1-100 characters');
  }

  // Phone validation (if provided)
  if (sanitizedData.phone) {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(sanitizedData.phone)) {
      errors.push('Invalid phone number format');
    }
  }

  // Role validation
  if (!Object.values(CONSTANTS.ROLES).includes(sanitizedData.role)) {
    errors.push('Invalid role specified');
  } else if (options.currentRole) {
    // Check if current user can assign this role
    if (!roleUtils.canAssignRole(options.currentRole, sanitizedData.role)) {
      errors.push(`Users with role '${options.currentRole}' cannot assign role '${sanitizedData.role}'`);
    }
  }

  // Restaurant validation
  if (sanitizedData.restaurantId && options.restaurantsDB) {
    try {
      const checkRestaurant = async () => {
        const restaurant = await options.restaurantsDB.get(sanitizedData.restaurantId);
        return restaurant;
      };

      const restaurant = await retryOperation(checkRestaurant);
      if (!restaurant || restaurant._deleted) {
        errors.push('Invalid restaurant ID');
      }
    } catch (error) {
      console.error('Error validating restaurant ID:', error);
      errors.push('Unable to validate restaurant ID');
    }
  }

  // Branch validation
  if (sanitizedData.branchId && sanitizedData.restaurantId && options.branchesDB) {
    try {
      const checkBranch = async () => {
        const branch = await options.branchesDB.get(sanitizedData.branchId);
        return branch;
      };

      const branch = await retryOperation(checkBranch);
      if (!branch || branch._deleted || branch.restaurantId !== sanitizedData.restaurantId) {
        errors.push('Invalid branch ID or branch does not belong to the specified restaurant');
      }
    } catch (error) {
      console.error('Error validating branch ID:', error);
      errors.push('Unable to validate branch ID');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData
  };
}

export default validateUser;
