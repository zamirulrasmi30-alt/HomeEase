import { useState } from 'react';
import { Loader2 } from 'lucide-react';

const classes = {
  primary:
    'inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-500 dark:hover:bg-emerald-400',
  secondary:
    'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700',
  danger:
    'inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-50 dark:bg-rose-500 dark:hover:bg-rose-400',
  ghost:
    'inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800',
};

/** Button with built-in busy spinner. */
export default function Button({ variant = 'primary', loading, loadingLabel, children, className = '', ...props }) {
  const [busy, setBusy] = useState(false);
  const isBusy = busy || loading;
  return (
    <button
      className={`${classes[variant] || classes.primary} ${className}`}
      disabled={isBusy || props.disabled}
      {...props}
      onClick={async (e) => {
        if (props.onClick) {
          try {
            setBusy(true);
            await props.onClick(e);
          } finally {
            setBusy(false);
          }
        }
      }}
    >
      {isBusy && <Loader2 size={16} className="animate-spin" />}
      {isBusy && loadingLabel ? loadingLabel : children}
    </button>
  );
}