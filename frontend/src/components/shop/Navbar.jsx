import { Link } from 'react-router-dom';
import { HardHat, PackageSearch, Truck, Lock, Sun, Moon } from 'lucide-react';
import { useTheme } from '../../lib/theme';

export default function Navbar() {
  const [theme, toggle] = useTheme();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-700 dark:bg-slate-800/90">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-900 text-amber-400 dark:bg-amber-400 dark:text-slate-900">
            <HardHat size={22} />
          </span>
          <span>
            <span className="block text-lg font-extrabold leading-tight text-slate-900 dark:text-white">BuildSupply</span>
            <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">Construction Materials &amp; ERP</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1.5 sm:gap-3">
          <Link to="/track" className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
            <PackageSearch size={16} /> Track Order
          </Link>
          <a href="#quote" className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 sm:inline-flex">
            <Truck size={16} /> Bulk Delivery
          </a>
          <button
            onClick={toggle}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <Link to="/admin" className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700 dark:bg-amber-400 dark:text-slate-900 dark:hover:bg-amber-300">
            <Lock size={14} /> Owner Login
          </Link>
        </nav>
      </div>
    </header>
  );
}