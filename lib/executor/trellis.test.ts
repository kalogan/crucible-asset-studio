import { describe, it, expect } from "vitest";
import { trellisInput, normalizeModelUrl, TRELLIS_DEFAULTS } from "./trellis";

describe("trellisInput", () => {
  it("wraps the image url in a string array with the tuned defaults", () => {
    const input = trellisInput("https://x/y.png");
    expect(input.images).toEqual(["https://x/y.png"]);
    expect(input.slat_guidance_strength).toBe(1.5); // the on-canon tuning
  });

  it("keeps the documented preset values", () => {
    expect(TRELLIS_DEFAULTS.texture_size).toBe(1024);
    expect(TRELLIS_DEFAULTS.mesh_simplify).toBe(0.95);
    expect(TRELLIS_DEFAULTS.generate_normal).toBe(false);
  });
});

describe("normalizeModelUrl", () => {
  it("reads { model_file }", () => {
    expect(normalizeModelUrl({ model_file: "a.glb" })).toBe("a.glb");
  });
  it("reads a bare string", () => {
    expect(normalizeModelUrl("a.glb")).toBe("a.glb");
  });
  it("reads the first element of an array", () => {
    expect(normalizeModelUrl(["a.glb", "preview.png"])).toBe("a.glb");
  });
  it("reads { url }", () => {
    expect(normalizeModelUrl({ url: "a.glb" })).toBe("a.glb");
  });
  it("returns null for empty/unknown shapes", () => {
    expect(normalizeModelUrl(null)).toBeNull();
    expect(normalizeModelUrl({})).toBeNull();
    expect(normalizeModelUrl([])).toBeNull();
  });
});
