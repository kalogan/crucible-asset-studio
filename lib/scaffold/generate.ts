// Pure scaffold generator — turns a set of picked game-kit systems + a starter
// target into a runnable Vite project as a flat list of { path, content } files.
//
// No I/O: every output is a string. The caller (UI) renders these as copyable
// code blocks and/or zips them. The generated `main` file imports + initializes
// each SELECTED built system so the result is a compiling skeleton ("pick
// pieces → working game"). Unknown / not-built systemIds are ignored.
//
// Every import emitted here resolves against game-kit's REAL public API so the
// generated starter compiles after `pnpm i && pnpm dev`.

import { slugify } from "@/lib/util/slug";
import { SYSTEMS } from "@/lib/kit/catalog";

export type ScaffoldTarget = "r3f" | "vanilla";

export type ScaffoldFile = { path: string; content: string };

export type ScaffoldOptions = {
  name: string;
  target: ScaffoldTarget;
  systemIds: readonly string[];
};

/**
 * One wiring recipe per system, per target. `imports` are emitted (deduped) at
 * the top of the main file; the rest places code into the right spot.
 */
type VanillaRecipe = { imports: string[]; setup: string[] };

/**
 * r3f wiring comes in three shapes that map onto how React Three Fiber works:
 * - `jsx`   — real components rendered as children of `<Canvas>` (e.g. `<LightingRig/>`).
 * - `hooks` — lines run inside an inner `Systems()` component within `<Canvas>`
 *   (hooks like `useOrbitCamera()` can't be JSX and must run under the Canvas).
 * - `setup` — for systems with NO r3f variant: the vanilla factory imported from
 *   "game-kit" and initialized at module scope (with a TODO to wire it in).
 */
type R3fRecipe = {
  imports: string[];
  jsx?: string[];
  hooks?: string[];
  setup?: string[];
};

type WiringEntry = {
  /** Human label used in the README / comments. */
  label: string;
  vanilla?: VanillaRecipe;
  r3f?: R3fRecipe;
};

/**
 * systemId → wiring. Keyed by the catalog `SYSTEMS` ids. Only systems present
 * here AND built contribute code; everything else is silently ignored.
 *
 * Export names track game-kit's real public API:
 *   "game-kit"     — createRenderer, createLoop, createLightingRig, createPostFx,
 *                    createOrbitCamera, createParticles, createHud, createAudioManager,
 *                    createInputMap, createSaveStore, createRng, createSettingsStore,
 *                    createSceneMachine, createProceduralAnimator, createClipPlayer,
 *                    nonIndexedFlat, jitterVerts, createPalette, clamp/lerp/damp,
 *                    createLocalRoom, patchState, createArtKit.
 *   "game-kit/r3f" — <LightingRig/>, <PostFx/>, <Particles/> (components);
 *                    useOrbitCamera, useClipPlayer, useFixedLoop (hooks).
 */
export const WIRING: Record<string, WiringEntry> = {
  "render-bootstrap": {
    label: "Render Bootstrap",
    vanilla: {
      imports: [`import { createRenderer, createLoop } from "game-kit";`],
      setup: [
        `const { renderer, scene, camera } = createRenderer(app);`,
        `const loop = createLoop(({ dt }) => {`,
        `  // TODO: game-specific update`,
        `  renderer.render(scene, camera);`,
        `});`,
        `loop.start();`,
      ],
    },
    // r3f's <Canvas> owns the renderer + loop; nothing to wire here.
  },
  lighting: {
    label: "Lighting",
    vanilla: {
      imports: [`import { createLightingRig } from "game-kit";`],
      setup: [`createLightingRig(scene);`],
    },
    r3f: {
      imports: [`import { LightingRig } from "game-kit/r3f";`],
      jsx: [`<LightingRig />`],
    },
  },
  postfx: {
    label: "Post FX",
    vanilla: {
      imports: [`import { createPostFx } from "game-kit";`],
      setup: [`const postfx = createPostFx(renderer, scene, camera);`],
    },
    r3f: {
      imports: [`import { PostFx } from "game-kit/r3f";`],
      jsx: [`<PostFx />`],
    },
  },
  "camera-rigs": {
    label: "Camera Rigs",
    vanilla: {
      imports: [`import { createOrbitCamera } from "game-kit";`],
      setup: [`const cameraRig = createOrbitCamera(camera, renderer.domElement);`],
    },
    r3f: {
      // Hook — must run inside a component under <Canvas>.
      imports: [`import { useOrbitCamera } from "game-kit/r3f";`],
      hooks: [`useOrbitCamera();`],
    },
  },
  "fx-particles": {
    label: "FX Particles",
    vanilla: {
      imports: [`import { createParticles } from "game-kit";`],
      setup: [`const fx = createParticles(scene);`],
    },
    r3f: {
      imports: [`import { Particles } from "game-kit/r3f";`],
      jsx: [`<Particles />`],
    },
  },
  hud: {
    label: "HUD",
    vanilla: {
      imports: [`import { createHud } from "game-kit";`],
      setup: [`const hud = createHud(app);`],
    },
    r3f: {
      // No r3f variant — init the DOM HUD outside the Canvas.
      imports: [`import { createHud } from "game-kit";`],
      setup: [`const hud = createHud(document.body);`, `// TODO: wire into your app`],
    },
  },
  audio: {
    label: "Audio",
    vanilla: {
      imports: [`import { createAudioManager } from "game-kit";`],
      setup: [`const audio = createAudioManager();`],
    },
    r3f: {
      imports: [`import { createAudioManager } from "game-kit";`],
      setup: [`const audio = createAudioManager();`, `// TODO: wire into your app`],
    },
  },
  input: {
    label: "Input",
    vanilla: {
      imports: [`import { createInputMap } from "game-kit";`],
      setup: [`const input = createInputMap();`],
    },
    r3f: {
      imports: [`import { createInputMap } from "game-kit";`],
      setup: [`const input = createInputMap();`, `// TODO: wire into your app`],
    },
  },
  save: {
    label: "Save",
    vanilla: {
      // ${slug} is substituted at emit time.
      imports: [`import { createSaveStore } from "game-kit";`],
      setup: ['const save = createSaveStore("${slug}");'],
    },
    r3f: {
      imports: [`import { createSaveStore } from "game-kit";`],
      setup: ['const save = createSaveStore("${slug}");', `// TODO: wire into your app`],
    },
  },
  prng: {
    label: "PRNG",
    vanilla: {
      imports: [`import { createRng } from "game-kit";`],
      setup: [`const rng = createRng(1);`],
    },
    r3f: {
      imports: [`import { createRng } from "game-kit";`],
      setup: [`const rng = createRng(1);`, `// TODO: wire into your app`],
    },
  },
  settings: {
    label: "Settings",
    vanilla: {
      imports: [`import { createSettingsStore } from "game-kit";`],
      setup: [`const settings = createSettingsStore();`],
    },
    r3f: {
      imports: [`import { createSettingsStore } from "game-kit";`],
      setup: [
        `const settings = createSettingsStore();`,
        `// TODO: wire into your app`,
      ],
    },
  },
  "scene-state": {
    label: "Scene State",
    vanilla: {
      imports: [`import { createSceneMachine } from "game-kit";`],
      setup: [`const sceneState = createSceneMachine();`],
    },
    r3f: {
      imports: [`import { createSceneMachine } from "game-kit";`],
      setup: [
        `const sceneState = createSceneMachine();`,
        `// TODO: wire into your app`,
      ],
    },
  },
  anim: {
    label: "Animation",
    vanilla: {
      imports: [`import { createProceduralAnimator } from "game-kit";`],
      setup: [`const animator = createProceduralAnimator();`],
    },
    r3f: {
      imports: [`import { createProceduralAnimator } from "game-kit";`],
      setup: [
        `const animator = createProceduralAnimator();`,
        `// TODO: wire into your app`,
      ],
    },
  },
  "skeletal-anim": {
    label: "Skeletal Anim",
    vanilla: {
      imports: [`import { createClipPlayer } from "game-kit";`],
      setup: [`const clips = createClipPlayer();`],
    },
    r3f: {
      // Hook — must run inside a component under <Canvas>.
      imports: [`import { useClipPlayer } from "game-kit/r3f";`],
      hooks: [`useClipPlayer();`],
    },
  },
  geo: {
    label: "Geometry",
    vanilla: {
      imports: [`import { nonIndexedFlat, jitterVerts } from "game-kit";`],
      setup: [
        `// geometry helpers (nonIndexedFlat, jitterVerts) available from game-kit`,
      ],
    },
    r3f: {
      imports: [`import { nonIndexedFlat, jitterVerts } from "game-kit";`],
      setup: [
        `// geometry helpers (nonIndexedFlat, jitterVerts) available from game-kit`,
        `// TODO: wire into your app`,
      ],
    },
  },
  palette: {
    label: "Palette",
    vanilla: {
      imports: [`import { createPalette } from "game-kit";`],
      setup: [`const colors = createPalette();`],
    },
    r3f: {
      imports: [`import { createPalette } from "game-kit";`],
      setup: [`const colors = createPalette();`, `// TODO: wire into your app`],
    },
  },
  math: {
    label: "Math",
    vanilla: {
      imports: [`import { clamp, lerp, damp } from "game-kit";`],
      setup: [`// math utils (clamp, lerp, damp) available from game-kit`],
    },
    r3f: {
      imports: [`import { clamp, lerp, damp } from "game-kit";`],
      setup: [`// math utils (clamp, lerp, damp) available from game-kit`],
    },
  },
  netcode: {
    label: "Netcode",
    vanilla: {
      imports: [`import { createLocalRoom, patchState } from "game-kit";`],
      setup: [
        `const room = createLocalRoom();`,
        `// TODO: game-specific wiring — patchState(room, ...)`,
      ],
    },
    r3f: {
      imports: [`import { createLocalRoom, patchState } from "game-kit";`],
      setup: [
        `const room = createLocalRoom();`,
        `// TODO: game-specific wiring — patchState(room, ...)`,
      ],
    },
  },
  artkit: {
    label: "Art Kit",
    vanilla: {
      imports: [`import { createArtKit } from "game-kit";`],
      setup: [`const artKit = createArtKit();`],
    },
    r3f: {
      imports: [`import { createArtKit } from "game-kit";`],
      setup: [`const artKit = createArtKit();`, `// TODO: wire into your app`],
    },
  },
  "deploy-presets": {
    label: "Deploy Presets",
    // Build-time only (viteBase / flyToml / …): no runtime wiring in main.
  },
};

/** The set of catalog ids that are `built` (the only ones we scaffold from). */
function builtSystemIds(): Set<string> {
  return new Set(SYSTEMS.filter((s) => s.status === "built").map((s) => s.id));
}

/**
 * Resolve the requested ids to the ordered, deduped subset that are BOTH built
 * (per the catalog) AND have a wiring recipe. Order follows the catalog so the
 * generated output is deterministic regardless of input order.
 */
function resolveSystems(systemIds: readonly string[]): string[] {
  const built = builtSystemIds();
  const requested = new Set(systemIds);
  return SYSTEMS.filter(
    (s) => requested.has(s.id) && built.has(s.id) && WIRING[s.id] !== undefined,
  ).map((s) => s.id);
}

/** Stable, deduped imports preserving first-seen order. */
function dedupe(lines: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of lines) {
    if (!seen.has(line)) {
      seen.add(line);
      out.push(line);
    }
  }
  return out;
}

function buildPackageJson(slug: string, target: ScaffoldTarget): string {
  const deps: Record<string, string> = {
    "game-kit": "github:kalogan/game-kit",
    three: "^0.171.0",
  };
  const devDeps: Record<string, string> = {
    typescript: "^5.7.3",
    vite: "^6.0.0",
  };
  if (target === "r3f") {
    deps["react"] = "^19.0.0";
    deps["react-dom"] = "^19.0.0";
    deps["@react-three/fiber"] = "^9.0.0";
    deps["@react-three/drei"] = "^10.0.0";
    deps["@react-three/postprocessing"] = "^3.0.0";
    devDeps["@vitejs/plugin-react"] = "^4.3.4";
  }

  const pkg = {
    name: slug,
    private: true,
    version: "0.1.0",
    type: "module",
    scripts: { dev: "vite", build: "vite build" },
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

function buildViteConfig(target: ScaffoldTarget): string {
  if (target === "r3f") {
    return [
      `import { defineConfig } from "vite";`,
      `import react from "@vitejs/plugin-react";`,
      ``,
      `export default defineConfig({`,
      `  plugins: [react()],`,
      `});`,
      ``,
    ].join("\n");
  }
  return [
    `import { defineConfig } from "vite";`,
    ``,
    `export default defineConfig({});`,
    ``,
  ].join("\n");
}

function buildIndexHtml(name: string, target: ScaffoldTarget): string {
  const mountId = target === "r3f" ? "root" : "app";
  const entry = target === "r3f" ? "/src/main.tsx" : "/src/main.ts";
  return [
    `<!doctype html>`,
    `<html lang="en">`,
    `  <head>`,
    `    <meta charset="UTF-8" />`,
    `    <meta name="viewport" content="width=device-width, initial-scale=1.0" />`,
    `    <title>${escapeHtml(name)}</title>`,
    `    <style>`,
    `      html, body, #${mountId} { margin: 0; height: 100%; }`,
    `      #${mountId} { width: 100vw; height: 100vh; }`,
    `    </style>`,
    `  </head>`,
    `  <body>`,
    `    <div id="${mountId}"></div>`,
    `    <script type="module" src="${entry}"></script>`,
    `  </body>`,
    `</html>`,
    ``,
  ].join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildTsconfig(target: ScaffoldTarget): string {
  const tsconfig = {
    compilerOptions: {
      target: "ES2022",
      lib: ["DOM", "DOM.Iterable", "ESNext"],
      module: "ESNext",
      moduleResolution: "bundler",
      strict: true,
      noUncheckedIndexedAccess: true,
      esModuleInterop: true,
      skipLibCheck: true,
      noEmit: true,
      ...(target === "r3f" ? { jsx: "react-jsx" } : {}),
    },
    include: ["src"],
  };
  return JSON.stringify(tsconfig, null, 2) + "\n";
}

function buildVanillaMain(slug: string, resolved: readonly string[]): string {
  const imports: string[] = [];
  const setup: string[] = [];

  for (const id of resolved) {
    const recipe = WIRING[id]?.vanilla;
    if (!recipe) continue;
    for (const line of recipe.imports) imports.push(line);
  }

  const hasBootstrap = resolved.includes("render-bootstrap");

  const lines: string[] = [];
  lines.push(...dedupe(imports));
  lines.push(``);
  lines.push(`const slug = "${slug}";`);
  lines.push(`const app = document.querySelector<HTMLDivElement>("#app");`);
  lines.push(`if (!app) throw new Error("Missing #app mount node");`);
  lines.push(``);

  if (!hasBootstrap) {
    lines.push(
      `// NOTE: no Render Bootstrap selected — \`scene\`/\`renderer\`/\`camera\` are not`,
    );
    lines.push(
      `// defined. Add the "Render Bootstrap" system or provide your own here.`,
    );
    lines.push(``);
  }

  // Render Bootstrap declares `scene`/`renderer`/`camera`/`app` that the other
  // systems consume, so its setup must run FIRST (avoid a use-before-declare TDZ).
  const setupOrder = hasBootstrap
    ? ["render-bootstrap", ...resolved.filter((id) => id !== "render-bootstrap")]
    : resolved;
  for (const id of setupOrder) {
    const recipe = WIRING[id]?.vanilla;
    if (!recipe) continue;
    const label = WIRING[id]?.label ?? id;
    setup.push(`// --- ${label} ---`);
    for (const line of recipe.setup) {
      setup.push(line.replace(/\$\{slug\}/g, slug));
    }
  }

  lines.push(...setup);
  lines.push(``);
  return lines.join("\n");
}

function buildR3fMain(slug: string, resolved: readonly string[]): string {
  const imports: string[] = [
    `import { StrictMode } from "react";`,
    `import { createRoot } from "react-dom/client";`,
    `import { Canvas } from "@react-three/fiber";`,
  ];
  const jsx: string[] = [];
  const hooks: string[] = [];
  /** Module-scope init for systems with no r3f variant (vanilla factories). */
  const moduleSetup: string[] = [];

  for (const id of resolved) {
    const recipe = WIRING[id]?.r3f;
    if (!recipe) continue;
    const label = WIRING[id]?.label ?? id;
    for (const line of recipe.imports) imports.push(line);
    if (recipe.jsx) for (const line of recipe.jsx) jsx.push(line);
    if (recipe.hooks) for (const line of recipe.hooks) hooks.push(line);
    if (recipe.setup && recipe.setup.length > 0) {
      moduleSetup.push(`// --- ${label} ---`);
      for (const line of recipe.setup) moduleSetup.push(line);
    }
  }

  const lines: string[] = [];
  lines.push(...dedupe(imports));
  lines.push(``);
  lines.push(`const slug = "${slug}";`);

  // Module-scope wiring for systems with no r3f component/hook.
  if (moduleSetup.length > 0) {
    lines.push(``);
    for (const line of moduleSetup) lines.push(line.replace(/\$\{slug\}/g, slug));
  }

  // Inner component for hooks — they must run inside <Canvas>.
  const hasHooks = hooks.length > 0;
  if (hasHooks) {
    lines.push(``);
    lines.push(`function Systems() {`);
    for (const line of hooks) lines.push(`  ${line}`);
    lines.push(`  return null;`);
    lines.push(`}`);
  }

  lines.push(``);
  lines.push(`function Game() {`);
  lines.push(`  // slug: ${slug} — wire game-specific state here.`);
  lines.push(`  return (`);
  lines.push(`    <Canvas>`);
  if (hasHooks) lines.push(`      <Systems />`);
  for (const line of jsx) lines.push(`      ${line}`);
  if (jsx.length === 0 && !hasHooks) {
    lines.push(`      {/* TODO: game-specific wiring — add scene content */}`);
    lines.push(`      <mesh>`);
    lines.push(`        <boxGeometry args={[1, 1, 1]} />`);
    lines.push(`        <meshStandardMaterial />`);
    lines.push(`      </mesh>`);
  }
  lines.push(`    </Canvas>`);
  lines.push(`  );`);
  lines.push(`}`);
  lines.push(``);
  lines.push(`const container = document.querySelector<HTMLDivElement>("#root");`);
  lines.push(`if (!container) throw new Error("Missing #root mount node");`);
  lines.push(`createRoot(container).render(`);
  lines.push(`  <StrictMode>`);
  lines.push(`    <Game />`);
  lines.push(`  </StrictMode>,`);
  lines.push(`);`);
  lines.push(``);
  return lines.join("\n");
}

function buildReadme(
  name: string,
  target: ScaffoldTarget,
  resolved: readonly string[],
): string {
  const systemLines =
    resolved.length === 0
      ? ["- _(none — add systems and regenerate)_"]
      : resolved.map((id) => `- ${WIRING[id]?.label ?? id} (\`${id}\`)`);

  return [
    `# ${name}`,
    ``,
    `A runnable starter scaffolded from Crucible's game-kit. Target: **${target === "r3f" ? "React Three Fiber" : "vanilla three.js"}**.`,
    ``,
    `## Included systems`,
    ``,
    ...systemLines,
    ``,
    `## Run`,
    ``,
    `\`\`\`sh`,
    `pnpm i`,
    `pnpm dev`,
    `\`\`\``,
    ``,
    `The starter depends on \`game-kit\` (\`github:kalogan/game-kit\`). Each picked`,
    `system imports + initializes its piece in \`${target === "r3f" ? "src/main.tsx" : "src/main.ts"}\`.`,
    `Some are stubbed with \`// TODO: game-specific wiring\` — fill those in.`,
    ``,
  ].join("\n");
}

/**
 * Generate the full scaffold as a flat list of files. Pure: deterministic given
 * the same options. Unknown / not-built systemIds are ignored.
 */
export function generateScaffold(opts: ScaffoldOptions): ScaffoldFile[] {
  const slug = slugify(opts.name) || "game";
  const resolved = resolveSystems(opts.systemIds);
  const mainPath = opts.target === "r3f" ? "src/main.tsx" : "src/main.ts";
  const mainContent =
    opts.target === "r3f"
      ? buildR3fMain(slug, resolved)
      : buildVanillaMain(slug, resolved);

  return [
    { path: "package.json", content: buildPackageJson(slug, opts.target) },
    { path: "vite.config.ts", content: buildViteConfig(opts.target) },
    { path: "index.html", content: buildIndexHtml(opts.name, opts.target) },
    { path: "tsconfig.json", content: buildTsconfig(opts.target) },
    { path: mainPath, content: mainContent },
    {
      path: "README.md",
      content: buildReadme(opts.name, opts.target, resolved),
    },
  ];
}
