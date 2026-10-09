const { Router } = require('express');
const { serviceClient } = require('../config/supabase');
const { asyncHandler, AppError } = require('../middleware/error');

const router = Router();

const PRODUCT_SELECT =
  'id, name, brand, description, price_per_unit, unit_type, weight_volume, current_stock, minimum_alert_stock, image_url, discount_tier_qty, discount_tier_percent, status, category_id, categories(name, unit_types)';

/**
 * GET /api/products
 * query: ?category=catId  ?q=text  ?status=active|all
 * Live stock status fields are computed here for the storefront.
 */
router.get('/', asyncHandler(async (req, res) => {
  const { category, q, status } = req.query;

  let query = serviceClient.from('products').select(PRODUCT_SELECT);
  if (category) query = query.eq('category_id', category);
  if (status && status !== 'all') query = query.eq('status', status);
  else if (!status) query = query.eq('status', 'active');
  if (q) query = query.ilike('name', `%${q}%`);

  const { data, error } = await query.order('name');
  if (error) throw AppError(error.message);

  const rows = decorateStock(data || []);
  res.json({ data: rows });
}));

/** Attach storefront-friendly stock + tier helpers. */
function decorateStock(rows) {
  return rows.map((p) => {
    const stock = Number(p.current_stock);
    const min = Number(p.minimum_alert_stock || 0);
    return {
      ...p,
      stock_status: stock <= 0 ? 'out_of_stock' : stock < min ? 'low' : 'in_stock',
      in_stock: stock > 0,
      category: p.categories?.name || null,
      category_unit_types: p.categories?.unit_types || [],
    };
  });
}

/** GET /api/products/:id */
router.get('/:id', asyncHandler(async (req, res) => {
  const { data, error } = await serviceClient
    .from('products')
    .select(PRODUCT_SELECT)
    .eq('id', req.params.id)
    .single();
  if (error) throw AppError(error.message, 404);
  res.json({ data: decorateStock([data])[0] });
}));

module.exports = router;