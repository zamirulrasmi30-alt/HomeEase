import { Building2, ImageIcon, Eye } from 'lucide-react';
import StockBadge from '../shared/StockBadge';
import { inr, fmtQty } from '../../lib/format';

export default function ProductCard({ product, onOrder, onQuickView }) {
  const tier = product.discount_tier_qty != null && product.discount_tier_percent != null;

  const images = [
    product.image_url,
    ...(Array.isArray(product.gallery_images) ? product.gallery_images : []),
    ...(Array.isArray(product.images) ? product.images : []),
  ].filter(Boolean);

  const secondary = images.length > 1 ? images[1] : null;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-slate-700 dark:bg-slate-800">
      <div className="relative h-48 shrink-0 overflow-hidden bg-slate-100 dark:bg-slate-800">
        {images[0] ? (
          <img src={images[0]} alt={product.name} className="h-full w-full object-contain object-center" />
        ) : (
          <div className="grid h-full w-full place-items-center"><ImageIcon size={44} className="text-slate-300 dark:text-slate-600" /></div>
        )}
        {secondary && (
          <img
            src={secondary}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-contain object-center opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          />
        )}

        {/* Quick view */}
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/30 opacity-0 backdrop-blur-[1px] transition-opacity duration-300 group-hover:opacity-100 dark:bg-slate-950/40">
          <button
            onClick={() => onQuickView && onQuickView(product)}
            className="inline-flex translate-y-1 items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-900 shadow-lg transition-all duration-300 group-hover:translate-y-0 hover:scale-105 dark:bg-slate-800 dark:text-white"
          >
            <Eye size={16} /> Quick View
          </button>
        </div>

        <div className="absolute left-3 top-3 z-20">
          <StockBadge status={product.stock_status} message={statusMessage(product)} />
        </div>
        {product.category && (
          <span className="absolute right-3 top-3 z-20 inline-flex items-center gap-1 rounded-lg bg-slate-900/80 px-2 py-1 text-[10px] font-semibold text-white dark:bg-slate-950/80">
            <Building2 size={11} /> {product.category}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div>
          <h3 className="font-bold leading-snug text-slate-800 dark:text-white">{product.name}</h3>
          {product.brand && <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{product.brand}</p>}
        </div>

        <div className="flex items-baseline justify-between">
          <div>
            <span className="text-lg font-extrabold text-slate-900 dark:text-white">{inr(product.price_per_unit)}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400"> / {product.unit_type}</span>
          </div>
          <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {fmtQty(product.current_stock)} {product.unit_type}
          </span>
        </div>

        {tier && (
          <p className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
            {product.discount_tier_percent}% off on orders ≥ {fmtQty(product.discount_tier_qty)} {product.unit_type}
          </p>
        )}

        <div className="mt-auto flex items-center gap-2 pt-2">
          <button
            onClick={() => onOrder(product)}
            disabled={product.stock_status === 'out_of_stock'}
            className="flex-1 rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 dark:bg-white dark:text-slate-900 dark:hover:bg-emerald-500 dark:disabled:bg-slate-800 dark:disabled:text-slate-600"
          >
            {product.stock_status === 'out_of_stock' ? 'Out of Stock' : 'Order Now'}
          </button>
        </div>
      </div>
    </div>
  );
}

function statusMessage(p) {
  if (p.stock_status === 'out_of_stock') return 'Out of stock';
  if (p.stock_status === 'low') return `Only ${fmtQty(p.current_stock)} ${p.unit_type} left`;
  return 'In stock';
}