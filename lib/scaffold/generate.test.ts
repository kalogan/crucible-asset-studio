import { describe, it, expect } from "vitest";
import { generateScaffold, type ScaffoldFile } from "./generate";

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

  it("always depends on game-kit + three", () => {
    const files = generateScaffold({
      name: "G",
      target: "vanilla",
      systemIds: [],
    });
    const pkg = JSON.parse(
      fileMap(files).get("package.json") as string,
    ) as { dependencies: Record<string, string> };
    expect(pkg.dependencies["game-kit"]).toBe("github:kalogan/game-kit");
    expect(pkg.dependencies["three"]).toBeDefined();
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
    // Hooks imported from /r3f, called inside Systems(), rendered as <Systems />.
    expect(main).toContain('import { useOrbitCamera } from "game-kit/r3f"');
    expect(main).toContain('import { useClipPlayer } from "game-kit/r3f"');
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
    // Imported from "game-kit" (not /r3f), initialized outside <Canvas>.
    expect(main).toContain('import { createAudioManager } from "game-kit"');
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
