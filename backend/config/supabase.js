const { createClient } = require('@supabase/supabase-js');
const config = require('../config');

/**
 * Service-role client. Used on the server only.
 * Bypasses RLS so the backend can run admin operations and
 * update stock ledgers atomically.
 */
const serviceClient = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
  auth: { persistSession: false },
});

/**
 * Anon client. Used for public read-only catalog access in hand-written
 * endpoints; RLS on anonymous role governs what it can see.
 */
const anonClient = createClient(config.supabase.url, config.supabase.anonKey, {
  auth: { persistSession: false },
});

/**
 * Create a Supabase client impersonating a JWT from a bearer token.
 * Used to honor RLS when the frontend authenticates.
 */
const clientForToken = (token) =>
  createClient(config.supabase.url, config.supabase.anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });

module.exports = { serviceClient, anonClient, clientForToken };

/** Small SQL helper to detect if a Supabase error was a failure. */
const isFailure = (result) => result && result.error;