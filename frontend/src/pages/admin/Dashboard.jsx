import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { LogOut, LayoutDashboard, ShoppingCart, Boxes, Receipt, FolderTree, HardHat, Sun, Moon } from 'lucide-react';
import { admin } from '../../lib/api';
import { useTheme } from '../../lib/theme';
import AnalyticsTab from './tabs/AnalyticsTab';
import OrdersTab from './tabs/OrdersTab';
import InventoryTab from './tabs/InventoryTab';
import LedgerTab from './tabs/LedgerTab';
import CatalogTab from './tabs/CatalogTab';

const TABS = [
  { id: 'analytics', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'orders', label: 'Orders', icon: ShoppingCart },
  { id: 'inventory', label: 'Inventory', icon: Boxes },
  { id: 'ledger', label: 'Stock Ledger', icon: Receipt },
  { id: 'catalog', label: 'Categories & Products', icon: FolderTree },
];

export default function Dashboard() {
  const [tab, setTab] = useState('analytics');
  const navigate = useNavigate();
  const [theme, toggleTheme] = useTheme();

  if (!admin.isAuthed()) return <Navigate to="/admin/login" replace />;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900">
      <aside className="fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-slate-950 text-slate-300">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-400 text-slate-900">
            <HardHat size={20} />
          </span>
          <div>
            <p className="font-extrabold text-white">BuildSupply</p>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Owner ERP</p>
          </div>
        </div>

        <nav className="mt-2 flex-1 space-y-1 px-3">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${tab === t.id ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
            >
              <t.icon size={17} /> {t.label}
            </button>
          ))}
        </nav>

        <div className="border-t border-white/10 p-3">
          <button onClick={toggleTheme} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-400 hover:bg-white/5 hover:text-white">
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />} {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
          <button onClick={() => { admin.logout(); navigate('/admin/login'); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-400 hover:bg-white/5 hover:text-rose-400">
            <LogOut size={17} /> Sign out
          </button>
        </div>
      </aside>

      <main className="ml-60 p-6">
        <Header />
        {tab === 'analytics' && <AnalyticsTab />}
        {tab === 'orders' && <OrdersTab />}
        {tab === 'inventory' && <InventoryTab />}
        {tab === 'ledger' && <LedgerTab />}
        {tab === 'catalog' && <CatalogTab />}
      </main>
    </div>
  );
}

function Header() {
  const [ping, setPing] = useState('—');
  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((d) => setPing(d.db ? 'DB connected' : 'DB unavailable'))
      .catch(() => setPing('API offline'));
  }, []);
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Business Control Room</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Live inventory, orders and dispatch in one place.</p>
      </div>
      <span className={`rounded-full px-3 py-1 text-xs font-bold ${ping === 'DB connected' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300' : 'bg-rose-100 text-rose-600 dark:bg-rose-900 dark:text-rose-300'}`}>
        {ping}
      </span>
    </div>
  );
}