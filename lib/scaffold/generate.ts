// Pure scaffold generator — turns a set of picked game-kit systems + a starter
// target (+ an optional template) into a runnable Vite project as a flat list of
// { path, content } files.
//
// No I/O: every output is a string. The caller (UI) renders these as copyable
// code blocks and/or zips them. The generated `main` file imports + initializes
// each SELECTED built system so the result is a compiling skeleton ("pick
// pieces → working game"). Unknown / not-built systemIds are ignored.
//
// Templates (v2) layer richer starters on top of the system picker:
//   - "multiplayer"   — an authoritative Colyseus server + a client adapter that
//                       realizes game-kit's transport-agnostic RoomClient<S> seam.
//   - "procgen-world" — a seeded low-poly world (prng + palette + geometry) you
//                       re-roll by seed.
// "blank" (the default) preserves the v1 behaviour exactly.
//
// Every import emitted here resolves against game-kit's REAL public API so the
// generated starter compiles after `pnpm i && pnpm dev`.

import { slugify } from "@/lib/util/slug";
import { SYSTEMS } from "@/lib/kit/catalog";

export type ScaffoldTarget = "r3f" | "vanilla";

export type ScaffoldTemplate = "blank" | "multiplayer" | "procgen-world";

export type ScaffoldFile = { path: string; content: string };

export type ScaffoldOptions = {
  name: string;
  target: ScaffoldTarget;
  /** Starter template. Defaults to "blank" (pure system picker, v1 behaviour). */
  template?: ScaffoldTemplate;
  systemIds: readonly string[];
};

/** UI-facing template metadata (label + which systems it implies/pre-checks). */
export type TemplateMeta = {
  id: ScaffoldTemplate;
  label: string;
  description: string;
  /** Systems auto-included (and pre-checked in the UI) for this template. */
  systemIds: readonly string[];
};

export const TEMPLATES: readonly TemplateMeta[] = [
  {
    id: "blank",
    label: "Blank",
    description: "Pick your own pieces — a minimal three.js starter.",
    systemIds: [],
  },
  {
    id: "multiplayer",
    label: "Multiplayer (Colyseus)",
    description:
      "Authoritative Colyseus server + a client adapter that realizes game-kit's RoomClient<S> seam. Swap local↔online without touching game logic.",
    systemIds: ["render-bootstrap", "netcode", "input"],
  },
  {
    id: "procgen-world",
    label: "Procgen World",
    description:
      "Seeded low-poly world generation (prng + palette + geometry). Same seed → identical world; re-roll by changing the seed.",
    systemIds: ["render-bootstrap", "prng", "palette", "geo", "lighting"],
  },
] as const;

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
      // createRenderer() returns { renderer, scene, ... } — NO camera (you own
      // it) and takes an options object, not a mount node. createLoop's callback
      // is (dt, alpha) => void.
      imports: [
        `import * as THREE from "three";`,
        `import { createRenderer, createLoop } from "game-kit";`,
      ],
      setup: [
        `const { renderer, scene } = createRenderer();`,
        `app.appendChild(renderer.domElement);`,
        ``,
        `const camera = new THREE.PerspectiveCamera(`,
        `  60,`,
        `  window.innerWidth / window.innerHeight,`,
        `  0.1,`,
        `  1000,`,
        `);`,
        `camera.position.set(8, 6, 8);`,
        `camera.lookAt(0, 0, 0);`,
        ``,
        `function resize(): void {`,
        `  camera.aspect = window.innerWidth / window.innerHeight;`,
        `  camera.updateProjectionMatrix();`,
        `  renderer.setSize(window.innerWidth, window.innerHeight);`,
        `}`,
        `window.addEventListener("resize", resize);`,
        `resize();`,
        ``,
        `const loop = createLoop(() => {`,
        `  // TODO: game-specific update (dt, alpha) are passed to this callback`,
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
      // createOrbitCamera(camera, opts?) returns a controller you drive each
      // frame with cameraRig.update(targetPos, input).
      imports: [`import { createOrbitCamera } from "game-kit";`],
      setup: [
        `const cameraRig = createOrbitCamera(camera, { distance: 12 });`,
        `// TODO: call cameraRig.update([x, y, z], input) inside your loop`,
      ],
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
      setup: [
        `const colors = createPalette({ base: "#5a8f3c", accent: "#ff8c42" });`,
      ],
    },
    r3f: {
      imports: [`import { createPalette } from "game-kit";`],
      setup: [
        `const colors = createPalette({ base: "#5a8f3c", accent: "#ff8c42" });`,
        `// TODO: wire into your app`,
      ],
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
        `const room = createLocalRoom({ players: {} });`,
        `// TODO: game-specific wiring — room.setState(patchState(room.state, ...))`,
      ],
    },
    r3f: {
      imports: [`import { createLocalRoom, patchState } from "game-kit";`],
      setup: [
        `const room = createLocalRoom({ players: {} });`,
        `// TODO: game-specific wiring — room.setState(patchState(room.state, ...))`,
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

// ── Templates ────────────────────────────────────────────────────────────────

/**
 * A template's contribution to the generated project. Layered on top of the
 * resolved systems: extra imports/wiring into `main`, extra files, extra deps.
 */
type TemplateContribution = {
  /** Imports added to the main entry file (deduped with system imports). */
  imports: string[];
  /** Lines appended after the system setup in the vanilla main. */
  vanillaSetup: string[];
  /** Module-scope lines added to the r3f main (outside <Canvas>). */
  r3fModule: string[];
  /** JSX children rendered inside <Canvas> in the r3f main. */
  r3fJsx: string[];
  /** Extra files (server, world generator, net adapter, …). */
  files: ScaffoldFile[];
  /** Extra client dependencies merged into package.json. */
  deps: Record<string, string>;
  /** Extra client devDependencies merged into package.json. */
  devDeps: Record<string, string>;
};

function emptyContribution(): TemplateContribution {
  return {
    imports: [],
    vanillaSetup: [],
    r3fModule: [],
    r3fJsx: [],
    files: [],
    deps: {},
    devDeps: {},
  };
}

function templateContribution(
  template: ScaffoldTemplate,
  target: ScaffoldTarget,
  slug: string,
): TemplateContribution {
  if (template === "procgen-world") return procgenContribution(target);
  if (template === "multiplayer") return multiplayerContribution(slug);
  return emptyContribution();
}

// ── Procgen world template ─────────────────────────────────────────────────

function procgenContribution(target: ScaffoldTarget): TemplateContribution {
  const c = emptyContribution();
  c.files.push({ path: "src/world.ts", content: WORLD_TS });

  if (target === "r3f") {
    c.files.push({ path: "src/World.tsx", content: WORLD_TSX });
    c.imports.push(`import { World } from "./World";`);
    c.r3fJsx.push(`<World seed={1} />`);
  } else {
    c.imports.push(`import { buildWorld } from "./world";`);
    c.vanillaSetup.push(
      `// --- Procgen World ---`,
      `scene.add(buildWorld({ seed: 1 }));`,
    );
  }
  return c;
}

/** Seeded low-poly world builder — uses game-kit's prng + palette + geo. */
const WORLD_TS = `import * as THREE from "three";
import {
  createRng,
  createPalette,
  nonIndexedFlat,
  jitterVerts,
  type Rng,
  type Palette,
} from "game-kit";

export interface WorldOptions {
  /** World seed — same seed always builds the same world. Default 1. */
  seed?: number;
  /** Grid radius in tiles; world is (2r+1)² tiles. Default 12. */
  radius?: number;
  /** Tile size in world units. Default 2. */
  tileSize?: number;
}

/**
 * Build a seeded low-poly world: a jittered ground plane + scattered faceted
 * rocks and trees. Deterministic — re-roll the world by changing \`seed\`.
 */
export function buildWorld(opts: WorldOptions = {}): THREE.Group {
  const seed = opts.seed ?? 1;
  const radius = opts.radius ?? 12;
  const tile = opts.tileSize ?? 2;
  const rng = createRng(seed);

  const palette = createPalette({
    grass: "#5a8f3c",
    rock: "#8a8d91",
    trunk: "#7a5230",
    leaf: "#3f7d34",
  });

  const world = new THREE.Group();
  world.name = "procgen-world";

  // Ground: one jittered, flat-shaded plane.
  const span = tile * (radius * 2 + 1);
  const groundGeo = nonIndexedFlat(
    new THREE.PlaneGeometry(span, span, radius * 2 + 1, radius * 2 + 1),
  );
  groundGeo.rotateX(-Math.PI / 2);
  jitterVerts(groundGeo, rng.fork(1).next, 0.15);
  const ground = new THREE.Mesh(groundGeo, palette.flatMat("grass"));
  ground.receiveShadow = true;
  world.add(ground);

  // Scatter features on ~12% of tiles.
  const scatter = rng.fork(2);
  for (let gx = -radius; gx <= radius; gx++) {
    for (let gz = -radius; gz <= radius; gz++) {
      if (scatter.next() > 0.12) continue;
      const x = gx * tile + (scatter.next() - 0.5) * tile;
      const z = gz * tile + (scatter.next() - 0.5) * tile;
      const obj =
        scatter.next() < 0.5 ? makeRock(scatter, palette) : makeTree(scatter, palette);
      obj.position.set(x, 0, z);
      world.add(obj);
    }
  }

  return world;
}

function makeRock(rng: Rng, palette: Palette): THREE.Object3D {
  const size = 0.4 + rng.next() * 0.8;
  const geo = nonIndexedFlat(new THREE.IcosahedronGeometry(size, 0));
  jitterVerts(geo, rng.next, size * 0.25);
  const mesh = new THREE.Mesh(geo, palette.flatMat("rock"));
  mesh.castShadow = true;
  mesh.position.y = size * 0.5;
  return mesh;
}

function makeTree(rng: Rng, palette: Palette): THREE.Object3D {
  const tree = new THREE.Group();
  const h = 1.2 + rng.next() * 1.5;

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.16, h, 5),
    palette.flatMat("trunk"),
  );
  trunk.position.y = h / 2;
  trunk.castShadow = true;

  const foliageGeo = nonIndexedFlat(
    new THREE.ConeGeometry(0.8 + rng.next() * 0.4, 1.6, 6),
  );
  jitterVerts(foliageGeo, rng.next, 0.1);
  const foliage = new THREE.Mesh(foliageGeo, palette.flatMat("leaf"));
  foliage.position.y = h + 0.4;
  foliage.castShadow = true;

  tree.add(trunk, foliage);
  return tree;
}
`;

/** r3f wrapper around buildWorld — memoized on the world options. */
const WORLD_TSX = `import { useMemo } from "react";
import { buildWorld, type WorldOptions } from "./world";

/** Renders a seeded procgen world. Change \`seed\` to re-roll it. */
export function World(props: WorldOptions) {
  const group = useMemo(
    () => buildWorld(props),
    [props.seed, props.radius, props.tileSize],
  );
  return <primitive object={group} />;
}
`;

// ── Multiplayer (Colyseus) template ──────────────────────────────────────────

function multiplayerContribution(slug: string): TemplateContribution {
  const c = emptyContribution();

  // Client-side: a Colyseus adapter realizing game-kit's RoomClient<S>.
  c.files.push({ path: "src/net/colyseusRoom.ts", content: COLYSEUS_ROOM_TS });

  // Server-side: a standalone Colyseus package.
  c.files.push(
    { path: "server/package.json", content: serverPackageJson(slug) },
    { path: "server/tsconfig.json", content: SERVER_TSCONFIG },
    { path: "server/src/index.ts", content: SERVER_INDEX_TS },
    { path: "server/src/rooms/GameRoom.ts", content: SERVER_ROOM_TS },
  );

  c.deps["colyseus.js"] = "^0.15.26";

  c.imports.push(`import { connectColyseus } from "./net/colyseusRoom";`);
  const connectBlock = [
    `// --- Multiplayer (Colyseus) ---`,
    `// Start the server first: cd server && pnpm i && pnpm dev`,
    `void connectColyseus()`,
    `  .then((room) => {`,
    `    room.onState((state) => {`,
    `      // TODO: reconcile authoritative state into the scene`,
    `      console.log("net state", state);`,
    `    });`,
    `    // room.send("move", { x: 0, y: 0, z: 0 });`,
    `  })`,
    `  .catch((err) => console.error("colyseus connect failed", err));`,
  ];
  c.vanillaSetup.push(...connectBlock);
  c.r3fModule.push(...connectBlock);
  return c;
}

/** Colyseus client adapter — implements game-kit's transport-agnostic seam. */
const COLYSEUS_ROOM_TS = `/**
 * Colyseus adapter — realizes game-kit's transport-agnostic \`RoomClient<S>\` over
 * a real Colyseus server (see ../../server). This is the "future add" the kit's
 * net module documents: game code talks only to RoomClient<S>, so you can swap
 * \`createLocalRoom\` (offline) for \`connectColyseus\` (online) without touching
 * any game logic.
 */
import { Client, type Room } from "colyseus.js";
import type { RoomClient } from "game-kit";

export interface ConnectOptions {
  /** Colyseus endpoint. Default ws://localhost:2567 (the bundled server). */
  endpoint?: string;
  /** Room name registered server-side via gameServer.define(). Default "game". */
  roomName?: string;
}

export async function connectColyseus<S = unknown>(
  opts: ConnectOptions = {},
): Promise<RoomClient<S>> {
  const client = new Client(opts.endpoint ?? "ws://localhost:2567");
  const room: Room = await client.joinOrCreate(opts.roomName ?? "game");

  const stateSubs = new Set<(s: S) => void>();
  room.onStateChange((state) => {
    const snapshot = state as unknown as S;
    for (const fn of [...stateSubs]) fn(snapshot);
  });

  return {
    get state(): S {
      return room.state as unknown as S;
    },
    onState(fn) {
      stateSubs.add(fn);
      return () => {
        stateSubs.delete(fn);
      };
    },
    send(type, payload) {
      room.send(type, payload);
    },
    onMessage(type, fn) {
      room.onMessage(type, (payload) => fn(payload));
      // colyseus.js has no per-handler removal; leave() drops the whole room.
      return () => {};
    },
    leave() {
      stateSubs.clear();
      void room.leave();
    },
  };
}
`;

function serverPackageJson(slug: string): string {
  const pkg = {
    name: `${slug}-server`,
    private: true,
    version: "0.1.0",
    type: "module",
    scripts: {
      dev: "tsx watch src/index.ts",
      start: "tsx src/index.ts",
    },
    dependencies: sortKeys({
      "@colyseus/schema": "^2.0.0",
      colyseus: "^0.15.17",
    }),
    devDependencies: sortKeys({
      "@types/node": "^22.10.0",
      tsx: "^4.19.0",
      typescript: "^5.7.3",
    }),
  };
  return JSON.stringify(pkg, null, 2) + "\n";
}

const SERVER_TSCONFIG = `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "experimentalDecorators": true,
    "useDefineForClassFields": false,
    "noEmit": true
  },
  "include": ["src"]
}
`;

const SERVER_INDEX_TS = `import { Server } from "colyseus";
import { GameRoom } from "./rooms/GameRoom.js";

const port = Number(process.env.PORT ?? 2567);

const gameServer = new Server();
gameServer.define("game", GameRoom);

void gameServer.listen(port).then(() => {
  console.log(\`Colyseus listening on ws://localhost:\${port}\`);
});
`;

const SERVER_ROOM_TS = `import { Room, type Client } from "colyseus";
import { Schema, MapSchema, type } from "@colyseus/schema";

export class Player extends Schema {
  @type("number") x = 0;
  @type("number") y = 0;
  @type("number") z = 0;
}

export class GameState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
}

interface MoveMessage {
  x: number;
  y: number;
  z: number;
}

export class GameRoom extends Room<GameState> {
  onCreate(): void {
    this.setState(new GameState());

    this.onMessage("move", (client, data: MoveMessage) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      player.x = data.x;
      player.y = data.y;
      player.z = data.z;
    });
  }

  onJoin(client: Client): void {
    this.state.players.set(client.sessionId, new Player());
    console.log(client.sessionId, "joined");
  }

  onLeave(client: Client): void {
    this.state.players.delete(client.sessionId);
    console.log(client.sessionId, "left");
  }
}
`;

// ── Static project files ─────────────────────────────────────────────────────

function buildPackageJson(
  slug: string,
  target: ScaffoldTarget,
  contrib: TemplateContribution,
): string {
  // game-kit is VENDORED into the starter (under vendor/game-kit) rather than a
  // dependency — the kit repo is private, so a `github:` dep wouldn't install. It's
  // aliased in vite.config + tsconfig. Only its runtime deps (three, r3f) are listed.
  const deps: Record<string, string> = {
    three: "^0.171.0",
    ...contrib.deps,
  };
  const devDeps: Record<string, string> = {
    typescript: "^5.7.3",
    vite: "^6.0.0",
    ...contrib.devDeps,
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
  const lines: string[] = [
    `import { defineConfig } from "vite";`,
    `import { fileURLToPath } from "node:url";`,
  ];
  if (target === "r3f") lines.push(`import react from "@vitejs/plugin-react";`);
  lines.push(
    ``,
    `// game-kit is vendored under vendor/game-kit (the kit repo is private). Alias`,
    `// each entry to its source; Vite resolves the kit's ".js" specifiers to ".ts".`,
    `const kit = (p) => fileURLToPath(new URL(p, import.meta.url));`,
    ``,
    `export default defineConfig({`,
  );
  if (target === "r3f") lines.push(`  plugins: [react()],`);
  lines.push(
    `  resolve: {`,
    `    alias: [`,
    `      { find: /^game-kit\\/r3f$/, replacement: kit("./vendor/game-kit/src/r3f.ts") },`,
    `      { find: /^game-kit\\/npc$/, replacement: kit("./vendor/game-kit/src/npc.ts") },`,
    `      { find: /^game-kit\\/brief$/, replacement: kit("./vendor/game-kit/src/brief.ts") },`,
    `      { find: /^game-kit$/, replacement: kit("./vendor/game-kit/src/index.ts") },`,
    `    ],`,
    `  },`,
    `});`,
    ``,
  );
  return lines.join("\n");
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
      paths: {
        "game-kit": ["./vendor/game-kit/src/index.ts"],
        "game-kit/r3f": ["./vendor/game-kit/src/r3f.ts"],
        "game-kit/npc": ["./vendor/game-kit/src/npc.ts"],
        "game-kit/brief": ["./vendor/game-kit/src/brief.ts"],
      },
    },
    include: ["src"],
  };
  return JSON.stringify(tsconfig, null, 2) + "\n";
}

function buildVanillaMain(
  slug: string,
  resolved: readonly string[],
  contrib: TemplateContribution,
): string {
  const imports: string[] = [];
  const setup: string[] = [];

  for (const id of resolved) {
    const recipe = WIRING[id]?.vanilla;
    if (!recipe) continue;
    for (const line of recipe.imports) imports.push(line);
  }
  for (const line of contrib.imports) imports.push(line);

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

  // Template wiring runs after the systems are set up (it consumes `scene`).
  if (contrib.vanillaSetup.length > 0) {
    lines.push(``);
    for (const line of contrib.vanillaSetup) {
      lines.push(line.replace(/\$\{slug\}/g, slug));
    }
  }

  lines.push(``);
  return lines.join("\n");
}

function buildR3fMain(
  slug: string,
  resolved: readonly string[],
  contrib: TemplateContribution,
): string {
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

  // Template contributions.
  for (const line of contrib.imports) imports.push(line);
  for (const line of contrib.r3fJsx) jsx.push(line);
  if (contrib.r3fModule.length > 0) moduleSetup.push(...contrib.r3fModule);

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

/** A starter `.gitignore` so the first commit never drags in node_modules/dist. */
function buildGitignore(): string {
  return [
    `node_modules/`,
    `dist/`,
    `*.local`,
    `.env`,
    `.env.*`,
    `.DS_Store`,
    ``,
  ].join("\n");
}

/**
 * A one-shot bootstrap script: `sh create-repo.sh [name] [private|public]`
 * runs git init + first commit + `gh repo create --source --push`, using the
 * user's already-authenticated GitHub CLI. No tokens, no server — it runs on
 * the user's machine with their own `gh` auth.
 */
function buildCreateRepoSh(slug: string): string {
  return [
    `#!/usr/bin/env sh`,
    `# Bootstrap this starter into a fresh GitHub repo using the GitHub CLI (gh).`,
    `#`,
    `#   sh create-repo.sh [repo-name] [private|public|internal]`,
    `#`,
    `# Prereqs: git installed, and \`gh auth login\` already done.`,
    `set -e`,
    ``,
    `REPO_NAME="\${1:-${slug}}"`,
    `VISIBILITY="\${2:-private}"`,
    ``,
    `if ! command -v gh >/dev/null 2>&1; then`,
    `  echo "error: GitHub CLI (gh) not found — install https://cli.github.com/ then run 'gh auth login'." >&2`,
    `  exit 1`,
    `fi`,
    ``,
    `if [ -d .git ]; then`,
    `  echo "error: a .git directory already exists here — refusing to re-init." >&2`,
    `  exit 1`,
    `fi`,
    ``,
    `git init -b main`,
    `git add -A`,
    `git commit -m "chore: scaffold ${slug} from Crucible game-kit"`,
    ``,
    `# Create the repo on your account, wire it as origin, and push.`,
    `gh repo create "$REPO_NAME" --source=. --remote=origin --push --"$VISIBILITY"`,
    ``,
    `echo "✓ Pushed to GitHub as $REPO_NAME ($VISIBILITY)."`,
    ``,
  ].join("\n");
}

function buildReadme(
  name: string,
  target: ScaffoldTarget,
  resolved: readonly string[],
  template: ScaffoldTemplate,
): string {
  const systemLines =
    resolved.length === 0
      ? ["- _(none — add systems and regenerate)_"]
      : resolved.map((id) => `- ${WIRING[id]?.label ?? id} (\`${id}\`)`);

  const entryFile = target === "r3f" ? "src/main.tsx" : "src/main.ts";

  const lines: string[] = [
    `# ${name}`,
    ``,
    `A runnable starter scaffolded from Crucible's game-kit. Target: **${target === "r3f" ? "React Three Fiber" : "vanilla three.js"}**.`,
  ];

  const tmpl = TEMPLATES.find((t) => t.id === template);
  if (tmpl && tmpl.id !== "blank") {
    lines.push(``, `Template: **${tmpl.label}** — ${tmpl.description}`);
  }

  lines.push(
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
  );

  if (template === "multiplayer") {
    lines.push(
      ``,
      `### Multiplayer server`,
      ``,
      `The client connects to a Colyseus server in \`server/\`. Run it in a second terminal:`,
      ``,
      `\`\`\`sh`,
      `cd server`,
      `pnpm i`,
      `pnpm dev   # ws://localhost:2567`,
      `\`\`\``,
      ``,
      `\`src/net/colyseusRoom.ts\` adapts Colyseus to game-kit's \`RoomClient<S>\` seam,`,
      `so your game code stays transport-agnostic — swap it for \`createLocalRoom\` to`,
      `run offline.`,
    );
  }

  if (template === "procgen-world") {
    lines.push(
      ``,
      `### Procgen world`,
      ``,
      `\`src/world.ts\` builds a seeded low-poly world (\`buildWorld({ seed })\`). The`,
      `same seed always produces the same world — change the seed to re-roll it.`,
    );
  }

  lines.push(
    ``,
    `## Push to GitHub`,
    ``,
    `With the GitHub CLI (\`gh auth login\` done once), turn this folder into a repo:`,
    ``,
    `\`\`\`sh`,
    `sh create-repo.sh                 # repo named "${slugify(name) || "game"}", private`,
    `sh create-repo.sh my-game public  # custom name + visibility`,
    `\`\`\``,
    ``,
    `It runs \`git init\` + a first commit + \`gh repo create --source --push\` using`,
    `your own \`gh\` auth — no tokens stored anywhere.`,
    ``,
    `\`game-kit\` is **vendored** under \`vendor/game-kit\` (aliased in vite.config +`,
    `tsconfig) — no install needed. Each picked system imports + initializes its piece in \`${entryFile}\`.`,
    `Some are stubbed with \`// TODO: game-specific wiring\` — fill those in.`,
    ``,
  );

  return lines.join("\n");
}

/**
 * Generate the full scaffold as a flat list of files. Pure: deterministic given
 * the same options. Unknown / not-built systemIds are ignored. The optional
 * `template` layers a richer starter (server, world generator) on top.
 */
export function generateScaffold(opts: ScaffoldOptions): ScaffoldFile[] {
  const slug = slugify(opts.name) || "game";
  const template = opts.template ?? "blank";
  const templateSystems =
    TEMPLATES.find((t) => t.id === template)?.systemIds ?? [];
  const requestedIds = [...new Set([...opts.systemIds, ...templateSystems])];
  const resolved = resolveSystems(requestedIds);
  const contrib = templateContribution(template, opts.target, slug);

  const mainPath = opts.target === "r3f" ? "src/main.tsx" : "src/main.ts";
  const mainContent =
    opts.target === "r3f"
      ? buildR3fMain(slug, resolved, contrib)
      : buildVanillaMain(slug, resolved, contrib);

  return [
    { path: "package.json", content: buildPackageJson(slug, opts.target, contrib) },
    { path: "vite.config.ts", content: buildViteConfig(opts.target) },
    { path: "index.html", content: buildIndexHtml(opts.name, opts.target) },
    { path: "tsconfig.json", content: buildTsconfig(opts.target) },
    { path: mainPath, content: mainContent },
    {
      path: "README.md",
      content: buildReadme(opts.name, opts.target, resolved, template),
    },
    { path: ".gitignore", content: buildGitignore() },
    { path: "create-repo.sh", content: buildCreateRepoSh(slug) },
    ...contrib.files,
  ];
}
