const nodemailer = require('nodemailer');

/**
 * Automated email notifications — Gmail SMTP (Nodemailer) only.
 *
 * Every notification is sent directly to the store owner's inbox via Gmail.
 * Fire-and-forget and never throws, so a slow or failed SMTP exchange
 * (ECONNRESET, auth failure, …) can never fail the customer's order.
 */

const GMAIL_USER = process.env.EMAIL_USER || 'zamirulrasmi30@gmail.com';
const GMAIL_PASS = process.env.EMAIL_PASS || 'uwnetkmbpbsmyesi';
const OWNER = process.env.EMAIL_OWNER || GMAIL_USER; // store owner inbox; defaults to sender

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: { user: GMAIL_USER, pass: GMAIL_PASS },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
});

const cap = (s) => (s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const money = (n) => '₹ ' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

const escapeHtml = (s) =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const stripHtml = (h) =>
  String(h || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

// Strip CR/LF and quotes so untrusted customer names/emails can never break
// SMTP headers (header-injection safety) while keeping the requested format.
const safeName = (s) => String(s || '').replace(/[\r\n"\\]/g, '').trim();
const safeAddr = (s) => String(s || '').replace(/[\r\n<>(),;:"\\]/g, '').trim();

const subjectFrom = (name, email) => {
  const n = safeName(name) || 'Customer';
  return email ? `From: ${n} (${safeAddr(email)})` : `From: ${n}`;
};

/** Shared wrapper: send a mail via Gmail SMTP. Never throws. */
async function sendOwnerEmail({ subject, replyTo, html, text = null, fromName = null, to = OWNER, attachments = [] }) {
  const message = text || stripHtml(html);
  const senderName = `${safeName(fromName) || 'Customer'} (via BuildSupply)`;
  const from = `"${senderName}" <${GMAIL_USER}>`;
  const toAddr = safeAddr(to) || OWNER;

  try {
    const info = await transporter.sendMail({
      from,
      to: toAddr,
      replyTo: safeAddr(replyTo) || GMAIL_USER, // reply goes to the customer when present
      subject,
      text: message,
      html,
      attachments,
    });
    console.log(`[email] sent "${subject}" → ${toAddr} (id: ${info.messageId})`);
    return { ok: true, message: `Notification sent to ${toAddr}.` };
  } catch (err) {
    // Deliberately non-fatal: log and move on, the order is already saved.
    console.error('[email] FAILED to send notification:', err.code || err.message);
    return { ok: false, code: err.code || 'E_MAIL_SEND', message: `Email delivery failed: ${err.message}` };
  }
}

// ---------------------------------------------------------------------------
// ORDER notification
// ---------------------------------------------------------------------------
function orderEmailHtml(order, items) {
  const customer = escapeHtml(order.customer_name);
  const rows = (items || [])
    .map(
      (it) => `
        <tr>
          <td style="padding:8px 10px;border-bottom:1px solid #eef2f7;">${escapeHtml(it.product_name)}${it.brand ? ` <span style="color:#8b95a5;">· ${escapeHtml(it.brand)}</span>` : ''}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #eef2f7;text-align:center;">${it.quantity} ${escapeHtml(it.unit_type)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #eef2f7;text-align:right;">${money(it.unit_price_effective)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #eef2f7;text-align:right;">${money(it.subtotal)}</td>
        </tr>`
    )
    .join('');

  return `
  <div style="font-family:Segoe UI,Arial,sans-serif;max-width:640px;margin:0 auto;color:#1f2937;">
    <div style="background:#14532d;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0;">
      <div style="font-size:20px;font-weight:700;">🛠️ New Order Received</div>
      <div style="font-size:13px;opacity:.85;margin-top:4px;">${escapeHtml(order.order_number)} · ${new Date().toLocaleString('en-IN')}</div>
    </div>
    <div style="border:1px solid #e5e7eb;border-top:0;border-radius:0 0 12px 12px;padding:24px;background:#ffffff;">

      <h3 style="margin:0 0 10px;font-size:14px;color:#166534;">👤 Customer details</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:18px;">
        <tr><td style="padding:4px 0;color:#6b7280;width:140px;">Name</td><td style="padding:4px 0;font-weight:600;">${customer}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280;">Phone</td><td style="padding:4px 0;">${escapeHtml(order.customer_phone) || '—'}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280;">Email</td><td style="padding:4px 0;">${escapeHtml(order.customer_email) || '—'}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280;">Site / Delivery address</td><td style="padding:4px 0;">${escapeHtml(order.delivery_address)}${order.landmark ? ` (${escapeHtml(order.landmark)})` : ''}${order.pincode ? ` — ${escapeHtml(order.pincode)}` : ''}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280;">Delivery date &amp; slot</td><td style="padding:4px 0;font-weight:600;">${escapeHtml(order.delivery_date) || '—'} · ${escapeHtml(order.delivery_slot) || '—'}</td></tr>
      </table>

      <h3 style="margin:0 0 10px;font-size:14px;color:#166534;">📦 Order summary</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#f3f4f6;color:#4b5563;font-size:12px;text-transform:uppercase;">
            <th style="padding:8px 10px;text-align:left;">Item</th>
            <th style="padding:8px 10px;text-align:center;">Qty</th>
            <th style="padding:8px 10px;text-align:right;">Unit price</th>
            <th style="padding:8px 10px;text-align:right;">Amount</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <table style="width:100%;font-size:13px;margin-top:14px;">
        <tr><td style="padding:4px 0;color:#6b7280;">Items subtotal</td><td style="padding:4px 0;text-align:right;">${money(order.item_subtotal)}</td></tr>
        ${Number(order.discount_amount) > 0 ? `<tr><td style="padding:4px 0;color:#6b7280;">Bulk discount</td><td style="padding:4px 0;text-align:right;color:#dc2626;">− ${money(order.discount_amount)}</td></tr>` : ''}
        ${Number(order.gst_amount) > 0 ? `<tr><td style="padding:4px 0;color:#6b7280;">GST @ ${order.gst_rate ?? 18}%</td><td style="padding:4px 0;text-align:right;">${money(order.gst_amount)}</td></tr>` : ''}
        <tr><td style="padding:4px 0;color:#6b7280;">Freight charges</td><td style="padding:4px 0;text-align:right;">${money(order.freight_charge)}</td></tr>
        <tr style="font-size:15px;font-weight:700;">
          <td style="padding:8px 0;border-top:2px solid #e5e7eb;">Total amount</td>
          <td style="padding:8px 0;border-top:2px solid #e5e7eb;text-align:right;color:#166534;">${money(order.total_amount)}</td>
        </tr>
      </table>

      <table style="width:100%;font-size:13px;margin-top:10px;background:#f0fdf4;border-radius:8px;">
        <tr>
          <td style="padding:10px 12px;color:#166534;font-weight:700;">Advance payment status</td>
          <td style="padding:10px 12px;text-align:right;color:#166534;">
            ${cap(order.payment_status)} — paid ${money(order.advance_paid)} / balance ${money(order.balance_due)}
          </td>
        </tr>
      </table>

      <p style="margin-top:18px;font-size:12px;color:#9ca3af;">
        Reply directly to this email to reach the customer (${escapeHtml(order.customer_email) || 'no email captured'}).
      </p>
    </div>
  </div>`;
}

function orderEmailText(order, items) {
  return [
    `New Order ${order.order_number}`,
    `Customer: ${order.customer_name || '—'}${order.customer_email ? ` (${order.customer_email})` : ''}`,
    `Phone: ${order.customer_phone || '—'}`,
    `Address: ${order.delivery_address || '—'}${order.landmark ? `, ${order.landmark}` : ''}${order.pincode ? ` — ${order.pincode}` : ''}`,
    '',
    ...(items || []).map((it) => `- ${it.quantity} ${it.unit_type} × ${it.product_name} @ ${money(it.unit_price_effective)} = ${money(it.subtotal)}`),
    '',
    `Subtotal: ${money(order.item_subtotal)}`,
    ...(Number(order.discount_amount) > 0 ? [`Bulk discount: − ${money(order.discount_amount)}`] : []),
    ...(Number(order.gst_amount) > 0 ? [`GST @ ${order.gst_rate ?? 18}%: ${money(order.gst_amount)}`] : []),
    `Freight: ${money(order.freight_charge)}`,
    `Total: ${money(order.total_amount)}`,
    `Advance paid: ${money(order.advance_paid)} / Balance on delivery: ${money(order.balance_due)}`,
  ].join('\n');
}

function customerConfirmText(order) {
  return [
    `Hello ${order.customer_name || 'there'},`,
    `Your order ${order.order_number} is confirmed with BuildSupply ERP.`,
    '',
    `Total amount   : ${money(order.total_amount)}`,
    `Advance paid   : ${money(order.advance_paid)}`,
    `Balance on delivery: ${money(order.balance_due)}`,
    `Delivery date  : ${order.delivery_date || '—'} · ${order.delivery_slot || '—'}`,
    `Address        : ${order.delivery_address || '—'}${order.pincode ? ` — ${order.pincode}` : ''}`,
    '',
    'Your invoice is attached as PDF. Thank you for your business!',
  ].join('\n');
}

/**
 * Legacy owner-only notification (kept for compatibility).
 * @param {object} order — inserted order row
 * @param {Array}  items — pricing.items line items
 */
async function sendNewOrderEmail(order, items, finance = {}) {
  return sendOwnerEmail({
    subject: `[New Order] ${subjectFrom(order.customer_name, order.customer_email)}`,
    replyTo: order.customer_email || null,
    html: orderEmailHtml(order, items),
    text: orderEmailText(order, items),
    fromName: order.customer_name,
  });
}

/**
 * Order placement emails: PDF invoice attached to BOTH the store owner
 * and the customer. Never throws; each recipient result is reported.
 */
async function sendOrderEmails({ order, items, pdfBuffer }) {
  const attachment = pdfBuffer
    ? [{ filename: `Invoice_${order.order_number}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }]
    : [];
  const results = [];

  results.push({
    to: 'owner',
    result: await sendOwnerEmail({
      subject: `[New Order] ${subjectFrom(order.customer_name, order.customer_email)}`,
      replyTo: order.customer_email || null,
      html: orderEmailHtml(order, items),
      text: orderEmailText(order, items),
      fromName: order.customer_name,
      attachments: attachment,
    }),
  });

  if (order.customer_email) {
    results.push({
      to: 'customer',
      result: await sendOwnerEmail({
        subject: `Order Confirmation — ${order.order_number}`,
        text: customerConfirmText(order),
        fromName: 'BuildSupply ERP',
        to: order.customer_email,
        attachments: attachment,
      }),
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// QUOTATION notification
// ---------------------------------------------------------------------------
async function sendQuoteEmail(quotationNumber, items, meta = {}) {
  const customer = escapeHtml(meta.customer_name || 'Quote Request');
  const subject = `[Quote Request] ${subjectFrom(meta.customer_name, meta.customer_email)}`;
  const replyTo = meta.customer_email || null;

  const text = [
    `New Quotation Request ${quotationNumber} from ${customer}`,
    `Phone: ${meta.customer_phone || '—'}`,
    `Email: ${meta.customer_email || '—'}`,
    `Delivery: ${meta.delivery_address || '—'}${meta.pincode ? ` — ${meta.pincode}` : ''}`,
    '',
    ...(items || []).map((it) => `- ${it.quantity} ${it.unit_type} × ${it.product_name} @ ${money(it.unit_price_effective)} = ${money(it.subtotal)}`),
  ].join('\n');

  return sendOwnerEmail({ subject, replyTo, text, fromName: meta.customer_name });
}

module.exports = { sendNewOrderEmail, sendQuoteEmail, sendOwnerEmail, sendOrderEmails };