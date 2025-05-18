import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

export const verifyToken = async (token) => {
  try {
    // We expect tokens to be in format: userId:timestamp:hmac
    const [userId, timestamp, hmac] = token.split(':');
    
    // Verify hmac and token freshness here
    // This is a placeholder - implement actual token verification logic
    return { userId, timestamp };
  } catch (error) {
    throw new Error('Invalid token');
  }
};

export const enhancedSecurity = {
  // Password management
  async validatePasswordStrength(password) {
    const requirements = {
      minLength: password.length >= 8,
      hasUpperCase: /[A-Z]/.test(password),
      hasLowerCase: /[a-z]/.test(password),
      hasNumbers: /\d/.test(password),
      hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(password)
    };
    
    return {
      isValid: Object.values(requirements).every(Boolean),
      requirements,
      score: Object.values(requirements).filter(Boolean).length
    };
  },

  // Account security
  async handleFailedLogin(user, db) {
    const updatedUser = {
      ...user,
      failedLoginAttempts: (user.failedLoginAttempts || 0) + 1,
      lastLoginAttempt: new Date().toISOString()
    };

    if (updatedUser.failedLoginAttempts >= 5) {
      const lockDuration = Math.min(Math.pow(2, updatedUser.failedLoginAttempts - 5), 24) * 60; // Exponential backoff
      updatedUser.isLocked = true;
      updatedUser.lockExpiresAt = new Date(Date.now() + lockDuration * 60 * 1000).toISOString();
    }

    await db.put(updatedUser);
    return updatedUser;
  },

  async handleSuccessfulLogin(user, db) {
    const updatedUser = {
      ...user,
      failedLoginAttempts: 0,
      lastLoginAttempt: new Date().toISOString(),
      lastSuccessfulLogin: new Date().toISOString(),
      isLocked: false,
      lockExpiresAt: null
    };

    await db.put(updatedUser);
    return updatedUser;
  },

  // Session management
  createSession(user, deviceInfo) {
    return {
      _id: `session_${uuidv4()}`,
      type: 'session',
      userId: user._id,
      userRole: user.role,
      deviceInfo: {
        userAgent: deviceInfo?.userAgent,
        ip: deviceInfo?.ip,
        deviceId: deviceInfo?.deviceId,
        location: deviceInfo?.location
      },
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      isRevoked: false
    };
  },

  async validateSession(sessionId, sessionDB) {
    try {
      const session = await sessionDB.get(sessionId);
      
      if (!session || session.isRevoked || new Date(session.expiresAt) < new Date()) {
        return { isValid: false, reason: 'Session expired or invalid' };
      }

      // Update last activity
      session.lastActivity = new Date().toISOString();
      await sessionDB.put(session);

      return { isValid: true, session };
    } catch (error) {
      return { isValid: false, reason: 'Session not found' };
    }
  },

  // Activity logging
  async logActivity(logsDB, data) {
    const activity = {
      _id: `activity_${uuidv4()}`,
      type: 'activity',
      timestamp: new Date().toISOString(),
      ...data
    };
    
    await logsDB.put(activity);
    return activity;
  },

  // Password history management
  async updatePasswordHistory(user, newPassword, db) {
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    const updatedUser = {
      ...user,
      password: hashedPassword,
      passwordHistory: [
        ...(user.passwordHistory || []).slice(0, 4), // Keep last 5 passwords
        hashedPassword
      ],
      passwordLastChanged: new Date().toISOString(),
      passwordExpiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() // 90 days
    };

    await db.put(updatedUser);
    return updatedUser;
  },

  async validatePasswordHistory(password, user) {
    if (!user.passwordHistory) return true;
    
    for (const historicalHash of user.passwordHistory) {
      if (await bcrypt.compare(password, historicalHash)) {
        return false; // Password was used before
      }
    }
    return true;
  },

  // Account security checks
  async checkAccountSecurity(user) {
    const now = new Date();
    const status = {
      isLocked: false,
      lockTimeRemaining: 0,
      passwordExpired: false,
      passwordGracePeriod: 0,
      requiresVerification: false,
      availableVerificationMethods: []
    };

    // Check if account is locked
    if (user.isLocked && user.lockExpiresAt) {
      const lockExpiresAt = new Date(user.lockExpiresAt);
      if (lockExpiresAt > now) {
        status.isLocked = true;
        status.lockTimeRemaining = Math.ceil((lockExpiresAt - now) / (60 * 1000));
        return status;
      }
    }

    // Check password expiration
    if (user.passwordExpiresAt) {
      const passwordExpiresAt = new Date(user.passwordExpiresAt);
      if (passwordExpiresAt < now) {
        status.passwordExpired = true;
        status.passwordGracePeriod = 7; // 7 days grace period
        return status;
      }
    }

    // Check if additional verification is required
    if (user.requiresVerification) {
      status.requiresVerification = true;
      status.availableVerificationMethods = [
        'email',
        'phone',
        'authenticator'
      ].filter(method => user.verificationMethods?.includes(method));
    }

    return status;
  },

  // Password validation
  async validatePassword(inputPassword, hashedPassword) {
    try {
      return await bcrypt.compare(inputPassword, hashedPassword);
    } catch (error) {
      console.error('Password validation error:', error);
      return false;
    }
  }
};
