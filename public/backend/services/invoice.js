const PDFDocument = require('pdfkit');
const config = require('../config');
const { round2 } = require('./pricing');

const inr = (n) =>
  '₹ ' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Render a printable PDF for a quotation / invoice / delivery receipt.
 *
 * @param {object} data - order, items, invoice metadata
 * @param {'QUOTATION'|'INVOICE'|'RECEIPT'} data.type
 * @returns {Promise<Buffer>}
 */
function renderOrderPdf(data) {
  const doc = new PDFDocument({ size: 'A4', margin: 46 });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));

  const type = data.type || 'INVOICE';

  return new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header band
    doc.rect(0, 0, doc.page.width, 110).fill('#1e293b');
    doc.fill('#ffffff').font('Helvetica-Bold').fontSize(20);
    doc.text('BUILDSUPPLY Materials & Trading Co.', 46, 26);
    doc.font('Helvetica').fontSize(9).fill('#cbd5e1');
    doc.text('20 Industrial Estate, Hosur Road, Chennai 600 044', 46, 52);
    doc.text('GSTIN: 33AABCB1122K1Z5  |  Ph: +91 98400 12345  |  orders@buildsupply.in', 46, 65);

    const typeTitle = type === 'QUOTATION' ? 'PRICE QUOTATION' : type === 'RECEIPT' ? 'PAYMENT RECEIPT' : 'TAX INVOICE';
    doc.font('Helvetica-Bold').fontSize(15).fill('#15803d');
    doc.text(typeTitle, doc.page.width - 220, 32, { width: 175, align: 'right' });
    doc.fill('#475569').font('Helvetica').fontSize(9).text(data.invoice_number, doc.page.width - 220, 52, { width: 175, align: 'right' });
    doc.fill('#64748b').fontSize(8).text(new Date(data.created_at || Date.now()).toLocaleDateString('en-IN'), doc.page.width - 220, 66, { width: 175, align: 'right' });

    // Customer block
    doc.fill('#0f172a').font('Helvetica-Bold').fontSize(10).text('BILL TO');
    doc.font('Helvetica').fontSize(9.5).fill('#334155');
    doc.text(data.customer_name, 46, 132);
    doc.text('Phone: ' + data.customer_phone, 46, 147);
    doc.text((data.delivery_address || '') + (data.landmark ? ', ' + data.landmark : ''), 46, 162, { width: 320 });
    if (data.pincode) doc.text('Pincode: ' + data.pincode, 46, 178);

    if (data.delivery_date || data.order_number) {
      doc.font('Helvetica-Bold').fontSize(10).fill('#0f172a').text('ORDER / DELIVERY', doc.page.width - 250, 132);
      doc.font('Helvetica').fontSize(9.5).fill('#334155');
      if (data.order_number) doc.text('Order: ' + data.order_number, doc.page.width - 250, 147);
      if (data.delivery_date)
        doc.text('Delivery: ' + new Date(data.delivery_date + 'T00:00:00').toLocaleDateString('en-IN') + (data.delivery_slot ? ' (' + data.delivery_slot + ')' : ''), doc.page.width - 250, 162, { width: 200 });
      if (data.vehicle_number) doc.text('Vehicle: ' + data.vehicle_number, doc.page.width - 250, 177);
    }

    // Items table
    const startY = 210;
    doc.rect(46, startY, doc.page.width - 92, 22).fill('#f1f5f9');
    doc.fill('#0f172a').font('Helvetica-Bold').fontSize(8.5);
    const col = { item: 46, qty: 200, uom: 240, price: 330, disc: 405, amt: 470 };
    doc.text('ITEM', col.item + 4, startY + 7);
    doc.text('QTY', col.qty, startY + 7);
    doc.text('UOM', col.uom + 5, startY + 7);
    doc.text('RATE', col.price, startY + 7);
    doc.text('DISC%', col.disc + 5, startY + 7);
    doc.text('AMOUNT', col.amt, startY + 7);

    let y = startY + 30;
    doc.font('Helvetica').fontSize(9).fill('#1e293b');
    for (const it of data.items) {
      doc.text(it.product_name + (it.brand ? ' (' + it.brand + ')' : ''), col.item, y, { width: 145 });
      doc.text(String(it.quantity), col.qty, y);
      doc.text(it.unit_type, col.uom + 5, y);
      doc.text(inr(it.unit_price_effective), col.price, y);
      doc.text(it.discount_percent ? it.discount_percent + '%' : '-', col.disc + 5, y);
      doc.text(inr(it.subtotal), col.amt, y);
      y += 18;
    }

    // Totals
    const ty = Math.max(y + 8, startY + 30 + data.items.length * 18 + 8);
    doc.font('Helvetica').fontSize(9).fill('#475569');
    doc.text('Subtotal (goods)', 330, ty);
    doc.font('Helvetica-Bold').fill('#0f172a').text(inr(data.item_subtotal), 470, ty, { align: 'right', width: 66 });
    if (Number(data.discount_amount) > 0) {
      doc.font('Helvetica').fill('#475569').text('Bulk Discount', 330, ty + 16);
      doc.font('Helvetica-Bold').fill('#dc2626').text('- ' + inr(data.discount_amount), 470, ty + 16, { align: 'right' });
    }
    doc.font('Helvetica').fill('#475569').text('GST @ ' + (data.gst_rate ?? 18) + '%', 330, ty + 32);
    doc.font('Helvetica-Bold').fill('#0f172a').text(inr(data.gst_amount), 470, ty + 32, { align: 'right' });
    doc.font('Helvetica').fill('#475569').text('Freight (est.)', 330, ty + 48);
    doc.font('Helvetica-Bold').fill('#0f172a').text(inr(data.freight_charge), 470, ty + 48, { align: 'right' });

    const totalsY = ty + 76;
    doc.rect(300, totalsY - 6, doc.page.width - 346, 66).fill('#f0fdf4');
    doc.font('Helvetica-Bold').fontSize(12).fill('#166534');
    doc.text('TOTAL', 310, totalsY + 8);
    doc.text(inr(data.total_amount), 470, totalsY + 8, { align: 'right', width: 66 });
    doc.font('Helvetica').fontSize(9).fill('#166534');
    doc.text('Advance Paid: ' + inr(data.advance_paid), 310, totalsY + 26);
    doc.font('Helvetica-Bold');
    doc.text('Balance Due: ' + inr(data.balance_due), 310, totalsY + 42);

    // Footer / payment note
    doc.fontSize(8.5).fill('#64748b').font('Helvetica');
    let noteY = totalsY + 84;
    if (type === 'QUOTATION') {
      doc.text('Quotation valid for 7 days. Prices subject to GST and freight as estimated.', 46, noteY, { width: 500 });
      doc.fill('#0f172a').font('Helvetica-Bold').text('To confirm, pay the advance below and we will dispatch within 2 days.', 46, noteY + 14, { width: 500 });
    } else if (type === 'RECEIPT') {
      doc.text('This receipt acknowledges advance payment against the order above.', 46, noteY, { width: 500 });
    } else {
      doc.text('Goods sold on the terms of BuildSupply. No returns after dispatch.', 46, noteY, { width: 500 });
      doc.text('Balance to be collected by the driver upon delivery.', 46, noteY + 14, { width: 500 });
    }
    doc.fontSize(7.5).fill('#94a3b8').text('This is a computer-generated document and does not require a signature.', 46, noteY + 32);

    doc.end();
  });
}

module.exports = { renderOrderPdf, inr };