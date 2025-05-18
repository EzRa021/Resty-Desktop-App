import { validateUserSession } from './utils.js';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';

// Default system settings
const DEFAULT_SYSTEM_SETTINGS = {
  // User Settings (Individual user preferences)
  user: {
    theme: 'light',
    language: 'en',
    timezone: 'UTC',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '24h',
    notifications: {
      desktop: true,
      sound: true,
      email: true,
      sms: false
    },
    display: {
      fontSize: 'normal',
      highContrast: false,
      animations: true
    },
    shortcuts: {
      enabled: true,
      custom: {}
    },
    dashboard: {
      layout: 'default',
      widgets: ['orders', 'inventory', 'sales']
    }
  },

  // Role-based Settings
  roles: {
    owner: {
      canManageUsers: true,
      canManageRoles: true,
      canManageSettings: true,
      canViewReports: true,
      canManageInventory: true,
      canManageMenu: true,
      canManageOrders: true,
      canManageTables: true,
      canManageKDS: true,
      canManageWaste: true,
      canManageLoyalty: true,
      canManageSpecials: true,
      canManageAnalytics: true,
      canManageIntegrations: true
    },
    manager: {
      canManageUsers: false,
      canManageRoles: false,
      canManageSettings: true,
      canViewReports: true,
      canManageInventory: true,
      canManageMenu: true,
      canManageOrders: true,
      canManageTables: true,
      canManageKDS: true,
      canManageWaste: true,
      canManageLoyalty: true,
      canManageSpecials: true,
      canManageAnalytics: true,
      canManageIntegrations: false
    },
    admin: {
      canManageUsers: true,
      canManageRoles: false,
      canManageSettings: true,
      canViewReports: true,
      canManageInventory: true,
      canManageMenu: true,
      canManageOrders: true,
      canManageTables: true,
      canManageKDS: true,
      canManageWaste: true,
      canManageLoyalty: true,
      canManageSpecials: true,
      canManageAnalytics: true,
      canManageIntegrations: false
    },
    kitchen: {
      canManageUsers: false,
      canManageRoles: false,
      canManageSettings: false,
      canViewReports: false,
      canManageInventory: true,
      canManageMenu: false,
      canManageOrders: true,
      canManageTables: false,
      canManageKDS: true,
      canManageWaste: true,
      canManageLoyalty: false,
      canManageSpecials: false,
      canManageAnalytics: false,
      canManageIntegrations: false
    },
    waiter: {
      canManageUsers: false,
      canManageRoles: false,
      canManageSettings: false,
      canViewReports: false,
      canManageInventory: false,
      canManageMenu: false,
      canManageOrders: true,
      canManageTables: true,
      canManageKDS: false,
      canManageWaste: false,
      canManageLoyalty: true,
      canManageSpecials: true,
      canManageAnalytics: false,
      canManageIntegrations: false
    },
    cashier: {
      canManageUsers: false,
      canManageRoles: false,
      canManageSettings: false,
      canViewReports: true,
      canManageInventory: false,
      canManageMenu: false,
      canManageOrders: true,
      canManageTables: false,
      canManageKDS: false,
      canManageWaste: false,
      canManageLoyalty: true,
      canManageSpecials: true,
      canManageAnalytics: false,
      canManageIntegrations: false
    }
  },

  // Receipt Settings
  receipt: {
    paperSize: '80mm',
    fontSize: 'normal',
    lineSpacing: 'normal',
    showLogo: true,
    logoPosition: 'center',
    headerText: '',
    showAddress: true,
    showPhone: true,
    showOrderNumber: true,
    showDate: true,
    showTime: true,
    showCashier: true,
    showTable: true,
    showItemDescription: true,
    showItemModifiers: true,
    showItemNotes: true,
    showSubtotal: true,
    showTax: true,
    showServiceCharge: true,
    showDiscount: true,
    showTotal: true,
    showPaymentMethod: true,
    showPaymentStatus: true,
    showFooter: true,
    footerText: 'Thank you for your business!',
    showBarcode: true,
    showQRCode: true,
    qrCodePosition: 'bottom',
    barcodePosition: 'center'
  },

  // POS Settings
  pos: {
    defaultOrderType: 'Dine-in',
    requireTableNumber: true,
    requireServerName: true,
    allowOrderNotes: true,
    allowCustomerInfo: false,
    taxRate: 0.10,
    serviceChargeRate: 0.05,
    roundingMethod: 'nearest',
    paymentMethods: ['cash', 'credit_card', 'mobile_payment'],
    defaultPaymentMethod: 'cash',
    autoPrintReceipt: true,
    showOrderConfirmation: true,
    allowPartialPayments: false,
    allowOrderModification: true,
    orderModificationWindow: 5, // minutes
    defaultCurrency: 'USD',
    currencySymbol: '$',
    decimalPlaces: 2
  },

  // Inventory Settings
  inventory: {
    lowStockThreshold: 10,
    reorderPoint: 20,
    defaultUnit: 'units',
    trackExpiryDates: true,
    expiryWarningDays: 7,
    allowNegativeStock: false,
    autoReorderEnabled: false,
    reorderQuantity: 50,
    stockTakeFrequency: 'monthly',
    lastStockTake: null,
    nextStockTake: null,
    requireBatchTracking: false,
    requireLocationTracking: true,
    defaultLocation: 'Main Storage'
  },

  // Menu Settings
  menu: {
    showNutritionalInfo: true,
    showAllergens: true,
    showIngredients: true,
    showPricing: true,
    allowPriceModification: true,
    requireItemDescription: true,
    requireItemImage: false,
    requireCategory: true,
    requireSubcategory: false,
    allowCustomPricing: true,
    allowSpecialPricing: true,
    allowTimeBasedPricing: false,
    allowQuantityBasedPricing: false,
    defaultAvailability: true
  },

  // Notification Settings
  notifications: {
    enableDesktopNotifications: true,
    enableEmailNotifications: true,
    enableSMSNotifications: false,
    lowStockAlerts: true,
    orderAlerts: true,
    paymentAlerts: true,
    systemAlerts: true,
    alertSound: true,
    alertVolume: 0.5,
    notificationRetention: 30, // days
    notificationPriority: 'high'
  },

  // User Settings
  users: {
    requireStrongPasswords: true,
    passwordExpiryDays: 90,
    sessionTimeout: 30, // minutes
    maxLoginAttempts: 5,
    lockoutDuration: 15, // minutes
    requireTwoFactor: false,
    defaultRole: 'cashier',
    allowRoleModification: true,
    allowUserCreation: true,
    allowUserDeletion: false
  },

  // System Settings
  system: {
    language: 'en',
    timezone: 'UTC',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '24h',
    theme: 'light',
    autoBackup: true,
    backupFrequency: 'daily',
    backupRetention: 30, // days
    logRetention: 90, // days
    debugMode: false,
    maintenanceMode: false
  },

  // KDS (Kitchen Display System) Settings
  kds: {
    displayMode: 'grid', // grid or list
    showOrderTimer: true,
    showPreparationTime: true,
    showCustomerInfo: false,
    showNotes: true,
    showModifiers: true,
    autoRefreshInterval: 30, // seconds
    soundAlerts: true,
    alertVolume: 0.5,
    alertSound: 'default',
    showCompletedOrders: false,
    completedOrdersRetention: 5, // minutes
    showOrderNumber: true,
    showTableNumber: true,
    showServerName: true,
    showOrderTime: true,
    showEstimatedTime: true,
    allowOrderModification: true,
    allowOrderCancellation: true,
    requireConfirmation: true,
    displayPriority: ['dine-in', 'takeout', 'delivery'],
    customStatuses: [],
    defaultStatus: 'pending'
  },

  // Table Management Settings
  tables: {
    allowTableCombination: true,
    allowTableSplitting: true,
    requireTableAssignment: true,
    allowWalkIns: true,
    maxPartySize: 20,
    defaultTurnoverTime: 90, // minutes
    allowTableReservation: true,
    reservationWindow: 14, // days
    minReservationNotice: 1, // hours
    maxReservationNotice: 30, // days
    allowWaitlist: true,
    waitlistNotification: true,
    tableStatusColors: {
      available: '#4CAF50',
      occupied: '#F44336',
      reserved: '#2196F3',
      cleaning: '#FFC107'
    },
    floorPlan: {
      showGrid: true,
      showLabels: true,
      showStatus: true,
      showCapacity: true
    }
  },

  // Specials and Promotions Settings
  specials: {
    allowTimeBasedSpecials: true,
    allowDayBasedSpecials: true,
    allowQuantityBasedSpecials: true,
    allowComboSpecials: true,
    allowDiscountSpecials: true,
    allowBOGOSpecials: true,
    allowHappyHour: true,
    happyHourStart: '16:00',
    happyHourEnd: '19:00',
    happyHourDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    requireSpecialApproval: false,
    specialDuration: 7, // days
    maxActiveSpecials: 10,
    allowSpecialOverlap: false,
    requireSpecialImage: false,
    requireSpecialDescription: true,
    requireSpecialTerms: true
  },

  // Waste Management Settings
  waste: {
    trackWaste: true,
    requireWasteReason: true,
    requireWasteApproval: true,
    wasteCategories: [
      'spoilage',
      'preparation',
      'customer_return',
      'expired',
      'damaged',
      'other'
    ],
    requireWastePhoto: false,
    requireWasteWeight: true,
    defaultWeightUnit: 'kg',
    wasteReportFrequency: 'daily',
    wasteAlertThreshold: 100, // percentage of normal waste
    allowWasteAdjustment: true,
    requireWasteAdjustmentReason: true,
    wasteReportRecipients: []
  },

  // Loyalty Program Settings
  loyalty: {
    enabled: true,
    pointsPerDollar: 1,
    minimumPointsRedemption: 100,
    pointsExpiry: 365, // days
    allowPointsTransfer: false,
    allowPointsGift: false,
    requirePhoneNumber: true,
    requireEmail: true,
    tiers: [
      {
        name: 'Bronze',
        pointsRequired: 0,
        benefits: ['Basic rewards']
      },
      {
        name: 'Silver',
        pointsRequired: 1000,
        benefits: ['Basic rewards', 'Priority service']
      },
      {
        name: 'Gold',
        pointsRequired: 5000,
        benefits: ['Basic rewards', 'Priority service', 'Special offers']
      }
    ],
    rewards: [
      {
        name: 'Free Item',
        pointsCost: 500,
        type: 'item'
      },
      {
        name: '10% Discount',
        pointsCost: 1000,
        type: 'discount'
      }
    ],
    birthdayReward: {
      enabled: true,
      points: 500,
      daysBefore: 7
    }
  },

  // Analytics Settings
  analytics: {
    trackSales: true,
    trackInventory: true,
    trackWaste: true,
    trackCustomerBehavior: true,
    trackEmployeePerformance: true,
    reportFrequency: 'daily',
    reportRecipients: [],
    customMetrics: [],
    dataRetention: 365, // days
    exportFormats: ['csv', 'pdf', 'excel'],
    dashboardLayout: 'default',
    showCharts: true,
    showTables: true,
    showKPIs: true,
    refreshInterval: 60, // minutes
    alertThresholds: {
      sales: 20, // percentage change
      inventory: 10, // percentage change
      waste: 15, // percentage change
      customerSatisfaction: 4.0 // rating
    }
  },

  // Integration Settings
  integrations: {
    paymentGateways: {
      stripe: {
        enabled: false,
        testMode: true,
        apiKey: '',
        webhookSecret: ''
      },
      square: {
        enabled: false,
        testMode: true,
        accessToken: '',
        locationId: ''
      }
    },
    deliveryServices: {
      doordash: {
        enabled: false,
        apiKey: '',
        storeId: ''
      },
      ubereats: {
        enabled: false,
        apiKey: '',
        storeId: ''
      }
    },
    accounting: {
      quickbooks: {
        enabled: false,
        clientId: '',
        clientSecret: '',
        companyId: ''
      },
      xero: {
        enabled: false,
        clientId: '',
        clientSecret: '',
        tenantId: ''
      }
    },
    marketing: {
      mailchimp: {
        enabled: false,
        apiKey: '',
        listId: ''
      },
      sms: {
        enabled: false,
        provider: 'twilio',
        accountSid: '',
        authToken: ''
      }
    }
  }
};

// Paper size configurations
const PAPER_SIZES = {
  '80mm': {
    width: 80,
    charactersPerLine: 32,
    maxLogoWidth: 300,
    maxLogoHeight: 100
  },
  '58mm': {
    width: 58,
    charactersPerLine: 24,
    maxLogoWidth: 200,
    maxLogoHeight: 80
  },
  'A4': {
    width: 210,
    charactersPerLine: 80,
    maxLogoWidth: 500,
    maxLogoHeight: 200
  }
};

// Helper function to save logo
const saveLogo = async (logoData, restaurantId) => {
  try {
    const logosDir = path.join(process.cwd(), 'logos');
    if (!fs.existsSync(logosDir)) {
      fs.mkdirSync(logosDir);
    }

    const base64Data = logoData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    const processedImage = await sharp(buffer)
      .resize(300, 300, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .toBuffer();

    const logoPath = path.join(logosDir, `${restaurantId}.png`);
    fs.writeFileSync(logoPath, processedImage);

    return logoPath;
  } catch (error) {
    console.error('Error saving logo:', error);
    throw error;
  }
};

export const registerSocketEvents = (socket, {
  db: settingsDB,
  sessionDB,
  logsDB
}) => {
  if (!settingsDB || !sessionDB) {
    console.error('Missing required database dependencies for settings routes');
    return;
  }

  // Get All Settings
  socket.on('settings:getAll', async (data, callback) => {
    try {
      const sessionValidation = await validateUserSession(
        data.sessionId,
        ['owner', 'manager', 'admin'],
        sessionDB
      );

      if (!sessionValidation.valid) {
        return callback?.({
          success: false,
          message: sessionValidation.message
        });
      }

      const settings = await settingsDB.get(data.restaurantId).catch(() => null);
      
      callback?.({
        success: true,
        data: {
          settings: settings?.settings || DEFAULT_SYSTEM_SETTINGS,
          paperSizes: PAPER_SIZES
        }
      });

    } catch (error) {
      console.error('Error getting settings:', error);
      callback?.({
        success: false,
        message: 'Failed to get settings',
        error: error.message
      });
    }
  });

  // Save Settings
  socket.on('settings:save', async (data, callback) => {
    try {
      const sessionValidation = await validateUserSession(
        data.sessionId,
        ['owner', 'manager', 'admin'],
        sessionDB
      );

      if (!sessionValidation.valid) {
        return callback?.({
          success: false,
          message: sessionValidation.message
        });
      }

      const existingSettings = await settingsDB.get(data.restaurantId).catch(() => null);
      const settings = {
        _id: data.restaurantId,
        type: 'settings',
        settings: {
          ...DEFAULT_SYSTEM_SETTINGS,
          ...(existingSettings?.settings || {}),
          ...data.settings
        },
        updatedAt: new Date().toISOString(),
        updatedBy: sessionValidation.user._id
      };

      // Save logo if provided
      if (data.logo) {
        const logoPath = await saveLogo(data.logo, data.restaurantId);
        settings.settings.receipt.logoPath = logoPath;
      }

      await settingsDB.put(settings);

      // Log the settings update
      await logsDB.put({
        _id: `log_${Date.now()}`,
        type: 'log',
        category: 'settings',
        action: 'update',
        userId: sessionValidation.user._id,
        restaurantId: data.restaurantId,
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'System settings updated'
      });

      callback?.({
        success: true,
        message: 'Settings saved successfully'
      });

    } catch (error) {
      console.error('Error saving settings:', error);
      callback?.({
        success: false,
        message: 'Failed to save settings',
        error: error.message
      });
    }
  });

  // Reset Settings
  socket.on('settings:reset', async (data, callback) => {
    try {
      const sessionValidation = await validateUserSession(
        data.sessionId,
        ['owner', 'manager', 'admin'],
        sessionDB
      );

      if (!sessionValidation.valid) {
        return callback?.({
          success: false,
          message: sessionValidation.message
        });
      }

      const settings = {
        _id: data.restaurantId,
        type: 'settings',
        settings: DEFAULT_SYSTEM_SETTINGS,
        updatedAt: new Date().toISOString(),
        updatedBy: sessionValidation.user._id
      };

      await settingsDB.put(settings);

      // Log the settings reset
      await logsDB.put({
        _id: `log_${Date.now()}`,
        type: 'log',
        category: 'settings',
        action: 'reset',
        userId: sessionValidation.user._id,
        restaurantId: data.restaurantId,
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'System settings reset to defaults'
      });

      callback?.({
        success: true,
        message: 'Settings reset to defaults'
      });

    } catch (error) {
      console.error('Error resetting settings:', error);
      callback?.({
        success: false,
        message: 'Failed to reset settings',
        error: error.message
      });
    }
  });

  // Get Paper Sizes
  socket.on('settings:getPaperSizes', async (data, callback) => {
    try {
      const sessionValidation = await validateUserSession(
        data.sessionId,
        ['owner', 'manager', 'admin'],
        sessionDB
      );

      if (!sessionValidation.valid) {
        return callback?.({
          success: false,
          message: sessionValidation.message
        });
      }

      callback?.({
        success: true,
        data: PAPER_SIZES
      });

    } catch (error) {
      console.error('Error getting paper sizes:', error);
      callback?.({
        success: false,
        message: 'Failed to get paper sizes',
        error: error.message
      });
    }
  });

  // Get User Settings
  socket.on('settings:getUserSettings', async (data, callback) => {
    try {
      const sessionValidation = await validateUserSession(
        data.sessionId,
        ['owner', 'manager', 'admin', 'kitchen', 'waiter', 'cashier'],
        sessionDB
      );

      if (!sessionValidation.valid) {
        return callback?.({
          success: false,
          message: sessionValidation.message
        });
      }

      const settings = await settingsDB.get(`user_${sessionValidation.user._id}`).catch(() => null);
      
      callback?.({
        success: true,
        data: {
          userSettings: settings?.user || DEFAULT_SYSTEM_SETTINGS.user,
          roleSettings: DEFAULT_SYSTEM_SETTINGS.roles[sessionValidation.user.role] || {}
        }
      });

    } catch (error) {
      console.error('Error getting user settings:', error);
      callback?.({
        success: false,
        message: 'Failed to get user settings',
        error: error.message
      });
    }
  });

  // Save User Settings
  socket.on('settings:saveUserSettings', async (data, callback) => {
    try {
      const sessionValidation = await validateUserSession(
        data.sessionId,
        ['owner', 'manager', 'admin', 'kitchen', 'waiter', 'cashier'],
        sessionDB
      );

      if (!sessionValidation.valid) {
        return callback?.({
          success: false,
          message: sessionValidation.message
        });
      }

      const existingSettings = await settingsDB.get(`user_${sessionValidation.user._id}`).catch(() => null);
      const settings = {
        _id: `user_${sessionValidation.user._id}`,
        type: 'userSettings',
        user: {
          ...DEFAULT_SYSTEM_SETTINGS.user,
          ...(existingSettings?.user || {}),
          ...data.settings
        },
        updatedAt: new Date().toISOString(),
        updatedBy: sessionValidation.user._id
      };

      await settingsDB.put(settings);

      // Log the settings update
      await logsDB.put({
        _id: `log_${Date.now()}`,
        type: 'log',
        category: 'settings',
        action: 'updateUserSettings',
        userId: sessionValidation.user._id,
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'User settings updated'
      });

      callback?.({
        success: true,
        message: 'User settings saved successfully'
      });

    } catch (error) {
      console.error('Error saving user settings:', error);
      callback?.({
        success: false,
        message: 'Failed to save user settings',
        error: error.message
      });
    }
  });

  // Get Role Settings
  socket.on('settings:getRoleSettings', async (data, callback) => {
    try {
      const sessionValidation = await validateUserSession(
        data.sessionId,
        ['owner', 'manager', 'admin'],
        sessionDB
      );

      if (!sessionValidation.valid) {
        return callback?.({
          success: false,
          message: sessionValidation.message
        });
      }

      callback?.({
        success: true,
        data: DEFAULT_SYSTEM_SETTINGS.roles
      });

    } catch (error) {
      console.error('Error getting role settings:', error);
      callback?.({
        success: false,
        message: 'Failed to get role settings',
        error: error.message
      });
    }
  });

  // Save Role Settings
  socket.on('settings:saveRoleSettings', async (data, callback) => {
    try {
      const sessionValidation = await validateUserSession(
        data.sessionId,
        ['owner'],
        sessionDB
      );

      if (!sessionValidation.valid) {
        return callback?.({
          success: false,
          message: sessionValidation.message
        });
      }

      const settings = {
        _id: 'role_settings',
        type: 'roleSettings',
        roles: {
          ...DEFAULT_SYSTEM_SETTINGS.roles,
          ...data.settings
        },
        updatedAt: new Date().toISOString(),
        updatedBy: sessionValidation.user._id
      };

      await settingsDB.put(settings);

      // Log the settings update
      await logsDB.put({
        _id: `log_${Date.now()}`,
        type: 'log',
        category: 'settings',
        action: 'updateRoleSettings',
        userId: sessionValidation.user._id,
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Role settings updated'
      });

      callback?.({
        success: true,
        message: 'Role settings saved successfully'
      });

    } catch (error) {
      console.error('Error saving role settings:', error);
      callback?.({
        success: false,
        message: 'Failed to save role settings',
        error: error.message
      });
    }
  });
};

export default registerSocketEvents; 