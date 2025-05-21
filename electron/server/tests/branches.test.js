import { io } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';

// Test configuration
const TEST_CONFIG = {
  serverUrl: 'http://localhost:3000',
  testTimeout: 10000,
  testUser: {
    _id: 'test_user_id',
    role: 'owner',
    email: 'test@example.com'
  },
  testRestaurant: {
    _id: 'test_restaurant_id',
    ownerId: 'test_user_id',
    name: 'Test Restaurant'
  }
};

// Helper function to create a test socket connection
const createTestSocket = (sessionId) => {
  return io(TEST_CONFIG.serverUrl, {
    auth: { sessionId },
    transports: ['websocket'],
    reconnection: false
  });
};

// Helper function to wait for socket event
const waitForEvent = (socket, event) => {
  return new Promise((resolve) => {
    socket.once(event, (data) => resolve(data));
  });
};

// Helper function to create a test session
const createTestSession = async (sessionDB) => {
  const sessionId = `session_${uuidv4()}`;
  const session = {
    _id: sessionId,
    type: 'session',
    userId: TEST_CONFIG.testUser._id,
    userDetails: TEST_CONFIG.testUser,
    createdAt: new Date().toISOString(),
    lastActivity: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    isRevoked: false
  };
  await sessionDB.put(session);
  return sessionId;
};

// Test suite for branches endpoints
describe('Branches API Tests', () => {
  let socket;
  let sessionId;
  let testBranchId;

  beforeAll(async () => {
    // Create test session
    sessionId = await createTestSession(global.sessionDB);
    socket = createTestSocket(sessionId);
    
    // Wait for connection
    await new Promise((resolve) => {
      socket.on('connect', resolve);
    });
  });

  afterAll(() => {
    socket.disconnect();
  });

  // Test branches:getAll
  test('should get all branches for a restaurant', async () => {
    const response = await new Promise((resolve) => {
      socket.emit('branches:getAll', { 
        restaurantId: TEST_CONFIG.testRestaurant._id 
      }, resolve);
    });

    expect(response).toBeDefined();
    expect(response.error).toBeUndefined();
    expect(Array.isArray(response.branches)).toBe(true);
  }, TEST_CONFIG.testTimeout);

  // Test branches:create
  test('should create a new branch', async () => {
    const branchData = {
      restaurantId: TEST_CONFIG.testRestaurant._id,
      name: 'Test Branch',
      address: {
        street: '123 Test St',
        city: 'Test City',
        state: 'Test State',
        zipCode: '12345',
        country: 'Test Country'
      },
      contactInfo: {
        phone: '+1234567890',
        email: 'branch@test.com'
      }
    };

    const response = await new Promise((resolve) => {
      socket.emit('branches:create', branchData, resolve);
    });

    expect(response.success).toBe(true);
    expect(response.branch).toBeDefined();
    expect(response.branch.name).toBe(branchData.name);
    testBranchId = response.branch._id;
  }, TEST_CONFIG.testTimeout);

  // Test branches:get
  test('should get branch by ID', async () => {
    const response = await new Promise((resolve) => {
      socket.emit('branches:get', { branchId: testBranchId }, resolve);
    });

    expect(response.success).toBe(true);
    expect(response.branch).toBeDefined();
    expect(response.branch._id).toBe(testBranchId);
  }, TEST_CONFIG.testTimeout);

  // Test branches:delete
  test('should delete a branch', async () => {
    const response = await new Promise((resolve) => {
      socket.emit('branches:delete', { branchId: testBranchId }, resolve);
    });

    expect(response.success).toBe(true);
  }, TEST_CONFIG.testTimeout);

  // Test error cases
  test('should handle invalid restaurant ID', async () => {
    const response = await new Promise((resolve) => {
      socket.emit('branches:getAll', { restaurantId: 'invalid_id' }, resolve);
    });

    expect(response.error).toBeDefined();
  }, TEST_CONFIG.testTimeout);

  test('should handle unauthorized access', async () => {
    // Create a socket with a different user role
    const unauthorizedSocket = createTestSocket(await createTestSession(global.sessionDB, {
      ...TEST_CONFIG.testUser,
      role: 'waiter'
    }));

    const response = await new Promise((resolve) => {
      unauthorizedSocket.emit('branches:getAll', { 
        restaurantId: TEST_CONFIG.testRestaurant._id 
      }, resolve);
    });

    expect(response.error).toBeDefined();
    unauthorizedSocket.disconnect();
  }, TEST_CONFIG.testTimeout);
}); 