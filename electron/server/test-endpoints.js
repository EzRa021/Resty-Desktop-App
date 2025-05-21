import { testData } from './test-data.js';
// import { initializeDatabases } from './utils/database.js'; // Removed to avoid DB lock
import { io as Client } from 'socket.io-client';

const testEndpoints = async () => {
  console.log('\n=== Testing Endpoints ===');
  console.log('Timestamp:', new Date().toISOString());

  try {

    // Connect to WebSocket server
    console.log('\n=== Testing WebSocket Connection ===');
    const socket = Client('http://localhost:8000', {
      transports: ['websocket'],
      reconnection: false
    });

    // Set up socket event handlers
    socket.on('connect', () => {
      console.log('✓ WebSocket connected successfully');
    });

    socket.on('connect_error', (error) => {
      console.error('✗ WebSocket connection failed:', error.message);
    });

    socket.on('sync:status', (data) => {
      console.log('Sync status update:', data);
    });

    // Wait for connection
    await new Promise((resolve) => {
      if (socket.connected) {
        resolve();
      } else {
        socket.once('connect', resolve);
      }
    });

    // Test Categories
    console.log('\n=== Testing Categories via WebSocket ===');
    try {
      // First check if categories exist
      const existingCategories = await new Promise((resolve, reject) => {
        socket.emit('category:getAll', { type: 'category' }, (response) => {
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response);
          }
        });
      });

      if (existingCategories.length === 0) {
        // Create categories only if none exist
        const categoriesResult = await new Promise((resolve, reject) => {
          socket.emit('category:create', testData.categories, (response) => {
            if (response.error) {
              reject(new Error(response.error));
            } else {
              resolve(response);
            }
          });
        });
        console.log('✓ Created categories via WebSocket:', categoriesResult.length);
      } else {
        console.log('✓ Categories already exist:', existingCategories.length);
      }

      // Get category by ID
      const category = await new Promise((resolve, reject) => {
        socket.emit('category:getById', { id: 'cat_001' }, (response) => {
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response);
          }
        });
      });
      console.log('✓ Retrieved category by ID via WebSocket:', category.name);
    } catch (error) {
      console.error('✗ Category WebSocket test failed:', error.message);
    }

    // Test Subcategories
    console.log('\n=== Testing Subcategories via WebSocket ===');
    try {
      // First check if subcategories exist
      const existingSubcategories = await new Promise((resolve, reject) => {
        socket.emit('subcategory:getByCategory', { categoryId: 'cat_001' }, (response) => {
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response);
          }
        });
      });

      if (existingSubcategories.length === 0) {
        // Create subcategories only if none exist
        const subcategoriesResult = await new Promise((resolve, reject) => {
          socket.emit('subcategory:create', testData.subcategories, (response) => {
            if (response.error) {
              reject(new Error(response.error));
            } else {
              resolve(response);
            }
          });
        });
        console.log('✓ Created subcategories via WebSocket:', subcategoriesResult.length);
      } else {
        console.log('✓ Subcategories already exist:', existingSubcategories.length);
      }

      // Get subcategories by category
      const subcategories = await new Promise((resolve, reject) => {
        socket.emit('subcategory:getByCategory', { categoryId: 'cat_001' }, (response) => {
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response);
          }
        });
      });
      console.log('✓ Retrieved subcategories for category via WebSocket:', subcategories.length);
    } catch (error) {
      console.error('✗ Subcategory WebSocket test failed:', error.message);
    }

    // Test Ingredients
    console.log('\n=== Testing Ingredients via WebSocket ===');
    try {
      // Create ingredients
      const ingredientsResult = await new Promise((resolve, reject) => {
        socket.emit('ingredient:create', testData.ingredients, (response) => {
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response);
          }
        });
      });
      console.log('✓ Created ingredients via WebSocket:', ingredientsResult.length);

      // Get low stock ingredients
      const lowStock = await new Promise((resolve, reject) => {
        socket.emit('ingredient:getLowStock', { threshold: 5 }, (response) => {
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response);
          }
        });
      });
      console.log('✓ Retrieved low stock ingredients via WebSocket:', lowStock.length);
    } catch (error) {
      console.error('✗ Ingredient WebSocket test failed:', error.message);
    }

    // Test Recipes
    console.log('\n=== Testing Recipes via WebSocket ===');
    try {
      // Create recipes
      const recipesResult = await new Promise((resolve, reject) => {
        socket.emit('recipe:create', testData.recipes, (response) => {
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response);
          }
        });
      });
      console.log('✓ Created recipes via WebSocket:', recipesResult.length);

      // Get recipes by category
      const categoryRecipes = await new Promise((resolve, reject) => {
        socket.emit('recipe:getByCategory', { categoryId: 'cat_001' }, (response) => {
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response);
          }
        });
      });
      console.log('✓ Retrieved recipes for category via WebSocket:', categoryRecipes.length);
    } catch (error) {
      console.error('✗ Recipe WebSocket test failed:', error.message);
    }

    // Test Recipe Versions
    console.log('\n=== Testing Recipe Versions via WebSocket ===');
    try {
      // Create recipe versions
      const versionsResult = await new Promise((resolve, reject) => {
        socket.emit('recipeVersion:create', testData.recipeVersions, (response) => {
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response);
          }
        });
      });
      console.log('✓ Created recipe versions via WebSocket:', versionsResult.length);

      // Get recipe version
      const version = await new Promise((resolve, reject) => {
        socket.emit('recipeVersion:getById', { id: 'recv_001' }, (response) => {
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response);
          }
        });
      });
      console.log('✓ Retrieved recipe version via WebSocket:', version.version);
      console.log('  Ingredients:', version.ingredients.length);
      console.log('  Instructions:', version.instructions.length);
    } catch (error) {
      console.error('✗ Recipe version WebSocket test failed:', error.message);
    }

    // Test Menu Items
    console.log('\n=== Testing Menu Items via WebSocket ===');
    try {
      // Create menu items
      const menuItemsResult = await new Promise((resolve, reject) => {
        socket.emit('menuItem:create', testData.menuItems, (response) => {
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response);
          }
        });
      });
      console.log('✓ Created menu items via WebSocket:', menuItemsResult.length);

      // Get menu items by category
      const categoryMenuItems = await new Promise((resolve, reject) => {
        socket.emit('menuItem:getByCategory', { categoryId: 'cat_001' }, (response) => {
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response);
          }
        });
      });
      console.log('✓ Retrieved menu items for category via WebSocket:', categoryMenuItems.length);
    } catch (error) {
      console.error('✗ Menu item WebSocket test failed:', error.message);
    }

    // Test Inventory Transactions
    console.log('\n=== Testing Inventory Transactions via WebSocket ===');
    try {
      // Create inventory transactions
      const transactionsResult = await new Promise((resolve, reject) => {
        socket.emit('inventoryTransaction:create', testData.inventoryTransactions, (response) => {
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response);
          }
        });
      });
      console.log('✓ Created inventory transactions via WebSocket:', transactionsResult.length);

      // Get transactions by ingredient
      const ingredientTransactions = await new Promise((resolve, reject) => {
        socket.emit('inventoryTransaction:getByIngredient', { ingredientId: 'ing_001' }, (response) => {
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response);
          }
        });
      });
      console.log('✓ Retrieved transactions for ingredient via WebSocket:', ingredientTransactions.length);
    } catch (error) {
      console.error('✗ Inventory transaction WebSocket test failed:', error.message);
    }

    // Test Suppliers
    console.log('\n=== Testing Suppliers via WebSocket ===');
    try {
      // Create suppliers
      const suppliersResult = await new Promise((resolve, reject) => {
        socket.emit('supplier:create', testData.suppliers, (response) => {
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response);
          }
        });
      });
      console.log('✓ Created suppliers via WebSocket:', suppliersResult.length);

      // Get supplier by ID
      const supplier = await new Promise((resolve, reject) => {
        socket.emit('supplier:getById', { id: 'sup_001' }, (response) => {
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response);
          }
        });
      });
      console.log('✓ Retrieved supplier via WebSocket:', supplier.name);
    } catch (error) {
      console.error('✗ Supplier WebSocket test failed:', error.message);
    }

    // Disconnect WebSocket
    socket.disconnect();
    console.log('\n✓ WebSocket disconnected');

    console.log('\n=== Endpoint Testing Completed ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('\nTested Collections:');
    Object.keys(testData).forEach(collection => {
      console.log(`- ${collection}`);
    });
    console.log('\n=======================================\n');

  } catch (error) {
    console.error('\n=== Endpoint Testing Failed ===');
    console.error('Timestamp:', new Date().toISOString());
    console.error('Error:', error.message);
    console.error('Error details:', error);
    console.error('Error stack:', error.stack);
    console.error('=======================================\n');
    throw error;
  }
};

// Run the tests
testEndpoints().catch(console.error); 