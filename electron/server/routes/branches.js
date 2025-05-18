import { v4 as uuidv4 } from 'uuid';
import validator from 'validator';
import sanitizeHtml from 'sanitize-html';

// Validation function for Branch (unchanged)
const validateBranch = async (data, db, restaurantId, branchId = null) => {
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
    const result = await db.find({
      selector: {
        type: 'branch',
        restaurantId,
        name: sanitizedData.name,
      },
      limit: 1,
    });

    if (result.docs.length > 0) {
      if (branchId && result.docs[0]._id === branchId) {
        // Same document, no error
      } else {
        errors.push('Branch name already exists for this restaurant');
      }
    }
  }

  if (
    !sanitizedData.location.address ||
    !validator.isLength(sanitizedData.location.address, { min: 1, max: 200 })
  ) {
    errors.push('Branch address is required and must be 1-200 characters');
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

  // Create branch
  socket.on('branches:create', async (data, callback) => {
    try {
      const sessionValidation = await validateUserSession(socket, sessionDB);
      if (!sessionValidation.valid) {
        callback?.({ success: false, error: sessionValidation.message });
        return;
      }

      // Validate restaurant ownership
      const restaurant = await restaurantsDB.get(data.restaurantId).catch(() => null);
      if (!restaurant || restaurant.ownerId !== sessionValidation.user._id) {
        callback?.({ success: false, error: 'Not authorized to add branches to this restaurant' });
        return;
      }

      const validation = await validateBranch(data, db, data.restaurantId);
      if (!validation.isValid) {
        callback?.({ success: false, errors: validation.errors });
        return;
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

  // ...additional socket event handlers...
};