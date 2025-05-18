import { v4 as uuidv4 } from 'uuid';
import { enhancedSecurity } from './userEnhancedSecurity.js';
import { sessionManager } from './sessionManager.js';
import { securityMonitor } from './securityMonitor.js';

export const loginHandler = async ({
  email,
  password,
  deviceInfo,
  db,
  sessionDB,
  logsDB
}) => {
  try {
    // 1. Rate limiting check
    const rateLimitCheck = await securityMonitor.checkRateLimit(logsDB, {
      action: 'login',
      identifier: email,
      ipAddress: deviceInfo?.ip
    });

    if (!rateLimitCheck.allowed) {
      return {
        success: false,
        message: `Too many attempts. Please try again in ${rateLimitCheck.timeRemaining} minutes.`
      };
    }

    // 2. Get user
    const result = await db.find({
      selector: { type: 'user', email, _deleted: { $exists: false } },
      limit: 1,
    });

    if (result.docs.length === 0) {
      await securityMonitor.monitorLoginAttempt(logsDB, {
        email,
        success: false,
        ipAddress: deviceInfo?.ip,
        deviceInfo,
        reason: 'user_not_found'
      });
      
      return {
        success: false,
        message: 'Invalid credentials'
      };
    }

    const user = result.docs[0];

    // 3. Security checks
    const securityStatus = await enhancedSecurity.checkAccountSecurity(user);
    
    if (securityStatus.isLocked) {
      return {
        success: false,
        message: `Account is locked. Try again in ${securityStatus.lockTimeRemaining} minutes.`,
        lockDetails: securityStatus.lockInfo
      };
    }

    if (securityStatus.passwordExpired) {
      return {
        success: false,
        message: 'Password has expired. Please reset your password.',
        requiresPasswordChange: true,
        gracePeriod: securityStatus.passwordGracePeriod
      };
    }

    if (securityStatus.requiresVerification) {
      return {
        success: false,
        message: 'Additional verification required.',
        requiresVerification: true,
        verificationMethods: securityStatus.availableVerificationMethods
      };
    }

    // 4. Validate password
    const isPasswordValid = await enhancedSecurity.validatePassword(password, user.password);
    if (!isPasswordValid) {
      const updatedUser = await enhancedSecurity.handleFailedLogin(user, db);
      await securityMonitor.monitorLoginAttempt(logsDB, {
        userId: user._id,
        success: false,
        ipAddress: deviceInfo?.ip,
        deviceInfo
      });
      
      return {
        success: false,
        message: updatedUser.isLocked ? 
          `Account is locked. Try again in ${Math.ceil((new Date(updatedUser.lockExpiresAt) - new Date()) / 1000 / 60)} minutes.` : 
          'Invalid credentials'
      };
    }

    // 5. Handle successful login
    const updatedUser = await enhancedSecurity.handleSuccessfulLogin(user, db);
    await securityMonitor.monitorLoginAttempt(logsDB, {
      userId: user._id,
      success: true,
      ipAddress: deviceInfo?.ip,
      deviceInfo
    });

    // 6. Create session
    const session = await sessionManager.createSession(sessionDB, {
      user: updatedUser,
      deviceInfo,
      logsDB
    });

    // 7. Monitor session for security
    await securityMonitor.monitorSessionActivity(logsDB, sessionDB, {
      userId: updatedUser._id,
      sessionId: session._id,
      action: 'login',
      ipAddress: deviceInfo?.ip,
      deviceInfo
    });

    const { password: _, ...userWithoutPassword } = updatedUser;

    return {
      success: true,
      message: 'Login successful',
      user: userWithoutPassword,
      session
    };
  } catch (error) {
    console.error('Login handler error:', error);
    return {
      success: false,
      message: 'Internal server error',
      error: error.message
    };
  }
};

export const logoutHandler = async ({
  sessionId,
  deviceInfo,
  db,
  sessionDB,
  logsDB
}) => {
  try {
    const result = await sessionManager.revokeSession(sessionDB, sessionId, {
      reason: 'user_logout',
      logsDB
    });

    if (result) {
      await securityMonitor.monitorSessionActivity(logsDB, sessionDB, {
        sessionId,
        action: 'logout',
        ipAddress: deviceInfo?.ip,
        deviceInfo
      });

      return {
        success: true,
        message: 'Logout successful'
      };
    }

    return {
      success: false,
      message: 'Session not found or already expired'
    };
  } catch (error) {
    console.error('Logout handler error:', error);
    return {
      success: false,
      message: 'Internal server error',
      error: error.message
    };
  }
};
