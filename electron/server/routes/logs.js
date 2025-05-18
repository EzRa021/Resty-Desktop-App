import { v4 as uuidv4 } from 'uuid';
import sanitizeHtml from 'sanitize-html';

// Log levels
const LOG_LEVELS = {
  DEBUG: 'debug',
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical',
};

// Log categories
const LOG_CATEGORIES = {
  SYSTEM: 'system',
  AUTH: 'auth',
  USER: 'user',
  ORDER: 'order',
  MENU: 'menu',
  PAYMENT: 'payment',
  RESERVATION: 'reservation',
  INVENTORY: 'inventory',
  NOTIFICATION: 'notification',
  ANALYTICS: 'analytics',
  OTHER: 'other',
};

// Log sources
const LOG_SOURCES = {
  CLIENT: 'client',
  SERVER: 'server',
};

// Validation function for Log
const validateLog = (data) => {
  const errors = [];

  // Sanitize inputs
  const sanitizedData = {
    message: sanitizeHtml(data.message || ''),
    level: data.level || LOG_LEVELS.INFO,
    category: data.category || LOG_CATEGORIES.OTHER,
    source: data.source || LOG_SOURCES.CLIENT,
    userId: data.userId ? sanitizeHtml(data.userId) : undefined,
    userName: data.userName ? sanitizeHtml(data.userName) : undefined,
    sessionId: data.sessionId ? sanitizeHtml(data.sessionId) : undefined,
    restaurantId: data.restaurantId ? sanitizeHtml(data.restaurantId) : undefined,
    branchId: data.branchId ? sanitizeHtml(data.branchId) : undefined,
    metadata: data.metadata ? JSON.parse(JSON.stringify(data.metadata)) : {},
    userAgent: data.userAgent ? sanitizeHtml(data.userAgent) : undefined,
    ipAddress: data.ipAddress ? sanitizeHtml(data.ipAddress) : undefined,
    requestId: data.requestId ? sanitizeHtml(data.requestId) : undefined,
    path: data.path ? sanitizeHtml(data.path) : undefined,
    method: data.method ? sanitizeHtml(data.method) : undefined,
    statusCode: data.statusCode ? parseInt(data.statusCode, 10) : undefined,
    duration: data.duration ? parseInt(data.duration, 10) : undefined,
  };

  // Message validation (required)
  if (!sanitizedData.message) {
    errors.push('Log message is required');
  }

  // Level validation
  if (!Object.values(LOG_LEVELS).includes(sanitizedData.level)) {
    errors.push('Invalid log level');
  }

  // Category validation
  if (!Object.values(LOG_CATEGORIES).includes(sanitizedData.category)) {
    errors.push('Invalid log category');
  }

  // Source validation
  if (!Object.values(LOG_SOURCES).includes(sanitizedData.source)) {
    errors.push('Invalid log source');
  }

  // Status code validation if provided
  if (
    sanitizedData.statusCode !== undefined &&
    (isNaN(sanitizedData.statusCode) || sanitizedData.statusCode < 100 || sanitizedData.statusCode > 599)
  ) {
    errors.push('Invalid status code');
  }

  // Duration validation if provided
  if (sanitizedData.duration !== undefined && (isNaN(sanitizedData.duration) || sanitizedData.duration < 0)) {
    errors.push('Invalid duration');
  }

  return { isValid: errors.length === 0, errors, sanitizedData };
};

// Socket.IO event handlers
export const registerSocketEvents = (socket, options) => {
  const { logsDB, sessionDB } = options;

  // Create index for timestamp and type
  const createIndexes = async () => {
    try {
      await logsDB.createIndex({
        index: {
          fields: ['type', 'timestamp'],
          name: 'type-timestamp-index',
          ddoc: 'logs-index',
        },
      });
      console.log('Created PouchDB index for type and timestamp');
    } catch (error) {
      console.error('Failed to create PouchDB index:', error);
    }
  };

  // Initialize indexes when the route is registered
  createIndexes();

  // Create Log
  socket.on(
    'log:create',
    async (
      {
        message,
        level,
        category,
        source,
        userId,
        userName,
        sessionId,
        restaurantId,
        branchId,
        metadata,
        userAgent,
        ipAddress,
        requestId,
        path,
        method,
        statusCode,
        duration,
      },
      callback
    ) => {
      try {
        // Get IP and User-Agent from socket if not provided
        const requestIp = ipAddress || socket.request?.ip;
        const requestUserAgent = userAgent || socket.request?.headers?.['user-agent'];

        // Validate input
        const validation = validateLog({
          message,
          level,
          category,
          source,
          userId,
          userName,
          sessionId,
          restaurantId,
          branchId,
          metadata,
          userAgent: requestUserAgent,
          ipAddress: requestIp,
          requestId,
          path,
          method,
          statusCode,
          duration,
        });

        if (!validation.isValid) {
          return callback({
            success: false,
            message: 'Validation failed',
            errors: validation.errors,
          });
        }

        const { sanitizedData } = validation;

        // Enrich log with session information if sessionId is provided
        let sessionData = {};
        if (sanitizedData.sessionId) {
          try {
            const session = await sessionDB.get(sanitizedData.sessionId);
            if (!session._deleted && new Date(session.expiresAt) >= new Date()) {
              sessionData = {
                userId: session.userId,
                userName: session.userDetails?.name,
                userRole: session.userDetails?.role,
                restaurantId: session.userDetails?.restaurantId,
                branchId: session.userDetails?.branchId,
              };
            }
          } catch (error) {
            console.log('Session not found for log enrichment:', error);
          }
        }

        // Create log document
        const log = {
          _id: uuidv4(),
          type: 'log',
          timestamp: new Date().toISOString(),
          message: sanitizedData.message,
          level: sanitizedData.level,
          category: sanitizedData.category,
          source: sanitizedData.source,
          userId: sanitizedData.userId || sessionData.userId,
          userName: sanitizedData.userName || sessionData.userName,
          userRole: sessionData.userRole,
          sessionId: sanitizedData.sessionId,
          restaurantId: sanitizedData.restaurantId || sessionData.restaurantId,
          branchId: sanitizedData.branchId || sessionData.branchId,
          metadata: sanitizedData.metadata || {},
          userAgent: sanitizedData.userAgent,
          ipAddress: sanitizedData.ipAddress,
          requestId: sanitizedData.requestId || uuidv4().substring(0, 8),
          path: sanitizedData.path,
          method: sanitizedData.method,
          statusCode: sanitizedData.statusCode,
          duration: sanitizedData.duration,
        };

        // Save to logsDB
        await logsDB.put(log);

        // Emit real-time update to all clients (including sender for testing)
        socket.emit('log:created', log);
        socket.broadcast.emit('log:created', log);

        callback({
          success: true,
          message: 'Log created successfully',
          logId: log._id,
        });
      } catch (error) {
        console.error('Create Log error:', error);

        // Try to log the error about logging
        try {
          await logsDB.put({
            _id: uuidv4(),
            type: 'log',
            timestamp: new Date().toISOString(),
            message: 'Error creating log entry',
            level: LOG_LEVELS.ERROR,
            category: LOG_CATEGORIES.SYSTEM,
            source: LOG_SOURCES.SERVER,
            metadata: { error: error.message, stack: error.stack },
          });
        } catch (logError) {
          console.error('Failed to log error about logging:', logError);
        }

        callback({
          success: false,
          message: 'Internal server error',
        });
      }
    }
  );

  // Batch Create Logs
  socket.on('log:batchCreate', async ({ logs }, callback) => {
    try {
      if (!Array.isArray(logs) || logs.length === 0) {
        return callback({
          success: false,
          message: 'Invalid logs array',
        });
      }

      // Process each log
      const processedLogs = [];
      const failedLogs = [];

      for (const logData of logs) {
        const validation = validateLog({
          ...logData,
          userAgent: logData.userAgent || socket.request?.headers?.['user-agent'],
          ipAddress: logData.ipAddress || socket.request?.ip,
        });

        if (validation.isValid) {
          const { sanitizedData } = validation;

          // Create log document
          const log = {
            _id: uuidv4(),
            type: 'log',
            timestamp: new Date().toISOString(),
            message: sanitizedData.message,
            level: sanitizedData.level,
            category: sanitizedData.category,
            source: sanitizedData.source,
            userId: sanitizedData.userId,
            userName: sanitizedData.userName,
            sessionId: sanitizedData.sessionId,
            restaurantId: sanitizedData.restaurantId,
            branchId: sanitizedData.branchId,
            metadata: sanitizedData.metadata || {},
            userAgent: sanitizedData.userAgent,
            ipAddress: sanitizedData.ipAddress,
            requestId: sanitizedData.requestId || uuidv4().substring(0, 8),
            path: sanitizedData.path,
            method: sanitizedData.method,
            statusCode: sanitizedData.statusCode,
            duration: sanitizedData.duration,
          };

          processedLogs.push(log);
        } else {
          failedLogs.push({
            data: logData,
            errors: validation.errors,
          });
        }
      }

      // Bulk save to logsDB
      if (processedLogs.length > 0) {
        await Promise.all(processedLogs.map((log) => logsDB.put(log)));
        // Emit real-time updates for each created log
        processedLogs.forEach((log) => {
          socket.emit('log:created', log);
          socket.broadcast.emit('log:created', log);
        });
      }

      callback({
        success: true,
        message: `Successfully processed ${processedLogs.length} logs`,
        failed: failedLogs.length > 0 ? failedLogs : undefined,
        processedCount: processedLogs.length,
        failedCount: failedLogs.length,
      });
    } catch (error) {
      console.error('Batch Create Logs error:', error);
      callback({
        success: false,
        message: 'Internal server error',
      });
    }
  });

  // Get All Logs with pagination and filtering
  socket.on(
    'log:getAll',
    async (
      { level, category, source, userId, restaurantId, branchId, startDate, endDate, limit = 100, skip = 0, sort = 'desc' },
      callback
    ) => {
      try {
        // Build selector
        const selector = {
          type: 'log',
        };

        // Add filters if provided
        if (level) selector.level = level;
        if (category) selector.category = category;
        if (source) selector.source = source;
        if (userId) selector.userId = userId;
        if (restaurantId) selector.restaurantId = restaurantId;
        if (branchId) selector.branchId = branchId;

        // Date range filtering
        if (startDate || endDate) {
          selector.timestamp = {};
          if (startDate) selector.timestamp.$gte = startDate;
          if (endDate) selector.timestamp.$lte = endDate;
        }

        // Get total count first (for pagination info)
        const countResult = await logsDB.find({
          selector,
          fields: ['_id'],
        });

        const totalCount = countResult.docs.length;

        // Execute the actual query with sorting and pagination
        const result = await logsDB.find({
          selector,
          sort: [{ type: 'asc', timestamp: sort === 'asc' ? 'asc' : 'desc' }],
          limit: parseInt(limit, 10),
          skip: parseInt(skip, 10),
        });

        callback({
          success: true,
          logs: result.docs,
          pagination: {
            total: totalCount,
            limit: parseInt(limit, 10),
            skip: parseInt(skip, 10),
            hasMore: totalCount > parseInt(skip, 10) + result.docs.length,
          },
        });
      } catch (error) {
        console.error('Get Logs error:', error);
        callback({
          success: false,
          message: 'Internal server error',
        });
      }
    }
  );

  // Get Log by ID
  socket.on('log:getById', async ({ id }, callback) => {
    try {
      let log;
      try {
        log = await logsDB.get(id);
      } catch (error) {
        return callback({
          success: false,
          message: 'Log not found',
        });
      }

      callback({
        success: true,
        log,
      });
    } catch (error) {
      console.error('Get Log by ID error:', error);
      callback({
        success: false,
        message: 'Internal server error',
      });
    }
  });

  // Get Logs by User ID
  socket.on('log:getByUserId', async ({ userId, limit = 100, skip = 0 }, callback) => {
    try {
      const result = await logsDB.find({
        selector: {
          type: 'log',
          userId: userId,
        },
        sort: [{ type: 'asc', timestamp: 'desc' }],
        limit: parseInt(limit, 10),
        skip: parseInt(skip, 10),
      });

      callback({
        success: true,
        logs: result.docs,
      });
    } catch (error) {
      console.error('Get Logs by User ID error:', error);
      callback({
        success: false,
        message: 'Internal server error',
      });
    }
  });

  // Get Logs by Session ID
  socket.on('log:getBySessionId', async ({ sessionId, limit = 100, skip = 0 }, callback) => {
    try {
      const result = await logsDB.find({
        selector: {
          type: 'log',
          sessionId: sessionId,
        },
        sort: [{ type: 'asc', timestamp: 'desc' }],
        limit: parseInt(limit, 10),
        skip: parseInt(skip, 10),
      });

      callback({
        success: true,
        logs: result.docs,
      });
    } catch (error) {
      console.error('Get Logs by Session ID error:', error);
      callback({
        success: false,
        message: 'Internal server error',
      });
    }
  });

  // Get Logs by Branch ID
  socket.on('log:getByBranchId', async ({ branchId, limit = 100, skip = 0 }, callback) => {
    try {
      const result = await logsDB.find({
        selector: {
          type: 'log',
          branchId: branchId,
        },
        sort: [{ type: 'asc', timestamp: 'desc' }],
        limit: parseInt(limit, 10),
        skip: parseInt(skip, 10),
      });

      callback({
        success: true,
        logs: result.docs,
      });
    } catch (error) {
      console.error('Get Logs by Branch ID error:', error);
      callback({
        success: false,
        message: 'Internal server error',
      });
    }
  });

  // Get Logs by Restaurant ID
  socket.on('log:getByRestaurantId', async ({ restaurantId, limit = 100, skip = 0 }, callback) => {
    try {
      const result = await logsDB.find({
        selector: {
          type: 'log',
          restaurantId: restaurantId,
        },
        sort: [{ type: 'asc', timestamp: 'desc' }],
        limit: parseInt(limit, 10),
        skip: parseInt(skip, 10),
      });

      callback({
        success: true,
        logs: result.docs,
      });
    } catch (error) {
      console.error('Get Logs by Restaurant ID error:', error);
      callback({
        success: false,
        message: 'Internal server error',
      });
    }
  });

  // Get Error Logs
  socket.on('log:getErrors', async ({ limit = 100, skip = 0 }, callback) => {
    try {
      const result = await logsDB.find({
        selector: {
          type: 'log',
          level: { $in: [LOG_LEVELS.ERROR, LOG_LEVELS.CRITICAL] },
        },
        sort: [{ type: 'asc', timestamp: 'desc' }],
        limit: parseInt(limit, 10),
        skip: parseInt(skip, 10),
      });

      callback({
        success: true,
        logs: result.docs,
      });
    } catch (error) {
      console.error('Get Error Logs error:', error);
      callback({
        success: false,
        message: 'Internal server error',
      });
    }
  });

  // Get Logs By Level
  socket.on('log:getByLevel', async ({ level, limit = 100, skip = 0 }, callback) => {
    try {
      if (!Object.values(LOG_LEVELS).includes(level)) {
        return callback({
          success: false,
          message: 'Invalid log level',
        });
      }

      const result = await logsDB.find({
        selector: {
          type: 'log',
          level: level,
        },
        sort: [{ type: 'asc', timestamp: 'desc' }],
        limit: parseInt(limit, 10),
        skip: parseInt(skip, 10),
      });

      callback({
        success: true,
        logs: result.docs,
      });
    } catch (error) {
      console.error('Get Logs By Level error:', error);
      callback({
        success: false,
        message: 'Internal server error',
      });
    }
  });

  // Get Logs By Category
  socket.on('log:getByCategory', async ({ category, limit = 100, skip = 0 }, callback) => {
    try {
      if (!Object.values(LOG_CATEGORIES).includes(category)) {
        return callback({
          success: false,
          message: 'Invalid log category',
        });
      }

      const result = await logsDB.find({
        selector: {
          type: 'log',
          category: category,
        },
        sort: [{ type: 'asc', timestamp: 'desc' }],
        limit: parseInt(limit, 10),
        skip: parseInt(skip, 10),
      });

      callback({
        success: true,
        logs: result.docs,
      });
    } catch (error) {
      console.error('Get Logs By Category error:', error);
      callback({
        success: false,
        message: 'Internal server error',
      });
    }
  });

  // Delete Logs (admin function)
  socket.on('log:delete', async ({ ids }, callback) => {
    try {
      if (!Array.isArray(ids) || ids.length === 0) {
        return callback({
          success: false,
          message: 'Invalid log IDs array',
        });
      }

      // Fetch and delete logs
      const deletePromises = ids.map(async (id) => {
        try {
          const log = await logsDB.get(id);
          await logsDB.remove(log);
          return { id, success: true };
        } catch (error) {
          return { id, success: false, error: error.message };
        }
      });

      const results = await Promise.all(deletePromises);

      const succeeded = results.filter((r) => r.success).map((r) => r.id);
      const failed = results.filter((r) => !r.success);

      // Emit real-time update for deleted logs
      if (succeeded.length > 0) {
        socket.broadcast.emit('log:deleted', { ids: succeeded });
      }

      callback({
        success: true,
        message: `Successfully deleted ${succeeded.length} logs`,
        deleted: succeeded,
        failed: failed,
      });
    } catch (error) {
      console.error('Delete Logs error:', error);
      callback({
        success: false,
        message: 'Internal server error',
      });
    }
  });

  // Clear Old Logs
  socket.on('log:clearOld', async ({ days = 30, level }, callback) => {
    try {
      if (isNaN(days) || days < 1) {
        return callback({
          success: false,
          message: 'Invalid number of days',
        });
      }

      // Calculate the cutoff date
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      const cutoffTimestamp = cutoffDate.toISOString();

      // Build selector
      const selector = {
        type: 'log',
        timestamp: { $lt: cutoffTimestamp },
      };

      // Add level filter if specified
      if (level && Object.values(LOG_LEVELS).includes(level)) {
        selector.level = level;
      }

      // Find logs to delete
      const result = await logsDB.find({
        selector,
        fields: ['_id', '_rev'],
      });

      if (result.docs.length === 0) {
        return callback({
          success: true,
          message: 'No old logs to clear',
          count: 0,
        });
      }

      // Prepare logs for bulk deletion
      const docsToDelete = result.docs.map((doc) => ({
        _id: doc._id,
        _rev: doc._rev,
        _deleted: true,
      }));

      // Perform bulk deletion
      const bulkResult = await logsDB.bulkDocs(docsToDelete);

      // Count successful deletions
      const successCount = bulkResult.filter((res) => !res.error).length;

      // Emit real-time update for cleared logs
      socket.broadcast.emit('log:cleared', { count: successCount, days });

      callback({
        success: true,
        message: `Successfully cleared ${successCount} old logs`,
        count: successCount,
      });
    } catch (error) {
      console.error('Clear Old Logs error:', error);
      callback({
        success: false,
        message: 'Internal server error',
      });
    }
  });

  // Get Log Statistics
  socket.on('log:getStats', async ({ startDate, endDate }, callback) => {
    try {
      // Build date range selector
      const dateSelector = {};
      if (startDate) dateSelector.$gte = startDate;
      if (endDate) dateSelector.$lte = endDate;

      // Get total count
      const totalResult = await logsDB.find({
        selector: {
          type: 'log',
          ...(Object.keys(dateSelector).length > 0 ? { timestamp: dateSelector } : {}),
        },
        fields: ['_id'],
      });

      const totalCount = totalResult.docs.length;

      // Get counts by level
      const levelCounts = {};
      for (const level of Object.values(LOG_LEVELS)) {
        const levelResult = await logsDB.find({
          selector: {
            type: 'log',
            level,
            ...(Object.keys(dateSelector).length > 0 ? { timestamp: dateSelector } : {}),
          },
          fields: ['_id'],
        });
        levelCounts[level] = levelResult.docs.length;
      }

      // Get counts by category
      const categoryCounts = {};
      for (const category of Object.values(LOG_CATEGORIES)) {
        const categoryResult = await logsDB.find({
          selector: {
            type: 'log',
            category,
            ...(Object.keys(dateSelector).length > 0 ? { timestamp: dateSelector } : {}),
          },
          fields: ['_id'],
        });
        categoryCounts[category] = categoryResult.docs.length;
      }

      // Get counts by source
      const sourceCounts = {};
      for (const source of Object.values(LOG_SOURCES)) {
        const sourceResult = await logsDB.find({
          selector: {
            type: 'log',
            source,
            ...(Object.keys(dateSelector).length > 0 ? { timestamp: dateSelector } : {}),
          },
          fields: ['_id'],
        });
        sourceCounts[source] = sourceResult.docs.length;
      }

      callback({
        success: true,
        stats: {
          total: totalCount,
          byLevel: levelCounts,
          byCategory: categoryCounts,
          bySource: sourceCounts,
          dateRange: {
            start: startDate || 'all',
            end: endDate || 'all',
          },
        },
      });
    } catch (error) {
      console.error('Get Log Statistics error:', error);
      callback({
        success: false,
        message: 'Internal server error',
      });
    }
  });

  // Log Cleanup Utilities
  const cleanupOldLogs = async (daysToKeep = 90) => {
    try {
      // Calculate the cutoff date
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      const cutoffTimestamp = cutoffDate.toISOString();

      // Find logs older than cutoff date
      const result = await logsDB.find({
        selector: {
          type: 'log',
          timestamp: { $lt: cutoffTimestamp },
        },
        fields: ['_id', '_rev'],
      });

      if (result.docs.length === 0) {
        console.log('No old logs to clean up');
        return;
      }

      // Prepare logs for bulk deletion
      const docsToDelete = result.docs.map((doc) => ({
        _id: doc._id,
        _rev: doc._rev,
        _deleted: true,
      }));

      // Perform bulk deletion
      const bulkResult = await logsDB.bulkDocs(docsToDelete);

      // Count successful deletions
      const successCount = bulkResult.filter((res) => !res.error).length;
      console.log(`Cleaned up ${successCount} logs older than ${daysToKeep} days`);

      // Emit real-time update
      socket.broadcast.emit('log:cleared', { count: successCount, days: daysToKeep });
    } catch (error) {
      console.error('Log cleanup error:', error);
    }
  };

  // Setup regular log cleanup (once a day, keeping 90 days of logs)
  setInterval(() => cleanupOldLogs(90), 24 * 60 * 60 * 1000);
};