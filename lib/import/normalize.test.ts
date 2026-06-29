import { describe, expect, it } from "vitest";
import { sanitizeTags, formatForMime, MAX_TAGS } from "./normalize";

describe("sanitizeTags", () => {
  it("returns [] for non-arrays", () => {
    expect(sanitizeTags(undefined)).toEqual([]);
    expect(sanitizeTags(null)).toEqual([]);
    expect(sanitizeTags("Skyhold")).toEqual([]);
    expect(sanitizeTags({ 0: "a" })).toEqual([]);
  });

  it("trims, drops empties, and preserves order", () => {
    expect(sanitizeTags([" Skyhold ", "", "  ", "Glacial Aurora"])).toEqual([
      "Skyhold",
      "Glacial Aurora",
    ]);
  });

  it("dedupes (order-preserving)", () => {
    expect(sanitizeTags(["Skyhold", "Skyhold", "Frost"])).toEqual(["Skyhold", "Frost"]);
  });

  it("coerces non-strings", () => {
    expect(sanitizeTags([1, 2, "x"])).toEqual(["1", "2", "x"]);
  });

  it("caps at MAX_TAGS", () => {
    const many = Array.from({ length: MAX_TAGS + 5 }, (_, i) => `t${i}`);
    expect(sanitizeTags(many)).toHaveLength(MAX_TAGS);
  });
});

describe("formatForMime", () => {
  it("maps glTF mime types to model", () => {
    expect(formatForMime("model/gltf-binary")).toBe("model");
    expect(formatForMime("model/gltf+json")).toBe("model");
    expect(formatForMime("application/octet-stream.GLB")).toBe("model");
  });

  it("maps everything else to image", () => {
    expect(formatForMime("image/png")).toBe("image");
    expect(formatForMime("image/jpeg")).toBe("image");
    expect(formatForMime("")).toBe("image");
  });
});
