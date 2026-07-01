import { describe, it, expect } from "vitest";
import { buildFinalPrompt, buildCharacterTposePrompt } from "./prompt";
import { framingFor } from "./framing";
import { canonReadiness } from "./precision";
import { wayfindersCanon } from "./seeds/wayfinders";
import { livingDungeonCanon } from "./seeds/living-dungeon";
import { Canon } from "@/lib/schema";

const canonRow = (overrides: Record<string, unknown> = {}) =>
  Canon.parse({
    id: "11111111-1111-4111-8111-111111111111",
    project_id: "22222222-2222-4222-8222-222222222222",
    name: "Wayfinders core",
    style_guide: {
      palette: { hexes: ["#243258", "#5cffd0"] },
      do: ["a", "b", "c"],
      never: ["x", "y", "z"],
    },
    prompt_prefix: "wyfndrstyle, faceted low-poly, flat-shaded",
    prompt_suffix: "3/4 view, isolated object",
    negative_prompt: "photorealistic, PBR",
    reference_imgs: [],
    lora_ref: null,
    lora_trigger: "wyfndrstyle",
    lora_status: "none",
    created_at: "2026-06-29T00:00:00.000Z",
    updated_at: "2026-06-29T00:00:00.000Z",
    ...overrides,
  });

describe("buildFinalPrompt", () => {
  it("falls back to canon-free when no canon", () => {
    expect(buildFinalPrompt(null, "a barrel")).toBe(
      "a barrel, isolated object, neutral background",
    );
  });

  it("wraps subject in prefix+suffix, injects palette, bakes nevers as 'no X'", () => {
    const out = buildFinalPrompt(canonRow(), "a barrel");
    expect(out).toContain("wyfndrstyle, faceted low-poly, flat-shaded"); // prefix
    expect(out).toContain("a barrel"); // subject
    expect(out).toContain("3/4 view, isolated object"); // suffix
    expect(out).toContain("palette #243258, #5cffd0"); // palette injected
    expect(out).toContain("no photorealistic"); // baked never
    expect(out).toContain("no PBR");
  });
});

describe("buildCharacterTposePrompt (rig-ready character path)", () => {
  const ldRow = () => {
    const seed = livingDungeonCanon("22222222-2222-4222-8222-222222222222");
    return canonRow({
      prompt_prefix: seed.prompt_prefix,
      prompt_suffix: seed.prompt_suffix,
      negative_prompt: seed.negative_prompt,
      style_guide: seed.style_guide,
      name: seed.name,
      lora_trigger: seed.lora_trigger,
    });
  };

  it("uses the 3D-character wrapper + T-pose cues, drops the canon's 2D format", () => {
    const framing = framingFor("character-tpose");
    const out = buildCharacterTposePrompt(
      ldRow(),
      `a hunched flesh-golem, ${framing.formatCues}`,
      framing.nevers,
    );
    // 3D character wrapper + T-pose framing present
    expect(out).toContain("full-body 3D game character, clean stylized sculpt, readable silhouette");
    expect(out).toContain("symmetric T-pose");
    expect(out).toContain("front orthographic view");
    // Canon STYLE carried: palette hexes + a light north_star mood hint
    expect(out).toContain("palette #4e2329, #8a3a41, #4dbbc0, #0a0a12");
    expect(out).toContain("Interior of a living organism");
    // Format nevers baked as "no X"
    expect(out).toContain("no 2D");
    expect(out).toContain("no pixel art");
    expect(out).toContain("no arms crossed");
    // The 2D-tile canon format is NOT applied
    expect(out).not.toContain("2D pixel art"); // prompt_prefix
    expect(out).not.toContain("game asset pixel art"); // prompt_suffix
    expect(out).not.toContain("no smooth gradients"); // canon negative_prompt
    expect(out).not.toContain("no 3d render"); // canon negative would fight a 3D sculpt
  });

  it("works canon-free (wrapper + nevers, no palette/mood)", () => {
    const framing = framingFor("character-tpose");
    const out = buildCharacterTposePrompt(null, `a knight, ${framing.formatCues}`, framing.nevers);
    expect(out).toContain("full-body 3D game character");
    expect(out).toContain("no pixel art");
    expect(out).not.toContain("palette");
  });
});

describe("canonReadiness", () => {
  it("a complete canon is ready", () => {
    const r = canonReadiness(canonRow());
    expect(r.ready).toBe(true);
    expect(r.missing).toEqual([]);
  });

  it("flags a thin canon", () => {
    const r = canonReadiness(
      canonRow({ prompt_prefix: "", negative_prompt: "", style_guide: {} }),
    );
    expect(r.ready).toBe(false);
    expect(r.missing.length).toBeGreaterThanOrEqual(4);
  });
});

describe("wayfindersCanon seed", () => {
  it("produces a canon that passes the precision bar", () => {
    const seed = wayfindersCanon("22222222-2222-4222-8222-222222222222");
    const row = canonRow({
      prompt_prefix: seed.prompt_prefix,
      prompt_suffix: seed.prompt_suffix,
      negative_prompt: seed.negative_prompt,
      style_guide: seed.style_guide,
      name: seed.name,
    });
    expect(canonReadiness(row).ready).toBe(true);
    expect(seed.lora_trigger).toBe("wyfndrstyle");
  });

  it("Living Dungeon seed passes the precision bar", () => {
    const seed = livingDungeonCanon("22222222-2222-4222-8222-222222222222");
    const row = canonRow({
      prompt_prefix: seed.prompt_prefix,
      prompt_suffix: seed.prompt_suffix,
      negative_prompt: seed.negative_prompt,
      style_guide: seed.style_guide,
      name: seed.name,
      lora_trigger: seed.lora_trigger,
    });
    expect(canonReadiness(row).ready).toBe(true);
  });
});
