import { describe, expect, it } from "vitest";
import {
  ASSET_TYPE_FRAMINGS,
  ASSET_TYPE_OPTIONS,
  framingFor,
  type AssetTypeKey,
} from "./framing";

describe("framingFor", () => {
  it("returns the character framing with no face-related nevers", () => {
    const f = framingFor("character");
    expect(f.key).toBe("character");
    expect(f).toBe(ASSET_TYPE_FRAMINGS.character);
    // Characters need faces — must not inherit any "no faces" never.
    for (const never of f.nevers) {
      expect(never.toLowerCase()).not.toContain("face");
    }
  });

  it("tilesheet formatCues mention tileable/grid", () => {
    const cues = framingFor("tilesheet").formatCues.toLowerCase();
    expect(cues.includes("tileable") || cues.includes("grid")).toBe(true);
  });

  it("character-tpose carries POSE cues only (canon supplies style/background)", () => {
    const f = framingFor("character-tpose");
    expect(f.key).toBe("character-tpose");
    const cues = f.formatCues.toLowerCase();
    expect(cues).toContain("t-pose");
    expect(cues).toContain("full-body");
    expect(cues).toContain("front orthographic view");
    // Guards composition (single figure) + pose, but must NOT set a background or fight
    // the canon's 2D/pixel-art STYLE (doing so produced a photoreal creature on white).
    expect(f.nevers).toContain("arms down");
    expect(f.nevers).toContain("multiple figures");
    expect(f.nevers).not.toContain("2D");
    expect(f.nevers).not.toContain("pixel art");
    expect(cues).not.toContain("background");
  });

  it("falls back to the prop framing for an unknown key", () => {
    expect(framingFor("unknown-key")).toBe(ASSET_TYPE_FRAMINGS.prop);
    expect(framingFor("").key).toBe("prop");
  });
});

describe("ASSET_TYPE_OPTIONS", () => {
  it("covers every key in ASSET_TYPE_FRAMINGS", () => {
    const optionKeys = new Set(ASSET_TYPE_OPTIONS.map((o) => o.key));
    const framingKeys = Object.keys(ASSET_TYPE_FRAMINGS) as AssetTypeKey[];
    expect(optionKeys.size).toBe(framingKeys.length);
    for (const key of framingKeys) {
      expect(optionKeys.has(key)).toBe(true);
    }
  });

  it("labels match the framing labels", () => {
    for (const opt of ASSET_TYPE_OPTIONS) {
      expect(opt.label).toBe(ASSET_TYPE_FRAMINGS[opt.key].label);
    }
  });
});
