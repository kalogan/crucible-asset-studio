// Unit tests for the pure parts of the NEW app-kit modules (layout + deploy).
// They live here (not under vendor/) because vitest's include globs cover
// lib/**, app/**, components/** — not vendor/**. Imports resolve via the `@`
// alias to the vendored source.
import { describe, it, expect } from "vitest";
import {
  // layout
  createShellConfig,
  DEFAULT_SHELL,
  themeStylesheet,
  appMetadata,
  createThemeController,
  THEME_TOKENS,
  // deploy
  parseEnv,
  envExample,
  vercelJson,
  supabaseConfigToml,
  SUPABASE_ENV,
} from "@/vendor/app-kit/src/index";

describe("app-kit/layout — createShellConfig", () => {
  it("fills defaults and replaces nav when provided", () => {
    const base = createShellConfig();
    expect(base).toEqual(DEFAULT_SHELL);

    const custom = createShellConfig({
      title: "Glerb",
      nav: [{ label: "Dashboard", href: "/dashboard" }],
    });
    expect(custom.title).toBe("Glerb");
    expect(custom.description).toBe(DEFAULT_SHELL.description); // untouched
    expect(custom.nav).toEqual([{ label: "Dashboard", href: "/dashboard" }]);
    expect(custom.defaultTheme).toBe("light");
  });
});

describe("app-kit/layout — themeStylesheet", () => {
  it("emits :root light tokens + a dark override block", () => {
    const css = themeStylesheet();
    expect(css).toContain(":root {");
    expect(css).toContain(`--bg: ${THEME_TOKENS.light.bg};`);
    expect(css).toContain('[data-theme="dark"] {');
    expect(css).toContain(`--bg: ${THEME_TOKENS.dark.bg};`);
    expect(css).toContain("background: var(--bg);");
  });

  it("is deterministic", () => {
    expect(themeStylesheet()).toEqual(themeStylesheet());
  });
});

describe("app-kit/layout — appMetadata", () => {
  it("projects title + description from a shell config", () => {
    const meta = appMetadata(createShellConfig({ title: "T", description: "D" }));
    expect(meta).toEqual({ title: "T", description: "D" });
  });
});

describe("app-kit/layout — createThemeController", () => {
  it("starts at the initial mode and toggles", () => {
    const c = createThemeController("light");
    expect(c.getTheme()).toBe("light");
    c.toggleTheme();
    expect(c.getTheme()).toBe("dark");
    c.setTheme("dark"); // no-op
    expect(c.getTheme()).toBe("dark");
  });

  it("onTheme fires immediately, on change, and unsubscribes", () => {
    const c = createThemeController("light");
    const seen: string[] = [];
    const off = c.onTheme((m) => seen.push(m));
    expect(seen).toEqual(["light"]); // immediate
    c.setTheme("dark");
    expect(seen).toEqual(["light", "dark"]);
    c.setTheme("dark"); // unchanged → no fire
    expect(seen).toEqual(["light", "dark"]);
    off();
    c.setTheme("light");
    expect(seen).toEqual(["light", "dark"]); // no more after unsubscribe
  });
});

describe("app-kit/deploy — parseEnv", () => {
  it("returns typed values when all required vars present", () => {
    const result = parseEnv(SUPABASE_ENV, {
      NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.values["NEXT_PUBLIC_SUPABASE_URL"]).toBe("https://x.supabase.co");
    }
  });

  it("collects ALL missing required keys (not just the first)", () => {
    const result = parseEnv(SUPABASE_ENV, {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.missing).toEqual([
        "NEXT_PUBLIC_SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      ]);
    }
  });

  it("treats empty-string as missing, applies defaults, honors optional", () => {
    const schema = [
      { key: "REQUIRED" },
      { key: "WITH_DEFAULT", default: "fallback" },
      { key: "OPTIONAL", required: false },
    ] as const;
    const result = parseEnv(schema, { REQUIRED: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.missing).toEqual(["REQUIRED"]);

    const ok = parseEnv(schema, { REQUIRED: "x" });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.values["WITH_DEFAULT"]).toBe("fallback");
      expect(ok.values["OPTIONAL"]).toBeUndefined();
    }
  });
});

describe("app-kit/deploy — envExample", () => {
  it("emits a KEY= line per var with description comments", () => {
    const out = envExample(SUPABASE_ENV);
    expect(out).toContain("# Supabase project URL");
    expect(out).toContain("NEXT_PUBLIC_SUPABASE_URL=");
    expect(out).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY=");
  });
});

describe("app-kit/deploy — vercelJson", () => {
  it("defaults to the Next.js framework preset + pinned pnpm install", () => {
    const json = JSON.parse(vercelJson()) as {
      framework: string | null;
      installCommand: string;
      buildCommand?: string;
    };
    expect(json.framework).toBe("nextjs");
    expect(json.installCommand).toBe("pnpm install --frozen-lockfile");
    expect(json.buildCommand).toBeUndefined();
  });

  it("includes buildCommand only when provided", () => {
    const json = JSON.parse(vercelJson({ buildCommand: "pnpm build" })) as {
      buildCommand?: string;
    };
    expect(json.buildCommand).toBe("pnpm build");
  });
});

describe("app-kit/deploy — supabaseConfigToml", () => {
  it("emits project_id + default local ports", () => {
    const toml = supabaseConfigToml({ projectId: "my-app" });
    expect(toml).toContain('project_id = "my-app"');
    expect(toml).toContain("port = 54321");
    expect(toml).toContain("port = 54322");
    expect(toml).toContain("port = 54323");
  });
});
