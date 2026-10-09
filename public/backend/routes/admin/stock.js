const { Router } = require('express');
const { serviceClient } = require('../../config/supabase');
const { asyncHandler, AppError } = require('../../middleware/error');

const router = Router();

/**
 * POST /api/admin/stock/receive
 * Stock In / procurement log.
 * body: { product_id, quantity, supplier?, notes?, date? }
 */
router.post('/receive', asyncHandler(async (req, res) => {
  const { product_id, quantity, supplier, notes, date } = req.body;
  if (!product_id || !(Number(quantity) > 0)) throw AppError('product_id and a positive quantity are required.');

  const { data: tx, error } = await serviceClient.rpc('receive_stock', {
    p_product_id: product_id,
    p_quantity: Number(quantity),
    p_supplier: supplier || null,
    p_notes: notes || null,
    p_date: date || null,
  });
  if (error) throw AppError('Failed to receive stock: ' + error.message);

  // Re-read the product's fresh balance (the trigger already synced it).
  const { data: product } = await serviceClient.from('products').select('id, name, unit_type, current_stock').eq('id', product_id).single();
  res.status(201).json({ data: { transaction: tx, product } });
}));

/**
 * POST /api/admin/stock/adjust
 * Corrective stock adjustment (manual ledger write with ADJUSTMENT type).
 * body: { product_id, delta, stock, notes? }  delta is signed.
 */
router.post('/adjust', asyncHandler(async (req, res) => {
  const { product_id, delta, notes } = req.body;
  const d = Number(delta);
  if (!product_id || !Number.isFinite(d) || d === 0) throw AppError('product_id and a non-zero signed delta are required.');

  const { data: tx, error } = await serviceClient.from('stock_transactions').insert({
    product_id,
    type: 'ADJUSTMENT',
    quantity: d,
    notes: notes || 'Manual adjustment',
    supplier_or_order_ref: 'ADJUST',
  }).select('*').single();
  if (error) throw AppError('Adjustment failed: ' + error.message);

  const { data: product } = await serviceClient.from('products').select('id, name, unit_type, current_stock').eq('id', product_id).single();
  res.json({ data: { transaction: tx, product } });
}));

/**
 * GET /api/admin/stock/ledger?product_id=&type=&limit=
 * Full stock ledger with product join.
 */
router.get('/ledger', asyncHandler(async (req, res) => {
  const { product_id, type } = req.query;
  const limit = Math.min(Number(req.query.limit) || 200, 1000);

  let query = serviceClient
    .from('stock_transactions')
    .select('id, product_id, type, quantity, supplier_or_order_ref, notes, tx_date, created_at, products(name, unit_type)')
    .order('created_at', { ascending: false })
    .order('tx_date', { ascending: false })
    .limit(limit);

  if (product_id) query = query.eq('product_id', product_id);
  if (type) query = query.eq('type', type);

  const { data, error } = await query;
  if (error) throw AppError('Failed to load stock ledger: ' + error.message);

  res.json({ data: data || [] });
}));

/**
 * GET /api/admin/stock/summary
 * Current balances for every product (admin inventory screen).
 */
router.get('/summary', asyncHandler(async (req, res) => {
  const { data, error } = await serviceClient
    .from('products')
    .select('id, name, brand, unit_type, current_stock, minimum_alert_stock, status, categories(name)')
    .order('name');

  if (error) throw AppError('Failed to load stock summary: ' + error.message);

  const rows = (data || []).map((p) => {
    const stock = Number(p.current_stock);
    const min = Number(p.minimum_alert_stock || 0);
    return {
      ...p,
      category: p.categories?.name,
      health: stock <= 0 ? 'out_of_stock' : stock < min ? 'low' : 'healthy',
    };
  });

  res.json({ data: rows });
}));

module.exports = router;