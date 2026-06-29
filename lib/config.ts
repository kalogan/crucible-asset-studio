/**
 * Non-throwing config probes — safe to call during render/build before keys exist,
 * so pages can show a setup notice instead of crashing. (Validation that throws
 * lives in lib/env.ts and runs only when a provider is actually used.)
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}
