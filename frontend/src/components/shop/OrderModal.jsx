import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, MapPin, BadgePercent, Minus, Plus, FileText, CreditCard, AlertTriangle } from 'lucide-react';
import Modal from '../shared/Modal';
import Button from '../shared/Button';
import Field, { inputCls } from '../shared/Field';
import api from '../../lib/api';
import { inrFull, fmtQty, num } from '../../lib/format';

const SLOTS = ['Immediate', 'Morning (7–11 AM)', 'Afternoon (12–4 PM)', 'Evening (4–8 PM)'];
const today = () => new Date().toISOString().slice(0, 10);
const tomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
};
const minQtyOf = (product) => (product?.discount_tier_qty ? Number(product.discount_tier_qty) : 1);

export default function OrderModal({ product, onClose, onPlaced }) {
  const [qty, setQty] = useState(minQtyOf(product));
  const [deliveryDate, setDeliveryDate] = useState(tomorrow());
  const [slot, setSlot] = useState('Immediate');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [street, setStreet] = useState('');
  const [landmark, setLandmark] = useState('');
  const [pincode, setPincode] = useState('');
  const [advanceMode, setAdvanceMode] = useState('percent');
  const [advancePercent, setAdvancePercent] = useState(20);
  const [preview, setPreview] = useState(null);
  const [previewErr, setPreviewErr] = useState(null);
  const [quote, setQuote] = useState(null);

  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const { data } = await api.pricingQuote({
          items: [{ product_id: product.id, quantity: qty }],
          pincode: pincode || undefined,
        });
        if (alive) {
          setPreview(data);
          setPreviewErr(null);
        }
      } catch (e) {
        if (alive) setPreviewErr(e.message);
      }
    }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [qty, pincode, product.id]);

  const advanceDue = useMemo(() => {
    if (!preview) return 0;
    if (advanceMode === 'full') return preview.total_amount;
    return num((preview.total_amount * advancePercent) / 100);
  }, [preview, advanceMode, advancePercent]);

  const balanceDue = useMemo(() => (preview ? num(preview.total_amount) - advanceDue : 0), [preview, advanceDue]);

  const canPlace = Boolean(name.trim() && phone.trim() && street.trim() && pincode.trim() && qty > 0 && preview && !previewErr);

  /**
   * Fire-and-forget Web3Forms notification to the site owner.
   * Never throws — logs gracefully so a failed email cannot block order success.
   */
  const notifyWeb3Forms = async () => {
    const accessKey = import.meta.env.VITE_WEB3FORMS_ACCESS_KEY;
    if (!accessKey) {
      console.warn('[web3forms] skipped — set VITE_WEB3FORMS_ACCESS_KEY in frontend/.env');
      return;
    }

    const unitPrice = preview ? num(preview.item_subtotal) / qty : product.price_per_unit;
    const discountTierActive =
      product.discount_tier_qty != null && qty >= Number(product.discount_tier_qty);
    const discountNote =
      discountTierActive && product.discount_tier_percent
        ? `${product.discount_tier_percent}% bulk tier applied`
        : 'None';

    const message = [
      'NEW ORDER REQUEST',
      '=================',
      '',
      'CUSTOMER DETAILS',
      `Name            : ${name}`,
      `Phone           : ${phone}`,
      `Email           : ${email || '(not provided)'}`,
      `Delivery address: ${street}${landmark ? `, ${landmark}` : ''} — ${pincode}`,
      '',
      'SCHEDULE',
      `Delivery date   : ${deliveryDate}`,
      `Time slot       : ${slot}`,
      '',
      'ORDER SUMMARY',
      `Item            : ${product.name}${product.brand ? ` (${product.brand})` : ''}`,
      `Quantity        : ${fmtQty(qty)} ${product.unit_type}`,
      `Unit price      : ${inrFull(unitPrice)} / ${product.unit_type}`,
      `Bulk discount   : ${discountNote}`,
      `Item subtotal   : ${inrFull(preview.item_subtotal)}`,
      `GST @ ${preview.gst_rate}%: ${inrFull(preview.gst_amount)}`,
      `Freight (est.)  : ${inrFull(preview.freight_charge)}`,
      `TOTAL AMOUNT    : ${inrFull(preview.total_amount)}`,
      `Advance due now : ${inrFull(advanceDue)}`,
      `Balance on delivery: ${inrFull(balanceDue)}`,
      `Payment mode    : ${advanceMode === 'full' ? 'Full payment' : `${advancePercent}% advance booking`}`,
    ].join('\n');

    const payload = {
      access_key: accessKey,
      subject: `🚨 New Order Request - ${name}`,
      replyto: email || undefined,
      from_name: name,
      email: email || 'not-provided@example.com',
      phone,
      delivery_address: street + (landmark ? `, ${landmark}` : '') + ` — ${pincode}`,
      delivery_date: deliveryDate,
      delivery_slot: slot,
      item: product.name,
      quantity: `${fmtQty(qty)} ${product.unit_type}`,
      item_subtotal: inrFull(preview.item_subtotal),
      gst_amount: inrFull(preview.gst_amount),
      freight_charge: inrFull(preview.freight_charge),
      total_amount: inrFull(preview.total_amount),
      advance_due: inrFull(advanceDue),
      balance_on_delivery: inrFull(balanceDue),
      message,
    };

    try {
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        console.error('[web3forms] notification failed:', body.message || res.status);
      } else {
        console.log('[web3forms] order email sent to owner');
      }
    } catch (err) {
      console.error('[web3forms] error while notifying owner:', err.message);
    }
  };

  const resetForm = () => {
    setQty(minQtyOf(product));
    setDeliveryDate(tomorrow());
    setSlot('Immediate');
    setName('');
    setEmail('');
    setPhone('');
    setStreet('');
    setLandmark('');
    setPincode('');
    setAdvanceMode('percent');
    setAdvancePercent(20);
    setPreview(null);
    setPreviewErr(null);
    setQuote(null);
  };

  const submit = async () => {
    const { data } = await api.placeOrder({
      customer_name: name,
      customer_email: email || '',
      customer_phone: phone,
      delivery_address: street,
      landmark: landmark || undefined,
      pincode,
      delivery_date: deliveryDate,
      delivery_slot: slot,
      advance_mode: advanceMode,
      advance_percent: advanceMode === 'percent' ? advancePercent : undefined,
      items: [{ product_id: product.id, quantity: qty }],
    });
    // Run the Web3Forms email alongside the order flow; it must never block success.
    notifyWeb3Forms();
    resetForm();
    onPlaced(data);
  };

  const requestQuote = async () => {
    const { data } = await api.requestQuote({
      customer_name: name,
      customer_email: email || '',
      customer_phone: phone,
      delivery_address: street,
      landmark: landmark || undefined,
      pincode,
      items: [{ product_id: product.id, quantity: qty }],
    });
    setQuote({ number: data.quotation_number, url: data.download_url });
    window.open(data.download_url, '_blank');
  };

  return (
    <Modal open title={`Order — ${product.name}`} onClose={onClose} size="max-w-3xl">
      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-4">
          {/* 1. Quantity */}
          <Section icon={<BadgePercent size={15} />} title="1 · Quantity">
            <div className="flex items-center gap-3">
              <button onClick={() => setQty((q) => Math.max(0.5, q - 0.5))} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
                <Minus size={16} />
              </button>
              <input
                type="number" min="0.5" step="0.5" value={qty}
                onChange={(e) => setQty(parseFloat(e.target.value) || 0)}
                className="w-28 rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-lg font-bold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <button onClick={() => setQty((q) => q + 0.5)} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
                <Plus size={16} />
              </button>
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">{product.unit_type}</span>
            </div>
            {product.discount_tier_qty != null && (
              <p className="mt-2 text-xs font-semibold text-emerald-600">
                Bulk tier active: {product.discount_tier_percent}% off when quantity ≥ {fmtQty(product.discount_tier_qty)} {product.unit_type}.
              </p>
            )}
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Sold by the {product.unit_type}. For mixed units (Brass + Tons) please request a quotation.</p>
          </Section>

          {/* 2. Deliverability */}
          <Section icon={<CalendarDays size={15} />} title="2 · Delivery date & time slot">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Expected delivery date" required>
                <input type="date" min={today()} value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Time slot" required>
                <select value={slot} onChange={(e) => setSlot(e.target.value)} className={inputCls}>
                  {SLOTS.map((s) => <option key={s}>{s}</option>)}
                </select>
              </Field>
            </div>
          </Section>

          {/* 3. Site location */}
          <Section icon={<MapPin size={15} />} title="3 · Site location / delivery address">
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Customer name" required>
                  <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Site owner / supervisor name" />
                </Field>
                <Field label="Phone" required>
                  <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile number" />
                </Field>
                <Field label="Email" hint="For the owner to reach you directly (reply-to).">
                  <input className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
                </Field>
              </div>
              <Field label="Street / delivery address" required>
                <textarea rows={2} className={inputCls} value={street} onChange={(e) => setStreet(e.target.value)} placeholder="House / site number, street, area" />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Landmark">
                  <input className={inputCls} value={landmark} onChange={(e) => setLandmark(e.target.value)} placeholder="Near bus stop / water tank" />
                </Field>
                <Field label="Pincode" required hint="Used to estimate freight.">
                  <input className={inputCls} value={pincode} onChange={(e) => setPincode(e.target.value)} placeholder="600 000" />
                </Field>
              </div>
            </div>
          </Section>

          {/* 4. Advance */}
          <Section icon={<CreditCard size={15} />} title="4 · Advance payment">
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setAdvanceMode('percent')}
                className={`rounded-xl border px-3.5 py-2 text-sm font-semibold transition ${advanceMode === 'percent' ? 'border-emerald-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'}`}>
                % Advance booking
              </button>
              <button onClick={() => setAdvanceMode('full')}
                className={`rounded-xl border px-3.5 py-2 text-sm font-semibold transition ${advanceMode === 'full' ? 'border-emerald-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'}`}>
                Full payment
              </button>
            </div>
            {advanceMode === 'percent' && (
              <div className="mt-3 flex flex-wrap gap-2">
                {[20, 30, 50].map((p) => (
                  <button key={p} onClick={() => setAdvancePercent(p)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${advancePercent === p ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                    {p}%
                  </button>
                ))}
              </div>
            )}
            {preview && (
              <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                {advanceMode === 'full'
                  ? `Pay ${inrFull(preview.total_amount)} now — balance ₹0 on delivery.`
                  : `Pay advance of ${inrFull(advanceDue)} now; balance ${inrFull(balanceDue)} collected by the driver on delivery.`}
              </p>
            )}
          </Section>
        </div>

        {/* Summary */}
        <div className="lg:sticky lg:self-start">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
            <h4 className="mb-3 font-bold text-slate-800 dark:text-white">Order summary</h4>
            {quote ? (
              <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                Quotation <b>{quote.number}</b> created &amp; downloaded. Share it with our office before paying the advance.
              </div>
            ) : (
              <>
                <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">{fmtQty(qty)} {product.unit_type} — {product.name}</p>
                {preview ? (
                  <div className="space-y-1.5 text-sm">
                    <TotalRow label="Item subtotal" value={inrFull(preview.item_subtotal)} />
                    {num(preview.discount_amount) > 0 && <TotalRow label="Bulk discount" value={`− ${inrFull(preview.discount_amount)}`} negative />}
                    <TotalRow label={`GST @ ${preview.gst_rate}%`} value={inrFull(preview.gst_amount)} />
                    <TotalRow label="Freight (est.)" value={inrFull(preview.freight_charge)} />
                    <div className="my-2 border-t border-slate-200 dark:border-slate-700" />
                    <TotalRow label="Total" value={inrFull(preview.total_amount)} bold />
                    <TotalRow label="Advance due now" value={inrFull(advanceDue)} accent />
                    <TotalRow label="Balance on delivery" value={inrFull(balanceDue)} />
                  </div>
                ) : previewErr ? (
                  <p className="flex items-center gap-2 rounded-lg bg-rose-50 p-2 text-xs text-rose-600 dark:bg-rose-950/60 dark:text-rose-300">
                    <AlertTriangle size={14} /> {previewErr}
                  </p>
                ) : (
                  <p className="text-sm text-slate-400 dark:text-slate-500">Calculating price…</p>
                )}
                <div className="mt-4 grid gap-2">
                  <Button disabled={!canPlace} onClick={submit}>Place Order Now</Button>
                  <Button variant="secondary" onClick={requestQuote}>
                    <FileText size={15} /> Request Price Quotation (PDF)
                  </Button>
                </div>
                <p className="mt-2 text-center text-[11px] text-slate-400 dark:text-slate-500">
                  Stock is reserved and deducted when the owner dispatches your order.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Section({ icon, title, children }) {
  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <h4 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-white">
        <span className="grid h-6 w-6 place-items-center rounded-lg bg-slate-900 text-amber-400 dark:bg-amber-400 dark:text-slate-900">{icon}</span>
        {title}
      </h4>
      {children}
    </section>
  );
}

function TotalRow({ label, value, bold, negative, accent }) {
  return (
    <div className={`flex justify-between ${bold ? 'font-extrabold text-slate-900 dark:text-white' : ''} ${accent ? 'font-bold text-emerald-700 dark:text-emerald-400' : ''}`}>
      <span>{label}</span>
      <span className={negative ? 'text-rose-500' : ''}>{value}</span>
    </div>
  );
}