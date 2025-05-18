import { v4 as uuidv4 } from 'uuid';
import { validateUserSession } from './utils.js';
import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';

// Helper function to group data by date
const groupByDate = (data, dateField) => {
  return data.reduce((acc, item) => {
    const date = item[dateField].split('T')[0];
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(item);
    return acc;
  }, {});
};

// Helper function to calculate sales metrics
const calculateSalesMetrics = (orders) => {
  return orders.reduce((metrics, order) => {
    if (order.paymentStatus === 'Completed') {
      metrics.totalSales += order.totalAmount;
      metrics.totalOrders += 1;
      metrics.itemsSold += order.orderItems.reduce((sum, item) => sum + item.quantity, 0);
    }
    if (order.paymentStatus === 'Cancelled') {
      metrics.cancelledOrders += 1;
    }
    return metrics;
  }, {
    totalSales: 0,
    totalOrders: 0,
    itemsSold: 0,
    cancelledOrders: 0
  });
};

// Helper function to analyze inventory movements
const analyzeInventoryMovements = (transactions) => {
  return transactions.reduce((analysis, transaction) => {
    const type = transaction.transactionType;
    if (type === 'Spoilage') {
      analysis.totalSpoilage += transaction.quantity * transaction.cost;
      analysis.spoiledItems += transaction.quantity;
    } else if (type === 'Add') {
      analysis.totalPurchases += transaction.quantity * transaction.cost;
    }
    return analysis;
  }, {
    totalSpoilage: 0,
    spoiledItems: 0,
    totalPurchases: 0
  });
};

// Helper function to generate Excel file
const generateExcelFile = (data, filename) => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');
  
  // Create exports directory if it doesn't exist
  const exportDir = path.join(process.cwd(), 'exports');
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir);
  }
  
  const filePath = path.join(exportDir, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
  XLSX.writeFile(workbook, filePath);
  return filePath;
};

export const registerSocketEvents = (socket, {
  posDB,
  menuItemsDB,
  inventoryTransactionsDB,
  ingredientsDB,
  sessionDB,
  logsDB
}) => {
  if (!posDB || !menuItemsDB || !inventoryTransactionsDB || !sessionDB) {
    console.error('Missing required database dependencies for reports routes');
    return;
  }

  // Generate Sales Report
  socket.on('reports:getSalesReport', async (data, callback) => {
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

      // 2. Query orders within date range
      const ordersResult = await posDB.find({
        selector: {
          type: 'transaction',
          restaurantId: data.restaurantId,
          branchId: data.branchId,
          createdAt: {
            $gte: data.startDate,
            $lte: data.endDate
          }
        }
      });

      // 3. Group orders by date
      const ordersByDate = groupByDate(ordersResult.docs, 'createdAt');

      // 4. Calculate daily metrics
      const dailyMetrics = {};
      for (const [date, orders] of Object.entries(ordersByDate)) {
        dailyMetrics[date] = calculateSalesMetrics(orders);
      }

      // 5. Calculate top-selling items
      const itemSales = {};
      for (const order of ordersResult.docs) {
        if (order.paymentStatus === 'Completed') {
          for (const item of order.orderItems) {
            if (!itemSales[item.menuItemId]) {
              itemSales[item.menuItemId] = {
                name: item.name,
                quantity: 0,
                revenue: 0
              };
            }
            itemSales[item.menuItemId].quantity += item.quantity;
            itemSales[item.menuItemId].revenue += item.subtotal;
          }
        }
      }

      const topSellingItems = Object.entries(itemSales)
        .map(([id, data]) => ({
          menuItemId: id,
          ...data
        }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 10);

      // 6. Send response
      callback?.({
        success: true,
        data: {
          dailyMetrics,
          topSellingItems,
          periodTotals: Object.values(dailyMetrics).reduce((totals, metrics) => ({
            totalSales: totals.totalSales + metrics.totalSales,
            totalOrders: totals.totalOrders + metrics.totalOrders,
            itemsSold: totals.itemsSold + metrics.itemsSold,
            cancelledOrders: totals.cancelledOrders + metrics.cancelledOrders
          }), {
            totalSales: 0,
            totalOrders: 0,
            itemsSold: 0,
            cancelledOrders: 0
          })
        }
      });

    } catch (error) {
      console.error('Error generating sales report:', error);
      callback?.({
        success: false,
        message: 'Failed to generate sales report',
        error: error.message
      });
    }
  });

  // Generate Inventory Report
  socket.on('reports:getInventoryReport', async (data, callback) => {
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

      // 2. Query inventory transactions
      const transactionsResult = await inventoryTransactionsDB.find({
        selector: {
          type: 'inventoryTransaction',
          restaurantId: data.restaurantId,
          branchId: data.branchId,
          createdAt: {
            $gte: data.startDate,
            $lte: data.endDate
          }
        }
      });

      // 3. Group transactions by date
      const transactionsByDate = groupByDate(transactionsResult.docs, 'createdAt');

      // 4. Calculate daily metrics
      const dailyMetrics = {};
      for (const [date, transactions] of Object.entries(transactionsByDate)) {
        dailyMetrics[date] = analyzeInventoryMovements(transactions);
      }

      // 5. Get current inventory levels
      const ingredientsResult = await ingredientsDB.find({
        selector: {
          type: 'ingredient',
          restaurantId: data.restaurantId,
          branchId: data.branchId
        }
      });

      // 6. Identify low stock items
      const lowStockItems = ingredientsResult.docs
        .filter(ingredient => ingredient.stockLevel <= ingredient.minimumThreshold)
        .map(ingredient => ({
          ingredientId: ingredient._id,
          name: ingredient.name,
          currentStock: ingredient.stockLevel,
          minimumThreshold: ingredient.minimumThreshold,
          unit: ingredient.unit
        }));

      // 7. Send response
      callback?.({
        success: true,
        data: {
          dailyMetrics,
          lowStockItems,
          periodTotals: Object.values(dailyMetrics).reduce((totals, metrics) => ({
            totalSpoilage: totals.totalSpoilage + metrics.totalSpoilage,
            spoiledItems: totals.spoiledItems + metrics.spoiledItems,
            totalPurchases: totals.totalPurchases + metrics.totalPurchases
          }), {
            totalSpoilage: 0,
            spoiledItems: 0,
            totalPurchases: 0
          }),
          currentInventoryValue: ingredientsResult.docs.reduce(
            (total, ingredient) => total + (ingredient.stockLevel * ingredient.cost),
            0
          )
        }
      });

    } catch (error) {
      console.error('Error generating inventory report:', error);
      callback?.({
        success: false,
        message: 'Failed to generate inventory report',
        error: error.message
      });
    }
  });

  // Generate Performance Metrics
  socket.on('reports:getPerformanceMetrics', async (data, callback) => {
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

      // 2. Query orders and inventory transactions
      const [ordersResult, transactionsResult] = await Promise.all([
        posDB.find({
          selector: {
            type: 'transaction',
            restaurantId: data.restaurantId,
            branchId: data.branchId,
            createdAt: {
              $gte: data.startDate,
              $lte: data.endDate
            }
          }
        }),
        inventoryTransactionsDB.find({
          selector: {
            type: 'inventoryTransaction',
            restaurantId: data.restaurantId,
            branchId: data.branchId,
            createdAt: {
              $gte: data.startDate,
              $lte: data.endDate
            }
          }
        })
      ]);

      // 3. Calculate key performance indicators
      const orders = ordersResult.docs;
      const transactions = transactionsResult.docs;

      const salesMetrics = calculateSalesMetrics(orders);
      const inventoryMetrics = analyzeInventoryMovements(transactions);

      const averageOrderValue = salesMetrics.totalOrders > 0 
        ? salesMetrics.totalSales / salesMetrics.totalOrders 
        : 0;

      const spoilageRate = inventoryMetrics.totalPurchases > 0
        ? (inventoryMetrics.totalSpoilage / inventoryMetrics.totalPurchases) * 100
        : 0;

      // 4. Send response
      callback?.({
        success: true,
        data: {
          kpis: {
            totalRevenue: salesMetrics.totalSales,
            totalOrders: salesMetrics.totalOrders,
            averageOrderValue,
            itemsSoldPerOrder: salesMetrics.totalOrders > 0 
              ? salesMetrics.itemsSold / salesMetrics.totalOrders 
              : 0,
            cancelRate: salesMetrics.totalOrders > 0
              ? (salesMetrics.cancelledOrders / salesMetrics.totalOrders) * 100
              : 0,
            spoilageRate,
            inventoryTurnover: inventoryMetrics.totalPurchases > 0
              ? salesMetrics.totalSales / inventoryMetrics.totalPurchases
              : 0
          },
          trends: {
            dailySales: groupByDate(orders, 'createdAt'),
            dailyInventory: groupByDate(transactions, 'createdAt')
          }
        }
      });

    } catch (error) {
      console.error('Error generating performance metrics:', error);
      callback?.({
        success: false,
        message: 'Failed to generate performance metrics',
        error: error.message
      });
    }
  });

  // Export Sales Report
  socket.on('reports:exportSales', async (data, callback) => {
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

      // Get sales data
      const ordersResult = await posDB.find({
        selector: {
          type: 'transaction',
          restaurantId: data.restaurantId,
          branchId: data.branchId,
          createdAt: {
            $gte: data.startDate,
            $lte: data.endDate
          }
        }
      });

      // Format data for Excel
      const excelData = ordersResult.docs.map(order => ({
        'Order ID': order._id,
        'Date': new Date(order.createdAt).toLocaleDateString(),
        'Time': new Date(order.createdAt).toLocaleTimeString(),
        'Total Amount': order.totalAmount,
        'Payment Method': order.paymentMethod,
        'Items': order.orderItems.map(item => item.name).join(', '),
        'Status': order.status
      }));

      // Generate Excel file
      const filePath = generateExcelFile(excelData, 'sales_report');

      callback?.({
        success: true,
        message: 'Sales report exported successfully',
        filePath
      });

    } catch (error) {
      console.error('Error exporting sales report:', error);
      callback?.({
        success: false,
        message: 'Failed to export sales report',
        error: error.message
      });
    }
  });

  // Export Inventory Report
  socket.on('reports:exportInventory', async (data, callback) => {
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

      // Get inventory data
      const [transactionsResult, ingredientsResult] = await Promise.all([
        inventoryTransactionsDB.find({
          selector: {
            type: 'inventoryTransaction',
            restaurantId: data.restaurantId,
            branchId: data.branchId,
            createdAt: {
              $gte: data.startDate,
              $lte: data.endDate
            }
          }
        }),
        ingredientsDB.find({
          selector: {
            type: 'ingredient',
            restaurantId: data.restaurantId,
            branchId: data.branchId
          }
        })
      ]);

      // Format data for Excel
      const excelData = ingredientsResult.docs.map(ingredient => {
        const transactions = transactionsResult.docs.filter(t => t.ingredientId === ingredient._id);
        const totalIn = transactions.filter(t => t.transactionType === 'Add')
          .reduce((sum, t) => sum + t.quantity, 0);
        const totalOut = transactions.filter(t => t.transactionType === 'Deduct')
          .reduce((sum, t) => sum + t.quantity, 0);

        return {
          'Ingredient ID': ingredient._id,
          'Name': ingredient.name,
          'Current Stock': ingredient.stockLevel,
          'Unit': ingredient.unit,
          'Total Received': totalIn,
          'Total Used': totalOut,
          'Cost per Unit': ingredient.cost,
          'Total Value': ingredient.stockLevel * ingredient.cost,
          'Minimum Threshold': ingredient.minimumThreshold,
          'Status': ingredient.stockLevel <= ingredient.minimumThreshold ? 'Low Stock' : 'OK'
        };
      });

      // Generate Excel file
      const filePath = generateExcelFile(excelData, 'inventory_report');

      callback?.({
        success: true,
        message: 'Inventory report exported successfully',
        filePath
      });

    } catch (error) {
      console.error('Error exporting inventory report:', error);
      callback?.({
        success: false,
        message: 'Failed to export inventory report',
        error: error.message
      });
    }
  });

  // Export Performance Report
  socket.on('reports:exportPerformance', async (data, callback) => {
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

      // Get performance data
      const [ordersResult, transactionsResult] = await Promise.all([
        posDB.find({
          selector: {
            type: 'transaction',
            restaurantId: data.restaurantId,
            branchId: data.branchId,
            createdAt: {
              $gte: data.startDate,
              $lte: data.endDate
            }
          }
        }),
        inventoryTransactionsDB.find({
          selector: {
            type: 'inventoryTransaction',
            restaurantId: data.restaurantId,
            branchId: data.branchId,
            createdAt: {
              $gte: data.startDate,
              $lte: data.endDate
            }
          }
        })
      ]);

      // Calculate metrics
      const salesMetrics = calculateSalesMetrics(ordersResult.docs);
      const inventoryMetrics = analyzeInventoryMovements(transactionsResult.docs);

      // Format data for Excel
      const excelData = [
        {
          'Metric': 'Total Sales',
          'Value': salesMetrics.totalSales,
          'Period': `${data.startDate} to ${data.endDate}`
        },
        {
          'Metric': 'Total Orders',
          'Value': salesMetrics.totalOrders,
          'Period': `${data.startDate} to ${data.endDate}`
        },
        {
          'Metric': 'Average Order Value',
          'Value': salesMetrics.totalOrders > 0 ? salesMetrics.totalSales / salesMetrics.totalOrders : 0,
          'Period': `${data.startDate} to ${data.endDate}`
        },
        {
          'Metric': 'Total Inventory Value',
          'Value': inventoryMetrics.totalPurchases,
          'Period': `${data.startDate} to ${data.endDate}`
        },
        {
          'Metric': 'Total Spoilage',
          'Value': inventoryMetrics.totalSpoilage,
          'Period': `${data.startDate} to ${data.endDate}`
        },
        {
          'Metric': 'Spoilage Rate',
          'Value': inventoryMetrics.totalPurchases > 0 ? 
            (inventoryMetrics.totalSpoilage / inventoryMetrics.totalPurchases) * 100 : 0,
          'Period': `${data.startDate} to ${data.endDate}`
        }
      ];

      // Generate Excel file
      const filePath = generateExcelFile(excelData, 'performance_report');

      callback?.({
        success: true,
        message: 'Performance report exported successfully',
        filePath
      });

    } catch (error) {
      console.error('Error exporting performance report:', error);
      callback?.({
        success: false,
        message: 'Failed to export performance report',
        error: error.message
      });
    }
  });
};
