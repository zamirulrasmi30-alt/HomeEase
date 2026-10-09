-- ============================================================================
-- 003 — Customer email column for order notifications
-- Required only if 001_schema.sql was applied BEFORE the customer_email
-- column was added. The API now auto-detects the column, but adding it here
-- enables full order emails + reply-to.
-- Run once in the Supabase SQL editor:
-- ============================================================================
alter table public.orders add column if not exists customer_email varchar(255);