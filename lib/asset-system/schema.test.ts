import { describe, it, expect } from "vitest";
import { AssetSystem, Manifest, ManifestPart, defaultManifest } from "./schema";

describe("asset-system schema", () => {
  it("parses a valid system", () => {
    const row = {
      id: "11111111-1111-1111-1111-111111111111",
      project_id: "22222222-2222-2222-2222-222222222222",
      name: "Campfire",
      description: "logs + flame + point light",
      manifest: {
        parts: [
          {
            assetId: "logs-mesh",
            role: "base",
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: 1,
          },
        ],
        lights: [{ type: "point", color: "#ff8c42", intensity: 2, position: [0, 1, 0] }],
        sounds: [{ label: "crackle", url: "https://example.com/crackle.ogg" }],
        params: { flicker: true },
      },
      created_at: "2026-06-29T00:00:00.000Z",
    };
    const parsed = AssetSystem.parse(row);
    expect(parsed.name).toBe("Campfire");
    expect(parsed.manifest.parts).toHaveLength(1);
    expect(parsed.manifest.lights?.[0]?.type).toBe("point");
  });

  it("applies defaults", () => {
    // An empty manifest gets parts:[]; a bare part fills position/rotation/scale.
    expect(Manifest.parse({}).parts).toEqual([]);
    expect(defaultManifest).toEqual({ parts: [] });

    const part = ManifestPart.parse({ assetId: "logs-mesh" });
    expect(part.position).toEqual([0, 0, 0]);
    expect(part.rotation).toEqual([0, 0, 0]);
    expect(part.scale).toBe(1);
  });

  it("rejects a bad part", () => {
    // Missing assetId.
    expect(() => ManifestPart.parse({ role: "base" })).toThrow();
    // Wrong-length position vector.
    expect(() => ManifestPart.parse({ assetId: "x", position: [0, 0] })).toThrow();
    // Non-numeric scale.
    expect(() => ManifestPart.parse({ assetId: "x", scale: "big" })).toThrow();
  });
});
