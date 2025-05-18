// User management utilities
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// Password utility functions
export const passwordUtils = {
  async hashPassword(password) {
    const salt = await bcrypt.genSalt(12);
    return bcrypt.hash(password, salt);
  },

  async verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
  },

  async isPasswordReused(password, passwordHistory) {
    for (const historicalHash of passwordHistory) {
      if (await bcrypt.compare(password, historicalHash)) {
        return true;
      }
    }
    return false;
  },

  generateTempPassword() {
    return crypto.randomBytes(12).toString('hex');
  }
};

// Session management
export const sessionUtils = {
  generateSessionId() {
    return crypto.randomBytes(32).toString('hex');
  },

  isSessionExpired(session) {
    return new Date(session.expiresAt) < new Date();
  },

  generateSessionToken() {
    return crypto.randomBytes(48).toString('base64');
  },

  extractDeviceInfo(userAgent) {
    // Implement user agent parsing
    return {
      browser: userAgent.split(' ')[0],
      os: userAgent.includes('Windows') ? 'Windows' : 
          userAgent.includes('Mac') ? 'MacOS' : 'Other',
      deviceType: userAgent.includes('Mobile') ? 'Mobile' : 'Desktop'
    };
  }
};

// Permission checking
export const permissionUtils = {
  hasPermission(userRole, requiredPermission) {
    const permissions = PERMISSIONS[userRole] || [];
    return permissions.includes('*') || permissions.includes(requiredPermission);
  },

  validatePermissions(userRole, requiredPermissions) {
    return requiredPermissions.every(permission => 
      this.hasPermission(userRole, permission)
    );
  }
};

// Account security
export const securityUtils = {
  shouldLockAccount(failedAttempts) {
    return failedAttempts >= 5;
  },

  calculateLockDuration(failedAttempts) {
    // Exponential backoff: 5min, 15min, 30min, 1hr, 24hr
    const durations = [5, 15, 30, 60, 1440];
    const attemptIndex = Math.min(failedAttempts - 5, durations.length - 1);
    return durations[attemptIndex];
  },

  generateSecurityToken() {
    return crypto.randomBytes(32).toString('hex');
  },

  calculatePasswordStrength(password) {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    return {
      score: strength,
      max: 6,
      isStrong: strength >= 4
    };
  }
};

// Activity tracking
export const activityUtils = {
  async logActivity(logsDB, data) {
    const activity = {
      _id: `activity_${crypto.randomBytes(16).toString('hex')}`,
      type: 'activity',
      timestamp: new Date().toISOString(),
      ...data
    };
    
    await logsDB.put(activity);
    return activity;
  },

  async getUserActivities(logsDB, userId, startDate, endDate) {
    return logsDB.find({
      selector: {
        type: 'activity',
        userId,
        timestamp: {
          $gte: startDate,
          $lte: endDate
        }
      },
      sort: [{ timestamp: 'desc' }]
    });
  }
};

// Define permissions first
export const PERMISSIONS = {
  MANAGE_USERS: 'manage_users',
  MANAGE_ROLES: 'manage_roles',
  MANAGE_MENU: 'manage_menu',
  MANAGE_INVENTORY: 'manage_inventory',
  MANAGE_ORDERS: 'manage_orders',
  VIEW_REPORTS: 'view_reports',
  PROCESS_PAYMENTS: 'process_payments',
  MANAGE_TABLES: 'manage_tables',
  VIEW_KITCHEN: 'view_kitchen',
  MANAGE_DELIVERY: 'manage_delivery'
};

// Export constants
export const CONSTANTS = {
  ROLES: {
    SUPER_ADMIN: 'super-admin',
    ADMIN: 'admin',
    MANAGER: 'manager',
    WAITER: 'waiter',
    CASHIER: 'cashier',
    CHEF: 'chef',
    DELIVERY: 'delivery',
    HOST: 'host'
  },
  
  PERMISSIONS,
  
  ACTIVITY_TYPES: {
    LOGIN: 'login',
    LOGOUT: 'logout',
    PASSWORD_CHANGE: 'password_change',
    PROFILE_UPDATE: 'profile_update',
    PERMISSION_CHANGE: 'permission_change',
    ACCOUNT_LOCK: 'account_lock',
    ACCOUNT_UNLOCK: 'account_unlock'
  },

  PASSWORD_POLICIES: {
    MIN_LENGTH: 8,
    MAX_LENGTH: 128,
    EXPIRY_DAYS: 90,
    HISTORY_SIZE: 5,
    MIN_STRENGTH: 4
  }
};
