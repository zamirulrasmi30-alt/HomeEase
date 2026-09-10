const PDFDocument = require('pdfkit');

const money = (n) =>
  'Rs. ' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const qty = (n) => {
  const v = Number(n || 0);
  return v % 1 === 0 ? v.toLocaleString('en-IN') : v.toLocaleString('en-IN', { maximumFractionDigits: 3 });
};

const fmtDate = (iso) => {
  const d = new Date(iso || Date.now());
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

function buildInvoicePdf({ order, items = [] }) {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const W = doc.page.width - 80; // usable width (A4 595.28 → 515)
  const GREEN = '#14532d';
  const SLATE = '#475569';
  const rowH = 22;

  // Header band
  doc.rect(0, 0, doc.page.width, 86).fill(GREEN);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(20).text('BuildSupply ERP', 40, 28);
  doc.font('Helvetica').fontSize(9).fillColor('#D6E2D6').text('Construction Materials · E-Commerce & ERP', 40, 56);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(15).text('INVOICE', doc.page.width - 40, 28, { align: 'right' });
  doc.font('Helvetica').fontSize(10);
  doc.text(`Invoice No: ${order.order_number || '—'}`, doc.page.width - 40, 54, { align: 'right' });
  doc.text(`Date: ${fmtDate(order.created_at)}`, doc.page.width - 40, 68, { align: 'right' });

  // Billed to
  let y = 112;
  doc.fillColor(SLATE).font('Helvetica-Bold').fontSize(10).text('BILLED TO', 40, y);
  y += 20;
  doc.fillColor('#1f2937').font('Helvetica-Bold').fontSize(13).text(String(order.customer_name || 'Customer'), 40, y);
  y += 18;
  doc.fillColor(SLATE).font('Helvetica').fontSize(10);
  [
    order.customer_email ? `Email   : ${order.customer_email}` : null,
    `Phone   : ${order.customer_phone || '—'}`,
    `Address : ${order.delivery_address || '—'}${order.landmark ? `, ${order.landmark}` : ''}${order.pincode ? ` — ${order.pincode}` : ''}`,
  ].filter(Boolean).forEach((line) => {
    doc.text(line, 40, y);
    y += 14;
  });

  // Items table
  y += 12;
  const cols = [
    { x: 40, w: 30, label: '#', align: 'center' },
    { x: 70, w: 235, label: 'Item' },
    { x: 305, w: 70, label: 'Qty', align: 'right' },
    { x: 375, w: 90, label: 'Unit Price', align: 'right' },
    { x: 465, w: 90, label: 'Total', align: 'right' },
  ];

  doc.rect(40, y, W, rowH).fill(GREEN);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9);
  cols.forEach((c) => doc.text(c.label, c.x, y + 7, { width: c.w, align: c.align || 'left' }));
  y += rowH;

  doc.font('Helvetica').fontSize(9);
  (items || []).forEach((it, i) => {
    if (i % 2 === 1) doc.rect(40, y, W, rowH).fill('#f5f8f5');
    doc.fillColor('#1f2937');
    doc.text(String(i + 1), 40, y + 7, { width: 30, align: 'center' });
    doc.text(`${it.product_name || '—'}${it.brand ? ` (${it.brand})` : ''}`, 70, y + 7, { width: 235 });
    doc.text(`${qty(it.quantity)} ${it.unit_type || ''}`.trim(), 305, y + 7, { width: 70, align: 'right' });
    doc.text(money(it.unit_price_effective), 375, y + 7, { width: 90, align: 'right' });
    doc.text(money(it.subtotal), 465, y + 7, { width: 90, align: 'right' });
    y += rowH;
  });
  doc.moveTo(40, y).lineTo(40 + W, y).lineWidth(0.7).strokeColor('#e2e8f0').stroke();

  // Summary
  const right = 40 + W;
  y += 18;
  doc.fillColor(SLATE).font('Helvetica').fontSize(10);
  [
    ['Item Subtotal', money(order.item_subtotal)],
    ...(Number(order.discount_amount) > 0 ? [['Bulk Discount', '− ' + money(order.discount_amount)]] : []),
    ...(Number(order.gst_amount) > 0 ? [[`GST @ ${order.gst_rate ?? 18}%`, money(order.gst_amount)]] : []),
    ['Freight', money(order.freight_charge)],
  ].forEach(([label, value]) => {
    doc.text(label, 40, y);
    doc.text(value, right, y, { align: 'right' });
    y += 16;
  });

  y += 4;
  doc.moveTo(40, y - 8).lineTo(right, y - 8).lineWidth(1.1).strokeColor(GREEN).stroke();
  doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(12).text('Grand Total', 40, y);
  doc.text(money(order.total_amount), right, y, { align: 'right' });

  // Footer
  y += 24;
  doc.moveTo(40, y).lineTo(right, y).lineWidth(0.6).strokeColor('#e2e8f0').stroke();
  y += 26;
  doc.fillColor('#1f2937').font('Helvetica-Bold').fontSize(10).text(`Payment Status: ${String(order.payment_status || '').replace(/_/g, ' ')}`, 40, y);
  doc.fillColor(SLATE).font('Helvetica').fontSize(9);
  doc.text(`Advance paid: ${money(order.advance_paid)} · Balance on delivery: ${money(order.balance_due)}`, 40, y + 14);
  doc.text('Thank you for your business with BuildSupply ERP.', 40, y + 44);

  doc.end();
  return done;
}

module.exports = { buildInvoicePdf };