import PouchDB from 'pouchdb';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { generateReceipt } from './electron/server/routes/pos.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Create test databases
const posDB = new PouchDB(path.join(__dirname, 'dev-databases/pos'));

// Create receipts directory if it doesn't exist
const receiptsDir = path.join(__dirname, 'receipts');
if (!fs.existsSync(receiptsDir)) {
  fs.mkdirSync(receiptsDir);
}

// Helper function to center text
function centerText(text, width = 40) {
  const padding = Math.max(0, Math.floor((width - text.length) / 2));
  return ' '.repeat(padding) + text;
}

// Helper function to right-align text
function rightAlign(text, width = 40) {
  const padding = Math.max(0, width - text.length);
  return ' '.repeat(padding) + text;
}

// Helper function to format currency
function formatCurrency(amount) {
  return amount.toFixed(2);
}

// Test order data
const testOrder = {
  _id: 'order_test123',
  type: 'transaction',
  orderNumber: 'ORD2403150001',
  orderType: 'Dine-in',
  orderItems: [
    {
      menuItemId: 'item1',
      name: 'Test Item 1',
      quantity: 2,
      unitPrice: 10.99,
      subtotal: 21.98
    },
    {
      menuItemId: 'item2',
      name: 'Test Item 2',
      quantity: 1,
      unitPrice: 15.99,
      subtotal: 15.99
    }
  ],
  customerInfo: {
    name: 'John Doe',
    phone: '123-456-7890',
    email: 'john@example.com'
  },
  tableNumber: 5,
  serverName: 'Test Server',
  notes: 'Test order notes',
  restaurantId: 'restaurant_test123',
  branchId: 'branch_test123',
  subtotal: 37.97,
  tax: 3.80,
  serviceCharge: 0,
  discount: { type: 'fixed', value: 0 },
  totalAmount: 41.77,
  paymentStatus: 'Completed',
  paymentMethod: 'Credit Card',
  createdBy: 'user_test123',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

// Test restaurant data
const testRestaurant = {
  _id: 'restaurant_test123',
  name: 'Test Restaurant',
  branches: [
    {
      _id: 'branch_test123',
      name: 'Test Branch',
      address: '123 Test St, Test City',
      phone: '555-0123'
    }
  ],
  receiptSettings: {
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
    showCustomer: true,
    showNotes: true,
    showFooter: true,
    showBarcode: true,
    showQRCode: true,
    headerText: 'Test Restaurant',
    footerText: 'Thank you for your business!',
    logoPosition: 'center',
    fontSize: 'normal',
    lineSpacing: 'normal'
  }
};

async function safePut(db, doc) {
  try {
    const existing = await db.get(doc._id);
    await db.remove(existing);
  } catch (err) {
    // Document does not exist, ignore
  }
  await db.put(doc);
}

async function testReceiptGeneration() {
  try {
    // Save test data to database (remove if exists)
    await safePut(posDB, testRestaurant);
    await safePut(posDB, testOrder);

    console.log('Test data saved to database');

    // Generate receipt
    const receipt = await generateReceipt(testOrder, testRestaurant.receiptSettings, posDB);

    // Format receipt text with proper alignment
    const formattedReceipt = [
      centerText('='.repeat(40)),
      centerText(testRestaurant.name),
      centerText(testRestaurant.branches[0].address),
      centerText(testRestaurant.branches[0].phone),
      centerText('='.repeat(40)),
      centerText(`Order #: ${testOrder.orderNumber}`),
      centerText(`Date: ${new Date(testOrder.createdAt).toLocaleDateString()}`),
      centerText(`Time: ${new Date(testOrder.createdAt).toLocaleTimeString()}`),
      centerText(`Server: ${testOrder.serverName}`),
      centerText(`Table: ${testOrder.tableNumber}`),
      centerText('-'.repeat(40)),
      'ITEM'.padEnd(20) + 'QTY'.padStart(5) + 'PRICE'.padStart(15),
      '-'.repeat(40),
      ...testOrder.orderItems.map(item => {
        const itemLine = item.name.padEnd(20) + 
                        item.quantity.toString().padStart(5) + 
                        formatCurrency(item.unitPrice).padStart(15);
        const subtotalLine = ' '.repeat(20) + 
                           ' '.repeat(5) + 
                           formatCurrency(item.subtotal).padStart(15);
        return [itemLine, subtotalLine];
      }).flat(),
      '-'.repeat(40),
      'Subtotal:'.padEnd(25) + formatCurrency(testOrder.subtotal).padStart(15),
      'Tax:'.padEnd(25) + formatCurrency(testOrder.tax).padStart(15),
      'Total:'.padEnd(25) + formatCurrency(testOrder.totalAmount).padStart(15),
      '-'.repeat(40),
      centerText(`Payment: ${testOrder.paymentMethod}`),
      centerText(`Status: ${testOrder.paymentStatus}`),
      centerText('='.repeat(40)),
      centerText(testRestaurant.receiptSettings.footerText),
      centerText('='.repeat(40))
    ].join('\n');

    // Save formatted receipt text to file
    const receiptTextPath = path.join(receiptsDir, `receipt_${testOrder._id}.txt`);
    fs.writeFileSync(receiptTextPath, formattedReceipt);
    console.log(`\nReceipt text saved to: ${receiptTextPath}`);

    // Save receipt images to files
    receipt.images.forEach((image, index) => {
      const imagePath = path.join(receiptsDir, `receipt_${testOrder._id}_${image.type}.png`);
      fs.writeFileSync(imagePath, image.data);
      console.log(`Image saved to: ${imagePath}`);
    });

    // Log formatted receipt text
    console.log('\nGenerated Receipt:');
    console.log('----------------');
    console.log(formattedReceipt);

    // Log receipt images
    console.log('\nReceipt Images:');
    console.log('---------------');
    receipt.images.forEach((image, index) => {
      console.log(`Image ${index + 1}: Type=${image.type}, Position=${image.position}`);
    });

    console.log('\nReceipt generation test completed successfully');
  } catch (error) {
    console.error('Error testing receipt generation:', error);
  }
}

// Run the test
testReceiptGeneration(); 