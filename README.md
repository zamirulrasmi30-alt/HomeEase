# BuildSupply — Construction Materials E-Commerce & ERP

Full-stack storefront + owner ERP for a bulk construction materials business
(Cement, Steel/TMT, P-Sand, M-Sand, Aggregates, Doors, Tiles, Plumbing, Electricals).

- **Frontend** — React 18 (Vite), Tailwind CSS, Lucide icons, Recharts
- **Backend** — Node.js / Express REST API
- **Database** — Supabase (PostgreSQL + Row Level Security + storage for images)
- **Documents** — pdfkit-generated Tax Invoices, Delivery Receipts and Quotations

```
backend/   Express API + SQL migrations + services
frontend/  Vite/React UI (customer shop + owner ERP)
```

---

## 1. One-time setup

### A. Database (Supabase)

1. Create a project at https://supabase.com.
2. Open **SQL Editor** and run the migration file: `backend/supabase/001_schema.sql`
   (tables, RLS, stock-ledger triggers, dispatch/cancel/deliver functions, views).
3. Open a second tab and run `backend/supabase/002_seed.sql`
   (7 categories, 22 products, opening stock as real ledger `IN` rows).
4. Project Settings → API: copy the **Project URL**, **anon key** and **service_role key**.

### B. Backend

```powershell
cd backend
Copy-Item .env.example .env
# edit .env  → fill SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
#               (optionally ADMIN_USERNAME/ADMIN_PASSWORD, GOOGLE_MAPS_API_KEY)
npm install
npm run dev          # → http://localhost:4000
```

### C. Frontend

```powershell
cd ..\frontend
npm install
npm run dev          # → http://localhost:5173  (proxies /api → :4000)
```

**Default owner login:** `admin` / `admin123` (change via `.env`).

---

## 2. What lives where

| Path | Purpose |
|---|---|
| `backend/supabase/001_schema.sql` | Tables, enums, RLS, stock trigger, `dispatch_order`/`cancel_order`/`complete_delivery`/`receive_stock`, analytics views |
| `backend/supabase/002_seed.sql` | Seed catalog & opening stock |
| `backend/routes/*.js` | Public API |
| `backend/routes/admin/*.js` | Owner ERP API (login, orders, stock, catalog, analytics, pdfs) |
| `backend/services/pricing.js` | GST 18% + bulk-tier discount calculator |
| `backend/services/freight.js` | Freight estimate (Google Maps or pincode heuristic) |
| `backend/services/invoice.js` | pdfkit invoice / receipt / quotation renderer |
| `frontend/src/pages/shop/` | Storefront: catalog, order modal, tracking, success |
| `frontend/src/pages/admin/` | Owner ERP: login + dashboard (analytics, orders, inventory, ledger, catalog) |

---

## 3. Public REST API

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/categories` | Active categories + product counts + unit types |
| GET | `/api/products?category=&q=` | Catalog with live `stock_status` |
| GET | `/api/stock` | Live stock snapshot / badges |
| POST | `/api/pricing/quote` | Live price calculator `{items:[{product_id,quantity}], pincode}` |
| POST | `/api/orders` | Place order (validates stock, computes GST/freight/advance) |
| GET | `/api/orders/:orderNo/status?phone=` | Order tracking |
| POST | `/api/quotes` | Request a printable price quotation |
| GET | `/api/invoices/order/:orderNo?phone=&doc=invoice\|receipt` | Customer PDFs |
| GET | `/api/invoices/quotation/:no?phone=` | Quotation PDF |

## 4. Admin REST API  (all require `Authorization: Bearer <token>`)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/admin/auth/login` | `{username,password}` → token |
| POST `/PATCH` `/DELETE` | `/api/admin/categories[/:id]` | Dynamic category + units |
| POST `/PATCH` `/DELETE` | `/api/admin/products[/:id]` | Products with `opening_stock` ledger write |
| POST | `/api/admin/stock/receive` | Stock In / procurement |
| POST | `/api/admin/stock/adjust` | Signed correction |
| GET | `/api/admin/stock/ledger`, `/summary` | Ledger & balances |
| GET | `/api/admin/orders[/:id]` | Search/filter orders |
| POST | `/api/admin/orders/:id/advance` `dispatch` `deliver` `cancel` | Workflow |
| GET | `/api/admin/analytics?days=14` | KPIs, trend, top sellers, low stock |
| GET | `/api/admin/invoices/:orderId?doc=` | PDF invoice/receipt |

---

## 5. Core business rules (enforced in SQL, not just the UI)

- **Stock ledger is the source of truth.** Every `IN`/`OUT` row updates
  `products.current_stock` via `apply_stock_transaction` trigger — debit/credit can
  never drift silently.
- **Dispatch deducts stock.** `dispatch_order` locks product rows, rejects
  overselling (`Insufficient stock`), writes `OUT` ledger rows per line, sets status
  to `dispatched`, and stamps vehicle + driver.
- **Cancel restocks automatically.** Only a `delivered` order cannot be cancelled;
  any previously-deducted stock is written back as `IN` rows.
- **Delivery closes the money loop.** `complete_delivery` collects the balance,
  recomputes `advance_paid` / `balance_due` / `payment_status`.
- **Advance flow matches the requirement:**
  `pending_payment → advance_paid → dispatched → delivered` (or `cancelled`).
- **Bulk discount tiers:** when `quantity ≥ discount_tier_qty`, `discount_tier_percent`
  applies automatically (client modal + server both compute it).

---

## 6. Demo walkthrough

1. Browse `http://localhost:5173` — pick *P-Sand* (shows “Only N left”), click **Order Now**.
2. Set qty, date+slot, delivery address, choose advance % — summary recomputes GST/freight live.
3. **Place Order** → success screen with order number + Invoice/Receipt PDF links.
4. Login as owner at `/admin` → **Orders** → open order → **Record advance** → **Confirm Dispatch & Deduct Stock** (vehicle/driver) → watch stock drop in **Inventory** & **Stock Ledger**.
5. **Dashboard** shows revenue trend (Recharts), best sellers, low-stock alerts; **Categories & Products** lets you add e.g. a new “Custom Wood Door” with opening stock.

---

## 7. Notes / extensions

- `GOOGLE_MAPS_API_KEY`: set it and freight becomes real driving-distance based;
  otherwise a pincode-zone heuristic is used.
- Product images: drop files into a Supabase Storage bucket (`products`) and store the
  public URL in `products.image_url`, or paste any https URL.
- RLS is fully configured (see migration) so you can later move ordering/CRM behind
  Supabase Auth using the documented `authenticated` policies.