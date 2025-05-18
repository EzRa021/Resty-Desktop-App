import { v4 as uuidv4 } from 'uuid';
import { enhancedSecurity } from './userEnhancedSecurity.js';
import { activityLogger } from './activityLogger.js';

export const sessionManager = {
  // Session constants
  SESSION_DURATION: 24 * 60 * 60 * 1000, // 24 hours
  REFRESH_THRESHOLD: 30 * 60 * 1000, // 30 minutes
  MAX_SESSIONS_PER_USER: 5,

  async createSession(sessionDB, {
    user,
    deviceInfo,
    logsDB
  }) {
    // Check existing sessions for this user
    const existingSessions = await sessionDB.find({
      selector: {
        type: 'session',
        userId: user._id,
        isRevoked: false,
        expiresAt: { $gt: new Date().toISOString() }
      }
    });

    // If max sessions reached, revoke oldest session
    if (existingSessions.docs.length >= this.MAX_SESSIONS_PER_USER) {
      const oldestSession = existingSessions.docs
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))[0];
      
      await this.revokeSession(sessionDB, oldestSession._id, {
        reason: 'max_sessions_exceeded',
        logsDB
      });
    }

    // Create a copy of user object and remove sensitive fields
    const { password, failedLoginAttempts, lockExpiresAt, ...userDetails } = user;

    // Create new session
    const session = {
      _id: `session_${uuidv4()}`,
      type: 'session',
      userId: user._id,
      userRole: user.role,
      userDetails,
      deviceInfo: {
        userAgent: deviceInfo?.userAgent,
        ip: deviceInfo?.ip,
        deviceId: deviceInfo?.deviceId || uuidv4(),
        location: deviceInfo?.location
      },
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      expiresAt: new Date(Date.now() + this.SESSION_DURATION).toISOString(),
      isRevoked: false,
      refreshToken: uuidv4()
    };

    await sessionDB.put(session);

    // Log session creation
    await activityLogger.logActivity(logsDB, {
      type: activityLogger.ACTIVITY_TYPES.SESSION_CREATED,
      userId: user._id,
      details: 'New session created',
      metadata: {
        sessionId: session._id,
        deviceInfo: session.deviceInfo
      }
    });

    return session;
  },

  async validateSession(sessionDB, sessionId, { logsDB } = {}) {
    try {
      const session = await sessionDB.get(sessionId);

      if (!session || session.isRevoked) {
        return { isValid: false, reason: 'Session invalid or revoked' };
      }

      if (new Date(session.expiresAt) < new Date()) {
        if (logsDB) {
          await activityLogger.logActivity(logsDB, {
            type: activityLogger.ACTIVITY_TYPES.SESSION_EXPIRED,
            userId: session.userId,
            details: 'Session expired',
            metadata: { sessionId }
          });
        }
        return { isValid: false, reason: 'Session expired' };
      }

      // Check if session needs refresh
      const timeUntilExpiry = new Date(session.expiresAt) - new Date();
      if (timeUntilExpiry < this.REFRESH_THRESHOLD) {
        await this.refreshSession(sessionDB, session);
      } else {
        // Update last activity
        session.lastActivity = new Date().toISOString();
        await sessionDB.put(session);
      }

      return { isValid: true, session };
    } catch (error) {
      return { isValid: false, reason: 'Session not found' };
    }
  },

  async refreshSession(sessionDB, session) {
    const refreshedSession = {
      ...session,
      lastActivity: new Date().toISOString(),
      expiresAt: new Date(Date.now() + this.SESSION_DURATION).toISOString(),
      refreshToken: uuidv4()
    };

    await sessionDB.put(refreshedSession);
    return refreshedSession;
  },

  async revokeSession(sessionDB, sessionId, { reason = 'user_logout', logsDB } = {}) {
    try {
      const session = await sessionDB.get(sessionId);
      
      const revokedSession = {
        ...session,
        isRevoked: true,
        revokedAt: new Date().toISOString(),
        revocationReason: reason
      };

      await sessionDB.put(revokedSession);

      if (logsDB) {
        await activityLogger.logActivity(logsDB, {
          type: activityLogger.ACTIVITY_TYPES.SESSION_REVOKED,
          userId: session.userId,
          details: 'Session revoked',
          metadata: {
            sessionId,
            reason
          }
        });
      }

      return true;
    } catch (error) {
      console.error('Error revoking session:', error);
      return false;
    }
  },

  async revokeAllUserSessions(sessionDB, userId, { reason = 'user_request', logsDB } = {}) {
    try {
      const result = await sessionDB.find({
        selector: {
          type: 'session',
          userId,
          isRevoked: false
        }
      });

      const revokePromises = result.docs.map(session =>
        this.revokeSession(sessionDB, session._id, { reason, logsDB })
      );

      await Promise.all(revokePromises);

      return true;
    } catch (error) {
      console.error('Error revoking all user sessions:', error);
      return false;
    }
  },

  async getUserActiveSessions(sessionDB, userId) {
    const result = await sessionDB.find({
      selector: {
        type: 'session',
        userId,
        isRevoked: false,
        expiresAt: { $gt: new Date().toISOString() }
      },
      sort: [{ lastActivity: 'desc' }]
    });

    return result.docs;
  },

  async updateUserDetailsInSessions(sessionDB, userId, updatedUserDetails, { logsDB } = {}) {
    try {
      // Get all active sessions for the user
      const activeSessions = await this.getUserActiveSessions(sessionDB, userId);
      
      // Update userDetails in each active session
      const updatePromises = activeSessions.map(async (session) => {
        const updatedSession = {
          ...session,
          userDetails: {
            ...session.userDetails,
            ...updatedUserDetails
          },
          lastActivity: new Date().toISOString()
        };

        await sessionDB.put(updatedSession);

        // Log the session update if logsDB is provided
        if (logsDB) {
          await activityLogger.logActivity(logsDB, {
            type: activityLogger.ACTIVITY_TYPES.SESSION_UPDATED,
            userId,
            details: 'User details updated in session',
            metadata: {
              sessionId: session._id,
              updatedFields: Object.keys(updatedUserDetails)
            }
          });
        }
      });

      await Promise.all(updatePromises);
      return true;
    } catch (error) {
      console.error('Error updating user details in sessions:', error);
      return false;
    }
  },

  async cleanupExpiredSessions(sessionDB, { logsDB } = {}) {
    try {
      const result = await sessionDB.find({
        selector: {
          type: 'session',
          isRevoked: false,
          expiresAt: { $lt: new Date().toISOString() }
        }
      });

      const revokePromises = result.docs.map(session =>
        this.revokeSession(sessionDB, session._id, {
          reason: 'expired',
          logsDB
        })
      );

      await Promise.all(revokePromises);
      console.log(`Cleaned up ${result.docs.length} expired sessions`);
    } catch (error) {
      console.error('Error cleaning up expired sessions:', error);
    }
  }
};
