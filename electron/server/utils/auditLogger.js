import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class AuditLogger {
  constructor() {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ 
          filename: path.join(__dirname, '../logs/audit.log'),
          maxsize: 5242880, // 5MB
          maxFiles: 5,
          tailable: true
        }),
        new winston.transports.File({ 
          filename: path.join(__dirname, '../logs/error.log'),
          level: 'error',
          maxsize: 5242880, // 5MB
          maxFiles: 5,
          tailable: true
        })
      ]
    });

    // Add console logging in development
    if (process.env.NODE_ENV !== 'production') {
      this.logger.add(new winston.transports.Console({
        format: winston.format.simple()
      }));
    }
  }

  logUserAction(userId, action, details) {
    this.logger.info('USER_ACTION', {
      userId,
      action,
      details,
      category: 'user'
    });
  }

  logSystemEvent(eventType, details) {
    this.logger.info('SYSTEM_EVENT', {
      eventType,
      details,
      category: 'system'
    });
  }

  logSecurityEvent(eventType, details) {
    this.logger.warn('SECURITY_EVENT', {
      eventType,
      details,
      category: 'security'
    });
  }

  logError(error, context = {}) {
    this.logger.error('ERROR', {
      error: {
        message: error.message,
        stack: error.stack
      },
      context,
      category: 'error'
    });
  }
  // Query logs (basic implementation)
  async queryLogs(filters = {}, startDate, endDate) {
    // This is a placeholder for a more sophisticated query implementation
    // In a real application, you might want to use a proper database or log aggregation service
    return new Promise((resolve) => {
      resolve([]);
    });
  }
}

// Create a singleton instance
const auditLogger = new AuditLogger();

// Named export for better ESM compatibility
export { auditLogger };
