export const testData = {
  // Categories
  categories: [
    {
      _id: 'cat_001',
      type: 'category',
      name: 'Main Course',
      description: 'Main dishes and entrees',
      restaurantId: 'rest_001',
      branchId: 'branch_001',
      displayOrder: 1,
      imageUrl: 'https://example.com/images/main_course.jpg',
      isActive: true,
      availabilitySchedule: {
        isAlwaysAvailable: true,
        customHours: []
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      _id: 'cat_002',
      type: 'category',
      name: 'Appetizers',
      description: 'Starters and small plates',
      restaurantId: 'rest_001',
      branchId: 'branch_001',
      displayOrder: 2,
      imageUrl: 'https://example.com/images/appetizers.jpg',
      isActive: true,
      availabilitySchedule: {
        isAlwaysAvailable: true,
        customHours: []
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      _id: 'cat_003',
      type: 'category',
      name: 'Desserts',
      description: 'Sweet treats and desserts',
      restaurantId: 'rest_001',
      branchId: 'branch_001',
      displayOrder: 3,
      imageUrl: 'https://example.com/images/desserts.jpg',
      isActive: true,
      availabilitySchedule: {
        isAlwaysAvailable: true,
        customHours: []
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],

  // Subcategories
  subcategories: [
    {
      _id: 'subcat_001',
      type: 'subcategory',
      name: 'Pasta',
      description: 'Italian pasta dishes',
      categoryId: 'cat_001',
      restaurantId: 'rest_001',
      branchId: 'branch_001',
      displayOrder: 1,
      imageUrl: 'https://example.com/images/pasta.jpg',
      isActive: true,
      availabilitySchedule: {
        isAlwaysAvailable: true,
        customHours: []
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      _id: 'subcat_002',
      type: 'subcategory',
      name: 'Grilled',
      description: 'Grilled meat and seafood',
      categoryId: 'cat_001',
      restaurantId: 'rest_001',
      branchId: 'branch_001',
      displayOrder: 2,
      imageUrl: 'https://example.com/images/grilled.jpg',
      isActive: true,
      availabilitySchedule: {
        isAlwaysAvailable: true,
        customHours: []
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      _id: 'subcat_003',
      type: 'subcategory',
      name: 'Soups',
      description: 'Hot and cold soups',
      categoryId: 'cat_002',
      restaurantId: 'rest_001',
      branchId: 'branch_001',
      displayOrder: 1,
      imageUrl: 'https://example.com/images/soups.jpg',
      isActive: true,
      availabilitySchedule: {
        isAlwaysAvailable: true,
        customHours: []
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],

  // Ingredients
  ingredients: [
    {
      _id: 'ing_001',
      type: 'ingredient',
      name: 'Spaghetti',
      description: 'Italian pasta',
      unit: 'kg',
      costPerUnit: 2.50,
      supplierId: 'sup_001',
      restaurantId: 'rest_001',
      minStock: 5,
      currentStock: 10,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      _id: 'ing_002',
      type: 'ingredient',
      name: 'Chicken Breast',
      description: 'Boneless chicken breast',
      unit: 'kg',
      costPerUnit: 8.00,
      supplierId: 'sup_002',
      restaurantId: 'rest_001',
      minStock: 3,
      currentStock: 5,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      _id: 'ing_003',
      type: 'ingredient',
      name: 'Tomato Sauce',
      description: 'Basic tomato sauce',
      unit: 'liter',
      costPerUnit: 3.50,
      supplierId: 'sup_001',
      restaurantId: 'rest_001',
      minStock: 2,
      currentStock: 4,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],

  // Recipes
  recipes: [
    {
      _id: 'rec_001',
      type: 'recipe',
      name: 'Spaghetti Bolognese',
      description: 'Classic Italian pasta dish',
      categoryId: 'cat_001',
      subcategoryId: 'subcat_001',
      restaurantId: 'rest_001',
      cost: 5.50,
      sellingPrice: 12.99,
      preparationTime: 20,
      cookingTime: 30,
      servings: 1,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      _id: 'rec_002',
      type: 'recipe',
      name: 'Grilled Chicken',
      description: 'Grilled chicken breast with herbs',
      categoryId: 'cat_001',
      subcategoryId: 'subcat_002',
      restaurantId: 'rest_001',
      cost: 6.00,
      sellingPrice: 15.99,
      preparationTime: 15,
      cookingTime: 25,
      servings: 1,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],

  // Recipe Versions
  recipeVersions: [
    {
      _id: 'recv_001',
      type: 'recipe_version',
      recipeId: 'rec_001',
      version: 1,
      ingredients: [
        {
          ingredientId: 'ing_001',
          quantity: 0.2,
          unit: 'kg'
        },
        {
          ingredientId: 'ing_003',
          quantity: 0.1,
          unit: 'liter'
        }
      ],
      instructions: [
        'Boil pasta according to package instructions',
        'Heat tomato sauce',
        'Combine and serve'
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],

  // Menu Items
  menuItems: [
    {
      _id: 'menu_001',
      type: 'menu_item',
      name: 'Spaghetti Bolognese',
      description: 'Classic Italian pasta dish with meat sauce',
      categoryId: 'cat_001',
      subcategoryId: 'subcat_001',
      recipeId: 'rec_001',
      restaurantId: 'rest_001',
      price: 12.99,
      image: 'spaghetti_bolognese.jpg',
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      _id: 'menu_002',
      type: 'menu_item',
      name: 'Grilled Chicken',
      description: 'Grilled chicken breast with herbs and vegetables',
      categoryId: 'cat_001',
      subcategoryId: 'subcat_002',
      recipeId: 'rec_002',
      restaurantId: 'rest_001',
      price: 15.99,
      image: 'grilled_chicken.jpg',
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],

  // Inventory Transactions
  inventoryTransactions: [
    {
      _id: 'inv_001',
      type: 'inventory_transaction',
      ingredientId: 'ing_001',
      quantity: 5,
      unit: 'kg',
      type: 'purchase',
      cost: 12.50,
      supplierId: 'sup_001',
      restaurantId: 'rest_001',
      date: new Date().toISOString(),
      notes: 'Regular stock purchase',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      _id: 'inv_002',
      type: 'inventory_transaction',
      ingredientId: 'ing_002',
      quantity: 3,
      unit: 'kg',
      type: 'purchase',
      cost: 24.00,
      supplierId: 'sup_002',
      restaurantId: 'rest_001',
      date: new Date().toISOString(),
      notes: 'Regular stock purchase',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],

  // Suppliers
  suppliers: [
    {
      _id: 'sup_001',
      type: 'supplier',
      name: 'Italian Food Supplies',
      contactPerson: 'John Smith',
      email: 'john@italianfood.com',
      phone: '555-0101',
      address: '123 Food Street, Foodville',
      restaurantId: 'rest_001',
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      _id: 'sup_002',
      type: 'supplier',
      name: 'Fresh Meat Co.',
      contactPerson: 'Jane Doe',
      email: 'jane@freshmeat.com',
      phone: '555-0102',
      address: '456 Meat Avenue, Meatville',
      restaurantId: 'rest_001',
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ]
}; 