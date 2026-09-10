export default function StockBadge({ status, message }) {
  const styles = {
    in_stock: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:ring-emerald-900',
    low: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:ring-amber-900',
    out_of_stock: 'bg-rose-50 text-rose-600 ring-rose-200 dark:bg-rose-950 dark:text-rose-400 dark:ring-rose-900',
  };
  const dot = {
    in_stock: 'bg-emerald-500',
    low: 'bg-amber-500',
    out_of_stock: 'bg-rose-500',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${styles[status]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot[status]}`} />
      {message || status.replace('_', ' ')}
    </span>
  );
}