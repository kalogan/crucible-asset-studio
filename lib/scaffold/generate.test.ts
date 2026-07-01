import { describe, it, expect } from "vitest";
import { generateScaffold, TEMPLATES, type ScaffoldFile } from "./generate";

function fileMap(files: ScaffoldFile[]): Map<string, string> {
  return new Map(files.map((f) => [f.path, f.content]));
}

describe("generateScaffold — file tree", () => {
  it("emits the expected vanilla file set", () => {
    const files = generateScaffold({
      name: "My Game",
      target: "vanilla",
      systemIds: ["render-bootstrap", "lighting"],
    });
    const paths = files.map((f) => f.path).sort();
    expect(paths).toEqual(
      [
        ".gitignore",
        "README.md",
        "create-repo.sh",
        "index.html",
        "package.json",
        "src/main.ts",
        "tsconfig.json",
        "vite.config.ts",
      ].sort(),
    );
  });

  it("emits src/main.tsx (not .ts) for the r3f target", () => {
    const files = generateScaffold({
      name: "My Game",
      target: "r3f",
      systemIds: ["lighting"],
    });
    const paths = files.map((f) => f.path);
    expect(paths).toContain("src/main.tsx");
    expect(paths).not.toContain("src/main.ts");
  });
});

describe("generateScaffold — package.json", () => {
  it("parses and slugifies the name with type module + scripts", () => {
    const files = generateScaffold({
      name: "My Cool Game!",
      target: "vanilla",
      systemIds: [],
    });
    const pkgRaw = fileMap(files).get("package.json");
    expect(pkgRaw).toBeDefined();
    const pkg = JSON.parse(pkgRaw as string) as Record<string, unknown>;
    expect(pkg.name).toBe("my-cool-game");
    expect(pkg.type).toBe("module");
    expect(pkg.scripts).toEqual({ dev: "vite", build: "vite build" });
  });

  it("depends on three and VENDORS game-kit (no github dep)", () => {
    const files = generateScaffold({
      name: "G",
      target: "vanilla",
      systemIds: [],
    });
    const map = fileMap(files);
    const pkg = JSON.parse(map.get("package.json") as string) as {
      dependencies: Record<string, string>;
    };
    expect(pkg.dependencies["three"]).toBeDefined();
    // game-kit is vendored, not a dependency.
    expect(pkg.dependencies["game-kit"]).toBeUndefined();
    // vite.config aliases the bare specifier to the vendored source.
    expect(map.get("vite.config.ts")).toContain("game-kit");
    expect(map.get("vite.config.ts")).toContain("vendor/game-kit/src/index.ts");
  });

  it("includes react + r3f deps ONLY for target r3f", () => {
    const r3f = JSON.parse(
      fileMap(
        generateScaffold({ name: "G", target: "r3f", systemIds: [] }),
      ).get("package.json") as string,
    ) as { dependencies: Record<string, string>; devDependencies: Record<string, string> };
    expect(r3f.dependencies["react"]).toBeDefined();
    expect(r3f.dependencies["react-dom"]).toBeDefined();
    expect(r3f.dependencies["@react-three/fiber"]).toBeDefined();
    expect(r3f.dependencies["@react-three/drei"]).toBeDefined();
    expect(r3f.dependencies["@react-three/postprocessing"]).toBeDefined();
    expect(r3f.devDependencies["@vitejs/plugin-react"]).toBeDefined();

    const vanilla = JSON.parse(
      fileMap(
        generateScaffold({ name: "G", target: "vanilla", systemIds: [] }),
      ).get("package.json") as string,
    ) as { dependencies: Record<string, string>; devDependencies: Record<string, string> };
    expect(vanilla.dependencies["react"]).toBeUndefined();
    expect(vanilla.dependencies["@react-three/fiber"]).toBeUndefined();
    expect(vanilla.devDependencies["@vitejs/plugin-react"]).toBeUndefined();
  });
});

describe("generateScaffold — main wiring", () => {
  it("references each selected system's import (vanilla)", () => {
    const files = generateScaffold({
      name: "G",
      target: "vanilla",
      systemIds: ["render-bootstrap", "lighting", "audio", "save"],
    });
    const main = fileMap(files).get("src/main.ts") as string;
    expect(main).toContain("createRenderer");
    expect(main).toContain("createLightingRig");
    expect(main).toContain("createAudioManager");
    expect(main).toContain("createSaveStore");
  });

  it("substitutes the slug into wiring (save)", () => {
    const files = generateScaffold({
      name: "Save Me",
      target: "vanilla",
      systemIds: ["render-bootstrap", "save"],
    });
    const main = fileMap(files).get("src/main.ts") as string;
    expect(main).toContain('createSaveStore("save-me")');
    expect(main).not.toContain("${slug}");
  });

  it("references each selected system's r3f component import + jsx", () => {
    const files = generateScaffold({
      name: "G",
      target: "r3f",
      systemIds: ["lighting", "postfx", "fx-particles"],
    });
    const main = fileMap(files).get("src/main.tsx") as string;
    expect(main).toContain('from "game-kit/r3f"');
    expect(main).toContain("LightingRig");
    expect(main).toContain("PostFx");
    expect(main).toContain("Particles");
    expect(main).toContain("<LightingRig />");
    expect(main).toContain("<PostFx />");
    expect(main).toContain("<Particles />");
    expect(main).not.toContain("${slug}");
  });

  it("runs r3f hooks inside an inner Systems() component under <Canvas>", () => {
    const files = generateScaffold({
      name: "G",
      target: "r3f",
      systemIds: ["camera-rigs", "skeletal-anim"],
    });
    const main = fileMap(files).get("src/main.tsx") as string;
    // Hooks imported from /r3f (merged into ONE statement), called inside
    // Systems(), rendered as <Systems />.
    expect(main).toContain(
      'import { useOrbitCamera, useClipPlayer } from "game-kit/r3f";',
    );
    expect(main).toContain("function Systems()");
    expect(main).toContain("useOrbitCamera();");
    expect(main).toContain("useClipPlayer();");
    expect(main).toContain("<Systems />");
    // Hooks are NOT emitted as JSX tags.
    expect(main).not.toContain("<useOrbitCamera");
  });

  it("inits no-r3f-variant systems from the vanilla factory at module scope (r3f)", () => {
    const files = generateScaffold({
      name: "Audio Game",
      target: "r3f",
      systemIds: ["audio", "save"],
    });
    const main = fileMap(files).get("src/main.tsx") as string;
    // Imported from "game-kit" (not /r3f), initialized outside <Canvas>. Both
    // no-r3f factories merge into ONE "game-kit" import statement.
    expect(main).toContain(
      'import { createAudioManager, createSaveStore } from "game-kit";',
    );
    expect(main).toContain("createAudioManager()");
    expect(main).toContain('createSaveStore("audio-game")');
    expect(main).not.toContain("${slug}");
  });

  it("ignores unknown / not-built system ids", () => {
    const files = generateScaffold({
      name: "G",
      target: "vanilla",
      systemIds: ["lighting", "totally-made-up", "another-fake"],
    });
    const main = fileMap(files).get("src/main.ts") as string;
    expect(main).toContain("createLightingRig");
    expect(main).not.toContain("totally-made-up");
    expect(main).not.toContain("another-fake");
  });

  it("vanilla main has NO react import", () => {
    const files = generateScaffold({
      name: "G",
      target: "vanilla",
      systemIds: ["render-bootstrap", "lighting", "hud"],
    });
    const main = fileMap(files).get("src/main.ts") as string;
    expect(main).not.toContain("react");
    expect(main).not.toContain("React");
  });

  it("warns when no render bootstrap is picked (vanilla)", () => {
    const files = generateScaffold({
      name: "G",
      target: "vanilla",
      systemIds: ["lighting"],
    });
    const main = fileMap(files).get("src/main.ts") as string;
    expect(main).toContain("no Render Bootstrap selected");
  });
});

describe("generateScaffold — README + determinism", () => {
  it("lists included systems and run steps", () => {
    const files = generateScaffold({
      name: "Doc Game",
      target: "vanilla",
      systemIds: ["lighting"],
    });
    const readme = fileMap(files).get("README.md") as string;
    expect(readme).toContain("# Doc Game");
    expect(readme).toContain("Lighting");
    expect(readme).toContain("pnpm dev");
  });

  it("is deterministic regardless of systemId order", () => {
    const a = generateScaffold({
      name: "G",
      target: "vanilla",
      systemIds: ["lighting", "audio", "render-bootstrap"],
    });
    const b = generateScaffold({
      name: "G",
      target: "vanilla",
      systemIds: ["render-bootstrap", "audio", "lighting"],
    });
    expect(a).toEqual(b);
  });
});

describe("generateScaffold — GitHub bootstrap", () => {
  it("emits create-repo.sh wired to gh repo create + a .gitignore", () => {
    const map = fileMap(
      generateScaffold({
        name: "Ship It",
        target: "vanilla",
        systemIds: ["render-bootstrap"],
      }),
    );
    const sh = map.get("create-repo.sh") as string;
    expect(sh).toContain("gh repo create");
    expect(sh).toContain("--source=.");
    expect(sh).toContain("--push");
    // Defaults to the slug + private, with a gh-not-installed guard.
    expect(sh).toContain('REPO_NAME="${1:-ship-it}"');
    expect(sh).toContain('VISIBILITY="${2:-private}"');
    expect(sh).toContain("command -v gh");

    const ignore = map.get(".gitignore") as string;
    expect(ignore).toContain("node_modules/");
  });
});

describe("generateScaffold — blank template default", () => {
  it("omitting template equals template: 'blank' (back-compat)", () => {
    const implicit = generateScaffold({
      name: "G",
      target: "r3f",
      systemIds: ["lighting"],
    });
    const explicit = generateScaffold({
      name: "G",
      target: "r3f",
      template: "blank",
      systemIds: ["lighting"],
    });
    expect(implicit).toEqual(explicit);
  });

  it("blank emits no server / world files", () => {
    const paths = generateScaffold({
      name: "G",
      target: "vanilla",
      template: "blank",
      systemIds: ["render-bootstrap"],
    }).map((f) => f.path);
    expect(paths.some((p) => p.startsWith("server/"))).toBe(false);
    expect(paths).not.toContain("src/world.ts");
  });
});

describe("generateScaffold — render bootstrap (real API)", () => {
  it("creates its own PerspectiveCamera and renders with (scene, camera)", () => {
    const main = fileMap(
      generateScaffold({
        name: "G",
        target: "vanilla",
        systemIds: ["render-bootstrap"],
      }),
    ).get("src/main.ts") as string;
    // createRenderer() takes no mount node and returns no camera.
    expect(main).toContain("const { renderer, scene } = createRenderer();");
    expect(main).toContain("new THREE.PerspectiveCamera(");
    expect(main).toContain("renderer.render(scene, camera)");
    expect(main).not.toContain("createRenderer(app)");
  });
});

describe("generateScaffold — npc / nav / behavior wiring", () => {
  it("wires nav (createGridNav) from the main game-kit entry (vanilla)", () => {
    const main = fileMap(
      generateScaffold({
        name: "G",
        target: "vanilla",
        systemIds: ["render-bootstrap", "nav"],
      }),
    ).get("src/main.ts") as string;
    // nav's names merge into the shared "game-kit" import (with render-bootstrap's).
    const gameKitImport = main
      .split("\n")
      .find((l) => /^import\s*\{[^}]*\}\s*from\s*"game-kit";?\s*$/.test(l.trim()));
    expect(gameKitImport).toBeDefined();
    expect(gameKitImport).toContain("createGridNav");
    expect(gameKitImport).toContain("type Vec2");
    expect(main).toContain("createGridNav({");
    expect(main).toContain("nav.findPath");
  });

  it("wires npc-behavior (createNpcBehavior + createRng) self-contained (vanilla)", () => {
    const main = fileMap(
      generateScaffold({
        name: "G",
        target: "vanilla",
        systemIds: ["render-bootstrap", "npc-behavior"],
      }),
    ).get("src/main.ts") as string;
    expect(main).toContain("createNpcBehavior");
    // imports createRng itself so it works without the prng system selected.
    expect(main).toContain("createRng");
    expect(main).toContain('kind: "wander"');
    expect(main).toContain("npc.tick(dt)");
  });

  it("npc-reasoning is server-side only — never imports game-kit/npc into the client", () => {
    for (const target of ["vanilla", "r3f"] as const) {
      const path = target === "r3f" ? "src/main.tsx" : "src/main.ts";
      const main = fileMap(
        generateScaffold({
          name: "G",
          target,
          systemIds: ["render-bootstrap", "npc-reasoning"],
        }),
      ).get(path) as string;
      // No LIVE import of the server-only entry — every mention of "game-kit/npc"
      // must be on a commented line (the reference block), never a real import
      // statement that would pull zod + a keyed provider into the client bundle.
      for (const line of main.split("\n")) {
        if (line.includes("game-kit/npc")) {
          expect(line.trimStart().startsWith("//")).toBe(true);
        }
      }
      expect(main).toContain("SERVER-SIDE ONLY");
      expect(main).toContain("createNpcBrain");
      expect(main).toContain("createHashingEmbedder");
    }
  });

  it("npc-reasoning-movement is GATED + server-side: warns + never live-imports game-kit/npc", () => {
    for (const target of ["vanilla", "r3f"] as const) {
      const path = target === "r3f" ? "src/main.tsx" : "src/main.ts";
      const main = fileMap(
        generateScaffold({
          name: "G",
          target,
          systemIds: ["render-bootstrap", "npc-reasoning-movement"],
        }),
      ).get(path) as string;
      // Every mention of the server-only entry must be commented (no client-bundle import).
      for (const line of main.split("\n")) {
        if (line.includes("game-kit/npc")) {
          expect(line.trimStart().startsWith("//")).toBe(true);
        }
      }
      // The gate + its warning copy are surfaced in the wiring.
      expect(main).toContain("allowMovement: true");
      expect(main).toContain("DEFAULT-OFF");
      expect(main).toContain("review the");
      expect(main).toContain("navBoundsFromGrid");
      expect(main).toContain("parseReasoningResponse");
      // It documents that movement stays a request the pathfinder owns.
      expect(main).toContain("NEVER writes an NPC position");
    }
  });

  it("nav r3f wiring goes to module scope (no <Canvas> JSX/hook needed)", () => {
    const main = fileMap(
      generateScaffold({
        name: "G",
        target: "r3f",
        systemIds: ["nav"],
      }),
    ).get("src/main.tsx") as string;
    expect(main).toContain("createGridNav({");
    expect(main).not.toContain("${slug}");
  });
});

/**
 * Extract every identifier bound by the top-of-file named imports
 * (`import { a, type B, c as d } from "…"`). Returns the LOCAL binding names
 * (so `c as d` contributes `d`). Used to assert no identifier is bound twice.
 */
function importedIdentifiers(main: string): string[] {
  const ids: string[] = [];
  const re = /^import\s*\{([^}]*)\}\s*from\s*["'][^"']+["'];?\s*$/;
  for (const line of main.split("\n")) {
    const m = re.exec(line.trim());
    if (!m) continue;
    for (const part of (m[1] as string).split(",")) {
      const token = part.trim().replace(/^type\s+/, "");
      if (token === "") continue;
      const asMatch = /\bas\s+(\w+)$/.exec(token);
      ids.push(asMatch ? (asMatch[1] as string) : token);
    }
  }
  return ids;
}

describe("generateScaffold — merged, de-duplicated imports", () => {
  it("emits NO duplicate identifiers for overlapping systems (prng + nav + npc-behavior)", () => {
    for (const target of ["vanilla", "r3f"] as const) {
      const path = target === "r3f" ? "src/main.tsx" : "src/main.ts";
      const main = fileMap(
        generateScaffold({
          name: "Overlap",
          target,
          // These three all import from "game-kit" with OVERLAPPING names:
          //   prng         → createRng
          //   nav          → createGridNav, type Vec2
          //   npc-behavior → createGridNav, createNpcBehavior, createRng
          systemIds: ["render-bootstrap", "prng", "nav", "npc-behavior"],
        }),
      ).get(path) as string;

      const ids = importedIdentifiers(main);
      const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
      expect(dupes).toEqual([]);
      // Overlapping names survive the merge exactly once.
      expect(ids.filter((id) => id === "createRng")).toHaveLength(1);
      expect(ids.filter((id) => id === "createGridNav")).toHaveLength(1);
      // The merged names are all present.
      expect(ids).toContain("createNpcBehavior");
      expect(ids).toContain("Vec2");
    }
  });

  it("merges named imports from the same specifier into ONE statement", () => {
    const main = fileMap(
      generateScaffold({
        name: "Merge",
        target: "vanilla",
        systemIds: ["render-bootstrap", "prng", "nav", "npc-behavior"],
      }),
    ).get("src/main.ts") as string;
    // Exactly one `from "game-kit";` named-import line (not three).
    const gameKitLines = main
      .split("\n")
      .filter((l) => /^import\s*\{[^}]*\}\s*from\s*"game-kit";?\s*$/.test(l.trim()));
    expect(gameKitLines).toHaveLength(1);
    // `import * as THREE` (a non-named import) is preserved as its own line.
    expect(main).toContain('import * as THREE from "three";');
  });

  it("preserves the type-only modifier on a name only imported as a type", () => {
    const main = fileMap(
      generateScaffold({
        name: "Types",
        target: "vanilla",
        systemIds: ["render-bootstrap", "nav"],
      }),
    ).get("src/main.ts") as string;
    // nav imports `type Vec2` — the modifier must survive the merge.
    expect(main).toContain("type Vec2");
  });
});

describe("generateScaffold — moody-explorer template", () => {
  it("is a selectable template with the GYRE-shaped systems pre-selected", () => {
    const meta = TEMPLATES.find((t) => t.id === "moody-explorer");
    expect(meta).toBeDefined();
    const ids = new Set(meta?.systemIds ?? []);
    for (const expected of [
      "render-bootstrap",
      "camera-rigs",
      "input",
      "scene-state",
      "lighting",
      "postfx",
      "geo",
      "palette",
      "fx-particles",
      "nav",
      "audio",
      "math",
      "prng",
    ]) {
      expect(ids.has(expected)).toBe(true);
    }
  });

  it("lists the pre-selected systems in the README (via forced template systems)", () => {
    const readme = fileMap(
      generateScaffold({
        name: "Gloom",
        target: "r3f",
        template: "moody-explorer",
        systemIds: [],
      }),
    ).get("README.md") as string;
    // The template forces its systems in even with empty systemIds.
    expect(readme).toContain("Lighting");
    expect(readme).toContain("Post FX");
    expect(readme).toContain("Camera Rigs");
    expect(readme).toContain("Moody explorer");
  });

  it("emits a runnable r3f moody scene (room + moody presets + FP camera + dust)", () => {
    const map = fileMap(
      generateScaffold({
        name: "Gloom",
        target: "r3f",
        template: "moody-explorer",
        systemIds: [],
      }),
    );
    expect(map.has("src/moodyRoom.ts")).toBe(true);
    expect(map.has("src/MoodyScene.tsx")).toBe(true);

    const room = map.get("src/moodyRoom.ts") as string;
    expect(room).toContain("export function buildMoodyRoom");
    // Real kit APIs — prng + geo + palette carve the room.
    expect(room).toContain("createRng");
    expect(room).toContain("createPalette");
    expect(room).toContain("nonIndexedFlat");
    expect(room).toContain("jitterVerts");

    const scene = map.get("src/MoodyScene.tsx") as string;
    // Wires the CURRENT kit API for the atmospheric first-person scene.
    expect(scene).toContain(
      'import { LightingRig, PostFx, useFirstPersonCamera } from "game-kit/r3f"',
    );
    expect(scene).toContain("createInputMap");
    expect(scene).toContain("useFirstPersonCamera(");
    expect(scene).toContain('preset="moody"');
    expect(scene).toContain("FogExp2");
    expect(scene).toContain("createParticles({");
    expect(scene).toContain("buildMoodyRoom({ seed: 7 })");

    const main = map.get("src/main.tsx") as string;
    expect(main).toContain('import { MoodyScene } from "./MoodyScene"');
    expect(main).toContain("<MoodyScene />");
    expect(main).toContain("<Canvas shadows");
    // NOT the generic TODO-stub fallback scene.
    expect(main).not.toContain("TODO: game-specific wiring");
    // No duplicate identifiers in the entry either.
    const ids = importedIdentifiers(main);
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
  });

  it("emits a runnable vanilla moody scene (startMoodyExplorer + FP + bloom)", () => {
    const map = fileMap(
      generateScaffold({
        name: "Gloom",
        target: "vanilla",
        template: "moody-explorer",
        systemIds: [],
      }),
    );
    expect(map.has("src/moodyRoom.ts")).toBe(true);
    expect(map.has("src/moodyScene.ts")).toBe(true);
    expect(map.has("src/MoodyScene.tsx")).toBe(false);

    const scene = map.get("src/moodyScene.ts") as string;
    expect(scene).toContain("export function startMoodyExplorer");
    expect(scene).toContain("createFirstPersonCamera");
    expect(scene).toContain("createInputMap");
    expect(scene).toContain("createPostFx");
    expect(scene).toContain('preset: "moody"');
    expect(scene).toContain("postfx.render()");

    const main = map.get("src/main.ts") as string;
    expect(main).toContain('import { startMoodyExplorer } from "./moodyScene"');
    expect(main).toContain("startMoodyExplorer(app)");
    expect(main).not.toContain("${slug}");
  });

  it("emits no server files (moody-explorer is single-player)", () => {
    const paths = generateScaffold({
      name: "Gloom",
      target: "r3f",
      template: "moody-explorer",
      systemIds: [],
    }).map((f) => f.path);
    expect(paths.some((p) => p.startsWith("server/"))).toBe(false);
  });
});

describe("generateScaffold — multiplayer template", () => {
  const files = generateScaffold({
    name: "Arena Game",
    target: "vanilla",
    template: "multiplayer",
    systemIds: [],
  });
  const map = fileMap(files);

  it("emits a Colyseus server package + room + client adapter", () => {
    const paths = files.map((f) => f.path);
    expect(paths).toContain("server/package.json");
    expect(paths).toContain("server/src/index.ts");
    expect(paths).toContain("server/src/rooms/GameRoom.ts");
    expect(paths).toContain("src/net/colyseusRoom.ts");
  });

  it("client adapter implements game-kit's RoomClient<S> over colyseus.js", () => {
    const adapter = map.get("src/net/colyseusRoom.ts") as string;
    expect(adapter).toContain('import type { RoomClient } from "game-kit"');
    expect(adapter).toContain('from "colyseus.js"');
    expect(adapter).toContain("Promise<RoomClient<S>>");
  });

  it("adds colyseus.js to client deps and colyseus to the server package", () => {
    const clientPkg = JSON.parse(map.get("package.json") as string) as {
      dependencies: Record<string, string>;
    };
    expect(clientPkg.dependencies["colyseus.js"]).toBeDefined();
    const serverPkg = JSON.parse(
      map.get("server/package.json") as string,
    ) as { name: string; dependencies: Record<string, string> };
    expect(serverPkg.name).toBe("arena-game-server");
    expect(serverPkg.dependencies["colyseus"]).toBeDefined();
    expect(serverPkg.dependencies["@colyseus/schema"]).toBeDefined();
  });

  it("wires connectColyseus into the entry (both targets)", () => {
    const vanillaMain = map.get("src/main.ts") as string;
    expect(vanillaMain).toContain(
      'import { connectColyseus } from "./net/colyseusRoom"',
    );
    expect(vanillaMain).toContain("connectColyseus()");

    const r3fMain = fileMap(
      generateScaffold({
        name: "Arena Game",
        target: "r3f",
        template: "multiplayer",
        systemIds: [],
      }),
    ).get("src/main.tsx") as string;
    expect(r3fMain).toContain("connectColyseus()");
  });

  it("forces in render-bootstrap + netcode even with empty systemIds", () => {
    const main = map.get("src/main.ts") as string;
    expect(main).toContain("createRenderer");
    expect(main).toContain("createLocalRoom");
  });
});

describe("generateScaffold — procgen-world template", () => {
  it("emits a seeded world builder using prng + palette + geo (vanilla)", () => {
    const files = generateScaffold({
      name: "Wild",
      target: "vanilla",
      template: "procgen-world",
      systemIds: [],
    });
    const map = fileMap(files);
    const world = map.get("src/world.ts") as string;
    expect(world).toBeDefined();
    expect(world).toContain("export function buildWorld");
    expect(world).toContain("createRng");
    expect(world).toContain("createPalette");
    expect(world).toContain("jitterVerts");

    const main = map.get("src/main.ts") as string;
    expect(main).toContain('import { buildWorld } from "./world"');
    expect(main).toContain("scene.add(buildWorld({ seed: 1 }))");
    // No standalone Colyseus server for this template.
    expect(files.some((f) => f.path.startsWith("server/"))).toBe(false);
  });

  it("emits a <World/> component and renders it under <Canvas> (r3f)", () => {
    const files = generateScaffold({
      name: "Wild",
      target: "r3f",
      template: "procgen-world",
      systemIds: [],
    });
    const map = fileMap(files);
    expect(map.has("src/World.tsx")).toBe(true);
    expect(map.has("src/world.ts")).toBe(true);
    const main = map.get("src/main.tsx") as string;
    expect(main).toContain('import { World } from "./World"');
    expect(main).toContain("<World seed={1} />");
  });
});
