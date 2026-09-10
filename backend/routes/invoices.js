const { Router } = require('express');
const { serviceClient } = require('../config/supabase');
const { asyncHandler, AppError } = require('../middleware/error');
const { renderOrderPdf } = require('../services/invoice');

const router = Router();

function pdfResponse(res, buffer, filename) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  res.send(buffer);
}

/** Load order + its items for PDF rendering. */
async function loadOrderContext(orderNumber, phone) {
  const { data: order, error } = await serviceClient
    .from('orders')
    .select('id, order_number, customer_name, customer_phone, delivery_address, landmark, pincode, delivery_date, delivery_slot, notes, item_subtotal, discount_amount, gst_amount, freight_charge, total_amount, gst_rate, advance_paid, balance_due, vehicle_number, driver_contact, order_items(*)')
    .eq('order_number', orderNumber)
    .eq('customer_phone', phone || '')
    .single();

  if (error) throw AppError('Invoice not found for this order + phone.', 404);
  return order;
}

/**
 * GET /api/invoices/order/:orderNumber?phone=xxx&doc=invoice|receipt
 * Access controlled by (order_number + customer phone) — BOTH must match.
 */
router.get('/order/:orderNumber', asyncHandler(async (req, res) => {
  const order = await loadOrderContext(req.params.orderNumber, req.query.phone);
  const docType = req.query.doc === 'receipt' ? 'RECEIPT' : 'INVOICE';

  const buffer = await renderOrderPdf({
    type: docType,
    invoice_number: `${order.order_number}-${docType === 'RECEIPT' ? 'RCPT' : 'INV'}`,
    created_at: order.created_at,
    customer_name: order.customer_name,
    customer_phone: order.customer_phone,
    delivery_address: order.delivery_address,
    landmark: order.landmark,
    pincode: order.pincode,
    delivery_date: order.delivery_date,
    delivery_slot: order.delivery_slot,
    order_number: order.order_number,
    vehicle_number: order.vehicle_number,
    items: order.order_items,
    item_subtotal: order.item_subtotal,
    discount_amount: order.discount_amount,
    gst_rate: order.gst_rate,
    gst_amount: order.gst_amount,
    freight_charge: order.freight_charge,
    total_amount: order.total_amount,
    advance_paid: order.advance_paid,
    balance_due: order.balance_due,
  });

  pdfResponse(res, buffer, `${order.order_number}-${docType}.pdf`);
}));

/**
 * GET /api/invoices/quotation/:number?phone=xxx
 * Access controlled by quotation number + phone recorded at request time.
 */
router.get('/quotation/:number', asyncHandler(async (req, res) => {
  const { data: quote, error } = await serviceClient
    .from('invoices')
    .select('invoice_number, invoice_type, items_snapshot, customer_meta, created_at, amount, advance_paid, balance_due')
    .eq('invoice_number', req.params.number)
    .eq('invoice_type', 'QUOTATION')
    .single();

  if (error || !quote?.customer_meta) throw AppError('Quotation not found.', 404);
  const meta = quote.customer_meta;
  if (String(meta.customer_phone).trim() !== String(req.query.phone).trim()) {
    throw AppError('Phone does not match quotation.', 403);
  }

  const bill = quote.billing || {};
  const itemSubtotal = Number(bill.item_subtotal ?? (quote.items_snapshot || []).reduce((s, i) => s + Number(i.subtotal), 0));
  const discountAmount = Number(bill.discount_amount ?? 0);
  const freightCharge = Number(bill.freight_charge ?? 0);
  const gstRate = Number(bill.gst_rate ?? 18);
  const gstAmount = Number(bill.gst_amount ?? Math.max(quote.amount - itemSubtotal - freightCharge, 0));

  const buffer = await renderOrderPdf({
    type: 'QUOTATION',
    invoice_number: quote.invoice_number,
    created_at: quote.created_at,
    customer_name: meta.customer_name,
    customer_phone: meta.customer_phone,
    delivery_address: meta.delivery_address,
    landmark: meta.landmark,
    pincode: meta.pincode,
    delivery_date: meta.delivery_date,
    delivery_slot: meta.delivery_slot,
    vehicle_number: null,
    items: quote.items_snapshot || [],
    item_subtotal: itemSubtotal,
    discount_amount: discountAmount,
    gst_rate: gstRate,
    gst_amount: gstAmount,
    freight_charge: freightCharge,
    total_amount: quote.amount,
    advance_paid: quote.advance_paid,
    balance_due: quote.balance_due,
  });

  pdfResponse(res, buffer, `${quote.invoice_number}.pdf`);
}));

module.exports = router;