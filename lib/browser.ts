'use client';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
let client: SupabaseClient<Database> | undefined;
let initializationAttempted = false;

type DiagnosticError = {
  name?: string;
  message?: string;
  code?: string;
  status?: number;
};

function keyType(key: string) {
  if (key.startsWith('sb_publishable_')) return 'publishable';
  if (key.split('.').length === 3) return 'legacy-anon-jwt';
  return 'unknown';
}

export function logAdminAuthError(stage: string, error: unknown) {
  if (process.env.NODE_ENV !== 'development') return;
  const detail = (error && typeof error === 'object' ? error : {}) as DiagnosticError;
  console.error(`[admin-auth] ${stage}`, {
    name: detail.name ?? 'UnknownError',
    code: detail.code ?? 'unknown',
    status: detail.status ?? null,
    message: detail.message ?? String(error),
  });
}

export function browserDatabase() {
  if (client) return client;
  if (initializationAttempted) return null;
  initializationAttempted = true;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    logAdminAuthError('configuration', new Error('Supabase URL or publishable key is missing'));
    return null;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'https:' && !(parsedUrl.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsedUrl.hostname))) {
      throw new Error('Supabase URL must use HTTPS');
    }
  } catch (error) {
    logAdminAuthError('configuration', error);
    return null;
  }

  if (key.trim().length < 20) {
    logAdminAuthError('configuration', new Error('Supabase publishable key has an invalid format'));
    return null;
  }

  if (process.env.NODE_ENV === 'development') {
    console.info('[admin-auth] Supabase configuration', {
      origin: parsedUrl.origin,
      keyType: keyType(key),
    });
  }

  // Admin sessions last only in this browser tab, not on shared computers after the tab closes.
  try {
    client = createClient<Database>(parsedUrl.origin, key, {
      auth: {
        storage: typeof window !== 'undefined' ? window.sessionStorage : undefined,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  } catch (error) {
    logAdminAuthError('client-initialization', error);
    return null;
  }
  return client;
}
