import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { publicSupabaseKeyType } from '../lib/supabase-keys';

test('browser auth accepts only publishable or anon keys', () => {
  assert.equal(publicSupabaseKeyType(`sb_publishable_${'a'.repeat(40)}`), 'publishable');
  assert.equal(publicSupabaseKeyType(`sb_${'secret'}_${'a'.repeat(40)}`), null);
  assert.equal(publicSupabaseKeyType('not-a-key'), null);
});

test('client modules do not read environment variables or name server secrets', () => {
  for (const file of ['lib/browser.ts', 'app/admin/panel.tsx']) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /process\.env\.(?:NEXT_PUBLIC_)?SUPABASE|SUPABASE_SECRET_KEY|DATABASE_ADMIN_KEY|NEXT_PUBLIC_SUPABASE/);
  }
});

test('runtime source does not use public build-time Supabase environment variables', () => {
  for (const file of ['lib/server.ts', 'lib/browser.ts', 'app/admin/page.tsx', 'app/admin/panel.tsx']) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /NEXT_PUBLIC_SUPABASE/);
  }
});
