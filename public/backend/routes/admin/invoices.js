const { Router } = require('express');
const { serviceClient } = require('../../config/supabase');
const { asyncHandler, AppError } = require('../../middleware/error');
const { renderOrderPdf } = require('../../services/invoice');

const router = Router();

/**
 * GET /api/admin/invoices/:orderId?doc=invoice|receipt
 * Render the printable PDF for any order (admin-side access).
 */
router.get('/:orderId', asyncHandler(async (req, res) => {
  const { data: order, error } = await serviceClient
    .from('orders')
    .select('id, order_number, customer_name, customer_phone, delivery_address, landmark, pincode, delivery_date, delivery_slot, notes, item_subtotal, discount_amount, gst_amount, gst_rate, freight_charge, total_amount, advance_paid, balance_due, vehicle_number, driver_contact, order_items(*)')
    .eq('id', req.params.orderId)
    .single();

  if (error || !order) throw AppError('Order not found.', 404);

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

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${order.order_number}-${docType}.pdf"`);
  res.send(buffer);
}));

module.exports = router;