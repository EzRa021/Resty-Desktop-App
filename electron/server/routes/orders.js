const validateOrder = async (data, db, menuItemsDB, customersDB, isUpdate = false) => {
  const errors = [];
  const sanitizedData = {
    customerId: data.customerId ? sanitizeHtml(data.customerId) : '',
    items: Array.isArray(data.items) ? data.items.map(item => ({
      menuItemId: item.menuItemId ? sanitizeHtml(item.menuItemId) : '',
      quantity: Number.isInteger(item.quantity) ? item.quantity : 0,
      specialInstructions: item.specialInstructions ? sanitizeHtml(item.specialInstructions) : '',
      price: Number.isFinite(item.price) ? Number(item.price) : 0,
    })) : [],
    status: data.status ? sanitizeHtml(data.status) : 'pending',
    paymentStatus: data.paymentStatus ? sanitizeHtml(data.paymentStatus) : 'pending',
    paymentMethod: data.paymentMethod ? sanitizeHtml(data.paymentMethod) : undefined,
    totalAmount: Number.isFinite(data.totalAmount) ? Number(data.totalAmount) : 0,
    tax: Number.isFinite(data.tax) ? Number(data.tax) : 0,
    tip: Number.isFinite(data.tip) ? Number(data.tip) : 0,
    deliveryAddress: data.deliveryAddress ? {
      street: sanitizeHtml(data.deliveryAddress.street || ''),
      city: sanitizeHtml(data.deliveryAddress.city || ''),
      state: sanitizeHtml(data.deliveryAddress.state || ''),
      zipCode: sanitizeHtml(data.deliveryAddress.zipCode || ''),
      country: sanitizeHtml(data.deliveryAddress.country || ''),
    } : undefined,
    isActive: typeof data.isActive === 'boolean' ? data.isActive : true,
  };

  // Validate customer
  if (!sanitizedData.customerId) {
    errors.push('Customer ID is required');
  } else {
    try {
      const customer = await customersDB.get(sanitizedData.customerId).catch(() => null);
      if (!customer || !customer.isActive) {
        errors.push('Invalid or inactive customer ID');
      }
    } catch (error) {
      console.error('Error validating customer ID:', error);
      errors.push('Unable to validate customer ID');
    }
  }

  // Validate items
  if (!Array.isArray(sanitizedData.items) || sanitizedData.items.length === 0) {
    errors.push('Order must contain at least one item');
  } else {
    for (const item of sanitizedData.items) {
      if (!item.menuItemId) {
        errors.push('Menu item ID is required for each item');
        continue;
      }
      try {
        const menuItem = await menuItemsDB.get(item.menuItemId).catch(() => null);
        if (!menuItem || !menuItem.isActive) {
          errors.push(`Invalid or inactive menu item ID: ${item.menuItemId}`);
        }
      } catch (error) {
        console.error(`Error validating menu item ID ${item.menuItemId}:`, error);
        errors.push('Unable to validate menu item ID');
      }
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        errors.push('Item quantity must be a positive integer');
      }
      if (!Number.isFinite(item.price) || item.price < 0) {
        errors.push('Item price must be a non-negative number');
      }
    }
  }

  // Validate status
  const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'];
  if (!validStatuses.includes(sanitizedData.status)) {
    errors.push('Invalid order status');
  }

  // Validate payment status
  const validPaymentStatuses = ['pending', 'paid', 'failed', 'refunded'];
  if (!validPaymentStatuses.includes(sanitizedData.paymentStatus)) {
    errors.push('Invalid payment status');
  }

  // Validate payment method if provided
  if (sanitizedData.paymentMethod) {
    const validPaymentMethods = ['cash', 'credit_card', 'debit_card', 'mobile_payment'];
    if (!validPaymentMethods.includes(sanitizedData.paymentMethod)) {
      errors.push('Invalid payment method');
    }
  }

  // Validate amounts
  if (!Number.isFinite(sanitizedData.totalAmount) || sanitizedData.totalAmount < 0) {
    errors.push('Total amount must be a non-negative number');
  }
  if (!Number.isFinite(sanitizedData.tax) || sanitizedData.tax < 0) {
    errors.push('Tax must be a non-negative number');
  }
  if (!Number.isFinite(sanitizedData.tip) || sanitizedData.tip < 0) {
    errors.push('Tip must be a non-negative number');
  }

  // Validate delivery address if provided
  if (sanitizedData.deliveryAddress) {
    if (!sanitizedData.deliveryAddress.street) {
      errors.push('Street address is required for delivery');
    }
    if (!sanitizedData.deliveryAddress.city) {
      errors.push('City is required for delivery');
    }
    if (!sanitizedData.deliveryAddress.state) {
      errors.push('State is required for delivery');
    }
    if (!sanitizedData.deliveryAddress.zipCode) {
      errors.push('ZIP code is required for delivery');
    }
    if (!sanitizedData.deliveryAddress.country) {
      errors.push('Country is required for delivery');
    }
  }

  return { isValid: errors.length === 0, errors, sanitizedData };
}; 