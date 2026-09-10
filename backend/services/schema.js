const { serviceClient } = require('../config/supabase');

const ALTER_ORDERS_CUSTOMER_EMAIL =
  'alter table public.orders add column if not exists customer_email varchar(255)';

/**
 * Make sure orders.customer_email exists in the live DB.
 *
 * Auto-ALTER only works if Supabase exposes an `exec_sql(text)` RPC
 * (created once in the SQL editor, security definer). When that RPC is
 * missing we log the manual SQL and return `{ present: false }` so
 * callers can degrade gracefully instead of failing order placement.
 */
async function ensureCustomerEmailColumn() {
  let added = false;
  try {
    const { error } = await serviceClient.rpc('exec_sql', { sql: ALTER_ORDERS_CUSTOMER_EMAIL });
    added = !error;
    if (error && !String(error.code || error.message).includes('PGRST202')) {
      console.warn('[schema] exec_sql ALTER failed:', error.message);
    }
  } catch (e) {
    console.warn('[schema] exec_sql RPC unavailable — cannot auto-ALTER:', e.message);
  }

  const { error: checkErr } = await serviceClient.from('orders').select('customer_email').limit(0);

  if (checkErr) {
    console.warn('[schema] orders.customer_email is MISSING. Run this once in the Supabase SQL editor:');
    console.warn(`[schema]   ${ALTER_ORDERS_CUSTOMER_EMAIL}`);
    console.warn('[schema]   (or create a security-definer exec_sql(text) RPC to enable auto-migration)');
  } else if (added) {
    console.log('[schema] orders.customer_email added automatically.');
  }

  return { present: !checkErr, added };
}

module.exports = { ensureCustomerEmailColumn };