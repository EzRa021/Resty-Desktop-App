// server/index.js - Fixed to properly start and return server instance
import Fastify from 'fastify';
import { Server } from 'socket.io';
import { setupDatabases, setupSync } from './database.js';
import { registerSocketRoutes } from './routes/index.js';
import { SERVER_CONFIG } from './config.js';
import { existsSync } from 'fs';
import { DB_CONFIG } from './config.js';
import { fileURLToPath } from 'url';
import path from 'path';
import SocketSecurityMiddleware from './middleware/socketSecurity.js';
import { activityLogger } from './utils/activityLogger.js';
import { createServer } from 'http';
import { initializeDatabases, cleanupDatabases } from './utils/database.js';

// Import HTTP route handlers
import userRoutes from './routes/users.js';
import menuRoutes from './routes/menuItems.js';
import orderRoutes from './routes/pos.js';
import ingredientRoutes from './routes/ingredients.js';
import recipeRoutes from './routes/recipes.js';

const PORT = process.env.PORT || 8000;

export const startServer = async () => {
  let databases;
  try {
    console.log('Initializing databases...');
    databases = await initializeDatabases();
    console.log('Databases initialized successfully');

    const httpServer = createServer();
    const io = new Server(httpServer, {
      cors: {
        origin: process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : false,
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket']
    });

    console.log('Registering socket routes...');
    await registerSocketRoutes(io, databases);
    console.log('Socket routes registered successfully');

    return new Promise((resolve, reject) => {
      httpServer.listen(PORT, () => {
        console.log(`Server is now listening on port ${PORT}`);
        resolve(httpServer);
      }).on('error', (error) => {
        console.error('Error starting server:', error);
        reject(error);
      });
    });
  } catch (error) {
    console.error('Error starting server:', error);
    if (databases) {
      await cleanupDatabases(databases);
    }
    throw error;
  }
};

// Only start the server if this file is run directly
const isDirectExecution = process.argv[1] === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  console.log('Starting server in direct execution mode...');
  startServer().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}