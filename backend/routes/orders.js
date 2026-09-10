const { Router } = require('express');
const { serviceClient } = require('../config/supabase');
const { asyncHandler, AppError } = require('../middleware/error');
const { buildPricing, round2 } = require('../services/pricing');
const { estimateFreight } = require('../services/freight');
const { sendOrderEmails } = require('../services/email');
const { buildInvoicePdf } = require('../services/invoicePdf');
const { ensureCustomerEmailColumn } = require('../services/schema');

const router = Router();

const ORDER_SELECT_WITH_EMAIL =
  'id, order_number, customer_name, customer_email, customer_phone, delivery_address, landmark, pincode, delivery_date, delivery_slot, notes, item_subtotal, discount_amount, gst_amount, gst_rate, freight_charge, total_amount, advance_mode, advance_percent, advance_paid, balance_due, payment_status, order_status, vehicle_number, driver_contact, created_at, order_items(*)';

const ORDER_SELECT_NO_EMAIL = ORDER_SELECT_WITH_EMAIL.replace(', customer_email', '');

function nextNumber(kind) {
  return serviceClient.rpc('next_number', { p_kind: kind });
}

/**
 * Detect once (per process) whether the live DB has the customer_email column.
 * On first use we also attempt to auto-ALTER it on, then degrade gracefully
 * so order placement never fails with "Could not find the 'customer_email' column".
 */
let hasCustomerEmailCache = null;
async function ordersHasEmailColumn() {
  if (hasCustomerEmailCache != null) return hasCustomerEmailCache;
  const { present } = await ensureCustomerEmailColumn();
  hasCustomerEmailCache = present;
  return present;
}

/**
 * POST /api/orders
 * Public: place a bulk material order.
 * body: {
 *   customer_name, customer_email?, customer_phone, delivery_address, landmark?, pincode?, delivery_date, delivery_slot?,
 *   advance_mode: 'percent'|'full'|'none', advance_percent?, notes?,
 *   items: [{ product_id, quantity }]
 * }
 */
router.post('/', asyncHandler(async (req, res) => {
  const b = req.body;

  if (!b.customer_name || !b.customer_phone || !b.delivery_address) {
    throw AppError('customer_name, customer_phone and delivery_address are required.');
  }
  if (!Array.isArray(b.items) || b.items.length === 0) {
    throw AppError('At least one order item is required.');
  }

  // Fetch products being ordered and line up pricing.
  const ids = b.items.map((i) => i.product_id);
  const quantities = Object.fromEntries(b.items.map((i) => [i.product_id, Number(i.quantity)]));
  for (const i of b.items) {
    if (!Number.isFinite(quantities[i.product_id]) || quantities[i.product_id] <= 0) {
      throw AppError(`Invalid quantity for product ${i.product_id}`);
    }
  }

  const { data: products, error: pErr } = await serviceClient
    .from('products')
    .select('id, name, brand, price_per_unit, unit_type, current_stock, discount_tier_qty, discount_tier_percent, status')
    .in('id', ids);

  if (pErr) throw AppError(pErr.message);
  if (!products || products.length !== ids.length) {
    throw AppError('One or more products were not found.');
  }

  // Availability guard: reject overselling beyond current stock.
  for (const p of products) {
    const qty = quantities[p.id];
    if (Number(p.current_stock) < qty) {
      throw AppError(
        `Only ${Number(p.current_stock)} ${p.unit_type} of "${p.name}" available. Reduce quantity or order again later.`
      );
    }
  }

  const freight = await estimateFreight(b.pincode);
  const pricing = buildPricing(
    products.map((p) => ({ product: p, quantity: quantities[p.id] })),
    b.pincode,
    freight
  );

  const advanceMode = ['percent', 'full', 'none'].includes(b.advance_mode) ? b.advance_mode : 'percent';
  const advancePercent = b.advance_percent || (advanceMode === 'percent' ? 20 : null);
  const advanceDue =
    advanceMode === 'full' ? pricing.total_amount : advanceMode === 'none' ? 0 : round2((pricing.total_amount * advancePercent) / 100);

  const [{ data: orderNumberData }, { data: invoiceNumberData }] = await Promise.all([nextNumber('order'), nextNumber('invoice')]);
  const on = orderNumberData || `ORD-${Date.now()}`;
  const inv = invoiceNumberData || `INV-${Date.now()}`;

  const hasEmailCol = await ordersHasEmailColumn();

  const orderPayload = {
    order_number: on,
    customer_name: String(b.customer_name).trim(),
    customer_phone: String(b.customer_phone).trim(),
    delivery_address: String(b.delivery_address).trim(),
    landmark: b.landmark || null,
    pincode: b.pincode || null,
    delivery_date: b.delivery_date || null,
    delivery_slot: b.delivery_slot || null,
    notes: b.notes || null,
    item_subtotal: pricing.item_subtotal,
    discount_amount: pricing.discount_amount,
    gst_rate: pricing.gst_rate,
    gst_amount: pricing.gst_amount,
    freight_charge: pricing.freight_charge,
    total_amount: pricing.total_amount,
    advance_mode: advanceMode,
    advance_percent: advanceMode === 'percent' ? advancePercent : null,
    advance_paid: 0,
    balance_due: pricing.total_amount,
    payment_status: 'unpaid',
    order_status: 'pending_payment',
  };

  const customerEmail = String(b.customer_email || b.email || '').trim() || null;
  if (hasEmailCol) {
    orderPayload.customer_email = customerEmail;
  }

  const { data: order, error: oErr } = await serviceClient
    .from('orders')
    .insert(orderPayload)
    .select(hasEmailCol ? ORDER_SELECT_WITH_EMAIL : ORDER_SELECT_NO_EMAIL)
    .single();
  if (oErr) throw AppError(oErr.message);

  const itemsToInsert = pricing.items.map((it) => ({ order_id: order.id, ...it }));
  const { error: iErr } = await serviceClient.from('order_items').insert(itemsToInsert);
  if (iErr) throw AppError('Failed to save order items: ' + iErr.message);

  const { error: vErr } = await serviceClient.from('invoices').insert({
    order_id: order.id,
    invoice_number: inv,
    invoice_type: 'INVOICE',
    amount: pricing.total_amount,
    advance_paid: 0,
    balance_due: pricing.total_amount,
  });
  if (vErr) throw AppError('Failed to create invoice: ' + vErr.message);

  // Fire-and-forget: build the PDF invoice and email it (with attachment) to
  // BOTH the owner and the customer. Never blocks the response or fails the
  // order — any error here is caught and logged.
  const orderForEmail = { ...order, customer_email: customerEmail };
  setImmediate(() => {
    (async () => {
      try {
        const pdfBuffer = await buildInvoicePdf({ order: orderForEmail, items: pricing.items });
        await sendOrderEmails({ order: orderForEmail, items: pricing.items, pdfBuffer });
      } catch (e) {
        console.error('[email] order invoice pipeline failed:', e.message);
      }
    })();
  });

  res.status(201).json({
    success: true,
    data: {
      order,
      invoice_number: inv,
      advance_due: advanceDue,
      advance_mode: advanceMode,
      pricing_summary: {
        item_subtotal: pricing.item_subtotal,
        discount_amount: pricing.discount_amount,
        gst_amount: pricing.gst_amount,
        freight_charge: pricing.freight_charge,
        total_amount: pricing.total_amount,
      },
    },
  });
}));

/**
 * GET /api/orders/:orderNumber/status?phone=number
 * Public order tracking by order number + customer phone.
 */
router.get('/:orderNumber/status', asyncHandler(async (req, res) => {
  const { phone } = req.query;
  const hasEmail = await ordersHasEmailColumn();
  const select = [
    'id', 'order_number', 'customer_name', 'customer_phone', 'delivery_address',
    'landmark', 'pincode',
    ...(hasEmail ? ['customer_email'] : []),
    'delivery_date', 'delivery_slot', 'gst_rate', 'item_subtotal', 'discount_amount',
    'gst_amount', 'freight_charge', 'total_amount', 'advance_paid', 'balance_due',
    'payment_status', 'order_status', 'vehicle_number', 'driver_contact', 'created_at',
    'order_items(*)',
  ].join(', ');

  const { data, error } = await serviceClient
    .from('orders')
    .select(select)
    .eq('order_number', req.params.orderNumber)
    .eq('customer_phone', phone || '')
    .single();

  if (error) throw AppError('Order not found. Check the order number and phone.', 404);
  res.json({ data });
}));

module.exports = router;