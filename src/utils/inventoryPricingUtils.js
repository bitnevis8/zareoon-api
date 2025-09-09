/**
 * Utility functions for handling inventory lot tiered pricing
 */

/**
 * Calculate price based on tiered pricing structure for inventory lots
 * @param {Array} tieredPricing - Array of pricing tiers
 * @param {number} quantity - Order quantity
 * @returns {Object} - { pricePerUnit, totalPrice, tier }
 */
const calculateInventoryTieredPrice = (tieredPricing, quantity) => {
  if (!tieredPricing || !Array.isArray(tieredPricing) || tieredPricing.length === 0) {
    return null;
  }

  // Sort tiers by minQuantity to ensure proper order
  const sortedTiers = [...tieredPricing].sort((a, b) => a.minQuantity - b.minQuantity);

  // Find the appropriate tier for the quantity
  for (const tier of sortedTiers) {
    const minQty = tier.minQuantity || 0;
    const maxQty = tier.maxQuantity || Infinity;
    
    if (quantity >= minQty && quantity <= maxQty) {
      return {
        pricePerUnit: parseFloat(tier.pricePerUnit),
        totalPrice: parseFloat(tier.pricePerUnit) * quantity,
        tier: tier,
        description: tier.description
      };
    }
  }

  // If no tier matches, return the last tier (highest quantity)
  const lastTier = sortedTiers[sortedTiers.length - 1];
  return {
    pricePerUnit: parseFloat(lastTier.pricePerUnit),
    totalPrice: parseFloat(lastTier.pricePerUnit) * quantity,
    tier: lastTier,
    description: lastTier.description
  };
};

/**
 * Validate minimum order quantity for inventory lot
 * @param {number} minimumOrderQuantity - Minimum required quantity
 * @param {number} requestedQuantity - User requested quantity
 * @returns {Object} - { isValid, message }
 */
const validateInventoryMinimumOrder = (minimumOrderQuantity, requestedQuantity) => {
  if (!minimumOrderQuantity) {
    return { isValid: true, message: null };
  }

  if (requestedQuantity < minimumOrderQuantity) {
    return {
      isValid: false,
      message: `حداقل سفارش ${minimumOrderQuantity} کیلوگرم است.`
    };
  }

  return { isValid: true, message: null };
};

/**
 * Get pricing information for an inventory lot
 * @param {Object} inventoryLot - Inventory lot object with tieredPricing
 * @param {number} quantity - Requested quantity
 * @returns {Object} - Complete pricing information
 */
const getInventoryPricing = (inventoryLot, quantity) => {
  const minimumOrderValidation = validateInventoryMinimumOrder(
    inventoryLot.minimumOrderQuantity,
    quantity
  );

  if (!minimumOrderValidation.isValid) {
    return {
      isValid: false,
      error: minimumOrderValidation.message,
      minimumOrderQuantity: inventoryLot.minimumOrderQuantity,
      requestedQuantity: quantity
    };
  }

  // If tiered pricing exists, use it
  if (inventoryLot.tieredPricing && inventoryLot.tieredPricing.length > 0) {
    const tieredPrice = calculateInventoryTieredPrice(inventoryLot.tieredPricing, quantity);
    return {
      isValid: true,
      quantity: quantity,
      minimumOrderQuantity: inventoryLot.minimumOrderQuantity,
      tieredPricing: inventoryLot.tieredPricing,
      calculatedPrice: tieredPrice,
      pricePerUnit: tieredPrice ? tieredPrice.pricePerUnit : null,
      totalPrice: tieredPrice ? tieredPrice.totalPrice : null,
      pricingType: 'tiered'
    };
  }

  // Fallback to simple pricing
  if (inventoryLot.price) {
    return {
      isValid: true,
      quantity: quantity,
      minimumOrderQuantity: inventoryLot.minimumOrderQuantity,
      tieredPricing: null,
      calculatedPrice: null,
      pricePerUnit: parseFloat(inventoryLot.price),
      totalPrice: parseFloat(inventoryLot.price) * quantity,
      pricingType: 'simple'
    };
  }

  return {
    isValid: false,
    error: 'قیمت برای این موجودی تعریف نشده است.',
    minimumOrderQuantity: inventoryLot.minimumOrderQuantity,
    requestedQuantity: quantity
  };
};

/**
 * Create default tiered pricing structure
 * @param {number} basePrice - Base price per unit
 * @param {string} unit - Unit of measurement
 * @returns {Array} - Default tiered pricing array
 */
const createDefaultTieredPricing = (basePrice, unit = 'kg') => {
  return [
    {
      minQuantity: 100,
      maxQuantity: 999,
      pricePerUnit: basePrice,
      description: `زیر 1000 ${unit}`
    },
    {
      minQuantity: 1000,
      maxQuantity: 9999,
      pricePerUnit: basePrice * 0.9, // 10% discount
      description: `بین 1000 تا 10000 ${unit}`
    },
    {
      minQuantity: 10000,
      maxQuantity: null,
      pricePerUnit: basePrice * 0.8, // 20% discount
      description: `بالای 10000 ${unit}`
    }
  ];
};

module.exports = {
  calculateInventoryTieredPrice,
  validateInventoryMinimumOrder,
  getInventoryPricing,
  createDefaultTieredPricing
};
