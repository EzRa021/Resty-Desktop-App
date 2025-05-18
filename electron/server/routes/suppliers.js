import { v4 as uuidv4 } from 'uuid';
import validator from 'validator';
import sanitizeHtml from 'sanitize-html';
import { validateUserSession } from './utils.js';

const validateSupplier = (data) => {
  const errors = [];
  const sanitizedData = {
    name: sanitizeHtml(data.name || ''),
    contactPerson: sanitizeHtml(data.contactPerson || ''),
    email: data.email ? sanitizeHtml(data.email) : '',
    phone: data.phone ? sanitizeHtml(data.phone) : '',
    address: sanitizeHtml(data.address || ''),
    notes: sanitizeHtml(data.notes || ''),
    paymentTerms: sanitizeHtml(data.paymentTerms || ''),
    leadTime: Number(data.leadTime) || 0,
    minimumOrderValue: Number(data.minimumOrderValue) || 0,
    status: data.status || 'active',
    suppliedIngredients: Array.isArray(data.suppliedIngredients) ? data.suppliedIngredients : [],
    restaurantId: data.restaurantId,
    branchId: data.branchId
  };

  if (!sanitizedData.name) {
    errors.push('Supplier name is required');
  }

  if (sanitizedData.email && !validator.isEmail(sanitizedData.email)) {
    errors.push('Invalid email address');
  }

  if (!['active', 'inactive'].includes(sanitizedData.status)) {
    errors.push('Invalid status');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData
  };
};

export const registerSocketEvents = (socket, {
  db: suppliersDB,
  ingredientsDB,
  sessionDB,
  logsDB
}) => {
  if (!suppliersDB || !ingredientsDB || !sessionDB) {
    console.error('Missing required database dependencies for suppliers routes');
    return;
  }

  // Create Supplier
  socket.on('suppliers:create', async (data, callback) => {
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

      // 2. Validate supplier data
      const validationResult = validateSupplier(data);
      if (!validationResult.isValid) {
        return callback?.({
          success: false,
          message: 'Validation failed',
          errors: validationResult.errors
        });
      }

      // 3. Create supplier document
      const supplier = {
        _id: `supplier_${uuidv4()}`,
        type: 'supplier',
        ...validationResult.sanitizedData,
        createdBy: sessionValidation.user._id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // 4. Save to database
      await suppliersDB.put(supplier);

      // 5. Log the action
      await logsDB.put({
        _id: `log_${uuidv4()}`,
        type: 'log',
        category: 'suppliers',
        action: 'create',
        supplierId: supplier._id,
        userId: sessionValidation.user._id,
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `Supplier ${supplier.name} created`
      });

      // 6. Emit event to other clients
      socket.broadcast.emit('suppliers:created', supplier);

      // 7. Send success response
      callback?.({
        success: true,
        message: 'Supplier created successfully',
        data: supplier
      });

    } catch (error) {
      console.error('Error creating supplier:', error);
      callback?.({
        success: false,
        message: 'Failed to create supplier',
        error: error.message
      });
    }
  });

  // Update Supplier
  socket.on('suppliers:update', async (data, callback) => {
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

      // 2. Get existing supplier
      const existingSupplier = await suppliersDB.get(data.supplierId);

      // 3. Validate updated data
      const validationResult = validateSupplier({
        ...existingSupplier,
        ...data
      });

      if (!validationResult.isValid) {
        return callback?.({
          success: false,
          message: 'Validation failed',
          errors: validationResult.errors
        });
      }

      // 4. Update supplier
      const updatedSupplier = {
        ...existingSupplier,
        ...validationResult.sanitizedData,
        updatedAt: new Date().toISOString(),
        updatedBy: sessionValidation.user._id
      };

      await suppliersDB.put(updatedSupplier);

      // 5. Log the action
      await logsDB.put({
        _id: `log_${uuidv4()}`,
        type: 'log',
        category: 'suppliers',
        action: 'update',
        supplierId: updatedSupplier._id,
        userId: sessionValidation.user._id,
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `Supplier ${updatedSupplier.name} updated`
      });

      // 6. Emit event to other clients
      socket.broadcast.emit('suppliers:updated', updatedSupplier);

      // 7. Send success response
      callback?.({
        success: true,
        message: 'Supplier updated successfully',
        data: updatedSupplier
      });

    } catch (error) {
      console.error('Error updating supplier:', error);
      callback?.({
        success: false,
        message: 'Failed to update supplier',
        error: error.message
      });
    }
  });

  // List Suppliers
  socket.on('suppliers:list', async (data, callback) => {
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
          type: 'supplier',
          restaurantId: data.restaurantId,
          status: data.status || { $exists: true }
        },
        sort: [{ name: 'asc' }],
        limit: data.limit || 50,
        skip: data.skip || 0
      };

      // 3. Execute query
      const result = await suppliersDB.find(query);

      // 4. Send response
      callback?.({
        success: true,
        data: {
          suppliers: result.docs,
          total: result.docs.length,
          hasMore: result.docs.length === (data.limit || 50)
        }
      });

    } catch (error) {
      console.error('Error listing suppliers:', error);
      callback?.({
        success: false,
        message: 'Failed to list suppliers',
        error: error.message
      });
    }
  });

  // Delete Supplier
  socket.on('suppliers:delete', async (data, callback) => {
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

      // 2. Get supplier
      const supplier = await suppliersDB.get(data.supplierId);

      // 3. Check if supplier has associated ingredients
      const ingredientsResult = await ingredientsDB.find({
        selector: {
          type: 'ingredient',
          'supplierInfo.supplierId': supplier._id
        }
      });

      if (ingredientsResult.docs.length > 0) {
        return callback?.({
          success: false,
          message: 'Cannot delete supplier with associated ingredients'
        });
      }

      // 4. Mark supplier as inactive instead of deleting
      const updatedSupplier = {
        ...supplier,
        status: 'inactive',
        updatedAt: new Date().toISOString(),
        updatedBy: sessionValidation.user._id
      };

      await suppliersDB.put(updatedSupplier);

      // 5. Log the action
      await logsDB.put({
        _id: `log_${uuidv4()}`,
        type: 'log',
        category: 'suppliers',
        action: 'delete',
        supplierId: supplier._id,
        userId: sessionValidation.user._id,
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `Supplier ${supplier.name} marked as inactive`
      });

      // 6. Emit event to other clients
      socket.broadcast.emit('suppliers:deleted', {
        id: supplier._id,
        name: supplier.name
      });

      // 7. Send success response
      callback?.({
        success: true,
        message: 'Supplier marked as inactive successfully'
      });

    } catch (error) {
      console.error('Error deleting supplier:', error);
      callback?.({
        success: false,
        message: 'Failed to delete supplier',
        error: error.message
      });
    }
  });

  // Get Supplier Details
  socket.on('suppliers:getDetails', async (data, callback) => {
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

      // 2. Get supplier details
      const supplier = await suppliersDB.get(data.supplierId);

      // 3. Get associated ingredients
      const ingredientsResult = await ingredientsDB.find({
        selector: {
          type: 'ingredient',
          'supplierInfo.supplierId': supplier._id
        }
      });

      // 4. Send response
      callback?.({
        success: true,
        data: {
          supplier,
          ingredients: ingredientsResult.docs
        }
      });

    } catch (error) {
      console.error('Error getting supplier details:', error);
      callback?.({
        success: false,
        message: 'Failed to get supplier details',
        error: error.message
      });
    }
  });
};
