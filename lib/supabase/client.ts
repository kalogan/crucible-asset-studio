import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/env";

/**
 * Anon (public) Supabase client — safe for the browser. Read paths only;
 * privileged writes go through server route handlers using the service client.
 */
export function createBrowserClient(): SupabaseClient {
  const env = getPublicEnv();
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } },
  );
}
