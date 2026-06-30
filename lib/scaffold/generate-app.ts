// Pure app-starter generator — turns a set of picked app-kit modules into a
// minimal but RUNNABLE Next.js (App Router) project as a flat list of
// { path, content } files. The app-kit counterpart to lib/scaffold/generate.ts
// (which targets game-kit + Vite); this one is deliberately standalone so the two
// families evolve independently.
//
// No I/O: every output is a string. The caller (a route) zips these together with
// the vendored app-kit source. The generated app imports + wires each SELECTED
// app-kit module so the result compiles and runs after `pnpm i && pnpm dev`:
//   - app-auth   → a Supabase-backed AuthClient adapter + a useSession() hook.
//   - app-layout → the shell config + theme controller drive the root layout.
//   - app-deploy → an env schema validated at startup + a .env.example.
//
// Unknown / not-built moduleIds are ignored. Every import emitted here resolves
// against app-kit's REAL public API (see vendor/app-kit/src), aliased in the
// generated tsconfig to the vendored source.

import { slugify } from "@/lib/util/slug";
import { APP_SYSTEMS } from "@/lib/kit/catalog";

export type AppScaffoldFile = { path: string; content: string };

export type AppScaffoldOptions = {
  name: string;
  /** app-kit module ids to wire in (see APP_SYSTEMS). Unknown ids ignored. */
  moduleIds: readonly string[];
};

/** The app-kit module ids this generator knows how to wire. */
export const APP_AUTH = "app-auth";
export const APP_LAYOUT = "app-layout";
export const APP_DEPLOY = "app-deploy";

/**
 * The module ids this generator knows how to wire, in deterministic emit order.
 * These are the source of truth for ordering; the catalog (APP_SYSTEMS) only
 * gates whether a known id is enabled (a row explicitly marked `planned` is
 * skipped). Ids NOT yet in APP_SYSTEMS are still wired — the catalog rows for
 * app-layout / app-deploy land in a separate thread, so the generator can't
 * depend on them existing yet.
 */
const KNOWN_MODULES: readonly string[] = [APP_AUTH, APP_LAYOUT, APP_DEPLOY];

/** Catalog ids explicitly marked `planned` (not yet scaffoldable). */
function plannedModuleIds(): Set<string> {
  return new Set(
    APP_SYSTEMS.filter((s) => s.status === "planned").map((s) => s.id),
  );
}

/**
 * Resolve requested ids to the ordered, deduped subset this generator knows how
 * to wire and the catalog hasn't marked `planned`. Order follows KNOWN_MODULES
 * so output is deterministic regardless of input order.
 */
function resolveModules(moduleIds: readonly string[]): string[] {
  const requested = new Set(moduleIds);
  const planned = plannedModuleIds();
  return KNOWN_MODULES.filter((id) => requested.has(id) && !planned.has(id));
}

// ── package.json ─────────────────────────────────────────────────────────────

function buildPackageJson(slug: string, modules: readonly string[]): string {
  // app-kit is VENDORED into the starter (under vendor/app-kit) rather than a
  // dependency — the kit repo is private, so a `github:` dep wouldn't install.
  // It's aliased in tsconfig. Only the modules' runtime deps are listed.
  const deps: Record<string, string> = {
    next: "^15.1.6",
    react: "^19.0.0",
    "react-dom": "^19.0.0",
  };
  // The auth adapter realizes app-kit's AuthClient over @supabase/supabase-js.
  if (modules.includes(APP_AUTH)) deps["@supabase/supabase-js"] = "^2.47.10";

  const devDeps: Record<string, string> = {
    "@types/node": "^22.10.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    typescript: "^5.7.3",
  };

  const pkg = {
    name: slug,
    private: true,
    version: "0.1.0",
    scripts: { dev: "next dev", build: "next build", start: "next start" },
    dependencies: sortKeys(deps),
    devDependencies: sortKeys(devDeps),
  };
  return JSON.stringify(pkg, null, 2) + "\n";
}

function sortKeys(record: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of Object.keys(record).sort()) {
    const value = record[key];
    if (value !== undefined) out[key] = value;
  }
  return out;
}

// ── tsconfig / next.config ─────────────────────────────────────────────────

function buildTsconfig(): string {
  const tsconfig = {
    compilerOptions: {
      target: "ES2022",
      lib: ["dom", "dom.iterable", "esnext"],
      module: "esnext",
      moduleResolution: "bundler",
      strict: true,
      noUncheckedIndexedAccess: true,
      esModuleInterop: true,
      skipLibCheck: true,
      noEmit: true,
      jsx: "preserve",
      resolveJsonModule: true,
      isolatedModules: true,
      incremental: true,
      plugins: [{ name: "next" }],
      paths: {
        "@/*": ["./*"],
        // app-kit is vendored under vendor/app-kit (the kit repo is private).
        "app-kit": ["./vendor/app-kit/src/index.ts"],
      },
    },
    include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
    exclude: ["node_modules"],
  };
  return JSON.stringify(tsconfig, null, 2) + "\n";
}

function buildNextConfig(): string {
  // Transpile the vendored TS source (Next won't compile node_modules by default,
  // and app-kit lives under vendor/ as raw .ts — transpilePackages covers it).
  return [
    `import type { NextConfig } from "next";`,
    ``,
    `const nextConfig: NextConfig = {};`,
    ``,
    `export default nextConfig;`,
    ``,
  ].join("\n");
}

// ── app-kit wiring files ─────────────────────────────────────────────────────

/** Supabase adapter realizing app-kit's AuthClient (only when app-auth picked). */
const SUPABASE_AUTH_TS = `/**
 * Supabase adapter — realizes app-kit's provider-agnostic \`AuthClient\` over
 * @supabase/supabase-js. UI imports \`authClient\` (and the \`useSession\` hook),
 * never the Supabase SDK directly, so the provider can be swapped without
 * touching app code — the seam app-kit's auth module documents.
 */
import { createClient, type Session as SupabaseSession } from "@supabase/supabase-js";
import {
  createAuthClient,
  ANON_SESSION,
  type AuthClient,
  type Session,
} from "app-kit";
import { env } from "./env";

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

function toSession(s: SupabaseSession | null): Session {
  if (!s) return ANON_SESSION;
  return {
    user: { id: s.user.id, email: s.user.email ?? null },
    accessToken: s.access_token,
  };
}

const { client, setSession } = createAuthClient({
  async signIn() {
    // TODO: pick your real flow (OAuth / magic-link / password). Stub for now.
    await supabase.auth.signInAnonymously();
  },
  async signOut() {
    await supabase.auth.signOut();
  },
});

// Pump provider changes into the app-kit store.
void supabase.auth.getSession().then(({ data }) => setSession(toSession(data.session)));
supabase.auth.onAuthStateChange((_event, session) => setSession(toSession(session)));

export const authClient: AuthClient = client;
`;

/** A tiny React hook over the AuthClient seam (only when app-auth picked). */
const USE_SESSION_TSX = `"use client";

import { useSyncExternalStore } from "react";
import { authClient } from "./supabaseAuth";
import type { Session } from "app-kit";

/**
 * Subscribe a component to the current auth session. Backed by app-kit's
 * \`AuthClient.onSession\` seam, so it works against any provider adapter.
 */
export function useSession(): Session {
  return useSyncExternalStore(
    (cb) => authClient.onSession(cb),
    () => authClient.getSession(),
    () => authClient.getSession(),
  );
}
`;

/** Startup env validation using app-kit's deploy module (always emitted). */
function buildEnvTs(modules: readonly string[]): string {
  const usesAuth = modules.includes(APP_AUTH);
  // Without auth there are no required vars — start from an empty schema so the
  // app still boots. With auth, validate the Supabase vars the adapter reads.
  const schemaExpr = usesAuth ? "SUPABASE_ENV" : "[]";
  const importLine = usesAuth
    ? `import { parseEnv, SUPABASE_ENV } from "app-kit";`
    : `import { parseEnv } from "app-kit";`;

  return `/**
 * Validated environment — parsed once at module load via app-kit's deploy module.
 * A missing required var throws here (loudly, at boot) rather than failing
 * mysteriously deep in a request. See .env.example for the variables to set.
 */
${importLine}

const result = parseEnv(${schemaExpr}, process.env);

if (!result.ok) {
  throw new Error(
    \`Missing required environment variables: \${result.missing.join(", ")}. \` +
      \`Copy .env.example to .env.local and fill them in.\`,
  );
}

export const env = result.values as Record<string, string> & {
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
};
`;
}

// ── root layout + page ───────────────────────────────────────────────────────

function buildShellTs(name: string, modules: readonly string[]): string {
  // The shell config drives metadata + the header nav. Theme controller is wired
  // only when the layout module is picked.
  const usesLayout = modules.includes(APP_LAYOUT);
  if (!usesLayout) {
    return `import { createShellConfig } from "app-kit";

export const shell = createShellConfig({
  title: ${JSON.stringify(name)},
  description: ${JSON.stringify(`${name} — a Crucible app-kit starter.`)},
});
`;
  }
  return `import { createShellConfig } from "app-kit";

/** The app's shell config — title, nav, and default theme drive the root layout. */
export const shell = createShellConfig({
  title: ${JSON.stringify(name)},
  description: ${JSON.stringify(`${name} — a Crucible app-kit starter.`)},
  nav: [
    { label: "Home", href: "/" },
  ],
  defaultTheme: "light",
});
`;
}

function buildLayoutTsx(modules: readonly string[]): string {
  const usesLayout = modules.includes(APP_LAYOUT);

  const imports: string[] = [
    `import type { Metadata } from "next";`,
    `import { appMetadata } from "app-kit";`,
    `import { shell } from "@/lib/shell";`,
  ];
  if (usesLayout) imports.push(`import "@/app/theme.css";`);

  const lines: string[] = [];
  lines.push(...imports);
  lines.push(``);
  lines.push(`export const metadata: Metadata = appMetadata(shell);`);
  lines.push(``);
  lines.push(`export default function RootLayout({`);
  lines.push(`  children,`);
  lines.push(`}: {`);
  lines.push(`  children: React.ReactNode;`);
  lines.push(`}) {`);
  lines.push(`  return (`);
  lines.push(
    `    <html lang="en"${usesLayout ? ` data-theme={shell.defaultTheme}` : ""}>`,
  );
  lines.push(`      <body>`);
  if (usesLayout) {
    lines.push(`        <header`);
    lines.push(
      `          style={{ display: "flex", gap: 16, padding: 16, borderBottom: "1px solid var(--border)" }}`,
    );
    lines.push(`        >`);
    lines.push(`          <strong>{shell.title}</strong>`);
    lines.push(`          <nav style={{ display: "flex", gap: 12 }}>`);
    lines.push(`            {shell.nav.map((item) => (`);
    lines.push(
      `              <a key={item.href} href={item.href} style={{ color: "var(--accent)" }}>`,
    );
    lines.push(`                {item.label}`);
    lines.push(`              </a>`);
    lines.push(`            ))}`);
    lines.push(`          </nav>`);
    lines.push(`        </header>`);
  }
  lines.push(`        <main style={{ padding: 16 }}>{children}</main>`);
  lines.push(`      </body>`);
  lines.push(`    </html>`);
  lines.push(`  );`);
  lines.push(`}`);
  lines.push(``);
  return lines.join("\n");
}

function buildPageTsx(name: string, modules: readonly string[]): string {
  const usesAuth = modules.includes(APP_AUTH);

  if (!usesAuth) {
    return `export default function Home() {
  return (
    <section>
      <h1>${escapeJsxText(name)}</h1>
      <p>Scaffolded from Crucible&apos;s app-kit.</p>
    </section>
  );
}
`;
  }

  // Auth picked → a client page that reads the session via the hook.
  return `"use client";

import { useSession } from "@/lib/useSession";
import { authClient } from "@/lib/supabaseAuth";

export default function Home() {
  const session = useSession();
  const signedIn = session.user !== null;

  return (
    <section>
      <h1>${escapeJsxText(name)}</h1>
      <p>Scaffolded from Crucible&apos;s app-kit.</p>
      <p>
        {signedIn ? \`Signed in as \${session.user?.email ?? session.user?.id}\` : "Signed out"}
      </p>
      <button
        type="button"
        onClick={() => (signedIn ? authClient.signOut() : authClient.signIn())}
      >
        {signedIn ? "Sign out" : "Sign in"}
      </button>
    </section>
  );
}
`;
}

function escapeJsxText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\{/g, "&#123;")
    .replace(/\}/g, "&#125;");
}

// ── static project files ───────────────────────────────────────────────────

function buildGitignore(): string {
  return [
    `node_modules/`,
    `.next/`,
    `out/`,
    `*.local`,
    `.env`,
    `.env.*`,
    `.DS_Store`,
    ``,
  ].join("\n");
}

function buildNextEnvDts(): string {
  return [
    `/// <reference types="next" />`,
    `/// <reference types="next/image-types/global" />`,
    ``,
    `// NOTE: This file should not be edited`,
    ``,
  ].join("\n");
}

function buildReadme(
  name: string,
  modules: readonly string[],
): string {
  const moduleLines =
    modules.length === 0
      ? ["- _(none — add modules and regenerate)_"]
      : modules.map((id) => {
          const sys = APP_SYSTEMS.find((s) => s.id === id);
          return `- ${sys?.name ?? id} (\`${id}\`)`;
        });

  const lines: string[] = [
    `# ${name}`,
    ``,
    `A runnable **Next.js (App Router)** starter scaffolded from Crucible's app-kit.`,
    ``,
    `## Included modules`,
    ``,
    ...moduleLines,
    ``,
    `## Run`,
    ``,
    "```sh",
    `pnpm i`,
  ];

  if (modules.includes(APP_AUTH)) {
    lines.push(
      `cp .env.example .env.local   # then fill in your Supabase URL + anon key`,
    );
  }

  lines.push(`pnpm dev`, "```", ``);

  if (modules.includes(APP_AUTH)) {
    lines.push(
      `## Auth`,
      ``,
      `\`lib/supabaseAuth.ts\` adapts Supabase to app-kit's provider-agnostic`,
      `\`AuthClient\` seam; \`lib/useSession.ts\` exposes it as a React hook. UI never`,
      `imports the Supabase SDK directly, so the provider can be swapped without`,
      `touching app code. Required env vars are validated at boot in \`lib/env.ts\`.`,
      ``,
    );
  }

  if (modules.includes(APP_LAYOUT)) {
    lines.push(
      `## Layout`,
      ``,
      `\`lib/shell.ts\` describes the app shell (title, nav, default theme) as data;`,
      `\`app/layout.tsx\` renders it. \`app/theme.css\` is generated from app-kit's`,
      `theme tokens — flip \`data-theme="dark"\` on \`<html>\` to switch modes.`,
      ``,
    );
  }

  lines.push(
    `## Deploy`,
    ``,
    `\`vercel.json\` pins the pnpm install command for reproducible Vercel builds.`,
    modules.includes(APP_AUTH)
      ? `\`supabase/config.toml\` configures the local Supabase stack (\`supabase start\`).`
      : ``,
    ``,
    `\`app-kit\` is **vendored** under \`vendor/app-kit\` (aliased in tsconfig) — no`,
    `install needed.`,
    ``,
  );

  return lines.filter((l, i, arr) => !(l === "" && arr[i - 1] === "")).join("\n");
}

/**
 * Generate the full app starter as a flat list of files. Pure: deterministic
 * given the same options. Unknown / not-built moduleIds are ignored. The result
 * is a minimal but runnable Next.js App Router app wiring the picked app-kit
 * modules — `pnpm i && pnpm dev` after dropping in the vendored app-kit source.
 */
export function generateAppScaffold(opts: AppScaffoldOptions): AppScaffoldFile[] {
  const slug = slugify(opts.name) || "app";
  const modules = resolveModules(opts.moduleIds);
  const usesAuth = modules.includes(APP_AUTH);
  const usesLayout = modules.includes(APP_LAYOUT);

  const files: AppScaffoldFile[] = [
    { path: "package.json", content: buildPackageJson(slug, modules) },
    { path: "tsconfig.json", content: buildTsconfig() },
    { path: "next.config.ts", content: buildNextConfig() },
    { path: "next-env.d.ts", content: buildNextEnvDts() },
    { path: ".gitignore", content: buildGitignore() },
    { path: "lib/env.ts", content: buildEnvTs(modules) },
    { path: "lib/shell.ts", content: buildShellTs(opts.name, modules) },
    { path: "app/layout.tsx", content: buildLayoutTsx(modules) },
    { path: "app/page.tsx", content: buildPageTsx(opts.name, modules) },
    { path: "README.md", content: buildReadme(opts.name, modules) },
    // Deploy descriptors are always useful; emitted unconditionally.
    { path: "vercel.json", content: vercelJsonFile() },
  ];

  if (usesLayout) {
    files.push({ path: "app/theme.css", content: themeCssFile() });
  }

  if (usesAuth) {
    files.push(
      { path: "lib/supabaseAuth.ts", content: SUPABASE_AUTH_TS },
      { path: "lib/useSession.tsx", content: USE_SESSION_TSX },
      { path: ".env.example", content: envExampleFile() },
      { path: "supabase/config.toml", content: supabaseConfigFile(slug) },
    );
  }

  return files;
}

// ── lazy wrappers over app-kit's deploy/layout builders ──────────────────────
// Imported lazily-by-value (these are pure functions on the kit's public API) so
// the generator's output exactly matches what the vendored module would produce.

import {
  vercelJson,
  envExample,
  supabaseConfigToml,
  SUPABASE_ENV,
  themeStylesheet,
} from "@/vendor/app-kit/src/index";

function vercelJsonFile(): string {
  return vercelJson();
}

function envExampleFile(): string {
  return envExample(SUPABASE_ENV);
}

function supabaseConfigFile(slug: string): string {
  return supabaseConfigToml({ projectId: slug });
}

function themeCssFile(): string {
  return themeStylesheet();
}
