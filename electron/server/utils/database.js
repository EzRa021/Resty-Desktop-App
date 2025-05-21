import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
import { fileURLToPath } from 'url';
import path from 'path';
import { existsSync, mkdirSync } from 'fs';

// Register PouchDB plugins
try {
  PouchDB.plugin(PouchDBFind);
  console.log('✓ PouchDB plugins registered successfully');
} catch (error) {
  console.error('✗ Failed to register PouchDB plugins:', error);
  throw error;
}

// Enable debug mode for PouchDB if available
if (PouchDB.debug && typeof PouchDB.debug.enable === 'function') {
  try {
    PouchDB.debug.enable('*');
    console.log('✓ PouchDB debug mode enabled');
  } catch (error) {
    console.warn('! Failed to enable PouchDB debug mode:', error);
  }
} else {
  console.log('ℹ PouchDB debug mode not available');
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(process.cwd(), 'dev-databases');

console.log('\n=== PouchDB Configuration ===');
console.log('PouchDB Version:', PouchDB.version);
console.log('Database Path:', DB_PATH);
console.log('==========////////////=============///////////================\n');

// Ensure database directory exists
try {
  if (!existsSync(DB_PATH)) {
    console.log('Creating database directory:', DB_PATH);
    mkdirSync(DB_PATH, { recursive: true });
    console.log('✓ Database directory created');
  } else {
    console.log('✓ Database directory exists:', DB_PATH);
  }
} catch (error) {
  console.error('✗ Failed to create database directory:', error);
  throw error;
}

// Helper function to create database with retry logic
const createDatabase = async (dbPath, retries = 3, delay = 1000) => {
  console.log(`Creating database at: ${dbPath}`);
  for (let i = 0; i < retries; i++) {
    try {
      const db = new PouchDB(dbPath, {
        auto_compaction: true,
        revs_limit: 1,
        cache: {
          max: 1000
        }
      });
      
      // Verify database was created
      const info = await db.info();
      console.log(`✓ Database created successfully: ${dbPath}`);
      console.log(`  - Document count: ${info.doc_count}`);
      console.log(`  - Update sequence: ${info.update_seq}`);
      
      return db;
    } catch (error) {
      console.error(`Attempt ${i + 1}/${retries} failed for ${dbPath}:`, error.message);
      if (i === retries - 1) {
        console.error('✗ All retry attempts failed');
        throw error;
      }
      console.log(`Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

// Initialize all databases
export const initializeDatabases = async () => {
  console.log('\n=== Database Initialization Started ===');
  console.log('Timestamp:', new Date().toISOString());
  console.log('Database path:', DB_PATH);

  try {
    // Define all databases to be created
    const databaseConfigs = {
      // Core databases
      usersDB: { path: 'users', indexes: [
        { fields: ['type', 'email'] },
        { fields: ['type', 'restaurantId'] }
      ]},
      restaurantsDB: { path: 'restaurants', indexes: [
        { fields: ['type', 'name'] }
      ]},
      branchesDB: { path: 'branches', indexes: [
        { fields: ['type', 'restaurantId'] },
        { fields: ['type', 'restaurantId', 'createdAt'] }
      ]},
      sessionDB: { path: 'sessions', indexes: [
        { fields: ['type', 'userId'] },
        { fields: ['type', 'expiresAt'] }
      ]},
      logsDB: { path: 'logs', indexes: [
        { fields: ['type', 'timestamp'] },
        { fields: ['type', 'userId', 'timestamp'] }
      ]},
      notificationsDB: { path: 'notifications', indexes: [
        { fields: ['type', 'targetUsers', 'read', 'createdAt'] }
      ]},

      // Menu and Inventory
      categoriesDB: { path: 'categories', indexes: [
        { fields: ['type', 'restaurantId'] }
      ]},
      subcategoriesDB: { path: 'subcategories', indexes: [
        { fields: ['type', 'categoryId'] }
      ]},
      menuItemsDB: { path: 'menu_items', indexes: [
        { fields: ['type', 'categoryId'] },
        { fields: ['type', 'restaurantId'] }
      ]},
      ingredientsDB: { path: 'ingredients', indexes: [
        { fields: ['type', 'restaurantId'] }
      ]},
      recipesDB: { path: 'recipes', indexes: [
        { fields: ['type', 'restaurantId'] }
      ]},
      recipeVersionsDB: { path: 'recipe_versions', indexes: [
        { fields: ['type', 'recipeId', 'version'] }
      ]},

      // Operations
      posDB: { path: 'pos', indexes: [
        { fields: ['type', 'restaurantId', 'status'] },
        { fields: ['type', 'orderDate'] }
      ]},
      inventoryTransactionsDB: { path: 'inventory_transactions', indexes: [
        { fields: ['type', 'restaurantId', 'date'] }
      ]},
      kdsDB: { path: 'kds', indexes: [
        { fields: ['type', 'restaurantId', 'status'] }
      ]},
      tablesDB: { path: 'tables', indexes: [
        { fields: ['type', 'restaurantId', 'status'] }
      ]},
      specialsDB: { path: 'specials', indexes: [
        { fields: ['type', 'restaurantId', 'active'] }
      ]},
      wasteRecordsDB: { path: 'waste_records', indexes: [
        { fields: ['type', 'restaurantId', 'date'] }
      ]},

      // Business
      suppliersDB: { path: 'suppliers', indexes: [
        { fields: ['type', 'restaurantId'] }
      ]},
      loyaltyDB: { path: 'loyalty', indexes: [
        { fields: ['type', 'restaurantId', 'customerId'] }
      ]},
      settingsDB: { path: 'settings', indexes: [
        { fields: ['type', 'restaurantId'] }
      ]}
    };

    console.log('\nCreating databases...');
    const databases = {};
    
    // Create databases
    for (const [dbName, config] of Object.entries(databaseConfigs)) {
      try {
        console.log(`\nCreating database: ${dbName} (${config.path})`);
        databases[dbName] = await createDatabase(path.join(DB_PATH, config.path));
        console.log(`✓ Database created: ${dbName}`);
      } catch (error) {
        console.error(`✗ Failed to create database ${dbName}:`, error.message);
        console.error('Error details:', error);
        throw error;
      }
    }

    console.log('\nCreating indexes...');
    // Create indexes for each database
    for (const [dbName, config] of Object.entries(databaseConfigs)) {
      try {
        console.log(`\nCreating indexes for: ${dbName}`);
        for (const index of config.indexes) {
          try {
            await databases[dbName].createIndex({
              index: { fields: index.fields }
            });
            console.log(`  ✓ Index created: ${index.fields.join(', ')}`);
          } catch (indexError) {
            console.error(`  ✗ Failed to create index ${index.fields.join(', ')}:`, indexError.message);
            throw indexError;
          }
        }
      } catch (error) {
        console.error(`  ✗ Failed to create indexes for ${dbName}:`, error.message);
        console.error('Error details:', error);
        throw error;
      }
    }

    // Verify all databases are accessible
    console.log('\nVerifying database connections...');
    for (const [dbName, db] of Object.entries(databases)) {
      try {
        const info = await db.info();
        console.log(`✓ Database ${dbName} is accessible`);
        console.log(`  - Document count: ${info.doc_count}`);
        console.log(`  - Update sequence: ${info.update_seq}`);
      } catch (error) {
        console.error(`✗ Database ${dbName} is not accessible:`, error.message);
        throw error;
      }
    }

    console.log('\n=== Database Initialization Completed ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Total databases created:', Object.keys(databases).length);
    console.log('\nDatabase list:');
    Object.keys(databases).forEach(dbName => {
      console.log(`- ${dbName}`);
    });
    console.log('\n=======================================\n');

    return databases;
  } catch (error) {
    console.error('\n=== Database Initialization Failed ===');
    console.error('Timestamp:', new Date().toISOString());
    console.error('Error:', error.message);
    console.error('Error stack:', error.stack);
    console.error('=======================================\n');
    throw error;
  }
};

// Cleanup function to close database connections
export const cleanupDatabases = async (databases) => {
  if (!databases) return;
  
  try {
    console.log('\n=== Closing Database Connections ===');
    console.log('Timestamp:', new Date().toISOString());
    await Promise.all(
      Object.entries(databases).map(async ([dbName, db]) => {
        try {
          await db.close();
          console.log(`✓ Closed connection: ${dbName}`);
        } catch (error) {
          console.warn(`✗ Error closing database ${dbName}:`, error.message);
          console.warn('Error details:', error);
        }
      })
    );
    console.log('=== Database Connections Closed ===\n');
  } catch (error) {
    console.error('Error closing database connections:', error);
    console.error('Error details:', error);
  }
}; 