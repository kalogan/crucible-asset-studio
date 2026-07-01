import type { CanonInsert } from "@/lib/schema";

/**
 * GYRE canon, authored from gyre/DESIGN.md (§"Tone & visual language") and
 * gyre/src/room.tsx GYRE_COLORS. GYRE is a 3D atmospheric dungeon-crawler,
 * SMT-Nocturne-adjacent in MOOD: a dead world curled inward toward a Still Point.
 *
 * Visual DNA (DESIGN.md): near-monochrome cold & dark — slate/ash/deep indigo —
 * with ONE cold accent glow per room (pale moonlight in Room 1). Low-poly, hard-
 * faceted, sparse; single dramatic light source; heavy fog; long shadow. Dread
 * over spectacle. Palette hexes come straight from GYRE_COLORS (Room 1 cold set).
 *
 * `character_theme` drives the Character forge's player prompt: the caught souls of
 * the Coil — the Unspooled / Hollows / Wardens — faceted and spare.
 */
export function gyreCanon(projectId: string): CanonInsert {
  return {
    project_id: projectId,
    name: "GYRE core",
    lora_trigger: null,
    lora_status: "none",
    prompt_prefix:
      "faceted low-poly 3D game asset, hard-faceted geometry, flat-shaded, sparse and " +
      "spare, near-monochrome cold palette — slate, ash, deep indigo; a single cold " +
      "light source, heavy fog, long shadow, moody atmospheric dread, oppressive solitude",
    prompt_suffix:
      "one cold accent glow, pooled light in vast dark, readable silhouette, isolated object, dark background",
    negative_prompt:
      "bright, warm, photorealistic, cluttered, smooth-shaded, colorful, cheerful, " +
      "high detail, busy background, PBR, text",
    reference_imgs: [],
    style_guide: {
      north_star:
        "Faceted low-poly, dark, single cold light source, heavy fog, moody — a dead " +
        "world curled inward toward a Still Point. Near-monochrome cold dread: slate, " +
        "ash, deep indigo, with one cold accent glow. Dread over spectacle.",
      // Cold Room-1 set from GYRE_COLORS (room.tsx): slate/ash/indigo body + pale accent + cold ember rim.
      palette: { hexes: ["#20242c", "#2b2e33", "#151a2b", "#cdd6e6", "#3a4a66"] },
      character_theme:
        "The Unspooled / Hollows / Wardens — caught souls reshaped by the Gyre, " +
        "faceted and spare. A near-monochrome cold figure of hard-faceted low-poly " +
        "geometry, lit by a single cold light in heavy fog; neither living nor spirit.",
      do: [
        "Faceted low-poly, hard-faceted geometry, flat-shaded, sparse — every object reads",
        "Near-monochrome cold palette: slate, ash, deep indigo",
        "One cold accent glow per subject; single dramatic light source; heavy fog",
        "Isolated subject, readable silhouette, pooled light in vast dark",
      ],
      never: [
        "Bright or warm lighting",
        "Photorealistic or smooth-shaded",
        "Cluttered or busy backgrounds",
        "Colorful, cheerful, or high-gloss detail",
      ],
    },
  };
}
