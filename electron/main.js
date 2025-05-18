// main.js (or index.js) - Modified to ensure server starts before window
import { app, BrowserWindow, ipcMain, Notification, shell } from 'electron';
import { fileURLToPath } from 'url';
import path from 'path';
import isDev from 'electron-is-dev';
import { startServer } from './server/index.js';
import { spawn } from 'child_process';
import { setupNotificationHandlers } from './server/utils/notifier.js';

// Get __dirname equivalent in ESM
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = isDev ? path.join(__dirname, '..') : app.getAppPath();

// Server port
const PORT = 8000;
global.serverPort = PORT;

let mainWindow;
let serverProcess;

// Create the Electron window
const createWindow = async () => {
  console.log('Creating Electron window...');
  try {
    // Set up notification handlers before creating window
    setupNotificationHandlers();

    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
        webSecurity: true,
        sandbox: false
      },
      show: false,
    });

    if (process.env.ELECTRON_DEV) {
      // Development mode with hot reloading
      console.log('Starting server with hot reloading...');
      const nodemon = spawn('npm', ['run', 'server:dev'], {
        stdio: 'pipe',
        shell: true,
        env: {
          ...process.env,
          ELECTRON_DEV: 'true',
          NODE_ENV: 'development'
        }
      });

      nodemon.stdout.on('data', (data) => {
        const output = data.toString();
        console.log(`[Server] ${output}`);
        if (output.includes('Server is now listening')) {
          console.log('Server ready, loading frontend...');
          mainWindow.loadURL('http://localhost:3000');
        }
      });

      nodemon.stderr.on('data', (data) => {
        console.error(`[Server Error] ${data.toString()}`);
      });

      nodemon.on('exit', (code) => {
        console.log(`Server process exited with code ${code}`);
        if (code !== 0) {
          console.log('Attempting to restart server...');
        }
      });

      serverProcess = nodemon;
    } else {
      // Production mode
      console.log('Starting server in production mode...');
      try {
        const server = await startServer(PORT);
        serverProcess = server;
        mainWindow.loadURL('http://localhost:3000');
      } catch (error) {
        console.error('Error starting server:', error);
        mainWindow.loadURL('http://localhost:3000'); // Still try to load frontend
      }
    }

    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error(`Failed to load window: ${errorDescription} (${errorCode})`);
      mainWindow.loadURL(`data:text/html;charset=utf-8,
        <html>
          <head><title>Error Loading Application</title></head>
          <body>
            <h2>Failed to load application</h2>
            <p>Error: ${errorDescription}</p>
            <p>If you're in development mode, make sure your Next.js dev server is running on port 3000.</p>
            <p>If you're in production mode, check that the server started correctly on port ${PORT}.</p>
            <button onclick="window.location.reload()">Retry</button>
          </body>
        </html>
      `);
      mainWindow.show();
    });

    mainWindow.webContents.on('did-finish-load', () => {
      console.log('Window content loaded successfully');
      mainWindow.show();
    });

    if (isDev) {
      console.log('Opening DevTools in development mode');
      mainWindow.webContents.openDevTools();
    }
  } catch (error) {
    console.error('Error creating window:', error);
    try {
      mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        },
      });

      mainWindow.loadURL(`data:text/html;charset=utf-8,
        <html>
          <head><title>Application Error</title></head>
          <body>
            <h2>Error Starting Application</h2>
            <p>There was an error starting the application: ${error.message}</p>
            <button onclick="window.location.reload()">Retry</button>
          </body>
        </html>
      `);
    } catch (fallbackError) {
      console.error('Failed to create error window:', fallbackError);
    }
  }
};

// Error handling for unhandled exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle app lifecycle
app.whenReady()
  .then(() => {
    console.log('Electron app is ready');
    createWindow();
  })
  .catch((err) => {
    console.error('Error during app.whenReady():', err);
  });

app.on('window-all-closed', async () => {
  console.log('All windows closed');
  if (process.platform !== 'darwin') {
    if (serverProcess) {
      console.log('Closing server process');
      try {
        if (serverProcess.kill) {
          serverProcess.kill();
        } else if (serverProcess.close) {
          await serverProcess.close();
        }
        console.log('Server process closed successfully');
      } catch (error) {
        console.error('Error closing server process:', error);
      }
    }

    // Kill any remaining Node.js processes
    try {
      const { exec } = require('child_process');
      if (process.platform === 'win32') {
        exec('taskkill /F /IM node.exe', (error) => {
          if (error) {
            console.error('Error killing Node.js processes:', error);
          } else {
            console.log('All Node.js processes terminated');
          }
        });
      }
    } catch (error) {
      console.error('Error in cleanup:', error);
    }

    console.log('Quitting application');
    app.quit();
  }
});

// Add before-quit handler
app.on('before-quit', () => {
  console.log('Application is quitting, cleaning up...');
  if (serverProcess) {
    try {
      if (serverProcess.kill) {
        serverProcess.kill();
      } else if (serverProcess.close) {
        serverProcess.close();
      }
    } catch (error) {
      console.error('Error closing server process:', error);
    }
  }
});

app.on('activate', () => {
  console.log('App activated');
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC handler to check if server is running
ipcMain.handle('is-server-running', () => {
  return !!serverProcess;
});

// IPC handlers
ipcMain.handle('open-external', async (_, url) => {
  if (typeof url !== 'string') throw new Error('URL must be a string');
  
  // Basic URL validation
  const validUrlPattern = /^https?:\/\//i;
  if (!validUrlPattern.test(url)) {
    throw new Error('Invalid URL protocol. Only http and https are allowed.');
  }

  try {
    await shell.openExternal(url);
    return true;
  } catch (error) {
    console.error('Error opening external URL:', error);
    throw error;
  }
});

// Handle notifications
ipcMain.on('show-notification', (event, notificationData) => {
  console.log('Showing notification:', notificationData);
  const notification = new Notification({
    title: notificationData.title,
    body: notificationData.body,
    silent: notificationData.silent || false,
    urgency: notificationData.urgency || 'normal',
    icon: path.join(__dirname, '../public/favicon.ico') // Use absolute path
  });

  notification.show();

  notification.on('click', () => {
    // Focus the window when notification is clicked
    const window = BrowserWindow.getFocusedWindow();
    if (window) {
      window.focus();
    }
    // Emit click event back to renderer
    event.sender.send('notification-clicked', notificationData);
  });

  // Handle notification close
  notification.on('close', () => {
    event.sender.send('notification-closed', notificationData);
  });
});