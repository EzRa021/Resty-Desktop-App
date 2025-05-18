// Fixed routes/index.js to properly register socket routes
import { registerSocketEvents as registerMenuItemSocketEvents } from "./menuItems.js";
import { registerSocketEvents as registerIngredientSocketEvents } from "./ingredients.js";
import { registerSocketEvents as registerRecipeSocketEvents } from "./recipes.js";
import { registerSocketEvents as registerUserSocketEvents } from "./users.js";
import { registerSocketEvents as registerBranchSocketEvents } from "./branches.js";
import { registerSocketEvents as registerRestaurantSocketEvents } from "./restaurants.js";
import { registerSocketEvents as registerRegistrationSocketEvents } from "./registration.js";
import { registerSocketEvents as registerCategorySocketEvents } from "./categories.js";
import { registerSocketEvents as registerSubcategorySocketEvents } from "./subcategories.js";
import { registerSocketEvents as registerPOSSocketEvents } from "./pos.js";
import { registerSocketEvents as registerInventorySocketEvents } from "./inventory.js";
import { registerSocketEvents as registerKDSSocketEvents } from "./kds.js";
import { registerSocketEvents as registerReportsSocketEvents } from "./reports.js";
import { registerSocketEvents as registerSuppliersSocketEvents } from "./suppliers.js";
import { registerSocketEvents as registerRecipeVersionsSocketEvents } from "./recipeVersions.js";
import { registerSocketEvents as registerTablesSocketEvents } from "./tables.js";
import { registerSocketEvents as registerSpecialsSocketEvents } from "./specials.js";
import { registerSocketEvents as registerWasteSocketEvents } from "./waste.js";
import { registerSocketEvents as registerLoyaltySocketEvents } from "./loyalty.js";
import { registerSocketEvents as registerNotificationSocketEvents } from "./notifications.js";
import { registerSocketEvents as registerAnalyticsSocketEvents } from "./analytics.js";
import { registerSocketEvents as registerSettingsSocketEvents } from "./settings.js";

export const registerSocketRoutes = async (io, databases) => {
  console.log("Registering Socket.IO routes...");

  try {
    // Ensure we have valid database connections
    if (!databases || !io) {
      console.error("Cannot register socket routes - missing dependencies");
      throw new Error(
        "Missing required dependencies for socket route registration"
      );
    }
    const {
      usersDB,
      restaurantsDB,
      branchesDB,
      sessionDB,
      logsDB,
      categoriesDB,
      subcategoriesDB,
      menuItemsDB,
      ingredientsDB,
      recipesDB,
      posDB,
      inventoryTransactionsDB,
      kdsDB,
      suppliersDB,
      recipeVersionsDB,
      tablesDB,
      specialsDB,
      wasteRecordsDB,
      loyaltyDB,
      notificationsDB,
      settingsDB
    } = databases;

    // Create a namespace for your application
    const appNamespace = io.of("/");

    // Register connection handler
    appNamespace.on("connection", (socket) => {
      console.log(`Client connected to app namespace: ${socket.id}`);

      // Registration routes
      registerRegistrationSocketEvents(socket, {
        usersDB,
        restaurantsDB,
        branchesDB,
        logsDB,
      });

      // Category routes
      registerCategorySocketEvents(socket, {
        db: categoriesDB,
        restaurantsDB,
        branchesDB,
        sessionDB,
        logsDB,
      });

      // Subcategory routes
      registerSubcategorySocketEvents(socket, {
        db: subcategoriesDB,
        categoriesDB,
        restaurantsDB,
        branchesDB,
        sessionDB,
        logsDB,
      });

      // User routes
      registerUserSocketEvents(socket, {
        db: usersDB,
        sessionDB,
        logsDB,
        restaurantsDB,
        branchesDB
      });

      // Menu Item routes
      registerMenuItemSocketEvents(socket, {
        db: menuItemsDB,
        categoriesDB,
        subcategoriesDB,
        ingredientsDB,
        restaurantsDB,
        branchesDB,
        sessionDB,
        logsDB,
      });

      // Ingredient routes
      registerIngredientSocketEvents(socket, {
        db: ingredientsDB,
        sessionDB,
      });

      // Recipe routes
      registerRecipeSocketEvents(socket, {
        db: recipesDB,
        menuItemsDB,
        ingredientsDB,
        restaurantsDB,
        branchesDB,
        sessionDB,
      });

      // POS routes
      registerPOSSocketEvents(socket, {
        db: posDB,
        menuItemsDB,
        ingredientsDB,
        sessionDB,
        logsDB,
      });

      // Inventory routes
      registerInventorySocketEvents(socket, {
        db: inventoryTransactionsDB,
        ingredientsDB,
        sessionDB,
        logsDB,
      });

      // KDS routes
      registerKDSSocketEvents(socket, {
        db: kdsDB,
        posDB,
        sessionDB,
        logsDB,
      });

      // Reports routes
      registerReportsSocketEvents(socket, {
        posDB,
        menuItemsDB,
        inventoryTransactionsDB,
        ingredientsDB,
        sessionDB,
        logsDB,
      });

      // Suppliers routes
      registerSuppliersSocketEvents(socket, {
        db: suppliersDB,
        ingredientsDB,
        sessionDB,
        logsDB,
      });

      // Recipe Versions routes
      registerRecipeVersionsSocketEvents(socket, {
        db: recipeVersionsDB,
        recipesDB,
        ingredientsDB,
        sessionDB,
        logsDB,
      });

      // Tables routes
      registerTablesSocketEvents(socket, {
        db: tablesDB,
        posDB,
        sessionDB,
        logsDB,
      });

      // Waste Management routes
      registerWasteSocketEvents(socket, {
        db: wasteRecordsDB,
        inventoryTransactionsDB,
        ingredientsDB,
        sessionDB,
        logsDB,
      });

      // Loyalty Management routes
      registerLoyaltySocketEvents(socket, {
        db: loyaltyDB,
        posDB,
        sessionDB,
        logsDB,
      });

      // Notification System routes
      registerNotificationSocketEvents(socket, {
        db: notificationsDB,
        usersDB,
        sessionDB,
        logsDB,
        io
      });

      // Analytics routes
      registerAnalyticsSocketEvents(socket, {
        posDB,
        inventoryTransactionsDB,
        ingredientsDB,
        menuItemsDB,
        sessionDB,
        logsDB
      });

      // Settings routes
      registerSettingsSocketEvents(socket, {
        db: settingsDB,
        sessionDB,
        logsDB
      });

      // Handle disconnection
      socket.on("disconnect", (reason) => {
        console.log(`Client ${socket.id} disconnected: ${reason}`);
      });
    });

    console.log("Socket.IO routes registered successfully");
  } catch (error) {
    console.error("Error registering socket routes:", error);
    throw error;
  }
};
