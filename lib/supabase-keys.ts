export type PublicSupabaseKeyType = 'publishable' | 'legacy-anon-jwt';

function jwtRole(key: string) {
  try {
    const payload = key.split('.')[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return JSON.parse(atob(padded))?.role ?? null;
  } catch {
    return null;
  }
}

export function publicSupabaseKeyType(key: string): PublicSupabaseKeyType | null {
  if (key.startsWith('sb_publishable_') && key.length >= 32) return 'publishable';
  if (key.split('.').length === 3 && jwtRole(key) === 'anon') return 'legacy-anon-jwt';
  return null;
}
