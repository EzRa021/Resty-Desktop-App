# Frontend-Backend Integration Mapping

## 1. Authentication and Security (/auth)
Backend Files:
- `server/routes/users.js` (ES Module)
- `server/routes/registration.js` (ES Module)
- `server/utils/userEnhancedSecurity.js` (ES Module)
- `server/utils/validateUser.js` (ES Module) - User validation and sanitization
- `server/utils/sessionManager.js` (ES Module)
- `server/utils/securityMonitor.js` (ES Module)
- `server/utils/activityLogger.js` (ES Module)
- `server/middleware/socketSecurity.js` (ES Module) - WebSocket security middleware

Socket Events:
```
users:login                  // Enhanced with security monitoring
users:logout                 // Enhanced with session management
users:validateSession        // New - validates session security
users:refreshSession        // New - handles session refresh
users:revokeSession        // New - handles session revocation
users:getActiveSessions    // New - lists active user sessions
users:updatePassword       // New - with password history check
users:getSecurityLogs     // New - access security audit logs
registration:register      // Enhanced with security validation
registration:validateEmail // Enhanced with rate limiting
```

Security Features and Integration:

1. Authentication Integration:
   Frontend Components:
   - `AuthProvider`: Context provider for authentication state
   - `LoginForm`: Handles login with security feedback
   - `MFAVerification`: Multi-factor authentication UI
   - `SecurityPrompts`: Displays security-related notifications
   
   Backend Integration:
   ```javascript
   // Login flow
   const loginResponse = await authHandler.login({
     email,
     password,
     deviceInfo: {
       ip: clientIP,
       userAgent: browserInfo,
       location: geoLocation
     }
   });
   
   // Handle different security scenarios
   switch (loginResponse.status) {
     case 'mfa_required':
     case 'account_locked':
     case 'password_expired':
     case 'suspicious_activity':
   }
   ```

2. Session Security Implementation:
   Frontend Features:
   - Automatic session refresh
   - Device tracking and management
   - Session timeout monitoring
   - Activity status updates
   
   Backend Integration:
   ```javascript
   // Session management
   sessionManager.monitor({
     onTimeout: handleTimeout,
     onSecurityAlert: handleAlert,
     onForceLogout: handleForceLogout
   });
   
   // Session refresh cycle
   sessionManager.startRefreshCycle({
     interval: 15 * 60 * 1000, // 15 minutes
     onRefreshNeeded: handleRefresh
   });
   ```

3. Security Monitoring Integration:
   Frontend Features:
   - Real-time security alerts
   - Activity log display
   - Security dashboard
   - Threat notifications
   
   Backend Integration:
   ```javascript
   // Security monitoring
   securityMonitor.watch({
     onFailedLogin: handleFailedLogin,
     onSuspiciousActivity: handleSuspiciousActivity,
     onLocationChange: handleLocationChange
   });
   
   // Audit logging
   activityLogger.track({
     level: 'security',
     action: actionType,
     details: actionDetails
   });
   ```

4. Rate Limiting Implementation:
   Frontend Features:
   - Request throttling feedback
   - Retry timing display
   - Error state handling
   - User guidance messages
   
   Backend Integration:
   ```javascript
   // Rate limit check
   const rateLimitStatus = await rateLimiter.check({
     action: actionType,
     identifier: userIdentifier,
     threshold: limitThreshold
   });
   
   // Handle rate limiting
   if (rateLimitStatus.limited) {
     handleRateLimit(rateLimitStatus.retryAfter);
   }
   ```

## 2. Dashboard
Backend Files:
- `server/routes/pos.js`
- `server/routes/inventory.js`
- `server/routes/analytics.js`
- `server/routes/notifications.js`

Socket Events:
```
pos:getActiveOrders
inventory:getLowStock
analytics:getDashboardStats
notifications:getUnread
```

## 3. POS System (/pos)
Backend Files:
- `server/routes/pos.js`
- `server/routes/menuItems.js`
- `server/routes/categories.js`
- `server/routes/inventory.js`

Socket Events:
```
pos:createOrder
pos:updateOrderStatus
pos:listOrders
pos:getOrder
menuItems:getAll
menuItems:getByCategory
categories:getAll
inventory:checkStock
```

## 4. Kitchen Display System (/kds)
Backend Files:
- `server/routes/kds.js`
- `server/routes/pos.js`

Socket Events:
```
kds:getActiveOrders
kds:updateOrderStatus
kds:updatePriority
pos:orderCreated
pos:orderUpdated
```

## 5. Inventory Management (/inventory)
Backend Files:
- `server/routes/inventory.js`
- `server/routes/ingredients.js`
- `server/routes/suppliers.js`

Socket Events:
```
inventory:recordTransaction
inventory:getStock
ingredients:getAll
ingredients:update
suppliers:getAll
suppliers:getOrders
```

## 6. Menu Management (/menu)
Backend Files:
- `server/routes/menuItems.js`
- `server/routes/categories.js`
- `server/routes/subcategories.js`
- `server/routes/recipes.js`

Socket Events:
```
menuItems:create
menuItems:update
menuItems:delete
categories:manage
recipes:manage
```

## 7. Analytics (/analytics)
Backend Files:
- `server/routes/analytics.js`
- `server/routes/reports.js`

Socket Events:
```
analytics:getSales
analytics:getInventory
analytics:getPredictions
reports:generate
```

## 8. Staff Management (/staff)
Backend Files:
- `server/routes/users.js`
- `server/routes/pos.js` (for performance metrics)

Socket Events:
```
users:create
users:update
users:delete
users:getPerformance
```

## 9. Customer Management (/customers)
Backend Files:
- `server/routes/loyalty.js`
- `server/routes/pos.js` (for order history)

Socket Events:
```
loyalty:getCustomer
loyalty:updatePoints
loyalty:getRewards
pos:getCustomerOrders
```

## 10. Settings (/settings)
Backend Files:
- `server/routes/restaurants.js`
- `server/routes/branches.js`
- `server/routes/users.js`

Socket Events:
```
restaurants:update
branches:update
users:updatePermissions
```

## Shared Components Integration

### NotificationCenter
Backend Files:
- `server/routes/notifications.js`

Socket Events:
```
notifications:subscribe
notifications:create
notifications:markRead
notifications:getUnread
```

### GlobalSearch
Backend Files:
- Multiple route files with search endpoints

Socket Events:
```
search:global
search:byCategory
```

### DataGrid
Backend Files:
- Respective route files for each data type

Socket Events:
```
data:fetch
data:sort
data:filter
data:export
```

## Real-time Updates Integration
Backend Files:
- `server/routes/index.js` (Socket.IO setup)
- `server/database.js` (PouchDB/CouchDB sync)

Socket Events:
```
connection
disconnect
sync:start
sync:complete
sync:error
```

### Sync Monitoring and Error Recovery

#### Sync Metrics
```javascript
// Real-time sync metrics
{
  startTime: timestamp,      // When sync started
  totalDocs: number,        // Total documents to sync
  completedDocs: number,    // Documents successfully synced
  failedDocs: number,       // Failed document syncs
  lastSync: timestamp,      // Last successful sync
  errors: Array<{          // Detailed error history
    timestamp: number,
    error: string
  }>,
  retries: number          // Number of retry attempts
}
```

#### Sync Events
```javascript
sync:metrics        // Updated sync progress metrics
sync:change         // Document changes processed
sync:status         // Current sync status updates
sync:error          // Sync error notifications
```

#### Error Recovery Features
1. Automatic Retry:
   - Exponential backoff retry strategy
   - Configurable retry limits
   - Error tracking and reporting

2. Data Validation:
   - Pre-sync data integrity checks
   - Post-sync validation
   - Conflict resolution handling

3. Performance Monitoring:
   - Sync speed metrics
   - Document processing rates
   - Network latency tracking

4. User Feedback:
   - Real-time progress updates
   - Error notifications
   - Recovery status reporting

## Error Handling Integration
Backend Files:
- `server/routes/utils.js`
- `server/routes/logs.js`

Socket Events:
```
error:log
error:notify
error:recover
```

## Database Integration
Backend Files:
- `server/database.js`
- Individual PouchDB instances for each collection

Key Database Collections:
```
- usersDB
- restaurantsDB
- branchesDB
- menuItemsDB
- ingredientsDB
- posDB
- kdsDB
- inventoryTransactionsDB
- loyaltyDB
- notificationsDB
```

### Synchronization Status Monitoring
Frontend Components:
- `SyncStatusIndicator`: Real-time sync status display
- `DatabaseHealthMonitor`: Database connection health dashboard
- `OfflineIndicator`: Shows offline/online state

Backend Events:
```javascript
// Sync status events
sync:started          // Sync process initiated
sync:complete         // Sync process completed
sync:error           // Sync error occurred
sync:paused          // Sync paused (offline)
sync:active          // Sync resumed (online)
db:connection        // Database connection status
db:validation        // Database validation status
```

Integration Flow:
1. Frontend subscribes to sync events via WebSocket
2. Backend emits events for sync status changes
3. UI updates to reflect current sync state
4. Error handling and retry logic implemented
5. Automatic conflict resolution

## File Requirements for Each Page

### Dashboard Page
Required Database Access:
- posDB (active orders)
- inventoryDB (stock levels)
- notificationsDB (alerts)
- analyticsDB (real-time stats)

### POS Page
Required Database Access:
- menuItemsDB
- categoriesDB
- posDB
- inventoryDB
- customersDB

### KDS Page
Required Database Access:
- kdsDB
- posDB
- menuItemsDB

### Inventory Page
Required Database Access:
- inventoryDB
- ingredientsDB
- suppliersDB
- transactionsDB

### Menu Management Page
Required Database Access:
- menuItemsDB
- categoriesDB
- subcategoriesDB
- recipesDB

### Analytics Page
Required Database Access:
- posDB
- inventoryDB
- staffDB
- customersDB

### Staff Management Page
Required Database Access:
- usersDB
- posDB (performance data)
- logsDB

### Customer Management Page
Required Database Access:
- customersDB
- loyaltyDB
- posDB (order history)

### Settings Page
Required Database Access:
- restaurantsDB
- branchesDB
- usersDB
- settingsDB
