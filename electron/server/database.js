import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
import path from 'path';
import electron from 'electron';
import { existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { COUCHDB_CONFIG } from './config.js';
import { initializeDatabases, cleanupDatabases } from './utils/database.js';

const app = electron?.app || { getPath: (p) => process.cwd() };
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Register PouchDB plugins
PouchDB.plugin(PouchDBFind);

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
        const errorText = await createResponse.text();
        throw new Error(`Failed to create remote database: ${createResponse.statusText} - ${errorText}`);
      }
      console.log(`✓ Remote database created: ${remoteURL}`);
    } else if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to check remote database: ${response.statusText} - ${errorText}`);
    }
  } catch (error) {
    console.error(`✗ Error ensuring remote database exists: ${remoteURL}`, error);
    console.error('Error details:', error);
    throw error;
  }
};

export const setupSync = async (databases) => {
  console.log('\n=== Database Sync Setup Started ===');
  console.log('Timestamp:', new Date().toISOString());
  console.log('Number of databases to sync:', Object.keys(databases).length);
  
  try {
    const io = global.io; // Get Socket.IO instance
    if (!io) {
      console.warn('! Socket.IO instance not found, sync status updates will not be emitted');
    }
    
    // Initialize sync for each database
    const syncPromises = Object.entries(databases).map(async ([dbName, db]) => {
      try {
        // Convert database name to CouchDB URL key format
        const dbKey = dbName.replace('DB', '').toLowerCase();
        const remoteURL = COUCHDB_CONFIG.urls[dbKey];
        
        if (!remoteURL) {
          console.warn(`✗ No remote URL configured for database: ${dbName}`);
          return false;
        }

        console.log(`\nSetting up sync for: ${dbName}`);
        console.log(`Remote URL: ${remoteURL}`);
        console.log(`Local database path: ${db.name}`);
        
        // Verify local database is accessible
        try {
          const localInfo = await db.info();
          console.log(`✓ Local database is accessible`);
          console.log(`  - Document count: ${localInfo.doc_count}`);
          console.log(`  - Update sequence: ${localInfo.update_seq}`);
        } catch (error) {
          console.error(`✗ Local database is not accessible:`, error.message);
          throw error;
        }
        
        // Emit initial sync status
        io?.emit('sync:status', { 
          database: dbName,
          status: 'initializing'
        });

        // Ensure remote database exists
        console.log(`Checking remote database: ${dbKey}`);
        await ensureRemoteDatabaseExists(remoteURL, COUCHDB_CONFIG.auth);
        console.log(`✓ Remote database exists: ${dbKey}`);

        // Initialize metrics
        updateSyncMetrics(dbName, 'startTime', Date.now());
        updateSyncMetrics(dbName, 'totalDocs', 0);
        updateSyncMetrics(dbName, 'completedDocs', 0);
        updateSyncMetrics(dbName, 'failedDocs', 0);
        updateSyncMetrics(dbName, 'errors', []);
        updateSyncMetrics(dbName, 'retries', 0);

        // Set up two-way sync with retry options
        console.log(`Creating remote database connection: ${remoteURL}`);
        const remoteDb = new PouchDB(remoteURL, {
          auth: COUCHDB_CONFIG.auth,
          ...COUCHDB_CONFIG.options
        });        

        // Verify remote database is accessible
        try {
          const remoteInfo = await remoteDb.info();
          console.log(`✓ Remote database is accessible`);
          console.log(`  - Document count: ${remoteInfo.doc_count}`);
          console.log(`  - Update sequence: ${remoteInfo.update_seq}`);
        } catch (error) {
          console.error(`✗ Remote database is not accessible:`, error.message);
          throw error;
        }

        console.log(`Starting sync for ${dbName}`);
        const sync = db.sync(remoteDb, {
          live: true,
          retry: true,
          batch_size: 100,
          batches_limit: 2,
          auth: COUCHDB_CONFIG.auth,
          timeout: 60000, // 1 minute timeout
          heartbeat: 10000 // 10 second heartbeat
        });

        sync
        .on('change', function (change) {
          updateSyncMetrics(dbName, 'completedDocs', 
            (syncMetrics.completedDocs[dbName] || 0) + change.docs.length);
          io?.emit('sync:change', { database: dbName, change });
          console.log(`✓ Sync change for ${dbName}: ${change.docs.length} documents`);
          console.log(`  Progress: ${syncMetrics.completedDocs[dbName] || 0} documents synced`);
        })
        .on('active', function () {
          updateSyncMetrics(dbName, 'lastSync', Date.now());
          io?.emit('sync:status', { database: dbName, status: 'active' });
          console.log(`✓ Sync active for ${dbName}`);
          console.log(`  Last sync: ${new Date(syncMetrics.lastSync[dbName]).toISOString()}`);
        })
        .on('paused', function (err) {
          io?.emit('sync:status', { 
            database: dbName, 
            status: 'paused',
            error: err,
            metrics: syncMetrics[dbName]
          });
          console.log(`! Sync paused for ${dbName}`);
          if (err) {
            console.log(`  Reason: ${err.message}`);
            console.log(`  Error details:`, err);
          }
        })
        .on('error', function (err) {
          const errors = syncMetrics.errors[dbName] || [];
          errors.push({
            timestamp: Date.now(),
            error: err.message,
            details: err
          });
          updateSyncMetrics(dbName, 'errors', errors);
          updateSyncMetrics(dbName, 'retries', (syncMetrics.retries[dbName] || 0) + 1);
          
          io?.emit('sync:status', { 
            database: dbName, 
            status: 'error',
            error: err.message,
            metrics: syncMetrics[dbName]
          });

          console.error(`✗ Sync error for ${dbName}:`, err.message);
          console.error(`  Retry count: ${syncMetrics.retries[dbName]}`);
          console.error(`  Error timestamp: ${new Date().toISOString()}`);
          console.error(`  Error details:`, err);

          // Attempt to restart sync after error
          setTimeout(() => {
            console.log(`Attempting to restart sync for ${dbName}`);
            sync.cancel();
            setupSync({ [dbName]: db });
          }, 5000); // Wait 5 seconds before retrying
        })
        .on('complete', function (info) {
          updateSyncMetrics(dbName, 'lastSync', Date.now());
          io?.emit('sync:status', { 
            database: dbName, 
            status: 'complete',
            info,
            metrics: syncMetrics[dbName]
          });
          console.log(`✓ Sync complete for ${dbName}`);
          console.log(`  Total documents: ${syncMetrics.completedDocs[dbName] || 0}`);
          console.log(`  Last sync: ${new Date(syncMetrics.lastSync[dbName]).toISOString()}`);
          console.log(`  Sync info:`, info);
        });

        console.log(`✓ Database ${dbName} sync configured successfully`);
        return true;
      } catch (error) {
        console.error(`✗ Failed to setup sync for ${dbName}:`, error.message);
        console.error(`  Error details:`, error);
        console.error(`  Error stack:`, error.stack);
        return false;
      }
    });

    const results = await Promise.all(syncPromises);
    const allSuccessful = results.every(Boolean);

    if (allSuccessful) {
      console.log('\n=== Database Sync Setup Completed ===');
      console.log('Timestamp:', new Date().toISOString());
      console.log('All databases are now syncing with CouchDB');
      console.log('\nSynced databases:');
      Object.keys(databases).forEach(dbName => {
        console.log(`- ${dbName}`);
      });
      console.log('\n=======================================\n');
    } else {
      console.warn('\n=== Database Sync Setup Partially Completed ===');
      console.warn('Timestamp:', new Date().toISOString());
      console.warn('Some databases failed to sync with CouchDB');
      console.warn('\nFailed databases:');
      Object.entries(databases).forEach(([dbName, success]) => {
        if (!success) console.warn(`- ${dbName}`);
      });
      console.warn('\n=======================================\n');
    }

    return allSuccessful;
  } catch (error) {
    console.error('\n=== Database Sync Setup Failed ===');
    console.error('Timestamp:', new Date().toISOString());
    console.error('Error:', error.message);
    console.error('Error details:', error);
    console.error('Error stack:', error.stack);
    console.error('=======================================\n');
    throw error;
  }
};

export const setupDatabases = async () => {
  try {
    // Use the consolidated database initialization
    const databases = await initializeDatabases();
    
    // Setup sync for all databases
    await setupSync(databases);
    
    return databases;
  } catch (error) {
    console.error('Error setting up databases:', error);
    throw error;
  }
};