require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const config = require('./config');
const { adminAuth } = require('./middleware/auth');
const { errorHandler, notFound, asyncHandler } = require('./middleware/error');
const { serviceClient } = require('./config/supabase');
const { ensureCustomerEmailColumn } = require('./services/schema');

// Public routes
const categoriesRouter = require('./routes/categories');
const productsRouter = require('./routes/products');
const ordersRouter = require('./routes/orders');
const quotesRouter = require('./routes/quotes');
const invoicesRouter = require('./routes/invoices');
const stockRouter = require('./routes/stock');
const pricingRouter = require('./routes/pricing');

// Admin routes
const adminAuthRouter = require('./routes/admin/auth');
const uploadRouter = require('./routes/upload');
const adminCategoriesRouter = require('./routes/admin/categories');
const adminProductsRouter = require('./routes/admin/products');
const adminStockRouter = require('./routes/admin/stock');
const adminOrdersRouter = require('./routes/admin/orders');
const adminInvoicesRouter = require('./routes/admin/invoices');
const adminAnalyticsRouter = require('./routes/admin/analytics');

const app = express();

app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.disable('x-powered-by');

// Uploaded product images
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// Health + readiness
app.get('/api/health', asyncHandler(async (req, res) => {
  const { error } = await serviceClient.from('categories').select('id').limit(1);
  res.json({
    status: error ? 'degraded' : 'ok',
    db: !error,
    time: new Date().toISOString(),
  });
}));

// Public API
app.use('/api/categories', categoriesRouter);
app.use('/api/products', productsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/quotes', quotesRouter);
app.use('/api/invoices', invoicesRouter);
app.use('/api/stock', stockRouter);
app.use('/api/pricing', pricingRouter);

// Admin API (all routes behind admin auth except login)
app.use('/api/admin/auth', adminAuthRouter);
app.use('/api/admin', adminAuth, (req, res, next) => {
  req.admin = true;
  next();
});
app.use('/api/admin/upload', uploadRouter);
app.use('/api/admin/categories', adminCategoriesRouter);
app.use('/api/admin/products', adminProductsRouter);
app.use('/api/admin/stock', adminStockRouter);
app.use('/api/admin/orders', adminOrdersRouter);
app.use('/api/admin/invoices', adminInvoicesRouter);
app.use('/api/admin/analytics', adminAnalyticsRouter);

// 404 + error handling
app.use(notFound);
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`[buildsupply] backend listening on http://localhost:${config.port}`);
  console.log(`[buildsupply] db ready      : ${Boolean(config.supabase.url)}`);
});

// Non-fatal startup migration: try to add customer_email to orders.
ensureCustomerEmailColumn().catch((e) =>
  console.warn('[schema] migration attempt failed:', e.message));