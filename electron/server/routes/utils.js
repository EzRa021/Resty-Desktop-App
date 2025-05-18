import validator from 'validator';
import sanitizeHtml from 'sanitize-html';

/**
 * Validates session directly using sessionId from the frontend
 * @param {string} sessionId - Session ID from frontend
 * @param {Array} allowedRoles - Array of allowed roles
 * @param {Object} sessionDB - Session database instance
 * @returns {Promise} - Session validation result
 */
export const validateUserSession = async (sessionId, allowedRoles, sessionDB) => {
  if (!sessionId) {
    return { valid: false, message: 'Session ID is required' };
  }

  try {
    const session = await sessionDB.get(sessionId).catch(() => null);
    if (!session || !session.userId || session._deleted) {
      return { valid: false, message: 'Invalid or expired session' };
    }

    if (new Date(session.expiresAt) < new Date()) {
      return { valid: false, message: 'Session expired' };
    }

    const user = session.userDetails;
    if (!user) {
      return { valid: false, message: 'User not found in session' };
    }

    if (!allowedRoles.includes(user.role)) {
      return { valid: false, message: 'Insufficient permissions' };
    }

    return { valid: true, user };
  } catch (error) {
    console.error('Session validation error:', error);
    return { valid: false, message: 'Session validation failed' };
  }
};