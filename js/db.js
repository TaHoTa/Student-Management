import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_JS } from './config.js';

let client = null;
export async function getClient() {
  if (client) return client;
  if (window.__MOCK_SUPA) return (client = window.__MOCK_SUPA);   // used only by local tests
  const { createClient } = await import(SUPABASE_JS);
  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  return client;
}
export const configured = () => window.__MOCK_SUPA || !SUPABASE_URL.includes('YOUR-PROJECT');

// Friendly error text for common database / auth errors
export function errText(e, t) {
  const m = String(e?.message || e || '');
  const map = [
    ['Invalid login credentials', 'errLogin'], ['Email not confirmed', 'errConfirm'],
    ['User already registered', 'errExists'], ['Password should be', 'errPassword'],
    ['slug_taken', 'errSlugTaken'], ['invalid_slug', 'errSlugInvalid'], ['reserved_slug', 'errSlugTaken'],
    ['row-level security', 'errDenied'], ['not allowed', 'errDenied'],
    ['students_batch_id_centre_id_fkey', 'errBatchHasStudents'], ['violates foreign key', 'errInUse'],
    ['Failed to fetch', 'errNetwork'], ['NetworkError', 'errNetwork'], ['rate limit', 'errRate']
  ];
  for (const [k, v] of map) if (m.includes(k)) return t(v);
  return m || t('errGeneric');
}
