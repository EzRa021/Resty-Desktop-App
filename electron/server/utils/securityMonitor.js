import { v4 as uuidv4 } from 'uuid';
import { activityLogger } from './activityLogger.js';

class SecurityMonitor {
  constructor() {
    // Initialize thresholds and storage
    this.THRESHOLDS = {
      FAILED_LOGIN_ALERT: 3,
      SUSPICIOUS_IP_CHANGES: 3,
      SESSION_ANOMALY_WINDOW: 60 * 60 * 1000,
      CONCURRENT_SESSION_LIMIT: 5,
      RATE_LIMIT_WINDOW: 60000, // 1 minute
      RATE_LIMIT_MAX_EVENTS: 100, // Maximum events per minute
      LOGIN_RATE_LIMIT: {
        MAX_ATTEMPTS: 5,
        WINDOW_MINUTES: 15
      }
    };
    this.securityEvents = new Map();
    this.blockedIPs = new Set();
    this.suspiciousIPs = new Set();
    this.socketConnections = new Map();
    this.activeConnections = new Map();
    this.eventCounts = new Map(); // Track event counts for rate limiting
    this.loginAttempts = new Map(); // Track login attempts
  }

  async monitorLoginAttempt(logsDB, {
    userId,
    success,
    ipAddress,
    deviceInfo,
    timestamp = new Date()
  }) {
    // Get recent login attempts
    const recentAttempts = await activityLogger.getActivitiesByUser(logsDB, userId, {
      types: ['login_success', 'login_failed'],
      startDate: new Date(timestamp - this.THRESHOLDS.SESSION_ANOMALY_WINDOW)
    });

    // Analyze login patterns
    const analysis = {
      recentFailedAttempts: recentAttempts.filter(a => a.activityType === 'login_failed').length,
      uniqueIPs: new Set(recentAttempts.map(a => a.context.ipAddress)),
      isNewDevice: !recentAttempts.some(a => 
        a.context.userAgent === deviceInfo.userAgent && 
        a.activityType === 'login_success'
      )
    };

    // Check for suspicious patterns
    const alerts = [];

    if (analysis.recentFailedAttempts >= this.THRESHOLDS.FAILED_LOGIN_ALERT) {
      alerts.push({
        type: 'excessive_failed_logins',
        severity: 'warning',
        details: `Multiple failed login attempts detected for user ${userId}`
      });
    }

    if (analysis.uniqueIPs.size >= this.THRESHOLDS.SUSPICIOUS_IP_CHANGES) {
      alerts.push({
        type: 'multiple_ip_addresses',
        severity: 'warning',
        details: 'Multiple IP addresses used for login attempts'
      });
    }

    if (analysis.isNewDevice && !success) {
      alerts.push({
        type: 'new_device_failed_login',
        severity: 'warning',
        details: 'Failed login attempt from new device'
      });
    }

    // Log alerts if any
    for (const alert of alerts) {
      await activityLogger.logActivity(logsDB, {
        type: activityLogger.ACTIVITY_TYPES.SECURITY_ALERT,
        userId,
        severity: alert.severity,
        details: alert.details,
        metadata: {
          alertType: alert.type,
          deviceInfo,
          ipAddress,
          loginSuccess: success
        }
      });
    }

    return {
      alerts,
      analysis
    };
  }

  async monitorSessionActivity(logsDB, sessionDB, {
    userId,
    sessionId,
    action,
    ipAddress,
    deviceInfo
  }) {
    // Get active sessions for user
    const activeSessions = await sessionDB.find({
      selector: {
        type: 'session',
        userId,
        isRevoked: false,
        expiresAt: { $gt: new Date().toISOString() }
      }
    });

    // Check for concurrent session anomalies
    if (activeSessions.docs.length > this.THRESHOLDS.CONCURRENT_SESSION_LIMIT) {
      await activityLogger.logActivity(logsDB, {
        type: activityLogger.ACTIVITY_TYPES.SECURITY_ALERT,
        userId,
        severity: 'warning',
        details: 'Excessive concurrent sessions detected',
        metadata: {
          sessionCount: activeSessions.docs.length,
          sessions: activeSessions.docs.map(s => ({
            id: s._id,
            deviceInfo: s.deviceInfo,
            createdAt: s.createdAt
          }))
        }
      });
    }

    // Check for session jumping between IPs
    const recentSessionActivities = await activityLogger.getActivitiesByUser(logsDB, userId, {
      types: ['session_activity'],
      startDate: new Date(Date.now() - this.THRESHOLDS.SESSION_ANOMALY_WINDOW)
    });

    const sessionIPs = new Set(recentSessionActivities.map(a => a.context.ipAddress));
    if (sessionIPs.size >= this.THRESHOLDS.SUSPICIOUS_IP_CHANGES) {
      await activityLogger.logActivity(logsDB, {
        type: activityLogger.ACTIVITY_TYPES.SECURITY_ALERT,
        userId,
        severity: 'warning',
        details: 'Multiple IP addresses detected for same session',
        metadata: {
          sessionId,
          ipAddresses: Array.from(sessionIPs),
          timeWindow: this.THRESHOLDS.SESSION_ANOMALY_WINDOW
        }
      });
    }
  }

  async analyzeDailyActivity(logsDB) {
    const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours
    
    // Get all security events
    const securityEvents = await activityLogger.getSecurityAlerts(logsDB, {
      startDate,
      severity: ['warning', 'error', 'critical']
    });

    // Analyze patterns
    const analysis = {
      totalAlerts: securityEvents.length,
      byType: {},
      byUser: {},
      byIP: {}
    };

    for (const event of securityEvents) {
      // Count by type
      analysis.byType[event.activityType] = (analysis.byType[event.activityType] || 0) + 1;
      
      // Count by user
      if (event.userId) {
        analysis.byUser[event.userId] = (analysis.byUser[event.userId] || 0) + 1;
      }
      
      // Count by IP
      if (event.context?.ipAddress) {
        analysis.byIP[event.context.ipAddress] = (analysis.byIP[event.context.ipAddress] || 0) + 1;
      }
    }

    // Generate summary report
    const report = {
      _id: `security_report_${uuidv4()}`,
      type: 'security_report',
      timestamp: new Date().toISOString(),
      timeRange: {
        start: startDate.toISOString(),
        end: new Date().toISOString()
      },
      analysis,
      recommendations: []
    };

    // Add recommendations based on patterns
    if (analysis.totalAlerts > 10) {
      report.recommendations.push({
        priority: 'high',
        message: 'High number of security alerts detected. Review security policies and user training.'
      });
    }

    // Find users with multiple alerts
    const highAlertUsers = Object.entries(analysis.byUser)
      .filter(([_, count]) => count >= 3)
      .map(([userId]) => userId);

    if (highAlertUsers.length > 0) {
      report.recommendations.push({
        priority: 'high',
        message: 'Multiple users triggering security alerts. Consider additional authentication measures.',
        affectedUsers: highAlertUsers
      });
    }

    // Save report
    await logsDB.put(report);
    return report;
  }

  // Connection tracking
  trackSocketConnection(socketId, userId) {
    this.activeConnections.set(socketId, {
      userId,
      connectedAt: new Date(),
      events: []
    });
  }

  removeSocketConnection(socketId) {
    this.activeConnections.delete(socketId);
  }

  // Automated security responses
  async handleSecurityThreat(threat) {
    try {
      const { type, ip, userId, socketId } = threat;

      // Log the threat
      await activityLogger.logSecurityEvent(type, threat);

      switch (type) {
        case 'BRUTE_FORCE_ATTEMPT':
          await this.handleBruteForce(ip);
          break;
        
        case 'SUSPICIOUS_ACTIVITY':
          await this.handleSuspiciousActivity(ip, userId);
          break;
        
        case 'RATE_LIMIT_EXCEEDED':
          await this.handleRateLimitExceeded(ip, socketId);
          break;
        
        case 'INVALID_TOKEN':
          await this.handleInvalidToken(userId);
          break;

        default:
          await this.handleGenericThreat(threat);
      }
    } catch (error) {
      console.error('Error in handleSecurityThreat:', error);
    }
  }
  async handleBruteForce(ip) {
    try {
      // Block IP after multiple failed attempts
      const attempts = this.securityEvents.get(`brute_force:${ip}`) || 0;
      if (attempts >= 5) {
        this.blockedIPs.add(ip);
        await activityLogger.logSecurityEvent('IP_BLOCKED', { ip, reason: 'Brute force attempts' });
      } else {
        this.securityEvents.set(`brute_force:${ip}`, attempts + 1);
      }
    } catch (error) {
      console.error('Error in handleBruteForce:', error);
    }
  }
  async handleSuspiciousActivity(ip, userId) {
    try {
      this.suspiciousIPs.add(ip);
      
      // Notify administrators
      await activityLogger.logSecurityEvent('ADMIN_NOTIFICATION', {
        type: 'SUSPICIOUS_ACTIVITY',
        ip,
        userId
      });
    } catch (error) {
      console.error('Error in handleSuspiciousActivity:', error);
    }
  }

  async handleRateLimitExceeded(ip, socketId) {
    try {
      if (socketId && this.activeConnections.has(socketId)) {
        const connection = this.activeConnections.get(socketId);
        connection.events.push({
          type: 'RATE_LIMIT_EXCEEDED',
          timestamp: new Date()
        });

        // Disconnect socket if multiple violations
        if (connection.events.filter(e => e.type === 'RATE_LIMIT_EXCEEDED').length >= 3) {
          await activityLogger.logSecurityEvent('SOCKET_FORCED_DISCONNECT', {
            socketId,
            reason: 'Multiple rate limit violations'
          });
        }
      }
    } catch (error) {
      console.error('Error in handleRateLimitExceeded:', error);
    }
  }

  async handleInvalidToken(userId) {
    try {
      if (userId) {
        // Track invalid token attempts
        const attempts = this.securityEvents.get(`invalid_token:${userId}`) || 0;
        this.securityEvents.set(`invalid_token:${userId}`, attempts + 1);

        if (attempts >= 3) {
          await activityLogger.logSecurityEvent('USER_TOKENS_INVALIDATED', {
            userId,
            reason: 'Multiple invalid token attempts'
          });
        }
      }
    } catch (error) {
      console.error('Error in handleInvalidToken:', error);
    }
  }

  async handleGenericThreat(threat) {
    try {
      await activityLogger.logSecurityEvent('GENERIC_THREAT', threat);
    } catch (error) {
      console.error('Error in handleGenericThreat:', error);
    }
  }

  // Helper methods
  isIPBlocked(ip) {
    return this.blockedIPs.has(ip);
  }

  isIPSuspicious(ip) {
    return this.suspiciousIPs.has(ip);
  }

  // Cleanup method (should be called periodically)
  cleanup() {
    const now = Date.now();
    
    // Clean up security events older than 24 hours
    const cutoff = now - (24 * 60 * 60 * 1000);
    for (const [key, timestamp] of this.securityEvents.entries()) {
      if (timestamp < cutoff) {
        this.securityEvents.delete(key);
      }
    }
  }

  // Add rate limiting check method
  async checkSocketRateLimit(socketId, event) {
    const now = Date.now();
    const key = `${socketId}:${event}`;
    
    // Get or initialize event count
    if (!this.eventCounts.has(key)) {
      this.eventCounts.set(key, {
        count: 0,
        windowStart: now
      });
    }

    const eventData = this.eventCounts.get(key);

    // Reset counter if window has expired
    if (now - eventData.windowStart > this.THRESHOLDS.RATE_LIMIT_WINDOW) {
      eventData.count = 0;
      eventData.windowStart = now;
    }

    // Increment counter
    eventData.count++;

    // Check if rate limit exceeded
    if (eventData.count > this.THRESHOLDS.RATE_LIMIT_MAX_EVENTS) {
      // Log rate limit exceeded
      await this.handleRateLimitExceeded(socketId);
      return true;
    }

    return false;
  }

  // Add rate limiting check method for login
  async checkRateLimit(logsDB, { action, identifier, ipAddress }) {
    const now = Date.now();
    const key = `${action}:${identifier}:${ipAddress}`;
    
    // Get or initialize attempt count
    if (!this.loginAttempts.has(key)) {
      this.loginAttempts.set(key, {
        count: 0,
        windowStart: now,
        lastAttempt: now
      });
    }

    const attemptData = this.loginAttempts.get(key);

    // Reset counter if window has expired
    if (now - attemptData.windowStart > this.THRESHOLDS.LOGIN_RATE_LIMIT.WINDOW_MINUTES * 60 * 1000) {
      attemptData.count = 0;
      attemptData.windowStart = now;
    }

    // Increment counter
    attemptData.count++;
    attemptData.lastAttempt = now;

    // Check if rate limit exceeded
    if (attemptData.count > this.THRESHOLDS.LOGIN_RATE_LIMIT.MAX_ATTEMPTS) {
      // Log rate limit exceeded
      await activityLogger.logActivity(logsDB, {
        type: 'RATE_LIMIT_EXCEEDED',
        severity: 'warning',
        details: `Rate limit exceeded for ${action}`,
        metadata: {
          action,
          identifier,
          ipAddress,
          attempts: attemptData.count
        }
      });

      const timeRemaining = Math.ceil(
        (this.THRESHOLDS.LOGIN_RATE_LIMIT.WINDOW_MINUTES * 60 * 1000 - (now - attemptData.windowStart)) / 60000
      );

      return {
        allowed: false,
        timeRemaining
      };
    }

    return {
      allowed: true,
      attemptsRemaining: this.THRESHOLDS.LOGIN_RATE_LIMIT.MAX_ATTEMPTS - attemptData.count
    };
  }
}

// Create a singleton instance
const securityMonitor = new SecurityMonitor();

// Export the singleton instance
export { securityMonitor };
