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

  it("character-apose carries A-pose cues (arms ~40° down) and stays canon-neutral", () => {
    const f = framingFor("character-apose");
    expect(f.key).toBe("character-apose");
    const cues = f.formatCues.toLowerCase();
    expect(cues).toContain("a-pose");
    expect(cues).toContain("40 degrees below horizontal");
    expect(cues).toContain("elbows slightly bent");
    expect(cues).toContain("full-body");
    expect(cues).toContain("front orthographic view");
    // Rig-ready contract preserved: single figure, symmetric, legs apart.
    expect(cues).toContain("symmetric");
    expect(cues).toContain("shoulder-width apart");
    // Must NOT be a T-pose, and must not set a background or fight the canon's style.
    expect(f.nevers).toContain("T-pose");
    expect(f.nevers).toContain("arms straight out");
    expect(f.nevers).toContain("multiple figures");
    expect(f.nevers).not.toContain("2D");
    expect(f.nevers).not.toContain("pixel art");
    expect(cues).not.toContain("background");
  });

  it("A-pose is the recommended rig-ready default (leads T-pose in the dropdown)", () => {
    const keys = ASSET_TYPE_OPTIONS.map((o) => o.key);
    const ai = keys.indexOf("character-apose");
    const ti = keys.indexOf("character-tpose");
    expect(ai).toBeGreaterThanOrEqual(0);
    expect(ti).toBeGreaterThanOrEqual(0);
    expect(ai).toBeLessThan(ti); // A-pose appears first
    expect(ASSET_TYPE_FRAMINGS["character-apose"].label.toLowerCase()).toContain("recommended");
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
