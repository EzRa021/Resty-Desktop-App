import { v4 as uuidv4 } from 'uuid';
import validator from 'validator';
import sanitizeHtml from 'sanitize-html';
import { validateUserSession } from './utils.js';

const validateTable = (data) => {
  const errors = [];
  const sanitizedData = {
    number: Number(data.number),
    name: sanitizeHtml(data.name || ''),
    capacity: Number(data.capacity) || 1,
    section: sanitizeHtml(data.section || ''),
    status: data.status || 'available',
    features: Array.isArray(data.features) ? data.features : [],
    notes: sanitizeHtml(data.notes || ''),
    isActive: data.isActive !== false,
    currentOrderId: data.currentOrderId,
    restaurantId: data.restaurantId,
    branchId: data.branchId
  };

  if (!Number.isInteger(sanitizedData.number) || sanitizedData.number <= 0) {
    errors.push('Valid table number is required');
  }

  if (sanitizedData.capacity <= 0) {
    errors.push('Valid capacity is required');
  }

  if (!['available', 'occupied', 'reserved', 'cleaning'].includes(sanitizedData.status)) {
    errors.push('Invalid status');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData
  };
};

export const registerSocketEvents = (socket, {
  db: tablesDB,
  posDB,
  sessionDB,
  logsDB
}) => {
  if (!tablesDB || !posDB || !sessionDB) {
    console.error('Missing required database dependencies for tables routes');
    return;
  }

  // Create Table
  socket.on('tables:create', async (data, callback) => {
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

      // 2. Check if table number exists
      const existingResult = await tablesDB.find({
        selector: {
          type: 'table',
          number: Number(data.number),
          restaurantId: data.restaurantId,
          branchId: data.branchId
        }
      });

      if (existingResult.docs.length > 0) {
        return callback?.({
          success: false,
          message: 'Table number already exists'
        });
      }

      // 3. Validate table data
      const validationResult = validateTable(data);
      if (!validationResult.isValid) {
        return callback?.({
          success: false,
          message: 'Validation failed',
          errors: validationResult.errors
        });
      }

      // 4. Create table document
      const table = {
        _id: `table_${uuidv4()}`,
        type: 'table',
        ...validationResult.sanitizedData,
        createdBy: sessionValidation.user._id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // 5. Save to database
      await tablesDB.put(table);

      // 6. Log the action
      await logsDB.put({
        _id: `log_${uuidv4()}`,
        type: 'log',
        category: 'tables',
        action: 'create',
        tableId: table._id,
        userId: sessionValidation.user._id,
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `Table ${table.number} created`
      });

      // 7. Emit event to other clients
      socket.broadcast.emit('tables:created', table);

      // 8. Send success response
      callback?.({
        success: true,
        message: 'Table created successfully',
        data: table
      });

    } catch (error) {
      console.error('Error creating table:', error);
      callback?.({
        success: false,
        message: 'Failed to create table',
        error: error.message
      });
    }
  });

  // Update Table Status
  socket.on('tables:updateStatus', async (data, callback) => {
    try {
      // 1. Validate session
      const sessionValidation = await validateUserSession(
        data.sessionId,
        ['owner', 'manager', 'admin', 'waiter'],
        sessionDB
      );

      if (!sessionValidation.valid) {
        return callback?.({
          success: false,
          message: sessionValidation.message
        });
      }

      // 2. Get table
      const table = await tablesDB.get(data.tableId);

      // 3. Update status
      const updatedTable = {
        ...table,
        status: data.status,
        currentOrderId: data.orderId,
        updatedAt: new Date().toISOString(),
        updatedBy: sessionValidation.user._id
      };

      await tablesDB.put(updatedTable);

      // 4. Log the action
      await logsDB.put({
        _id: `log_${uuidv4()}`,
        type: 'log',
        category: 'tables',
        action: 'updateStatus',
        tableId: table._id,
        userId: sessionValidation.user._id,
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `Table ${table.number} status updated to ${data.status}`
      });

      // 5. Emit event to other clients
      socket.broadcast.emit('tables:statusUpdated', updatedTable);

      // 6. Send success response
      callback?.({
        success: true,
        message: 'Table status updated successfully',
        data: updatedTable
      });

    } catch (error) {
      console.error('Error updating table status:', error);
      callback?.({
        success: false,
        message: 'Failed to update table status',
        error: error.message
      });
    }
  });

  // List Tables
  socket.on('tables:list', async (data, callback) => {
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

      // 2. Build query
      const query = {
        selector: {
          type: 'table',
          restaurantId: data.restaurantId,
          branchId: data.branchId,
          isActive: true
        }
      };

      if (data.section) {
        query.selector.section = data.section;
      }

      if (data.status) {
        query.selector.status = data.status;
      }

      // 3. Execute query
      const result = await tablesDB.find(query);

      // 4. Get current orders for occupied tables
      const occupiedTables = result.docs.filter(table => table.currentOrderId);
      const orders = await Promise.all(
        occupiedTables.map(async (table) => {
          try {
            return await posDB.get(table.currentOrderId);
          } catch {
            return null;
          }
        })
      );

      const tableOrders = orders.reduce((acc, order) => {
        if (order) {
          acc[order._id] = order;
        }
        return acc;
      }, {});

      // 5. Send response
      callback?.({
        success: true,
        data: {
          tables: result.docs,
          orders: tableOrders
        }
      });

    } catch (error) {
      console.error('Error listing tables:', error);
      callback?.({
        success: false,
        message: 'Failed to list tables',
        error: error.message
      });
    }
  });

  // Reserve Table
  socket.on('tables:reserve', async (data, callback) => {
    try {
      // 1. Validate session
      const sessionValidation = await validateUserSession(
        data.sessionId,
        ['owner', 'manager', 'admin', 'waiter'],
        sessionDB
      );

      if (!sessionValidation.valid) {
        return callback?.({
          success: false,
          message: sessionValidation.message
        });
      }

      // 2. Get table
      const table = await tablesDB.get(data.tableId);

      // 3. Check if table is available
      if (table.status !== 'available') {
        return callback?.({
          success: false,
          message: 'Table is not available for reservation'
        });
      }

      // 4. Create reservation
      const updatedTable = {
        ...table,
        status: 'reserved',
        reservationInfo: {
          customerName: sanitizeHtml(data.customerName || ''),
          customerPhone: sanitizeHtml(data.customerPhone || ''),
          partySize: Number(data.partySize) || 1,
          reservationTime: data.reservationTime,
          notes: sanitizeHtml(data.notes || '')
        },
        updatedAt: new Date().toISOString(),
        updatedBy: sessionValidation.user._id
      };

      await tablesDB.put(updatedTable);

      // 5. Log the action
      await logsDB.put({
        _id: `log_${uuidv4()}`,
        type: 'log',
        category: 'tables',
        action: 'reserve',
        tableId: table._id,
        userId: sessionValidation.user._id,
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `Table ${table.number} reserved for ${updatedTable.reservationInfo.customerName}`
      });

      // 6. Emit event to other clients
      socket.broadcast.emit('tables:reserved', updatedTable);

      // 7. Send success response
      callback?.({
        success: true,
        message: 'Table reserved successfully',
        data: updatedTable
      });

    } catch (error) {
      console.error('Error reserving table:', error);
      callback?.({
        success: false,
        message: 'Failed to reserve table',
        error: error.message
      });
    }
  });
};
