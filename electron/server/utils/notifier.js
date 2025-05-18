import { ipcMain, Notification } from 'electron';
import { v4 as uuidv4 } from 'uuid';

// Store for pending notifications
const pendingNotifications = new Map();

// Maximum retry attempts
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 seconds

export const showDesktopNotification = async ({ title, body, urgency = 'normal', onClick = null, retryCount = 0 }) => {
  try {
    const notification = new Notification({
      title,
      body,
      urgency, // 'normal' or 'critical'
      silent: false
    });

    if (onClick) {
      notification.on('click', onClick);
    }

    notification.show();

    // Store notification for retry if needed
    const notificationId = uuidv4();
    pendingNotifications.set(notificationId, {
      title,
      body,
      urgency,
      onClick,
      retryCount,
      timestamp: Date.now()
    });

    // Clean up old notifications
    cleanupOldNotifications();

    return notificationId;
  } catch (error) {
    console.error('Error showing notification:', error);
    
    // Retry logic
    if (retryCount < MAX_RETRIES) {
      console.log(`Retrying notification (${retryCount + 1}/${MAX_RETRIES})...`);
      setTimeout(() => {
        showDesktopNotification({
          title,
          body,
          urgency,
          onClick,
          retryCount: retryCount + 1
        });
      }, RETRY_DELAY);
    } else {
      console.error('Max retry attempts reached for notification');
    }
  }
};

// Clean up notifications older than 24 hours
const cleanupOldNotifications = () => {
  const ONE_DAY = 24 * 60 * 60 * 1000;
  const now = Date.now();

  for (const [id, notification] of pendingNotifications.entries()) {
    if (now - notification.timestamp > ONE_DAY) {
      pendingNotifications.delete(id);
    }
  }
};

// Get pending notifications
export const getPendingNotifications = () => {
  return Array.from(pendingNotifications.entries()).map(([id, notification]) => ({
    id,
    ...notification
  }));
};

// Clear specific notification
export const clearNotification = (notificationId) => {
  pendingNotifications.delete(notificationId);
};

// Clear all notifications
export const clearAllNotifications = () => {
  pendingNotifications.clear();
};

export const setupNotificationHandlers = () => {
  ipcMain.on('show-notification', async (event, notificationData) => {
    const notificationId = await showDesktopNotification(notificationData);
    event.reply('notification-sent', { id: notificationId });
  });

  ipcMain.on('show-alert', async (event, alertData) => {
    const notificationId = await showDesktopNotification({
      ...alertData,
      urgency: 'critical'
    });
    event.reply('notification-sent', { id: notificationId });
  });

  ipcMain.handle('get-pending-notifications', () => {
    return getPendingNotifications();
  });

  ipcMain.handle('clear-notification', (event, notificationId) => {
    clearNotification(notificationId);
  });

  ipcMain.handle('clear-all-notifications', () => {
    clearAllNotifications();
  });

  return () => {
    ipcMain.removeAllListeners('show-notification');
    ipcMain.removeAllListeners('show-alert');
    ipcMain.removeHandler('get-pending-notifications');
    ipcMain.removeHandler('clear-notification');
    ipcMain.removeHandler('clear-all-notifications');
  };
};
