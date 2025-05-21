import { cleanupDatabases as closeDatabaseConnections } from './utils/database.js';
import { existsSync, rmSync } from 'fs';
import path from 'path';

const cleanupDatabaseFiles = async () => {
  console.log('\n=== Cleaning Up Databases ===');
  console.log('Timestamp:', new Date().toISOString());

  try {
    const DB_PATH = path.resolve(process.cwd(), 'dev-databases');
    
    // Check if database directory exists
    if (existsSync(DB_PATH)) {
      console.log('Found database directory:', DB_PATH);
      
      // Remove database directory and all its contents
      console.log('Removing database directory...');
      rmSync(DB_PATH, { recursive: true, force: true });
      console.log('✓ Database directory removed');
    } else {
      console.log('No database directory found');
    }

    console.log('\n=== Database Cleanup Completed ===');
    console.log('Timestamp:', new Date().toISOString());
  } catch (error) {
    console.error('\n=== Database Cleanup Failed ===');
    console.error('Timestamp:', new Date().toISOString());
    console.error('Error:', error.message);
    console.error('Error details:', error);
    console.error('Error stack:', error.stack);
    throw error;
  }
};

// Run the cleanup
cleanupDatabaseFiles().catch(console.error); 