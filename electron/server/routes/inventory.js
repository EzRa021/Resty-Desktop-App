import { v4 as uuidv4 } from 'uuid';
import validator from 'validator';
import sanitizeHtml from 'sanitize-html';
import { validateUserSession } from './utils.js';

const validateInventoryTransaction = (data) => {
  const errors = [];
  const sanitizedData = {
    transactionType: data.transactionType,
    ingredientId: data.ingredientId,
    ingredientName: sanitizeHtml(data.ingredientName || ''),
    quantity: Number(data.quantity),
    unit: sanitizeHtml(data.unit || ''),
    batchId: data.batchId ? sanitizeHtml(data.batchId) : undefined,
    expiryDate: data.expiryDate,
    reason: sanitizeHtml(data.reason || ''),
    relatedDocumentId: data.relatedDocumentId ? sanitizeHtml(data.relatedDocumentId) : undefined,
    relatedDocumentType: data.relatedDocumentType ? sanitizeHtml(data.relatedDocumentType) : undefined,
    cost: Number(data.cost),
    restaurantId: data.restaurantId,
    branchId: data.branchId,
    inventoryMethod: data.inventoryMethod || 'FIFO',
    batchInfo: {
      receivedDate: data.batchInfo?.receivedDate || new Date().toISOString(),
      supplierBatchNumber: data.batchInfo?.supplierBatchNumber,
      qualityCheck: data.batchInfo?.qualityCheck || false,
      qualityCheckDate: data.batchInfo?.qualityCheckDate,
      qualityCheckBy: data.batchInfo?.qualityCheckBy
    }
  };

  if (!['Add', 'Deduct', 'Spoilage', 'Adjustment'].includes(sanitizedData.transactionType)) {
    errors.push('Invalid transaction type');
  }

  if (!sanitizedData.ingredientId) {
    errors.push('Ingredient ID is required');
  }

  if (!Number.isFinite(sanitizedData.quantity) || sanitizedData.quantity === 0) {
    errors.push('Valid quantity is required');
  }

  if (!sanitizedData.unit) {
    errors.push('Unit is required');
  }

  if (sanitizedData.batchId) {
    if (!validator.isUUID(sanitizedData.batchId)) {
      errors.push('Invalid batch ID format');
    }
    if (sanitizedData.expiryDate && !validator.isISO8601(sanitizedData.expiryDate)) {
      errors.push('Invalid expiry date format');
    }
  }

  if (!['FIFO', 'LIFO'].includes(sanitizedData.inventoryMethod)) {
    errors.push('Invalid inventory method');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData
  };
};

/**
 * Calculate inventory forecast based on historical usage
 * @param {Array} transactions - Historical inventory transactions
 * @param {number} days - Number of days to forecast
 * @returns {Object} - Forecast results
 */
const calculateInventoryForecast = (transactions, days = 30) => {
  const dailyUsage = {};
  const forecast = {};

  // Calculate average daily usage
  transactions.forEach(transaction => {
    const date = new Date(transaction.createdAt).toISOString().split('T')[0];
    if (!dailyUsage[date]) {
      dailyUsage[date] = {};
    }
    
    const quantity = transaction.transactionType === 'Deduct' ? 
      -Math.abs(transaction.quantity) : Math.abs(transaction.quantity);
    
    dailyUsage[date][transaction.ingredientId] = 
      (dailyUsage[date][transaction.ingredientId] || 0) + quantity;
  });

  // Calculate forecast for each ingredient
  Object.keys(dailyUsage).forEach(date => {
    Object.keys(dailyUsage[date]).forEach(ingredientId => {
      if (!forecast[ingredientId]) {
        forecast[ingredientId] = {
          totalUsage: 0,
          days: 0,
          averageDailyUsage: 0,
          forecastedUsage: 0,
          reorderPoint: 0,
          safetyStock: 0
        };
      }
      forecast[ingredientId].totalUsage += Math.abs(dailyUsage[date][ingredientId]);
      forecast[ingredientId].days++;
    });
  });

  // Calculate averages and forecasts
  Object.keys(forecast).forEach(ingredientId => {
    const data = forecast[ingredientId];
    data.averageDailyUsage = data.totalUsage / data.days;
    data.forecastedUsage = data.averageDailyUsage * days;
    data.safetyStock = data.averageDailyUsage * 2; // 2 days safety stock
    data.reorderPoint = data.averageDailyUsage * 3; // 3 days lead time
  });

  return forecast;
};

/**
 * Calculate supplier performance metrics
 * @param {Array} transactions - Inventory transactions
 * @returns {Object} - Supplier performance metrics
 */
const calculateSupplierPerformance = (transactions) => {
  const supplierMetrics = {};

  transactions.forEach(transaction => {
    if (transaction.transactionType === 'Add' && transaction.supplierId) {
      if (!supplierMetrics[transaction.supplierId]) {
        supplierMetrics[transaction.supplierId] = {
          totalOrders: 0,
          totalQuantity: 0,
          totalCost: 0,
          onTimeDeliveries: 0,
          lateDeliveries: 0,
          qualityIssues: 0
        };
      }

      const metrics = supplierMetrics[transaction.supplierId];
      metrics.totalOrders++;
      metrics.totalQuantity += transaction.quantity;
      metrics.totalCost += transaction.cost;

      // Check delivery performance
      if (transaction.expectedDeliveryDate) {
        const deliveryDate = new Date(transaction.createdAt);
        const expectedDate = new Date(transaction.expectedDeliveryDate);
        if (deliveryDate <= expectedDate) {
          metrics.onTimeDeliveries++;
        } else {
          metrics.lateDeliveries++;
        }
      }

      // Check quality issues
      if (transaction.qualityCheck === false) {
        metrics.qualityIssues++;
      }
    }
  });

  // Calculate performance scores
  Object.keys(supplierMetrics).forEach(supplierId => {
    const metrics = supplierMetrics[supplierId];
    metrics.onTimeDeliveryRate = metrics.totalOrders > 0 ? 
      (metrics.onTimeDeliveries / metrics.totalOrders) * 100 : 0;
    metrics.qualityScore = metrics.totalOrders > 0 ? 
      ((metrics.totalOrders - metrics.qualityIssues) / metrics.totalOrders) * 100 : 0;
    metrics.averageOrderValue = metrics.totalOrders > 0 ? 
      metrics.totalCost / metrics.totalOrders : 0;
  });

  return supplierMetrics;
};

export const registerSocketEvents = (socket, {
  db: inventoryTransactionsDB,
  ingredientsDB,
  sessionDB,
  logsDB,
  notificationsDB
}) => {
  if (!inventoryTransactionsDB || !ingredientsDB || !sessionDB) {
    console.error('Missing required database dependencies for inventory routes');
    return;
  }

  // Record Inventory Transaction
  socket.on('inventory:recordTransaction', async (data, callback) => {
    console.log('Recording inventory transaction:', { ...data, sessionId: '[REDACTED]' });
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

      // 2. Validate transaction data
      const validationResult = validateInventoryTransaction(data);
      if (!validationResult.isValid) {
        return callback?.({
          success: false,
          message: 'Validation failed',
          errors: validationResult.errors
        });
      }

      // 3. Get current ingredient state
      const ingredient = await ingredientsDB.get(data.ingredientId);
      
      // 4. Create transaction document
      const transaction = {
        _id: `inventory_transaction_${uuidv4()}`,
        type: 'inventoryTransaction',
        ...validationResult.sanitizedData,
        userId: sessionValidation.user._id,
        userName: sessionValidation.user.name || sessionValidation.user.username,
        createdAt: new Date().toISOString(),
        batchStatus: 'active',
        previousStockLevel: ingredient.stockLevel
      };

      // 5. Update ingredient stock level with batch tracking
      const quantityChange = transaction.transactionType === 'Deduct' || 
                           transaction.transactionType === 'Spoilage' 
                           ? -Math.abs(transaction.quantity) 
                           : Math.abs(transaction.quantity);

      // Update batch information
      if (transaction.batchId) {
        const batchInfo = {
          batchId: transaction.batchId,
          quantity: transaction.quantity,
          expiryDate: transaction.expiryDate,
          ...transaction.batchInfo
        };

        if (!ingredient.batches) {
          ingredient.batches = [];
        }

        // Add or update batch
        const existingBatchIndex = ingredient.batches.findIndex(b => b.batchId === transaction.batchId);
        if (existingBatchIndex >= 0) {
          ingredient.batches[existingBatchIndex] = {
            ...ingredient.batches[existingBatchIndex],
            ...batchInfo,
            quantity: ingredient.batches[existingBatchIndex].quantity + quantityChange
          };
        } else {
          ingredient.batches.push(batchInfo);
        }
      }

      // Update total stock level
      ingredient.stockLevel += quantityChange;
      ingredient.updatedAt = new Date().toISOString();

      // 6. Save both documents
      await Promise.all([
        inventoryTransactionsDB.put(transaction),
        ingredientsDB.put(ingredient)
      ]);

      // 7. Log the action
      await logsDB.put({
        _id: `log_${uuidv4()}`,
        type: 'log',
        category: 'inventory',
        action: transaction.transactionType.toLowerCase(),
        transactionId: transaction._id,
        ingredientId: ingredient._id,
        userId: sessionValidation.user._id,
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `Inventory ${transaction.transactionType.toLowerCase()} recorded for ${ingredient.name}`
      });      // 8. Check for low stock and create notifications if needed
      if (ingredient.stockLevel <= ingredient.minimumThreshold) {        // Create low stock notification
        const lowStockNotification = {
          _id: `notification_${uuidv4()}`,
          type: 'low_stock',
          message: `Low Stock Alert: ${ingredient.name} (${ingredient.stockLevel} ${ingredient.unit} remaining)`,
          priority: 'high',
          metadata: {
            ingredientId: ingredient._id,
            name: ingredient.name,
            currentStock: ingredient.stockLevel,
            minimumThreshold: ingredient.minimumThreshold,
            unit: ingredient.unit
          },
          createdAt: new Date().toISOString(),
          read: false,
          targetUsers: ['manager', 'kitchen_staff']
        };

        await notificationsDB.put(lowStockNotification);

        // Broadcast low stock alert and show desktop notification
        socket.broadcast.emit('inventory:lowStock', lowStockNotification.metadata);
        socket.broadcast.to('notification:low_stock').emit('notifications:new', lowStockNotification);
        
        // Send desktop notification
        socket.emit('show-notification', {
          title: 'Low Stock Alert',
          body: `${ingredient.name} is running low!\nCurrent stock: ${ingredient.stockLevel} ${ingredient.unit}\nMinimum threshold: ${ingredient.minimumThreshold} ${ingredient.unit}`,
          urgency: 'critical'
        });
      }

      // 9. Emit event to other clients
      socket.broadcast.emit('inventory:transactionRecorded', transaction);

      // 10. Send success response
      callback?.({
        success: true,
        message: 'Inventory transaction recorded successfully',
        data: {
          transaction,
          updatedStockLevel: ingredient.stockLevel
        }
      });

    } catch (error) {
      console.error('Error recording inventory transaction:', error);
      callback?.({
        success: false,
        message: 'Failed to record inventory transaction',
        error: error.message
      });

      // Log error
      try {
        await logsDB.put({
          _id: `log_${uuidv4()}`,
          type: 'log',
          category: 'inventory',
          action: 'transaction',
          error: error.message,
          timestamp: new Date().toISOString(),
          level: 'error',
          message: `Failed to record inventory transaction: ${error.message}`
        });
      } catch (logError) {
        console.error('Failed to log error:', logError);
      }
    }
  });

  // Get Inventory Transactions
  socket.on('inventory:getTransactions', async (data, callback) => {
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
          type: 'inventoryTransaction',
          restaurantId: data.restaurantId,
          branchId: data.branchId,
          createdAt: {
            $gte: data.startDate || new Date(0).toISOString(),
            $lte: data.endDate || new Date().toISOString()
          }
        },
        sort: [{ createdAt: 'desc' }],
        limit: data.limit || 50,
        skip: data.skip || 0
      };

      // Add filters if provided
      if (data.ingredientId) {
        query.selector.ingredientId = data.ingredientId;
      }
      if (data.transactionType) {
        query.selector.transactionType = data.transactionType;
      }

      // 3. Execute query
      const result = await inventoryTransactionsDB.find(query);

      // 4. Send response
      callback?.({
        success: true,
        data: {
          transactions: result.docs,
          total: result.docs.length,
          hasMore: result.docs.length === (data.limit || 50)
        }
      });

    } catch (error) {
      console.error('Error getting inventory transactions:', error);
      callback?.({
        success: false,
        message: 'Failed to get inventory transactions',
        error: error.message
      });
    }
  });

  // Generate Purchase Orders
  socket.on('inventory:generatePurchaseOrders', async (data, callback) => {
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

      // 2. Get all ingredients below threshold
      const result = await ingredientsDB.find({
        selector: {
          type: 'ingredient',
          restaurantId: data.restaurantId,
          branchId: data.branchId,
          stockLevel: {
            $lte: data.threshold || 0
          }
        }
      });

      // 3. Group by supplier
      const purchaseOrders = result.docs.reduce((acc, ingredient) => {
        const supplierName = ingredient.supplierInfo?.name || 'Unassigned';
        if (!acc[supplierName]) {
          acc[supplierName] = {
            supplier: ingredient.supplierInfo || {},
            items: []
          };
        }

        const orderQuantity = Math.max(
          ingredient.minimumThreshold * 2 - ingredient.stockLevel,
          0
        );

        if (orderQuantity > 0) {
          acc[supplierName].items.push({
            ingredientId: ingredient._id,
            name: ingredient.name,
            currentStock: ingredient.stockLevel,
            minimumThreshold: ingredient.minimumThreshold,
            orderQuantity,
            unit: ingredient.unit,
            estimatedCost: orderQuantity * (ingredient.cost || 0)
          });
        }

        return acc;
      }, {});

      // 4. Send response
      callback?.({
        success: true,
        data: purchaseOrders
      });

    } catch (error) {
      console.error('Error generating purchase orders:', error);
      callback?.({
        success: false,
        message: 'Failed to generate purchase orders',
        error: error.message
      });
    }
  });

  // Add new socket events for analytics
  socket.on('inventory:getForecast', async (data, callback) => {
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

      // Get historical transactions
      const transactions = await inventoryTransactionsDB.find({
        selector: {
          type: 'inventoryTransaction',
          restaurantId: data.restaurantId,
          branchId: data.branchId,
          createdAt: {
            $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString() // Last 90 days
          }
        }
      });

      // Calculate forecast
      const forecast = calculateInventoryForecast(transactions.docs, data.days || 30);

      // Get current stock levels
      const ingredients = await ingredientsDB.find({
        selector: {
          type: 'ingredient',
          restaurantId: data.restaurantId,
          branchId: data.branchId
        }
      });

      // Combine forecast with current stock
      const inventoryForecast = ingredients.docs.map(ingredient => ({
        ...ingredient,
        forecast: forecast[ingredient._id] || {
          averageDailyUsage: 0,
          forecastedUsage: 0,
          reorderPoint: 0,
          safetyStock: 0
        },
        daysUntilReorder: ingredient.stockLevel / (forecast[ingredient._id]?.averageDailyUsage || 1)
      }));

      callback?.({
        success: true,
        data: inventoryForecast
      });

    } catch (error) {
      console.error('Error getting inventory forecast:', error);
      callback?.({
        success: false,
        message: 'Failed to get inventory forecast',
        error: error.message
      });
    }
  });

  socket.on('inventory:getSupplierPerformance', async (data, callback) => {
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

      // Get supplier transactions
      const transactions = await inventoryTransactionsDB.find({
        selector: {
          type: 'inventoryTransaction',
          restaurantId: data.restaurantId,
          branchId: data.branchId,
          transactionType: 'Add',
          createdAt: {
            $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString() // Last year
          }
        }
      });

      // Calculate supplier performance
      const supplierPerformance = calculateSupplierPerformance(transactions.docs);

      callback?.({
        success: true,
        data: supplierPerformance
      });

    } catch (error) {
      console.error('Error getting supplier performance:', error);
      callback?.({
        success: false,
        message: 'Failed to get supplier performance',
        error: error.message
      });
    }
  });
};
