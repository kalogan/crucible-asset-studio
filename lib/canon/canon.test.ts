import { describe, it, expect } from "vitest";
import { buildFinalPrompt } from "./prompt";
import { canonReadiness } from "./precision";
import { wayfindersCanon } from "./seeds/wayfinders";
import { Canon } from "@/lib/schema";

const canonRow = (overrides: Record<string, unknown> = {}) =>
  Canon.parse({
    id: "11111111-1111-4111-8111-111111111111",
    project_id: "22222222-2222-4222-8222-222222222222",
    name: "Wayfinders core",
    style_guide: {
      palette: { a: ["#fff"] },
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

  it("wraps the subject in canon prefix + suffix", () => {
    expect(
      buildFinalPrompt(
        { prompt_prefix: "wyfndrstyle, faceted low-poly", prompt_suffix: "3/4 view" },
        "a barrel",
      ),
    ).toBe("wyfndrstyle, faceted low-poly, a barrel, 3/4 view");
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
});
