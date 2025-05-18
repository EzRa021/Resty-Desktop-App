import { useState, useEffect } from 'react';
import { getSocket } from '../lib/socket';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { toast } from 'sonner';

export default function NotificationTest() {
  const [notifications, setNotifications] = useState([]);
  const [preferences, setPreferences] = useState({
    enabled: true,
    desktopNotifications: true,
    soundEnabled: true,
    grouping: true
  });
  const [channels, setChannels] = useState(['test']);
  const [userId] = useState('user_7aac2d8f-413a-4768-9056-426a6aeb02a0');
  const [socket, setSocket] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting');

  useEffect(() => {
    // Initialize socket
    const socketInstance = getSocket();
    setSocket(socketInstance);

    // Debug connection status
    socketInstance.on('connect', () => {
      console.log('Socket connected successfully');
      setConnectionStatus('connected');
    });

    socketInstance.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setConnectionStatus('error');
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setConnectionStatus('disconnected');
    });

    // Cleanup function
    return () => {
      if (socketInstance) {
        socketInstance.off('notifications:new');
        socketInstance.off('notifications:subscribed');
        socketInstance.off('notifications:error');
        socketInstance.off('notifications:unread');
        socketInstance.off('connect');
        socketInstance.off('connect_error');
        socketInstance.off('disconnect');
      }
    };
  }, []);

  useEffect(() => {
    if (!socket) return;

    // Subscribe to notifications
    const subscribeToNotifications = () => {
      console.log('Subscribing to notifications...');
      socket.emit('notifications:subscribe', {
        channels,
        userId
      });
    };

    // Handle notification events
    socket.on('notifications:new', (notification) => {
      console.log('Received new notification:', notification);
      setNotifications(prev => [notification, ...prev]);
      
      // Show desktop notification if enabled
      if (preferences.desktopNotifications) {
        window.electron.showNotification({
          title: notification.type,
          body: notification.message,
          silent: !preferences.soundEnabled
        });
      }
    });

    socket.on('notifications:subscribed', (data) => {
      console.log('Successfully subscribed to notifications:', data);
      if (data.preferences) {
        setPreferences(prev => ({ ...prev, ...data.preferences }));
      }
    });

    socket.on('notifications:error', (error) => {
      console.error('Notification error:', error);
      toast.error(error.message || 'Failed to subscribe to notifications');
    });

    // Subscribe when socket is connected
    if (socket.connected) {
      subscribeToNotifications();
    }

    socket.on('connect', () => {
      console.log('Socket connected, subscribing to notifications...');
      subscribeToNotifications();
    });

    // Cleanup
    return () => {
      socket.off('notifications:new');
      socket.off('notifications:subscribed');
      socket.off('notifications:error');
    };
  }, [socket, channels, userId, preferences.desktopNotifications, preferences.soundEnabled]);

  const handlePreferenceChange = (key, value) => {
    if (!socket) return;
    
    console.log('Updating preferences:', { key, value });
    const newPreferences = { ...preferences, [key]: value };
    setPreferences(newPreferences);
    
    socket.emit('notifications:updatePreferences', {
      userId,
      preferences: newPreferences
    });
  };

  const sendTestNotification = (type = 'test') => {
    if (!socket) {
      console.error('Socket not initialized');
      return;
    }

    console.log('Sending test notification:', type);
    const notificationData = {
      type,
      message: `Test notification ${new Date().toLocaleTimeString()}`,
      priority: type === 'urgent' ? 'high' : 'normal',
      targetUsers: [userId],
      metadata: { test: true },
      groupKey: type === 'test' ? 'test-group' : null
    };
    console.log('Notification data:', notificationData);
    socket.emit('notifications:create', notificationData);
  };

  const showElectronNotification = (notification) => {
    console.log('Showing Electron notification:', notification);
    if (window.electron) {
      window.electron.showNotification({
        title: notification.type,
        body: notification.message,
        urgency: notification.priority === 'high' ? 'critical' : 'normal',
        silent: !preferences.soundEnabled,
        metadata: notification.metadata
      });
    } else {
      console.warn('Electron API not available');
      // Fallback to toast notification
      toast.info(notification.message, {
        description: `Type: ${notification.type}`,
        duration: 5000
      });
    }
  };

  const markAsRead = (notificationId) => {
    if (!socket) return;

    console.log('Marking notification as read:', notificationId);
    socket.emit('notifications:markRead', {
      notificationId,
      userId
    });
    setNotifications(prev => 
      prev.map(n => n._id === notificationId ? { ...n, read: true } : n)
    );
  };

  if (!socket) {
    return (
      <div className="p-4">
        <p className="text-center text-gray-500">Connecting to notification server...</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <Card className="p-4">
        <h2 className="text-xl font-bold mb-4">Connection Status</h2>
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${
            connectionStatus === 'connected' ? 'bg-green-500' :
            connectionStatus === 'error' ? 'bg-red-500' :
            connectionStatus === 'disconnected' ? 'bg-yellow-500' :
            'bg-gray-500'
          }`} />
          <span className="capitalize">{connectionStatus}</span>
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="text-xl font-bold mb-4">Notification Preferences</h2>
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch
              checked={preferences.enabled}
              onCheckedChange={(checked) => handlePreferenceChange('enabled', checked)}
            />
            <Label>Enable Notifications</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              checked={preferences.desktopNotifications}
              onCheckedChange={(checked) => handlePreferenceChange('desktopNotifications', checked)}
            />
            <Label>Desktop Notifications</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              checked={preferences.soundEnabled}
              onCheckedChange={(checked) => handlePreferenceChange('soundEnabled', checked)}
            />
            <Label>Sound Notifications</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              checked={preferences.grouping}
              onCheckedChange={(checked) => handlePreferenceChange('grouping', checked)}
            />
            <Label>Group Similar Notifications</Label>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="text-xl font-bold mb-4">Test Notifications</h2>
        <div className="space-y-4">
          <Button onClick={() => sendTestNotification()}>
            Send Test Notification
          </Button>
          <Button onClick={() => sendTestNotification('urgent')}>
            Send Urgent Notification
          </Button>
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="text-xl font-bold mb-4">Notifications</h2>
        <div className="space-y-2">
          {notifications.map((notification) => (
            <div
              key={notification._id}
              className={`p-3 rounded-lg border ${
                notification.read ? 'bg-gray-50' : 'bg-white'
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">{notification.type}</p>
                  <p className="text-sm text-gray-600">{notification.message}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(notification.createdAt).toLocaleString()}
                  </p>
                </div>
                {!notification.read && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => markAsRead(notification._id)}
                  >
                    Mark as Read
                  </Button>
                )}
              </div>
            </div>
          ))}
          {notifications.length === 0 && (
            <p className="text-gray-500 text-center">No notifications</p>
          )}
        </div>
      </Card>
    </div>
  );
} 