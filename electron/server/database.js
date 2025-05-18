import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
import path from 'path';
import electron from 'electron';
import { existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { COUCHDB_CONFIG } from './config.js';

const app = electron?.app || { getPath: (p) => process.cwd() };
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Register PouchDB plugins
PouchDB.plugin(PouchDBFind);

// Database configuration with absolute paths
const DB_CONFIG = {
  path: process.env.NODE_ENV === 'development' 
    ? path.resolve(process.cwd(), 'dev-databases')
    : path.join(app.getPath('userData'), 'databases')
};

// Add performance monitoring
const syncMetrics = {
  startTime: {},
  totalDocs: {},
  completedDocs: {},
  failedDocs: {},
  lastSync: {},
  errors: {},
  retries: {}
};

const updateSyncMetrics = (dbName, metric, value) => {
  if (!syncMetrics[metric]) {
    syncMetrics[metric] = {};
  }
  syncMetrics[metric][dbName] = value;
  
  // Emit metrics update via Socket.IO
  global.io?.emit('sync:metrics', {
    database: dbName,
    metrics: {
      [metric]: value,
      totalProgress: syncMetrics.completedDocs[dbName] 
        ? (syncMetrics.completedDocs[dbName] / syncMetrics.totalDocs[dbName]) * 100
        : 0
    }
  });
};

const ensureRemoteDatabaseExists = async (remoteURL, auth) => {
  try {
    console.log(`Checking remote database: ${remoteURL}`);
    const response = await fetch(remoteURL, {
      method: 'HEAD',
      headers: {
        Authorization: `Basic ${Buffer.from(`${auth.username}:${auth.password}`).toString('base64')}`,
      },
    });

    if (response.status === 404) {
      console.log(`Creating remote database: ${remoteURL}`);
      const createResponse = await fetch(remoteURL, {
        method: 'PUT',
        headers: {
          Authorization: `Basic ${Buffer.from(`${auth.username}:${auth.password}`).toString('base64')}`,
        },
      });
      if (!createResponse.ok) {
        throw new Error(`Failed to create remote database: ${createResponse.statusText}`);
      }
    }
  } catch (error) {
    console.error(`Error ensuring remote database exists: ${remoteURL}`, error);
    throw error;
  }
};

export const setupSync = async (databases) => {
  console.log('Setting up database synchronization...');
  
  try {
    const io = global.io; // Get Socket.IO instance
    
    // Initialize sync for each database
    const syncPromises = Object.entries(databases).map(async ([dbName, db]) => {
      try {
        const remoteURL = COUCHDB_CONFIG.urls[dbName.replace('DB', '').toLowerCase()];
        
        // Emit initial sync status
        io?.emit('sync:status', { 
          database: dbName,
          status: 'initializing'
        });
        if (!remoteURL) {
          console.warn(`No remote URL configured for database: ${dbName}`);
          return false;
        }

        // Ensure remote database exists
        await ensureRemoteDatabaseExists(remoteURL, COUCHDB_CONFIG.auth);

        // Initialize metrics
        updateSyncMetrics(dbName, 'startTime', Date.now());
        updateSyncMetrics(dbName, 'totalDocs', 0);
        updateSyncMetrics(dbName, 'completedDocs', 0);
        updateSyncMetrics(dbName, 'failedDocs', 0);
        updateSyncMetrics(dbName, 'errors', []);
        updateSyncMetrics(dbName, 'retries', 0);

        // Set up two-way sync
        const remoteDb = new PouchDB(remoteURL, {
          auth: COUCHDB_CONFIG.auth
        });        
        db.sync(remoteDb, {
          live: true,
          retry: true,
          auth: COUCHDB_CONFIG.auth
        })
        .on('change', function (change) {
          updateSyncMetrics(dbName, 'completedDocs', 
            (syncMetrics.completedDocs[dbName] || 0) + change.docs.length);
          io?.emit('sync:change', { database: dbName, change });
        })
        .on('active', function () {
          updateSyncMetrics(dbName, 'lastSync', Date.now());
          io?.emit('sync:status', { database: dbName, status: 'active' });
        })
        .on('paused', function (err) {
          io?.emit('sync:status', { 
            database: dbName, 
            status: 'paused',
            error: err,
            metrics: syncMetrics[dbName]
          });
        })
        .on('error', function (err) {
          const errors = syncMetrics.errors[dbName] || [];
          errors.push({
            timestamp: Date.now(),
            error: err.message
          });
          updateSyncMetrics(dbName, 'errors', errors);
          updateSyncMetrics(dbName, 'retries', (syncMetrics.retries[dbName] || 0) + 1);
          
          io?.emit('sync:status', { 
            database: dbName, 
            status: 'error',
            error: err.message,
            metrics: syncMetrics[dbName]
          });
        })
        .on('complete', function (info) {
          updateSyncMetrics(dbName, 'lastSync', Date.now());
          io?.emit('sync:status', { 
            database: dbName, 
            status: 'complete',
            info,
            metrics: syncMetrics[dbName]
          });
        });

        console.log(`Database ${dbName} sync configured with ${remoteURL}`);
        return true;
      } catch (error) {
        console.error(`Failed to setup sync for ${dbName}:`, error);
        return false;
      }
    });

    const results = await Promise.all(syncPromises);
    const allSuccessful = results.every(Boolean);

    if (allSuccessful) {
      console.log('Database synchronization setup completed successfully');
    } else {
      console.warn('Some database synchronizations failed to setup');
    }

    return allSuccessful;
  } catch (error) {
    console.error('Error setting up database synchronization:', error);
    throw error;
  }
};

export const setupDatabases = async () => {
  console.log('Setting up PouchDB databases...');
  console.log('Database path:', DB_CONFIG.path);

  try {
    // Ensure database directory exists
    if (!existsSync(DB_CONFIG.path)) {
      console.log(`Creating database directory: ${DB_CONFIG.path}`);
      mkdirSync(DB_CONFIG.path, { recursive: true });
    }

    // Initialize databases with indexes
    const databases = {
      usersDB: new PouchDB(path.join(DB_CONFIG.path, 'users'), DB_CONFIG.options),
      restaurantsDB: new PouchDB(path.join(DB_CONFIG.path, 'restaurants'), DB_CONFIG.options),
      branchesDB: new PouchDB(path.join(DB_CONFIG.path, 'branches'), DB_CONFIG.options),
      sessionDB: new PouchDB(path.join(DB_CONFIG.path, 'sessions'), DB_CONFIG.options),
      logsDB: new PouchDB(path.join(DB_CONFIG.path, 'logs'), DB_CONFIG.options),
      categoriesDB: new PouchDB(path.join(DB_CONFIG.path, 'categories'), DB_CONFIG.options),
      subcategoriesDB: new PouchDB(path.join(DB_CONFIG.path, 'subcategories'), DB_CONFIG.options),
      menuItemsDB: new PouchDB(path.join(DB_CONFIG.path, 'menu_items'), DB_CONFIG.options),
      ingredientsDB: new PouchDB(path.join(DB_CONFIG.path, 'ingredients'), DB_CONFIG.options),
      recipesDB: new PouchDB(path.join(DB_CONFIG.path, 'recipes'), DB_CONFIG.options),
      posDB: new PouchDB(path.join(DB_CONFIG.path, 'pos'), DB_CONFIG.options),
      inventoryTransactionsDB: new PouchDB(path.join(DB_CONFIG.path, 'inventory_transactions'), DB_CONFIG.options),
      kdsDB: new PouchDB(path.join(DB_CONFIG.path, 'kds'), DB_CONFIG.options),
      suppliersDB: new PouchDB(path.join(DB_CONFIG.path, 'suppliers'), DB_CONFIG.options),
      recipeVersionsDB: new PouchDB(path.join(DB_CONFIG.path, 'recipe_versions'), DB_CONFIG.options),
      tablesDB: new PouchDB(path.join(DB_CONFIG.path, 'tables'), DB_CONFIG.options),
      specialsDB: new PouchDB(path.join(DB_CONFIG.path, 'specials'), DB_CONFIG.options),
      wasteRecordsDB: new PouchDB(path.join(DB_CONFIG.path, 'waste_records'), DB_CONFIG.options),
      loyaltyDB: new PouchDB(path.join(DB_CONFIG.path, 'loyalty'), DB_CONFIG.options)
    };

    // Create indexes for each database
    await Promise.all([
      // Users indexes
      databases.usersDB.createIndex({
        index: {
          fields: ['type', 'email']
        }
      }),
      databases.usersDB.createIndex({
        index: {
          fields: ['type', 'restaurantId']
        }
      }),

      // Restaurants indexes
      databases.restaurantsDB.createIndex({
        index: {
          fields: ['type', 'name']
        }
      }),

      // Branches indexes
      databases.branchesDB.createIndex({
        index: {
          fields: ['type', 'restaurantId']
        }
      }),

      // Sessions indexes
      databases.sessionDB.createIndex({
        index: {
          fields: ['type', 'userId']
        }
      }),
      databases.sessionDB.createIndex({
        index: {
          fields: ['type', 'expiresAt']
        }
      }),

      // Logs indexes
      databases.logsDB.createIndex({
        index: {
          fields: ['type', 'timestamp']
        }
      }),
      databases.logsDB.createIndex({
        index: {
          fields: ['type', 'userId', 'timestamp']
        }
      }),

      // Categories indexes
      databases.categoriesDB.createIndex({
        index: {
          fields: ['type', 'restaurantId']
        }
      }),

      // Subcategories indexes
      databases.subcategoriesDB.createIndex({
        index: {
          fields: ['type', 'categoryId']
        }
      }),

      // Menu items indexes
      databases.menuItemsDB.createIndex({
        index: {
          fields: ['type', 'categoryId']
        }
      }),
      databases.menuItemsDB.createIndex({
        index: {
          fields: ['type', 'restaurantId']
        }
      }),

      // Ingredients indexes
      databases.ingredientsDB.createIndex({
        index: {
          fields: ['type', 'restaurantId']
        }
      }),

      // Recipes indexes
      databases.recipesDB.createIndex({
        index: {
          fields: ['type', 'restaurantId']
        }
      }),

      // POS indexes
      databases.posDB.createIndex({
        index: {
          fields: ['type', 'restaurantId', 'status']
        }
      }),
      databases.posDB.createIndex({
        index: {
          fields: ['type', 'orderDate']
        }
      }),

      // Inventory Transactions indexes
      databases.inventoryTransactionsDB.createIndex({
        index: {
          fields: ['type', 'restaurantId', 'date']
        }
      }),

      // KDS indexes
      databases.kdsDB.createIndex({
        index: {
          fields: ['type', 'restaurantId', 'status']
        }
      }),

      // Suppliers indexes
      databases.suppliersDB.createIndex({
        index: {
          fields: ['type', 'restaurantId']
        }
      }),

      // Recipe Versions indexes
      databases.recipeVersionsDB.createIndex({
        index: {
          fields: ['type', 'recipeId', 'version']
        }
      }),

      // Tables indexes
      databases.tablesDB.createIndex({
        index: {
          fields: ['type', 'restaurantId', 'status']
        }
      }),

      // Specials indexes
      databases.specialsDB.createIndex({
        index: {
          fields: ['type', 'restaurantId', 'active']
        }
      }),

      // Waste Records indexes
      databases.wasteRecordsDB.createIndex({
        index: {
          fields: ['type', 'restaurantId', 'date']
        }
      }),

      // Loyalty indexes
      databases.loyaltyDB.createIndex({
        index: {
          fields: ['type', 'restaurantId', 'customerId']
        }
      })
    ]);

    // Validate database connections
    const validationResults = await Promise.all(
      Object.entries(databases).map(async ([name, db]) => {
        try {
          await db.info();
          console.log(`Database ${name} initialized successfully`);
          return true;
        } catch (error) {
          console.error(`Failed to initialize database ${name}:`, error);
          return false;
        }
      })
    );

    if (!validationResults.every(Boolean)) {
      throw new Error('One or more databases failed to initialize');
    }

    console.log('All databases initialized successfully');
    return databases;

  } catch (error) {
    console.error('Error setting up databases:', error);
    throw error;
  }
};