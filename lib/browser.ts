'use client';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { publicSupabaseKeyType } from './supabase-keys';
import type { BrowserDatabaseConfig } from './server';
let client: SupabaseClient<Database> | undefined;
let initializationAttempted = false;

type DiagnosticError = {
  name?: string;
  message?: string;
  code?: string;
  status?: number;
};

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

export function browserDatabase(config?: BrowserDatabaseConfig | null) {
  if (client) return client;
  if (initializationAttempted) return null;
  if (!config) {
    logAdminAuthError('configuration', new Error('Supabase URL or publishable key is missing'));
    return null;
  }
  initializationAttempted = true;

  const { url, key } = config;

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

  const publicKeyType = publicSupabaseKeyType(key);
  if (!publicKeyType) {
    logAdminAuthError('configuration', new Error('Supabase client key must be a publishable or legacy anon key'));
    return null;
  }

  if (process.env.NODE_ENV === 'development') {
    console.info('[admin-auth] Supabase configuration', {
      origin: parsedUrl.origin,
      keyType: publicKeyType,
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
