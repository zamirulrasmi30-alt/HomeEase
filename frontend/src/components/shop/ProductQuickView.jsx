import { X, Package, Truck, Percent, Store, ImageIcon } from 'lucide-react';
import Modal from '../shared/Modal';
import { inr, fmtQty } from '../../lib/format';
import StockBadge from '../shared/StockBadge';

export default function ProductQuickView({ product, onClose, onOrder }) {
  if (!product) return null;

  const out = product.stock_status === 'out_of_stock';
  const tier = product.discount_tier_qty != null && product.discount_tier_percent != null;

  const specs = [
    { icon: <Package size={15} />, label: 'Category', value: product.category || '—' },
    { icon: <Store size={15} />, label: 'Brand', value: product.brand || '—' },
    { icon: <Truck size={15} />, label: 'Unit', value: product.unit_type || '—' },
    ...(tier
      ? [{ icon: <Percent size={15} />, label: 'Bulk discount', value: `${product.discount_tier_percent}% off at ≥ ${fmtQty(product.discount_tier_qty)} ${product.unit_type}` }]
      : []),
  ];

  return (
    <Modal open onClose={onClose} size="max-w-3xl">
      <div className="grid gap-5 sm:grid-cols-2">
        {/* Image */}
        <div className="relative flex h-56 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 sm:h-auto sm:min-h-64 dark:bg-slate-800">
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} className="h-full w-full object-contain object-center" />
          ) : (
            <ImageIcon size={48} className="text-slate-300 dark:text-slate-600" />
          )}
          <div className="absolute left-3 top-3">
            <StockBadge status={product.stock_status} message={out ? 'Out of stock' : (product.stock_status === 'low' ? `Only ${fmtQty(product.current_stock)} left` : 'In stock')} />
          </div>
        </div>

        {/* Details */}
        <div className="flex flex-col gap-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">{product.category}</p>
          <div>
            <h3 className="text-xl font-extrabold leading-snug text-slate-900 dark:text-white">{product.name}</h3>
            {product.brand && <p className="text-sm text-slate-500 dark:text-slate-400">{product.brand}</p>}
          </div>

          <p className="text-2xl font-extrabold text-slate-900 dark:text-white">
            {inr(product.price_per_unit)} <span className="text-xs font-medium text-slate-500 dark:text-slate-400">/ {product.unit_type}</span>
          </p>

          {product.description && (
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{product.description}</p>
          )}

          <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/50">
            {specs.map((s) => (
              <div key={s.label} className="flex items-center gap-2.5 text-sm">
                <span className="text-slate-400 dark:text-slate-500">{s.icon}</span>
                <span className="w-28 shrink-0 font-semibold text-slate-500 dark:text-slate-400">{s.label}</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">{s.value}</span>
              </div>
            ))}
          </div>

          <div className="mt-auto flex flex-col gap-2 pt-2">
            <button
              onClick={() => onOrder(product)}
              disabled={out}
              className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 dark:bg-white dark:text-slate-900 dark:hover:bg-emerald-500 dark:disabled:bg-slate-800 dark:disabled:text-slate-600"
            >
              {out ? 'Out of Stock' : 'Order Now'}
            </button>
            <button
              onClick={onClose}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <X size={15} /> Close
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}