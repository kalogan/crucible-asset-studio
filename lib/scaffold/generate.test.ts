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
        "README.md",
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
