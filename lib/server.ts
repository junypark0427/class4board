import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export function configured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY && (process.env.COOLDOWN_SECRET?.length ?? 0) >= 32 && process.env.APP_ORIGIN);
}
export function database(privileged = false) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = privileged ? process.env.SUPABASE_SERVICE_ROLE_KEY : process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Database configuration missing');
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) }
  });
}
