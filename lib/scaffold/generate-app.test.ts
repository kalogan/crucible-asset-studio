import { describe, it, expect } from "vitest";
import {
  generateAppScaffold,
  APP_AUTH,
  APP_LAYOUT,
  APP_DEPLOY,
  type AppScaffoldFile,
} from "./generate-app";

function fileMap(files: AppScaffoldFile[]): Map<string, string> {
  return new Map(files.map((f) => [f.path, f.content]));
}

describe("generateAppScaffold — file tree", () => {
  it("emits a base Next.js app even with no modules", () => {
    const files = generateAppScaffold({ name: "My App", moduleIds: [] });
    const paths = files.map((f) => f.path);
    expect(paths).toContain("package.json");
    expect(paths).toContain("tsconfig.json");
    expect(paths).toContain("next.config.ts");
    expect(paths).toContain("app/layout.tsx");
    expect(paths).toContain("app/page.tsx");
    expect(paths).toContain("vercel.json");
    // Auth-only files absent when not picked.
    expect(paths).not.toContain("lib/supabaseAuth.ts");
    expect(paths).not.toContain(".env.example");
    // Layout-only files absent when not picked.
    expect(paths).not.toContain("app/theme.css");
  });

  it("adds auth files when app-auth is picked", () => {
    const paths = generateAppScaffold({
      name: "A",
      moduleIds: [APP_AUTH],
    }).map((f) => f.path);
    expect(paths).toContain("lib/supabaseAuth.ts");
    expect(paths).toContain("lib/useSession.tsx");
    expect(paths).toContain(".env.example");
    expect(paths).toContain("supabase/config.toml");
  });

  it("adds theme.css when app-layout is picked", () => {
    const paths = generateAppScaffold({
      name: "A",
      moduleIds: [APP_LAYOUT],
    }).map((f) => f.path);
    expect(paths).toContain("app/theme.css");
  });
});

describe("generateAppScaffold — package.json", () => {
  it("slugifies the name + has next/react and next scripts", () => {
    const pkg = JSON.parse(
      fileMap(generateAppScaffold({ name: "My Cool App!", moduleIds: [] })).get(
        "package.json",
      ) as string,
    ) as {
      name: string;
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
    };
    expect(pkg.name).toBe("my-cool-app");
    expect(pkg.scripts).toEqual({
      dev: "next dev",
      build: "next build",
      start: "next start",
    });
    expect(pkg.dependencies["next"]).toBeDefined();
    expect(pkg.dependencies["react"]).toBeDefined();
  });

  it("adds @supabase/supabase-js ONLY when auth is picked", () => {
    const withAuth = JSON.parse(
      fileMap(generateAppScaffold({ name: "A", moduleIds: [APP_AUTH] })).get(
        "package.json",
      ) as string,
    ) as { dependencies: Record<string, string> };
    expect(withAuth.dependencies["@supabase/supabase-js"]).toBeDefined();

    const without = JSON.parse(
      fileMap(generateAppScaffold({ name: "A", moduleIds: [APP_LAYOUT] })).get(
        "package.json",
      ) as string,
    ) as { dependencies: Record<string, string> };
    expect(without.dependencies["@supabase/supabase-js"]).toBeUndefined();
  });

  it("vendors app-kit (no github dep) + aliases it in tsconfig", () => {
    const map = fileMap(generateAppScaffold({ name: "A", moduleIds: [APP_AUTH] }));
    const pkg = JSON.parse(map.get("package.json") as string) as {
      dependencies: Record<string, string>;
    };
    expect(pkg.dependencies["app-kit"]).toBeUndefined();
    const tsconfig = map.get("tsconfig.json") as string;
    expect(tsconfig).toContain("app-kit");
    expect(tsconfig).toContain("./vendor/app-kit/src/index.ts");
  });
});

describe("generateAppScaffold — module wiring", () => {
  it("auth page reads the session via useSession + wires sign-in/out", () => {
    const map = fileMap(generateAppScaffold({ name: "A", moduleIds: [APP_AUTH] }));
    const page = map.get("app/page.tsx") as string;
    expect(page).toContain('import { useSession }');
    expect(page).toContain("authClient.signIn()");
    expect(page).toContain("authClient.signOut()");

    const adapter = map.get("lib/supabaseAuth.ts") as string;
    expect(adapter).toContain('from "app-kit"');
    expect(adapter).toContain("createAuthClient");
    expect(adapter).toContain('from "@supabase/supabase-js"');
  });

  it("env validates the Supabase schema when auth is picked", () => {
    const env = fileMap(
      generateAppScaffold({ name: "A", moduleIds: [APP_AUTH] }),
    ).get("lib/env.ts") as string;
    expect(env).toContain("parseEnv");
    expect(env).toContain("SUPABASE_ENV");
  });

  it("env uses an empty schema when auth is NOT picked", () => {
    const env = fileMap(
      generateAppScaffold({ name: "A", moduleIds: [APP_LAYOUT] }),
    ).get("lib/env.ts") as string;
    expect(env).toContain("parseEnv([], process.env)");
    expect(env).not.toContain("SUPABASE_ENV");
  });

  it("layout renders the shell header + nav when app-layout is picked", () => {
    const map = fileMap(generateAppScaffold({ name: "A", moduleIds: [APP_LAYOUT] }));
    const layout = map.get("app/layout.tsx") as string;
    expect(layout).toContain("appMetadata(shell)");
    expect(layout).toContain("shell.nav.map");
    expect(layout).toContain('data-theme={shell.defaultTheme}');
    expect(layout).toContain('import "@/app/theme.css"');

    const theme = map.get("app/theme.css") as string;
    expect(theme).toContain(":root");
    expect(theme).toContain('[data-theme="dark"]');
  });

  it("layout has no header/theme import when app-layout is NOT picked", () => {
    const layout = fileMap(
      generateAppScaffold({ name: "A", moduleIds: [] }),
    ).get("app/layout.tsx") as string;
    expect(layout).not.toContain("shell.nav.map");
    expect(layout).not.toContain('import "@/app/theme.css"');
  });
});

describe("generateAppScaffold — determinism + robustness", () => {
  it("is deterministic regardless of moduleId order", () => {
    const a = generateAppScaffold({
      name: "A",
      moduleIds: [APP_AUTH, APP_LAYOUT, APP_DEPLOY],
    });
    const b = generateAppScaffold({
      name: "A",
      moduleIds: [APP_DEPLOY, APP_LAYOUT, APP_AUTH],
    });
    expect(a).toEqual(b);
  });

  it("ignores unknown / not-built module ids", () => {
    const paths = generateAppScaffold({
      name: "A",
      moduleIds: ["totally-made-up", APP_LAYOUT],
    }).map((f) => f.path);
    expect(paths).toContain("app/theme.css"); // layout still wired
    // No file references the bogus id.
    const files = generateAppScaffold({
      name: "A",
      moduleIds: ["totally-made-up"],
    });
    for (const f of files) expect(f.content).not.toContain("totally-made-up");
  });

  it("escapes the app name in the page heading", () => {
    const page = fileMap(
      generateAppScaffold({ name: "A <b> {x}", moduleIds: [] }),
    ).get("app/page.tsx") as string;
    expect(page).toContain("&lt;b&gt;");
    expect(page).toContain("&#123;x&#125;");
    expect(page).not.toContain("<b>");
  });
});

describe("generateAppScaffold — README", () => {
  it("lists picked modules + run steps", () => {
    const readme = fileMap(
      generateAppScaffold({ name: "Doc App", moduleIds: [APP_AUTH] }),
    ).get("README.md") as string;
    expect(readme).toContain("# Doc App");
    expect(readme).toContain("Auth / Session");
    expect(readme).toContain("pnpm dev");
    expect(readme).toContain(".env.example");
  });
});
