import type { CanonInsert } from "@/lib/schema";

/**
 * Wayfinders canon, authored directly from docs/WAYFINDER_ART_BIBLE.md (§2 DNA,
 * §5 palette, §14 do/never, §15 LoRA playbook). This is the hand-seeded canon so
 * generation is on-style immediately without an Anthropic key. `lora_status: none`
 * — the trained LoRA comes with the LoRA slice (trigger already reserved).
 */
export function wayfindersCanon(projectId: string): CanonInsert {
  return {
    project_id: projectId,
    name: "Wayfinders core",
    lora_trigger: "wyfndrstyle",
    lora_status: "none",
    prompt_prefix:
      "wyfndrstyle, cozy stylized faceted low-poly, flat-shaded facets, chunky " +
      "rounded forms, silhouette-first, vertex-color flat materials, soft bloom, " +
      "one warm key light, storybook papercraft diorama charm",
    prompt_suffix:
      "saturated-but-soft palette, legible, 3/4 view, isolated object, neutral background",
    negative_prompt:
      "photorealistic, realistic, PBR, normal map, high detail, micro detail, " +
      "noisy texture, grimdark, gritty, horror, desaturated, muddy, plastic, " +
      "glossy specular, gacha, hyper-detailed ornament, spindly, busy background, " +
      "harsh shadows, dramatic lighting",
    reference_imgs: [],
    style_guide: {
      north_star:
        "Cozy-stylized faceted low-poly with soft bloom — warm, rounded, hand-made, " +
        "never grim, gritty, or photoreal. A warm papercraft toy lit by a campfire.",
      palette: {
        snow_cool: ["#e8f0ff", "#cdddf2"],
        fire_emissive: ["#ffb24d", "#ff8c42"],
        aurora_glow: ["#5cffd0", "#a8e063"],
      },
      dna: [
        "faceted low-poly",
        "chunky & rounded",
        "silhouette-first",
        "vertex-color / flat material",
        "emissive warmth",
        "cozy-warm key light",
        "anchored & legible",
        "hand-made charm",
      ],
      do: [
        "Faceted low-poly, flat-shaded, chunky rounded forms, silhouette-first",
        "Flat / vertex / emissive color; soft bloom; one warm key light",
        "Saturated-but-soft palettes; warmth pooled at lanterns/braziers/hearths",
        "Distinct silhouette per asset; legible even at night",
      ],
      never: [
        "Photoreal / PBR / normal-mapped / micro-surface noise",
        "Grimdark, gritty, horror, desaturated mud where colors blend",
        "Hyper-detailed AAA fantasy ornament, gacha-gloss, plastic specular",
        "Per-object lights, harsh chiaroscuro, busy tertiary detail",
      ],
    },
  };
}
