import { testData } from './test-data.js';
import { initializeDatabases } from './utils/database.js';

const loadTestData = async () => {
  console.log('\n=== Loading Test Data ===');
  console.log('Timestamp:', new Date().toISOString());

  try {
    // Initialize databases
    const databases = await initializeDatabases();
    console.log('✓ Databases initialized');

    // Load data into each database
    for (const [collection, items] of Object.entries(testData)) {
      const dbName = `${collection}DB`;
      const db = databases[dbName];

      if (!db) {
        console.warn(`! Database ${dbName} not found, skipping...`);
        continue;
      }

      console.log(`\nLoading data into ${dbName}...`);
      
      try {
        // Bulk insert the documents
        const result = await db.bulkDocs(items);
        console.log(`✓ Loaded ${items.length} items into ${dbName}`);
        
        // Log any errors
        const errors = result.filter(r => r.error);
        if (errors.length > 0) {
          console.warn(`! ${errors.length} errors occurred while loading ${dbName}:`);
          errors.forEach(error => {
            console.warn(`  - ${error.id}: ${error.error}`);
          });
        }
      } catch (error) {
        console.error(`✗ Error loading data into ${dbName}:`, error.message);
        console.error('Error details:', error);
      }
    }

    console.log('\n=== Test Data Loading Completed ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('\nLoaded collections:');
    Object.keys(testData).forEach(collection => {
      console.log(`- ${collection}: ${testData[collection].length} items`);
    });
    console.log('\n=======================================\n');

  } catch (error) {
    console.error('\n=== Test Data Loading Failed ===');
    console.error('Timestamp:', new Date().toISOString());
    console.error('Error:', error.message);
    console.error('Error details:', error);
    console.error('Error stack:', error.stack);
    console.error('=======================================\n');
    throw error;
  }
};

// Run the script
loadTestData().catch(console.error); 