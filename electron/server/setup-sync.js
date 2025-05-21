import { initializeDatabases } from './utils/database.js';
import { setupSync } from './database.js';

const setupDatabaseSync = async () => {
  console.log('\n=== Setting Up Database Sync ===');
  console.log('Timestamp:', new Date().toISOString());

  try {
    // Initialize databases
    const databases = await initializeDatabases();
    console.log('✓ Databases initialized');

    // Set up sync
    const syncResult = await setupSync(databases);
    
    if (syncResult) {
      console.log('\n=== Database Sync Setup Completed ===');
      console.log('Timestamp:', new Date().toISOString());
      console.log('All databases are now syncing with CouchDB');
    } else {
      console.warn('\n=== Database Sync Setup Partially Completed ===');
      console.warn('Some databases failed to sync with CouchDB');
    }

  } catch (error) {
    console.error('\n=== Database Sync Setup Failed ===');
    console.error('Timestamp:', new Date().toISOString());
    console.error('Error:', error.message);
    console.error('Error details:', error);
    console.error('Error stack:', error.stack);
    throw error;
  }
};

// Run the setup
setupDatabaseSync().catch(console.error); 