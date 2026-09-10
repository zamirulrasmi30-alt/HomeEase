import { Routes, Route } from 'react-router-dom';
import Home from './pages/shop/Home';
import TrackOrder from './pages/shop/TrackOrder';
import OrderSuccess from './pages/shop/OrderSuccess';
import AdminLogin from './pages/admin/AdminLogin';
import Dashboard from './pages/admin/Dashboard';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors duration-300 dark:bg-slate-900 dark:text-slate-100">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/track" element={<TrackOrder />} />
        <Route path="/order-success" element={<OrderSuccess />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<Dashboard />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </div>
  );
}