import { v4 as uuidv4 } from 'uuid';
import { validateUserSession } from './utils.js';
import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';

// Helper function to generate Excel file
const generateExcelFile = (data, filename) => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Analytics');
  
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
  inventoryTransactionsDB,
  ingredientsDB,
  menuItemsDB,
  sessionDB,
  logsDB
}) => {
  // Get Sales Analytics
  socket.on('analytics:getSales', async (data, callback) => {
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

      const startDate = data.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = data.endDate || new Date().toISOString();

      // Get all orders in date range
      const orders = await posDB.find({
        selector: {
          type: 'transaction',
          createdAt: {
            $gte: startDate,
            $lte: endDate
          },
          restaurantId: data.restaurantId,
          branchId: data.branchId
        }
      });

      // Calculate metrics
      const metrics = {
        totalSales: 0,
        orderCount: orders.docs.length,
        averageOrderValue: 0,
        topSellingItems: {},
        salesByHour: Array(24).fill(0),
        salesByDay: {},
      };

      for (const order of orders.docs) {
        metrics.totalSales += order.totalAmount;
        
        // Calculate sales by hour
        const orderHour = new Date(order.createdAt).getHours();
        metrics.salesByHour[orderHour] += order.totalAmount;

        // Calculate sales by day
        const orderDate = order.createdAt.split('T')[0];
        metrics.salesByDay[orderDate] = (metrics.salesByDay[orderDate] || 0) + order.totalAmount;

        // Track top selling items
        for (const item of order.orderItems) {
          metrics.topSellingItems[item.menuItemId] = (metrics.topSellingItems[item.menuItemId] || 0) + item.quantity;
        }
      }

      // Calculate average order value
      metrics.averageOrderValue = metrics.orderCount > 0 ? metrics.totalSales / metrics.orderCount : 0;

      // Get menu item details for top sellers
      const topItemIds = Object.keys(metrics.topSellingItems)
        .sort((a, b) => metrics.topSellingItems[b] - metrics.topSellingItems[a])
        .slice(0, 10);

      const topItems = await Promise.all(
        topItemIds.map(async id => {
          const menuItem = await menuItemsDB.get(id);
          return {
            id: menuItem._id,
            name: menuItem.name,
            quantity: metrics.topSellingItems[id],
            revenue: metrics.topSellingItems[id] * menuItem.price.regular
          };
        })
      );

      metrics.topSellingItems = topItems;

      callback?.({
        success: true,
        data: metrics
      });

    } catch (error) {
      console.error('Error getting sales analytics:', error);
      callback?.({
        success: false,
        message: 'Failed to get sales analytics',
        error: error.message
      });
    }
  });

  // Get Inventory Analytics
  socket.on('analytics:getInventory', async (data, callback) => {
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

      // Get all ingredients
      const ingredients = await ingredientsDB.find({
        selector: {
          restaurantId: data.restaurantId,
          branchId: data.branchId
        }
      });

      // Calculate inventory metrics
      const metrics = {
        totalItems: ingredients.docs.length,
        lowStockItems: [],
        inventoryValue: 0,
        wastageValue: 0,
        stockTurnover: {}
      };

      // Process each ingredient
      for (const ingredient of ingredients.docs) {
        // Calculate inventory value
        metrics.inventoryValue += ingredient.stockLevel * ingredient.unitCost;

        // Check for low stock
        if (ingredient.stockLevel <= ingredient.minimumThreshold) {
          metrics.lowStockItems.push({
            id: ingredient._id,
            name: ingredient.name,
            current: ingredient.stockLevel,
            minimum: ingredient.minimumThreshold,
            unit: ingredient.unit
          });
        }

        // Get ingredient transactions for turnover calculation
        const transactions = await inventoryTransactionsDB.find({
          selector: {
            ingredientId: ingredient._id,
            createdAt: {
              $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
            }
          }
        });

        // Calculate turnover
        const usage = transactions.docs.reduce((total, trans) => {
          return total + (trans.transactionType === 'Deduct' ? trans.quantity : 0);
        }, 0);

        metrics.stockTurnover[ingredient._id] = {
          name: ingredient.name,
          turnover: usage / (ingredient.stockLevel || 1)
        };
      }

      callback?.({
        success: true,
        data: metrics
      });

    } catch (error) {
      console.error('Error getting inventory analytics:', error);
      callback?.({
        success: false,
        message: 'Failed to get inventory analytics',
        error: error.message
      });
    }
  });

  // Get Predictive Analytics
  socket.on('analytics:getPredictions', async (data, callback) => {
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

      // Get historical orders for the last 90 days
      const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const orders = await posDB.find({
        selector: {
          type: 'transaction',
          createdAt: {
            $gte: startDate
          },
          restaurantId: data.restaurantId,
          branchId: data.branchId
        }
      });

      // Calculate predictions
      const predictions = {
        expectedSales: {},
        popularHours: {},
        inventoryNeeds: {},
        peakDays: {}
      };

      // Process historical data
      const salesByDay = {};
      const salesByHour = Array(24).fill(0);
      const dayCount = {};

      for (const order of orders.docs) {
        const date = new Date(order.createdAt);
        const day = date.getDay();
        const hour = date.getHours();

        // Track sales by day
        salesByDay[day] = (salesByDay[day] || 0) + order.totalAmount;
        dayCount[day] = (dayCount[day] || 0) + 1;

        // Track sales by hour
        salesByHour[hour] += order.totalAmount;
      }

      // Calculate average sales by day
      for (const day in salesByDay) {
        predictions.expectedSales[day] = salesByDay[day] / dayCount[day];
      }

      // Identify peak hours
      const hourlyAverage = salesByHour.map((total, hour) => ({
        hour,
        average: total / 90 // 90 days of data
      }));

      predictions.popularHours = hourlyAverage
        .sort((a, b) => b.average - a.average)
        .slice(0, 5);

      callback?.({
        success: true,
        data: predictions
      });

    } catch (error) {
      console.error('Error getting predictions:', error);
      callback?.({
        success: false,
        message: 'Failed to get predictions',
        error: error.message
      });
    }
  });

  // Export Sales Analytics
  socket.on('analytics:exportSales', async (data, callback) => {
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

      const startDate = data.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = data.endDate || new Date().toISOString();

      // Get sales data
      const orders = await posDB.find({
        selector: {
          type: 'transaction',
          createdAt: {
            $gte: startDate,
            $lte: endDate
          },
          restaurantId: data.restaurantId,
          branchId: data.branchId
        }
      });

      // Format data for Excel
      const excelData = [
        // Summary sheet
        {
          'Metric': 'Total Sales',
          'Value': orders.docs.reduce((sum, order) => sum + order.totalAmount, 0),
          'Period': `${startDate} to ${endDate}`
        },
        {
          'Metric': 'Total Orders',
          'Value': orders.docs.length,
          'Period': `${startDate} to ${endDate}`
        },
        {
          'Metric': 'Average Order Value',
          'Value': orders.docs.length > 0 ? 
            orders.docs.reduce((sum, order) => sum + order.totalAmount, 0) / orders.docs.length : 0,
          'Period': `${startDate} to ${endDate}`
        }
      ];

      // Add hourly sales data
      const hourlySales = Array(24).fill(0);
      orders.docs.forEach(order => {
        const hour = new Date(order.createdAt).getHours();
        hourlySales[hour] += order.totalAmount;
      });

      hourlySales.forEach((sales, hour) => {
        excelData.push({
          'Metric': `Sales at ${hour}:00`,
          'Value': sales,
          'Period': `${startDate} to ${endDate}`
        });
      });

      // Generate Excel file
      const filePath = generateExcelFile(excelData, 'sales_analytics');

      callback?.({
        success: true,
        message: 'Sales analytics exported successfully',
        filePath
      });

    } catch (error) {
      console.error('Error exporting sales analytics:', error);
      callback?.({
        success: false,
        message: 'Failed to export sales analytics',
        error: error.message
      });
    }
  });

  // Export Inventory Analytics
  socket.on('analytics:exportInventory', async (data, callback) => {
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
      const ingredients = await ingredientsDB.find({
        selector: {
          restaurantId: data.restaurantId,
          branchId: data.branchId
        }
      });

      // Format data for Excel
      const excelData = ingredients.docs.map(ingredient => {
        const transactions = inventoryTransactionsDB.find({
          selector: {
            ingredientId: ingredient._id,
            createdAt: {
              $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
            }
          }
        });

        const usage = transactions.docs.reduce((total, trans) => {
          return total + (trans.transactionType === 'Deduct' ? trans.quantity : 0);
        }, 0);

        return {
          'Ingredient ID': ingredient._id,
          'Name': ingredient.name,
          'Current Stock': ingredient.stockLevel,
          'Unit': ingredient.unit,
          'Unit Cost': ingredient.cost,
          'Total Value': ingredient.stockLevel * ingredient.cost,
          'Minimum Threshold': ingredient.minimumThreshold,
          '30-Day Usage': usage,
          'Turnover Rate': usage / (ingredient.stockLevel || 1),
          'Status': ingredient.stockLevel <= ingredient.minimumThreshold ? 'Low Stock' : 'OK'
        };
      });

      // Generate Excel file
      const filePath = generateExcelFile(excelData, 'inventory_analytics');

      callback?.({
        success: true,
        message: 'Inventory analytics exported successfully',
        filePath
      });

    } catch (error) {
      console.error('Error exporting inventory analytics:', error);
      callback?.({
        success: false,
        message: 'Failed to export inventory analytics',
        error: error.message
      });
    }
  });

  // Export Predictive Analytics
  socket.on('analytics:exportPredictions', async (data, callback) => {
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

      // Get historical data
      const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const orders = await posDB.find({
        selector: {
          type: 'transaction',
          createdAt: {
            $gte: startDate
          },
          restaurantId: data.restaurantId,
          branchId: data.branchId
        }
      });

      // Calculate predictions
      const salesByDay = {};
      const salesByHour = Array(24).fill(0);
      const dayCount = {};

      orders.docs.forEach(order => {
        const date = new Date(order.createdAt);
        const day = date.getDay();
        const hour = date.getHours();

        salesByDay[day] = (salesByDay[day] || 0) + order.totalAmount;
        dayCount[day] = (dayCount[day] || 0) + 1;
        salesByHour[hour] += order.totalAmount;
      });

      // Format data for Excel
      const excelData = [
        // Daily predictions
        {
          'Metric': 'Average Daily Sales',
          'Value': Object.values(salesByDay).reduce((sum, sales) => sum + sales, 0) / 
            Object.values(dayCount).reduce((sum, count) => sum + count, 0),
          'Period': 'Last 90 days'
        }
      ];

      // Add hourly predictions
      salesByHour.forEach((sales, hour) => {
        excelData.push({
          'Metric': `Average Sales at ${hour}:00`,
          'Value': sales / 90, // 90 days of data
          'Period': 'Last 90 days'
        });
      });

      // Generate Excel file
      const filePath = generateExcelFile(excelData, 'predictive_analytics');

      callback?.({
        success: true,
        message: 'Predictive analytics exported successfully',
        filePath
      });

    } catch (error) {
      console.error('Error exporting predictive analytics:', error);
      callback?.({
        success: false,
        message: 'Failed to export predictive analytics',
        error: error.message
      });
    }
  });
};
