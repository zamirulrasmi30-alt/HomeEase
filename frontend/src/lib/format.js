export const inr = (n) =>
  '₹ ' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

export const inrFull = (n) =>
  '₹ ' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const num = (n) => Number(n || 0);

export const fmtQty = (n) => {
  const v = Number(n || 0);
  return v % 1 === 0 ? v.toLocaleString('en-IN') : v.toLocaleString('en-IN', { maximumFractionDigits: 3 });
};

export const dateOnly = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const STATUS_META = {
  pending_payment: { label: 'Pending Payment', color: 'bg-amber-100 text-amber-800 ring-amber-200', dot: 'bg-amber-500' },
  advance_paid: { label: 'Advance Paid', color: 'bg-sky-100 text-sky-800 ring-sky-200', dot: 'bg-sky-500' },
  dispatched: { label: 'Dispatched', color: 'bg-violet-100 text-violet-800 ring-violet-200', dot: 'bg-violet-500' },
  delivered: { label: 'Delivered', color: 'bg-emerald-100 text-emerald-800 ring-emerald-200', dot: 'bg-emerald-500' },
  cancelled: { label: 'Cancelled', color: 'bg-rose-100 text-rose-800 ring-rose-200', dot: 'bg-rose-500' },
};

export const ORDER_STATUSES = Object.keys(STATUS_META);