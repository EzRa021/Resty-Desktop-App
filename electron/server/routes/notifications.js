import { v4 as uuidv4 } from 'uuid';

export const registerSocketEvents = (socket, { db: notificationsDB, usersDB, sessionDB, logsDB, io }) => {
  // Ensure databases are initialized
  if (!notificationsDB || !usersDB || !sessionDB || !logsDB || !io) {
    console.error('Required databases or io instance not initialized');
    return;
  }

  console.log('Registering notification socket events for socket:', socket.id);

  // Subscribe to notification channels
  socket.on('notifications:subscribe', async ({ channels, userId }) => {
    try {
      console.log('Received subscription request:', { channels, userId, socketId: socket.id });
      
      // Validate session
      let session;
      try {
        session = await sessionDB.get(socket.id);
      } catch (error) {
        console.log('Creating new session for socket:', socket.id);
        // Create a new session for testing
        const newSession = {
          _id: socket.id,
          userId,
          createdAt: new Date().toISOString()
        };
        await sessionDB.put(newSession);
        session = newSession;
      }

      // Get or create user preferences
      let user;
      try {
        user = await usersDB.get(userId);
      } catch (error) {
        console.log('Creating new user:', userId);
        user = {
          _id: userId,
          notificationPreferences: {
            enabled: true,
            channels: [],
            grouping: true,
            desktopNotifications: true,
            soundEnabled: true
          }
        };
        await usersDB.put(user);
      }

      const userPreferences = user.notificationPreferences || {
        enabled: true,
        channels: [],
        grouping: true,
        desktopNotifications: true,
        soundEnabled: true
      };

      // Update user preferences
      userPreferences.channels = [...new Set([...userPreferences.channels, ...channels])];
      user.notificationPreferences = userPreferences;

      // Use put with _rev to handle conflicts
      try {
        await usersDB.put(user);
      } catch (error) {
        if (error.name === 'conflict') {
          // If conflict, get the latest version and update it
          const latestUser = await usersDB.get(userId);
          latestUser.notificationPreferences = userPreferences;
          await usersDB.put(latestUser);
        } else {
          throw error;
        }
      }

      // Join notification rooms
      channels.forEach(channel => {
        const roomName = `notification:${channel}`;
        socket.join(roomName);
        console.log(`Socket ${socket.id} joined room ${roomName}`);
      });

      // Join user-specific room
      const userRoom = `user:${userId}`;
      socket.join(userRoom);
      console.log(`Socket ${socket.id} joined user room ${userRoom}`);

      // Store user info in socket for later use
      socket.user = { id: userId };
      socket.userPreferences = userPreferences;

      socket.emit('notifications:subscribed', {
        success: true,
        channels,
        preferences: userPreferences
      });

    } catch (error) {
      console.error('Error in notifications:subscribe:', error);
      socket.emit('notifications:error', {
        message: error.message || 'Failed to subscribe to notifications'
      });
    }
  });

  // Update notification preferences
  socket.on('notifications:updatePreferences', async ({ userId, preferences }) => {
    try {
      const user = await usersDB.get(userId).catch(() => null);
      if (!user) {
        socket.emit('notifications:error', { message: 'User not found' });
        return;
      }

      const updatedPreferences = {
        ...user.notificationPreferences,
        ...preferences
      };

      await usersDB.put({
        ...user,
        notificationPreferences: updatedPreferences
      });

      socket.emit('notifications:preferencesUpdated', { preferences: updatedPreferences });
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      socket.emit('notifications:error', { message: error.message });
    }
  });

  // Create a new notification
  socket.on('notifications:create', async ({ type, message, priority, targetUsers, metadata, groupKey }) => {
    try {
      console.log('Creating notification:', { type, message, priority, targetUsers, metadata, groupKey });
      
      const notification = {
        _id: uuidv4(),
        type,
        message,
        priority: priority || 'normal',
        metadata: metadata || {},
        createdAt: new Date().toISOString(),
        read: false,
        targetUsers: targetUsers || [],
        groupKey: groupKey || null
      };

      console.log('Saving notification to database:', notification);
      await notificationsDB.put(notification);
      console.log('Notification saved successfully');

      // Get target users' preferences
      console.log('Getting target users preferences');
      const targetUserDocs = await Promise.all(
        targetUsers.map(userId => usersDB.get(userId).catch(() => null))
      );
      console.log('Target users found:', targetUserDocs.map(u => u?._id));

      // Emit to specific users based on their preferences
      targetUserDocs.forEach(user => {
        if (user && user.notificationPreferences?.enabled) {
          // Find all sockets for this user
          const userSockets = Array.from(io.sockets.sockets.values())
            .filter(s => s.userId === user._id);
          
          console.log(`Found ${userSockets.length} sockets for user ${user._id}`);

          userSockets.forEach(userSocket => {
            console.log(`Sending notification to socket ${userSocket.id}`);
            // Send desktop notification if enabled
            if (user.notificationPreferences.desktopNotifications) {
              console.log('Sending desktop notification');
              userSocket.emit('show-notification', {
                title: type,
                body: message,
                urgency: priority === 'high' ? 'critical' : 'normal',
                silent: !user.notificationPreferences.soundEnabled,
                metadata: notification.metadata
              });
            }

            // Send socket notification
            console.log('Sending socket notification');
            userSocket.emit('notifications:new', notification);
          });
        }
      });

      // Emit to notification type channel
      console.log(`Emitting to notification channel: notification:${type}`);
      io.to(`notification:${type}`).emit('notifications:new', notification);

      // Log the notification creation
      await logsDB.put({
        _id: uuidv4(),
        type: 'notification_created',
        notification: notification._id,
        timestamp: new Date().toISOString()
      });

      console.log('Notification process completed successfully');

    } catch (error) {
      console.error('Error in notifications:create:', error);
      socket.emit('notifications:error', { message: error.message });
    }
  });

  // Mark notification as read
  socket.on('notifications:markRead', async ({ notificationId, userId }) => {
    try {
      const notification = await notificationsDB.get(notificationId).catch(() => null);
      if (!notification) {
        socket.emit('notifications:error', { message: 'Notification not found' });
        return;
      }
      
      // If notification is part of a group, mark all related notifications as read
      if (notification.groupKey) {
        const groupNotifications = await notificationsDB.find({
          selector: {
            type: notification.type,
            groupKey: notification.groupKey,
            read: false
          }
        }).catch(() => ({ docs: [] }));

        await Promise.all(groupNotifications.docs.map(async (groupNotification) => {
          groupNotification.read = true;
          groupNotification.readAt = new Date().toISOString();
          groupNotification.readBy = userId;
          await notificationsDB.put(groupNotification);
        }));
      } else {
      notification.read = true;
      notification.readAt = new Date().toISOString();
        notification.readBy = userId;
      await notificationsDB.put(notification);
      }
      
      socket.emit('notifications:marked', { notificationId });
    } catch (error) {
      console.error('Error in notifications:markRead:', error);
      socket.emit('notifications:error', { message: error.message });
    }
  });

  // Get unread notifications
  socket.on('notifications:getUnread', async ({ userId }) => {
    try {
      const result = await notificationsDB.find({
        selector: {
          targetUsers: userId,
          read: false
        },
        sort: [{ createdAt: 'desc' }]
      }).catch(() => ({ docs: [] }));
      
      socket.emit('notifications:unread', { notifications: result.docs });
    } catch (error) {
      console.error('Error in notifications:getUnread:', error);
      socket.emit('notifications:error', { message: error.message });
    }
  });

  // Handle client disconnection
  socket.on('disconnect', () => {
    // Clean up any notification subscriptions
    socket.rooms.forEach(room => {
      if (room.startsWith('notification:')) {
        socket.leave(room);
      }
    });
  });
};
