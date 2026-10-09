const { Router } = require('express');
const { serviceClient } = require('../config/supabase');
const { asyncHandler, AppError } = require('../middleware/error');
const { buildPricing } = require('../services/pricing');
const { estimateFreight } = require('../services/freight');

const router = Router();

/**
 * POST /api/pricing/quote
 * Live price calculator for the order modal (does NOT persist anything).
 * body: { items: [{product_id, quantity}], pincode? }
 */
router.post('/quote', asyncHandler(async (req, res) => {
  const { items, pincode } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) throw AppError('items array is required.');

  const ids = items.map((i) => i.product_id);
  const quantities = Object.fromEntries(items.map((i) => [i.product_id, Number(i.quantity)]));

  const { data: products, error } = await serviceClient
    .from('products')
    .select('id, name, brand, price_per_unit, unit_type, discount_tier_qty, discount_tier_percent')
    .in('id', ids);

  if (error) throw AppError(error.message);
  if (!products || products.length !== ids.length) throw AppError('One or more products not found.');

  const freight = await estimateFreight(pincode);
  const pricing = buildPricing(
    products.map((p) => ({ product: p, quantity: quantities[p.id] })),
    pincode,
    freight
  );

  res.json({
    data: {
      freight_used: freight,
      ...pricing,
    },
  });
}));

module.exports = router;