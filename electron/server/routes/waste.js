import { v4 as uuidv4 } from 'uuid';
import sanitizeHtml from 'sanitize-html';
import { validateUserSession } from './utils.js';

const validateWasteRecord = (data) => {
  const errors = [];
  const sanitizedData = {
    ingredientId: data.ingredientId,
    quantity: Number(data.quantity) || 0,
    reason: sanitizeHtml(data.reason || ''),
    wasteType: data.wasteType || 'spoilage',
    disposalMethod: sanitizeHtml(data.disposalMethod || ''),
    cost: Number(data.cost) || 0,
    actionTaken: sanitizeHtml(data.actionTaken || ''),
    reportedBy: data.reportedBy,
    restaurantId: data.restaurantId,
    branchId: data.branchId
  };

  if (!sanitizedData.ingredientId) {
    errors.push('Ingredient ID is required');
  }

  if (sanitizedData.quantity <= 0) {
    errors.push('Valid quantity is required');
  }

  if (!sanitizedData.reason) {
    errors.push('Reason for waste is required');
  }

  if (!['spoilage', 'damage', 'preparation', 'overproduction', 'other'].includes(sanitizedData.wasteType)) {
    errors.push('Invalid waste type');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData
  };
};

export const registerSocketEvents = (socket, {
  db: wasteRecordsDB,
  inventoryTransactionsDB,
  ingredientsDB,
  sessionDB,
  logsDB
}) => {
  if (!wasteRecordsDB || !inventoryTransactionsDB || !ingredientsDB || !sessionDB) {
    console.error('Missing required database dependencies for waste records routes');
    return;
  }

  // Record Waste
  socket.on('waste:record', async (data, callback) => {
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

      // 2. Validate waste record data
      const validationResult = validateWasteRecord({
        ...data,
        reportedBy: sessionValidation.user._id
      });

      if (!validationResult.isValid) {
        return callback?.({
          success: false,
          message: 'Validation failed',
          errors: validationResult.errors
        });
      }

      // 3. Get ingredient information
      const ingredient = await ingredientsDB.get(data.ingredientId);

      // 4. Calculate cost if not provided
      const wasteCost = data.cost || (ingredient.cost * validationResult.sanitizedData.quantity);

      // 5. Create waste record
      const wasteRecord = {
        _id: `waste_${uuidv4()}`,
        type: 'wasteRecord',
        ...validationResult.sanitizedData,
        ingredientName: ingredient.name,
        unit: ingredient.unit,
        cost: wasteCost,
        createdAt: new Date().toISOString()
      };

      // 6. Create inventory transaction for waste
      const inventoryTransaction = {
        _id: `inventory_transaction_${uuidv4()}`,
        type: 'inventoryTransaction',
        transactionType: 'Spoilage',
        ingredientId: ingredient._id,
        ingredientName: ingredient.name,
        quantity: validationResult.sanitizedData.quantity,
        unit: ingredient.unit,
        cost: wasteCost,
        reason: `Waste: ${validationResult.sanitizedData.reason}`,
        restaurantId: data.restaurantId,
        branchId: data.branchId,
        createdBy: sessionValidation.user._id,
        createdAt: new Date().toISOString()
      };

      // 7. Update ingredient stock level
      const updatedIngredient = {
        ...ingredient,
        stockLevel: Math.max(0, ingredient.stockLevel - validationResult.sanitizedData.quantity),
        updatedAt: new Date().toISOString(),
        updatedBy: sessionValidation.user._id
      };

      // 8. Save all changes
      await Promise.all([
        wasteRecordsDB.put(wasteRecord),
        inventoryTransactionsDB.put(inventoryTransaction),
        ingredientsDB.put(updatedIngredient)
      ]);

      // 9. Log the action
      await logsDB.put({
        _id: `log_${uuidv4()}`,
        type: 'log',
        category: 'waste',
        action: 'record',
        wasteId: wasteRecord._id,
        ingredientId: ingredient._id,
        userId: sessionValidation.user._id,
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `${wasteRecord.quantity} ${ingredient.unit} of ${ingredient.name} recorded as waste`
      });

      // 10. Check for low stock and emit alert if needed
      if (updatedIngredient.stockLevel <= updatedIngredient.minimumThreshold) {
        socket.broadcast.emit('inventory:lowStock', {
          ingredientId: ingredient._id,
          name: ingredient.name,
          currentStock: updatedIngredient.stockLevel,
          minimumThreshold: updatedIngredient.minimumThreshold
        });
      }

      // 11. Emit waste recorded event
      socket.broadcast.emit('waste:recorded', wasteRecord);

      // 12. Send success response
      callback?.({
        success: true,
        message: 'Waste record created successfully',
        data: {
          wasteRecord,
          inventoryTransaction,
          updatedIngredient
        }
      });

    } catch (error) {
      console.error('Error recording waste:', error);
      callback?.({
        success: false,
        message: 'Failed to record waste',
        error: error.message
      });
    }
  });

  // Get Waste Reports
  socket.on('waste:getReport', async (data, callback) => {
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

      // 2. Query waste records
      const result = await wasteRecordsDB.find({
        selector: {
          type: 'wasteRecord',
          restaurantId: data.restaurantId,
          branchId: data.branchId,
          createdAt: {
            $gte: data.startDate,
            $lte: data.endDate
          }
        },
        sort: [{ createdAt: 'desc' }]
      });

      // 3. Group and analyze data
      const analysis = result.docs.reduce((acc, record) => {
        // Group by waste type
        if (!acc.byType[record.wasteType]) {
          acc.byType[record.wasteType] = {
            count: 0,
            quantity: 0,
            cost: 0
          };
        }
        acc.byType[record.wasteType].count++;
        acc.byType[record.wasteType].quantity += record.quantity;
        acc.byType[record.wasteType].cost += record.cost;

        // Group by ingredient
        if (!acc.byIngredient[record.ingredientId]) {
          acc.byIngredient[record.ingredientId] = {
            name: record.ingredientName,
            count: 0,
            quantity: 0,
            cost: 0
          };
        }
        acc.byIngredient[record.ingredientId].count++;
        acc.byIngredient[record.ingredientId].quantity += record.quantity;
        acc.byIngredient[record.ingredientId].cost += record.cost;

        // Update totals
        acc.totalCost += record.cost;
        acc.totalRecords++;

        return acc;
      }, {
        byType: {},
        byIngredient: {},
        totalCost: 0,
        totalRecords: 0
      });

      // 4. Send response
      callback?.({
        success: true,
        data: {
          records: result.docs,
          analysis
        }
      });

    } catch (error) {
      console.error('Error generating waste report:', error);
      callback?.({
        success: false,
        message: 'Failed to generate waste report',
        error: error.message
      });
    }
  });

  // Get Waste Trends
  socket.on('waste:getTrends', async (data, callback) => {
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

      // 2. Query waste records
      const result = await wasteRecordsDB.find({
        selector: {
          type: 'wasteRecord',
          restaurantId: data.restaurantId,
          branchId: data.branchId,
          createdAt: {
            $gte: data.startDate,
            $lte: data.endDate
          }
        }
      });

      // 3. Analyze trends
      const trends = result.docs.reduce((acc, record) => {
        const date = record.createdAt.split('T')[0];
        if (!acc[date]) {
          acc[date] = {
            totalCost: 0,
            recordCount: 0,
            byType: {},
            topWastedIngredients: {}
          };
        }

        // Update daily totals
        acc[date].totalCost += record.cost;
        acc[date].recordCount++;

        // Update waste types
        if (!acc[date].byType[record.wasteType]) {
          acc[date].byType[record.wasteType] = {
            count: 0,
            cost: 0
          };
        }
        acc[date].byType[record.wasteType].count++;
        acc[date].byType[record.wasteType].cost += record.cost;

        // Update top wasted ingredients
        if (!acc[date].topWastedIngredients[record.ingredientId]) {
          acc[date].topWastedIngredients[record.ingredientId] = {
            name: record.ingredientName,
            quantity: 0,
            cost: 0
          };
        }
        acc[date].topWastedIngredients[record.ingredientId].quantity += record.quantity;
        acc[date].topWastedIngredients[record.ingredientId].cost += record.cost;

        return acc;
      }, {});

      // 4. Calculate daily averages and identify patterns
      const analysis = {
        dailyAverageCost: 0,
        mostCommonWasteType: '',
        mostWastedIngredient: '',
        highestWasteDays: []
      };

      let totalDays = Object.keys(trends).length;
      let totalCost = 0;
      let wasteTypeCounts = {};
      let ingredientWasteCounts = {};

      for (const [date, data] of Object.entries(trends)) {
        totalCost += data.totalCost;

        // Track waste type frequencies
        Object.entries(data.byType).forEach(([type, info]) => {
          wasteTypeCounts[type] = (wasteTypeCounts[type] || 0) + info.count;
        });

        // Track ingredient waste frequencies
        Object.entries(data.topWastedIngredients).forEach(([id, info]) => {
          ingredientWasteCounts[id] = {
            name: info.name,
            count: (ingredientWasteCounts[id]?.count || 0) + info.quantity
          };
        });

        // Track high waste days
        analysis.highestWasteDays.push({
          date,
          cost: data.totalCost,
          count: data.recordCount
        });
      }

      analysis.dailyAverageCost = totalCost / totalDays;
      analysis.mostCommonWasteType = Object.entries(wasteTypeCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0];
      analysis.mostWastedIngredient = Object.entries(ingredientWasteCounts)
        .sort((a, b) => b[1].count - a[1].count)[0]?.[1]?.name;

      analysis.highestWasteDays.sort((a, b) => b.cost - a.cost);
      analysis.highestWasteDays = analysis.highestWasteDays.slice(0, 5);

      // 5. Send response
      callback?.({
        success: true,
        data: {
          trends,
          analysis
        }
      });

    } catch (error) {
      console.error('Error getting waste trends:', error);
      callback?.({
        success: false,
        message: 'Failed to get waste trends',
        error: error.message
      });
    }
  });
};
