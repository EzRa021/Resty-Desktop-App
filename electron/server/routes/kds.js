import { v4 as uuidv4 } from 'uuid';
import { validateUserSession } from './utils.js';

const validateKitchenOrder = (data) => {
  const errors = [];
  const sanitizedData = {
    orderId: data.orderId,
    status: data.status,
    preparationTime: Number(data.preparationTime) || 0,
    notes: data.notes,
    restaurantId: data.restaurantId,
    branchId: data.branchId
  };

  if (!['pending', 'preparing', 'ready', 'delivered', 'cancelled'].includes(sanitizedData.status)) {
    errors.push('Invalid order status');
  }

  if (!sanitizedData.orderId) {
    errors.push('Order ID is required');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData
  };
};

/**
 * Calculate order priority score
 * @param {Object} order - Order object
 * @param {Object} kitchenStatus - Current kitchen status
 * @returns {number} - Priority score (higher is more urgent)
 */
const calculateOrderPriority = (order, kitchenStatus) => {
  let score = 0;
  const now = new Date();

  // Time-based factors
  const orderAge = (now - new Date(order.createdAt)) / (1000 * 60); // in minutes
  score += Math.min(orderAge * 0.5, 30); // Up to 30 points for waiting time

  // Table status
  if (order.tableStatus === 'waiting') {
    score += 20;
  } else if (order.tableStatus === 'seated') {
    score += 15;
  }

  // Special requests
  if (order.specialRequests?.includes('urgent')) {
    score += 25;
  }
  if (order.specialRequests?.includes('allergy')) {
    score += 20;
  }

  // Kitchen capacity
  const activeOrders = kitchenStatus.activeOrders || 0;
  const maxCapacity = kitchenStatus.maxCapacity || 10;
  const capacityFactor = 1 - (activeOrders / maxCapacity);
  score += capacityFactor * 15;

  // Time of day
  const hour = now.getHours();
  if (hour >= 11 && hour <= 14) { // Lunch rush
    score += 10;
  } else if (hour >= 17 && hour <= 20) { // Dinner rush
    score += 15;
  }

  return score;
};

/**
 * Update kitchen status
 * @param {Object} kitchenStatus - Current kitchen status
 * @param {Object} order - Order being processed
 * @returns {Object} - Updated kitchen status
 */
const updateKitchenStatus = (kitchenStatus, order) => {
  const status = { ...kitchenStatus };
  
  // Update active orders count
  status.activeOrders = (status.activeOrders || 0) + 1;
  
  // Update station load
  order.items.forEach(item => {
    const station = item.preparationStation || 'main';
    status.stations = status.stations || {};
    status.stations[station] = status.stations[station] || { active: 0, capacity: 5 };
    status.stations[station].active++;
  });

  // Update estimated completion time
  const maxPrepTime = Math.max(...order.items.map(item => item.preparationTime || 0));
  status.estimatedCompletionTime = new Date(Date.now() + maxPrepTime * 60000);

  return status;
};

/**
 * Calculate kitchen performance metrics
 * @param {Array} orders - Completed orders
 * @param {Object} kitchenStatus - Current kitchen status
 * @returns {Object} - Performance metrics
 */
const calculateKitchenPerformance = (orders, kitchenStatus) => {
  const metrics = {
    totalOrders: orders.length,
    averagePrepTime: 0,
    onTimeOrders: 0,
    lateOrders: 0,
    stationPerformance: {},
    staffPerformance: {},
    peakHours: {},
    orderTypes: {}
  };

  let totalPrepTime = 0;

  orders.forEach(order => {
    // Calculate preparation time
    const prepTime = (new Date(order.completedAt) - new Date(order.createdAt)) / (1000 * 60); // in minutes
    totalPrepTime += prepTime;

    // Check if order was on time
    const expectedTime = order.estimatedPrepTime || 30; // default 30 minutes
    if (prepTime <= expectedTime) {
      metrics.onTimeOrders++;
    } else {
      metrics.lateOrders++;
    }

    // Track station performance
    order.items.forEach(item => {
      const station = item.preparationStation || 'main';
      if (!metrics.stationPerformance[station]) {
        metrics.stationPerformance[station] = {
          totalOrders: 0,
          averagePrepTime: 0,
          totalPrepTime: 0
        };
      }
      metrics.stationPerformance[station].totalOrders++;
      metrics.stationPerformance[station].totalPrepTime += prepTime;
    });

    // Track staff performance
    if (order.preparedBy) {
      if (!metrics.staffPerformance[order.preparedBy]) {
        metrics.staffPerformance[order.preparedBy] = {
          totalOrders: 0,
          averagePrepTime: 0,
          totalPrepTime: 0,
          onTimeOrders: 0
        };
      }
      metrics.staffPerformance[order.preparedBy].totalOrders++;
      metrics.staffPerformance[order.preparedBy].totalPrepTime += prepTime;
      if (prepTime <= expectedTime) {
        metrics.staffPerformance[order.preparedBy].onTimeOrders++;
      }
    }

    // Track peak hours
    const hour = new Date(order.createdAt).getHours();
    metrics.peakHours[hour] = (metrics.peakHours[hour] || 0) + 1;

    // Track order types
    metrics.orderTypes[order.orderType] = (metrics.orderTypes[order.orderType] || 0) + 1;
  });

  // Calculate averages
  metrics.averagePrepTime = totalPrepTime / metrics.totalOrders;
  metrics.onTimeRate = (metrics.onTimeOrders / metrics.totalOrders) * 100;

  // Calculate station averages
  Object.keys(metrics.stationPerformance).forEach(station => {
    const stationMetrics = metrics.stationPerformance[station];
    stationMetrics.averagePrepTime = stationMetrics.totalPrepTime / stationMetrics.totalOrders;
  });

  // Calculate staff averages
  Object.keys(metrics.staffPerformance).forEach(staffId => {
    const staffMetrics = metrics.staffPerformance[staffId];
    staffMetrics.averagePrepTime = staffMetrics.totalPrepTime / staffMetrics.totalOrders;
    staffMetrics.onTimeRate = (staffMetrics.onTimeOrders / staffMetrics.totalOrders) * 100;
  });

  return metrics;
};

export const registerSocketEvents = (socket, {
  db: kdsDB,
  posDB,  // Need access to POS orders
  sessionDB,
  logsDB
}) => {
  if (!kdsDB || !posDB || !sessionDB) {
    console.error('Missing required database dependencies for KDS routes');
    return;
  }

  // Initialize kitchen status
  let kitchenStatus = {
    activeOrders: 0,
    maxCapacity: 10,
    stations: {
      main: { active: 0, capacity: 5 },
      grill: { active: 0, capacity: 3 },
      salad: { active: 0, capacity: 2 },
      dessert: { active: 0, capacity: 2 }
    },
    estimatedCompletionTime: null
  };

  // Update Kitchen Order Status
  socket.on('kds:updateOrderStatus', async (data, callback) => {
    console.log('Updating kitchen order status:', { ...data, sessionId: '[REDACTED]' });
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

      // 2. Validate order status data
      const validationResult = validateKitchenOrder(data);
      if (!validationResult.isValid) {
        return callback?.({
          success: false,
          message: 'Validation failed',
          errors: validationResult.errors
        });
      }

      // 3. Get current order
      const order = await posDB.get(data.orderId);
      
      // 4. Create or update KDS entry
      const kdsEntry = {
        _id: `kds_${order._id}`,
        type: 'kdsEntry',
        orderId: order._id,
        orderNumber: order.orderNumber,
        status: validationResult.sanitizedData.status,
        preparationTime: validationResult.sanitizedData.preparationTime,
        notes: validationResult.sanitizedData.notes,
        orderItems: order.orderItems,
        tableNumber: order.tableNumber,
        orderType: order.orderType,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        updatedBy: sessionValidation.user._id,
        restaurantId: order.restaurantId,
        branchId: order.branchId
      };

      try {
        const existingEntry = await kdsDB.get(kdsEntry._id);
        kdsEntry._rev = existingEntry._rev;
      } catch (err) {
        // New entry - no revision needed
      }

      // 5. Save KDS entry
      await kdsDB.put(kdsEntry);

      // 6. Log the action
      await logsDB.put({
        _id: `log_${uuidv4()}`,
        type: 'log',
        category: 'kds',
        action: 'statusUpdate',
        orderId: order._id,
        userId: sessionValidation.user._id,
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `Kitchen order ${order.orderNumber} status updated to ${kdsEntry.status}`
      });

      // 7. Emit event to other clients
      socket.broadcast.emit('kds:orderStatusUpdated', kdsEntry);

      // 8. Send success response
      callback?.({
        success: true,
        message: 'Kitchen order status updated successfully',
        data: kdsEntry
      });

    } catch (error) {
      console.error('Error updating kitchen order status:', error);
      callback?.({
        success: false,
        message: 'Failed to update kitchen order status',
        error: error.message
      });
    }
  });

  // Get Kitchen Orders
  socket.on('kds:getOrders', async (data, callback) => {
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

      // 2. Build query for active orders
      const query = {
        selector: {
          type: 'kdsEntry',
          restaurantId: data.restaurantId,
          branchId: data.branchId,
          status: {
            $in: ['pending', 'preparing']
          },
          createdAt: {
            $gte: data.startDate || new Date(0).toISOString(),
            $lte: data.endDate || new Date().toISOString()
          }
        },
        sort: [{ createdAt: 'asc' }]
      };

      // 3. Execute query
      const result = await kdsDB.find(query);

      // 4. Send response
      callback?.({
        success: true,
        data: {
          orders: result.docs
        }
      });

    } catch (error) {
      console.error('Error getting kitchen orders:', error);
      callback?.({
        success: false,
        message: 'Failed to get kitchen orders',
        error: error.message
      });
    }
  });

  // Get Order Details
  socket.on('kds:getOrderDetails', async (data, callback) => {
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

      // 2. Get KDS entry and original order
      const [kdsEntry, order] = await Promise.all([
        kdsDB.get(data.kdsId),
        posDB.get(data.orderId)
      ]);

      // 3. Send response
      callback?.({
        success: true,
        data: {
          kdsEntry,
          order
        }
      });

    } catch (error) {
      console.error('Error getting order details:', error);
      callback?.({
        success: false,
        message: 'Failed to get order details',
        error: error.message
      });
    }
  });

  // Add Order Notes
  socket.on('kds:addOrderNotes', async (data, callback) => {
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

      // 2. Get KDS entry
      const kdsEntry = await kdsDB.get(data.kdsId);

      // 3. Update notes
      const updatedEntry = {
        ...kdsEntry,
        notes: data.notes,
        updatedAt: new Date().toISOString(),
        updatedBy: sessionValidation.user._id
      };

      // 4. Save updates
      await kdsDB.put(updatedEntry);

      // 5. Log the action
      await logsDB.put({
        _id: `log_${uuidv4()}`,
        type: 'log',
        category: 'kds',
        action: 'addNotes',
        kdsId: kdsEntry._id,
        orderId: kdsEntry.orderId,
        userId: sessionValidation.user._id,
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `Notes added to kitchen order ${kdsEntry.orderNumber}`
      });

      // 6. Emit event to other clients
      socket.broadcast.emit('kds:orderNotesUpdated', updatedEntry);

      // 7. Send success response
      callback?.({
        success: true,
        message: 'Kitchen order notes updated successfully',
        data: updatedEntry
      });

    } catch (error) {
      console.error('Error adding order notes:', error);
      callback?.({
        success: false,
        message: 'Failed to add order notes',
        error: error.message
      });
    }
  });

  // Update order status
  socket.on('kds:updateOrder', async (data, callback) => {
    try {
      const sessionValidation = await validateUserSession(
        data.sessionId,
        ['kitchen', 'manager', 'admin'],
        sessionDB
      );

      if (!sessionValidation.valid) {
        return callback?.({
          success: false,
          message: sessionValidation.message
        });
      }

      const order = await posDB.get(data.orderId);
      if (!order) {
        return callback?.({
          success: false,
          message: 'Order not found'
        });
      }

      // Calculate priority
      const priority = calculateOrderPriority(order, kitchenStatus);
      
      // Update kitchen status
      kitchenStatus = updateKitchenStatus(kitchenStatus, order);

      // Update order status
      const updatedOrder = {
        ...order,
        status: data.status,
        priority,
        updatedAt: new Date().toISOString(),
        updatedBy: sessionValidation.user._id,
        kitchenStatus: {
          ...kitchenStatus,
          lastUpdated: new Date().toISOString()
        }
      };

      await posDB.put(updatedOrder);

      // Log the action
      await logsDB.put({
        _id: `log_${uuidv4()}`,
        type: 'log',
        category: 'kds',
        action: 'update',
        orderId: order._id,
        userId: sessionValidation.user._id,
        status: data.status,
        priority,
        timestamp: new Date().toISOString()
      });

      // Broadcast to all KDS clients
      socket.broadcast.emit('kds:orderUpdated', {
        order: updatedOrder,
        kitchenStatus
      });

      callback?.({
        success: true,
        order: updatedOrder,
        kitchenStatus
      });

    } catch (error) {
      console.error('Error updating KDS order:', error);
      callback?.({
        success: false,
        message: 'Failed to update order',
        error: error.message
      });
    }
  });

  // Get kitchen status
  socket.on('kds:getStatus', async (data, callback) => {
    try {
      const sessionValidation = await validateUserSession(
        data.sessionId,
        ['kitchen', 'manager', 'admin'],
        sessionDB
      );

      if (!sessionValidation.valid) {
        return callback?.({
          success: false,
          message: sessionValidation.message
        });
      }

      // Get active orders
      const activeOrders = await posDB.find({
        selector: {
          status: { $in: ['preparing', 'ready'] },
          createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() }
        },
        sort: [{ priority: 'desc' }, { createdAt: 'asc' }]
      });

      callback?.({
        success: true,
        kitchenStatus,
        activeOrders: activeOrders.docs
      });

    } catch (error) {
      console.error('Error getting KDS status:', error);
      callback?.({
        success: false,
        message: 'Failed to get kitchen status',
        error: error.message
      });
    }
  });

  // Update kitchen capacity
  socket.on('kds:updateCapacity', async (data, callback) => {
    try {
      const sessionValidation = await validateUserSession(
        data.sessionId,
        ['manager', 'admin'],
        sessionDB
      );

      if (!sessionValidation.valid) {
        return callback?.({
          success: false,
          message: sessionValidation.message
        });
      }

      // Update kitchen capacity
      kitchenStatus = {
        ...kitchenStatus,
        maxCapacity: data.maxCapacity || kitchenStatus.maxCapacity,
        stations: data.stations || kitchenStatus.stations
      };

      // Broadcast to all KDS clients
      socket.broadcast.emit('kds:statusUpdated', kitchenStatus);

      callback?.({
        success: true,
        kitchenStatus
      });

    } catch (error) {
      console.error('Error updating kitchen capacity:', error);
      callback?.({
        success: false,
        message: 'Failed to update kitchen capacity',
        error: error.message
      });
    }
  });

  // Add new socket events for KDS analytics
  socket.on('kds:getPerformanceMetrics', async (data, callback) => {
    try {
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

      // Get completed orders for the specified period
      const orders = await posDB.find({
        selector: {
          status: 'completed',
          restaurantId: data.restaurantId,
          branchId: data.branchId,
          completedAt: {
            $gte: data.startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            $lte: data.endDate || new Date().toISOString()
          }
        }
      });

      // Calculate performance metrics
      const metrics = calculateKitchenPerformance(orders.docs, kitchenStatus);

      callback?.({
        success: true,
        data: metrics
      });

    } catch (error) {
      console.error('Error getting KDS performance metrics:', error);
      callback?.({
        success: false,
        message: 'Failed to get performance metrics',
        error: error.message
      });
    }
  });

  socket.on('kds:getStaffPerformance', async (data, callback) => {
    try {
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

      // Get staff performance data
      const orders = await posDB.find({
        selector: {
          status: 'completed',
          restaurantId: data.restaurantId,
          branchId: data.branchId,
          preparedBy: { $exists: true },
          completedAt: {
            $gte: data.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            $lte: data.endDate || new Date().toISOString()
          }
        }
      });

      // Calculate staff performance
      const staffPerformance = {};
      orders.docs.forEach(order => {
        if (!staffPerformance[order.preparedBy]) {
          staffPerformance[order.preparedBy] = {
            totalOrders: 0,
            totalPrepTime: 0,
            onTimeOrders: 0,
            averagePrepTime: 0,
            onTimeRate: 0,
            orderTypes: {}
          };
        }

        const prepTime = (new Date(order.completedAt) - new Date(order.createdAt)) / (1000 * 60);
        const expectedTime = order.estimatedPrepTime || 30;

        staffPerformance[order.preparedBy].totalOrders++;
        staffPerformance[order.preparedBy].totalPrepTime += prepTime;
        if (prepTime <= expectedTime) {
          staffPerformance[order.preparedBy].onTimeOrders++;
        }

        // Track order types
        staffPerformance[order.preparedBy].orderTypes[order.orderType] = 
          (staffPerformance[order.preparedBy].orderTypes[order.orderType] || 0) + 1;
      });

      // Calculate averages
      Object.keys(staffPerformance).forEach(staffId => {
        const metrics = staffPerformance[staffId];
        metrics.averagePrepTime = metrics.totalPrepTime / metrics.totalOrders;
        metrics.onTimeRate = (metrics.onTimeOrders / metrics.totalOrders) * 100;
      });

      callback?.({
        success: true,
        data: staffPerformance
      });

    } catch (error) {
      console.error('Error getting staff performance:', error);
      callback?.({
        success: false,
        message: 'Failed to get staff performance',
        error: error.message
      });
    }
  });

  socket.on('kds:getCapacityPlanning', async (data, callback) => {
    try {
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

      // Get historical order data
      const orders = await posDB.find({
        selector: {
          restaurantId: data.restaurantId,
          branchId: data.branchId,
          createdAt: {
            $gte: data.startDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
            $lte: data.endDate || new Date().toISOString()
          }
        }
      });

      // Analyze capacity needs
      const capacityAnalysis = {
        hourlyDemand: {},
        stationUtilization: {},
        peakTimes: [],
        recommendedStaffing: {}
      };

      // Calculate hourly demand
      orders.docs.forEach(order => {
        const hour = new Date(order.createdAt).getHours();
        capacityAnalysis.hourlyDemand[hour] = (capacityAnalysis.hourlyDemand[hour] || 0) + 1;

        // Track station utilization
        order.items.forEach(item => {
          const station = item.preparationStation || 'main';
          if (!capacityAnalysis.stationUtilization[station]) {
            capacityAnalysis.stationUtilization[station] = {
              totalOrders: 0,
              hourlyDemand: {}
            };
          }
          capacityAnalysis.stationUtilization[station].totalOrders++;
          capacityAnalysis.stationUtilization[station].hourlyDemand[hour] = 
            (capacityAnalysis.stationUtilization[station].hourlyDemand[hour] || 0) + 1;
        });
      });

      // Identify peak times
      const hourlyDemand = Object.entries(capacityAnalysis.hourlyDemand)
        .sort(([, a], [, b]) => b - a);
      capacityAnalysis.peakTimes = hourlyDemand.slice(0, 5).map(([hour]) => hour);

      // Calculate recommended staffing
      Object.keys(capacityAnalysis.stationUtilization).forEach(station => {
        const stationData = capacityAnalysis.stationUtilization[station];
        const peakHour = Object.entries(stationData.hourlyDemand)
          .sort(([, a], [, b]) => b - a)[0];
        
        capacityAnalysis.recommendedStaffing[station] = {
          peakHour: parseInt(peakHour[0]),
          peakDemand: peakHour[1],
          recommendedStaff: Math.ceil(peakHour[1] / 5) // Assume 5 orders per staff member per hour
        };
      });

      callback?.({
        success: true,
        data: capacityAnalysis
      });

    } catch (error) {
      console.error('Error getting capacity planning:', error);
      callback?.({
        success: false,
        message: 'Failed to get capacity planning',
        error: error.message
      });
    }
  });
};
