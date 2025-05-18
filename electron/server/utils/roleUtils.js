// Role validation utilities
import { CONSTANTS, PERMISSIONS } from './userUtils.js';

export const roleUtils = {
  /**
   * Check if a role can create users with another role
   * Implements a hierarchical role system where users can only create users with equal or lower privileges
   * @param {string} creatorRole - The role of the user creating the new user
   * @param {string} targetRole - The role being assigned to the new user
   * @returns {boolean} - Whether the creator can assign the target role
   */
  canAssignRole(creatorRole, targetRole) {
    const roleHierarchy = {
      'super-admin': 0,
      'admin': 1,
      'manager': 2,
      'waiter': 3,
      'cashier': 3,
      'chef': 3,
      'delivery': 3,
      'host': 3
    };

    // Super admins can create any role
    if (creatorRole === CONSTANTS.ROLES.SUPER_ADMIN) {
      return true;
    }

    // Non-admins cannot create users
    if (!['super-admin', 'admin', 'manager'].includes(creatorRole)) {
      return false;
    }

    // Check hierarchy level
    return roleHierarchy[targetRole] >= roleHierarchy[creatorRole];
  },

  /**
   * Get all role-specific permissions
   * @param {string} role - The role to get permissions for
   * @returns {string[]} - Array of permission names
   */
  getRolePermissions(role) {
    const rolePermissionMap = {
      'super-admin': ['*'], // All permissions
      'admin': [
        PERMISSIONS.MANAGE_USERS,
        PERMISSIONS.MANAGE_ROLES,
        PERMISSIONS.MANAGE_MENU,
        PERMISSIONS.MANAGE_INVENTORY,
        PERMISSIONS.MANAGE_ORDERS,
        PERMISSIONS.VIEW_REPORTS,
        PERMISSIONS.PROCESS_PAYMENTS,
        PERMISSIONS.MANAGE_TABLES,
        PERMISSIONS.VIEW_KITCHEN,
        PERMISSIONS.MANAGE_DELIVERY
      ],
      'manager': [
        PERMISSIONS.MANAGE_MENU,
        PERMISSIONS.MANAGE_INVENTORY,
        PERMISSIONS.MANAGE_ORDERS,
        PERMISSIONS.VIEW_REPORTS,
        PERMISSIONS.PROCESS_PAYMENTS,
        PERMISSIONS.MANAGE_TABLES,
        PERMISSIONS.VIEW_KITCHEN
      ],
      'waiter': [
        PERMISSIONS.MANAGE_ORDERS,
        PERMISSIONS.MANAGE_TABLES,
        PERMISSIONS.VIEW_KITCHEN
      ],
      'cashier': [
        PERMISSIONS.PROCESS_PAYMENTS,
        PERMISSIONS.VIEW_REPORTS
      ],
      'chef': [
        PERMISSIONS.VIEW_KITCHEN,
        PERMISSIONS.MANAGE_INVENTORY
      ],
      'delivery': [
        PERMISSIONS.MANAGE_ORDERS,
        PERMISSIONS.MANAGE_DELIVERY
      ],
      'host': [
        PERMISSIONS.MANAGE_TABLES
      ]
    };

    return rolePermissionMap[role] || [];
  }
};
