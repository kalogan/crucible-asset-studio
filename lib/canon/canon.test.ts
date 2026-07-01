import { describe, it, expect } from "vitest";
import { buildFinalPrompt } from "./prompt";
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

describe("character-tpose framing (uses the FULL canon for style)", () => {
  const ldRow = () => {
    const seed = livingDungeonCanon("22222222-2222-4222-8222-222222222222");
    return canonRow({
      prompt_prefix: seed.prompt_prefix,
      prompt_suffix: seed.prompt_suffix,
      negative_prompt: seed.negative_prompt,
      style_guide: seed.style_guide,
    });
  };

  it("keeps the canon's style + guards, adds T-pose framing, and doesn't fight the canon", () => {
    const framing = framingFor("character-tpose");
    const out = buildFinalPrompt(
      ldRow(),
      `a hunched flesh-golem, ${framing.formatCues}`,
      framing.nevers,
    );
    // FULL canon STYLE applied — this is what gives the Living Dungeon look.
    expect(out).toContain("2D pixel art"); // prefix (FLUX renders it stylized, not literal pixels)
    expect(out).toContain("pure black background"); // suffix
    expect(out).toContain("palette #4e2329, #8a3a41, #4dbbc0, #0a0a12");
    expect(out).toContain("no photorealistic"); // canon guard — prevents a photoreal creature
    expect(out).toContain("no human faces");
    // T-pose FORMAT framing present.
    expect(out).toContain("symmetric T-pose");
    expect(out).toContain("front orthographic view");
    expect(out).toContain("no multiple figures"); // framing composition guard
    // The framing does NOT fight the canon with anti-2D nevers or a background override.
    expect(out).not.toContain("no 2D");
    expect(out).not.toContain("no pixel art");
    expect(out).not.toContain("plain solid background");
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
