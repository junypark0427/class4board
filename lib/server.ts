import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { publicSupabaseKeyType } from './supabase-keys';

export type BrowserDatabaseConfig = { url: string; key: string };

function projectUrl() {
  const value = process.env.SUPABASE_URL;
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function publishableKey() {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  return key && publicSupabaseKeyType(key) ? key : null;
}

function secretKey() {
  const key = process.env.DATABASE_ADMIN_KEY;
  return key && key.length >= 20 ? key : null;
}

export function browserDatabaseConfig(): BrowserDatabaseConfig | null {
  const url = projectUrl();
  const key = publishableKey();
  return url && key ? { url, key } : null;
}

export function configured() {
  return Boolean(browserDatabaseConfig() && secretKey() && (process.env.COOLDOWN_SECRET?.length ?? 0) >= 32 && process.env.APP_ORIGIN);
}
export function database(privileged = false) {
  const url = projectUrl();
  const key = privileged ? secretKey() : publishableKey();
  if (!url || !key) throw new Error('Database configuration missing');
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) }
  });
}
