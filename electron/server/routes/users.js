import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import {
  CONSTANTS
} from '../utils/userUtils.js';
import validateUser from '../utils/validateUser.js';
import { loginHandler, logoutHandler } from '../utils/authHandlers.js';
import { sessionManager } from '../utils/sessionManager.js';
import { activityLogger } from '../utils/activityLogger.js';

// Socket.IO event handlers
export const registerSocketEvents = (socket, { db, sessionDB, logsDB, restaurantsDB, branchesDB }) => {
  if (!db || !sessionDB || !logsDB || !restaurantsDB || !branchesDB) {
    console.error('Missing required database dependencies for user routes');
    return;
  }

  // Authentication Events
  socket.on('auth:login', async (data, callback) => {
    console.log('Processing login:', { email: data.email, password: '[REDACTED]' });
    
    try {
      // Validate required fields
      if (!data.email || !data.password) {
        throw new Error('Email and password are required');
      }

      const deviceInfo = {
        ip: socket.handshake.address,
        userAgent: socket.handshake.headers['user-agent'],
        deviceId: socket.id
      };

      // Check database connections
      try {
        await Promise.all([
          db.info(),
          sessionDB.info(),
          logsDB.info()
        ]);
      } catch (error) {
        console.error('Database connection error:', error);
        throw new Error('Database connection error');
      }

      const result = await loginHandler({
        email: data.email,
        password: data.password,
        deviceInfo,
        db,
        sessionDB,
        logsDB
      });

      if (result.success) {
        socket.user = result.user;
        socket.sessionId = result.session._id;
      }

      socket.emit('auth:login:' + (result.success ? 'success' : 'error'), result);
      callback?.(result);

    } catch (error) {
      console.error('Login error:', error);
      const response = {
        success: false,
        message: error.message || 'Login failed',
        error: error.message
      };
      socket.emit('auth:login:error', response);
      callback?.(response);
    }
  });

  socket.on('auth:logout', async (data, callback) => {
    console.log('Processing logout for session:', data.sessionId);
    
    try {
      // Check database connections
      try {
        await Promise.all([
          db.info(),
          sessionDB.info(),
          logsDB.info()
        ]);
      } catch (error) {
        console.error('Database connection error:', error);
        throw new Error('Database connection error');
      }

      const deviceInfo = {
        ip: socket.handshake.address,
        userAgent: socket.handshake.headers['user-agent'],
        deviceId: socket.id
      };

      const result = await logoutHandler({
        sessionId: data.sessionId || socket.sessionId,
        deviceInfo,
        db,
        sessionDB,
        logsDB
      });

      if (result.success) {
        delete socket.user;
        delete socket.sessionId;
      }

      socket.emit('auth:logout:' + (result.success ? 'success' : 'error'), result);
      callback?.(result);

    } catch (error) {
      console.error('Logout error:', error);
      const response = {
        success: false,
        message: error.message || 'Logout failed',
        error: error.message
      };
      socket.emit('auth:logout:error', response);
      callback?.(response);
    }
  });

  // User creation
  socket.on('user:create', async (data, callback) => {
    console.log('Processing user creation request:', { ...data, password: '[REDACTED]' });
    
    try {
      const session = await sessionDB.get(data.sessionId).catch(() => null);
      if (!session || session._deleted || new Date(session.expiresAt) < new Date()) {
        console.error('Invalid or expired session');
        return callback?.({
          success: false,
          message: 'Invalid or expired session'
        });
      }

      const currentUser = session.userDetails;
      if (!currentUser) {
        console.error('User not found in session');
        return callback?.({
          success: false,
          message: 'User not found in session'
        });
      }

      // 1. Validate user data
      const validation = await validateUser(data, db, false, {
        currentRole: currentUser.role,
        restaurantsDB,
        branchesDB
      });
      
      if (!validation.isValid) {
        console.error('User validation failed:', validation.errors);
        socket.emit('user:create:error', {
          message: 'Validation failed',
          errors: validation.errors
        });
        return callback?.({
          success: false,
          message: 'Validation failed',
          errors: validation.errors
        });
      }

      const { sanitizedData } = validation;

      // Validate restaurant and branch existence
      try {
        const restaurant = await restaurantsDB.get(sanitizedData.restaurantId);
        if (!restaurant || restaurant._deleted) {
          return callback?.({
            success: false,
            message: 'Restaurant not found'
          });
        }

        const branch = await branchesDB.get(sanitizedData.branchId);
        if (!branch || branch._deleted) {
          return callback?.({
            success: false,
            message: 'Branch not found'
          });
        }

        // Verify branch belongs to restaurant
        if (branch.restaurantId !== sanitizedData.restaurantId) {
          return callback?.({
            success: false,
            message: 'Branch does not belong to the specified restaurant'
          });
        }
      } catch (error) {
        console.error('Error validating restaurant/branch:', error);
        return callback?.({
          success: false,
          message: 'Error validating restaurant or branch'
        });
      }

      // 2. Create user document
      const requestedRole = data.role || CONSTANTS.ROLES.WAITER; // Default to waiter role
      if (!Object.values(CONSTANTS.ROLES).includes(requestedRole)) {
        throw new Error('Invalid role specified');
      }

      const hashedPassword = await bcrypt.hash(sanitizedData.password, 10);
      const user = {
        _id: `user_${uuidv4()}`,
        type: 'user',
        email: sanitizedData.email,
        password: hashedPassword,
        name: sanitizedData.name,
        role: requestedRole,
        phone: sanitizedData.phone,
        restaurantId: sanitizedData.restaurantId,
        branchId: sanitizedData.branchId,
        restaurantName: sanitizedData.restaurantName,
        branchName: sanitizedData.branchName,
        branchPhone: sanitizedData.branchPhone,
        branchLocation: sanitizedData.branchLocation,
        failedLoginAttempts: 0,
        lastLoginAttempt: null,
        isLocked: false,
        lockExpiresAt: null,
        passwordLastChanged: new Date().toISOString(),
        passwordExpiresAt: new Date(Date.now() + CONSTANTS.PASSWORD_POLICIES.EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString(),
        passwordHistory: [],
        lastActive: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // 3. Save user to database
      await db.put(user);

      // 4. Remove sensitive data before sending response
      const { password: _, ...userWithoutPassword } = user;

      // 5. Emit success event
      socket.emit('user:create:success', userWithoutPassword);

      // 6. Send response to callback
      return callback?.({
        success: true,
        message: 'User created successfully',
        user: userWithoutPassword
      });

    } catch (error) {
      console.error('User creation error:', error);
      socket.emit('user:create:error', {
        message: 'Internal server error',
        error: error.message
      });
      return callback?.({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  });

  const setupIndexes = async () => {
    try {
      // Create indexes one by one to ensure they're created in order
      await db.createIndex({
          index: { fields: ['email', 'type'] }
      });
      await db.createIndex({
          index: { fields: ['restaurantId', 'type'] }
      });
      await db.createIndex({
          index: { fields: ['role', 'type'] }
      });
      await db.createIndex({
        index: { fields: ['type', 'createdAt'] }
      });
      console.log('User indexes created successfully');
    } catch (error) {
      console.error('Failed to create user indexes:', error);
    }
  };

  // Create indexes immediately
  setupIndexes().catch(error => {
    console.error('Error setting up user indexes:', error);
  });

  socket.on('user:getAll', async (data, callback) => {
    try {
      // Ensure callback is a function
      if (typeof callback !== 'function') {
        console.error('Callback is not a function in user:getAll');
        return;
      }

      // Ensure indexes are created
      await setupIndexes();

      // Try to get users with index
    try {
      const result = await db.find({
        selector: {
          type: 'user',
            createdAt: { $exists: true },
            _deleted: { $exists: false }
        },
          use_index: ['type', 'createdAt'],
          sort: [{ type: 'asc' }, { createdAt: 'desc' }]
      });

      const users = result.docs.map(({ password, ...user }) => user);

      callback({
        success: true,
        users,
      });
      } catch (indexError) {
        // Fallback to simple query if index fails
        console.warn('Index query failed, falling back to simple query:', indexError);
        const result = await db.find({
          selector: {
            type: 'user',
            _deleted: { $exists: false }
          }
        });

        const users = result.docs
          .map(({ password, ...user }) => user)
          .sort((a, b) => {
            // Sort manually if index fails
            if (a.type !== b.type) return a.type.localeCompare(b.type);
            return new Date(b.createdAt) - new Date(a.createdAt);
          });

        callback({
          success: true,
          users,
        });
      }
    } catch (error) {
      console.error('Get All Users error:', error);
      if (typeof callback === 'function') {
      callback({
        success: false,
        message: 'Internal server error',
          error: error.message
      });
      }
    }
  });

  socket.on('user:update', async (data, callback) => {
    try {
      const session = await sessionDB.get(data.sessionId).catch(() => null);
      if (!session || session._deleted || new Date(session.expiresAt) < new Date()) {
        return callback({
          success: false,
          message: 'Invalid or expired session'
        });
      }

      const currentUser = session.userDetails;
      if (!currentUser) {
        return callback({
          success: false,
          message: 'User not found in session'
        });
      }

      let user;
      try {
        user = await db.get(data.id);
      } catch (error) {
        return callback({
          success: false,
          message: 'User not found',
        });
      }

      // Create update data with only the fields that are provided
      const updateData = {
        email: data.email,
          password: data.password,
        name: data.name,
        role: data.role,
          phone: data.phone,
          restaurantId: data.restaurantId,
          branchId: data.branchId,
          restaurantName: data.restaurantName,
          branchName: data.branchName,
          branchPhone: data.branchPhone,
          branchLocation: data.branchLocation,
      };

      // Remove undefined fields
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          delete updateData[key];
        }
      });

      // If no fields to update, return early
      if (Object.keys(updateData).length === 0) {
        return callback({
          success: false,
          message: 'No fields to update'
        });
      }

      const validation = await validateUser(
        {
          ...user,
          ...updateData
        },
        db,
        true,
        {
          currentRole: currentUser.role,
          oldUserId: user._id,
          restaurantsDB,
          branchesDB
        }
      );
      if (!validation.isValid) {
        return callback({
          success: false,
          message: 'Validation failed',
          errors: validation.errors,
        });
      }

      const { sanitizedData } = validation;

      // Update only the provided fields
      const updatedUser = {
        ...user,
        ...sanitizedData,
        updatedAt: new Date().toISOString()
      };

      // Only update password-related fields if password is being changed
      if (sanitizedData.password) {
        updatedUser.password = await bcrypt.hash(sanitizedData.password, 10);
        updatedUser.passwordLastChanged = new Date().toISOString();
        updatedUser.passwordExpiresAt = new Date(Date.now() + CONSTANTS.PASSWORD_POLICIES.EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
      }

      await db.put(updatedUser);

      // Update user details in all active sessions
      const { password, ...userDetailsForSession } = updatedUser;
      await sessionManager.updateUserDetailsInSessions(sessionDB, user._id, userDetailsForSession, { logsDB });

      // Log the update
      await activityLogger.logActivity(logsDB, {
        type: activityLogger.ACTIVITY_TYPES.USER_UPDATED,
        userId: user._id,
        details: 'User details updated',
        metadata: {
          updatedBy: currentUser._id,
          updatedFields: Object.keys(sanitizedData)
        }
      });

      // Emit success event
      socket.emit('user:update:success', { ...updatedUser, password: undefined });
      socket.broadcast.emit('user:updated', { ...updatedUser, password: undefined });

      return callback({
        success: true,
        message: 'User updated successfully',
        user: { ...updatedUser, password: undefined }
      });
    } catch (error) {
      console.error('User update error:', error);
      return callback({
        success: false,
        message: error.message || 'Failed to update user',
        error: error.message
      });
    }
  });

  // Password update endpoint
  socket.on('user:updatePassword', async (data, callback) => {
    try {
      const session = await sessionDB.get(data.sessionId).catch(() => null);
      if (!session || session._deleted || new Date(session.expiresAt) < new Date()) {
        return callback({
          success: false,
          message: 'Invalid or expired session'
        });
      }

      const currentUser = session.userDetails;
      if (!currentUser) {
        return callback({
          success: false,
          message: 'User not found in session'
        });
      }

      // Validate required fields
      if (!data.currentPassword || !data.newPassword) {
        return callback({
          success: false,
          message: 'Current password and new password are required'
        });
      }

      let user;
      try {
        user = await db.get(data.id);
      } catch (error) {
        return callback({
          success: false,
          message: 'User not found',
        });
      }

      // Verify current password
      const isPasswordValid = await bcrypt.compare(data.currentPassword, user.password);
      if (!isPasswordValid) {
        return callback({
          success: false,
          message: 'Current password is incorrect'
        });
      }

      // Validate new password
      const validation = await validateUser(
        {
          email: user.email,
          password: data.newPassword,
          name: user.name,
          role: user.role,
          restaurantId: user.restaurantId,
          branchId: user.branchId
        },
        db,
        true,
        {
          currentRole: currentUser.role,
          oldUserId: user._id,
          restaurantsDB,
          branchesDB
        }
      );

      if (!validation.isValid) {
        return callback({
          success: false,
          message: 'Password validation failed',
          errors: validation.errors
        });
      }

      // Update password
      const hashedPassword = await bcrypt.hash(data.newPassword, 10);
      const updatedUser = {
        ...user,
        password: hashedPassword,
        passwordLastChanged: new Date().toISOString(),
        passwordExpiresAt: new Date(Date.now() + CONSTANTS.PASSWORD_POLICIES.EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString()
      };

      await db.put(updatedUser);

      // Update user details in all active sessions
      const { password, ...userDetailsForSession } = updatedUser;
      await sessionManager.updateUserDetailsInSessions(sessionDB, user._id, userDetailsForSession, { logsDB });

      // Log the password update
      await activityLogger.logActivity(logsDB, {
        type: activityLogger.ACTIVITY_TYPES.PASSWORD_UPDATED,
        userId: user._id,
        details: 'Password updated',
        metadata: {
          updatedBy: currentUser._id
        }
      });

      // Emit success event
      socket.emit('user:passwordUpdate:success', { ...updatedUser, password: undefined });
      socket.broadcast.emit('user:passwordUpdated', { ...updatedUser, password: undefined });

      return callback({
        success: true,
        message: 'Password updated successfully',
        user: { ...updatedUser, password: undefined }
      });
    } catch (error) {
      console.error('Password update error:', error);
      return callback({
        success: false,
        message: error.message || 'Failed to update password',
        error: error.message
      });
    }
  });

  socket.on('user:delete', async ({ id }, callback) => {
    try {
      let user;
      try {
        user = await db.get(id);
      } catch (error) {
        return callback({
          success: false,
          message: 'User not found',
        });
      }

      await db.put({
        ...user,
        _deleted: true,
        updatedAt: new Date().toISOString(),
      });

      socket.emit('user:deleted', { id });
      socket.broadcast.emit('user:deleted', { id });

      callback({
        success: true,
        message: 'User deleted successfully',
      });
    } catch (error) {
      console.error('Delete User error:', error);
      callback({
        success: false,
        message: 'Internal server error',
      });
    }
  });

  socket.on('user:deleteAll', async (callback) => {
    try {
      const result = await db.find({
        selector: { type: 'user', _deleted: { $exists: false } },
      });

      const deletePromises = result.docs.map((user) =>
        db.put({
          ...user,
          _deleted: true,
          updatedAt: new Date().toISOString(),
        })
      );

      await Promise.all(deletePromises);

      socket.emit('user:deletedAll', { count: result.docs.length });
      socket.broadcast.emit('user:deletedAll', { count: result.docs.length });

      callback({
        success: true,
        message: 'All users deleted successfully',
      });
    } catch (error) {
      console.error('Delete All Users error:', error);
      callback({
        success: false,
        message: 'Internal server error',
      });
    }
  });

  socket.on('user:getByBranch', async ({ branchId }, callback) => {
    try {
      const result = await db.find({
        selector: {
          type: 'user',
          branchId: branchId,
          _deleted: { $exists: false },
        },
        sort: [{ type: 'asc', createdAt: 'desc' }],
      });

      const users = result.docs.map(({ password, ...user }) => user);

      callback({
        success: true,
        users,
      });
    } catch (error) {
      console.error('Get Users by Branch error:', error);
      callback({
        success: false,
        message: 'Internal server error',
      });
    }
  });

  socket.on('user:getByRole', async ({ role }, callback) => {
    try {
      if (!Object.values(ROLES).includes(role)) {
        return callback({
          success: false,
          message: 'Invalid role',
        });
      }

      const result = await db.find({
        selector: {
          type: 'user',
          role: role,
          _deleted: { $exists: false },
        },
        sort: [{ type: 'asc', createdAt: 'desc' }],
      });

      const users = result.docs.map(({ password, ...user }) => user);

      callback({
        success: true,
        users,
      });
    } catch (error) {
      console.error('Get Users by Role error:', error);
      callback({
        success: false,
        message: 'Internal server error',
      });
    }
  });
  // Login is handled by auth:login event using loginHandler from authHandlers.js
  // Logout is handled by auth:logout event using logoutHandler from authHandlers.js

  socket.on('user:getCurrent', async ({ sessionId }, callback) => {
    try {
      if (!sessionId) {
        return callback({
          success: false,
          message: 'Session ID is required',
        });
      }

      let session;
      try {
        session = await sessionDB.get(sessionId);
      } catch (error) {
        return callback({
          success: false,
          message: 'Invalid or expired session',
        });
      }

      if (new Date(session.expiresAt) < new Date() || session._deleted) {
        return callback({
          success: false,
          message: 'Session expired',
        });
      }

      callback({
        success: true,
        user: session.userDetails,
        sessionId: sessionId,
      });
    } catch (error) {
      console.error('Get Current User error:', error);
      callback({
        success: false,
        message: 'Internal server error',
      });
    }
  });

  const cleanupExpiredSessions = async () => {
    try {
      const now = new Date().toISOString();

      const result = await sessionDB.find({
        selector: {
          type: 'session',
          expiresAt: { $lt: now },
          _deleted: { $exists: false },
        },
      });

      const deletePromises = result.docs.map((session) =>
        sessionDB.put({
          ...session,
          _deleted: true,
          updatedAt: now,
        })
      );

      await Promise.all(deletePromises);
      console.log(`Cleaned up ${result.docs.length} expired sessions`);
    } catch (error) {
      console.error('Session cleanup error:', error);
    }
  };
  setInterval(cleanupExpiredSessions, 60 * 60 * 1000);
};

// HTTP route plugin
export default async function userRoutes(fastify, options) {
  // Register routes
  fastify.post('/api/auth/login', async (request, reply) => {
    try {
      const result = await loginHandler(request.body, request.databases.usersDB, request.databases.sessionDB);
      return result;
    } catch (error) {
      reply.status(500).send({ error: error.message });
    }
  });

  fastify.post('/api/auth/logout', async (request, reply) => {
    try {
      await logoutHandler(request.body.sessionId, request.databases.sessionDB);
      return { success: true };
    } catch (error) {
      reply.status(500).send({ error: error.message });
    }
  });

  // Keep existing socket event handlers
  // ...existing code...
}