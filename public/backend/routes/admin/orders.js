const { Router } = require('express');
const { serviceClient } = require('../../config/supabase');
const { asyncHandler, AppError } = require('../../middleware/error');
const { round2 } = require('../../services/pricing');

const router = Router();

const DETAIL_SELECT =
  'id, order_number, customer_name, customer_phone, delivery_address, landmark, pincode, delivery_date, delivery_slot, notes, item_subtotal, discount_amount, gst_amount, gst_rate, freight_charge, total_amount, advance_mode, advance_percent, advance_paid, balance_due, payment_status, order_status, vehicle_number, driver_contact, created_at, order_items(*)';

/**
 * GET /api/admin/orders?status=&q=
 * List all orders (any status) with optional filters.
 */
router.get('/', asyncHandler(async (req, res) => {
  const { status, q } = req.query;
  let query = serviceClient.from('orders').select(DETAIL_SELECT).order('created_at', { ascending: false }).limit(300);

  if (status && status !== 'all') query = query.eq('order_status', status);
  if (q) {
    query = query.or(`customer_name.ilike.%${q}%,order_number.ilike.%${q}%,customer_phone.ilike.%${q}%`);
  }

  const { data, error } = await query;
  if (error) throw AppError('Failed to load orders: ' + error.message);
  res.json({ data: data || [] });
}));

/** GET /api/admin/orders/:id — full detail */
router.get('/:id', asyncHandler(async (req, res) => {
  const { data, error } = await serviceClient.from('orders').select(DETAIL_SELECT).eq('id', req.params.id).single();
  if (error) throw AppError('Order not found.', 404);
  res.json({ data });
}));

/**
 * POST /api/admin/orders/:id/advance
 * Record an advance payment -> status becomes 'advance_paid'.
 * body: { amount }
 */
router.post('/:id/advance', asyncHandler(async (req, res) => {
  const amount = round2(Number(req.body.amount));
  if (!Number.isFinite(amount) || amount <= 0) throw AppError('Valid advance amount required.');

  const { data: order, error: oErr } = await serviceClient
    .from('orders').select('id, advance_paid, total_amount, order_status').eq('id', req.params.id).single();
  if (oErr) throw AppError('Order not found.', 404);
  if (order.order_status === 'cancelled') throw AppError('Cancelled orders cannot receive payments.');

  const newAdvance = round2(order.advance_paid + amount);
  const balance = round2(Math.max(order.total_amount - newAdvance, 0));
  const paymentStatus = balance <= 0 ? 'paid' : 'partial';

  const { data, error } = await serviceClient
    .from('orders')
    .update({ advance_paid: newAdvance, balance_due: balance, payment_status: paymentStatus, order_status: 'advance_paid' })
    .eq('id', req.params.id)
    .select(DETAIL_SELECT)
    .single();
  if (error) throw AppError('Failed to record advance: ' + error.message);
  res.json({ data });
}));

/**
 * POST /api/admin/orders/:id/dispatch
 * One-click dispatch approval. DEDUCTS stock automatically (guard rails in SQL).
 * body: { vehicle_number?, driver_contact? }
 */
router.post('/:id/dispatch', asyncHandler(async (req, res) => {
  const { vehicle_number, driver_contact } = req.body || {};
  const { data, error } = await serviceClient.rpc('dispatch_order', {
    p_order_id: req.params.id,
    p_vehicle: vehicle_number || null,
    p_driver: driver_contact || null,
  });
  if (error) throw AppError('Dispatch failed: ' + error.message);
  res.json({ data });
}));

/**
 * POST /api/admin/orders/:id/deliver
 * Mark delivered, optionally collecting the balance.
 * body: { balance_collected? }
 */
router.post('/:id/deliver', asyncHandler(async (req, res) => {
  const collected = round2(Number(req.body.balance_collected) || 0);
  const { data, error } = await serviceClient.rpc('complete_delivery', {
    p_order_id: req.params.id,
    p_balance_collected: collected,
  });
  if (error) throw AppError('Failed to complete delivery: ' + error.message);
  res.json({ data });
}));

/**
 * POST /api/admin/orders/:id/cancel
 * Cancels; restocks automatically if the order had been dispatched.
 * body: { reason? }
 */
router.post('/:id/cancel', asyncHandler(async (req, res) => {
  const { reason } = req.body || {};
  const { data, error } = await serviceClient.rpc('cancel_order', { p_order_id: req.params.id, p_reason: reason || null });
  if (error) throw AppError('Cancel failed: ' + error.message);
  res.json({ data });
}));

/**
 * PATCH /api/admin/orders/:id
 * Loose update for fleet tracking fields.
 */
router.patch('/:id', asyncHandler(async (req, res) => {
  const patch = {};
  for (const k of ['vehicle_number', 'driver_contact', 'notes', 'delivery_date', 'delivery_slot']) {
    if (req.body[k] !== undefined) patch[k] = req.body[k];
  }
  if (Object.keys(patch).length === 0) throw AppError('Nothing to update.');

  const { data, error } = await serviceClient.from('orders').update(patch).eq('id', req.params.id).select(DETAIL_SELECT).single();
  if (error) throw AppError('Failed to update order: ' + error.message);
  res.json({ data });
}));

module.exports = router;