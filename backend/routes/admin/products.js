const { Router } = require('express');
const { serviceClient } = require('../../config/supabase');
const { asyncHandler, AppError } = require('../../middleware/error');

const router = Router();

const FIELDS = [
  'category_id', 'name', 'brand', 'description', 'price_per_unit', 'unit_type',
  'weight_volume', 'minimum_alert_stock', 'image_url',
  'discount_tier_qty', 'discount_tier_percent', 'status',
];

/**
 * POST /api/admin/products
 * body: { category_id, name, brand?, price_per_unit, unit_type, minimum_alert_stock?,
 *         image_url?, discount_tier_qty?, discount_tier_percent?, opening_stock? }
 * opening_stock (if given) writes a ledger IN row so current_stock is set through the trigger.
 */
router.post('/', asyncHandler(async (req, res) => {
  const b = req.body;
  if (!b.category_id || !b.name || b.price_per_unit == null || !b.unit_type) {
    throw AppError('category_id, name, price_per_unit and unit_type are required.');
  }

  const payload = {};
  for (const f of FIELDS) if (b[f] !== undefined) payload[f] = b[f];
  payload.status = payload.status ?? 'active';
  payload.minimum_alert_stock = payload.minimum_alert_stock ?? 0;

  const { data: product, error } = await serviceClient.from('products').insert(payload).select('*').single();
  if (error) throw AppError('Failed to create product: ' + error.message);

  if (b.opening_stock > 0) {
    const { error: txErr } = await serviceClient.rpc('receive_stock', {
      p_product_id: product.id,
      p_quantity: Number(b.opening_stock),
      p_supplier: b.supplier_name || 'Opening Stock',
      p_notes: 'Opening stock on product creation',
    });
    if (txErr) console.warn('opening stock note:', txErr.message);
  }

  res.status(201).json({ data: product });
}));

/** PATCH /api/admin/products/:id */
router.patch('/:id', asyncHandler(async (req, res) => {
  const patch = {};
  for (const f of FIELDS) if (req.body[f] !== undefined) patch[f] = req.body[f];
  if (Object.keys(patch).length === 0) throw AppError('Nothing to update.');

  const { data, error } = await serviceClient.from('products').update(patch).eq('id', req.params.id).select('*').single();
  if (error) throw AppError('Failed to update product: ' + error.message);
  res.json({ data });
}));

/** DELETE /api/admin/products/:id */
router.delete('/:id', asyncHandler(async (req, res) => {
  const { error } = await serviceClient.from('products').delete().eq('id', req.params.id);
  if (error) throw AppError('Failed to delete product: ' + error.message);
  res.status(204).end();
}));

module.exports = router;