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
  path: isDev
    ? path.join(__dirname, '../../dev-databases')
    : path.join(app.getPath('userData'), 'databases'),
  options: {
    auto_compaction: true,
    revs_limit: 1,
    cache: {
      max: 1000
    }
  }
};

export const COUCHDB_CONFIG = {
  urls: {
    branches: `http://${BASE_CONFIG.COUCHDB_HOST}:${BASE_CONFIG.COUCHDB_PORT}/branches`,
    users: `http://${BASE_CONFIG.COUCHDB_HOST}:${BASE_CONFIG.COUCHDB_PORT}/users`,
    restaurants: `http://${BASE_CONFIG.COUCHDB_HOST}:${BASE_CONFIG.COUCHDB_PORT}/restaurants`,
    logs: `http://${BASE_CONFIG.COUCHDB_HOST}:${BASE_CONFIG.COUCHDB_PORT}/logs`,
    categories: `http://${BASE_CONFIG.COUCHDB_HOST}:${BASE_CONFIG.COUCHDB_PORT}/categories`,
    subcategories: `http://${BASE_CONFIG.COUCHDB_HOST}:${BASE_CONFIG.COUCHDB_PORT}/subcategories`,
    menuItems: `http://${BASE_CONFIG.COUCHDB_HOST}:${BASE_CONFIG.COUCHDB_PORT}/menu_items`,
    ingredients: `http://${BASE_CONFIG.COUCHDB_HOST}:${BASE_CONFIG.COUCHDB_PORT}/ingredients`,
    recipes: `http://${BASE_CONFIG.COUCHDB_HOST}:${BASE_CONFIG.COUCHDB_PORT}/recipes`,
    pos: `http://${BASE_CONFIG.COUCHDB_HOST}:${BASE_CONFIG.COUCHDB_PORT}/pos`,
    inventoryTransactions: `http://${BASE_CONFIG.COUCHDB_HOST}:${BASE_CONFIG.COUCHDB_PORT}/inventory_transactions`,
    kds: `http://${BASE_CONFIG.COUCHDB_HOST}:${BASE_CONFIG.COUCHDB_PORT}/kds`,
    suppliers: `http://${BASE_CONFIG.COUCHDB_HOST}:${BASE_CONFIG.COUCHDB_PORT}/suppliers`,
    recipeVersions: `http://${BASE_CONFIG.COUCHDB_HOST}:${BASE_CONFIG.COUCHDB_PORT}/recipe_versions`,
    tables: `http://${BASE_CONFIG.COUCHDB_HOST}:${BASE_CONFIG.COUCHDB_PORT}/tables`,
    specials: `http://${BASE_CONFIG.COUCHDB_HOST}:${BASE_CONFIG.COUCHDB_PORT}/specials`,
    wasteRecords: `http://${BASE_CONFIG.COUCHDB_HOST}:${BASE_CONFIG.COUCHDB_PORT}/waste_records`,
    loyalty: `http://${BASE_CONFIG.COUCHDB_HOST}:${BASE_CONFIG.COUCHDB_PORT}/loyalty`,
    settings: `http://${BASE_CONFIG.COUCHDB_HOST}:${BASE_CONFIG.COUCHDB_PORT}/settings`
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