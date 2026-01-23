import { createClient } from '@supabase/supabase-js';

/**
 * Creates a Supabase client using env vars.
 *
 * Returns null when not configured so local JSON storage can be used as a fallback.
 */
export function getSupabaseClientFromEnv() {
  const url = process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_KEY;

  if (!url || !key) return null;

  return createClient(url, key, {
    auth: { persistSession: false }
  });
}

