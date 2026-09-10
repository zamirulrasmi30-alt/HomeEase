-- ============================================================================
-- Construction Materials E-Commerce & ERP — Supabase Migration 001
-- Schema + RLS + Stock Ledger Triggers + Order Workflow Functions
-- Run this in the Supabase SQL editor.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Sequences (human-friendly order / invoice numbering)
-- ---------------------------------------------------------------------------
create sequence if not exists order_number_seq start 1000;
create sequence if not exists invoice_number_seq start 5000;
create sequence if not exists quotation_number_seq start 9000;

-- Atomic human-friendly number generation (exposed via PostgREST RPC)
create or replace function public.next_number(p_kind text)
returns text
language sql
volatile
as $$
  select case p_kind
    when 'order'     then 'ORD-' || to_char(now(), 'YYYYMM') || '-' || lpad(nextval('order_number_seq')::text, 4, '0')
    when 'invoice'   then 'INV-' || to_char(now(), 'YYYY')   || '-' || lpad(nextval('invoice_number_seq')::text, 5, '0')
    when 'quotation' then 'QT-'  || to_char(now(), 'YYYY')   || '-' || lpad(nextval('quotation_number_seq')::text, 5, '0')
  end;
$$;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'stock_tx_type') then
    create type stock_tx_type as enum ('IN', 'OUT', 'ADJUSTMENT');
  end if;
  if not exists (select 1 from pg_type where typname = 'order_status') then
    create type order_status as enum ('pending_payment', 'advance_paid', 'dispatched', 'delivered', 'cancelled');
  end if;
  if not exists (select 1 from pg_type where typname = 'payment_status') then
    create type payment_status as enum ('unpaid', 'partial', 'paid', 'refunded');
  end if;
  if not exists (select 1 from pg_type where typname = 'invoice_type') then
    create type invoice_type as enum ('QUOTATION', 'INVOICE', 'RECEIPT');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. categories
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  description   text,
  unit_types    text[] not null default '{}',
  sort_order    int  not null default 0,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. products
-- ---------------------------------------------------------------------------
create table if not exists public.products (
  id                   uuid primary key default gen_random_uuid(),
  category_id          uuid not null references public.categories(id) on delete restrict,
  name                 text not null,
  brand                text,
  description          text,
  price_per_unit       numeric(12,2) not null check (price_per_unit >= 0),
  unit_type            text not null,
  weight_volume        numeric(12,4),          -- kg/unit or tonnes; used for freight/pricing rules
  current_stock        numeric(14,4) not null default 0,
  minimum_alert_stock  numeric(12,2) not null default 0,
  image_url            text,
  -- Bulk discount tier: quantity >= discount_tier_qty  =>  discount_tier_percent %
  discount_tier_qty    numeric(12,2),
  discount_tier_percent numeric(6,2),
  status               text not null default 'active' check (status in ('active','inactive')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists products_category_idx  on public.products(category_id);
create index if not exists products_status_idx    on public.products(status);

-- ---------------------------------------------------------------------------
-- 3. stock_transactions  (append-only stock ledger)
-- ---------------------------------------------------------------------------
create table if not exists public.stock_transactions (
  id                      uuid primary key default gen_random_uuid(),
  product_id              uuid not null references public.products(id) on delete cascade,
  type                    stock_tx_type not null,
  quantity                numeric(14,4) not null check (quantity <> 0),
  supplier_or_order_ref   text,
  notes                   text,
  tx_date                 date not null default current_date,
  created_by              text,
  created_at              timestamptz not null default now()
);

create index if not exists stock_tx_product_idx on public.stock_transactions(product_id);
create index if not exists stock_tx_date_idx     on public.stock_transactions(tx_date desc);

-- ---------------------------------------------------------------------------
-- 4. orders
-- ---------------------------------------------------------------------------
create table if not exists public.orders (
  id                uuid primary key default gen_random_uuid(),
  order_number      text not null unique,
  user_id           uuid references auth.users(id) on delete set null, -- optional customer link
  customer_name     text not null,
  customer_email    varchar(255),
  customer_phone    text not null,
  delivery_address  text not null,
  landmark          text,
  pincode           text,
  delivery_date     date,
  delivery_slot     text,
  notes             text,

  item_subtotal     numeric(14,2) not null default 0,
  discount_amount   numeric(14,2) not null default 0,   -- bulk-tier discount
  gst_rate          numeric(6,2)  not null default 18,
  gst_amount        numeric(14,2) not null default 0,
  freight_charge    numeric(14,2) not null default 0,
  total_amount      numeric(14,2) not null default 0,

  advance_mode      text not null default 'percent' check (advance_mode in ('percent','full','none')),
  advance_percent   numeric(6,2),
  advance_paid      numeric(14,2) not null default 0,
  balance_due       numeric(14,2) not null default 0,
  payment_status    payment_status not null default 'unpaid',
  order_status      order_status  not null default 'pending_payment',

  -- Dispatch / fleet
  vehicle_number    text,
  driver_contact    text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists orders_status_idx     on public.orders(order_status);
create index if not exists orders_created_idx    on public.orders(created_at desc);
create index if not exists orders_delivery_idx   on public.orders(delivery_date);

-- ---------------------------------------------------------------------------
-- 5. order_items  (price snapshots so edits don't rewrite history)
-- ---------------------------------------------------------------------------
create table if not exists public.order_items (
  id                   uuid primary key default gen_random_uuid(),
  order_id             uuid not null references public.orders(id) on delete cascade,
  product_id           uuid references public.products(id) on delete set null,
  product_name         text not null,
  brand                text,
  unit_type            text not null,
  quantity             numeric(14,4) not null,
  unit_price           numeric(14,2) not null,         -- list price per unit
  discount_percent     numeric(6,2)  not null default 0,
  unit_price_effective numeric(14,2) not null,          -- after per-item discount
  subtotal             numeric(14,2) not null
);

create index if not exists order_items_order_idx on public.order_items(order_id);
create index if not exists order_items_product_idx on public.order_items(product_id);

-- ---------------------------------------------------------------------------
-- 6. invoices  (quotations / invoices / receipts, printable)
-- ---------------------------------------------------------------------------
create table if not exists public.invoices (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid references public.orders(id) on delete set null,
  invoice_number text not null unique,
  invoice_type  invoice_type not null default 'INVOICE',
  amount        numeric(14,2) not null default 0,
  advance_paid  numeric(14,2) not null default 0,
  balance_due   numeric(14,2) not null default 0,
  file_url      text,
  items_snapshot jsonb,       -- snapshot for quotations rendered before an order exists
  customer_meta jsonb,        -- {customer_name, customer_phone, delivery_address, pincode, delivery_date, delivery_slot, landmark}
  billing jsonb,              -- precomputed {item_subtotal, discount_amount, gst_amount, freight_charge, gst_rate}
  created_at    timestamptz not null default now()
);

create index if not exists invoices_order_idx on public.invoices(order_id);

-- ===========================================================================
-- STOCK LEDGER TRIGGERS
-- The ledger is the single source of truth; products.current_stock is a
-- denormalized cache derived automatically from ledger rows.
-- ===========================================================================

create or replace function public.sync_product_stock(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.products
     set current_stock =
           coalesce((select sum(quantity)
                        from public.stock_transactions
                       where product_id = p_product_id), 0)
   where id = p_product_id;
end;
$$;

create or replace function public.apply_stock_transaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    perform public.sync_product_stock(NEW.product_id);
    return NEW;
  elsif TG_OP = 'DELETE' then
    perform public.sync_product_stock(OLD.product_id);
    return OLD;
  end if;
  return NULL; -- updates to rows are not supported (append-only ledger)
end;
$$;

drop trigger if exists trg_stock_transaction on public.stock_transactions;
create trigger trg_stock_transaction
  after insert or delete on public.stock_transactions
  for each row execute function public.apply_stock_transaction();

-- ---------------------------------------------------------------------------
-- DISPATCH ORDER -> deduct stock, guard against overselling
-- ---------------------------------------------------------------------------
create or replace function public.dispatch_order(p_order_id uuid, p_vehicle text default null, p_driver text default null)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order   public.orders;
  v_item    record;
  v_stock   numeric;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order % not found', p_order_id;
  end if;

  if v_order.order_status in ('cancelled') then
    raise exception 'Cannot dispatch a cancelled order';
  end if;
  if v_order.order_status = 'dispatched' then
    return v_order;
  end if;

  for v_item in
    select oi.id, oi.product_id, oi.quantity
      from public.order_items oi
     where oi.order_id = p_order_id
  loop
    -- Oversell guard: product must have enough stock.
    select p.current_stock into v_stock
      from public.products p where p.id = v_item.product_id for update;
    if v_stock is null then
      raise exception 'Product for line item % no longer exists', v_item.id;
    end if;
    if v_stock < v_item.quantity then
      raise exception 'Insufficient stock for product %, available %, required %',
        v_item.product_id, v_stock, v_item.quantity;
    end if;

    insert into public.stock_transactions (product_id, type, quantity, supplier_or_order_ref, notes)
    values (v_item.product_id, 'OUT', -1 * v_item.quantity, v_order.order_number,
            'Sales dispatch ' || v_order.order_number);
  end loop;

  update public.orders
     set order_status = 'dispatched',
         updated_at = now(),
         vehicle_number = coalesce(p_vehicle, vehicle_number),
         driver_contact = coalesce(p_driver, driver_contact)
   where id = p_order_id
   returning * into v_order;

  return v_order;
end;
$$;

-- ---------------------------------------------------------------------------
-- MARK DELIVERED (collect balance, fully paid)
-- ---------------------------------------------------------------------------
create or replace function public.complete_delivery(p_order_id uuid, p_balance_collected numeric default 0)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order      public.orders;
  v_collected  numeric;
  v_new_advance numeric;
  v_balance    numeric;
  v_pay_status payment_status;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.order_status not in ('dispatched', 'advance_paid') then
    raise exception 'Order must be dispatched before completing delivery';
  end if;

  v_collected  := coalesce(p_balance_collected, 0);
  v_new_advance := v_order.advance_paid + v_collected;
  v_balance    := greatest(v_order.total_amount - v_new_advance, 0);
  v_pay_status := case when v_balance <= 0 then 'paid' else 'partial' end;

  update public.orders
     set order_status   = 'delivered',
         advance_paid   = v_new_advance,
         balance_due    = v_balance,
         payment_status = v_pay_status,
         updated_at = now()
   where id = p_order_id
   returning * into v_order;

  return v_order;
end;
$$;

-- ---------------------------------------------------------------------------
-- CANCEL ORDER -> restock if stock was already deducted
-- ---------------------------------------------------------------------------
create or replace function public.cancel_order(p_order_id uuid, p_reason text default null)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_item record;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;

  if v_order.order_status = 'delivered' then
    raise exception 'Delivered orders cannot be cancelled';
  end if;

  if v_order.order_status = 'dispatched' then
    -- Return items to stock.
    for v_item in
      select oi.product_id, oi.quantity from public.order_items oi where oi.order_id = p_order_id
    loop
      insert into public.stock_transactions (product_id, type, quantity, supplier_or_order_ref, notes)
      values (v_item.product_id, 'IN', v_item.quantity, v_order.order_number,
              'Restock on cancellation ' || coalesce(p_reason,''));
    end loop;
  end if;

  update public.orders
     set order_status = 'cancelled',
         payment_status = case when advance_paid > 0 then 'refunded' else 'unpaid' end,
         notes = coalesce(notes, '') || E'\nCancelled: ' || coalesce(p_reason, 'no reason'),
         updated_at = now()
   where id = p_order_id
   returning * into v_order;

  return v_order;
end;
$$;

-- ---------------------------------------------------------------------------
-- RECEIVE STOCK (Stock In / Procurement log)
-- ---------------------------------------------------------------------------
create or replace function public.receive_stock(
  p_product_id uuid, p_quantity numeric, p_supplier text default null, p_notes text default null, p_date date default current_date)
returns public.stock_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tx public.stock_transactions;
begin
  insert into public.stock_transactions (product_id, type, quantity, supplier_or_order_ref, notes, tx_date)
  values (p_product_id, 'IN', p_quantity, p_supplier, p_notes, coalesce(p_date, current_date))
  returning * into v_tx;
  return v_tx;
end;
$$;

-- ===========================================================================
-- PRICING HELPERS (mirrors backend services/pricing.js for SQL-side jobs)
-- ===========================================================================
create or replace function public.effective_price(p_price numeric, p_qty numeric, p_tier_qty numeric, p_tier_percent numeric)
returns numeric
language sql
immutable
as $$
  select p_price * (case when p_qty is not null and p_tier_qty is not null and p_qty >= p_tier_qty
                         then (100 - coalesce(p_tier_percent,0)) / 100.0
                         else 1 end);
$$;

-- ===========================================================================
-- ANALYTICS VIEW  (admin dashboard metrics)
-- ===========================================================================
create or replace view public.v_sales_daily as
  select date_trunc('day', created_at)::date as day,
         count(*) filter (where order_status not in ('cancelled')) as orders,
         sum(total_amount) filter (where order_status not in ('cancelled')) as revenue
    from public.orders
   group by 1;

create or replace view public.v_product_health as
  select p.id, p.name, p.brand, p.unit_type, p.current_stock, p.minimum_alert_stock,
         p.current_stock < p.minimum_alert_stock as is_low_stock,
         case
           when p.current_stock <= 0 then 'out_of_stock'
           when p.current_stock < p.minimum_alert_stock then 'low'
           else 'in_stock'
         end as stock_status,
         c.name as category
    from public.products p
    join public.categories c on c.id = p.category_id;

-- ===========================================================================
-- ROW LEVEL SECURITY
-- Public (anon): can browse catalog + see live stock status.
-- Admin writes are performed via the backend service-role key (bypasses RLS).
-- Authenticated customers: can read their own orders + ledger rows for their product.
-- ===========================================================================
alter table public.categories        enable row level security;
alter table public.products          enable row level security;
alter table public.stock_transactions enable row level security;
alter table public.orders            enable row level security;
alter table public.order_items       enable row level security;
alter table public.invoices          enable row level security;

-- Categories & Products: readable by everyone
create policy "categories_read_public" on public.categories
  for select using (true);

create policy "products_read_public" on public.products
  for select using (true);

-- Stock ledger: NOT publicly readable (hides supplier details). Only service role.
-- but let authenticated users see ledger rows touching their delivered products
create policy "stock_tx_read_authenticated_own" on public.stock_transactions
  for select using (
    auth.role() = 'authenticated'
    and exists (
      select 1 from public.order_items oi
       join public.orders o on o.id = oi.order_id
      where oi.product_id = stock_transactions.product_id
        and o.user_id = auth.uid()
        and o.order_status = 'delivered'
    )
  );

-- Orders: authenticated customer can read + update only their own rows
create policy "orders_read_own" on public.orders
  for select using (auth.role() = 'authenticated' and (user_id = auth.uid() or user_id is null));

create policy "orders_update_own" on public.orders
  for update using (auth.role() = 'authenticated' and user_id = auth.uid());

-- Order items: owned via parent order
create policy "order_items_read_own" on public.order_items
  for select using (
    auth.role() = 'authenticated'
    and exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
  );

-- Invoices: authenticated can read invoices on their orders
create policy "invoices_read_own" on public.invoices
  for select using (
    auth.role() = 'authenticated'
    and exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
  );

-- ===========================================================================
-- UPDATED_AT auto-touch
-- ===========================================================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_products_touch on public.products;
create trigger trg_products_touch before update on public.products
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_orders_touch on public.orders;
create trigger trg_orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();