// server/index.js - Fixed to properly start and return server instance
import { Server } from 'socket.io';
import { registerSocketRoutes } from './routes/index.js';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { initializeDatabases, cleanupDatabases } from './utils/database.js';
import { setupSync } from './database.js';

const PORT = process.env.PORT || 8000;

// Add error handling for uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('\n=== Uncaught Exception ===');
  console.error('Timestamp:', new Date().toISOString());
  console.error('Error:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('\n=== Unhandled Rejection ===');
  console.error('Timestamp:', new Date().toISOString());
  console.error('Reason:', reason);
  console.error('Promise:', promise);
});

export const startServer = async () => {
  let databases;
  let httpServer;
  let io;

  try {
    console.log('\n=== Server Startup Started ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Environment:', process.env.NODE_ENV);
    console.log('Port:', PORT);
    console.log('Node version:', process.version);
    console.log('Platform:', process.platform);

    console.log('\nInitializing databases...');
    databases = await initializeDatabases();
    console.log('✓ Databases initialized successfully');

    // Set up database sync
    console.log('\nSetting up database sync...');
    await setupSync(databases);
    console.log('✓ Database sync setup completed');

    console.log('\nCreating HTTP server...');
    httpServer = createServer();
    
    console.log('Creating Socket.IO server...');
    io = new Server(httpServer, {
      cors: {
        origin: process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : false,
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket'],
      pingTimeout: 60000,
      pingInterval: 25000,
      connectTimeout: 45000,
      maxHttpBufferSize: 1e6
    });

    // Store io instance globally for sync status updates
    global.io = io;

    console.log('\nRegistering socket routes...');
    await registerSocketRoutes(io, databases);
    console.log('✓ Socket routes registered successfully');

    return new Promise((resolve, reject) => {
      httpServer.listen(PORT, () => {
        console.log('\n=== Server Startup Completed ===');
        console.log('Timestamp:', new Date().toISOString());
        console.log(`Server is now listening on port ${PORT}`);
        resolve(httpServer);
      }).on('error', (error) => {
        console.error('\n=== Server Startup Failed ===');
        console.error('Timestamp:', new Date().toISOString());
        console.error('Error starting server:', error);
        console.error('Error details:', error.stack);
        reject(error);
      });
    });
  } catch (error) {
    console.error('\n=== Server Startup Failed ===');
    console.error('Timestamp:', new Date().toISOString());
    console.error('Error:', error.message);
    console.error('Error details:', error.stack);
    
    // Cleanup resources
    if (io) {
      try {
        io.close();
      } catch (e) {
        console.error('Error closing Socket.IO server:', e);
      }
    }
    
    if (httpServer) {
      try {
        httpServer.close();
      } catch (e) {
        console.error('Error closing HTTP server:', e);
      }
    }
    
    if (databases) {
      console.log('\nCleaning up databases...');
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