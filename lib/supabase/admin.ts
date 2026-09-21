import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. Bypasses RLS entirely — only ever import this
 * from a Route Handler / Server Action, NEVER from a Client Component, and
 * NEVER pass it (or its results wholesale) back to the browser un-checked.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY to be set (Supabase dashboard -> Project
 * Settings -> API -> service_role secret). Not required for normal app
 * operation — only for admin actions like creating staff accounts from the app.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured. Add it in Vercel -> Project Settings -> Environment Variables."
    );
  }

  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
