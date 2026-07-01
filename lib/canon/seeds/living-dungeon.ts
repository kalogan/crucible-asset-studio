import type { CanonInsert } from "@/lib/schema";

/**
 * Living Dungeon canon, authored from the March prototype's art bible
 * (GAME_PROFILES["living-dungeon"].artBible in _reference). This is the known-good
 * 2D pixel-art case — used to validate that Crucible's canon+scaffolding reproduces
 * assets the March forge made well. 2D final asset (no LoRA, no 3D promotion needed).
 */
export function livingDungeonCanon(projectId: string): CanonInsert {
  return {
    project_id: projectId,
    name: "Living Dungeon core",
    lora_trigger: null,
    lora_status: "none",
    // Style only — NOT format. Asset format (tilesheet / portrait / sprite) goes in
    // the per-asset prompt, so one canon serves every asset type (the March model).
    prompt_prefix:
      "2D pixel art, biological horror aesthetic — the interior of a living organism: " +
      "flesh, membranes, veins, bioluminescence; wet mucus sheen, ribbed cartilage " +
      "texture, dark maroon body with cyan bioluminescent glow",
    prompt_suffix: "pure black background, readable silhouette, game asset pixel art, no outlines",
    negative_prompt:
      "metal, stone, sci-fi tech, human faces, text, outlines, 3d render, " +
      "photorealistic, smooth gradients",
    reference_imgs: [],
    style_guide: {
      north_star:
        "Interior of a living organism — flesh, membranes, veins, bioluminescence. " +
        "Dark, organic, tense. The dungeon is ALIVE and AWARE.",
      // The Character-forge player theme (verbatim from the forge's playerTheme) so
      // LD characters keep exact parity instead of the north-star fallback.
      character_theme:
        "Human host partially consumed by a living dungeon organism — biological horror " +
        "aesthetic. Humanoid but with visible organic mutation overgrowth.",
      palette: { hexes: ["#4e2329", "#8a3a41", "#4dbbc0", "#0a0a12"] },
      do: [
        "2D top-down pixel art, 32x32 tiles, seamlessly tileable",
        "Biological horror — flesh, membranes, veins, bioluminescent glow",
        "Wet mucus sheen, ribbed cartilage texture, cyan emission at edges",
        "Isolated sprite on a pure black background, readable silhouette",
      ],
      never: [
        "Metal, stone, or sci-fi tech",
        "Human faces or text",
        "Outlines",
        "3D render or photorealism",
      ],
    },
  };
}
