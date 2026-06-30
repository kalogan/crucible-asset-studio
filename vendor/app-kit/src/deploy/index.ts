/**
 * app-kit/deploy — env schema + deploy descriptors for the studio's web apps.
 *
 * DEPENDENCY-FREE + framework-free: pure data + string builders, unit-testable
 * without a toolchain (same shape as game-kit's `presets` module, but aimed at a
 * Next.js-on-Vercel + Supabase stack rather than a Vite/Fly game server).
 *
 * Three jobs:
 *   - `parseEnv(schema, source)` → validate + narrow `process.env`-style input to
 *     a typed record, collecting every missing-required key (no throw-on-first).
 *   - `vercelJson(...)`          → a vercel.json string for a Next.js app.
 *   - `supabaseConfigToml(...)`  → a minimal supabase/config.toml string for the
 *     local stack (used by `supabase start`).
 *
 * The env schema is the seam the auth + layout modules depend on at the edge:
 * an adapter reads the validated values (e.g. the Supabase URL + anon key) rather
 * than touching `process.env` directly, so a missing var fails loudly at boot.
 */

/** One declared environment variable. */
export interface EnvVar {
  /** The variable name (e.g. "NEXT_PUBLIC_SUPABASE_URL"). */
  key: string;
  /** Required at boot. Default true. */
  required?: boolean;
  /** Value used when absent + not required. */
  default?: string;
  /** Human description, surfaced in the generated `.env.example`. */
  description?: string;
}

/** A declared set of environment variables an app needs. */
export type EnvSchema = readonly EnvVar[];

/**
 * The Supabase-backed default schema the auth module's adapter reads. Mirrors the
 * studio's existing `@supabase/supabase-js` setup (public URL + anon key).
 */
export const SUPABASE_ENV: EnvSchema = [
  {
    key: "NEXT_PUBLIC_SUPABASE_URL",
    required: true,
    description: "Supabase project URL (https://<ref>.supabase.co).",
  },
  {
    key: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    required: true,
    description: "Supabase anon/public API key (safe to expose to the browser).",
  },
] as const;

/** Result of {@link parseEnv}: either the typed values or the missing keys. */
export type EnvResult =
  | { ok: true; values: Record<string, string> }
  | { ok: false; missing: string[] };

/**
 * Validate a `process.env`-style record against a schema. Applies defaults for
 * absent optional vars and collects EVERY missing required key (so boot reports
 * all problems at once, not just the first). Pure — no `process` access.
 */
export function parseEnv(schema: EnvSchema, source: Record<string, string | undefined>): EnvResult {
  const values: Record<string, string> = {};
  const missing: string[] = [];

  for (const v of schema) {
    const raw = source[v.key];
    if (raw !== undefined && raw !== "") {
      values[v.key] = raw;
      continue;
    }
    if (v.default !== undefined) {
      values[v.key] = v.default;
      continue;
    }
    if (v.required ?? true) missing.push(v.key);
  }

  if (missing.length > 0) return { ok: false, missing };
  return { ok: true, values };
}

/**
 * Render a `.env.example` from a schema — one `KEY=` line per var with its
 * description as a leading comment. Drop this in the repo so a fresh clone knows
 * which vars to set. Deterministic.
 */
export function envExample(schema: EnvSchema): string {
  const lines: string[] = [];
  for (const v of schema) {
    if (v.description) lines.push(`# ${v.description}`);
    const required = (v.required ?? true) ? "" : " (optional)";
    if (!v.description && required) lines.push(`#${required}`);
    lines.push(`${v.key}=${v.default ?? ""}`);
    lines.push("");
  }
  return lines.join("\n");
}

export interface VercelJsonOptions {
  /** Framework Vercel detects. Default "nextjs". */
  framework?: string | null;
  /** Install command. Default "pnpm install --frozen-lockfile". */
  installCommand?: string;
  /** Build command. Default null (let the framework preset decide). */
  buildCommand?: string | null;
}

/**
 * A vercel.json for a Next.js app. Unlike the game-kit SPA preset (static client
 * + rewrites), this leans on Vercel's Next.js framework preset and just pins the
 * pnpm install command so CI is reproducible.
 */
export function vercelJson(opts: VercelJsonOptions = {}): string {
  const config: {
    $schema: string;
    framework: string | null;
    installCommand: string;
    buildCommand?: string;
  } = {
    $schema: "https://openapi.vercel.sh/vercel.json",
    framework: opts.framework === undefined ? "nextjs" : opts.framework,
    installCommand: opts.installCommand ?? "pnpm install --frozen-lockfile",
  };
  if (opts.buildCommand != null) config.buildCommand = opts.buildCommand;

  return JSON.stringify(config, null, 2) + "\n";
}

export interface SupabaseConfigOptions {
  /** Local project id (the `project_id` slug). */
  projectId: string;
  /** API port for `supabase start`. Default 54321. */
  apiPort?: number;
  /** Postgres port for the local db. Default 54322. */
  dbPort?: number;
  /** Supabase Studio port. Default 54323. */
  studioPort?: number;
}

/**
 * A minimal supabase/config.toml for the local stack (`supabase start`). Covers
 * the api/db/studio ports the studio's apps use; everything else falls back to
 * the CLI defaults. String output so it drops straight into a scaffold.
 */
export function supabaseConfigToml(opts: SupabaseConfigOptions): string {
  const apiPort = opts.apiPort ?? 54321;
  const dbPort = opts.dbPort ?? 54322;
  const studioPort = opts.studioPort ?? 54323;

  return `# supabase/config.toml — generated by app-kit deploy.supabaseConfigToml().
# Local development stack ports for \`supabase start\`.
project_id = "${opts.projectId}"

[api]
enabled = true
port = ${apiPort}

[db]
port = ${dbPort}

[studio]
enabled = true
port = ${studioPort}
`;
}
