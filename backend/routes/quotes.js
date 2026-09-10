const { Router } = require('express');
const { serviceClient } = require('../config/supabase');
const { asyncHandler, AppError } = require('../middleware/error');
const { buildPricing } = require('../services/pricing');
const { estimateFreight } = require('../services/freight');
const { sendQuoteEmail } = require('../services/email');

const router = Router();

/**
 * POST /api/quotes
 * Customer requests a printable official quotation BEFORE paying advance.
 * body: { customer_name, customer_email?, customer_phone, delivery_address, pincode?, items: [{product_id, quantity}] }
 * Returns quotation number + downloadable-URL segment.
 */
router.post('/', asyncHandler(async (req, res) => {
  const b = req.body;
  if (!b.customer_name || !b.customer_phone) throw AppError('Customer name and phone are required.');
  if (!Array.isArray(b.items) || b.items.length === 0) throw AppError('Add at least one item to the quotation.');

  const ids = b.items.map((i) => i.product_id);
  const quantities = Object.fromEntries(b.items.map((i) => [i.product_id, Number(i.quantity)]));

  const { data: products, error } = await serviceClient
    .from('products')
    .select('id, name, brand, price_per_unit, unit_type, current_stock, discount_tier_qty, discount_tier_percent, status')
    .in('id', ids);

  if (error) throw AppError(error.message);
  if (!products || products.length !== ids.length) throw AppError('One or more products not found.');

  const freight = await estimateFreight(b.pincode);
  const pricing = buildPricing(
    products.map((p) => ({ product: p, quantity: quantities[p.id] })),
    b.pincode,
    freight
  );

  const { data: qNum } = await serviceClient.rpc('next_number', { p_kind: 'quotation' });
  const quotationNumber = qNum || `QT-${Date.now()}`;

  const itemsSnap = pricing.items.map(({ product_id, product_name, brand, unit_type, quantity, unit_price, unit_price_effective, discount_percent, subtotal }) => ({
    product_id, product_name, brand, unit_type, quantity, unit_price, unit_price_effective, discount_percent, subtotal,
  }));

  const customerMeta = {
    customer_name: b.customer_name,
    customer_email: String(b.customer_email || b.email || '').trim() || null,
    customer_phone: b.customer_phone,
    delivery_address: b.delivery_address,
    landmark: b.landmark,
    pincode: b.pincode,
    delivery_date: b.delivery_date,
    delivery_slot: b.delivery_slot,
  };

  const { data: quote, error: qErr } = await serviceClient.from('invoices').insert({
    invoice_number: quotationNumber,
    invoice_type: 'QUOTATION',
    amount: pricing.total_amount,
    advance_paid: 0,
    balance_due: pricing.total_amount,
    items_snapshot: itemsSnap,
    customer_meta: customerMeta,
    billing: {
      item_subtotal: pricing.item_subtotal,
      discount_amount: pricing.discount_amount,
      gst_rate: pricing.gst_rate,
      gst_amount: pricing.gst_amount,
      freight_charge: pricing.freight_charge,
      total_amount: pricing.total_amount,
    },
  }).select('id, invoice_number, amount').single();

  if (qErr) throw AppError('Failed to save quotation: ' + qErr.message);

  // Fire-and-forget owner notification (logs instead of throwing).
  sendQuoteEmail(quotationNumber, pricing.items, customerMeta)
    .then((r) => {
      if (r && !r.ok) console.error(`[email] ${r.message} (quotation ${quotationNumber})`);
    })
    .catch((e) => {
      console.error('[email] unexpected failure while notifying about quotation', quotationNumber, e.message);
    });

  res.status(201).json({
    success: true,
    data: {
      quotation_number: quotationNumber,
      quotation_id: quote.id,
      pricing_summary: {
        item_subtotal: pricing.item_subtotal,
        discount_amount: pricing.discount_amount,
        gst_amount: pricing.gst_amount,
        freight_charge: pricing.freight_charge,
        total_amount: pricing.total_amount,
      },
      download_url: `/api/invoices/quotation/${quotationNumber}?phone=${encodeURIComponent(b.customer_phone)}`,
    },
  });
}));

module.exports = router;