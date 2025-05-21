# Frontend-Backend Mapping Documentation

## Overview
This document maps the frontend components to their corresponding backend routes and socket events, providing a clear understanding of the system's data flow and communication patterns.

## Authentication

### Login
- **Frontend**: `components/auth/Login.js`
- **Backend Route**: `POST /api/auth/login`
- **Socket Events**:
  - `auth:login`
  - `auth:loginSuccess`
  - `auth:loginError`

### Registration
- **Frontend**: `components/auth/Register.js`
- **Backend Route**: `POST /api/auth/register`
- **Socket Events**:
  - `auth:register`
  - `auth:registerSuccess`
  - `auth:registerError`

## POS (Point of Sale)

### Order Management
- **Frontend**: `components/pos/OrderForm.js`
- **Backend Routes**:
  - `POST /api/orders`
  - `PUT /api/orders/:id`
  - `GET /api/orders/:id`
- **Socket Events**:
  - `pos:createOrder`
  - `pos:updateOrder`
  - `pos:orderCreated`
  - `pos:orderUpdated`

### Payment Processing
- **Frontend**: `components/pos/PaymentModal.js`
- **Backend Routes**:
  - `POST /api/payments`
  - `GET /api/payments/:id`
- **Socket Events**:
  - `pos:processPayment`
  - `pos:paymentProcessed`
  - `pos:paymentError`

### Receipt Generation
- **Frontend**: `components/pos/ReceiptPreview.js`
- **Backend Routes**:
  - `GET /api/receipts/:id`
  - `POST /api/receipts/generate`
- **Socket Events**:
  - `pos:generateReceipt`
  - `pos:receiptGenerated`

## Kitchen Display System (KDS)

### Order Queue
- **Frontend**: `components/kds/OrderQueue.js`
- **Backend Routes**:
  - `GET /api/kds/orders`
  - `PUT /api/kds/orders/:id/status`
- **Socket Events**:
  - `kds:getOrders`
  - `kds:updateOrderStatus`
  - `kds:orderStatusUpdated`

### Kitchen Status
- **Frontend**: `components/kds/KitchenStatus.js`
- **Backend Routes**:
  - `GET /api/kds/status`
  - `PUT /api/kds/status`
- **Socket Events**:
  - `kds:getStatus`
  - `kds:updateStatus`
  - `kds:statusUpdated`

## Inventory Management

### Stock Management
- **Frontend**: `components/inventory/StockList.js`
- **Backend Routes**:
  - `GET /api/inventory`
  - `PUT /api/inventory/:id`
  - `POST /api/inventory/transactions`
- **Socket Events**:
  - `inventory:getStock`
  - `inventory:updateStock`
  - `inventory:stockUpdated`

### Low Stock Alerts
- **Frontend**: `components/inventory/LowStockAlert.js`
- **Backend Routes**:
  - `GET /api/inventory/alerts`
- **Socket Events**:
  - `inventory:getAlerts`
  - `inventory:alertTriggered`

## Menu Management

### Menu Items
- **Frontend**: `components/menu/MenuItemForm.js`
- **Backend Routes**:
  - `GET /api/menu/items`
  - `POST /api/menu/items`
  - `PUT /api/menu/items/:id`
- **Socket Events**:
  - `menu:getItems`
  - `menu:createItem`
  - `menu:updateItem`
  - `menu:itemUpdated`

### Categories
- **Frontend**: `components/menu/CategoryManager.js`
- **Backend Routes**:
  - `GET /api/menu/categories`
  - `POST /api/menu/categories`
  - `PUT /api/menu/categories/:id`
- **Socket Events**:
  - `menu:getCategories`
  - `menu:createCategory`
  - `menu:updateCategory`
  - `menu:categoryUpdated`

## User Management

### User Operations
- **Frontend**: `components/users/UserForm.js`
- **Backend Routes**:
  - `GET /api/users`
  - `POST /api/users`
  - `PUT /api/users/:id`
- **Socket Events**:
  - `users:getUsers`
  - `users:createUser`
  - `users:updateUser`
  - `users:userUpdated`

### Role Management
- **Frontend**: `components/users/RoleManager.js`
- **Backend Routes**:
  - `GET /api/roles`
  - `POST /api/roles`
  - `PUT /api/roles/:id`
- **Socket Events**:
  - `users:getRoles`
  - `users:createRole`
  - `users:updateRole`
  - `users:roleUpdated`

## Settings Management

### User Settings
- **Frontend**: `components/settings/UserSettings.js`
- **Backend Routes**:
  - `GET /api/settings/user`
  - `PUT /api/settings/user`
- **Socket Events**:
  - `settings:getUserSettings`
  - `settings:saveUserSettings`
  - `settings:userSettingsUpdated`

### Role Settings
- **Frontend**: `components/settings/RoleSettings.js`
- **Backend Routes**:
  - `GET /api/settings/roles`
  - `PUT /api/settings/roles`
- **Socket Events**:
  - `settings:getRoleSettings`
  - `settings:saveRoleSettings`
  - `settings:roleSettingsUpdated`

### System Settings
- **Frontend**: `components/settings/SystemSettings.js`
- **Backend Routes**:
  - `GET /api/settings/system`
  - `PUT /api/settings/system`
- **Socket Events**:
  - `settings:getSystemSettings`
  - `settings:saveSystemSettings`
  - `settings:systemSettingsUpdated`

## Analytics and Reporting

### Sales Reports
- **Frontend**: `components/analytics/SalesReport.js`
- **Backend Routes**:
  - `GET /api/analytics/sales`
  - `GET /api/analytics/sales/export`
- **Socket Events**:
  - `analytics:getSalesData`
  - `analytics:salesDataUpdated`

### Inventory Reports
- **Frontend**: `components/analytics/InventoryReport.js`
- **Backend Routes**:
  - `GET /api/analytics/inventory`
  - `GET /api/analytics/inventory/export`
- **Socket Events**:
  - `analytics:getInventoryData`
  - `analytics:inventoryDataUpdated`

### Staff Reports
- **Frontend**: `components/analytics/StaffReport.js`
- **Backend Routes**:
  - `GET /api/analytics/staff`
  - `GET /api/analytics/staff/export`
- **Socket Events**:
  - `analytics:getStaffData`
  - `analytics:staffDataUpdated`

## Notification System

### User Notifications
- **Frontend**: `components/notifications/NotificationCenter.js`
- **Backend Routes**:
  - `GET /api/notifications`
  - `PUT /api/notifications/:id`
- **Socket Events**:
  - `notifications:getNotifications`
  - `notifications:markAsRead`
  - `notifications:newNotification`

### System Alerts
- **Frontend**: `components/notifications/SystemAlerts.js`
- **Backend Routes**:
  - `GET /api/alerts`
  - `PUT /api/alerts/:id`
- **Socket Events**:
  - `notifications:getAlerts`
  - `notifications:alertTriggered`
  - `notifications:alertResolved`

## Error Handling

### Frontend Error Handling
- **Components**: `components/ErrorBoundary.js`
- **Socket Events**:
  - `error:client`
  - `error:server`

### Backend Error Handling
- **Routes**: All API routes
- **Socket Events**:
  - `error:validation`
  - `error:permission`
  - `error:system`

## Data Flow Patterns

### Real-time Updates
1. Backend emits socket event
2. Frontend socket listener receives event
3. Component state updates
4. UI re-renders with new data

### Request-Response Flow
1. Frontend makes API request
2. Backend processes request
3. Response sent to frontend
4. Component updates with response data

### WebSocket Connection
1. Frontend establishes socket connection
2. Authentication token sent
3. Connection maintained
4. Real-time events flow

## Security Considerations

### Authentication Flow
1. User credentials sent to backend
2. JWT token generated
3. Token stored in frontend
4. Token used for subsequent requests

### Authorization Checks
1. Frontend checks user role
2. Backend validates permissions
3. Access granted/denied
4. UI updates accordingly

## Performance Optimization

### Data Caching
- Frontend caches API responses
- Socket events update cache
- Cache invalidation on updates

### Real-time Updates
- WebSocket for instant updates
- Fallback to polling if needed
- Optimistic UI updates
