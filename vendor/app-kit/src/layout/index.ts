/**
 * app-kit/layout — a framework-light App-Router root layout description for the
 * studio's Next.js web apps.
 *
 * FRAMEWORK-FREE: this module imports neither React nor Next. It describes a root
 * layout as DATA (nav items, theme tokens, metadata) plus pure builders that emit
 * the small, deterministic strings an app needs — a `<head>`-style metadata block,
 * a theme-token `:root` stylesheet, and the nav model a header renders. App code
 * (or the scaffolder) realizes the data into real JSX at the edge, the same way
 * the auth module hides a provider behind `AuthClient`.
 *
 * The theme seam mirrors auth's store shape: `getTheme()` returns the current
 * mode, `onTheme(fn)` subscribes (fires immediately, returns an unsubscribe), and
 * `setTheme(...)` flips it. UI binds to `ThemeController` and never reads a
 * document/localStorage directly, so the same controller drives SSR, a mock, or a
 * future provider unchanged.
 */

/** Colour mode the shell renders in. */
export type ThemeMode = "light" | "dark";

/** A single primary-navigation entry the header renders. */
export interface NavItem {
  /** Stable key + visible label. */
  label: string;
  /** App-relative href (e.g. "/dashboard"). */
  href: string;
}

/** The data an app's root layout needs to render a shell. Pure, serializable. */
export interface AppShellConfig {
  /** App title — used in metadata + the header brand. */
  title: string;
  /** Meta description for the document head. */
  description: string;
  /** Primary nav entries, in render order. */
  nav: readonly NavItem[];
  /** Mode the app first paints in (before the client controller hydrates). */
  defaultTheme: ThemeMode;
}

/** Sensible defaults so callers can spread + override only what they need. */
export const DEFAULT_SHELL: AppShellConfig = {
  title: "App",
  description: "A Crucible app-kit starter.",
  nav: [{ label: "Home", href: "/" }],
  defaultTheme: "light",
};

/**
 * Merge a partial config over {@link DEFAULT_SHELL}. Nav is replaced (not merged)
 * when provided, so a caller fully owns the menu when they pass one.
 */
export function createShellConfig(
  overrides: Partial<AppShellConfig> = {},
): AppShellConfig {
  return {
    title: overrides.title ?? DEFAULT_SHELL.title,
    description: overrides.description ?? DEFAULT_SHELL.description,
    nav: overrides.nav ?? DEFAULT_SHELL.nav,
    defaultTheme: overrides.defaultTheme ?? DEFAULT_SHELL.defaultTheme,
  };
}

/** The two CSS-variable token sets the shell stylesheet emits, per mode. */
export interface ThemeTokens {
  /** Page background. */
  bg: string;
  /** Default foreground / text. */
  fg: string;
  /** Accent / primary colour. */
  accent: string;
  /** Muted border / hairline colour. */
  border: string;
}

/** Built-in light/dark token sets — the seam an app can override wholesale. */
export const THEME_TOKENS: Record<ThemeMode, ThemeTokens> = {
  light: { bg: "#ffffff", fg: "#0a0a0a", accent: "#2563eb", border: "#e5e7eb" },
  dark: { bg: "#0a0a0a", fg: "#fafafa", accent: "#60a5fa", border: "#27272a" },
};

/**
 * Emit a `:root` + `[data-theme="dark"]` stylesheet from the token sets. Light is
 * the base `:root`; dark overrides under the data-attribute the controller flips.
 * Deterministic given the same tokens — unit-testable without a DOM.
 */
export function themeStylesheet(
  tokens: Record<ThemeMode, ThemeTokens> = THEME_TOKENS,
): string {
  const vars = (t: ThemeTokens): string =>
    [
      `  --bg: ${t.bg};`,
      `  --fg: ${t.fg};`,
      `  --accent: ${t.accent};`,
      `  --border: ${t.border};`,
    ].join("\n");

  return [
    `:root {`,
    vars(tokens.light),
    `}`,
    ``,
    `[data-theme="dark"] {`,
    vars(tokens.dark),
    `}`,
    ``,
    `body {`,
    `  margin: 0;`,
    `  background: var(--bg);`,
    `  color: var(--fg);`,
    `  font-family: system-ui, sans-serif;`,
    `}`,
    ``,
  ].join("\n");
}

/**
 * Next-`Metadata`-shaped object derived from a shell config. Returned as a plain
 * object so an app can `export const metadata = appMetadata(config)` directly.
 */
export interface AppMetadata {
  title: string;
  description: string;
}

/** Project a shell config down to the metadata an app head needs. */
export function appMetadata(config: AppShellConfig): AppMetadata {
  return { title: config.title, description: config.description };
}

/** The reactive theme seam UI binds to (mirrors auth's `AuthClient`). */
export interface ThemeController {
  /** Current mode (never throws; returns the default before any change). */
  getTheme(): ThemeMode;
  /**
   * Subscribe to mode changes. Fires once synchronously with the current mode,
   * then on every change. Returns an unsubscribe function.
   */
  onTheme(listener: ThemeListener): () => void;
  /** Set the mode (no-op if unchanged). */
  setTheme(mode: ThemeMode): void;
  /** Flip light↔dark. */
  toggleTheme(): void;
}

export type ThemeListener = (mode: ThemeMode) => void;

/**
 * Build a reactive {@link ThemeController} seeded with `initial`. Pure + DOM-free:
 * an adapter at the edge persists the mode (cookie / localStorage / `data-theme`)
 * by subscribing via `onTheme`. Listeners fire only when the mode actually flips.
 */
export function createThemeController(initial: ThemeMode = "light"): ThemeController {
  let mode: ThemeMode = initial;
  const listeners = new Set<ThemeListener>();

  const setTheme = (next: ThemeMode): void => {
    if (next === mode) return;
    mode = next;
    for (const fn of [...listeners]) fn(mode);
  };

  return {
    getTheme: () => mode,
    onTheme: (listener) => {
      listeners.add(listener);
      // Fire immediately so subscribers render against the current mode.
      listener(mode);
      return () => {
        listeners.delete(listener);
      };
    },
    setTheme,
    toggleTheme: () => setTheme(mode === "light" ? "dark" : "light"),
  };
}
