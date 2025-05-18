import PouchDB from 'pouchdb';
import { fileURLToPath } from 'url';
import path from 'path';
import { existsSync, mkdirSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '../../data');

// Ensure database directory exists
if (!existsSync(DB_PATH)) {
  mkdirSync(DB_PATH, { recursive: true });
}

// Helper function to create database with retry logic
const createDatabase = async (dbPath, retries = 3, delay = 1000) => {
  for (let i = 0; i < retries; i++) {
    try {
      const db = new PouchDB(dbPath, {
        auto_compaction: true,
        revs_limit: 1,
        cache: {
          max: 1000
        }
      });
      return db;
    } catch (error) {
      if (i === retries - 1) throw error;
      console.log(`Retry ${i + 1}/${retries} for database ${dbPath}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

// Initialize all databases
export const initializeDatabases = async () => {
  try {
    console.log('Initializing databases in:', DB_PATH);

    // Create databases with retry logic
    const databases = {
      usersDB: await createDatabase(path.join(DB_PATH, 'users')),
      notificationsDB: await createDatabase(path.join(DB_PATH, 'notifications')),
      sessionDB: await createDatabase(path.join(DB_PATH, 'sessions')),
      logsDB: await createDatabase(path.join(DB_PATH, 'logs'))
    };

    // Create indexes for notifications
    try {
      await databases.notificationsDB.createIndex({
        index: {
          fields: ['type', 'targetUsers', 'read', 'createdAt']
        }
      });
    } catch (error) {
      console.warn('Warning: Could not create notifications index:', error.message);
    }

    // Create indexes for sessions
    try {
      await databases.sessionDB.createIndex({
        index: {
          fields: ['userId', 'createdAt']
        }
      });
    } catch (error) {
      console.warn('Warning: Could not create sessions index:', error.message);
    }

    // Create indexes for logs
    try {
      await databases.logsDB.createIndex({
        index: {
          fields: ['type', 'timestamp']
        }
      });
    } catch (error) {
      console.warn('Warning: Could not create logs index:', error.message);
    }

    console.log('Databases initialized successfully');
    return databases;
  } catch (error) {
    console.error('Error initializing databases:', error);
    throw error;
  }
};

// Cleanup function to close database connections
export const cleanupDatabases = async (databases) => {
  if (!databases) return;
  
  try {
    await Promise.all(
      Object.values(databases).map(async db => {
        try {
          await db.close();
        } catch (error) {
          console.warn('Warning: Error closing database:', error.message);
        }
      })
    );
    console.log('Database connections closed successfully');
  } catch (error) {
    console.error('Error closing database connections:', error);
  }
}; 