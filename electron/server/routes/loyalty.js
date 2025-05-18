import { v4 as uuidv4 } from 'uuid';
import validator from 'validator';
import sanitizeHtml from 'sanitize-html';
import { validateUserSession } from './utils.js';

const validateLoyaltyMember = (data) => {
  const errors = [];
  const sanitizedData = {
    customerId: data.customerId || `CUST${Date.now()}`,
    firstName: sanitizeHtml(data.firstName || ''),
    lastName: sanitizeHtml(data.lastName || ''),
    email: data.email ? sanitizeHtml(data.email) : '',
    phone: sanitizeHtml(data.phone || ''),
    membershipTier: data.membershipTier || 'standard',
    points: Number(data.points) || 0,
    totalSpent: Number(data.totalSpent) || 0,
    joinDate: data.joinDate || new Date().toISOString(),
    birthday: data.birthday,
    preferences: data.preferences || {},
    notes: sanitizeHtml(data.notes || ''),
    status: data.status || 'active',
    restaurantId: data.restaurantId,
    branchId: data.branchId
  };

  if (!sanitizedData.firstName || !sanitizedData.lastName) {
    errors.push('First and last name are required');
  }

  if (sanitizedData.email && !validator.isEmail(sanitizedData.email)) {
    errors.push('Invalid email address');
  }

  if (!sanitizedData.phone) {
    errors.push('Phone number is required');
  }

  if (!['standard', 'silver', 'gold', 'platinum'].includes(sanitizedData.membershipTier)) {
    errors.push('Invalid membership tier');
  }

  if (!['active', 'inactive'].includes(sanitizedData.status)) {
    errors.push('Invalid status');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData
  };
};

export const registerSocketEvents = (socket, {
  db: loyaltyDB,
  posDB,
  sessionDB,
  logsDB
}) => {
  if (!loyaltyDB || !posDB || !sessionDB) {
    console.error('Missing required database dependencies for loyalty routes');
    return;
  }

  // Create/Register Loyalty Member
  socket.on('loyalty:register', async (data, callback) => {
    try {
      // 1. Validate session and permissions
      const sessionValidation = await validateUserSession(
        data.sessionId,
        ['owner', 'manager', 'admin', 'cashier'],
        sessionDB
      );

      if (!sessionValidation.valid) {
        return callback?.({
          success: false,
          message: sessionValidation.message
        });
      }

      // 2. Check for existing member with same email or phone
      if (data.email || data.phone) {
        const existingResult = await loyaltyDB.find({
          selector: {
            type: 'loyaltyMember',
            $or: [
              { email: data.email },
              { phone: data.phone }
            ]
          }
        });

        if (existingResult.docs.length > 0) {
          return callback?.({
            success: false,
            message: 'Member already exists with this email or phone number'
          });
        }
      }

      // 3. Validate member data
      const validationResult = validateLoyaltyMember(data);
      if (!validationResult.isValid) {
        return callback?.({
          success: false,
          message: 'Validation failed',
          errors: validationResult.errors
        });
      }

      // 4. Create member document
      const member = {
        _id: `loyalty_member_${uuidv4()}`,
        type: 'loyaltyMember',
        ...validationResult.sanitizedData,
        createdBy: sessionValidation.user._id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // 5. Save to database
      await loyaltyDB.put(member);

      // 6. Log the action
      await logsDB.put({
        _id: `log_${uuidv4()}`,
        type: 'log',
        category: 'loyalty',
        action: 'register',
        memberId: member._id,
        userId: sessionValidation.user._id,
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `New loyalty member registered: ${member.firstName} ${member.lastName}`
      });

      // 7. Send success response
      callback?.({
        success: true,
        message: 'Loyalty member registered successfully',
        data: member
      });

    } catch (error) {
      console.error('Error registering loyalty member:', error);
      callback?.({
        success: false,
        message: 'Failed to register loyalty member',
        error: error.message
      });
    }
  });

  // Award Points
  socket.on('loyalty:awardPoints', async (data, callback) => {
    try {
      // 1. Validate session
      const sessionValidation = await validateUserSession(
        data.sessionId,
        ['owner', 'manager', 'admin', 'cashier'],
        sessionDB
      );

      if (!sessionValidation.valid) {
        return callback?.({
          success: false,
          message: sessionValidation.message
        });
      }

      // 2. Get member
      const member = await loyaltyDB.get(data.memberId);

      // 3. Calculate points based on order total or specific action
      let pointsToAward = data.points;
      if (data.orderId) {
        const order = await posDB.get(data.orderId);
        // Standard calculation: 1 point per currency unit spent
        pointsToAward = Math.floor(order.totalAmount);
      }

      // 4. Update member points
      const updatedMember = {
        ...member,
        points: member.points + pointsToAward,
        totalSpent: member.totalSpent + (data.amount || 0),
        updatedAt: new Date().toISOString(),
        updatedBy: sessionValidation.user._id
      };

      // 5. Check for tier upgrade
      const newTier = determineMembershipTier(updatedMember.points);
      if (newTier !== member.membershipTier) {
        updatedMember.membershipTier = newTier;
        // Emit tier upgrade event
        socket.broadcast.emit('loyalty:tierUpgrade', {
          memberId: member._id,
          name: `${member.firstName} ${member.lastName}`,
          newTier
        });
      }

      // 6. Save changes
      await loyaltyDB.put(updatedMember);

      // 7. Create points transaction record
      const transaction = {
        _id: `loyalty_transaction_${uuidv4()}`,
        type: 'loyaltyTransaction',
        memberId: member._id,
        points: pointsToAward,
        reason: data.reason || 'purchase',
        orderId: data.orderId,
        amount: data.amount,
        createdBy: sessionValidation.user._id,
        createdAt: new Date().toISOString(),
        restaurantId: data.restaurantId,
        branchId: data.branchId
      };

      await loyaltyDB.put(transaction);

      // 8. Log the action
      await logsDB.put({
        _id: `log_${uuidv4()}`,
        type: 'log',
        category: 'loyalty',
        action: 'awardPoints',
        memberId: member._id,
        userId: sessionValidation.user._id,
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `${pointsToAward} points awarded to ${member.firstName} ${member.lastName}`
      });

      // 9. Send success response
      callback?.({
        success: true,
        message: 'Points awarded successfully',
        data: {
          member: updatedMember,
          transaction,
          tierUpgraded: newTier !== member.membershipTier
        }
      });

    } catch (error) {
      console.error('Error awarding points:', error);
      callback?.({
        success: false,
        message: 'Failed to award points',
        error: error.message
      });
    }
  });

  // Redeem Points
  socket.on('loyalty:redeemPoints', async (data, callback) => {
    try {
      // 1. Validate session
      const sessionValidation = await validateUserSession(
        data.sessionId,
        ['owner', 'manager', 'admin', 'cashier'],
        sessionDB
      );

      if (!sessionValidation.valid) {
        return callback?.({
          success: false,
          message: sessionValidation.message
        });
      }

      // 2. Get member
      const member = await loyaltyDB.get(data.memberId);

      // 3. Validate points balance
      if (member.points < data.points) {
        return callback?.({
          success: false,
          message: 'Insufficient points balance'
        });
      }

      // 4. Update member points
      const updatedMember = {
        ...member,
        points: member.points - data.points,
        updatedAt: new Date().toISOString(),
        updatedBy: sessionValidation.user._id
      };

      // 5. Save changes
      await loyaltyDB.put(updatedMember);

      // 6. Create redemption record
      const redemption = {
        _id: `loyalty_redemption_${uuidv4()}`,
        type: 'loyaltyRedemption',
        memberId: member._id,
        points: data.points,
        reward: data.reward,
        orderId: data.orderId,
        createdBy: sessionValidation.user._id,
        createdAt: new Date().toISOString(),
        restaurantId: data.restaurantId,
        branchId: data.branchId
      };

      await loyaltyDB.put(redemption);

      // 7. Log the action
      await logsDB.put({
        _id: `log_${uuidv4()}`,
        type: 'log',
        category: 'loyalty',
        action: 'redeemPoints',
        memberId: member._id,
        userId: sessionValidation.user._id,
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `${data.points} points redeemed by ${member.firstName} ${member.lastName}`
      });

      // 8. Send success response
      callback?.({
        success: true,
        message: 'Points redeemed successfully',
        data: {
          member: updatedMember,
          redemption
        }
      });

    } catch (error) {
      console.error('Error redeeming points:', error);
      callback?.({
        success: false,
        message: 'Failed to redeem points',
        error: error.message
      });
    }
  });

  // Get Member History
  socket.on('loyalty:getMemberHistory', async (data, callback) => {
    try {
      // 1. Validate session
      const sessionValidation = await validateUserSession(
        data.sessionId,
        ['owner', 'manager', 'admin', 'cashier'],
        sessionDB
      );

      if (!sessionValidation.valid) {
        return callback?.({
          success: false,
          message: sessionValidation.message
        });
      }

      // 2. Get member details
      const member = await loyaltyDB.get(data.memberId);

      // 3. Get transactions and redemptions
      const [transactions, redemptions] = await Promise.all([
        loyaltyDB.find({
          selector: {
            type: 'loyaltyTransaction',
            memberId: data.memberId,
            createdAt: {
              $gte: data.startDate || new Date(0).toISOString(),
              $lte: data.endDate || new Date().toISOString()
            }
          },
          sort: [{ createdAt: 'desc' }]
        }),
        loyaltyDB.find({
          selector: {
            type: 'loyaltyRedemption',
            memberId: data.memberId,
            createdAt: {
              $gte: data.startDate || new Date(0).toISOString(),
              $lte: data.endDate || new Date().toISOString()
            }
          },
          sort: [{ createdAt: 'desc' }]
        })
      ]);

      // 4. Get associated orders if requested
      let orders = {};
      if (data.includeOrders) {
        const orderIds = new Set([
          ...transactions.docs.map(t => t.orderId),
          ...redemptions.docs.map(r => r.orderId)
        ].filter(Boolean));

        for (const orderId of orderIds) {
          try {
            orders[orderId] = await posDB.get(orderId);
          } catch (error) {
            console.warn(`Could not fetch order ${orderId}:`, error);
          }
        }
      }

      // 5. Send response
      callback?.({
        success: true,
        data: {
          member,
          transactions: transactions.docs,
          redemptions: redemptions.docs,
          orders
        }
      });

    } catch (error) {
      console.error('Error getting member history:', error);
      callback?.({
        success: false,
        message: 'Failed to get member history',
        error: error.message
      });
    }
  });
};

// Helper function to determine membership tier based on points
function determineMembershipTier(points) {
  if (points >= 10000) return 'platinum';
  if (points >= 5000) return 'gold';
  if (points >= 2000) return 'silver';
  return 'standard';
}
