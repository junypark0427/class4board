'use client';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
let client: SupabaseClient<Database> | undefined;
export function browserDatabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  // Admin sessions last only in this browser tab, not on shared computers after the tab closes.
  client ??= createClient<Database>(url, key, { auth: { storage: typeof window !== 'undefined' ? window.sessionStorage : undefined } });
  return client;
}
