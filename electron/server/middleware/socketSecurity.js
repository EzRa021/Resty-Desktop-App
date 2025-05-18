import { verifyToken } from '../utils/userEnhancedSecurity.js';
import { securityMonitor } from '../utils/securityMonitor.js';
import { auditLogger } from '../utils/auditLogger.js';

export default class SocketSecurityMiddleware {
  constructor(io) {
    this.io = io;
    this.setupMiddleware();
  }
  setupMiddleware() {
    // Basic connection logging without authentication
    this.io.use((socket, next) => {
      try {
        // Log connection
        auditLogger.logSystemEvent('SOCKET_CONNECT', {
          socketId: socket.id,
          ip: socket.handshake.address
        });
        next();
      } catch (error) {
        console.error('Socket connection error:', error);
        next(error);
      }
    });

    // Add event listeners for security monitoring
    this.io.on('connection', (socket) => {
      this.setupSocketEventHandlers(socket);
    });
  }

  setupSocketEventHandlers(socket) {
    // Monitor disconnections
    socket.on('disconnect', () => {
      if (socket.user) {
        auditLogger.logSystemEvent('SOCKET_DISCONNECT', {
          userId: socket.user.id,
          socketId: socket.id
        });
        securityMonitor.removeSocketConnection(socket.id);
      }
    });

    // Monitor errors
    socket.on('error', (error) => {
      auditLogger.logError(error, {
        userId: socket?.user?.id,
        socketId: socket.id
      });
    });

    // Add custom event middleware
    const originalOn = socket.on;
    socket.on = function(event, handler) {
      if (typeof handler === 'function') {
        return originalOn.call(this, event, async (...args) => {
          try {
            // Rate limiting check
            const isRateLimited = await securityMonitor.checkSocketRateLimit(socket.id, event);
            if (isRateLimited) {
              throw new Error('Rate limit exceeded');
            }

            // Log event
            auditLogger.logSystemEvent('SOCKET_EVENT', {
              event,
              userId: socket?.user?.id,
              socketId: socket.id
            });

            // Execute handler
            await handler.apply(this, args);
          } catch (error) {
            auditLogger.logError(error, {
              event,
              userId: socket?.user?.id,
              socketId: socket.id
            });
            socket.emit('error', {
              message: 'An error occurred processing your request'
            });
          }
        });
      }
      return originalOn.call(this, event, handler);
    };
  }

  // Method to emit secure events
  emitSecure(socket, event, data) {
    try {
      // Sanitize data before emitting
      const sanitizedData = this.sanitizeData(data);
      
      // Log emission
      auditLogger.logSystemEvent('SOCKET_EMIT', {
        event,
        userId: socket?.user?.id,
        socketId: socket.id
      });

      // Emit the event
      socket.emit(event, sanitizedData);
    } catch (error) {
      auditLogger.logError(error, {
        event,
        userId: socket?.user?.id,
        socketId: socket.id
      });
    }
  }

  // Basic data sanitization
  sanitizeData(data) {
    if (typeof data === 'object') {
      return JSON.parse(JSON.stringify(data));
    }
    return data;
  }
}
