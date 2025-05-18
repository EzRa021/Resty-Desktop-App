import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { CONSTANTS } from '../utils/userUtils.js';
import validateUser from '../utils/validateUser.js';

// Socket.IO event handlers
export const registerSocketEvents = (socket, { db, sessionDB, logsDB }) => {
  if (!db || !sessionDB || !logsDB) {
    console.error('Missing required database dependencies for test routes');
    return;
  }

  // Test user creation
  socket.on('test:createUser', async (data, callback) => {
    console.log('Processing test user creation:', { ...data, password: '[REDACTED]' });
    
    try {
      // Validate required fields
      if (!data.email || !data.password || !data.name) {
        throw new Error('Email, password, and name are required');
      }

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

      // Validate user data
      const validation = await validateUser(data, db, false);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      const { sanitizedData } = validation;

      // Create user document
      const hashedPassword = await bcrypt.hash(sanitizedData.password, 10);
      const user = {
        _id: `user_${uuidv4()}`,
        type: 'user',
        email: sanitizedData.email,
        password: hashedPassword,
        name: sanitizedData.name,
        role: data.role || CONSTANTS.ROLES.WAITER,
        phone: sanitizedData.phone || '',
        restaurantId: sanitizedData.restaurantId || null,
        branchId: sanitizedData.branchId || null,
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

      // Save user to database
      await db.put(user);

      // Remove sensitive data before sending response
      const { password: _, ...userWithoutPassword } = user;

      // Emit success event
      socket.emit('test:createUser:success', userWithoutPassword);

      // Send response to callback
      callback?.({
        success: true,
        message: 'Test user created successfully',
        user: userWithoutPassword
      });

    } catch (error) {
      console.error('Test user creation error:', error);
      const response = {
        success: false,
        message: error.message || 'Failed to create test user',
        error: error.message
      };
      socket.emit('test:createUser:error', response);
      callback?.(response);
    }
  });

  // Test database connection
  socket.on('test:checkConnection', async (callback) => {
    try {
      // Check all database connections
      const results = await Promise.all([
        db.info().then(info => ({ name: 'users', status: 'connected', info })),
        sessionDB.info().then(info => ({ name: 'sessions', status: 'connected', info })),
        logsDB.info().then(info => ({ name: 'logs', status: 'connected', info }))
      ]);

      const response = {
        success: true,
        message: 'All database connections successful',
        databases: results
      };

      socket.emit('test:checkConnection:success', response);
      callback?.(response);

    } catch (error) {
      console.error('Database connection test error:', error);
      const response = {
        success: false,
        message: 'Database connection test failed',
        error: error.message
      };
      socket.emit('test:checkConnection:error', response);
      callback?.(response);
    }
  });

  // Test session creation
  socket.on('test:createSession', async (data, callback) => {
    try {
      if (!data.userId) {
        throw new Error('User ID is required');
      }

      // Check if user exists
      const user = await db.get(data.userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Create session
      const session = {
        _id: `session_${uuidv4()}`,
        type: 'session',
        userId: user._id,
        userDetails: {
          _id: user._id,
          email: user.email,
          name: user.name,
          role: user.role
        },
        deviceInfo: {
          ip: socket.handshake.address,
          userAgent: socket.handshake.headers['user-agent'],
          deviceId: socket.id
        },
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
      };

      await sessionDB.put(session);

      const response = {
        success: true,
        message: 'Test session created successfully',
        session
      };

      socket.emit('test:createSession:success', response);
      callback?.(response);

    } catch (error) {
      console.error('Test session creation error:', error);
      const response = {
        success: false,
        message: error.message || 'Failed to create test session',
        error: error.message
      };
      socket.emit('test:createSession:error', response);
      callback?.(response);
    }
  });

  // Test activity logging
  socket.on('test:logActivity', async (data, callback) => {
    try {
      if (!data.userId || !data.type) {
        throw new Error('User ID and activity type are required');
      }

      // Check if user exists
      const user = await db.get(data.userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Create activity log
      const activity = {
        _id: `activity_${uuidv4()}`,
        type: 'activity',
        userId: user._id,
        activityType: data.type,
        details: data.details || {},
        timestamp: new Date().toISOString(),
        deviceInfo: {
          ip: socket.handshake.address,
          userAgent: socket.handshake.headers['user-agent'],
          deviceId: socket.id
        }
      };

      await logsDB.put(activity);

      const response = {
        success: true,
        message: 'Test activity logged successfully',
        activity
      };

      socket.emit('test:logActivity:success', response);
      callback?.(response);

    } catch (error) {
      console.error('Test activity logging error:', error);
      const response = {
        success: false,
        message: error.message || 'Failed to log test activity',
        error: error.message
      };
      socket.emit('test:logActivity:error', response);
      callback?.(response);
    }
  });

  // Test cleanup
  socket.on('test:cleanup', async (callback) => {
    try {
      // Clean up test data
      const cleanupPromises = [
        // Clean up test users
        db.find({
          selector: {
            type: 'user',
            email: { $regex: '^test_' }
          }
        }).then(result => 
          Promise.all(result.docs.map(doc => 
            db.put({ ...doc, _deleted: true })
          ))
        ),

        // Clean up test sessions
        sessionDB.find({
          selector: {
            type: 'session',
            createdAt: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() }
          }
        }).then(result => 
          Promise.all(result.docs.map(doc => 
            sessionDB.put({ ...doc, _deleted: true })
          ))
        ),

        // Clean up test activities
        logsDB.find({
          selector: {
            type: 'activity',
            timestamp: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() }
          }
        }).then(result => 
          Promise.all(result.docs.map(doc => 
            logsDB.put({ ...doc, _deleted: true })
          ))
        )
      ];

      const results = await Promise.all(cleanupPromises);
      const deletedCounts = {
        users: results[0].length,
        sessions: results[1].length,
        activities: results[2].length
      };

      const response = {
        success: true,
        message: 'Test data cleaned up successfully',
        deletedCounts
      };

      socket.emit('test:cleanup:success', response);
      callback?.(response);

    } catch (error) {
      console.error('Test cleanup error:', error);
      const response = {
        success: false,
        message: error.message || 'Failed to clean up test data',
        error: error.message
      };
      socket.emit('test:cleanup:error', response);
      callback?.(response);
    }
  });
};

// HTTP route plugin
export default async function testRoutes(fastify, options) {
  // Test database connection
  fastify.get('/api/test/connection', async (request, reply) => {
    try {
      const { usersDB, sessionDB, logsDB } = request.databases;
      
      const results = await Promise.all([
        usersDB.info().then(info => ({ name: 'users', status: 'connected', info })),
        sessionDB.info().then(info => ({ name: 'sessions', status: 'connected', info })),
        logsDB.info().then(info => ({ name: 'logs', status: 'connected', info }))
      ]);

      return {
        success: true,
        message: 'All database connections successful',
        databases: results
      };
    } catch (error) {
      reply.status(500).send({
        success: false,
        message: 'Database connection test failed',
        error: error.message
      });
    }
  });

  // Test user creation
  fastify.post('/api/test/user', async (request, reply) => {
    try {
      const { usersDB } = request.databases;
      const data = request.body;

      if (!data.email || !data.password || !data.name) {
        return reply.status(400).send({
          success: false,
          message: 'Email, password, and name are required'
        });
      }

      const validation = await validateUser(data, usersDB, false);
      if (!validation.isValid) {
        return reply.status(400).send({
          success: false,
          message: 'Validation failed',
          errors: validation.errors
        });
      }

      const { sanitizedData } = validation;
      const hashedPassword = await bcrypt.hash(sanitizedData.password, 10);

      const user = {
        _id: `user_${uuidv4()}`,
        type: 'user',
        email: sanitizedData.email,
        password: hashedPassword,
        name: sanitizedData.name,
        role: data.role || CONSTANTS.ROLES.WAITER,
        phone: sanitizedData.phone || '',
        restaurantId: sanitizedData.restaurantId || null,
        branchId: sanitizedData.branchId || null,
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

      await usersDB.put(user);
      const { password: _, ...userWithoutPassword } = user;

      return {
        success: true,
        message: 'Test user created successfully',
        user: userWithoutPassword
      };
    } catch (error) {
      reply.status(500).send({
        success: false,
        message: 'Failed to create test user',
        error: error.message
      });
    }
  });

  // Test cleanup
  fastify.delete('/api/test/cleanup', async (request, reply) => {
    try {
      const { usersDB, sessionDB, logsDB } = request.databases;

      const cleanupPromises = [
        // Clean up test users
        usersDB.find({
          selector: {
            type: 'user',
            email: { $regex: '^test_' }
          }
        }).then(result => 
          Promise.all(result.docs.map(doc => 
            usersDB.put({ ...doc, _deleted: true })
          ))
        ),

        // Clean up test sessions
        sessionDB.find({
          selector: {
            type: 'session',
            createdAt: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() }
          }
        }).then(result => 
          Promise.all(result.docs.map(doc => 
            sessionDB.put({ ...doc, _deleted: true })
          ))
        ),

        // Clean up test activities
        logsDB.find({
          selector: {
            type: 'activity',
            timestamp: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() }
          }
        }).then(result => 
          Promise.all(result.docs.map(doc => 
            logsDB.put({ ...doc, _deleted: true })
          ))
        )
      ];

      const results = await Promise.all(cleanupPromises);
      const deletedCounts = {
        users: results[0].length,
        sessions: results[1].length,
        activities: results[2].length
      };

      return {
        success: true,
        message: 'Test data cleaned up successfully',
        deletedCounts
      };
    } catch (error) {
      reply.status(500).send({
        success: false,
        message: 'Failed to clean up test data',
        error: error.message
      });
    }
  });
} 