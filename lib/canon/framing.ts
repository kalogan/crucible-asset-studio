/**
 * Per-asset-type FRAMING — the FORMAT half of a prompt.
 *
 * The canon supplies STYLE (palette, look, mood); the asset type supplies FORMAT
 * (composition, framing) and format-specific "nevers". This separation fixes the
 * bug where a tilesheet-flavored canon (e.g. "no human faces", "seamlessly
 * tileable") fights a character portrait: those nevers belong to the *format*, not
 * the style, so they should travel with the asset type instead of the canon.
 *
 * `formatCues` is appended to the assembled prompt (see lib/canon/prompt.ts) and
 * `nevers` are merged into the canon's nevers — so a `character` framing carries an
 * empty `nevers` array and never inherits a "no faces" constraint.
 *
 * Pure data module: no "server-only", no React — safe to import anywhere.
 */

export type AssetTypeKey =
  | "prop"
  | "tilesheet"
  | "character"
  | "character-apose"
  | "character-tpose"
  | "sprite"
  | "icon"
  | "texture";

export interface Framing {
  key: AssetTypeKey;
  /** Human label for a dropdown, e.g. "Character / portrait". */
  label: string;
  /** Appended to the prompt — concrete composition/framing cues. */
  formatCues: string;
  /** Format-specific nevers, merged with the canon's nevers. Short. */
  nevers: string[];
}

export const ASSET_TYPE_FRAMINGS: Record<AssetTypeKey, Framing> = {
  prop: {
    key: "prop",
    label: "Prop / object",
    formatCues: "single isolated object, centered, neutral background, full object visible",
    nevers: ["multiple objects", "scene"],
  },
  tilesheet: {
    key: "tilesheet",
    label: "Tilesheet",
    formatCues:
      "seamless tilesheet, 4x4 grid of tiles, top-down orthographic, seamlessly tileable, repeating texture",
    nevers: ["single object", "characters", "faces"],
  },
  character: {
    key: "character",
    label: "Character / portrait",
    formatCues:
      "single centered character, front-facing, full figure or bust, clear readable silhouette",
    // Intentionally empty: characters need faces and must not inherit a "no faces" never.
    nevers: [],
  },
  "character-apose": {
    key: "character-apose",
    label: "Character — rig-ready (A-pose, recommended)",
    // The RECOMMENDED rig-ready framing. Same contract as character-tpose (single
    // full-body head-to-toe figure, symmetric, front orthographic, legs apart — so it
    // promotes to a clean, separable, riggable 3D mesh) but with the arms held DOWN at
    // ~40° below horizontal instead of straight out. An A-pose rigs AND rest-deforms
    // slightly better than a strict T-pose (the shoulder isn't at a hard 90°, so weights
    // relax more naturally) while keeping the limbs just as separable from the torso.
    // POSE/COMPOSITION only — the canon supplies STYLE. Do NOT set a background here
    // (the canon's background must win) and do NOT add anti-2D nevers (fighting the
    // canon's style is what produced a photoreal creature on white).
    formatCues:
      "single full-body character head-to-toe, one figure centered, symmetric natural A-pose, " +
      "arms relaxed at roughly 40 degrees below horizontal away from the body, elbows slightly " +
      "bent, hands open and clear of the torso, legs shoulder-width apart, standing upright, " +
      "facing forward, front orthographic view",
    // Composition guards FIRST (buildFinalPrompt merges canon negatives BEFORE these and
    // caps the list). "arms straight out" / "T-pose" are nevers here so the A-pose angle
    // is not overridden; "arms crossed" keeps the arms clear of the torso for separability.
    nevers: [
      "sprite sheet",
      "multiple figures",
      "multiple views",
      "grid of frames",
      "T-pose",
      "arms straight out",
      "arms crossed",
      "sitting",
      "crouching",
      "action pose",
      "cropped",
      "close-up",
    ],
  },
  "character-tpose": {
    key: "character-tpose",
    label: "Character — rig-ready (T-pose)",
    // POSE/COMPOSITION only — the canon supplies the STYLE (palette, background, mood,
    // and its "no photorealistic / no human faces" guards). Do NOT set a background here
    // (the canon's "pure black background" must win) and do NOT add anti-2D nevers (a
    // bio-horror pixel-art canon renders as the right stylized dark figure — fighting it
    // is what produced a photoreal creature on white). This framing ONLY makes it a single
    // full-body T-pose figure so it promotes to a riggable 3D mesh.
    formatCues:
      "single full-body character head-to-toe, one figure centered, symmetric T-pose, both " +
      "arms extended straight out horizontally away from the torso, legs shoulder-width apart, " +
      "standing upright, facing forward, front orthographic view, neutral hands",
    // Composition guards FIRST: buildFinalPrompt merges canon negatives BEFORE these and
    // caps the list, so the "single figure" guards must lead to survive. The T-pose *cues*
    // already handle standing/arms-out, so pose nevers are secondary.
    nevers: [
      "sprite sheet",
      "multiple figures",
      "multiple views",
      "grid of frames",
      "sitting",
      "crouching",
      "arms down",
      "action pose",
      "cropped",
      "close-up",
    ],
  },
  sprite: {
    key: "sprite",
    label: "Sprite sheet",
    formatCues:
      "game sprite sheet, multiple poses in a grid, isolated on neutral background, top-down or side view",
    nevers: ["scene", "background clutter"],
  },
  icon: {
    key: "icon",
    label: "Icon",
    formatCues: "single centered icon, simple clear symbol, neutral background, small-size legible",
    nevers: ["scene", "background clutter"],
  },
  texture: {
    key: "texture",
    label: "Texture",
    formatCues: "seamless tileable texture, flat top-down, no objects, repeating surface detail",
    nevers: ["objects", "characters"],
  },
};

/** Dropdown options, in a sensible authoring order. */
export const ASSET_TYPE_OPTIONS: { key: AssetTypeKey; label: string }[] = [
  "prop",
  "character",
  // A-pose is the RECOMMENDED rig-ready default; it leads the T-pose in the dropdown.
  "character-apose",
  "character-tpose",
  "sprite",
  "icon",
  "tilesheet",
  "texture",
].map((key) => {
  const f = ASSET_TYPE_FRAMINGS[key as AssetTypeKey];
  return { key: f.key, label: f.label };
});

/**
 * Resolve a framing for an arbitrary string key, falling back to the `prop`
 * framing as a safe default for unknown/missing keys.
 */
export function framingFor(key: string): Framing {
  if (Object.prototype.hasOwnProperty.call(ASSET_TYPE_FRAMINGS, key)) {
    return ASSET_TYPE_FRAMINGS[key as AssetTypeKey];
  }
  return ASSET_TYPE_FRAMINGS.prop;
}
