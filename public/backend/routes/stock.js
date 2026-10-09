const { Router } = require('express');
const { serviceClient } = require('../config/supabase');
const { asyncHandler, AppError } = require('../middleware/error');

const router = Router();

/**
 * GET /api/stock
 * Public live stock snapshot used by storefront badges & mini-widgets.
 * ?product_id=uuid to filter a single product.
 */
router.get('/', asyncHandler(async (req, res) => {
  const { product_id } = req.query;
  let query = serviceClient
    .from('products')
    .select('id, name, unit_type, current_stock, minimum_alert_stock, status, categories(name)')
    .eq('status', 'active');

  if (product_id) query = query.eq('id', product_id);

  const { data, error } = await query.order('name');
  if (error) throw AppError(error.message, 500);

  const rows = (data || []).map((p) => {
    const stock = Number(p.current_stock);
    const min = Number(p.minimum_alert_stock || 0);
    return {
      product_id: p.id,
      name: p.name,
      unit_type: p.unit_type,
      current_stock: stock,
      minimum_alert_stock: min,
      stock_status: stock <= 0 ? 'out_of_stock' : stock < min ? 'low' : 'in_stock',
      message:
        stock <= 0 ? 'Out of stock'
        : stock < min && min > 0 ? `Only ${stock} ${p.unit_type} left`
        : 'In stock',
    };
  });

  res.json({ data: rows });
}));

module.exports = router;