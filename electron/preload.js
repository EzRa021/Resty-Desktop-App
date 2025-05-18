const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  isServerRunning: () => ipcRenderer.invoke('is-server-running'),
  restartServer: () => ipcRenderer.invoke('restart-server'),
  onServerStatus: (callback) => {
    ipcRenderer.on('server-status', (_, data) => callback(data));
    return () => ipcRenderer.removeListener('server-status', callback);
  },
  // Add notification functionality
  showNotification: (notificationData) => {
    ipcRenderer.send('show-notification', notificationData);
  },
  onNotificationClick: (callback) => {
    ipcRenderer.on('notification-clicked', (_, data) => callback(data));
    return () => ipcRenderer.removeListener('notification-clicked', callback);
  },
  onNotificationClose: (callback) => {
    ipcRenderer.on('notification-closed', (_, data) => callback(data));
    return () => ipcRenderer.removeListener('notification-closed', callback);
  },
  // Add external URL opening functionality
  openExternal: (url) => ipcRenderer.invoke('open-external', url)
});