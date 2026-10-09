const { Router } = require('express');
const { serviceClient } = require('../../config/supabase');
const { asyncHandler, AppError } = require('../../middleware/error');

const router = Router();

/**
 * GET /api/admin/analytics
 * Dashboard metrics:
 *  - kpis: revenue, orders, pending orders, low-stock products, monthly trend
 *  - topProducts: best sellers (by quantity / by revenue)
 *  - salesTrend: last 14 days daily revenue + orders
 *  - categorySales: revenue split by category
 *  - lowStock: products under threshold
 */
router.get('/', asyncHandler(async (req, res) => {
  const days = Math.min(Number(req.query.days) || 14, 90);

  // Downstream orders (whole history for KPIs, capped trend for chart)
  const since = new Date(Date.now() - (days + 1) * 86400000).toISOString();

  const [
    { data: orders },
    { data: products },
    { data: salesTrendRaw },
  ] = await Promise.all([
    serviceClient.from('orders').select('id, order_status, total_amount, advance_paid, created_at, order_items(product_id, quantity, subtotal, products(category_id))').order('created_at', { ascending: false }).limit(1000),
    serviceClient.from('products').select('id, name, brand, unit_type, current_stock, minimum_alert_stock, price_per_unit, categories(name)'),
    serviceClient.from('orders').select('order_status, total_amount, created_at').gte('created_at', since).order('created_at', { ascending: true }),
  ]);

  if (orders?.error || products?.error || salesTrendRaw?.error) {
    throw AppError('Failed to load analytics data.');
  }

  const orderRows = orders?.data || [];
  const productRows = products?.data || [];

  const valid = (o) => o.order_status !== 'cancelled';
  const revenueTotal = orderRows.filter(valid).reduce((s, o) => s + Number(o.total_amount), 0);
  const advanceTotal = orderRows.reduce((s, o) => s + Number(o.advance_paid), 0);
  const pending = orderRows.filter((o) => ['pending_payment', 'advance_paid'].includes(o.order_status)).length;
  const outForDelivery = orderRows.filter((o) => o.order_status === 'dispatched').length;
  const completed = orderRows.filter((o) => o.order_status === 'delivered').length;
  const cancelled = orderRows.filter((o) => o.order_status === 'cancelled').length;

  // Best sellers by quantity
  const sold = {};
  for (const o of orderRows) {
    if (!valid(o)) continue;
    for (const it of o.order_items || []) {
      const key = it.product_id || it.product_name;
      sold[key] = sold[key] || { product_id: it.product_id, name: it.product_name, unit_type: it.unit_type, qty: 0, revenue: 0, category_id: it.products?.category_id || null };
      sold[key].qty += Number(it.quantity);
      sold[key].revenue += Number(it.subtotal);
    }
  }
  const topProducts = Object.values(sold).sort((a, b) => b.qty - a.qty).slice(0, 5);

  // Sales trend bucketed by day
  const buckets = new Map();
  const bucketDay = (ts) => new Date(ts).toISOString().slice(0, 10);
  for (let i = days; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    buckets.set(d, { day: d, revenue: 0, orders: 0 });
  }
  for (const o of salesTrendRaw?.data || []) {
    if (o.order_status === 'cancelled') continue;
    const b = buckets.get(bucketDay(o.created_at));
    if (b) { b.revenue += Number(o.total_amount); b.orders += 1; }
  }
  const salesTrend = [...buckets.values()];

  // Category revenue
  const catMap = new Map(productRows.map((p) => [p.id, p.categories?.name || 'Uncategorized']));
  const categorySales = {};
  for (const o of orderRows) {
    if (!valid(o)) continue;
    for (const it of o.order_items || []) {
      const cat = catMap.get(it.product_id) || 'Uncategorized';
      categorySales[cat] = (categorySales[cat] || 0) + Number(it.subtotal);
    }
  }

  const lowStock = productRows
    .filter((p) => Number(p.current_stock) < Number(p.minimum_alert_stock || 0))
    .sort((a, b) => Number(a.current_stock) - Number(b.current_stock))
    .map((p) => ({ ...p, category: p.categories?.name }));

  const statusBreakdown = {
    pending_payment: orderRows.filter((o) => o.order_status === 'pending_payment').length,
    advance_paid: orderRows.filter((o) => o.order_status === 'advance_paid').length,
    dispatched: outForDelivery,
    delivered: completed,
    cancelled,
  };

  res.json({
    data: {
      kpis: {
        revenue: round(revenueTotal),
        advance_collected: round(advanceTotal),
        orders: orderRows.length,
        pending,
        out_for_delivery: outForDelivery,
        completed,
        cancelled,
        low_stock_count: lowStock.length,
        avg_order_value: orderRows.length ? round(revenueTotal / orderRows.length) : 0,
        best_seller: topProducts[0] || null,
      },
      salesTrend,
      topProducts,
      categorySales: Object.entries(categorySales)
        .map(([name, value]) => ({ name, value: round(value) }))
        .sort((a, b) => b.value - a.value),
      lowStock,
      statusBreakdown,
    },
  });
}));

const round = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

module.exports = router;