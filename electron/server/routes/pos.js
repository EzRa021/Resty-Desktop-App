import { v4 as uuidv4 } from 'uuid';
import validator from 'validator';
import sanitizeHtml from 'sanitize-html';
import { validateUserSession } from './utils.js';
import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';

const generateOrderNumber = (prefix = 'ORD') => {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}${year}${month}${day}${random}`;
};

const validateOrder = async (data, menuItemsDB) => {
  const errors = [];
  const sanitizedData = {
    orderNumber: data.orderNumber || generateOrderNumber(),
    orderType: data.orderType || 'Dine-in',
    orderItems: [],
    customerInfo: {
      name: data.customerInfo?.name ? sanitizeHtml(data.customerInfo.name) : '',
      phone: data.customerInfo?.phone ? sanitizeHtml(data.customerInfo.phone) : '',
      email: data.customerInfo?.email ? sanitizeHtml(data.customerInfo.email) : '',
      address: data.customerInfo?.address ? sanitizeHtml(data.customerInfo.address) : ''
    },
    tableNumber: data.tableNumber ? Number(data.tableNumber) : null,
    serverName: data.serverName ? sanitizeHtml(data.serverName) : '',
    notes: data.notes ? sanitizeHtml(data.notes) : '',
    restaurantId: data.restaurantId,
    branchId: data.branchId
  };

  // Validate order items
  if (!Array.isArray(data.orderItems) || data.orderItems.length === 0) {
    errors.push('Order must contain at least one item');
    return { isValid: false, errors, sanitizedData };
  }

  // Validate and calculate totals
  let subtotal = 0;
  for (const item of data.orderItems) {
    try {
      const menuItem = await menuItemsDB.get(item.menuItemId);
      if (!menuItem) {
        errors.push(`Menu item not found: ${item.menuItemId}`);
        continue;
      }

      const itemSubtotal = item.quantity * (
        item.unitPrice || 
        menuItem.price.regular || 
        menuItem.price.special || 
        0
      );

      sanitizedData.orderItems.push({
        menuItemId: item.menuItemId,
        name: menuItem.name,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice || menuItem.price.regular),
        modifiers: Array.isArray(item.modifiers) ? item.modifiers : [],
        subtotal: itemSubtotal
      });

      subtotal += itemSubtotal;
    } catch (error) {
      errors.push(`Error validating menu item: ${error.message}`);
    }
  }

  // Calculate totals
  const tax = (data.tax || 0);
  const serviceCharge = (data.serviceCharge || 0);
  const discount = data.discount?.value || 0;
  const totalAmount = subtotal + tax + serviceCharge - discount;

  sanitizedData.subtotal = subtotal;
  sanitizedData.tax = tax;
  sanitizedData.serviceCharge = serviceCharge;
  sanitizedData.discount = data.discount || { type: 'fixed', value: 0 };
  sanitizedData.totalAmount = totalAmount;
  sanitizedData.paymentStatus = 'Pending';
  sanitizedData.paymentMethod = data.paymentMethod || 'Cash';
  sanitizedData.paymentDetails = data.paymentDetails || {};

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData
  };
};

// Paper size configurations
const PAPER_SIZES = {
  '80mm': {
    width: 80,
    charactersPerLine: 32,
    maxLogoWidth: 300,
    maxLogoHeight: 100
  },
  '58mm': {
    width: 58,
    charactersPerLine: 24,
    maxLogoWidth: 200,
    maxLogoHeight: 80
  },
  'A4': {
    width: 210,
    charactersPerLine: 80,
    maxLogoWidth: 500,
    maxLogoHeight: 200
  }
};

// Helper function to generate barcode
const generateBarcode = async (data) => {
  // Create SVG string directly
  const svgString = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
    <svg xmlns="http://www.w3.org/2000/svg" width="200" height="50">
      <rect x="0" y="0" width="200" height="50" fill="white"/>
      <text x="100" y="30" text-anchor="middle" font-family="monospace" font-size="12">${data}</text>
    </svg>`;
  
  // Convert SVG to PNG using sharp
  return await sharp(Buffer.from(svgString))
    .png()
    .toBuffer();
};

// Helper function to generate QR code
const generateQRCode = async (data) => {
  return await QRCode.toBuffer(data, {
    width: 200,
    margin: 1,
    color: {
      dark: '#000000',
      light: '#ffffff'
    }
  });
};

// Helper function to generate receipt
const generateReceipt = async (order, receiptSettings, posDB) => {
  const restaurant = await posDB.get(order.restaurantId);
  const branch = restaurant.branches.find(b => b._id === order.branchId);
  
  // Get receipt settings with defaults
  const settings = {
    paperSize: '80mm',
    showLogo: true,
    showAddress: true,
    showPhone: true,
    showTax: true,
    showDate: true,
    showTime: true,
    showOrderNumber: true,
    showCashier: true,
    showTable: true,
    showFooter: true,
    showBarcode: true,
    showQRCode: true,
    headerText: restaurant.name,
    footerText: 'Thank you for your business!',
    logoPosition: 'center',
    fontSize: 'normal',
    lineSpacing: 'normal',
    ...receiptSettings
  };

  // Get paper size configuration
  const paperConfig = PAPER_SIZES[settings.paperSize] || PAPER_SIZES['80mm'];
  const lineLength = paperConfig.charactersPerLine - 2;
  const line = '-'.repeat(lineLength);

  // Format date and time
  const orderDate = new Date(order.createdAt);
  const formattedDate = orderDate.toLocaleDateString();
  const formattedTime = orderDate.toLocaleTimeString();

  // Start building receipt
  let receipt = {
    text: '',
    images: []
  };

  // Add logo if enabled
  if (settings.showLogo && restaurant.logo) {
    const logoBuffer = await sharp(restaurant.logo)
      .resize(paperConfig.maxLogoWidth, paperConfig.maxLogoHeight, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .toBuffer();
    
    receipt.images.push({
      type: 'logo',
      data: logoBuffer,
      position: settings.logoPosition
    });
  }

  // Header
  receipt.text += `${settings.headerText}\n`;
  if (settings.showAddress) {
    receipt.text += `${branch.address}\n`;
  }
  if (settings.showPhone) {
    receipt.text += `${branch.phone}\n`;
  }
  receipt.text += `${line}\n`;

  // Order Information
  if (settings.showOrderNumber) {
    receipt.text += `Order #: ${order.orderNumber}\n`;
  }
  if (settings.showDate) {
    receipt.text += `Date: ${formattedDate}\n`;
  }
  if (settings.showTime) {
    receipt.text += `Time: ${formattedTime}\n`;
  }
  if (settings.showCashier) {
    receipt.text += `Cashier: ${order.cashier}\n`;
  }
  if (settings.showTable) {
    receipt.text += `Table: ${order.tableNumber}\n`;
  }
  receipt.text += `${line}\n`;

  // Items
  receipt.text += `ITEMS\n`;
  receipt.text += `${line}\n`;
  receipt.text += `QTY  ITEM                    PRICE    TOTAL\n`;
  receipt.text += `${line}\n`;

  order.orderItems.forEach(item => {
    const itemName = item.name.padEnd(25).substring(0, 25);
    const quantity = item.quantity.toString().padStart(3);
    const priceValue = (typeof item.unitPrice !== 'undefined' ? item.unitPrice : item.price);
    const price = (priceValue !== undefined ? priceValue : 0).toFixed(2).padStart(8);
    const subtotal = item.subtotal !== undefined ? item.subtotal.toFixed(2).padStart(8) : '0.00'.padStart(8);
    receipt.text += `${quantity}  ${itemName} ${price} ${subtotal}\n`;
  });

  receipt.text += `${line}\n`;

  // Totals
  receipt.text += `Subtotal:`.padEnd(30) + `${order.subtotal.toFixed(2)}\n`;
  if (settings.showTax) {
    receipt.text += `Tax:`.padEnd(30) + `${order.tax.toFixed(2)}\n`;
  }
  if (order.discount > 0) {
    receipt.text += `Discount:`.padEnd(30) + `${order.discount.toFixed(2)}\n`;
  }
  receipt.text += `Total:`.padEnd(30) + `${order.totalAmount.toFixed(2)}\n`;
  receipt.text += `${line}\n`;

  // Payment
  receipt.text += `Payment Method: ${order.paymentMethod}\n`;
  receipt.text += `${line}\n`;

  // Add barcode if enabled
  if (settings.showBarcode) {
    const barcodeData = await generateBarcode(order._id);
    receipt.images.push({
      type: 'barcode',
      data: barcodeData,
      position: 'center'
    });
  }

  // Footer
  if (settings.showFooter) {
    receipt.text += `${settings.footerText}\n`;
  }
  receipt.text += `${line}\n`;

  // Add QR code at the bottom if enabled
  if (settings.showQRCode) {
    const qrData = await generateQRCode(JSON.stringify({
      orderId: order._id,
      total: order.totalAmount,
      date: order.createdAt
    }));
    receipt.images.push({
      type: 'qrcode',
      data: qrData,
      position: 'center'
    });
  }

  return receipt;
};

// Helper function to save logo
const saveLogo = async (logoData, restaurantId) => {
  try {
    // Create logos directory if it doesn't exist
    const logosDir = path.join(process.cwd(), 'logos');
    if (!fs.existsSync(logosDir)) {
      fs.mkdirSync(logosDir);
    }

    // Convert base64 to buffer
    const base64Data = logoData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Process image with sharp
    const processedImage = await sharp(buffer)
      .resize(300, 300, { // Standard receipt logo size
        fit: 'inside',
        withoutEnlargement: true
      })
      .toBuffer();

    // Save processed image
    const logoPath = path.join(logosDir, `${restaurantId}.png`);
    fs.writeFileSync(logoPath, processedImage);

    return logoPath;
  } catch (error) {
    console.error('Error saving logo:', error);
    throw error;
  }
};

export const registerSocketEvents = (socket, {
  db: posDB,
  menuItemsDB,
  ingredientsDB,
  sessionDB,
  logsDB,
  notificationsDB
}) => {
  if (!posDB || !menuItemsDB || !sessionDB || !notificationsDB) {
    console.error('Missing required database dependencies for POS routes');
    return;
  }

  // Create Order
  socket.on('pos:createOrder', async (data, callback) => {
    console.log('Creating POS order:', { ...data, sessionId: '[REDACTED]' });
    try {
      // 1. Validate session and permissions
      const sessionValidation = await validateUserSession(
        data.sessionId,
        ['owner', 'manager', 'admin', 'cashier'],
        sessionDB
      );

      if (!sessionValidation.valid) {
        console.error('Session validation failed:', sessionValidation.message);
        return callback?.({
          success: false,
          message: sessionValidation.message
        });
      }

      // 2. Validate order data
      const validationResult = await validateOrder(data, menuItemsDB);
      if (!validationResult.isValid) {
        console.error('Order validation failed:', validationResult.errors);
        return callback?.({
          success: false,
          message: 'Validation failed',
          errors: validationResult.errors
        });
      }

      // 3. Create order document
      const order = {
        _id: `order_${uuidv4()}`,
        type: 'transaction',
        ...validationResult.sanitizedData,
        createdBy: sessionValidation.user._id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // 4. Save to database
      await posDB.put(order);
      console.log('Order created:', order._id);

      // 5. Update inventory
      const inventoryUpdates = order.orderItems.map(async (item) => {
        try {
          const menuItem = await menuItemsDB.get(item.menuItemId);
          if (menuItem.ingredients) {
            for (const ingredient of menuItem.ingredients) {
              // Deduct ingredients based on quantity ordered
              const deduction = ingredient.quantity * item.quantity;
              const currentIngredient = await ingredientsDB.get(ingredient.ingredientId);
              await ingredientsDB.put({
                ...currentIngredient,
                stockLevel: currentIngredient.stockLevel - deduction,
                updatedAt: new Date().toISOString()
              });
            }
          }
        } catch (error) {
          console.error(`Failed to update inventory for item ${item.menuItemId}:`, error);
        }
      });

      await Promise.all(inventoryUpdates);

      // 6. Log the action
      await logsDB.put({
        _id: `log_${uuidv4()}`,
        type: 'log',
        category: 'pos',
        action: 'create',
        orderId: order._id,
        userId: sessionValidation.user._id,
        restaurantId: data.restaurantId,
        branchId: data.branchId,
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `Order created: ${order.orderNumber}`
      });      // 7. Create notification for kitchen staff
      const kitchenNotification = {
        _id: `notification_${uuidv4()}`,
        type: 'new_order',
        message: `New Order #${order.orderNumber} - ${order.orderItems.length} items`,
        priority: 'high',
        metadata: {
          orderId: order._id,
          orderNumber: order.orderNumber,
          orderType: order.orderType,
          items: order.orderItems.map(item => ({
            name: item.name,
            quantity: item.quantity
          }))
        },
        createdAt: new Date().toISOString(),
        read: false,
        targetUsers: ['kitchen_staff', 'manager']
      };
      
      await notificationsDB.put(kitchenNotification);

      // 8. Emit events to other clients and show desktop notification
      socket.broadcast.emit('pos:orderCreated', order);
      socket.broadcast.to('notification:new_order').emit('notifications:new', kitchenNotification);
      
      // Send desktop notification
      socket.emit('show-notification', {
        title: 'New Order',
        body: `Order #${order.orderNumber} - ${order.orderItems.length} items\n${order.orderItems.map(item => `${item.quantity}x ${item.name}`).join('\n')}`,
        urgency: 'critical',
        onClick: () => {
          // This will focus the window when notification is clicked
          mainWindow?.focus();
        }
      });

      // 9. Send success response
      callback?.({
        success: true,
        message: 'Order created successfully',
        data: order
      });

    } catch (error) {
      console.error('Error creating order:', error);
      callback?.({
        success: false,
        message: 'Failed to create order',
        error: error.message
      });

      // Log error
      try {
        await logsDB.put({
          _id: `log_${uuidv4()}`,
          type: 'log',
          category: 'pos',
          action: 'create',
          error: error.message,
          timestamp: new Date().toISOString(),
          level: 'error',
          message: `Failed to create order: ${error.message}`
        });
      } catch (logError) {
        console.error('Failed to log error:', logError);
      }
    }
  });

  // Update Order Status
  socket.on('pos:updateOrderStatus', async (data, callback) => {
    console.log('Updating order status:', { orderId: data.orderId, status: data.status });
    try {
      // 1. Validate session and permissions
      const sessionValidation = await validateUserSession(
        data.sessionId,
        ['owner', 'manager', 'admin', 'cashier'],
        sessionDB
      );

      if (!sessionValidation.valid) {
        return callback?.({
          success: false,
          message: sessionValidation.message
        });
      }

      // 2. Get and update order
      const order = await posDB.get(data.orderId);
      const updatedOrder = {
        ...order,
        paymentStatus: data.status,
        paymentDetails: data.paymentDetails || order.paymentDetails,
        updatedAt: new Date().toISOString(),
        updatedBy: sessionValidation.user._id
      };

      // 3. Save changes
      await posDB.put(updatedOrder);

      // 4. Log the action
      await logsDB.put({
        _id: `log_${uuidv4()}`,
        type: 'log',
        category: 'pos',
        action: 'updateStatus',
        orderId: order._id,
        userId: sessionValidation.user._id,
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `Order ${order.orderNumber} status updated to ${data.status}`
      });

      // 5. Emit event to other clients
      socket.broadcast.emit('pos:orderUpdated', updatedOrder);

      // 6. Send success response
      callback?.({
        success: true,
        message: 'Order status updated successfully',
        data: updatedOrder
      });

    } catch (error) {
      console.error('Error updating order status:', error);
      callback?.({
        success: false,
        message: 'Failed to update order status',
        error: error.message
      });
    }
  });

  // List Orders
  socket.on('pos:listOrders', async (data, callback) => {
    try {
      // 1. Validate session
      const sessionValidation = await validateUserSession(
        data.sessionId,
        ['owner', 'manager', 'admin', 'cashier'],
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
          type: 'transaction',
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

      // Add status filter if provided
      if (data.status) {
        query.selector.paymentStatus = data.status;
      }

      // 3. Execute query
      const result = await posDB.find(query);

      // 4. Send response
      callback?.({
        success: true,
        data: {
          orders: result.docs,
          total: result.docs.length,
          hasMore: result.docs.length === (data.limit || 50)
        }
      });

    } catch (error) {
      console.error('Error listing orders:', error);
      callback?.({
        success: false,
        message: 'Failed to list orders',
        error: error.message
      });
    }
  });

  // Get Order Details
  socket.on('pos:getOrder', async (data, callback) => {
    try {
      // 1. Validate session
      const sessionValidation = await validateUserSession(
        data.sessionId,
        ['owner', 'manager', 'admin', 'cashier'],
        sessionDB
      );

      if (!sessionValidation.valid) {
        return callback?.({
          success: false,
          message: sessionValidation.message
        });
      }

      // 2. Get order
      const order = await posDB.get(data.orderId);

      // 3. Send response
      callback?.({
        success: true,
        data: order
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

  // Save Receipt Settings
  socket.on('pos:saveReceiptSettings', async (data, callback) => {
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

      const restaurant = await posDB.get(data.restaurantId);
      if (!restaurant) {
        return callback?.({
          success: false,
          message: 'Restaurant not found'
        });
      }

      // Update receipt settings
      restaurant.receiptSettings = {
        ...restaurant.receiptSettings,
        ...data.settings
      };

      // Save logo if provided
      if (data.logo) {
        const logoPath = await saveLogo(data.logo, restaurant._id);
        restaurant.receiptSettings.logoPath = logoPath;
      }

      await posDB.put(restaurant);

      callback?.({
        success: true,
        message: 'Receipt settings saved successfully'
      });

    } catch (error) {
      console.error('Error saving receipt settings:', error);
      callback?.({
        success: false,
        message: 'Failed to save receipt settings',
        error: error.message
      });
    }
  });

  // Get Receipt Settings
  socket.on('pos:getReceiptSettings', async (data, callback) => {
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

      const restaurant = await posDB.get(data.restaurantId);
      if (!restaurant) {
        return callback?.({
          success: false,
          message: 'Restaurant not found'
        });
      }

      callback?.({
        success: true,
        data: restaurant.receiptSettings || {}
      });

    } catch (error) {
      console.error('Error getting receipt settings:', error);
      callback?.({
        success: false,
        message: 'Failed to get receipt settings',
        error: error.message
      });
    }
  });

  // Generate Receipt
  socket.on('pos:generateReceipt', async (data, callback) => {
    try {
      const sessionValidation = await validateUserSession(
        data.sessionId,
        ['owner', 'manager', 'admin', 'cashier'],
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

      const restaurant = await posDB.get(order.restaurantId);
      const receipt = await generateReceipt(
        order,
        restaurant.receiptSettings,
        posDB
      );

      // Save receipt to file
      const receiptsDir = path.join(process.cwd(), 'receipts');
      if (!fs.existsSync(receiptsDir)) {
        fs.mkdirSync(receiptsDir);
      }

      const filePath = path.join(receiptsDir, `receipt_${order._id}_${new Date().toISOString().split('T')[0]}.txt`);
      fs.writeFileSync(filePath, receipt.text);

      callback?.({
        success: true,
        message: 'Receipt generated successfully',
        data: {
          text: receipt.text,
          filePath
        }
      });

    } catch (error) {
      console.error('Error generating receipt:', error);
      callback?.({
        success: false,
        message: 'Failed to generate receipt',
        error: error.message
      });
    }
  });

  // Generate Receipt Preview
  socket.on('pos:generateReceiptPreview', async (data, callback) => {
    try {
      const sessionValidation = await validateUserSession(
        data.sessionId,
        ['owner', 'manager', 'admin', 'cashier'],
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

      const restaurant = await posDB.get(order.restaurantId);
      const receipt = await generateReceipt(
        order,
        {
          ...restaurant.receiptSettings,
          ...data.previewSettings
        },
        posDB
      );

      // Convert images to base64 for preview
      const images = await Promise.all(receipt.images.map(async (image) => ({
        ...image,
        data: `data:image/png;base64,${image.data.toString('base64')}`
      })));

      callback?.({
        success: true,
        data: {
          text: receipt.text,
          images,
          paperSize: data.previewSettings?.paperSize || restaurant.receiptSettings?.paperSize || '80mm'
        }
      });

    } catch (error) {
      console.error('Error generating receipt preview:', error);
      callback?.({
        success: false,
        message: 'Failed to generate receipt preview',
        error: error.message
      });
    }
  });
}

// HTTP route plugin
export default async function orderRoutes(fastify, options) {
  // Register routes
  fastify.get('/api/orders', async (request, reply) => {
    try {
      const orders = await request.databases.posDB.allDocs({ include_docs: true });
      return orders.rows.map(row => row.doc);
    } catch (error) {
      reply.status(500).send({ error: error.message });
    }
  });

  fastify.post('/api/orders', async (request, reply) => {
    try {
      const result = await request.databases.posDB.post(request.body);
      return { id: result.id, ...request.body };
    } catch (error) {
      reply.status(500).send({ error: error.message });
    }
  });

  fastify.put('/api/orders/:id', async (request, reply) => {
    try {
      const existing = await request.databases.posDB.get(request.params.id);
      const result = await request.databases.posDB.put({
        ...existing,
        ...request.body,
        _id: request.params.id,
        _rev: existing._rev
      });
      return result;
    } catch (error) {
      reply.status(500).send({ error: error.message });
    }
  });
}

export { generateReceipt };
