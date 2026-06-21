import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(dir, '../.env.local');
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;
console.log('URL:', url);

const sb = createClient(url, key);
const testName = `test_${Date.now()}`;
const pw = 'hello123';

const reg = await sb.rpc('register_account', { p_name: testName, p_password: pw });
if (reg.error) {
  console.error('REGISTER FAILED:', reg.error);
  process.exit(1);
}
console.log('Register OK:', reg.data);

const login = await sb.rpc('login_account', { p_name: testName, p_password: pw });
if (login.error) {
  console.error('LOGIN FAILED:', login.error);
  process.exit(1);
}
console.log('Login OK:', login.data);

const bad = await sb.rpc('login_account', { p_name: testName, p_password: 'wrong' });
console.log('Bad password (expected error):', bad.error?.message ?? bad.data);
