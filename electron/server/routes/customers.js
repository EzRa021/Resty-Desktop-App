const validateCustomer = async (data, db, isUpdate = false) => {
  const errors = [];
  const sanitizedData = {
    name: sanitizeHtml(data.name || ''),
    email: data.email ? sanitizeHtml(data.email) : '',
    phone: data.phone ? sanitizeHtml(data.phone) : '',
    address: data.address ? {
      street: sanitizeHtml(data.address.street || ''),
      city: sanitizeHtml(data.address.city || ''),
      state: sanitizeHtml(data.address.state || ''),
      zipCode: sanitizeHtml(data.address.zipCode || ''),
      country: sanitizeHtml(data.address.country || ''),
    } : undefined,
    preferences: {
      dietaryRestrictions: Array.isArray(data.preferences?.dietaryRestrictions) 
        ? data.preferences.dietaryRestrictions.map(r => sanitizeHtml(r)) 
        : [],
      allergies: Array.isArray(data.preferences?.allergies) 
        ? data.preferences.allergies.map(a => sanitizeHtml(a)) 
        : [],
      favoriteItems: Array.isArray(data.preferences?.favoriteItems) 
        ? data.preferences.favoriteItems.map(i => sanitizeHtml(i)) 
        : [],
    },
    isActive: typeof data.isActive === 'boolean' ? data.isActive : true,
  };

  // Validate name
  if (!sanitizedData.name || !validator.isLength(sanitizedData.name, { min: 1, max: 100 })) {
    errors.push('Customer name is required and must be 1-100 characters');
  }

  // Validate email
  if (sanitizedData.email) {
    if (!validator.isEmail(sanitizedData.email)) {
      errors.push('Invalid email format');
    } else if (!isUpdate) {
      try {
        const result = await db.find({
          selector: { 
            type: 'customer', 
            email: sanitizedData.email 
          },
          limit: 1,
        });
        if (result.docs.length > 0) {
          errors.push('Email already exists');
        }
      } catch (error) {
        console.error('Error checking email uniqueness:', error);
        errors.push('Unable to validate email uniqueness');
      }
    }
  }

  // Validate phone
  if (sanitizedData.phone && !validator.isMobilePhone(sanitizedData.phone, 'any')) {
    errors.push('Invalid phone number format');
  }

  // Validate address if provided
  if (sanitizedData.address) {
    if (!sanitizedData.address.street) {
      errors.push('Street address is required');
    }
    if (!sanitizedData.address.city) {
      errors.push('City is required');
    }
    if (!sanitizedData.address.state) {
      errors.push('State is required');
    }
    if (!sanitizedData.address.zipCode) {
      errors.push('ZIP code is required');
    }
    if (!sanitizedData.address.country) {
      errors.push('Country is required');
    }
  }

  // Validate preferences
  if (sanitizedData.preferences.dietaryRestrictions.length > 0) {
    for (const restriction of sanitizedData.preferences.dietaryRestrictions) {
      if (!restriction || !validator.isLength(restriction, { min: 1, max: 50 })) {
        errors.push('Dietary restriction must be 1-50 characters');
      }
    }
  }

  if (sanitizedData.preferences.allergies.length > 0) {
    for (const allergy of sanitizedData.preferences.allergies) {
      if (!allergy || !validator.isLength(allergy, { min: 1, max: 50 })) {
        errors.push('Allergy must be 1-50 characters');
      }
    }
  }

  if (sanitizedData.preferences.favoriteItems.length > 0) {
    for (const item of sanitizedData.preferences.favoriteItems) {
      if (!item || !validator.isLength(item, { min: 1, max: 100 })) {
        errors.push('Favorite item must be 1-100 characters');
      }
    }
  }

  return { isValid: errors.length === 0, errors, sanitizedData };
}; 