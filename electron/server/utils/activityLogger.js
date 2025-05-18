import { v4 as uuidv4 } from 'uuid';

export const activityLogger = {
  ACTIVITY_TYPES: {
    // Authentication activities
    LOGIN_SUCCESS: 'login_success',
    LOGIN_FAILED: 'login_failed',
    LOGOUT: 'logout',
    PASSWORD_CHANGED: 'password_changed',
    PASSWORD_RESET_REQUESTED: 'password_reset_requested',
    
    // Account activities
    ACCOUNT_CREATED: 'account_created',
    ACCOUNT_UPDATED: 'account_updated',
    ACCOUNT_DELETED: 'account_deleted',
    ACCOUNT_LOCKED: 'account_locked',
    ACCOUNT_UNLOCKED: 'account_unlocked',
    
    // Session activities
    SESSION_CREATED: 'session_created',
    SESSION_EXPIRED: 'session_expired',
    SESSION_REVOKED: 'session_revoked',
    
    // Permission activities
    ROLE_CHANGED: 'role_changed',
    PERMISSION_GRANTED: 'permission_granted',
    PERMISSION_REVOKED: 'permission_revoked',
    
    // Security activities
    SECURITY_ALERT: 'security_alert',
    UNUSUAL_ACTIVITY: 'unusual_activity'
  },

  SEVERITY_LEVELS: {
    INFO: 'info',
    WARNING: 'warning',
    ERROR: 'error',
    CRITICAL: 'critical'
  },

  async initializeIndexes(logsDB) {
    try {
      // Create index for timestamp field
      await logsDB.createIndex({
        index: {
          fields: ['timestamp']
        }
      });

      // Create index for user activities
      await logsDB.createIndex({
        index: {
          fields: ['type', 'userId', 'timestamp']
        }
      });

      // Create index for security alerts
      await logsDB.createIndex({
        index: {
          fields: ['type', 'severity', 'timestamp']
        }
      });

      console.log('Activity logger indexes created successfully');
    } catch (error) {
      console.error('Error creating activity logger indexes:', error);
    }
  },

  async logActivity(logsDB, {
    type,
    userId,
    details,
    severity = 'info',
    metadata = {},
    ipAddress,
    userAgent
  }) {
    const activity = {
      _id: `activity_${uuidv4()}`,
      type: 'activity',
      activityType: type,
      userId,
      timestamp: new Date().toISOString(),
      severity,
      details,
      metadata,
      context: {
        ipAddress,
        userAgent,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }
    };

    await logsDB.put(activity);
    return activity;
  },

  async getActivitiesByUser(logsDB, userId, options = {}) {
    const {
      startDate = new Date(0),
      endDate = new Date(),
      types = [],
      limit = 50,
      skip = 0
    } = options;

    const selector = {
      type: 'activity',
      userId,
      timestamp: {
        $gte: startDate.toISOString(),
        $lte: endDate.toISOString()
      }
    };

    if (types.length > 0) {
      selector.activityType = { $in: types };
    }

    const result = await logsDB.find({
      selector,
      sort: [{ timestamp: 'desc' }],
      limit,
      skip
    });

    return result.docs;
  },

  async getSecurityAlerts(logsDB, options = {}) {
    const {
      startDate = new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
      severity = ['warning', 'error', 'critical']
    } = options;

    const result = await logsDB.find({
      selector: {
        type: 'activity',
        severity: { $in: severity },
        timestamp: { $gte: startDate.toISOString() }
      },
      sort: [{ timestamp: 'desc' }]
    });

    return result.docs;
  },

  async getAuditTrail(logsDB, options = {}) {
    const {
      entityType,
      entityId,
      startDate = new Date(0),
      endDate = new Date(),
      limit = 100
    } = options;

    const selector = {
      type: 'activity',
      'metadata.entityType': entityType,
      'metadata.entityId': entityId,
      timestamp: {
        $gte: startDate.toISOString(),
        $lte: endDate.toISOString()
      }
    };

    const result = await logsDB.find({
      selector,
      sort: [{ timestamp: 'desc' }],
      limit
    });

    return result.docs;
  }
};
