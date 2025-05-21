import path from 'path';
import electron from 'electron';
import { fileURLToPath } from 'url';

const app = electron?.app || { getPath: (p) => process.cwd() };
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Check for development mode using environment variable
const isDev = process.env.ELECTRON_DEV === 'true' || process.env.NODE_ENV === 'development';

// Base configuration
const BASE_CONFIG = {
  COUCHDB_HOST: process.env.COUCHDB_HOST || 'localhost',
  COUCHDB_PORT: process.env.COUCHDB_PORT || '5984',
  COUCHDB_USER: process.env.COUCHDB_USER || 'admin',
  COUCHDB_PASS: process.env.COUCHDB_PASS || 'admin'
};

export const DB_CONFIG = {
  path: path.resolve(process.cwd(), 'dev-databases'),
  options: {
    auto_compaction: true,
    revs_limit: 1,
    cache: {
      max: 1000
    }
  }
};

// Helper function to create CouchDB URL
const createCouchDBUrl = (dbName) => 
  `http://${BASE_CONFIG.COUCHDB_HOST}:${BASE_CONFIG.COUCHDB_PORT}/${dbName}`;

export const COUCHDB_CONFIG = {
  urls: {
    // Core databases
    users: createCouchDBUrl('users'),
    restaurants: createCouchDBUrl('restaurants'),
    branches: createCouchDBUrl('branches'),
    logs: createCouchDBUrl('logs'),
    sessions: createCouchDBUrl('sessions'),
    notifications: createCouchDBUrl('notifications'),
    
    // Menu and Inventory
    categories: createCouchDBUrl('categories'),
    subcategories: createCouchDBUrl('subcategories'),
    menuItems: createCouchDBUrl('menu_items'),
    ingredients: createCouchDBUrl('ingredients'),
    recipes: createCouchDBUrl('recipes'),
    recipeVersions: createCouchDBUrl('recipe_versions'),
    
    // Operations
    pos: createCouchDBUrl('pos'),
    inventoryTransactions: createCouchDBUrl('inventory_transactions'),
    kds: createCouchDBUrl('kds'),
    tables: createCouchDBUrl('tables'),
    specials: createCouchDBUrl('specials'),
    wasteRecords: createCouchDBUrl('waste_records'),
    
    // Business
    suppliers: createCouchDBUrl('suppliers'),
    loyalty: createCouchDBUrl('loyalty'),
    settings: createCouchDBUrl('settings')
  },
  auth: {
    username: BASE_CONFIG.COUCHDB_USER,
    password: BASE_CONFIG.COUCHDB_PASS,
  },
  options: {
    skip_setup: false,
    cache: {
      max: 1000
    }
  }
};

export const SERVER_CONFIG = {
  cors: {
    origin: isDev ? ['http://localhost:3000'] : false,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  },
  socket: {
    pingInterval: 25000,
    pingTimeout: 20000,
    maxHttpBufferSize: 1e6, // 1MB
    transports: ['websocket', 'polling']
  }
};