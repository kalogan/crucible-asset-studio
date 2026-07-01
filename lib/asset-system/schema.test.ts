import { describe, it, expect } from "vitest";
import { renderWav } from "@/lib/pipeline/audio";
import { AssetSystem, AudioRecipe, Manifest, ManifestPart, defaultManifest } from "./schema";

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
        fx: [{ kind: "fire", params: { rate: 12 } }],
        params: { flicker: true },
      },
      created_at: "2026-06-29T00:00:00.000Z",
    };
    const parsed = AssetSystem.parse(row);
    expect(parsed.name).toBe("Campfire");
    expect(parsed.manifest.parts).toHaveLength(1);
    expect(parsed.manifest.lights?.[0]?.type).toBe("point");
    expect(parsed.manifest.fx?.[0]?.kind).toBe("fire");
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

describe("AudioRecipe schema (sounds editor authoring)", () => {
  const recipe = {
    sampleRate: 44100,
    masterGain: 0.8,
    events: [
      { type: "tone", wave: "square", freq: 880, startSec: 0, durationSec: 0.08, gain: 0.5 },
      { type: "noise", startSec: 0.08, durationSec: 0.05, gain: 0.4 },
    ],
  };

  it("parses a recipe authored by the editor", () => {
    const parsed = AudioRecipe.parse(recipe);
    expect(parsed.events).toHaveLength(2);
    expect(parsed.events[0]?.type).toBe("tone");
    expect(parsed.events[1]?.type).toBe("noise");
  });

  it("rejects out-of-range gain and a non-integer sample rate", () => {
    expect(() =>
      AudioRecipe.parse({ ...recipe, events: [{ ...recipe.events[0], gain: 2 }] }),
    ).toThrow();
    expect(() => AudioRecipe.parse({ ...recipe, sampleRate: 44100.5 })).toThrow();
  });

  it("bakes a parsed recipe to non-empty WAV bytes via the pipeline renderer", () => {
    // The parsed shape is exactly what bakeAudioAsset feeds renderWav, so a round-trip
    // proves the authored recipe is a valid input to the bake path.
    const wav = renderWav(AudioRecipe.parse(recipe));
    // 44-byte RIFF header + PCM data for a ~0.13s track at 44.1kHz.
    expect(wav.length).toBeGreaterThan(44);
    expect(String.fromCharCode(wav[0]!, wav[1]!, wav[2]!, wav[3]!)).toBe("RIFF");
  });
});
