import { v4 as uuidv4 } from 'uuid';
import sanitizeHtml from 'sanitize-html';
import { validateUserSession } from './utils.js';

const validateSpecial = (data) => {
  const errors = [];
  const sanitizedData = {
    name: sanitizeHtml(data.name || ''),
    description: sanitizeHtml(data.description || ''),
    price: Number(data.price) || 0,
    startDate: data.startDate,
    endDate: data.endDate,
    status: data.status || 'draft',
    menuItemId: data.menuItemId,
    discountType: data.discountType || 'fixed',
    discountValue: Number(data.discountValue) || 0,
    availableQuantity: Number(data.availableQuantity),
    daysOfWeek: Array.isArray(data.daysOfWeek) ? data.daysOfWeek : [],
    timeSlots: Array.isArray(data.timeSlots) ? data.timeSlots : [],
    restrictions: sanitizeHtml(data.restrictions || ''),
    tags: Array.isArray(data.tags) ? data.tags : [],
    imageUrl: data.imageUrl,
    restaurantId: data.restaurantId,
    branchId: data.branchId
  };

  if (!sanitizedData.name) {
    errors.push('Special name is required');
  }

  if (!sanitizedData.menuItemId) {
    errors.push('Menu item is required');
  }

  if (!sanitizedData.price || sanitizedData.price <= 0) {
    errors.push('Valid price is required');
  }

  if (!sanitizedData.startDate || !sanitizedData.endDate) {
    errors.push('Start and end dates are required');
  }

  if (new Date(sanitizedData.startDate) > new Date(sanitizedData.endDate)) {
    errors.push('End date must be after start date');
  }

  if (!['draft', 'active', 'ended'].includes(sanitizedData.status)) {
    errors.push('Invalid status');
  }

  if (!['fixed', 'percentage'].includes(sanitizedData.discountType)) {
    errors.push('Invalid discount type');
  }

  if (sanitizedData.discountValue < 0 || 
      (sanitizedData.discountType === 'percentage' && sanitizedData.discountValue > 100)) {
    errors.push('Invalid discount value');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData
  };
};

export const registerSocketEvents = (socket, {
  db: specialsDB,
  menuItemsDB,
  posDB,
  sessionDB,
  logsDB
}) => {
  if (!specialsDB || !menuItemsDB || !sessionDB) {
    console.error('Missing required database dependencies for specials routes');
    return;
  }

  // Create Special
  socket.on('specials:create', async (data, callback) => {
    try {
      // 1. Validate session and permissions
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

      // 2. Validate menu item exists
      const menuItem = await menuItemsDB.get(data.menuItemId);

      // 3. Validate special data
      const validationResult = validateSpecial({
        ...data,
        price: data.price || menuItem.price.regular
      });

      if (!validationResult.isValid) {
        return callback?.({
          success: false,
          message: 'Validation failed',
          errors: validationResult.errors
        });
      }

      // 4. Create special document
      const special = {
        _id: `special_${uuidv4()}`,
        type: 'special',
        ...validationResult.sanitizedData,
        menuItemDetails: {
          name: menuItem.name,
          category: menuItem.category,
          description: menuItem.description
        },
        createdBy: sessionValidation.user._id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // 5. Save to database
      await specialsDB.put(special);

      // 6. Log the action
      await logsDB.put({
        _id: `log_${uuidv4()}`,
        type: 'log',
        category: 'specials',
        action: 'create',
        specialId: special._id,
        userId: sessionValidation.user._id,
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `Special ${special.name} created`
      });

      // 7. Emit event to other clients
      socket.broadcast.emit('specials:created', special);

      // 8. Send success response
      callback?.({
        success: true,
        message: 'Special created successfully',
        data: special
      });

    } catch (error) {
      console.error('Error creating special:', error);
      callback?.({
        success: false,
        message: 'Failed to create special',
        error: error.message
      });
    }
  });

  // List Active Specials
  socket.on('specials:listActive', async (data, callback) => {
    try {
      // 1. Validate session
      const sessionValidation = await validateUserSession(
        data.sessionId,
        ['owner', 'manager', 'admin', 'waiter', 'cashier'],
        sessionDB
      );

      if (!sessionValidation.valid) {
        return callback?.({
          success: false,
          message: sessionValidation.message
        });
      }

      // 2. Get current date and day
      const now = new Date();
      const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

      // 3. Build query for active specials
      const result = await specialsDB.find({
        selector: {
          type: 'special',
          restaurantId: data.restaurantId,
          branchId: data.branchId,
          status: 'active',
          startDate: { $lte: now.toISOString() },
          endDate: { $gte: now.toISOString() }
        }
      });

      // 4. Filter by day of week and time slot
      const currentTime = now.getHours() * 100 + now.getMinutes();
      const activeSpecials = result.docs.filter(special => {
        // Check if special is valid for current day
        const isDayValid = special.daysOfWeek.length === 0 || 
                          special.daysOfWeek.includes(currentDay);

        // Check if special is valid for current time
        const isTimeValid = special.timeSlots.length === 0 || 
                          special.timeSlots.some(slot => {
                            const [start, end] = slot.split('-').map(t => {
                              const [h, m] = t.split(':').map(Number);
                              return h * 100 + m;
                            });
                            return currentTime >= start && currentTime <= end;
                          });

        // Check if quantity is still available
        const hasQuantity = !special.availableQuantity || special.availableQuantity > 0;

        return isDayValid && isTimeValid && hasQuantity;
      });

      // 5. Send response
      callback?.({
        success: true,
        data: activeSpecials
      });

    } catch (error) {
      console.error('Error listing active specials:', error);
      callback?.({
        success: false,
        message: 'Failed to list active specials',
        error: error.message
      });
    }
  });

  // Update Special Status
  socket.on('specials:updateStatus', async (data, callback) => {
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

      // 2. Get special
      const special = await specialsDB.get(data.specialId);

      // 3. Update status
      const updatedSpecial = {
        ...special,
        status: data.status,
        updatedAt: new Date().toISOString(),
        updatedBy: sessionValidation.user._id
      };

      // 4. Save changes
      await specialsDB.put(updatedSpecial);

      // 5. Log the action
      await logsDB.put({
        _id: `log_${uuidv4()}`,
        type: 'log',
        category: 'specials',
        action: 'updateStatus',
        specialId: special._id,
        userId: sessionValidation.user._id,
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `Special ${special.name} status updated to ${data.status}`
      });

      // 6. Emit event to other clients
      socket.broadcast.emit('specials:statusUpdated', updatedSpecial);

      // 7. Send success response
      callback?.({
        success: true,
        message: 'Special status updated successfully',
        data: updatedSpecial
      });

    } catch (error) {
      console.error('Error updating special status:', error);
      callback?.({
        success: false,
        message: 'Failed to update special status',
        error: error.message
      });
    }
  });

  // Track Special Order
  socket.on('specials:trackOrder', async (data, callback) => {
    try {
      // 1. Validate session
      const sessionValidation = await validateUserSession(
        data.sessionId,
        ['owner', 'manager', 'admin', 'waiter', 'cashier'],
        sessionDB
      );

      if (!sessionValidation.valid) {
        return callback?.({
          success: false,
          message: sessionValidation.message
        });
      }

      // 2. Get special
      const special = await specialsDB.get(data.specialId);

      // 3. Update available quantity if set
      if (special.availableQuantity !== undefined) {
        const updatedSpecial = {
          ...special,
          availableQuantity: Math.max(0, special.availableQuantity - data.quantity),
          updatedAt: new Date().toISOString(),
          updatedBy: sessionValidation.user._id
        };

        await specialsDB.put(updatedSpecial);

        // If quantity reaches 0, notify other clients
        if (updatedSpecial.availableQuantity === 0) {
          socket.broadcast.emit('specials:soldOut', {
            specialId: special._id,
            name: special.name
          });
        }
      }

      // 4. Log the order
      await logsDB.put({
        _id: `log_${uuidv4()}`,
        type: 'log',
        category: 'specials',
        action: 'order',
        specialId: special._id,
        orderId: data.orderId,
        quantity: data.quantity,
        userId: sessionValidation.user._id,
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `${data.quantity}x ${special.name} ordered`
      });

      // 5. Send success response
      callback?.({
        success: true,
        message: 'Special order tracked successfully'
      });

    } catch (error) {
      console.error('Error tracking special order:', error);
      callback?.({
        success: false,
        message: 'Failed to track special order',
        error: error.message
      });
    }
  });
};
